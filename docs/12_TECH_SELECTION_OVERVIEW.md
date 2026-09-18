# Omni-Edu Agent 技术架构与数据方案

版本：v1.0  
日期：2026-09-16  
状态：技术唯一权威基线

## 1. 架构结论

采用本地优先的桌面单体和受限 Worker/sidecar，而不是提前建设分布式平台：

```text
React renderer
  -> typed preload
  -> Electron main（权限、业务、审计、确认）
      -> SQLite WAL（业务真源）
      -> managed files（原文件与产物）
      -> FTS5 / LanceDB（可重建索引）
      -> Python worker（Docling、OCR、检索、DeepTutor adapter）
      -> cloud model（仅脱敏最小上下文）
```

默认不引入 Redis、Kafka、Kubernetes、远程对象存储、远程向量库、多租户或云同步。若未来出现团队协作需求，必须先定义新的数据所有权、冲突、隐私和运维模型，不能把旧“千万级平台架构”直接放进当前客户端。

## 2. 数据分层

| 层 | 内容 | 真源/派生 | 恢复策略 |
| --- | --- | --- | --- |
| SQLite | 资源元数据、题目、版本、学生最小档案、任务、审计、确认、产物记录 | 业务真源 | schema migration + 备份 |
| managed files | 原始资料、错题图片、导出文件 | 内容真源 | manifest + hash + 文件备份 |
| FTS5 | 文本倒排索引 | 派生 | 从结构化文本重建 |
| LanceDB | embedding 与向量索引 | 派生 | 从 chunk + model version 重建 |
| cache/tmp | 缩略图、中间页、模型缓存 | 临时 | 可删除、可重算 |

禁止把 30–40GB 文件或完整二进制放进 SQLite。路径保存规范化相对路径；所有打开本地路径的 IPC 必须验证目标位于受管目录或本次用户明确选择的导出路径。

## 3. 大规模资料导入

导入任务采用持久化状态机：`queued -> scanning -> hashing -> parsing -> indexing -> ready`，失败为 `partial_failed/failed/cancelled`。每个文件记录大小、mtime、SHA-256、MIME、来源路径指纹、受管路径、parser 版本和错误。

要求：

- 目录流式遍历和批量提交，禁止一次把全部文件列表/正文装入内存。
- SHA-256 内容去重，并保留“同内容不同来源”的引用关系。
- 支持暂停、取消、断点续跑、部分失败重试和缺失文件检查。
- 解析、OCR、embedding 分队列且有并发上限；应用重启后能继续或明确恢复。
- 资源删除先软删除元数据，清理原文件和索引必须有引用计数和教师确认。

## 4. 解析与 OCR

### 4.1 文档解析

通用主线使用 Docling，将页面、段落、标题、表格、图片和坐标转换为内部中间表示。DOCX/PPTX/PDF 的原生库只作为格式降级或导出工具。每个 chunk 保存 sourceId、page、section、bbox、contentHash、parserVersion 和 evidenceStrength。

实现说明（2026-09-17，W09）：`python/omni_edu_parse` worker 默认执行顺序为**本地原生库优先（pypdf / python-docx / python-pptx / 纯文本）→ Docling 回退**，可用 `OMNI_EDU_PARSE_ENGINE=docling` 强制 Docling 优先。理由：Docling 首次使用需下载模型且 CPU 推理慢，桌面端 30–40GB 批量导入需要确定性吞吐与离线可用；扫描件、复杂表格等原生提取失败的场景仍由 Docling 兜底。每个资源记录真实使用的 `parseEngine`（名称@版本），解析失败写入 `parse_error` 并保持可重试，不伪造成功。

解析失败不能阻塞整个批次；原文件仍可管理，状态明确为待处理/不支持/失败。升级 parser 后按 fingerprint 定位受影响资源，禁止盲目全库重建。

### 4.2 OCR 选型

- 默认：RapidOCR + ONNX Runtime。用于中文印刷体错题和扫描页，桌面离线部署更轻，CPU 可用。
- 复杂版面：PaddleOCR PP-StructureV3。用于表格、多栏、题号与版面恢复。
- 公式：PaddleOCR PP-FormulaNet，按需下载和启用；首版不承诺完美 LaTeX。

