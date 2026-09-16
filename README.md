# Omni-Edu Agent

面向 K-12 独立教师与小微教研团队的本地优先 AI 教学工作台。

Omni-Edu Agent 不是学校级平台，也不是完整 LMS。当前目标是把教师本机的学生档案、学习记录、错题图片、题库、知识库和 AI 分析组织成一个可验证、可确认、可导出的桌面端闭环。

后续产品范围、模块边界、技术选型和上市否决项统一以 [最终产品与模块架构基线](docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md) 为准。旧规划与该基线冲突时，以该基线为最高优先级，但“已完成”状态仍以当前代码和真实验收证据为准。

```text
教师资料 -> 解析与索引 -> 题库/知识库 -> 按蓝图组卷 -> 教师确认 -> 试卷与解析
学生错题照片 -> 本地 OCR -> 教师校正 -> 错因/知识点 -> 相似或变式题 -> 针对性练习
```

## UI 预览

![Omni-Edu Agent UI](docs/image.png)

当前桌面端使用 Electron + React + Vite + SQLite，AI 中控台 UI 复用了本地 HeroUI Pro 源码组件，而不是占位组件。

## 已落地能力

| 模块 | 当前能力 | 状态 |
| --- | --- | --- |
| AI 中控台 | 对话、历史消息、文件夹分组、拖拽归类、右键重命名/归档 | 已落地 |
| Agent Runtime | `route -> plan -> tool_call -> observe -> reflect -> finalize` 事件流，落库到 SQLite | 已落地 |
| Tool Calling | route allowlist、参数 schema、只读工具执行、bounded tool result | 已落地 |
| Confirmation Queue | AI 写入先生成待确认项，老师确认后才写入报告或题组 | 已落地 |
| Structured Reply | DeepSeek 输出走 `xiazhi.reply.v2` 本地校验，失败受控 repair | 已落地 |
| Education Grader | 拦截空泛上传建议、标签化语言、证据缺口、隐私泄露等高风险回复 | 已落地 |
| Usability Grader | 按 route 控制回复长度和结构，拦截“请手动切学生数据”等退化话术；25 条 proxy 样本进入回归门禁 | v1.1 已落地 |
| 小智质量评审 | 人工评分、CSV/TSV 文件或文本导入、失败样本回放、before/after 实验、只读模型 Grader 审计 | 前端闭环与 Electron E2E 已落地 |
| 三元题组 | 本地题库检索、相似题召回、题组草稿确认保存 | v1 已落地 |
| 错题图片 | 本地图片托管、`needs_ocr` 状态、脱敏文本、老师修正后重新脱敏；错题工作区已接通 typed preload | 后端 v1；前端首片与 Electron smoke 已落地 |
| 知识库/图谱 | 资源切片、质量分、证据强度、个人信息隐藏、图谱背景边界 | v1 已落地 |
| 复盘报告 | 按日期范围生成、证据绑定、质量检查、教师编辑、SQLite 历史与初始 Markdown 快照 | 前端闭环与 Electron E2E 已落地 |
| 文档导出 | Markdown / PDF / DOCX 真实写文件、hash、状态 readback | v1 已落地 |
| Observability / Regression | AI run/event/tool/artifact/confirmation 统一快照、回归 gate 和报告 readback | v1 已落地 |
| DeepTutor 运行时融合 | vendored sidecar、Capability/AgentLoop bridge、HostToolProxy、ModelProxy、memory/notebook/mastery/book 首批适配 | 进行中，非全量生产完成 |
| 题本 | canonical 题库教师录入、搜索、收藏、分类版本管理/恢复、使用历史和来源审计 | 前端管理闭环与 Electron E2E 已落地 |
| 专题讲义 | 本地 book/chapter/page/block/source 创作、版本锁、整块/选区 patch、来源健康、安全预览、Markdown 导出与归档审计 | 前端闭环与 Electron E2E 已落地 |
| 备份完整性 | 本地数据目录备份 manifest、SHA-256 回读校验、篡改检测和源目录边界保护 | v1 第一切片 |
| 讲义高级 blocks | timeline/code/deep_explanation/user_note 安全 Markdown 编译；interactive/animation 不可执行降级；PDF/DOCX Unicode 与基础样式导出 | C05 首片通过，复杂版式/多媒体与教师可用性仍进行中 |
| 间隔复习队列 | DeepTutor scheduler 规则、确定性 due 计算、时区不漂移、重启重算、`get_review_queue` HostTool、应用内提醒卡片、SQLite/IPC 并发基线 | E15 本地高负载通过，外部通知与真实教师验收仍进行中 |
| 运行重试/分支 | 私有 request snapshot、retry/branch/regenerate、幂等 action、parent lineage 和对话入口 | R11 首片 12/12 通过，复杂写事务/live provider 仍进行中 |

