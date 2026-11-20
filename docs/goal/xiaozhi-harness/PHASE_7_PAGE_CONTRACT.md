# XiaoZhi Harness Phase 7 独立页面验收合同

## 2026-11-20 任务总览只读快照复验

任务总览按同一快照复用已审计任务文档。SQLite 验证历史指针缺失、目标损坏、跨会话和教师回执保留原处理，Terra 验证现行工作台入口、续跑与冷启。原生窗操作按本合同继续。[证据](evidence/phase7/implementation-resume-20261119/workbench-read-snapshot-20261120.json)

## 2026-11-20 主线构建 `37866ce` 的后台复验

Terra 在两个视口完成审批忙碌期间的 Escape、焦点恢复与延迟详情隔离，另通过能力搜索和 Skill 导航。总控通过三处部分与空态、异常审批冷启和终态前流式推理，另保留同任务续跑准备超时和终端用例中断。该组为后台 Electron 实页，原生鼠标合同仍待执行。[同构建记录](evidence/phase7/implementation-resume-20261119/gate7-unified-background-20261120.json)

## 2026-11-20 能力缺口与审批结果后的键盘退出

C1 将固定必需项、可选项及只有任务条件触发才需要的项分别展示。读取注册表时可列出待核对条件，实际任务的选择仍按 Resolver 中的具体条件执行。真实内建提供方在两个视口通过。[变更与实测](evidence/phase7/implementation-resume-20261119/capability-conditional-requirements-20261120.json)

A1 的保存结果后键盘退出在合并构建的两个视口均未复现。按 Esc 时焦点在审批分类按钮，事件到达唯一顶层面板，面板关闭且恢复入口焦点。旧失败及未知根因保留。[事件轨迹](evidence/phase7/implementation-resume-20261119/approval-result-escape-diagnostic-20261120.json)

## 2026-11-20 A1 提交决定与重新选择

现行权限和历史复制的决定保存期间均保留焦点。已发决定由原处理结算。关闭收件箱后，后来打开的另一条申请保持原内容。历史复制路径由 Terra 独立核对原请求、SQLite 和触发器焦点。全阶段继续按原生窗口与冻结构建标准验收。[对应证据](evidence/phase7/implementation-resume-20261119/approval-save-escape-20261120.json)

W2 在同一工作台实测读取原任务快照时按 Escape。关闭后焦点恢复，原查询返回，没有创建新 Run 或调用模型。[恢复探针](evidence/phase7/implementation-resume-20261119/approval-save-escape-20261120.json)

## 2026-11-20 同一构建的集中回归

W1 的停止与冷读、W2/W3 的迟到事件、A1 异常审批冷启、A2 两视口的目录归属、三页部分态，以及 Terra 独立 S1、S2、C2 有实页限定通过。目录隔离并发首轮异常保留，独立重跑通过。各场景只证明报告列出的范围，按实际运行的构建身份引用。[集中结果](evidence/phase7/implementation-resume-20261119/frozen-candidate-4e1cfe4-20261120.json)

## 2026-11-20 审批忙碌时的键盘退出

A1 详情加载时按 Escape 可退出，焦点返回入口。重开后即使收到上一次读取结果也不会填入当前详情，重新查看可用。纯键盘两尺寸及鼠标进入、键盘退出的组合均实际通过。能力搜索、Skill 导航与 SQLite 无副作用另有证据。[两版实页](evidence/phase7/implementation-resume-20261119/approval-busy-escape-20261120.json)

## 2026-11-20 当前实页证据索引

