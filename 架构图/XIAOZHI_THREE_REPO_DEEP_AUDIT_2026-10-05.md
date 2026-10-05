# 小智 EduDev / DeepTutor / OpenMAIC 三仓深度架构审计

> 审计日期：2026-10-05  
> 目的：为后续“定制化优化改造”建立源码级事实基线、能力所有权、迁移边界与交互式架构导航。  
> 方法：固定 Git commit → 读取真实入口/调用链/持久化/安全边界 → 与现有 Goal/CURRENT 文档交叉验证 → 按 Archify repository-authoring 原则记录源码证据。  
> 注意：本报告分析的是已 push 到 GitHub 的提交；本地未 push 修改不在证据范围内。

## 1. 固定基线

| 仓库 | 固定 revision | 规模 / 版本 | 在小智中的最终角色 |
| --- | --- | --- | --- |
| EduDev | `90d67381a08db8ba040211921288b55c87de3f55` | 3506 files / 722 dirs | **Product OS**：Electron、Pi、权限、五空间、本地真源、Artifacts |
| DeepTutor | `f07029cfcf2c8dfccdb671cdfc343db8334f5741` | v1.6.13 / 3599 files | **Education Intelligence**：learning/practice/reading/RAG/workspace 等领域能力 |
| OpenMAIC | `636fab0d7edee5e7c2694117c38ece8f623573f9` | 1.2.0-rc.1 / 3469 files | **Interactive Content Engine**：DSL/generation/renderer/editor/importer |
| Archify Skill | `3c4e4a50b0ebba92ffc0859ae12f34d90de523ae` | skill v3 / package 3.0.1 | 交互架构图的 authoring contract 与 fallback viewer 依据 |

## 2. 总体结论

这三个仓库并不是三个应当“合并”的应用，而是三种不同层级的资产。**EduDev 必须继续成为唯一产品宿主和数据真源；DeepTutor 应被降维成教育算法/服务提供者；OpenMAIC 应被降维成互动内容 SDK。** 这条 ownership 一旦守住，后续扩功能会越来越清晰；一旦把 DeepTutor AgentLoop 或 OpenMAIC server runtime 接回生产，项目会重新回到多 Runtime、多 Store、多 Session 真源竞争的状态。

EduDev 这次 `90d6738` 更新已经跨过一个关键拐点：`main/index.ts` 从约 2268 行降到 497 行，旧 DeepTutor/LangGraph 编排移入 `legacy-ai/test-runtime.ts`，新增 `RuntimeAuthority`，生产路径开始真正做到 **Pi-only assembly**。这不是“UI 改版”，而是架构权威发生了变化。

但收口还只完成了 Runtime 层。当前最大的剩余债务转移到了 **App.tsx / db.ts / preload / ai-harness/tool-registry / 历史文档和测试库存**。换言之：第二 Agent Runtime 已经被隔离，但“第二产品架构”和“超级 Store”尚未拆完。

---

# 3. EduDev 深度审计

## 3.1 产品壳：五空间已经从 PRD 进入真实代码

`renderer/components/product/product-spaces.ts:2-27` 已明确把一级认知收敛为：问小智、我的资料、教学内容、学生、设置。`ProductSpaceShell.tsx:11-40` 负责二级浏览壳，`PiWorkspaceShell.tsx:11-48` 则把同一个 ProductRail 带进 Chat 工作区。

**判断：KEEP。** 这套信息架构已经符合用户目标，不需要再改回传统后台侧边栏。接下来应该做的是把散落在 App.tsx 的传统学生/错题/复盘/题本/讲义 UI 逐步搬到这些空间内部，而不是再新增一级入口。

### 后续定制方向

- “问小智”保持 Codex-first，支持 contextual student/resource cards，但不把所有管理功能塞进 Chat。
- “我的资料”成为真实老师熟悉的资料库，而不是 RAG/Graph 工程面板。
- “教学内容”成为跨会话 Artifact Library；聊天是生产入口，教学内容是成果沉淀。
- “学生”以人和学习问题为中心，不展示 mastery engine / L2/L3 / graph 等技术名词。
- “设置”只留模型、Skills、数据、隐私；Developer 功能进入高级模式。

## 3.2 Production Runtime：Pi-only 已基本成立

证据链：

