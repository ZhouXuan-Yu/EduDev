# 前端接线与 Electron E2E 覆盖矩阵

更新时间：2026-10-19（T0 基线稳定化）

> 状态：当前实现证据真源。产品目标见 `11_STRATEGIC_PRODUCT_PRD.md`。本表保留各轮已验证快照；后续修改必须用本轮实际测试更新，不能沿用旧计数宣称当前通过。

这份矩阵把“主进程/SQLite 已实现”与“老师在界面上可用、可验收”分开记录。`backend` 只表示已有安全入口，`frontend` 表示 renderer 已通过 typed preload 接线，`e2e` 表示现有 Electron smoke 从用户点击路径验证过。任何一列未完成，都不能称为生产闭环。

## 主闭环

| 能力 | 后端/主进程入口 | preload / renderer 入口 | 当前 UI 状态 | E2E 证据 | 边界与未完成 |
| --- | --- | --- | --- | --- | --- |
| 错题图片导入 | `attachments:import`、`store.importAttachments` | `window.omniEdu.importAttachments`、`MistakesWorkspace` | 已接线：导入中、成功、取消、部分失败/失败、空态 | Electron 点击具体错题“导入附件”，经生产 handler 的受控 E2E dialog 返回真实 PNG，验证复制、SHA-256、SQLite、取消零写入 | 非 E2E/打包版本仍调用原生系统 dialog；Playwright 不操作 Windows dialog 窗口本身，不能误报为 OS UI 自动化 |
| OCR 待处理 | `mistakeImages:createAnalysis`、`createMistakeImageAnalysis` | `createMistakeImageAnalysis`、`create-ocr-*` | 已接线：真实 `needs_ocr`，不伪造 OCR 文本 | 同一 smoke 验证 `listMistakeImageAnalyses` 回读 `needs_ocr` | 本地/云端 OCR 分别见下方两行；`needs_ocr` 仍是唯一初始状态，不允许用假文本跳过识别 |
| 教师修正与脱敏 | `mistakeImages:updateCorrection`、`mistakeImages:sanitize` | `mistake-correction-input`、`mistake-sanitize-button`、`mistake-save-correction` | 已接线：保存后状态为 `teacher_corrected`，显示替换记录 | smoke 验证手机号脱敏与 SQLite 回读 | 常规 AI 分析只接收脱敏文本；云端 OCR 是唯一原图上传路径，必须教师显式同意 |
| 小智分析入口 | `ai:runDeepSeek` / `ai:runDeepTutorConsole` | `runAiConsole`、`mistake-send-ai`、AI 对话区 | 已接线：切换到 AI 视图，失败消息可见 | smoke 在无 API Key 情况点击并验证 `ai-output-error` | 真实 provider、合法 key 和模型质量需单独 live gate |
| 三元题组草稿 | `confirmations`、`save_exercise_set`、`aiConfirmations:confirm`（接收 `AiConfirmationConfirmInput`，可选 `exerciseSetEdit`） | `mistake-triplet-panel`、可编辑 stem/answer、来源标签 | 已接线：草稿可编辑，确认时把编辑后的题干/答案提交给确认契约（main 侧校验数量一致、题干非空、长度上限，role/sourceKind/questionId 保持原始值不可伪造），确认/拒绝分离，显示 `local_bank/teacher_resource/generated` | smoke 验证拒绝零写入、编辑确认后 exercise set 题干/答案与编辑值一致、来源保持、contentMd 重建、确认项 payload_json 记录执行值、重启回读 | 编辑覆盖仅对 `save_exercise_set` 开放，覆盖字段仅 stem/answer；其他动作带覆盖被拒绝；真实 provider 质量仍待 live gate |
| 已确认题组回读 | `exerciseSets:list`、`listExerciseSets` | `ExerciseSetLibrary`、错题工作区第 5 步 | 已接线：loading/empty/error/content、只读刷新、题目角色与来源标签 | component 新增 5 个状态；Electron 新增 9 个路径，覆盖确认后 UI 回读、来源、刷新零写入、学生隔离、重启与双视口 | 正式题组只读；修改必须重新生成草稿并再次教师确认，不复制题本或另建数据真源 |
| 复习提醒 | `review:getReminder`、`getReviewReminder` | `ReviewReminderPanel`、“今日”导航 | 已接线：no-student/loading/error/clear/upcoming/due、只读刷新、证据跳转、隐私边界 | component 新增 6 个状态；主 Electron 新增 10 个路径，覆盖真实到期记录、刷新零写入、清空、学生隔离、重启与双视口 | 实时派生自本地学习记录，不保存第二份队列；只返回知识点/调度投影，不含正文、答案或附件路径 |
| 本地复盘报告生命周期 | `reports:generate/update/list`、`review_reports`、初始 Markdown 快照 | `generateReview/updateReport/listReports`、`ReviewReportWorkspace`、“复盘”导航 | 已接线：no-student/idle/generating/draft/saving/saved/error、历史、证据、质量检查、学生隔离 | component 新增 8 个状态；Electron 新增 15 个路径，覆盖日期零写入、生成、SQLite 编辑保存、源记录、质量检查、历史、隔离、初始文件、重启与双视口 | 生成立即写 SQLite 草稿和初始 Markdown；后续“保存修改”只更新 SQLite，不重写快照；最终文件必须用文档导出 |
| 教师确认队列 | `aiConfirmations:list/confirm/reject` | AI 面板与错题题组确认按钮 | 已接线：确认/拒绝走 typed preload，稳定 `data-testid` | smoke 从 AI 确认按钮点击并验证 SQLite `exercise_sets` + restart readback | 复杂并发确认、过期版本冲突仍需专项 E2E |
| 知识库目录批量导入 | `knowledge:importDirectory/importDirectoryPaths/listImportJobs/getImportJob/cancelImportJob/retryImportJob`、`knowledge_import_jobs` 持久化任务 | `KnowledgeImportPanel`、知识库页 | 已接线：导入中/进度/取消/失败清单/历史与重试，稳定 `data-testid` | node smoke 8 用例（递归扫描、SHA-256 去重、重复导入零写入、排队/中途取消、部分失败重试修复、扫描失败、重启恢复）；Electron 点击「导入文件夹」→ ready 任务回读→取消对话框零写入→重启回读 | 目录对话框 E2E 经未打包适配器；Docling/OCR 解析仍未接入，PDF 落 needs_parser |
| 题库检索与相似题直入口 | 迁移 v4 `question_bank_fts`（FTS5）、`questionBank:search`、`exerciseSets:proposeFromQuestions` | `QuestionNotebookWorkspace` 搜索框、`MistakesWorkspace` 相似题面板 | 已接线：FTS 优先（空表/损坏自动降级 LIKE）、相似题检索/勾选≤6 道/生成题组草稿→确认落库，来源标签不可伪造 | `test:question-bank-search` 7 用例；Electron 搜索→选相似题→草稿→确认→来源/正文一致→重启回读 | 组卷蓝图与批量选题编辑不在此行范围；PRD 四值来源枚举仍未落地 |
| 本地 OCR（RapidOCR） | `mistakeImages:runOcr`、`OcrWorkerClient`、python `omni_edu_ocr`（rapidocr>=3 + PP-OCRv6 ONNX） | `MistakesWorkspace`「本地 OCR 识别」按钮、识别中/完成/失败态、置信度提示 | 已接线：needs_ocr → 本地识别 → ocr_done（置信度回填）→ 教师校正 → 脱敏保存 | `test:ocr`（PIL+simhei 中文样图实测识别 6 行、错误路径 fail-closed）；Electron 导入真实样图→识别→ocr_done 91%→校正→重启回读 | 本地失败只标记失败并抛错，**不自动回退云端**（T0 已移除自动回退）；公式/符号精度 v1；bbox 高亮、低置信度区域可视化、真实教师样本人审未做 |
| 云端 OCR（显式同意） | `mistakeImages:runCloudOcr`、`main/mistake-ocr.ts`、`shared/mistake-ocr.ts`、`deepseek.ts analyzeImageWithDeepSeek`（仅同意路径） | `MistakesWorkspace`「云端识别（会上传原图）」+ 勾选「我确认会上传原图到云端」的确认框；typed preload `runMistakeImageCloudOcr` | 已接线：未确认/取消零调用；确认后才上传原图；结果 `ocrConfidence=null`、`requiresReview=true`、`ocrSource='cloud'`，显示“未提供置信度，必须教师复核”，不显示百分比 | `cloud-ocr-consent-smoke.mjs` 75/75（fake provider，无网络）：缺字段/false/取消=0 调用、确认=1 次、provider 失败/空文本零业务写入、本地失败零云端调用、审计序列化不含路径/base64 | 云端失败不调用 `applyMistakeOcrResult`/`markMistakeOcrFailed`，原 `needs_ocr` 保持；`db.ts` 零改动，以 `ocr_confidence=-1` 落库后归一化；审计仅 bounded 主进程日志，无 SQLite 审计表（本轮无迁移）；真实 DeepSeek 质量与教师样本未验证；未运行 Electron 点击 E2E |
| 智能组卷 | 迁移 v6 `paper_blueprints`/`papers`/`paper_items`、迁移 v8 `paper_versions`、`papers:*`（蓝图 CRUD/按蓝图召回/题目编辑/换题/排序/校验/版本/导出/`generateAiCandidates`）、确认动作 `save_paper_candidates` | `PaperWorkspace.tsx`、「智能组卷」主导航入口 | 已接线：蓝图创建与版本锁编辑、确定性召回（FTS+元数据+难度配比）、题目编辑/锁定/换题、**拖拽排序**（含键盘上移下移替代）、校验面板、三产物导出、**版本历史**（导出自动存档、教师手动存档、详情预览、二次确认恢复，恢复前自动存档）、**AI 生成候选题目**（按蓝图+校验缺口生成→候选评审面板可编辑/勾选/来源 chip ai_generated→内联确认/拒绝→确认后单事务写入题库+试卷） | `test:paper-blueprint`（召回/总分/版本冲突/锁定防换题/重复题拒绝/题量不足/归档拒绝/导出内容边界/排序事务 3 类拒绝/版本去重/详情快照/恢复回滚）；`test:ai-paper-candidates`（fake 生成器：归一化、确认写入+FTS 读回、拒绝零写入、教师编辑合并、非法编辑 4 类拒绝、归档蓝图拒绝、重启持久化）；`test:ai-tool-calling`（工具暴露/提交进确认队列/缺参/不存在试卷）；`test:ai-live-usability` **真实 provider**（deepseek-flash 生成 1 道→确认→题库+试卷读回）；Electron 建蓝图→生成→编辑→锁定→校验→导出→拖拽重排可逆→保存版本→预览→恢复→重启回读→**无 Key 点 AI 生成→可执行错误+零确认项** | 试卷对比视图与答题纸排版模板未做；拖拽为 HTML5 DnD，触控与辅助技术未验收；AI 生成质量以 live 用例为证据，无真实教师标注集 |
| 产物管理 | `documents:listArtifacts/getArtifact/showArtifact`、`document_artifacts` | `DocumentArtifactLibrary.tsx`、「产物」主导航入口 | 已接线：类型/状态筛选、真实 SHA-256 前缀、大小与文件名、在文件夹中查看（受管路径守卫） | Electron 导航→列表出现组卷三件套→摘要计数→markdown 筛选→failed 筛选空态→打开动作→双视口截图 | 未做批量导出/删除/重新导出；打开动作在未打包 E2E 走适配器，打包路径仍为系统文件管理器 |
| 错因分类建议 | `mistakes:analyzeErrorPatterns`、`error-taxonomy.ts`（`omni.error.taxonomy.v1`、UTC 日历窗口 ≤366 天） | `MistakesWorkspace` 第 6 步面板（日期/学科筛选、四类计数、需教师复核标记、只读 Markdown） | 已接线：只读分析 + unknown 处理 + 只读边界文案；不写学生档案 | `test:deeptutor-error-taxonomy` 11/11（含 host round-trip 与 no-write）；Electron 点击分析→计数/UTC 窗口/边界→零写入校验→截图 | ~~错因建议不可编辑~~（已由下方确认写入补齐）；未做趋势与跨学科对比 |
| 错因复核教师确认写入 | `mistakes:proposeErrorReview`、`aiConfirmations:confirm/reject`、`save_error_review` 确认动作、`learning_records`（`error_review` 类型） | `MistakesWorkspace` 第 6 步面板：逐条「教师修正分类」下拉 + 备注输入 + 「提交保存（需教师确认）」+ 内联确认/拒绝按钮 | 已接线：提案只进确认队列（pending 零写入）；确认后在 `BEGIN IMMEDIATE` 之外逐条写入学习记录并 readback；拒绝零写入；重复确认被拒 | `test:error-review-write`（分类 5 条、越权记录/非法分类/空提交拒绝、确认写入 1 条含教师修正分类与来源引用、拒绝零写入、重启回读）；Electron 改分类+备注→提交→确认→记录回读→重启回读 | 逐条写入不是单事务（中途失败会留下部分记录，UI 提示需按条目核对）；未做批量确认与错因趋势统计 |
| 本地文档解析（PDF/DOCX/PPTX） | `knowledge:parseResource`、`knowledge:createParseJob/runParseJob/cancelParseJob/retryParseJob/listParseJobs/getParseJob`、`ParseWorkerClient`、python `omni_edu_parse`（原生优先 + Docling 回退）、迁移 v7 `parse_error`、迁移 v9 `parse_jobs`/`parse_job_items` | `KnowledgeResourcePanel.tsx`（知识库页资料列表：解析/重新解析、引擎、错误、切片数、打开原文件；**批量解析待处理资源**按钮 + 进度/成功失败计数/取消/重试） | 已接线：needs_parser → 本地解析 → ready（记录真实引擎@版本）→ 自动切片进检索；失败写 parse_error 并可重试；**批量队列**：串行逐项、部分失败→partial_failed、queued 取消即时/running 逐项生效、仅失败项重试、重启恢复（interrupted_by_restart→failed、queued items→cancelled）；`ParseProvider` 注入式（store 纯 DB，main 注入 worker 包装含受管路径守卫） | `test:parse`（真实最小 PDF xref 结构 + 中文 DOCX 提取、缺失文件/不支持格式 fail-closed）；`test:parse-queue`（收集待解析/failed、部分失败、仅失败项重试、queued 与 running 两种取消、重启恢复、空队列拒绝、无 provider 拒绝）；Electron 导入 PDF→点击本地解析→ready/引擎/切片/可检索状态→重启回读；批量解析段（双 PDF 夹具：点击批量解析→任务/成功计数回读→chunks 含 "Quadratic"→重启回读） | 扫描件/复杂表格依赖 Docling 回退（首次需下载模型）；bbox 与页面坐标未落库；并发固定 1（本机内存约束的确定性选择，调并发需先写进 docs/12） |
| 本地向量索引（LanceDB） | `knowledge:vectorStatus/buildVectorIndex/resetVectorIndex/search`、`VectorIndexClient`、python `omni_edu_embed`（bge-small-zh-v1.5，512 维） | `VectorIndexPanel.tsx`（设置页：模型/维度/已索引/待索引/建立与重建）、`KnowledgeResourcePanel` 资料检索框 | 已接线：设置页建立索引 → 切片 `embedding_status=indexed` → 知识库检索走关键词+向量合并（去重、限量）；模型或 LanceDB 不可用时自动降级关键词并显式提示 | `test:vector` 为**真实索引与语义查询验收**（3 文档索引、语义查询命中斜率片段、重复 id upsert、空查询/缺索引/错 schema fail-closed）；`test:knowledge-search-ui` 为 Electron 验收（知识库检索命中 2 条 + 无命中态、设置页向量面板 模型/512 维/待索引/构建可用性、双截图） | **边界**：真实索引构建（torch+LanceDB）未在 Electron 内执行——本机内存无法同时驻留 Electron + sidecar + torch，故该项以 `test:vector` 为 live 证据；语义召回质量评测（标注集）未做；旧向量物理清理与跨语言检索未验证 |
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