## UI 页面展示

| 页面 | 入口 | 主要功能 |
| --- | --- | --- |
| 今日 | 左侧导航 `今日` | 总览学生、记录、知识库和待办状态 |
| AI | 左侧导航 `AI` | 小智中控台、对话库、文档产物预览、待老师确认队列 |
| 知识库 | 左侧导航 `知识库` | 本地资料导入、资源切片、图谱摘要和解析状态 |
| 学生 | 左侧导航 `学生` | 学生档案、阶段目标、当前问题、家长关注点和标签 |
| 录入 | 左侧导航 `录入` | 学习记录、附件元数据和本地证据采集 |
| 错题 | 左侧导航 `错题` | 错题记录、错因证据和后续图片/OCR 工作流入口 |
| 复盘 | 左侧导航 `复盘` | 日期范围生成、证据与质量检查、SQLite 编辑保存、历史回读；最终文件走文档导出 |
| 搜索 | 左侧导航 `搜索` | 学生、学习记录、本地证据的统一搜索 |
| 题本 | 左侧导航 `题本` | 教师本地录题、搜索收藏、分类重命名/删除/恢复、答案解析、来源与课堂使用历史 |
| 讲义 | 左侧导航 `讲义` | 专题讲义结构创作、内容块版本编辑、协作 patch、来源健康、安全预览与 Markdown 导出 |
| L2 记忆 | 左侧导航 `L2 记忆` | 可编辑摘要、L3 候选、证据图与治理状态 |
| 团队 | 左侧导航 `团队` | 小微教研团队协作占位与边界展示 |
| 看板 | 左侧导航 `看板` | 本地数据统计、知识库/AI 可调用状态 |
| 设置 | 左侧导航 `设置` | DeepSeek 配置、本地数据目录、归档 AI 对话、小智质量评审 |

## AI 中控台交互

- 左侧是对话库，支持文件夹分组、拖拽移动、右键重命名和归档。
- 中间是对话区，AI 回复内展示可验证的思考过程摘要，不展示模型隐藏推理链。
- 输入框下方合并展示学生档案、学习记录、附件元数据、老师知识库、知识图谱 5 类上下文状态。
- 右侧只在点击 `PDF 文件`、`Word 文件`、`Markdown 文件` 等产物入口后展开。
- 文档预览面板支持拖拽调整宽度，Markdown 任务列表复选框已隔离全局输入框样式。
- 文档导出必须由主进程真实写出文件并记录 `document_artifacts`，失败不会显示为成功。
- 回归报告从本地 SQLite 的 run/event/tool/artifact/confirmation/task usage 生成，不能用口头结论替代真实 readback。
- 小智回复会经过 Usability Grader：普通问答/工作台帮助优先短答，学生诊断等任务按需展示依据、教学判断、下一步、老师确认和产物入口。
- 待确认队列默认只展示最近关键项，剩余项折叠提示；折叠不会自动确认，老师确认前仍不写入业务表。
- 可用性回归包含 25 条代表性 proxy 样本，并在 Observability 报告中生成 `usability_quality_gate` 与 `usability_eval_baseline`。

## 前端接线与验收边界

后端能力已实现不等于教师界面已经可用。错题图片主闭环目前已从错题导航接入：本地附件 → `needs_ocr` → 教师修正 → 脱敏预览 → 小智入口 → 三元题组草稿 → 确认/拒绝。无 API Key 时会在主进程前置阻断并在 AI 对话区显示可操作错误，不会等待完整 AgentLoop 或伪造成功。

完整的 backend / preload / renderer / E2E 对照见 [前端接线与 Electron E2E 覆盖矩阵](docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md)。题本收藏、Markdown/PDF/DOCX 文档导出、运行观测和专题讲义创作现已从真实界面点击到 SQLite/文件 readback；原生附件系统窗口自动化和真实 provider 质量仍是独立边界。