- `runtime-authority.ts:5-45`：只允许 `pi | legacy-test` 两种 authority；legacy 需要显式授权。
- `main/index.ts:203-211`：只有 `authority.mode === 'legacy-test'` 才动态导入 `legacy-ai/test-runtime`。
- `xiaozhi-agent/ipc.ts:16-94`：生产入口创建 `createXiaozhiProductionHost`，并以 main-frame gate 注册 start/stop/control 等接口。
- `production-host.ts:68-410`：宿主统一组装模型、skills、memory、browser、web、office、approval、goal 等 coordinator。
- `pi-session.ts:121-688`：最终由 Pi session 执行 prompt/tool loop。

**判断：KEEP + HARDEN。** Phase2 的核心方向是正确的，后续不应该再讨论“是否统一到 Pi”，而应该讨论“哪些领域能力还没有被 Pi Tool/Capability 化”。

## 3.3 Legacy Test Runtime：正确隔离，但还不是可立即删除

`legacy-ai/test-runtime.ts:24-27` 已明确标注“Historical education regression only. Never assembled in production.”。这是正确做法。

**判断：RETIRE LATER。** 当前仍承担大量旧教育回归、DeepTutor bridge/Graph/Console 兼容证据，不能因为生产不加载就直接删除。退役条件应当是：Phase4 DeepTutor 新 adapter 完整、所有生产引用清零、旧重要教育 eval 已迁移、数据/恢复兼容已验证。

## 3.4 Xiaozhi ProductionHost：现在是好边界，但正在变成新的聚合热点

`production-host.ts` 当前约 722 行 / 61KB。它已经承担 runtime aggregation，是比旧 main/index.ts 健康得多的位置；但它同时组装 attachment/browser/web/office/skill/memory/model/goal/control/approval 等大量 coordinator。

**判断：KEEP FACADE + 拆内部 service factory。** 不需要把 ProductionHost 拆成十几个独立“微服务”，但应把 sessionConfiguration、model lifecycle、capability assembly、artifact delivery 等形成内部 factory，避免它成为下一个 2000 行 index.ts。

## 3.5 PiSession：唯一 Loop 应保持“小而薄”

`pi-session.ts` 约 755 行 / 64KB。它目前承担 prompt identity、custom tools、compaction、memory/skill epoch、public projection、stop/settlement 等职责。

**判断：KEEP，但避免继续承载教育业务。** DeepTutor/OpenMAIC 后续都应该通过 Tool/Capability Provider 注入，不要在 `pi-session.ts` 里直接写 mastery、question generation、OpenMAIC scene generation 的具体业务算法。

目标形态：

```text
PiSession
  ├─ NativeToolProvider
  ├─ EducationCapabilityProvider
  ├─ InteractiveContentProvider
  ├─ MemoryProvider
  └─ ArtifactProvider
```

## 3.6 Typed Preload：安全门面正确，但 surface 需要按产品域拆分

`preload/index.ts` 397 行，当前同时暴露 Pi、materials、artifacts、传统学生/题库/记忆/旧 DeepTutor 等大量 API。

**判断：REFACTOR。** 不是让 renderer 直连 main，而是继续保留 contextBridge，但按 domain 生成/聚合 API：`xiaozhi`、`materials`、`teaching`、`students`、`settings`。旧兼容 API 在 legacy-test / compatibility facade 内隔离，逐步从正式类型表面移除。

## 3.7 OmniEduStore：当前最大结构债务

当前 `db.ts`：**7311 行、约 338KB、162 个 class methods、约 60 个真实业务表名**。它同时覆盖学生、学习记录、题库、题本、讲义、Memory、Agent run、Artifacts、Regression/Eval、知识图谱等。

`MaterialRepository` 已经给出了正确拆法：`db.ts:1047` 暴露 `readonly materials`，而实际资料查询/正文/ingest 进入 `main/assets/material-repository.ts:19-78`。

**判断：按这一模式渐进拆，不做大爆炸重写。** 推荐顺序：

| Repository | 从 OmniEduStore 移出的责任 | 原 facade 是否暂保 |
| --- | --- | --- |
| MaterialRepository | teacher_resources/resource_chunks | 是 |
| StudentRepository | students/assignments/profile | 是 |
| LearningRepository | learning_records/mastery/review | 是 |
| QuestionRepository | question bank/notebook/usage | 是 |
| TeachingRepository | teaching book/artifacts | 是 |
| AgentRepository | run/event/action/checkpoint | 是 |
| MemoryRepository | memory L1/L2/L3/evidence | 是 |
| EvaluationRepository | regression/usability/model grade | 是 |

