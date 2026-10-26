# 小智知识库开源选型与重构建议

本文件保留初始开源调研与推荐演进。当前完整交付方案与独立AI批判后的结论以[文件夹自动题库交付方案](KNOWLEDGE_BASE_DELIVERY_PLAN_2026_10_24.md)及[批判与修订记录](KNOWLEDGE_BASE_CRITICAL_REVIEW_2026_10_24.md)为准。

调研日期：2026-10-24。状态：方案候选，等待共同定案；未实施业务变更。

用户补充：当前处于测试阶段，现有 SQLite 数据不必保留，允许不兼容旧表结构。以下方案不再以旧库迁移成本作为淘汰条件；正式选型可重新设计或替换结构化存储。此授权不改变本地优先、教师确认和来源可追溯要求；本轮未执行清库。后文“现 SQLite”是基线说明，保留既有表结构不是推荐方案的前置条件。

## 判断与建议

**Windows EXE 交付补充后的最新结论**：生产默认更推荐路线 B（Electron + 嵌入式索引 + 随包本地解析/推理进程），WeKnora Lite 保留为路线 A 对照。下文“优先验证整套复用”的早期判断针对功能复用率；加入安装、更新、离线与运行时维护后，不等于最终生产推荐。此处为最新建议，尚未共同定案。

按用户允许舍弃旧测试库的最新要求，优先验证 WeKnora Lite 整套资料检索复用；“嵌入式存储与检索组件 + 成熟解析器”作为对照。AnythingLLM 是桌面资料管理与检索适配的源码参考。当前证据不足以指定某个产品已经满足小智几十 GB 教辅库的召回和速度要求。

推荐待验证组合：原文件本地保存；小智现 SQLite 保存资料、版本、题目、审核、任务等事实；LanceDB OSS 保存可重建的全文/向量索引；Docling 作为复杂文档解析候选；保留现有 PDFium/RapidOCR 快速路径；选配本地中文 embedding 与 reranker。Pi 保持唯一业务编排。

这不是从零写 RAG：数据库、ANN、BM25、解析与模型推理复用成熟实现。需要自有的部分是教辅题目边界、教师确认、来源谱系、任务一致性、typed IPC 与界面。不存在已经核验可直接替换这些教育领域规则的通用知识库。

## 当前本地证据

- 已读取 Master Goal、Goal 四份状态、根目录四份协作文档；文档记录现扫描路径仍有 50 页/50 MiB/1 MiB 正文边界，30–40 GB 验收未完成。这是当前文档状态，不是本轮重新跑过的容量测试。
- 当前 checkout 的 `apps/desktop/src/main/education/question-retrieval.ts` 已实读：FTS5 trigram 派生索引与事务触发器存在；短词走 LIKE，排序按知识点完全匹配、更新时间、ID。此题库路径不能视为语义混合召回或相关性重排。
- 当前分支完成 graph 索引，源码检索定位后读回；未将别的 worktree 的状态当成本 checkout 验收。
- 本轮未做完整运行时性能审计，未宣称整个知识库不存在其他检索能力。

## 候选对比

