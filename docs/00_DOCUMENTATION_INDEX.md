# Omni-Edu Agent 文档索引

更新时间：2026-09-16  
状态：当前有效，后续开发必读

## 1. 使用方式

本目录只保留能够直接约束产品、架构、实现或验收的文档。后续 AI 不得把 Git 历史中的旧路线、根目录历史日志或已删除文件当作当前需求。

冲突优先级：

```text
用户本轮明确要求
> 1.Agent.md
> 本索引指定的权威文档
> 4.Wiki.md
> 2.Memory.md 最新记录
> 代码与当前测试证据
> 历史记录
```

产品目标与实际实现是两类真源：`11` 定义最终要做什么，`26` 说明目前真正接到前端和 E2E 的是什么。两者不得互相冒充。

## 2. 当前主文档

| 文档 | 唯一职责 | 何时阅读 |
| --- | --- | --- |
| `11_STRATEGIC_PRODUCT_PRD.md` | 最终产品、用户、核心闭环、模块边界和商业价值 | 任何需求、排期或大改前 |
| `12_TECH_SELECTION_OVERVIEW.md` | 本地优先架构、30–40GB 存储、OCR、解析、检索、安全、迁移和发布 | 后端、数据、Python、基础设施改动前 |
| `17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md` | 信息架构、页面职责、交互状态、HeroUI 复用和前端验收 | UI、导航、组件改动前 |
| `22_XIAOZHI_EDU_AI_HARNESS_PLAN.md` | Agent 路由、工具、上下文、确认、结构化输出、观测和 AI 测试 | 小智、模型或工具改动前 |
| `23_XIAOZHI_USABILITY_EVAL_RUBRIC.md` | 真实教师人工评分口径 | AI 可用性验收时 |
| `24_DEEPTUTOR_OMNI_EDU_INTEGRATION_DESIGN.md` | DeepTutor vendor/sidecar 的复用范围与宿主边界 | DeepTutor 相关改动前 |
| `26_FRONTEND_E2E_COVERAGE_MATRIX.md` | backend/preload/frontend/E2E/live 的当前完成证据 | 宣称功能完成、回归或发布前 |
| `config/deeptutor/*.md` | 已实现 DeepTutor 子模块的窄域契约 | 修改对应子模块时按需读取 |

`image.png` 是历史视觉素材，不具备需求优先级。

## 3. 已合并并删除的文档

下列文件已在 2026-09-16 合并后删除，原因是重复、方向冲突或仅为临时素材：

- `10_UI_FIRST_PRINCIPLES_TODO.md`：原则合并至 `11`、`17`。
- `13_DATA_STORAGE_DATABASE_ARCHITECTURE.md`、`14_BACKEND_REDIS_QUEUE_SYNC_ARCHITECTURE.md`、`15_AI_OCR_SEARCH_PIPELINE_ARCHITECTURE.md`、`16_SECURITY_PRIVACY_DEVOPS_SCALE_GUIDE.md`：合并至 `12`。
- `18_MVP_DEVELOPMENT_TASK_LIST.md`、`19_FULL_PRODUCT_DEVELOPMENT_PLAN.md`：旧阶段清单和机构化路线失效，产品边界以 `11` 为准。
- `20_UI_REDESIGN_PLAN.md`、`21_AI_CONSOLE_KNOWLEDGE_GRAPH_PLAN.md`、`ai中控台改造.md`：有效 UI 约束合并至 `17`、`22`；知识图谱不再是主入口。
- `25_DEEPTUTOR_FEATURE_INVENTORY_AND_PRODUCTION_MATRIX.md`：有效宿主边界和完成定义合并至 `24`，不再维护 77 项扩张清单。
- `27_XIAOZHI_AGENT_HARNESS_ENGINEERING.md`：有效工程约束合并至 `22`。
- `第二阶段/参考思路.md`、`第二阶段/架构思路.md`：临时提案已吸收，不再作为独立约束。

旧文档的 tracked 版本可从 Git 历史恢复，但不得恢复为活动基线。

## 4. 文档状态术语

- **目标**：已确定要达到的最终产品行为，但可能尚未实现。
- **已实现**：代码入口存在，不代表用户可用。
- **已接线**：主进程、preload 和 renderer 已连通。
- **已验证**：通过指定的真实用户路径和 readback 证据。
- **live 已验证**：使用真实 provider、模型、系统对话框或安装包验证。
- **未完成**：任一必要层缺失，不得写成“基本完成”。

## 5. 文档维护规则

1. 默认修改上述主文档，不新增相邻主题的编号文档。
2. 代码实施日志写入 `2.Memory.md`，稳定知识写入 `4.Wiki.md`；不要在架构文档尾部持续堆日期日志。
3. 产品方向变化先更新 `11`；技术边界变化更新 `12`；UI 变化更新 `17`；AI/DeepTutor 变化更新 `22`/`24`；完成状态变化更新 `26`。
4. 删除、重命名文档时同步更新本索引、`AGENTS.md`、README 和活动引用。
5. 每次宣称完成前，以当前代码和本轮测试为准，不沿用旧文档中的测试计数。