拆分原则不是“一个表一个 repository”，而是按**业务一致性边界和事务边界**拆。

## 3.8 App.tsx：Runtime 收口后，前端最大的迁移债

当前 `App.tsx` **2828 行 / 121KB**。虽然五空间壳已经落地，但学生、旧 AI Console、资料、记录、文档、DeepTutor continuation 等大量状态和业务函数仍集中在 App。

**判断：P0/P1 级 REFACTOR。** `App` 最终只应该负责：AppShell、路由、global providers、workspace mount/lifecycle。传统业务页面逐步迁入：

```text
workspaces/
  AskXiaozhiWorkspace
  MaterialsWorkspace
  TeachingWorkspace
  StudentsWorkspace
  SettingsWorkspace
```

尤其要保留当前正确行为：PiEducationWorkspace 跨产品空间切换时保持挂载/会话连续，不因“拆组件”导致 Chat state 重建。

## 3.9 ai-harness：不能按目录整体删除

`ai-harness` 仍有 33 文件 / ~411KB，其中 `tool-registry.ts` 2577 行 / 135KB。这里混合了：

- Runtime/Router 历史代码；
- 确定性教育领域规则；
- Tool schema/validation/permissions；
- Evals/graders；
- Teaching book / review scheduler / learning analytics。

**判断：逐文件甚至逐函数分类。** `AgentLoop/router/graph runtime` 最终退役；`mastery-policy/review-scheduler/learning-analytics/question-notebook/teaching-book/grader/evals` 保留或迁至 domain。`tool-registry.ts` 必须拆，否则 Phase4 再接 DeepTutor 时会进一步膨胀。

推荐目标：

```text
tools/
  registry.ts
  education/
  students/
  knowledge/
  teaching/
  system/
policies/
  mastery.ts
  review.ts
  privacy.ts
```

## 3.10 Office-Agent / Hana vendoring

`office-agent` 136 文件，但大部分是明确 vendored 的 Hana/Codex protocol 适配资产。当前职责主要是文件宿主、网络读取、event projection、Office tool adapter。

**判断：KEEP 但不要再长出第二 Agent Host。** 它应作为 Native Capability 基础设施留在 Pi 下方；所有“Agent 决策”留给 Pi。vendored source manifest/LICENSE 模式继续沿用。

## 3.11 测试库存：证据文化很好，但已严重碎片化

`apps/desktop/scripts` 当前 **280 文件 / ~2.43MB**，大量 `pi-*-smoke.mjs`。这说明项目非常重视证据，这是优点；但继续“一需求一脚本”会让回归成本、发现成本、维护成本持续增长。

**判断：保留现有证据，不再按同模式无限增长。** 后续建立测试金字塔和 scenario runner，把相似 UI smoke 参数化；Golden Teacher Journeys 成为顶层场景，旧脚本逐步作为底层 fixtures/steps 被调用。

## 3.12 文档：已经有 CURRENT 体系，但历史冲突需要隔离

当前 `docs` 1831 文件。好消息是 `docs/goal/*`、`docs/architecture/CURRENT.md`、`docs/integrations/CURRENT.md` 已成为新的 Source of Truth。真正问题是旧 `docs/24_DEEPTUTOR...`、`docs/25_...` 仍保存“整体集成 AgentLoop”等过期方案。

**判断：不要删除历史，但必须 `SUPERSEDED`。** 在历史文档头部加状态、替代文档链接、适用 commit/日期；搜索/Agent instructions 明确 `CURRENT + Master Goal > archive/history`。

---

# 4. DeepTutor 1.6.13 深度审计

## 4.1 它最有价值的不是 Agent，而是教育 Domain

DeepTutor 的当前代码重心已经明显转向 `services / learning / capabilities / reading / book / RAG`。对小智最重要的是把它看成**教育算法和服务库**，而不是“另一个聊天产品”。

## 4.2 Learning Core — 最高优先级

`learning/service.py:266+` 的 `LearningService` 是高价值资产。`grade_and_record` 将答题结果、掌握度、复习推进、review queue 与持久化作为一条一致性链处理。与 EduDev 现有 review-scheduler/learning-analytics 能直接形成互补。