| 场景 | 已有可复用证据 | 最终复核 |
| --- | --- | --- |
| W1 任务总览 | [冷启、停止与查询重试](evidence/phase7/implementation-resume-20261119/approval-cold-recovery-retest.json) · [三页部分状态](evidence/phase7/implementation-resume-20261119/workbench-partial-empty-retest.json) | 以最终候选校对键盘、可达性与各状态入口 |
| W2 同任务继续 | [双击去重与重启](evidence/phase7/implementation-resume-20261119/workbench-double-resume-retest.json) · [已提交文件不重写](evidence/phase7/implementation-resume-20261119/workbench-committed-effect-retest.json) · [旧事件迟到](evidence/phase7/implementation-resume-20261119/workbench-late-events-current-20261120.json) | 核对冻结版本的恢复操作与记录 |
| W3 跨会话隔离 | [独立成果、迟到事件与隐藏窗口中的原终端](evidence/phase7/implementation-resume-20261119/workbench-late-events-current-20261120.json) | 核对冻结版本的运行、文件和工具归属 |
| A1 审批可读性 | [审批键盘与授权核对](evidence/phase7/implementation-resume-20261119/approval-focus-authority-retest.json) · [秘密值哨兵](evidence/phase7/implementation-resume-20261119/terra-secret-canary.json) · [不同审批类型](evidence/phase7/implementation-resume-20261119/legacy-copy-refusal-retest.json) | 核对聚焦、忙碌、禁用和详情 |
| A2 审批状态变化 | [目标版本与授权变化](evidence/phase7/implementation-resume-20261119/approval-focus-authority-retest.json) · [实包授权撤销](evidence/phase7/implementation-resume-20261119/packaged-grant-revocation-retest.json) · [目录隔离冷启动](evidence/phase7/implementation-resume-20261119/workspace-scope-cold-20261120.json) | 核对冻结版本的相关路径与拒绝后的替代步骤 |
| C1 能力状态 | [五种可用性状态](evidence/phase7/pending-dependency-20261119/terra-pending-conclusion.md) · [必需和可选缺口](evidence/phase7/pending-dependency-20261119/terra-c1-conclusion.md) | 核对实际候选来源、缺口显示和动作可达性 |
| C2 外部能力变化 | [Schema 变化与撤销](evidence/phase7/implementation-resume-20261119/mcp-schema-revocation-ui-retest.json) · [授权派发及撤销后拒绝](evidence/phase7/implementation-resume-20261119/mcp-authorized-dispatch-retest.json) | 核对冻结版本的安全条件变化与本地替代 |
| S1 Skill 归属与分享 | [团队独立副本](evidence/phase7/implementation-resume-20261119/skill-share-authority-ui-retest.json) · [角色与合成隐私反例](evidence/phase7/implementation-resume-20261119/skill-reviewer-member-privacy-ui.json) | 核对冻结版本各角色的入口及反馈 |
| S2 Skill 版本与回滚 | [实页、冷启和运行锁定](evidence/phase7/implementation-resume-20261119/workbench-approval-skill-ui-retest.json) | 核对冻结版本的历史、回滚和失败状态 |

该索引汇总各场景证据的实际边界。完整 Gate 7 仍需统一构建、两尺寸的交互核对，以及实际鼠标拖动和最大化还原的原生窗口记录。

## 2026-11-20 W2/W3 原通知迟到和会话成果

同一任务新运行持有时释放来自原 SQLite 日志的旧停止通知，独立会话 B 前台活跃时释放旧任务通知。新运行和另一会话不继承旧状态。实际回复保存、消息到 Run 的关联和冷启动读回补证。另有旧 Job 迟到完成和冷启 xterm 进度的独立验证。完整 Gate 7 继续沿原交互、两尺寸与证据合同。[实页证据](evidence/phase7/implementation-resume-20261119/workbench-late-events-current-20261120.json)

## 2026-11-19 三页面部分空态

W1、A1、C1 的部分读取子场景已实现。独立复验用真实页面切换过滤和能力搜索，在两视口核对完整空、部分非空、部分空和刷新恢复。此项沿用已有的 W1 查询失败、冷启和真实停止证据。全阶段仍按冻结版本逐项验收。[实页对照](evidence/phase7/implementation-resume-20261119/workbench-partial-empty-retest.json)

## 2026-11-19 审批异常冷启与真实取消

A1 的损坏审批场景独立验证两尺寸冷启、部分计数、有效详情与原会话提示和刷新。W1 真实 SQLite 查询失败可刷新恢复，部分为空的提示仍待修。W3 补证流式正文可见后停止，精确 Task 和 Run 终态，部分正文重启保留。[测试证据](evidence/phase7/implementation-resume-20261119/approval-cold-recovery-retest.json)

## 2026-11-19 审批键盘与授权核对

独立审批详情的两尺寸双向焦点循环、Escape 关闭与触发器焦点恢复通过。A2 本片验证目标变化、任务授权刷新和续跑、MCP Schema 变化后原审批冷启动失效。忙碌与禁用、原生窗口操作及完整适用状态仍按原合同核对。[独立实页与反例](evidence/phase7/implementation-resume-20261119/approval-focus-authority-retest.json)

## 2026-11-19 关闭终端后确认与两个独立实页范围