## 本轮验收命令（2026-09-16）

```powershell
cd <repo>/apps/desktop
npm run build
npm run test:renderer-components
npm run test:smoke
npm run test:ai-exercise-set
npm run test:ai-confirmation
npm run test:ai-harness
npm run test:ai-observability
```

`test:smoke` 在同一份 Electron 流程中使用 1366×768 和 1920×1080 两个 viewport，前端路径清单 207/207。本轮（2026-09-16）把三元题组确认升级为「编辑覆盖」契约：教师在错题面板编辑题干/答案后点击确认，编辑值经 `AiConfirmationConfirmInput.exerciseSetEdit` 进入 main 侧校验（数量一致、题干非空、长度上限，role/sourceKind/questionId 不可伪造），`contentMd` 重建、确认项 `payload_json` 记录执行值，重启后编辑值仍可回读；面板拒绝仍零写入。组件状态验收为运行时动态计数的 137/137（`renderer-component-state-test.mjs` 汇总不再硬编码）。已知 flaky 点（讲义导出与学生档案保存的瞬态成功反馈）已改为单次原子轮询（成功文本 + 错误分支同一 tick 判定，错误 fail-fast），真实证据仍以 SQLite/文件 readback 断言为准。

本轮通过重新索引后的代码图和定向文本比对审计 140 个 preload 方法。没有 renderer 调用的 15 个方法中，`runDeepSeek` 是已被 `runDeepTutorConsole` 替代的兼容入口，若干 `get*`/`list*` 是测试 readback 或内部详情入口；不能按“未调用数量”机械新增页面。真正的优先级以教师可见操作是否完整和主 Electron 是否有用户路径为准。

