# Harness Gate 0 独立审查与页面基线

审查日期：2026-11-12。基线：D:/WorkProject/EduProject-harness，branch codex/xiaozhi-harness-20261112，HEAD d50ef330f0f9c4995cc7e096e85bd8fd93629c83。源码只读；本报告位于 TEMP。未启动 Electron、模型请求或使用真实用户资料。

## Gate 0：ACCEPTED

该结论只接受 Phase 0 源码审计作为分阶段实施的充分基线，不是安全、功能、页面、迁移或最终产品通过。用户本轮授权独立审核后自主继续；H01–H31、全部 P0/P1、Phase1–7 的独立门禁和最终验收仍完整适用。F01–F04 为必修缺口，不能借本审查关闭。

独立复核：
- HEAD 和分支相符，已跟踪工作区无修改，专项合同为未跟踪；必要源码已展开。e03e03c8 到 d50ef330 的 main/xiaozhi-agent、preload、task shared contract 与 package/lock 范围 diff 中，只有 ocr-host.ts 及 ocr-runtime-manifest.json 变更。旧 WIP 1945965 不作为此 Goal 基线。
- 冻结源码 pi-session.ts:860、870、895–897 创建现有 execution boundary 和工具包装后通过 customTools 进入 createAgentSession；production-host.ts:866 的真实执行前 journal.admitTool 与 :1108 恢复入口存在。现有包装不是 Capability Dispatcher。原审计对单 Pi、复用边界及稳定 Dispatcher 的分析足以进入 Phase1；生产实施仍需逐期验证。
- package/lock 与 e03e 对应；已对 e03e 安装包类型验证 sdk.d.ts:47、107 的 customTools/createAgentSession 及 agent-session.d.ts:412、739 的 setActiveToolsByName/reload。冻结工作树没有 node_modules，因此本次没有在该工作树实测 SDK；不能从现有激活 API 推断任意新定义热注册。安装后应以锁定包复核并测试安全点刷新。
- journal.ts:117–120 的 owner/run/journal/outbox 表，:129–132 generation，:183 admission，:237–251 启动恢复/fence；receipts.ts:20–21 持久绑定及 receipt；与审计的现有状态复用相符。现有 receipt 不能等价完整 Effect Ledger；外部未知效果禁止盲重放。
- persistent-state.ts:60 将 pending/approved 转 interrupted，证明旧审批不能直接当 H29；mcp-runtime.ts:143、195 和 tools/manifest.ts:21 对 readOnlyHint 分类 safe_read，证明 F02 有实际依据；不得把 28/28 现有回归当恶意 MCP 安全通过。F01/F03/F04 及权限范围须分别按审计任务实施并独立验证。
- 已查看附带 task-plan-20-report.json（20 条通过，合成持久环境）和 mcp-28-report.json（28 条通过，loopback/合成服务）；这些是原审计运行记录，本次未重跑，不能推广为打包、页面、生产权限或外网 Provider 验收。
- 审计逐 Phase 顺序 1→2→3→4→5→6→7 与执行书一致；Provider 接入阶段不能在 Phase3 修复前扩大权限或依赖不可信只读提示，必须保留现有硬边界和保守效果处理。已有能力、未实现和待测边界分开。具体迁移备份、向前/回滚、版本兼容及各 Gate 测试仍在各阶段实施前冻结，不能以审计建议代替。
- 环境待办：在隔离工作树按锁文件准备依赖，再运行该阶段检查；切勿借用另一工作树 node_modules 作为冻结构建证据。原报告的无付费授权说法早于 RUN_AUTHORITY 当前授权；本次审查遵循总控指令未发请求，后续如使用用户授权额度须执行其合成数据与账本限制。

## 页面源码基线（d50ef330，非实际运行验收）

| 表面 | 真实入口及数据链 | 当前源码范围及待实现/待验证 |
|---|---|---|
| 工作台与恢复 | PiInteractionCards.tsx:31 或 PiGoalControl.tsx:42 → PiTaskReview.tsx:29、55、83 → preload/index.ts:248、251 → tasks/api.ts snapshot/resume → production-host；OfficeConversation.tsx:154 → OfficeRecoveryNotice | 会话内按 taskId/revision/requirementsVersion 查询及继续，原操作回执不重放。尚未找到跨会话恢复总览、准确数量或 completed 过滤实现；这些不由该组件已有状态推定。 |
| 审批 | PiEducationWorkspace.tsx:387–388 → PiCopyApproval.tsx → preload/index.ts:352 → xiaozhi:decide / approval-coordinator | 当前展示复制资料来源/目标、一次性批准/拒绝和未知结果核验；不等同完整 Inbox、多类型范围/有效期/重启恢复。PiEducationWorkspace.tsx:146–161 的非 request 自动批准须与主进程授权范围一起审计。 |
| Skill | PiWorkspaceShell.tsx:98 更多→管理教育技能，或 PiSettingsWorkspace.tsx:161 技能 → PiSkillSettings → preload/index.ts:378–380 → skill-management-api.ts | 列表显示内建/自定义、整数版本与启停；提供导入、预览、编辑和归档，运行时锁；shared/xiaozhi-skills.ts 当前没有个人/团队/官方治理、管理员审批、版本历史选择及回滚合同。 |
| 能力中心 | 未在 renderer/shared 搜索到统一 Capability Registry/Center 入口 | 现有 education-tool-catalog/education provider 不等于新 Registry、多 Provider、验证/授权/撤销状态。实现后按真实 Registry 投影复验。 |