已修复旧 Job 正常结束后尺寸调整未决而阻断教师确认。Terra 从旧版错误提示到新版真实点击、同任务已完成与冷启动读回独立验证。真实输入 ACK 丢失反例仍禁止确认。另在旧候选独立验证流式切会话和 MCP 撤销后走本地来源、显示匹配引用。仍须核对最终组合构建的两尺寸页面、键盘焦点和弹层恢复、适用异常状态、A2 变更组合与物理窗口操作。[独立记录](evidence/phase7/implementation-resume-20261119/terminal-resize-teacher-review-retest.json)

## 2026-11-19 独立页面复验

W1 冷启工作台、A1 文件审批、A2 MCP 拒绝后的实际本地读取、S2 活跃 Run 锁定 Skill 版本均获限定场景通过。W3 同任务使用终端 Grant 和旧 Job 跨新 Run 提交均获限定场景通过。[工作台与技能](evidence/phase7/implementation-resume-20261119/workbench-approval-skill-ui-retest.json) · [终端与冷读](evidence/phase7/implementation-resume-20261119/terminal-grant-and-late-job-ui.json)

继续验证退出期 resize 遗留未决状态对教师确认的影响，以及实际拖窗、最大化还原和完整 Gate7。单项证据以构建摘要和各报告范围为准。

日期：2026-11-12。工作树：`D:/WorkProject/EduProject-harness`，分支 `codex/xiaozhi-harness-20261112`。本报告是 Phase 2 进行期间的只读准备，Phase 3–6 交付后必须重新核对实际源码和构建身份。Phase 0 Gate ACCEPTED 和 Phase 1 ACCEPTED 均不代表页面验收通过。本报告所有页面验收项均为 **NOT_TESTED**。未启动 Electron、运行测试或模型请求；未修改生产、测试或根台账文件。

## 决策与边界

遵循 `RUN_AUTHORITY.md`、`00_HARNESS_DECISION_LOG.md` 的 H01–H31、`ACCEPTANCE_CRITERIA.md`、`GATE_0_REVIEW.md` 和 `.agents/skills/edudev-design/SKILL.md` 与其 decisions、interaction-contracts、verification。Phase 7 为页面和独立页面验收，Phase 8 为全系统回归和最终交付。保留现有 OfficeComposer 输入框、工具栏及弹层；右栏默认关闭，审批在相关操作点可达，设置按日常和高级分层；Pi、SQLite/文件和主进程权限继续是既有真源。样张、组件测试和源码检查均不构成实际页面或教师视觉接受。

## 当前源码接缝及缺口

| 页面 | 可复用真实入口、链路 | 当前观察与尚需验证 |
| --- | --- | --- |
| 工作台恢复 | `apps/desktop/src/renderer/components/office/PiInteractionCards.tsx:31` 或 `PiGoalControl.tsx:42` → `PiTaskReview.tsx`；`apps/desktop/src/preload/index.ts:248,251` → task snapshot/resume。`OfficeConversation.tsx:154` 使用 `OfficeRecoveryNotice`。 | 会话关联任务卡可核对与继续；不能据此证明跨会话恢复总览、准确数量或已完成过滤。 |
| 审批 Inbox | `PiEducationWorkspace.tsx:387` → `PiCopyApproval.tsx`；`preload/index.ts:352` → `xiaozhi:decide`。 | 现有复制审批展示来源、目标、一次批准/拒绝以及未知结果核验；不等于多类型审批 Inbox、范围时限或重启持久化。 |
| 能力中心 | 现有教育工具与 Provider 目录可作为相关入口检查对象。 | 当前 renderer 未找到统一 Capability Registry/Center；旧目录不等于安装、验证、授权和可用状态。Phase 1 Registry 已验收不证明页面可用。 |
| Skill 版本/团队 | `PiWorkspaceShell.tsx:98` 更多入口，或 `PiSettingsWorkspace.tsx:161` 设置技能 → `PiSkillSettings.tsx`；`preload/index.ts:378–380` → catalog/preview/mutate。 | 当前内建/自定义、版本、导入、预览、编辑、启停、归档可复用；未见个人/团队/官方治理、团队管理员审批、版本历史选择和回滚完整页面合同。 |

这些是源码观察，不代表功能或安全能力已通过；后续阶段可能改变接缝。保留受保护 Composer 及现有 typed IPC、状态同步、任务与权限体系，不建立平行体系。

## 验收环境和证据