**处置：UPGRADE + ADAPT。** 不导入 DeepTutor LearningStore 成第二真源；把策略、状态转移、评价计算拆成纯 domain service，通过 `StudentRepository/LearningRepository` adapter 读写 EduDev 数据。

关键风险：DeepTutor 的部分 grading 使用短答相似度/关键词等启发式，不能直接成为教师事实。所有 mastery 更新要保留 evidence/confidence/teacher correction。

## 4.3 Practice — 高优先级

`services/practice/scheduler.py` 是明确的确定性 spaced repetition 策略，输入 state/rating/now，输出下一状态。它的价值在于**可回放、可测、无 LLM**。

**处置：ADAPT HIGH。** 与 EduDev 当前 review scheduler 做差异测试后统一一个 canonical policy，保留历史版本号，避免升级算法导致过去学生状态不可解释。

## 4.4 Reading Service — 非常适合直接能力化

`reading/service.py:1-12` 明确写着：模块不认识 tools、HTTP、chat loop、LLM，只接受 `ReadingStore` 返回 plain data；并提供 locator parsing、有界读取、搜索、quote verification。

**处置：ADAPT HIGH。** 这是比“复制 capability wrapper”更理想的集成层。给它实现 EduDev 的 ReadingStore adapter，连接 teacher_resources/resource_chunks/原文件版本即可。

## 4.5 Workspace Security — 强烈建议吸收

`services/workspace/service.py` 提供 allowed roots、deployment lock、outputs write grant、path confinement、anti-symlink 等规则。

**处置：ADAPT HIGH。** 这部分不是教育算法，而是 DeepTutor 做得比较成熟的本地安全设计。建议把规则/测试思想迁入 Xiaozhi WorkspaceAuthority，而不是运行 DeepTutor workspace server。

## 4.6 Memory / Consolidator — 用于“无感飞轮”的算法参考，不作为事实真源

`MemoryStore` 支持 L2/L3、preference write、revision；`consolidator/modes/update.py:1-16` 提供 new-since-last → chunk → extract → validate refs → atomic flush → optional dedup 的增量处理链。

**处置：ADAPT PATTERN。** 对小智最有价值的是：增量输入、引用验证、checkpoint、dedup、undo。不要让它直接覆盖 Student FACT。它应该输出 Preference/Strategy Candidate，再进入飞轮 Eval/Promotion。

## 4.7 RAG — 拿抽象和评估，不拿全部引擎

`RAGService` 支持 per-KB provider binding、provider factory、smart retrieval、trace；上游还包含 LightRAG/GraphRAG/LlamaIndex/PageIndex/IMA/Kiwix/WeKnora。

**处置：SELECTIVE ADAPT。** 小智的知识库真源继续在 EduDev。优先迁：provider binding、index signature/version、file routing、eval dataset/metrics、rerank seams。不要一次把全部 RAG provider 和依赖装进 Electron/Python sidecar。

## 4.8 Book Engine — 与 OpenMAIC 明确分权

DeepTutor BookEngine 强调 proposal → spine → pages → compile/retry/health。它更偏“学习内容结构和知识组织”，而 OpenMAIC 更偏“互动课堂的可视内容/场景/编辑”。

建议 ownership：

```text
DeepTutor Book
  → 教学逻辑 / 知识结构 / 学习路径 / 页面内容计划

OpenMAIC
  → Scene / Slide / Quiz / Interactive / Editor / Renderer
```

这样避免两个系统都拥有“课程文档”真源。

## 4.9 AgentLoop / Agentic Loop — 明确不迁

`agents/loop/agent_loop.py` 和 `runtime/agentic/loop.py` 都是完整模型↔工具循环，包含 retry/pause/tool dispatch/finalization。它们与 Pi 功能重叠。

**处置：DO NOT USE。** 现有 EduDev Python bridge 仍构造 1.5.11 AgentLoop，因此 Phase4 的真正升级不是“把 bridge 改到 1.6.13 AgentLoop”，而是**逐能力把 bridge 从 AgentLoop-host 变成 domain-service host**。

## 4.10 Session / FastAPI / Web / Multi-user

这些属于 DeepTutor 产品平台边界。

**处置：DO NOT USE / DROP。** 小智已经有 Electron/Pi/SQLite/Workspace；再引 FastAPI session store、多用户/auth/Web UI 会制造第二真源。

---

