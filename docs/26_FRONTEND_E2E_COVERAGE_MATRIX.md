# 前端接线与 Electron E2E 覆盖矩阵

更新时间：2026-08-12

这份矩阵把“主进程/SQLite 已实现”与“老师在界面上可用、可验收”分开记录。`backend` 只表示已有安全入口，`frontend` 表示 renderer 已通过 typed preload 接线，`e2e` 表示现有 Electron smoke 从用户点击路径验证过。任何一列未完成，都不能称为生产闭环。

## 主闭环

| 能力 | 后端/主进程入口 | preload / renderer 入口 | 当前 UI 状态 | E2E 证据 | 边界与未完成 |
| --- | --- | --- | --- | --- | --- |
| 错题图片导入 | `attachments:import`、`store.importAttachments` | `window.omniEdu.importAttachments`、`MistakesWorkspace` | 已接线：导入中、成功、取消、部分失败/失败、空态 | Electron 点击具体错题“导入附件”，经生产 handler 的受控 E2E dialog 返回真实 PNG，验证复制、SHA-256、SQLite、取消零写入 | 非 E2E/打包版本仍调用原生系统 dialog；Playwright 不操作 Windows dialog 窗口本身，不能误报为 OS UI 自动化 |
| OCR 待处理 | `mistakeImages:createAnalysis`、`createMistakeImageAnalysis` | `createMistakeImageAnalysis`、`create-ocr-*` | 已接线：真实 `needs_ocr`，不伪造 OCR 文本 | 同一 smoke 验证 `listMistakeImageAnalyses` 回读 `needs_ocr` | 当前没有 OCR 引擎，教师输入/修正是明确的人审入口 |
| 教师修正与脱敏 | `mistakeImages:updateCorrection`、`mistakeImages:sanitize` | `mistake-correction-input`、`mistake-sanitize-button`、`mistake-save-correction` | 已接线：保存后状态为 `teacher_corrected`，显示替换记录 | smoke 验证手机号脱敏与 SQLite 回读 | 只上传脱敏文本；原图路径不进入模型请求 |
| 小智分析入口 | `ai:runDeepSeek` / `ai:runDeepTutorConsole` | `runAiConsole`、`mistake-send-ai`、AI 对话区 | 已接线：切换到 AI 视图，失败消息可见 | smoke 在无 API Key 情况点击并验证 `ai-output-error` | 真实 provider、合法 key 和模型质量需单独 live gate |
| 三元题组草稿 | `confirmations`、`save_exercise_set` | `mistake-triplet-panel`、可编辑 stem/answer、来源标签 | 已接线：草稿可编辑，确认/拒绝分离，显示 `local_bank/teacher_resource/generated` | smoke 验证拒绝零写入、确认后 exercise set 回读与重启持久化 | **已知缺口**：编辑值只在 renderer 预览，现有确认接口仍保存原始 payload；UI 已明确警告，不能宣称编辑后保存 |
| 已确认题组回读 | `exerciseSets:list`、`listExerciseSets` | `ExerciseSetLibrary`、错题工作区第 5 步 | 已接线：loading/empty/error/content、只读刷新、题目角色与来源标签 | component 新增 5 个状态；Electron 新增 9 个路径，覆盖确认后 UI 回读、来源、刷新零写入、学生隔离、重启与双视口 | 正式题组只读；修改必须重新生成草稿并再次教师确认，不复制题本或另建数据真源 |
| 复习提醒 | `review:getReminder`、`getReviewReminder` | `ReviewReminderPanel`、“今日”导航 | 已接线：no-student/loading/error/clear/upcoming/due、只读刷新、证据跳转、隐私边界 | component 新增 6 个状态；主 Electron 新增 10 个路径，覆盖真实到期记录、刷新零写入、清空、学生隔离、重启与双视口 | 实时派生自本地学习记录，不保存第二份队列；只返回知识点/调度投影，不含正文、答案或附件路径 |
| 本地复盘报告生命周期 | `reports:generate/update/list`、`review_reports`、初始 Markdown 快照 | `generateReview/updateReport/listReports`、`ReviewReportWorkspace`、“复盘”导航 | 已接线：no-student/idle/generating/draft/saving/saved/error、历史、证据、质量检查、学生隔离 | component 新增 8 个状态；Electron 新增 15 个路径，覆盖日期零写入、生成、SQLite 编辑保存、源记录、质量检查、历史、隔离、初始文件、重启与双视口 | 生成立即写 SQLite 草稿和初始 Markdown；后续“保存修改”只更新 SQLite，不重写快照；最终文件必须用文档导出 |
| 教师确认队列 | `aiConfirmations:list/confirm/reject` | AI 面板与错题题组确认按钮 | 已接线：确认/拒绝走 typed preload，稳定 `data-testid` | smoke 从 AI 确认按钮点击并验证 SQLite `exercise_sets` + restart readback | 复杂并发确认、过期版本冲突仍需专项 E2E |
| Question Notebook 管理 | `questionBank:create`、`questionNotebook:*` | 自管理 `QuestionNotebookWorkspace`、题本导航 | 已接线：教师录题、搜索、收藏、分类重命名/软删除/恢复、使用历史、冲突/空态/失败态 | component 9/9；Electron 点击验证 canonical 创建、来源防伪、零写入校验、版本冲突、usage、重启 readback | generated 来源只允许既有 AI 产物链；真实 provider 自动入库质量仍需 live gate |
| 教师备课本 | `teacherNotebook:*` 与既有 SQLite CRUD | `TeacherNotebookWorkspace`、备课本导航 | 已接线：创建/编辑、版本锁、软删除、include-deleted、notebook 恢复 | component state 6/6；Electron 点击创建/编辑/删除/恢复并重启回读 | record 没有 restore IPC；已删除记录只做审计展示，不能称为可恢复 |
| 文档导出 | `documents:exportArtifact`、`exportDocumentArtifact` | AI 历史消息产物入口、本地工作目录/选址导出 | 已接线：Markdown/PDF/DOCX、导出状态、路径、SHA-256、面板内失败提示 | Electron 从历史会话点击三种产物；验证 PDF Unicode bytes、DOCX 样式与 >10K 正文、真实文件/SQLite hash、空正文零写入及重启回读 | 基础文档闭环已覆盖；复杂分页、嵌入字体、表格、图片和公式仍未完成 |
| Agent run/trace 与回归观测 | `aiAgent:listRuns/getMemoryTrace`、`aiObservability:*` | `AiObservabilityWorkspace`、分析导航 | 已接线：SQLite 快照、回归报告、真实 gate、最近 run 和 bounded L1 轨迹 | Electron 点击生成报告，验证 gate、原始 prompt/hidden reasoning 不渲染、重启回读与双视口截图 | 报告如实显示 warning/failed；Markdown/HTML 导出与失败样本自动回放未完成 |
| Teaching Book 创作管理 | `teachingBook:*`、book/chapter/page/block/source/health/patch SQLite 能力 | `TeachingBookWorkspace`、讲义导航 | 已接线：结构创作、版本编辑、整块/选区 patch、来源健康、安全预览、导出、归档审计 | Electron 从点击创建到 SQLite/文件 hash、重启 readback 和双视口；Teaching Book 专项 smokes 共 130/130 | 当前 UI 绑定手工来源；归档没有 restore IPC，保持只读；预览不写文件，导出需教师点击 |
| L1/L2/L3 记忆治理 | `aiMemory:*`、`aiMemoryL3:*`、evidence graph、governance | 自管理 `MemoryGovernanceWorkspace`、L2 记忆导航 | 已接线：候选/采纳、修订、停用/恢复、L2 软删除、修订历史、证据图、治理报告、冲突/空态/失败态 | component 14/14；Electron 从真实 run/event 点击验证零写入、版本冲突、SQLite 回读、重启与双视口 | deleted L2 只读审计，不伪造专用恢复语义；不展示 raw prompt、hidden reasoning 或学生正文 |
| 学习路径 | `mastery:getPath`、`ai_mastery_paths` | `getAiMasteryPath`、`MasteryPathWorkspace`、“学习路径”导航 | 已接线：按当前学生读取 loading/empty/error/content，显示版本、追加/替换模式、模块与知识点类型 | component 新增 5 个状态；Electron 新增 9 个用户路径，覆盖 v2 SQLite 回读、刷新、学生隔离、AI 交接、重启与双视口 | 只展示教师已确认路径；不把路径顺序伪装成掌握率，修改仍须由小智草稿进入教师确认 |
| 全局聚合搜索 | `search:all`、`store.search` | typed `searchAll`、`GlobalSearchWorkspace`、“搜索”导航 | 已接线：idle/loading/error/empty/results，跨学生返回学生与学习记录，结果可打开学生或按标题定位所属时间线 | component 新增 5 个状态；Electron 新增 9 个用户路径，覆盖空查询、学生/记录命中、导航、无命中、重启与双视口 | 仅检索本地 SQLite，不调用模型；输入限 200 字符，记录仍以所属学生时间线 readback 为准 |
| 学生档案生命周期 | `students:update/archive/export/openFolder` | `StudentProfileLifecycle`、学生导航 | 已接线：新建/编辑表单、打开目录、导出路径与文件数、归档二次确认、成功/取消/失败、归档只读 | component 新增 11 个状态；Electron 新增 13 个用户路径，覆盖 SQLite 编辑同 ID、真实 `metadata.json`/记录、导出取消零文件、归档取消零写入、确认、学生隔离、重启与双视口 | archive 只有单向状态变更，没有 restore IPC；归档后禁止编辑和再次归档，不伪造恢复 |
| 完整数据备份与校验 | `app:exportDataRoot/verifyDataBackup`、v1 manifest、SHA-256 | `DataBackupPanel`、设置导航 | 已接线：idle/exporting/verifying/export success/verify success/verification failed/cancel/error，显示路径、文件数和问题清单 | component 新增 7 个状态；Electron 新增 12 个用户路径，覆盖真实目录/manifest、相对路径与 SHA-256、清洁校验、篡改和清单外文件、取消零写入、重启与双视口 | 只证明复制与完整性校验，不提供自动恢复或跨磁盘灾备；E2E 仅在未打包进程注入系统目录选择结果 |
| AI 对话库生命周期 | `aiConversations:create/list/get/append/move/rename/archive`、本地 SQLite | `AiConversationSidebar`、AI 导航、设置页归档审计 | 已接线：empty/working/success/error，新建文件夹/对话、重命名、拖放分类、会话/文件夹归档二次确认 | component 新增 7 个状态；Electron 新增 14 个用户路径，覆盖空名称零写入、SQLite 创建/重命名/移动、归档取消、单会话归档、文件夹级联归档、设置页、重启和双视口 | 归档只隐藏且不删除消息；当前没有 restore IPC/UI，不伪造恢复。拖放验证为 Chromium/Electron DOM 交互，不代表触控辅助交互已验收 |
| 小智质量评审生命周期 | `aiObservability:create/list/getUsabilityReview/getSummary`、`create/listReplayExperiment/getReplaySummary`、`create/listModelGrade/getModelGradeSummary`、SQLite | `AiQualityReviewWorkspace`、设置导航、typed preload | 已接线：loading/idle/saving/importing/success/error、单条评分、CSV/TSV 文件或文本预检、失败回放、before/after、Grader 只读 | component 新增 8 个状态；Electron 新增 16 条，覆盖两类零写入、人工评分、SQLite summary、AI 输入回放、实验关联/delta、CSV、`graderMode`、重启和双视口 | 全行预检失败保证零写入；逐行 IPC 运行中失败可能已有前序行，UI 如实提示按 sampleId 检查。模型 grade 只读，deterministic proxy 不冒充 `llm_judge` |