使用隔离测试数据根 `OMNI_EDU_DATA_ROOT`、独立 `--user-data-dir` 和合成数据；只关闭验收创建的实例，不操作日常用户应用或扫描真实资料。所有证据绑定同一最终源码提交、构建路径和构建指纹；截图注明原生与 CSS 窗口尺寸、DPR、数据根、场景和状态。实际操作应从可见导航开始，经真实 Electron 页面、typed IPC 和主进程闭环；以 SQLite/文件 readback 验证持久状态。直接 IPC、fixture 或低层数据库断言只作辅助，不能代替页面操作。记录 renderer 错误及关键交互，必要时录屏。

逐项记录 `ID | 状态 | 环境/版本 | 前置条件与步骤 | 预期 | 实际 | 证据 | 缺陷`，状态为 PASS、FAIL、BLOCKED、NOT_TESTED；无证据不写 PASS。下列当前全部 NOT_TESTED。两种尺寸 **1366×768、1920×1080** 均检查可达性、滚动和无遮挡；检查键盘 Tab/焦点、Enter/Space、弹层关闭后的焦点，以及 loading、empty、success、cancel、error、partial、retry 等适用状态；无法构造的状态须明确列出原因。补充窄窗和 150% 缩放可作为设计检查，分别报告。

| ID | 页面与操作 | 预期与证据 | 当前状态 |
| --- | --- | --- | --- |
| W1 | 隔离环境构造完成、中断、待审批、阻塞等多个任务，打开工作台，关闭并重启。 | 页面数量、状态和 SQLite 一致；完成任务不进入恢复列表；教师可理解已完成、待继续与阻塞原因；启动诊断只读，无执行副作用。保留重启前后截图与 readback。 | NOT_TESTED |
| W2 | 从页面选择恢复，双击或并发点击继续，检查重启、多次重启和旧 Run 迟到结果。 | 同一 Task ID，恰好一个新 Run/Generation；已有成果保留、已提交副作用不重复；旧 Run 不能覆盖新 Run。以 UI 操作、关联 ID 和持久化记录证明。 | NOT_TESTED |
| W3 | 构造两个会话及多个任务，切换会话、查看恢复与权限、成果和交互，制造异步迟到。 | Task、Session、Run、Artifact、权限及展示互不串线；重启后依旧一致。 | NOT_TESTED |
| A1 | 构造不同类型待审批，从可见入口查看详情。 | 清晰说明目的、资源、数据范围、持续时间和拒绝后果；不显示密钥；技术细节渐进披露。 | NOT_TESTED |
| A2 | 分别批准和拒绝；应用重启；改变 scope、目标或 Provider 的安全属性后再核验。 | 审批状态持久、待审批重新展示；条件变化使审批失效并重新核验；拒绝后不重复申请相同权限，尝试可行替代。比较 UI 与真源。 | NOT_TESTED |
| C1 | 构造已安装、可用、待验证、需授权、不可用以及部分符合的 Provider，操作能力中心。 | 状态可区分；来源、版本、风险可查；required 缺口不进入合格选项，optional 缺口明确披露。 | NOT_TESTED |
| C2 | 比较未安装市场候选与验证能力，改变 Schema、撤销授权或 Provider。 | 候选不能冒充已验证；安全属性变化触发复核，撤销后新调用阻断且保留来源审计。 | NOT_TESTED |
| S1 | 操作个人 Skill、团队分享副本、团队管理员和官方审批场景。 | 个人/团队/官方归属与审批状态清楚；个人默认私有，分享是独立副本，未经相应审批不得发布；无敏感内容外泄，Skill 不扩大权限。 | NOT_TESTED |
| S2 | 创建新版本、检查来源和历史、选择回滚，重启后再查看。 | 旧版本不可变，历史及来源可查，回滚生效；运行任务的版本绑定正确；UI 与持久真源一致。 | NOT_TESTED |

逐项补充成功、取消、失败、部分完成和重试；检查缺少数据、不可用 Provider 和授权被拒时的真实界面。安全断言与各阶段独立测试相互补充，不能仅由界面文字推断。

## 可复用脚本及限制