## 本地优先与安全边界

- 学生档案、学习记录、题库、错题图片、附件和 AI 对话默认保存在本机 SQLite 与本地数据目录中。
- renderer 不直接访问 Node API；所有文件系统和数据库能力通过 Electron preload IPC 暴露。
- 错题图片原始文件不自动上传；云端模型只能接收脱敏后的题目文本和必要摘要。
- 知识库 chunk 如检测到个人信息，工具结果只返回必要元数据，不返回正文预览。
- AI 发起的写入动作必须先进确认队列，老师确认前不得写入业务表。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面端 | Electron 43 |
| 前端 | React 19、Vite、TypeScript |
| 本地数据库 | SQLite `sqlite3`，启用 WAL |
| AI | DeepSeek API、结构化 JSON 输出、本地 schema 校验 |
| UI 组件 | HeroUI / 本地 HeroUI Pro 源码复用、lucide-react |
| 验收 | TypeScript、Electron smoke、AI harness/eval smoke |

## 快速开始

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm install
npm run dev
```

构建生产产物：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build
```

DeepSeek 配置可以在应用设置页保存，也可以在本地环境中提供 `DEEPSEEK_API_KEY` 用于 live smoke。不要把 API Key 写进代码或提交到仓库。

## 验证命令

常用门禁：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run test:ai-harness
npm run test:ai-agent-runtime
npm run test:ai-tool-calling
npm run test:ai-confirmation
npm run test:ai-structured-reply
npm run test:ai-education-grader
npm run test:ai-exercise-set
npm run test:ai-mistake-image
npm run test:ai-knowledge-graph
npm run test:ai-document-export
npm run test:ai-observability
npm run test:ai-usability
npm run test:ai-human-review
npm run test:ai-replay
npm run test:ai-model-grader
npm run test:ai-live-evidence
npm run test:deeptutor-question-notebook
npm run test:deeptutor-backup-integrity
npm run test:ai-human-review-ui
npm run test:ai-live-usability
npm run build
```

完整 Electron smoke：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run test:smoke
```

当前 renderer 验收还可单独运行：

```powershell
npm run test:renderer-components  # 错题/已确认题组/复习提醒/题本/备课本/运行观测/专题讲义/记忆治理/学习路径/全局搜索/学生档案/完整备份/AI 对话库/复盘报告/小智质量评审组件状态，79/79
```

`test:smoke` 当前额外输出前端 207/207 清单。在既有 191 条上新增 16 条小智质量评审用户路径，覆盖空表单与非法 CSV 零写入、单条人工评分、SQLite summary、失败样本回放到真实 AI 输入、before/after 关联实验、分差、合法 CSV 导入、只读 Grader 模式、跨重启回读和双视口。模型 Grader 的 deterministic proxy 会如实标注，不能冒充真实 `llm_judge`；CSV 在全部行预检失败时保证零写入，但逐行 IPC 运行中失败不具备事务原子性。此前各业务闭环继续保留。截图位于 `apps/desktop/test-results/electron-e2e/`。

小智结构化回复先尝试严格 JSON，再只对不超过 64,000 字符且具有完整对象外壳的常见模型语法漂移（如尾逗号、字符串内裸换行）执行本地语法修复；修复结果仍必须通过完整 `xiazhi.reply.v2`、route、证据、教育质量和教师确认校验，截断 JSON 继续失败关闭。

仓库检查：

```powershell
cd D:\WorkProject\EduProject
git diff --check
```

## 重要目录

```text
apps/desktop/src/main/              Electron 主进程、SQLite store、AI harness
apps/desktop/src/preload/           renderer 可调用的安全 IPC API
apps/desktop/src/renderer/          React UI
apps/desktop/src/shared/            主进程 / renderer 共享契约
apps/desktop/scripts/               smoke、eval 和本地门禁脚本
apps/desktop/src/renderer/heroui-pro/ 本地复用的 HeroUI Pro 源码组件
docs/                               UI、知识库、小智 harness 方案文档
docs/23_XIAOZHI_USABILITY_EVAL_RUBRIC.md 小智教师可用性人工评分口径
docs/24_DEEPTUTOR_OMNI_EDU_INTEGRATION_DESIGN.md DeepTutor 核心能力融合设计与实施记录（持续更新）
docs/25_DEEPTUTOR_FEATURE_INVENTORY_AND_PRODUCTION_MATRIX.md DeepTutor 77 项功能台账与生产验收矩阵（持续更新）
docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md 最终产品、模块方案、技术选型与上市门禁
1.Agent.md                          Agent 工作规则
2.Memory.md                         当前进度记录
3.Learning.md                       复盘和踩坑记录
4.Wiki.md                           长期项目常识库
```

