# D3 小智长期个人教学 Agent 基线审计

日期为 2026-11-22。执行工作树为 `D:/WorkProject/EduProject-harness`，分支 `codex/product-agent-d3`，基线和 GitHub `origin/main` 均为 `38a2a424df9809f16d6a09870d547ff18d66ae58`。运行工具链为 Windows、Node 24.12。原日常工作树 `D:/WorkProject/EduProject` 为 detached `7ee410d`，有其他工作和原 D3 任务包未提交。D3 复用既有开发工作树，保留原工作树与三处原未跟踪内容。D2 曾独立判定完整验收 FAIL，提交 `8b9f4e7` 留在原工作分支，本轮以主线 D1 为底座。

## 调用链与差距

下述是 `38a2a42` 源码盘点。图谱定位了生产 Host、Pi Session、Task、Planner、Memory 和 Workbench，当前签名及行为用实际工作树源码复核。列出的历史测试入口仍须对 D3 构建重跑。

| 能力 | 入口与事实源 | 当前缺口 |
| --- | --- | --- |
| 对话 | `PiEducationWorkspace` → `preload.startXiaozhi` → `xiaozhi-agent/ipc.ts` → `production-host.start/execute` → `createPiXiaozhiSession` → 唯一 Pi Runtime。消息有 SQLite 会话投影，Pi Session 保存 JSONL。 | `production-host.start` 对每条 `prompt` 调 `tasks.start`，普通问答也建立业务任务。手动整理同样有独立 Run，组装却尝试为无 Task 的 Run 建 MCP 权限所有者。 |
| 任务与副作用 | `tasks/coordinator.ts` → `tasks/task-state.ts`、`tasks/plan-runtime.ts` → `events/publisher.ts` 与 `events/journal.ts`；权威状态在 SQLite，恢复核对 `tasks/recovery-inspection.ts` 及 `effects/`。 | 原 Task steps 已有依赖、计划、结果/回执与状态，但后台子任务专门上下文、结果汇总及真正教师暂停尚待覆盖。现有测试入口含 `phase7-workbench-cold-ui.mjs`、`phase7-approval-cold-ui.mjs`。 |
| 能力与审批 | `capabilities/runtime.ts` 通过 Registry、Resolver、D1 Binding、Adapter 及 `permissions/service.ts`。宿主通过 `createRunToolGovernance` 做调用和效果检查。 | 普通问答应只启用答复路径，不能因缺 Task 走无治理工具。自动能力发现和业务编排仍按原宿主边界。 |
| 首页和工作台 | `PiEducationWorkspace.tsx` 和 `OfficeComposer`，`PiRecoveryOverview` 经 `workbench-api.ts` → `createWorkbenchSummary` 聚合真实任务/审批。`App.tsx` 进入 `TeachingBookWorkspace`，组卷和成果领域有现行页面。 | 恢复总览与教学成果尚未形成任务优先的常驻工作台；首页待办、失败、待继续和最近成果没有统一动态排序。 |
| 成果 | `office-artifact-state.ts` 和 `office-artifact-coordinator.ts` 保存已交付对象，编辑/版本分别见 `paper-basket-v2-repository.ts`、`classroom-plan-state.ts` 及已保存文件的版本核验。 | 缺统一可独立打开、跨任务引用的教学成果投影。需要沿现有对象提供局部修改、版本冲突和恢复对照。 |
| 资料 | `main/assets` 管理原件和解析；`material-curriculum.ts` 管理版本化教材引用，`main/questions` 与题库现有检索支撑来源；OCR 经 Worker，各分工沿现有数据。 | 模考地区/年份/轮次、试卷与答案关系、许可及汇编未找到成形领域入口。OCR 能力需用可授权的实际版式样本再验。 |
| 记忆 | `teacher-preference-state.ts`、`teacher-preference-learning.ts`，`native-memory-epoch.ts`、`memory-scope.ts`，教师设置和会话启用层已有实现。 | 明确来源/确认、同次要求和长期偏好已有机制；画像与多空间范围、冲突、纠正和最小注入仍需逐条实测，不能视作全量通过。 |
| 自动组卷 | `paper-api.ts` → `paper-coordinator.ts`、`paper-selection.ts` → `PaperBlueprintWorkspace`、题篮、来源版式、`paper-instance-export.ts`。 | 核查自然语言到蓝图/预览/修改/导出的同一任务证据，逐项测量配比和教师核对。 |
| 讲义 | `classroom-document-pages.ts` 与 `classroom-export-tools.ts` 有现行讲义输出，`TeachingBookWorkspace` 显示相关分类。 | 核查独立讲义结构、可编辑章节/段落、练习梯度、原版本和来源，不能凭现有导出宣告齐备。 |
| 模考汇编 | 已有资料导入、OCR、版本及题目取证。源码检索暂无模考汇编专用工作流。 | 需实现目录、元数据复核、答案关联、许可、版本和导出，并用明确获授权的资料覆盖图片、缺页和无答案。 |
| 教案 | `classroom-plan-state.ts`、`classroom-plan-tools.ts` 保存课时/教学依据和教师确认。`classroom-export-tools.ts` 沿实际 `planId/version` 导出。 | 验证目标—活动—评价关联、时间约束、自然语言可定位修改及同版本冷启恢复。 |

Phase 0 源码缺口和实施边界已形成，进入 Phase 1。教师可用性、真实模型质量与运行基准本条目尚未采集。

## Phase 4.3 模考汇编开工基线

资料版本由 `MaterialRepository` 中的原件摘要和实际文件校验确定。版面及题目证据沿 `MaterialStructureRepository` 和 `MaterialQuestionArchive` 读取。独立答案册沿 `MaterialBookPairs` 绑定两侧资源版本，已有真实试卷和答案结构恢复证据。模考汇编应引用现存资料、结构记录和配对，不另存试卷或重做 OCR。

当前主线缺少从对话把区、年份、年级、学科和模考轮次登记为可复核目录的专项入口，也缺少汇编级版本和导出。已有真实上海高考试卷的结构证据仅用于确认底层可复用，模考缺页、重版、缺答案及许可仍按专项验证。 [知识库底层证据](../research/evidence/kb/20261121/book-zero-dispatch/README.md)

开工后已补齐「问小智」年度目录、独立版本、题卷与答案册定位、教师确认、工作台双向定位和历史恢复。现有资料服务继续持有原件，确认目录不会修改原件和题库。当前差距是对话局部修订、文件导出与真实版式质量。 [专项证据](04_PROGRESS_AND_EVIDENCE.md#phase-43-模考成果工作台与目录版本)