| 仓库 | 可直接复用什么 | 与小智的适配判断 |
| --- | --- | --- |
| [Tencent/WeKnora](https://github.com/Tencent/WeKnora) | 文档解析协议、检索引擎接口、过滤、重排、引用定位、评估；可尝试 Lite 本地服务 | 整套候选优先。Go/Vue 与小智 TS/React 不同，完整引入会增加独立数据和运行时；只接资料检索，不接第二 Agent 或第二正式题库 |
| [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) | 资料采集、workspace 文档管理、向量库适配、模型缓存和桌面产品流程 | 桌面参考优先。通用文档聊天不等于教师题库；当前内置重排模型需用中文教辅重新评测 |
| [infiniflow/ragflow](https://github.com/infiniflow/ragflow) | 深度文档理解、切块、引用与检索流程 | 复杂扫描资料的对照候选；官方 Docker 部署和独立引擎运维对单机小智较重，不建议整套作为默认依赖 |
| [Cinnamon/kotaemon](https://github.com/Cinnamon/kotaemon) | 混合召回、重排、PDF 引用高亮流程 | Python/Gradio，与小智 UI 不同，适合作检索与证据预览参考；本轮 GitHub API 显示最近 push 为 2026-07-14，需评估维护响应 |
| [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) | 图谱检索、增量更新、选择删除 | 当前 Master 不建设 Graph RAG；其官方 README 也说明默认内存加文件后端仅适合小规模测试，不选为当前大库底座 |
| [1Panel-dev/MaxKB](https://github.com/1Panel-dev/MaxKB) | 企业知识库产品流程与配置参考 | API 检测主许可证 GPL-3.0；不作为默认代码迁移源，具体复制或分发前需要核验许可证及项目分发方式 |
| [docling-project/docling](https://github.com/docling-project/docling) | PDF/Office 解析、版面/表格/阅读顺序、统一文档表示 | 推荐作为可插拔 Python 解析器候选。官方支持 Windows、本地执行；数学公式、中文扫描质量和模型体积仍待测 |
| [lancedb/lancedb](https://github.com/lancedb/lancedb) | 嵌入式磁盘向量库、全文 BM25、ANN、过滤、混合搜索 | 推荐为可重建索引候选，无需额外数据库服务；Windows wheel/native 包、索引维护与故障恢复须做安装验收 |

本轮 GitHub API 核验：AnythingLLM、Docling、LightRAG 为 MIT；LanceDB、RAGFlow、kotaemon 为 Apache-2.0；MaxKB 为 GPL-3.0。WeKnora API 标识 NOASSERTION，实读 LICENSE 确认主体 MIT，同时列有第三方许可，不能只留一个 MIT 标签。模型权重、OCR 模型和二进制依赖须分别审计。以上是选型检查，并非法律意见或完整依赖审计。

## WeKnora 的关键核验

本轮主分支 SHA：`30658b7d43bf6415537435c42a5c4e95f2766b8d`。主分支能力不等于已发布版本能力；API latest release 为 v0.8.3，发布时间 2026-10-14，本轮该 release 的 assets 为空。

1. [安装说明](https://github.com/Tencent/WeKnora/blob/main/website-docs/01-getting-started/02-installation.md) 与 [架构说明](https://github.com/Tencent/WeKnora/blob/main/website-docs/02-architecture/01-overview.md)：有 Lite SQLite + FTS5 + sqlite-vec 路径，不必部署 PostgreSQL/Redis。不能因标准版较重直接排除。
2. [Lite 差异](https://github.com/Tencent/WeKnora/blob/main/docs/LITE.md)：内置仅 Simple 解析；复杂教辅不能直接套用标准版的解析宣传。云解析不符合小智原件默认不上传规则，必须接本地解析路径。
3. [SQLite 检索源码](https://github.com/Tencent/WeKnora/blob/30658b7d43bf6415537435c42a5c4e95f2766b8d/internal/application/repository/retriever/sqlite/repository.go)：中文 bigram + FTS5；向量 `vec0 MATCH`、`k` 与过滤 ID 子查询存在。不能把有向量查询推断成已具备大库 ANN 性能，必须单测百万片段与高选择性过滤。
4. [构建脚本](https://github.com/Tencent/WeKnora/blob/main/scripts/package-lite.sh)：CGO 与 sqlite_fts5。GitHub [release workflow](https://github.com/Tencent/WeKnora/blob/main/.github/workflows/release-lite.yml) 的 CLI 构建矩阵主要 Linux/macOS，桌面矩阵包含 Windows。存在构建配置不证明 Windows 产物已通过安装与大库验收。
5. [重排源码](https://github.com/Tencent/WeKnora/tree/main/internal/reranking) 与 [引擎接口](https://github.com/Tencent/WeKnora/blob/main/internal/types/interfaces/retriever.go) 可作为模块复用边界；Go 内部包抽取与依赖成本待进一步验证。不能把“MIT”当成复制后立刻可运行。

## 推荐架构与取舍

```text
本地目录/单份资料
  -> 有界导入、hash、重复检测与变更发现
  -> SQLite 持久任务：分页解析、取消、重试、重启恢复
  -> 快路径 PDFium/RapidOCR；复杂文档 Docling 候选
  -> 文档/章节/页/题目/答案/原图锚点
  -> 可重建索引：中文全文 + 向量 ANN + 元数据
  -> 按请求约束过滤、多路候选融合、有限重排
  -> 返回完整题面或证据片段及原件位置
  -> Pi 使用证据；教师修正/确认后进入正式业务事实
```

- 原件字节数、解析页数、chunk 数、向量维度是不同容量维度。40 GB 扫描图和 40 GB 文本的计算成本差别很大。
- 100 万片段 × 1024 维 × float32 = 4.096 GB 向量原始载荷；尚未计正文、ANN、缩略图、数据库及索引重建的临时空间。此为算术估计，不是本机实测。
- 使用本地文件磁盘存储和流式分页，绝不能在导入或首页把全库正文/图片/向量放入 renderer 或 IPC。
- 普通教材按章节/页的父子块处理；题目、选项、图、答案需要完整结构，不能统一固定长度切块导致题图和答案串题。
- 明确的学科/年级/教材版本等要求先过滤；用户没指定时不能误用硬过滤漏召回。宽搜后按证据排序。
- 初始实验参数可为关键词/向量各取 100，融合去重后重排 20–50，返回 10–20；这些只是假设，须由标注集调参。
- ANN 会影响近邻召回，需在固定测试集与小范围精确搜索对照，调索引参数；重排不能补救候选阶段彻底漏掉的资料。
- [LanceDB 全文文档](https://docs.lancedb.com/search/full-text-search/) 已列 ICU 和 Python Jieba 分词；不能照搬默认英文分词。需锁 SDK 版本并验证 Windows 离线分词资源。
- [AnythingLLM 重排器源码](https://github.com/Mintplex-Labs/anything-llm/blob/master/server/utils/EmbeddingRerankers/native/index.js) 当前采用 Xenova/ms-marco-MiniLM-L-6-v2。中文教育材料应独立选择模型，不直接沿用默认值。
- [Qwen3-Embedding](https://github.com/QwenLM/Qwen3-Embedding) 的 embedding/reranker 为模型候选；CPU/GPU、截断、内存、延迟、模型许可与离线安装共同决定最终配置，本轮未下载或评测。
- 索引采用版本化 generation：从 SQLite 任务/变更日志构建新索引，验证后切换；删除墓碑、失败重试和陈旧版本检查保证不返回旧题。派生库不写回教师确认事实。

## 两条可决策路线

| 路线 | 好处 | 需要证明的成本 |
| --- | --- | --- |
| A：WeKnora Lite 作为本地知识检索服务 | 复用整套功能较多，较快获得完整检索对照产品 | Go sidecar/本地认证、Windows 包、复杂解析接入；与 SQLite 真源同步、避免第二正式题库；大规模 vec0 的速度 |
| B：LanceDB + 本地解析器，迁移成熟产品模块（性能对照） | 与本地优先和现 Python/TS 边界更接近；更直接控制大库索引、题目结构和恢复 | 需要整合适配、任务/索引一致性与前端；不是整套零开发。模型与解析器安装体积待量化 |

用户允许舍弃旧测试库后，将 A 提升为整套复用优先验证路线，B 作为本地大库性能与可控性的对照。A 可以承接资料/chunk/index 数据模型，无需同步保留旧知识库表；小智题目审核等领域事实仍须明确归属，不能两边各自成为真源。最终依据 Windows、本地复杂解析、大库召回/速度和集成成本定案，当前不直接锁定 A 或 B。

## 定案前的最小实测合同（拟议，未运行）

1. 固定测试机 CPU、RAM、SSD、GPU/无 GPU，以及精确源码 commit、模型/索引版本。
2. 第一批涵盖中文教材、自然扫描试卷、双栏、跨页题、公式/图、答案册、同名不同版资料；只用授权测试副本，原件和学生数据不上传。
3. 至少 200 条人工标注查询；按找原题、同义知识点、精确数值/公式、跨章节、答案定位、OCR 噪声、无答案问题分别计分。
4. 同时统计原件 10/40 GB、页数和 10 万/100 万 chunk；40 GB 导入与百万 chunk 压测分别验收，合成扩容不充当自然材料质量测试。
5. 拟议质量门槛：标注集宏平均 Recall@20 >= 95%，nDCG@10 >= 0.85；精确查找任务另报正确来源 Top1；题图/答案引用与已删除/过期版本不得错绑。明确分母和多相关项标注，不以模型自评代替。
6. 拟议速度目标：指定测试机百万 chunk、热索引、单查询、无并行导入时，候选召回 P95 <= 500 ms，含 query embedding/有限重排的检索 P95 <= 2 s（不含生成回答）；冷启动、CPU-only、并行导入分别报告，达不到则量化取舍，不冒称达标。
7. 记录全量/增量导入吞吐、解析和 embedding 各阶段耗时、峰值 RAM、磁盘放大、取消耗时与重启恢复；一个文件变动不得导致全库重算。
8. Electron 从教师操作进入：导入、进度、部分失败重试、查询、原页定位、教师修改、删除、重启读回；验证 1366×768 与 1920×1080，以及脱网安装和模型资源定位。

## 边界与后续

本轮完成官方仓库与关键源码筛选；没有安装、模型下载、40 GB 导入、中文召回率或速度实测，也没有实施迁移。现有已验收能力与数据不变。

沿用“普通教师 Windows 本机无需 Docker、原件默认不出本机”的当前产品前提；优先对照验证 A 与 B。正式实施前需冻结 M02/M03/M04/M05 的纵向交付合同、测试数据重置范围与回滚；先解析/容量底座，再混合召回和题目检索，最后切换教师界面。

## Windows EXE 交付专项补充

**用户澄清的交付定义**：需要知识库集成在小智软件内部，面向真实用户发行；不是要求用户另行部署本机知识库服务。所有候选必须满足小智统一安装、启动、配置、更新、错误恢复与卸载。WeKnora 另行安装/运行、嵌入其网页作为独立产品入口不符合要求。允许内部技术实现包含随包、由小智管理的工作进程，但这不构成用户要部署的第二套产品。当前推荐收敛到路线 B 的组件级集成；WeKnora 保留为源码参考，不作为默认发行依赖。对源码深度抽取的进一步选择需通过依赖和 Windows 打包验证。

### 可以交付一个 EXE 安装包，但内部有多个文件和进程

建议交付 `小智安装程序.exe`，安装后点击一个小智入口。内部 Electron、原生库、解析 worker、OCR/embedding 模型独立存在，由小智启动与回收。无需用户安装 Python、Node、数据库、Docker 或启动命令行。安装包不是“永不解压、所有依赖/数据都塞在单个可执行文件”的承诺。

推荐程序目录只放程序/只读资源；教师选择 D:/E: 等资料根目录，模型缓存与可重建索引分开。卸载默认保留教师数据；更新程序不覆盖资料。完整离线发行包预置批准版本模型，在线轻包允许显式下载、校验与断点重试，两种形态均要测试。

### 路线代价

| 路线 | EXE 集成难度判断 | 持续代价 |
| --- | --- | --- |
| WeKnora 标准服务栈 | 高，不建议作为普通教师默认版 | 数据库/队列/容器安装、服务启动、端口、更新、备份与支持成本 |
| WeKnora Lite 本地后台进程 | 中高，可行，未做本机打包验证 | Go/CGO Windows 构建；REST 若采用需 loopback/随机端口/会话鉴权；崩溃回收和退出；复杂解析另配；上游 API/模型变化和双数据模型 |
| Electron + LanceDB + 本地解析 worker | 中，推荐 | 原生包和 DLL 收集、稳定版锁定、worker 生命周期、模型体积、索引升级与重建；需自有教辅领域适配 |

以上为工程判断，不是已测开发工期或性能排名。WeKnora 存在 Windows 桌面构建矩阵，不能说它不能打包；但把另一套 Wails/Vue 桌面嵌入小智并非推荐方式，应只复用后台能力。

### 成熟方案证据与限制

- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process) 提供 Node 子进程与消息通道，适合隔离索引任务；Python/Go worker 使用受管理的子进程和有界协议，不能把 utilityProcess 当成 Python 启动器。
- [LanceDB Node 包](https://github.com/lancedb/lancedb/blob/main/nodejs/package.json) 为 Node-API 原生扩展，列有 Windows x64/ARM64 目标。Node-API 通常减少 Node ABI 变化影响，但仍需验证 Electron、操作系统架构及 DLL；不能声称每个原生包都必然需要源码重编，也不能声称列有目标就已兼容小智。
- [Electron 原生模块文档](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) 说明原生扩展存在兼容与重编问题。实际打包需逐包区分 Node-API 预编译和 Electron ABI 绑定扩展，收集解包原生文件并做安装后加载测试。
- [AnythingLLM Windows 安装](https://docs.anythingllm.com/installation-desktop/windows) 证明本地 AI 知识库可以形成 Windows 安装产品，但当前官方安装器仍联网下载所需引擎/运行组件，不能直接拿来作为小智完整离线交付证据；公开 MIT 仓库不自动代表所有桌面发行资源均可直接再分发。
- [Docling 离线模型说明](https://docling-project.github.io/docling/usage/advanced_options/)：默认首次使用下载模型，可以预下载并指定本地资源路径。因此需构建阶段预取、清点许可与大小，离线安装测试不能用已缓存的开发机器代替。

### 用户实际会遇到的弊端及工程对策

1. 包与模型变大、冷启动慢：只装文档检索所需组件；延迟加载解析器；CPU 基础包与可选 GPU/高精度包分开，不虚报未测 MB/GB。
2. 普通电脑首次索引慢：后台队列、限并发、按页恢复、先可用后补全；首次 OCR 与日常查询分开显示，不承诺几十 GB 即时入库。
3. 磁盘放大：分别统计原件、页图、正文、向量、ANN、临时索引；用户能选择资料盘、清理可重建缓存。40 GB 原件不等于总占用 40 GB。
4. 内存与交互：索引/解析放隔离进程，IPC 仅传 IDs/分页结果/受控文件引用；OOM 或坏文件只失败当前任务。
5. 更新与恢复：结构化事实与派生索引分开；任务日志、索引 generation 与原子切换；禁用自动重嵌入全库；中断后可恢复，检索不可悄悄使用陈旧题。
6. Windows 分发：代码签名、杀毒误报处理、中文路径/非管理员、文件占用、D:/E: 数据盘断开、休眠恢复、重复启动、卸载/升级保数据均需真实安装机测试。
7. 数据与安全：原件及私密内容不进入默认遥测或崩溃日志；本地 HTTP 如启用也需鉴权，不能等同无需边界；许可公告和模型许可随包处理。

### 当前小智打包证据边界

本轮检查 `apps/desktop/package.json`：有 `electron-vite build`，未见 package/dist/release 脚本；定向文件枚举未找到 electron-builder/Forge/NSIS 配置。这个检查不证明仓库其他位置没有任何分发工具，但当前桌面 package 的 build 不是最终 EXE 安装验收。需将“干净 Windows、无开发依赖、安装到升级再卸载”列为首个技术验证，不等业务全部完成后才打包。