组件复用：PiTaskReview/PiTaskSteps、OfficeRecoveryNotice/OfficeRunReceipts、PiCopyApproval/ChatTool、PiSkillSettings/SkillRow、PiWorkspaceShell、OfficeSynchronization。保留现有 OfficeComposer、Pi 与数据/权限真源。页面合同 ai.md、settings.md、UI_CONSTRAINTS 和 edudev-design 适用；2026-11-11 关于已脱敏的真实 reasoning 捕获顺序修订优先于旧“仅详情”描述。测试证据和教师视觉接受分别报告。

## 独立页面验收矩阵

以下均 NOT_TESTED。每项记录真实构建 SHA/指纹、数据来源、操作、预期/实际、截图或录屏、SQLite/文件 readback、缺陷和 PASS/FAIL/BLOCKED/NOT_TESTED。

| ID | 场景与最小步骤 | 预期与证据 |
|---|---|---|
| W1 / T-03、T-04 | 隔离数据建立完成、中断、等待审批、阻塞等多个任务；关闭并重启 | 工作台列表数量和状态与 SQLite 一致，完成任务不混入恢复列表；启动只读诊断无执行副作用，说明已完成/待继续/阻塞。 |
| W2 / T-01、T-02、T-06、T-13 | 选择恢复卡，双击/并发点击继续，观察前后 Task/Run/Generation 和文件，重复重启 | 仍为同一 Task，仅一个新 Run/Generation；已保存成果保留且不重复副作用；旧 Run 无法覆盖新 Run。 |
| A1 / H29 | 在隔离数据产生不同类型待审批并打开申请 | 教师能识别目的、资源、数据范围、持续时间和拒绝后果；无凭据明文；技术细节不强加。 |
| A2 / T-09–T-11 | 分别批准、拒绝、关闭重启；再改变 scope/provider/摘要，复核 | 状态持久且重新显示；条件变化失效，批准前重新核验；拒绝后不重复申请同权限并尝试可行替代。 |
| C1 / C-01–08、R-01–06 | 构造安装、可用、待验证、需授权、不可用及部分符合的 Provider | 清楚区分状态并可查看来源、版本和风险；Required 缺口和越权候选不能被选中，Optional 缺口被披露。 |
| C2 / M-01–09 | 构造未安装市场候选与已验证能力，变更 Schema 或撤销授权 | 候选不能冒充已验证；变更触发重新审查，撤销后新调用阻断，保留来源和审计。 |
| S1 / S-01–05、S-08–09 | 分别创建个人/分享团队/官方发布候选；检查角色和审批 | 归属清晰、个人私有、团队管理员与官方审核可见；Skill 不扩大权限，敏感内容不进入包。 |
| S2 / S-06–07 | 创建新版本，查看来源/历史，切换并回滚 | 旧版本不可变、历史和来源可查，回滚生效且当前任务固定版本。 |

逐项覆盖实际可达的 loading/empty/ready/running/partial/completed/cancelled/failed/retry、键盘焦点及 1366×768、1920×1080；必要时增加窄窗。切勿用静态样张、纯组件 mock 或数据库行代替真实 UI/typed IPC/主进程闭环。确认和失败路径需重启及回读。截图保存构建身份、窗口尺寸、DPR 和状态。

## 后续最小 Electron 路径

在隔离工作树构建后，以独立 OMNI_EDU_DATA_ROOT、--user-data-dir 和合成数据启动，只关闭测试自行创建的实例。node scripts/xiaozhi-agent/pi-workspace-baseline.mjs 可进行无模型请求空工作台与两分辨率几何检查；pi-task-resume-native-ui.mjs 使用本地 SSE fixture、真实 SQLite/用户动作，先确认其硬编码历史 capability cache 存在及构建身份；其结果仅证明 fixture 范围。pi-approval-ui-smoke.mjs 和 pi-skill-settings-ui-smoke.mjs 读取真实 DeepSeek key，未经核实安全隔离和调用预算不要直接运行。Phase 3/4/6 新能力需要以真实应用操作及隔离持久状态新增适用场景；截图和 readback 必须绑定同一最终构建。