## 当前边界

- PDF / DOCX v1 已能从 AI 产物面板生成并回读真实文件；基础 Unicode、标题/列表/代码样式与超长正文已验收，但复杂分页、嵌入中文字体、表格、图片和公式仍需后续增强。
- 错题图片链路已完成本地托管、状态和脱敏，真实 OCR 引擎尚未接入。
- 知识库/图谱增强是规则版 v1，不是 Graph RAG，也不是完整知识抽取系统。
- 三元题组已打通本地召回和确认保存第一段，完整题库导入 UI、embedding 召回和题组编辑器仍在后续阶段。
- Observability / Regression v1 已完成数据层、IPC/preload、分析页仪表盘、回归报告 gate、最近 run 与 bounded L1 轨迹、重启回读和本地 Electron smoke；Markdown/HTML 报告导出和失败样本自动回放仍在后续阶段。
- Usability Grader v1.6 已完成确定性规则、25 条 proxy 样本、人工评分 SQLite/IPC 基础设施、设置页人工评分 UI、CSV/TSV 导入、失败样本回放入口、before/after replay experiment 落库、模型 grader proxy 样本表、年级适切评分维度、runId/promptVersion/token usage 证据链绑定、`teacher_review_score_gate`、`usability_replay_improvement_gate`、`model_grader_quality_gate`、`live_evidence_binding_gate` 和 live replay 脚本；尚未完成外部真实老师样本平均分 >= 4/5、真实返工量下降统计和真实 LLM-as-judge 裁判。
- `npm run test:ai-live-usability` 依赖 `DEEPSEEK_API_KEY`；无 key 时会明确 skipped，不代表真实 DeepSeek live 已通过。
- 设置页的“备份完整数据目录”会生成 `omni-edu-backup-manifest.v1.json` 并执行 SHA-256 回读；“校验备份完整性”可检测缺失、篡改和额外文件。当前只提供安全校验，不提供自动覆盖式恢复。
- 当前产品边界仍是独立教师与小微教研团队，不扩展为学校级平台、学生端、家长端或完整 LMS。
- DeepTutor v1.5.11 已固定 vendor 并接入 Python sidecar/HostToolProxy/ModelProxy 的首批运行时切片；Question Notebook、Notebook、Mastery、Book、Memory 等已有本地 vertical slice 和专项 smoke，但真实 provider、完整多模式能力、跨进程恢复、真实教师样本及全链路生产压测仍未完成，不能将设计证据写成全量上线。
- R11 已补齐第一条持久运行变更切片：retry/branch/regenerate 通过 `ai_agent_run_requests` 与 `ai_agent_run_actions` 保存私有快照、幂等键和 parent lineage；`npm run test:deeptutor-r11-lineage` 12/12 通过。R10 受限 settlement 已扩展为最多三代，预算增加先经老师审批，并通过 31/31 对抗验收。复杂写工具事务回滚、多设备冲突、完整结果合并和 live provider 仍未完成。
- R04 已补齐有界多轮 AgentLoop：DeepSeek 工具调用最多 3 轮/8 次，每轮重新审核并记录 plan/tool/observe；`npm run test:deeptutor-multi-round` 10/10 通过。真实 DeepSeek 多跳 provider 质量仍需显式 API Key 验收。
- R09 已补齐等待输入的重启接管：pending checkpoint 可回读，答案原子消费后创建带 parent lineage 的恢复 child run；`npm run test:deeptutor-r09-restart` 12/12 通过。真实模型自主触发 ask_user 与 live provider 仍需单独验收。
- E07/E08 本轮已补齐 main-process 研究/可视化宿主首片：`research_workspace` 只读本地教师知识并输出带来源/未知项的研究提纲，`visualization` 只读知识图谱并输出受限 Mermaid；`test:ai-harness` 122/122、专项 18 assertions、能力 48/48、observability 与 build 通过。联网研究、引用核验、HTML/SVG/Manim、真实 provider 和端到端生产 SLO 仍未完成。
