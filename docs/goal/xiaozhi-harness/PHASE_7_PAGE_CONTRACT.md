# XiaoZhi Harness Phase 7 独立页面验收合同

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