- `apps/desktop/scripts/xiaozhi-agent/pi-workspace-baseline.mjs`：使用隔离数据根和 profile 启动 out 下 Electron，可供无模型请求的空工作台与两分辨率几何检查；启动前必须确认最终 build 身份与数据路径。
- `apps/desktop/scripts/xiaozhi-agent/pi-task-resume-native-ui.mjs`：本地内存 SSE fixture、合成模型 key，使用真实 Electron、SQLite、journal 及 UI 路径，但依赖既有 official catalogue cache；运行前检查 cache 来源、存在性、构建指纹和隔离路径。脚本第 45 行含直接 IPC 的幂等断言，不能代替页面上的双击/并发点击。仅证明 fixture 范围，不是真实 Provider 或教师验收。
- `apps/desktop/scripts/xiaozhi-agent/pi-approval-ui-smoke.mjs:13–15,24–25`：从环境文件提取真实 `DEEPSEEK_API_KEY` 和模型并传入 Electron，可能产生真实请求。未经核对密钥读取、隔离环境、请求账本及预算之前不得直接运行。
- `apps/desktop/scripts/xiaozhi-agent/pi-skill-settings-ui-smoke.mjs:20,29`：优先从环境读取真实 `DEEPSEEK_API_KEY`，否则通过 `pick` 查找；把 key 传入 Electron，可能产生真实请求。未经核对密钥读取、隔离环境、请求账本及预算之前不得直接运行。

目前 out 由实施 Agent 独占，本次没有运行上述脚本。用户授权的真实请求须使用合成资料，逐次计入持久账本；本次为零请求。验收等待 Phase 3–6 及其门禁完成，并以届时最终构建重核以上接缝。

## 2026-11-17 原有桌面反馈回归细化

以下回归对应用户先前提出的生成卡顿、窗口拖动和推理进度实时显示，沿现有工作台及QG页面/性能门禁记录。状态均为NOT_TESTED。

- 在1366×768与1920×1080的自有验收实例中，实际使用鼠标拖动标题区域，记录原生window bounds前后变化。验证普通窗口、最大化后还原、拖动后的输入与工具操作。截图、实例PID和实际启动路径随证据保存。
- 用真实Electron加合成流式fixture持续输出正文和Provider提供的reasoning delta，终态前展开进度并记录可见内容的增量时间。Provider未提供推理文本时，阶段反馈反映实际处理状态。
- 在生成期间实际输入、滚动查看历史、展开工具进度、停止及切换会话，记录响应、控制状态和持久终态。Phase8在同场景记录本地准备、长任务、帧与输入响应，按已冻结功能语义比较优化前后。

页面验收由Terra High执行，隔离数据根与完整来源证据沿本文件原契约。

## 2026-11-19 历史复制审批独立复验

A1 历史复制子场景已实现。Terra 从真实 Electron 开发构建的审批收件箱展开原申请，核对来源、目标、单次范围与拒绝后果。A2 同一历史申请的拒绝及冷启动子场景已实现。SQLite 记录、审批 ID、原文件摘要及目标未创建均有读回。冷启动详情按已拒绝历史记录只读显示。[复验](evidence/phase7/implementation-resume-20261119/legacy-copy-refusal-retest.json)。

A1 其他审批类型、A2 范围变化与替代路径、最终包的完整页面合同继续验收。

## 2026-11-19 工作台双击继续独立复验

W2 的双击去重、同 Task 和冷启动子场景已实现。真实开发构建从可见工作台双击“继续剩余步骤”，仅新增一个 Run，Generation 从 1 到 2，恢复回答可见。第二次冷开读回相同 Task 和已恢复 Run，零模型重放。[复验](evidence/phase7/implementation-resume-20261119/workbench-double-resume-retest.json)。

早期写入夹具把只读步骤登记为写入依赖，保留两次未进入草稿的记录。按当前计划合同并用实际审批点击后，观察到首次写入未派发却被本地效果账标记为不确定。同 Task 续跑出站前阻于 task_effect_needs_recheck，目标文件未创建。已提交文件、旧 Run 迟到结果和修复后重验仍待完成。W2 整体为 PARTIAL。

## 2026-11-19 实包授权撤销独立复验

A2 的授权撤销子场景已实现。Terra 在当前便携包的权限设置撤销同一合成工作区读取授权，已批准的原申请变为已失效，原因记录为 grant_revoked。重开后按相同审批 ID 从 SQLite 和收件箱读回，Run、工具回执与文件无新增。重新派发、目标或 Provider 变化及替代路径仍待完整验收。[撤销回执](evidence/phase7/implementation-resume-20261119/packaged-grant-revocation-retest.json)。

## 2026-11-19 W2 文件续写修复独立复验

W2 的授权后续写子场景已实现。新开发构建上，Terra 观察到同一任务仅新增一个 Run。同一已批准但未消费的精确单次请求首次进入执行，教师从实页确认文件草稿后才落盘。冷启继续读回同一审批、任务、Run 和文件。追加一代的防重复写在真实 Host 专项验证。W2 的同一可见场景再续跑已保存任务、迟到旧 Run 和完整页面合同仍待完成。[独立与 Host 回执](evidence/phase7/implementation-resume-20261119/filesystem-approval-resume-host-retest.json)。