# 5. OpenMAIC 深度审计

## 5.1 六个 package 是真正的集成面

OpenMAIC 已把核心能力拆成独立 npm 包；这比从整站源码剪功能安全得多。

| Package | 当前判断 | 小智中的角色 |
| --- | --- | --- |
| `@openmaic/dsl` 0.11.2 | **REUSE HIGH** | 互动课程 canonical content contract |
| `@openmaic/generation` 0.3.15 | **ADAPT HIGH** | requirement → outline/scene/actions；模型由 Pi 注入 |
| `@openmaic/renderer` 0.1.11 | **REUSE HIGH** | 只读课堂/Slide 渲染 |
| `@openmaic/editor` 0.0.9 | **REUSE HIGH** | host-controlled 课程编辑器 |
| `@openmaic/importer` 0.3.0 | **ADAPT HIGH** | PPTX → DSL；browser-only |
| `@openmaic/storage` 0.37.1 | **CONTRACT ONLY** | 拿 Store interfaces，EduDev 实现 SQLite/File backend |

所有包根许可为 MIT，但最终分发仍需追踪字体、KaTeX、ECharts、Shiki、转依赖 NOTICE；不能用“OpenMAIC 根 MIT”替代依赖闭包审计。

## 5.2 DSL — 最适合作为互动教学内容的 canonical contract

`dsl/src/index.ts:2-37` 明确把自己定义为 dependency-free contract keystone。它正好解决“互动课堂到底用什么数据结构”的问题。

**建议：直接依赖/固定版本，不复制类型到 EduDev。** EduDev 只做 `XiaozhiTeachingArtifact ↔ OpenMAICStage/Scene` adapter 和版本迁移元数据。

## 5.3 Generation — AICallFn 是最关键接缝

`generation/src/pipeline-types.ts:60+` 暴露 `AICallFn`；scene generator 接受注入模型调用。这说明小智完全可以：

```text
Pi Tool
  → Xiaozhi OpenMAIC Adapter
  → generation.generate...
      aiCall = Xiaozhi/Pi model gateway
  → DSL validation
```

无需启动 OpenMAIC Agent Runtime。

## 5.4 Renderer — 可直接复用，但不是安全过滤器

Renderer README 明确它是 read-only canvas。适合在“教学内容/互动课堂”中嵌入。

**安全要求：** 不可信 rich text、URL、media source 必须由 Xiaozhi schema/sanitize/allowlist 审核；renderer 能渲染并不意味着输入天然安全。

## 5.5 Editor — 与 Local-First 主权高度匹配

Editor README 明确：**host application owns controlled document state, selection, persistence**。这和小智要求非常匹配：OpenMAIC editor 只做交互编辑，真正保存仍走 EduDev Artifact/Local Store。

因此 editor 比“嵌入 OpenMAIC 页面”更适合。

## 5.6 Importer — 很有商业价值，但必须放对运行环境

Importer README 明确 browser-only，纯 Node import 会失败。正确方案是受控 renderer worker/WebWorker 读取用户明确选择的 PPTX，产出 DSL，再由 main 持久化。

这是传统教辅老师很重要的能力：**已有 PPT → 导入 → AI 改造成互动课**。

## 5.7 Storage — 拿 interface，不拿 server implementation

Storage 自己已经区分 Browser/HTTP/Postgres/S3 等 backend。小智应该实现自己的：

```text
SqliteDocumentStore
LocalAssetByteStore
LocalRuntimeStore
LocalKVStore
```

而不是为了使用 OpenMAIC 引入 Postgres。

## 5.8 Server Agent Runtime / Director — 明确禁止

`lib/server/agent-runtime/runner.ts` 使用 `@earendil-works/pi-agent-core`；OpenMAIC 当前根依赖 Pi 0.78，而 EduDev 是 Pi 1.0.2。`lib/chat/pi/director-loop.ts` 还实现了多 Agent director + call-agent。

**处置：DO NOT USE。** 这些代码可以学习 durable run、tool integrity、multi-agent classroom 的交互语义，但不应该成为 Xiaozhi 的第二/旧版 Pi runtime。

## 5.9 Workbench / AI Elements — 只借交互，不再复制视觉系统

OpenMAIC Workbench 的三窗格（nav/chat/classroom）和 Plan/Tool/Task 等 AI elements 很成熟。但 EduDev 已有 HeroUI Pro ChatConversation/ChatTool/ChainOfThought/PromptInput/AppLayout/Sidebar 等。

