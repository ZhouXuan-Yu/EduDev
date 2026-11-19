# Phase7 页面纵向切片实施合同

状态为 READY_AFTER_PHASE6_GIT。Phase6已独立ACCEPTED，当前正在正常主线整合验证。正式代码在模块推送后启动。本文落实原UI-01至UI-14及既有W/A/C/S、PTY、流式和拖窗合同，全部页面验收目前待执行。

## 教师可见结果

- 恢复与待办展示跨会话未完成Task、准确状态与数量，已完成和已结束记录从默认恢复列表过滤，已完成记录可单独查看。选择记录后打开对应会话，重读精确Task，再由明确动作启动一次原续接。
- 审批Inbox展示持久跨会话待办、目的、资源、数据范围、有效期和拒绝后果。详情与批准/拒绝使用原安全投影及原审批API，结果可刷新和冷启读回。
- 能力中心从原Registry及安装/候选元数据展示来源、版本、验证、安装、授权、缺口和可用状态。当前Task上下文明确可见，缺少具体操作与资源时显示需任务核对。
- Skill治理复用现有个人/团队/官方页面、管理员审核、版本历史与回退。持久终端、流式过程和窗口控制沿现入口接受真实页面测试。

## 数据与只读接缝

一个typed方法getXiaozhiWorkbenchSummary(query)，返回按kind判别的value或版本化错误。query覆盖tasks、approvals、approval_detail、capabilities。字段边界、known keys、过滤、搜索及cursor由单一共享validator定义，每页最多50条。

main增加原SQLite的只读快照接缝，沿原dbPath直接打开READONLY连接并设置query_only、BEGIN，在同一快照关联counts、page及详情。finally直接关闭该原生handle。复用原领域parser、完整性hash、Task教师核对审计与只读metadata。现有writer事务、包含恢复动作的Store关闭路径及会话完整projection用于各自原职责。

- Task汇总读取原Task文档与latest索引，按Task ID去重。native状态在总览标为未检查，选中后沿原getTask读取真实恢复诊断。
- 审批现代引用使用kind、sessionId、id、revision。legacy引用使用kind、sessionId、id及由原身份/时间/payload摘要派生的etag。旧字段缺失显示unknown或null。
- Registry整体hash和schema有效才提供其能力事实。损坏来源进入sourceFailures，行级损坏单独计入unavailableCount。无法分类或扫描不完整时counts、matched、total允许null，partial及已核对范围明确展示。
- 安装、MCP、Extension与候选关联采用原已保存metadata，必要时在原state补无migrate的读取接缝。能力中心初开只读取元数据。泛能力视图保持task_check_required，完整调用继续由原Permission与Resolver执行实时核验。
- summary提供精简标题和必要事实引用，完整会话、原生JSONL、工具响应与凭据值由原领域按需处理。一次返回内的数量与条目采用同一筛选定义和快照。

## 正常动作与历史兼容

父组件持有恢复single-flight、精确scope和稳定commandId。先沿原sessionNavigation.select，确认hydrate及当前选择有效，再getXiaozhiTask核对Task ID、requirementsVersion与revision。main允许剩余步骤恢复时调用原resumeXiaozhiTask。

旧no_criteria普通latest Task使用独立的同任务继续核对动作，沿原startXiaozhi的continueTask、commandId与明确prompt启动新Run。此路径允许原paused/interrupted/review_required普通Task，沿原模型Loop重新形成候选。Goal、active、completed、ended及非latest记录采用其原入口与阻塞反馈。教师已持久ACK的本地确认继续使用Phase6原review路径。

切换会话、关闭、取消或新的选择使旧异步返回失效。双击复用同一commandId，未知结果先重读。审批决定由原main重新检查请求、范围、Provider与版本，成功后刷新当前记录及索引。界面将空、加载、失败、partial、结果未知和重试状态完整反馈。

## 写入分工

main/shared/preload由原Sol core单一负责。新增shared/xiaozhi-workbench.ts和main/xiaozhi-agent/workbench-summary.ts，原db/IPC/host/preload仅增加窄接线。Task、Permission、legacy、Acquisition等原领域只在需要复用现validator时增加最小readonly getter，原SQLite表继续承担事实来源。

renderer由独立Sol叶负责。允许PiWorkspaceShell、PiEducationWorkspace、PiSettingsWorkspace与必要PiPermissionApproval窄接，新增workbench/PiRecoveryOverview、workbench/PiApprovalInbox、PiCapabilityCenter及专属局部样式。Composer、原工具栏、技能与安装页面继续复用。普通Task的agentTrace消费者已经由Phase6接好。

先冻结共享DTO与只读reader，再贯通页面和真实操作。测试限phase7-workbench、phase7-capability等专属文件及受影响原回归，root独占Git和总体状态。

## 验收与收尾

1. 真实SQLite只读连接验证汇总零业务写入、零恢复/迁移/探测/安装/guest派发。覆盖多会话、超过一页、损坏/legacy、数量、过滤与一致读回。
2. 页面从可见入口到typed IPC及原动作，验证当前选中身份、双击一次新Run、变化和迟到返回保护、审批批准/拒绝/冷启及能力状态来源。
3. build、typecheck、renderer与相关专项完成后冻结源、输出、依赖和独立数据根，由GPT-6.1 Terra High按原合同在1366×768与1920×1080独立验收。真实鼠标拖窗、最大化/还原、流式增量、键盘、滚动、停止及PTY沿同一候选验证。
4. 原UI-01至UI-14按实际证据逐项备注已实现。独立通过后root正常提交整合推送，自动进入Phase8。阶段结束以固定原条目完成为准。

本切片采用新增只读接缝和入口，回退按本阶段代码差异恢复原导航，原Task、审批、Skill、安装与产物事实继续保存。参考原始源码准备与core反馈分别位于evidence/phase7/implementation-preparation-20261118和core-preparation-20261118。

## 2026-11-19 工作台切片交接

工作台在阶段功能分支形成独立检查点。最终布局构建、renderer 253 项、Electron 工作台 9 项和流式 5 项通过，独立复验见 [阶段结论](evidence/phase7/implementation-resume-20261119/terra-phase7-scoped-conclusion.md)。Phase7 总门禁保持 PARTIAL。

已观测到已授权缓存工具准备成功后，原通用 Effect 缺少领域读回仍记为 unknown，阻塞同 Task 继续。待审批与准备成功分别补精确持久回执，同 Task 原授权续跑及历史未知结果的验证沿 [定向合同](evidence/phase8/cached-profiling-preparation-20261119/PHASE7_CAPABILITY_PREPARE_CONTRACT.md)。