## 2026-11-19 已保存文件再次继续的页面验证

W2 的已提交文件防重子场景已实现。Terra 在冻结开发构建从工作台双击继续，同一任务只新增一个 Run。合成模型尝试重复写同一已保存讲义，工具以 task_step_already_verified 阻断，回执显示未派发。原文件摘要、唯一已应用记录及原成功回执保持一致，冷启零模型重放。下一项任务未被错误创建，旧 Run 迟到仍单独验证。[独立实页](evidence/phase7/implementation-resume-20261119/workbench-committed-effect-retest.json)。

## 2026-11-19 S1 团队副本与官方审核角色

S1 的分享副本和官方非审核员子场景已实现。Terra 在实际开发构建中从个人 Skill 分享出独立的团队副本。副本先待审，团队管理员批准后生效，原个人版本与文件字节不变。当前非官方审核员可提交官方审核申请；页面无审批入口，typed 主进程拒绝越权审核，冷启仍待审。非管理员团队角色、私有来源正文隔离及官方审核员批准成功继续验收。[独立证据](evidence/phase7/implementation-resume-20261119/skill-share-authority-ui-retest.json)。

## 2026-11-19 C2 MCP 目录变化与撤销

C2 的目录变化、信任清除和撤销子场景已实现。Terra 从实际设置页添加并信任合成服务。工具 Schema 变化后重新连接，应用清除旧信任与选择；重新批准后执行页面撤销，冷启保持 revoked。测试没有发出 tools/call，撤销后的实际尝试及替代路径另行复验。[独立实页](evidence/phase7/implementation-resume-20261119/mcp-schema-revocation-ui-retest.json)。

## 2026-11-19 持久终端续跑与交接

实际 Host 验证旧 Run 的原 PTY 与执行返回晚于新 Run 启动，旧回执及文件各自保持归属，后台 Job 可在原有效授权下落盘。W3 跨会话 UI 的 Artifact/Grant 隔离待验。[终端验证](evidence/phase7/implementation-resume-20261119/late-pty-owner-retest.json)。

C2 真实设置授权后的再次调用未进入传输，Gate7 继续 PARTIAL。[C2 首次派发复现](evidence/phase7/implementation-resume-20261119/mcp-authorized-first-dispatch-red.json)。

## 2026-11-19 独立技能与跨会话复验

Terra 在冻结开发构建完成 S1 三个实页子场景，共 6/6。合成审核员批准精确官方版本，普通成员的团队副本保持待审，含合成号码和邮箱的个人草稿不能分享，冷重启与 SQLite、文件一致。[技能复验](evidence/phase7/implementation-resume-20261119/skill-reviewer-member-privacy-ui.json)。

Terra 的 W3 实页 5/5。两个会话同时等待，释放 A 时 B 不显示 A 的内容，两边从页面各自保存 Markdown，冷读会话、Run 和文件摘要一致。Grant 和跨会话旧 Generation 仍待实页核对。[跨会话与产物](evidence/phase7/implementation-resume-20261119/workbench-interleaved-artifacts-ui.json)。

## 2026-11-19 W3 成果目录与任务授权隔离

冷开从教学文件目录回到两条合成成果各自原会话，2/2。A 从实际设置页获当前 Task Grant 后，B 在同工作区请求相同命令仍独立待批。实际撤销 A 文件权限后，以相同 Grant ID 和 B 审批冷读通过，4/4。A 的原命令在批准前已未执行，后续仍需单独验证同一任务续跑能使用新的授权。[独立证据](evidence/phase7/implementation-resume-20261119/workbench-interleaved-artifacts-ui.json)。

## 2026-11-19 HTTP MCP 授权后首次调用

C2 的同任务首次派发与 Provider 撤销子场景已实现。Terra 实页 4/4。批准前请求 0 次，同任务授权续跑准确调用 1 次。撤销后 Pi 拒绝旧工具名，原生拒绝、成功回执、撤销和本地工具发现均可核对，冷启无新增调用。市场候选与已核验记录对比另通过 2/2。[验证记录](evidence/phase7/implementation-resume-20261119/mcp-authorized-dispatch-retest.json)。

撤销后完成了实际本地工具发现。进一步验证替代课程查询属于剩余场景。