因此：**HeroUI Pro 保持视觉真源；OpenMAIC UI 只作为 interaction reference。** 只有 HeroUI 缺少的具体 pattern 才做最小移植。

---

# 6. 三仓能力所有权最终表

| 能力 | Canonical Owner | DeepTutor 作用 | OpenMAIC 作用 | 禁止出现 |
| --- | --- | --- | --- | --- |
| Agent Loop | **EduDev / Pi** | 无 | 无 | 第二 Loop / Director |
| 学生事实 | **EduDev SQLite** | 计算/建议 | 无 | DeepTutor LearningStore 真源 |
| 掌握度/复习 | EduDev state + DeepTutor policy | 核心算法 | 无 | 模型直接写事实 |
| 教师资料 | **EduDev** | Reading/RAG 算法 | material/asset contract 可参考 | 第二知识库真源 |
| Memory | **EduDev** | consolidator 思想 | 无 | DeepTutor memory store 覆盖事实 |
| 组卷/题库 | **EduDev** | question/practice policy | quiz scene 表现 | 两套题库正文 |
| 讲义/学习书 | **EduDev artifact** | spine/学习结构 | 可视课程生成 | 两套文档真源 |
| 互动课堂 | **EduDev host + OpenMAIC DSL** | 教学策略输入 | DSL/generation/renderer/editor | OpenMAIC Next 子应用 |
| Office 文件 | **EduDev Native** | 内容策略 | PPTX import/visual editor 可补 | OpenMAIC server storage |
| 本地 workspace 安全 | **EduDev** | 移植 confinement 规则 | asset contract | 上游 auth/server 夺权 |
| 数据飞轮 | **EduDev** | signal/policy 参考 | 可观测内容质量指标 | 自动改 FACT/schema/code |

---

# 7. 后续定制改造的推荐顺序

当前不要立刻开始 Phase4/5 大迁移。最优顺序是：

1. **完成 Phase3 产品空间收口**：把学生/传统教学页面迁入五空间，App.tsx 降为 Shell；资料 P3-04 补多格式解析、>100 全量目录、失败恢复。
2. **建立 Capability Provider 接口**：在 Pi 下方先定义 `EducationCapabilityProvider` 和 `InteractiveContentProvider`，即使最初只接本地 stub/domain，也先把 ownership 固定。
3. **DeepTutor 1.5.11 → 1.6.13 capability upgrade**：不是整体 vendor 替换；按 Learning/Reading/Workspace/Practice/Memory/RAG 分片升级，contract test 后接入。
4. **OpenMAIC 最小闭包**：先 DSL + generation + renderer；跑通“一句话 → 互动课 → 本地持久化 → 打开”。再接 editor/importer。Storage 只做 interface adapter。
5. **数据层渐进拆分**：沿 MaterialRepository 模式拆 Student/Learning/Question/Teaching/Agent/Memory repositories。
6. **Invisible Flywheel**：等教育能力和五空间稳定后再做，否则 trace 的业务语义还在变化，学出来的策略没有稳定目标。
7. **Hardening**：CI、安装器、Windows package、SQLite/备份隐私、Pro license、依赖漏洞、Golden A–G。

---

# 8. P0 风险 / 必须阻止的错误方向

| 风险 | 现在是否存在 | 处理 |
| --- | --- | --- |
| 重新接回 DeepTutor AgentLoop | 生产已隔离，bridge 历史仍有 | Phase4 明确迁 service，不升级 loop |
| 嵌 OpenMAIC Next/PG | 尚未 | 明确 DO NOT USE runtime |
| App.tsx 继续长大 | **是** | Phase3 完成时必须拆 Workspace |
| db.ts 继续长大 | **是** | 新业务禁止直接往 OmniEduStore 堆；优先 repo |
| tool-registry 继续长大 | **是** | 新 DeepTutor tools 接 domain-specific modules |
| preload surface 无限增长 | **是** | 领域 API 聚合 + legacy 隔离 |
| 历史文档误导 Agent | **是** | SUPERSEDED 标记 / CURRENT 优先级 |
| 一需求一 smoke 脚本 | **是** | scenario runner / parameterized tests |
| Pro/第三方许可被“根 MIT”掩盖 | **是** | 逐 package/asset dependency closure |
| 学生事实被飞轮/模型覆盖 | 尚未 | FACT 与 strategy store 分层，写入 gate |