模型资产必须有版本、下载源、hash、磁盘占用、健康检查和回退。OCR 输出保留 block/bbox/text/confidence/modelVersion；低置信度或数学结构不确定时强制教师复核。

## 5. 题目与来源模型

题目正文、答案和解析均需版本化。推荐核心实体：`resources`、`resource_versions`、`resource_chunks`、`question_bank_items`、`question_versions`、`question_sources`、`paper_blueprints`、`papers`、`paper_items`、`mistake_images`、`mistake_analyses`、`exercise_sets`、`document_artifacts`、`jobs`、`audit_events`。

题目来源枚举：

- `library_original`：直接来自教师资料。
- `library_adapted`：基于教师资料改编。
- `ai_generated`：模型独立生成。
- `teacher_created`：教师录入或创作。

`sourceId/page/chunkId/contentHash` 能定位证据时才可称为资料库来源；语义相似不能伪装成直接来源。

## 6. 检索

检索流程：元数据过滤 -> FTS5/BM25 -> LanceDB 向量召回 -> 合并去重 -> 可选 rerank -> 返回来源和分数。关键词与向量结果分别保留，方便解释与回归。

embedding 模型、维度、chunk 策略和索引版本必须写入元数据。索引是派生物：可校验、可删除、可局部重建。向量不可用时降级到 FTS5，不能让整个题库不可用。

## 7. 任务与并发

单机后台任务以 SQLite 持久化队列和受控 worker pool 实现。关键领取/写入使用事务、UNIQUE、幂等键和 `BEGIN IMMEDIATE`，不继续增加进程内互斥锁。任务包含进度、heartbeat、attempt、lastError、cancelRequested、inputFingerprint 和 outputVersion。

Electron main 不做同步大文件 IO；使用 `node:fs/promises` 或 Worker/Python 子进程。Python 进程必须有超时、取消、stderr 有界脱敏、协议版本和崩溃恢复。

## 8. Schema 与迁移

必须引入 `PRAGMA user_version` 或 `schema_migrations` 作为版本真源。在版本机制完成前：

- 新列同时更新新装 `CREATE TABLE` 和老库 `hasColumn + ALTER TABLE`。
- 新索引必须在依赖列迁移完成后创建。
- 所有迁移幂等、可测试、失败不留下半完成状态。
- 不在 seed 函数中调用会变化的业务方法；种子数据使用明确 SQL。

发布前覆盖：空库安装、上一正式版升级、失败重试、备份恢复和降级只读策略。

## 9. Electron 与 IPC 安全

- `contextIsolation=true`，renderer 无 Node 权限；只暴露最小 typed preload API。
- 所有 IPC 校验参数、权限、路径、大小和返回 schema。
- 模型、sidecar 和 renderer 都不能直接写业务表。
- API Key 使用系统凭据存储或本地加密配置，不入库、不入日志、不进 Git。
- 日志和事件只保存有界摘要，不保存原始附件、完整 prompt、隐藏推理、密钥或联系方式。
- 学生数据上传前执行确定性脱敏并记录 replacement audit；教师可预览云端实际接收内容。

## 10. 备份、恢复与可观测

完整备份覆盖 SQLite、managed files 和 manifest；manifest 记录相对路径、大小和 SHA-256。验证必须报告 missing/changed/unexpected，不把“目录存在”当作成功。恢复演练在隔离目录执行并验证关键 readback。

观测指标至少包括任务成功率/耗时/重试、解析/OCR 失败分类、索引大小与版本、检索延迟、模型 token/延迟/错误、导出状态和磁盘余量。无数据时显示 unavailable，不能估算成通过。

## 11. 性能验收

性能目标必须由固定数据集、机器规格和测量脚本定义。至少覆盖：10GB/30–40GB 首次导入、增量扫描、1万/10万/100万题检索、批量 OCR、应用启动、数据库升级、备份与恢复。目标数值在基准测试后写入，不在方案文档中编造。

## 12. 发布门禁

必须通过构建、相关单元/组件测试、Electron 用户路径、老库迁移、备份恢复、安全检查和安装包冒烟。真实模型、OCR 模型下载、断网降级、低磁盘和任务中断恢复是独立门禁。开发环境 fake/proxy 成功不得标记为生产通过。