## 后端已有但前端/E2E仍缺失的能力族

| 能力族 | 后端 / preload | renderer / E2E | 下一步边界 |
| --- | --- | --- | --- |
| 待下一轮反向审计 | 以 typed preload 与现有主进程 handler 为清单 | 不按“未被 renderer 调用”机械造页面 | 先确认教师是否已有入口、状态与 E2E 是否完整，再确定下一项；本轮不新增后端能力 |

## 状态定义

- **后端已实现**：主进程、SQLite、权限/边界和 typed IPC 存在，并有对应低层 smoke。
- **前端已接线**：用户无需手动切换内部模式，入口能显示 loading、empty、success、failed、needs review 等真实状态。
- **E2E 已验证**：在 Electron 生产构建中，从点击开始验证最终状态和数据 readback；不能用单独的函数调用替代。
- **live 未验证**：没有可用的真实 provider/API Key 时，只能报告 no-key/blocked；不能把 proxy 或 deterministic 结果称为真实模型质量。

## 本轮验收命令

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build
npm run test:renderer-components
npm run test:ai-structured-reply
npm run test:smoke
```

`test:smoke` 在同一份 Electron 流程中使用 1366×768 和 1920×1080 两个 viewport，当前前端验收 207/207：在既有 191 条上新增小智质量评审 16 条用户路径，覆盖空表单/非法 CSV 零写入、人工评分、SQLite summary、失败样本回放到当前 AI 输入、before/after 关联实验、score delta、合法 CSV 导入、只读 `graderMode`、重启和双视口。组件状态验收为 79/79。两张质量评审截图已人工复核无裁切、重叠或不可达操作，并持久化到 `apps/desktop/test-results/electron-e2e/`（Git 忽略）：1366 评分态 SHA-256 为 `46B583B32B4363EDAA4C5653C5AE064CD7FE73BA214E4AB332C14C00B879F5A4`，1920 实验态为 `BCE546CD9997A69C4C5473A692CD936B350AD0807B541C7499BA7B45FAD25254`。

本轮通过重新索引后的代码图和定向文本比对审计 140 个 preload 方法。没有 renderer 调用的 15 个方法中，`runDeepSeek` 是已被 `runDeepTutorConsole` 替代的兼容入口，若干 `get*`/`list*` 是测试 readback 或内部详情入口；不能按“未调用数量”机械新增页面。真正的优先级以教师可见操作是否完整和主 Electron 是否有用户路径为准。

## 下一步顺序

1. 重新从 typed preload 与主进程 handler 反向审计下一项“后端已实现但教师入口/状态/E2E不完整”的能力，不按 API 数量机械新增页面。
2. 优先补真实用户动作、SQLite/file readback 和重启证据，不新增后端能力或独立 smoke。
3. “编辑后的题组覆盖确认 payload”需要调整现有后端契约，不属于当前只补前端/E2E阶段；完成前保持 UI 警告和不完成状态。