---

# 9. 对当前架构成熟度的更新评分

相较上一轮，Runtime 架构有明显提升：

| 维度 | 当前判断 | 说明 |
| --- | ---: | --- |
| Pi 单一生产 Runtime | **9/10** | assembly 已收口，legacy test-only；Phase4 需继续保持 |
| 五空间产品架构 | **7.5/10** | 壳已落地，传统页面还未完全迁入 |
| Codex-style 主工作台 | **8/10** | HeroUI/Pi/控制/恢复基础成熟 |
| 教育 Domain | **7.5/10** | 本地规则多，但新 DeepTutor capability adapter 尚未完成 |
| 互动课堂 | **2/10** | OpenMAIC 尚属审计/候选阶段 |
| 数据层可维护性 | **5/10** | MaterialRepository 是好开端，db.ts 仍巨大 |
| 前端可维护性 | **5.5/10** | App.tsx 仍 2828 行 |
| Tool 架构 | **5.5/10** | 新 Pi tools 成熟，但旧 tool-registry 仍超级文件 |
| 测试文化 | **8.5/10** | 证据强；组织/成本需要治理 |
| CI / 发布 | **3/10** | 仍未见 .github CI / 安装闭环 |
| 商业许可治理 | **6/10** | vendoring 做得较好，Pro/字体/转依赖仍有 hold |
| 整体可商业化成熟度 | **约 55%** | Runtime 架构已过关键拐点，教育融合/发布/真实教师仍是大头 |

---

# 10. Archify 交付说明

本包生成 4 份 architecture candidate JSON 与 4 份 standalone interactive HTML：

- `edudev-current`：当前 EduDev 生产控制权、数据边界和 legacy 隔离。
- `deeptutor-capability`：可迁教育 Domain 与禁止迁 Runtime 的分界。
- `openmaic-capability`：六 SDK 包与 server/runtime 分界。
- `xiaozhi-target-integration`：最终五空间 → Application Host → Pi → DeepTutor/OpenMAIC/native → Local Data → invisible flywheel。

由于当前执行容器无法联网安装 Archify npm dependencies，**官方 `archify finalize` 没有运行**。本包严格遵循已读取的 Archify v3 repository-authoring / architecture schema 的关键约束，并运行本地结构校验；HTML 使用 Archify Skill 明确允许的 fallback 思路实现：保留 candidate JSON、source evidence、inline SVG/HTML、暗/亮主题、搜索、聚焦视图、点击节点查看源码证据。浏览器检查结果另见 `validation-receipt.json`。

## 11. 下一步建议

下一轮分析不应再泛化扫描三个仓库，而应进入**迁移设计级别**：

- DeepTutor：对 `LearningService / ReadingService / ContentWorkspaceService / Practice scheduler / Memory consolidator / RAG seams` 做函数级依赖闭包，形成 `EducationCapabilityProvider v1` 接口。
- OpenMAIC：对 `dsl + generation + renderer` 做最小闭包与 Electron sandbox/data adapter 设计，形成 `InteractiveContentProvider v1`。
- EduDev：把 `App.tsx / db.ts / preload / tool-registry` 按目标 ownership 列出逐文件拆分计划和禁止继续增长的 guardrail。

这时再开始代码改造，风险最低。


## 附录：Archify 交付验收状态

- 四份架构 candidate JSON 已完成关键 schema 结构校验：component ID 唯一、connection 端点存在、boundary wraps 有效、repository source path 结构有效。
- 四份 HTML 均为单文件离线交互图：内联 SVG/CSS/JS，无外部 script/stylesheet 依赖；支持节点详情、源码证据、焦点视图、搜索、缩放与明暗主题。
- **Archify 官方 `finalize` 未运行**：当前执行环境无法联网安装 Archify CLI 所需 Node 依赖。
- 已尝试 Chromium/Playwright 视觉 gate，但当前浏览器策略同时阻断 `file://` 与 `127.0.0.1`，返回 `ERR_BLOCKED_BY_ADMINISTRATOR`；因此浏览器/感知视觉验收标记为 **BLOCKED BY ENVIRONMENT**，不宣称通过。
- 详细机器回执：`validation-receipt.json`；环境证据：`visual-check/browser-check-blocked.txt`。