## 下一步顺序

1. 重新从 typed preload 与主进程 handler 反向审计下一项“后端已实现但教师入口/状态/E2E不完整”的能力，不按 API 数量机械新增页面。
2. 优先补真实用户动作、SQLite/file readback 和重启证据，不新增后端能力或独立 smoke。
3. “编辑后的题组覆盖确认 payload”已于 2026-09-16 完成：`aiConfirmations:confirm` 接收 `AiConfirmationConfirmInput.exerciseSetEdit`，教师编辑的题干/答案随确认写入 `exercise_sets`，来源不可伪造，主 smoke 与专项 smoke 均已覆盖。

## T0 基线稳定化验收（2026-10-19）

| 项 | 改动 | 证据 |
| --- | --- | --- |
| 隐私回退 | 删除 `mistakeImages:runOcr` 的自动 DeepSeek 视觉回退；删除通用 `deepseek:analyzeImage` handler 与 preload 方法 | `rg "deepseek:analyzeImage" apps/desktop/src` 0 命中；`rg "analyzeImageWithDeepSeek" apps/desktop/src/main/index.ts` 仅剩 import 与 `mistakeImages:runCloudOcr` 的 provider 注入 |
| 显式同意 | 新增 `mistakeImages:runCloudOcr`；`confirmedUploadOriginal` 必须字面 `true`，缺省/`false` 在读取图片与调用 provider 前 fail-closed | `cloud-ocr-consent-smoke.mjs` 15 个 case / 75 断言：未确认、false、取消均 0 次 provider 调用；确认 1 次 |
| 不伪造置信度 | 云端结果以 `ocr_confidence=-1` 落库，`db.ts` 零改动；`shared/mistake-ocr.ts` 归一化为 `ocrConfidence=null`、`requiresReview=true`、`ocrSource='cloud'`；renderer 列表与 IPC 返回共用 | smoke 的 `confirmed-upload` 与 `normalize-sentinel` case；UI 对 `ocrConfidence !== number` 不显示百分比 |
| 云端失败零写入 | provider 失败或空文本只返回可行动错误，不调用 `applyMistakeOcrResult`/`markMistakeOcrFailed`，原 `needs_ocr` 保持 | smoke 的 `provider-failure-no-write`、`provider-empty-text-no-write`（applyCalls=0、markFailedCalls=0） |
| 审计边界 | 只记录 provider/model/requestId/confirmedAt/imageBytes；不记录图片路径、base64、学生姓名或题干原文 | smoke 断言审计 JSON 不含 `secret-original`、`C:/managed`、`base64`；无 SQLite 审计表（本轮无迁移） |
| 异步 IO | `main/deepseek.ts` 的 `readFileSync(imagePath)` 改为 `stat` + `fs/promises.readFile`；先按 `stat.size` 超 8MB fail-closed，读取后再验 `buffer.length` | `rg "readFileSync\(imagePath\)" apps/desktop/src/main/deepseek.ts` 0 命中；`npm run build` 退出 0 |
| 5 源上下文 | 新增 `renderer/ai-context-sources.ts`；`App.tsx` 合并为学生档案/学习记录/附件元数据/老师知识库/知识图谱，图谱 count 优先 `aiResult.graphNodes.length`，回退 `knowledgeOverview.counts.nodes`；删除 `contextData` | `test:renderer-components` 176/176，含 5 源、优先级与回退断言 |
| 仓库卫生 | 删除根目录 scratch 脚本 `test-enhanced-components.js`；`.playwright-mcp/`、`.orchestration/` 加入 `.gitignore` 并 `git rm -r --cached` | `git ls-files .playwright-mcp .orchestration \| wc -l` = 0 |

本轮门禁（本机实测）：`npm run build` 退出 0；`npm run test:renderer-components` 176/176；`npm run test:ai-mistake-image` ok=true（analysisCount=2，rawImageUploaded=false）；`node scripts/cloud-ocr-consent-smoke.mjs` 75/75；`git diff --check` 无 whitespace 错误。

**证据分级与未验证项**：consent smoke 使用 fake provider，只证明工程链路与同意边界，不发起网络请求；真实 DeepSeek 云端识别质量、真实教师原图样本、完整 Electron 点击 E2E（云端确认对话框 → 上传 → 结果回读）在本轮标记为 `unknown`/未验证。W07 试卷对比与答题纸模板、W08 错因复核单事务与批量确认不在 T0，由 T1/T2 后续提交。
