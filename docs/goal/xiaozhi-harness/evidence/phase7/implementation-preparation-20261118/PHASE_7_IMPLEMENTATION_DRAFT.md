# Phase7 最小页面纵向切片合同草案

DRAFT / SOURCE_PREPARATION_DONE。2026-11-18，实际树 D:/WorkProject/EduProject-harness。正式实施等待 Gate6 与 root Git 释放。当前只读源码核对，生产、测试、out、runtime 均零写入，测试、构建、Electron、helper、模型均 NOT_RUN。本文件是唯一 TEMP 交付，全部新增 DTO/文件为候选，须由 core 冻结后编码。

## 固定需求与当前事实

| 合同 | 当前真实源码入口 | 真正缺口与下一动作 |
| --- | --- | --- |
| W1 / UI-01~03 | PiWorkspaceShell 的对话记录、PiEducationWorkspace 的 listAiConversations 和选中会话 hydrate；PiTaskReview 已接规划与恢复投影 | 会话列表只有标题/预览/消息数，缺跨会话 Task 准确计数、未完成过滤及阻塞摘要。补原 Sql 只读分页总览，completed/ended 从默认恢复结果排除 |
| W2 / UI-04 | getXiaozhiTask / resumeXiaozhiTask、PiTaskReview.resume、原 Task CAS/commandId 与新 Run/Generation | 缺从总览选择会话并恰好一次继续的可见路径。沿父组件 sessionNavigation.select，重读选中 Task，再发一次原 resume |
| W3 | pi-session-navigation.select、hydrate token、原会话草稿/事件 fence、TaskRecovery 精确身份检查 | 总览和 Inbox 新请求须同样绑定 session/task/revision 与组件 epoch，迟到返回不切换新会话或覆盖新选择 |
| A1~2 / UI-05~08 | PiPermissionApproval、PiPermissionSettings、PiCopyApproval；原 PermissionStore/Engine 与 typed decide/revoke/legacy action | 当前只显示所选会话/turn，缺持久跨会话 Inbox。补只读索引和单项详情，复用原动作与呈现；PiPermissionApproval 的原生 details 是 D13 的定点替换候选 |
| C1~2 / UI-09~11 | main Capability Registry/Resolver；PiManagedTools、PiMcpSettings、PiAcquisitionSettings/PiExtensionSettings | preload 无 Registry/Center 只读视图，设置无统一能力中心。安装记录、候选与实际 Provider 需统一来源索引和分轴状态，沿原页面准备/授权/撤销 |
| S1~2 / UI-12~14 | PiSkillSettings→SkillGovernancePanel，已具个人/团队/官方归属、管理员审核、分享副本、版本来源、activate/回退与撤回 | 旧 Phase7 稿的“未见治理页面”已过时。复用现有 Phase4 页面做实际验收，依照真实失败再定点修；官方是本地可信审核协议边界 |
| PTY | OfficeConversation:107→TerminalJobs；AgentPublicTool:79→TerminalConsole；typed terminal API/主进程 controls | 现已有输入、Ctrl+C、EOF、关闭输入、接管、停止、ACK unknown 与刷新。等待 Gate6 最终身份，在 Phase7 验两尺寸、键盘、会话隔离与 cleanup，无新终端实现 |
| 流式/拖窗 | OfficeAgentTurn/原过程与正文分界、PiEducationWorkspace 事件 receiver；chrome.css:11/25/31 的 drag/no-drag | 真正鼠标拖动、maximize/restore、reasoning/final 增量、输入/滚动/展开/停止需要独立 Electron 门禁。沿现页面，来源不足时记录 NOT_TESTED |

最新同步：普通 Task 在 agentTrace 页面缺 PiTaskReview 消费。core 正于 PiEducationWorkspace 原 renderApprovals 接 task_review，并精确匹配 lastRun/origin，随后做真实两尺寸验证。该同一缺口由 core 收尾，本合同不重复实施；后续改父组件须基于其最终 Gate6 源重核。组件具备与普通页面可达性分别记录。

以上均是源码具备/缺口判断，Phase7 页面状态仍 NOT_TESTED。ACCEPTANCE_MATRIX 的 T-09/10 与 Phase4/5 PASS 属原领域证据，不能替换 UI-01~14 或 W/A/C/S 页面证据。

## 一个只读接缝

候选共享文件 src/shared/xiaozhi-workbench.ts，一个 typed 方法 getXiaozhiWorkbenchSummary(query)，一个受现 allowed(event) 保护的 IPC。core 持有单一主进程 reader，建议 src/main/xiaozhi-agent/workbench-summary.ts，经原 production-host/IPC 注册接入；preload/index.ts 只增加该方法。沿原 Sql 和各领域验证器，无新表、Task 真源、写入队列或 Runtime。

```ts
type Query =
 | {kind:'tasks'; filter:'unfinished'|'resumable'|'blocked'|'completed'; sessionId?:string; cursor?:string}
 | {kind:'approvals'; state?:PermissionApproval['state']|XiaozhiApprovalState; sessionId?:string; cursor?:string}
 | {kind:'approval_detail'; sessionId:string; approvalId:string; revision:number}
 | {kind:'capabilities'; sessionId?:string; taskId?:string; requirementsVersion?:number; query?:string; cursor?:string};
type Page<T> = {schemaVersion:1; asOf:string; items:T[]; matched:number; total:number;
 counts:Record<string,number>; nextCursor:string|null; partial:boolean; unavailableCount:number};
type TaskRow = {sessionId:string; sessionTitle:string; taskId:string; revision:number;
 requirementsVersion:number; state:TaskView['state']; updatedAt:string; lastRunId:string|null;
 isLatestForSession:boolean; resumeCandidate:boolean; blockedReasons:string[];
 pendingApprovalCount:number; unknownEffectCount:number; nativeInspection:'not_checked'};
type ApprovalRow = {kind:'permission_v2'|'legacy_copy'; id:string; revision:number|null;
 sessionId:string; sessionTitle:string; taskId:string|null; runId:string; state:string;
 purpose:string; resources:string[]; classification:string; expiresAt:string|null;
 canDecide:boolean; blockedReasons:string[]};
type CapabilityRow = {id:string; capabilityId:string|null; providerId:string|null;
 name:string; version:string; origin:'registered'|'candidate'; source:string;
 sourceHash:string|null; schemaHash:string|null; license:string|null;
 installed:'bundled'|'installed'|'missing'|'unknown';
 verification:'verified'|'pending'|'expired'|'failed'|'revoked'|'quarantined'|'unknown';
 authorization:'allowed'|'required'|'revoked'|'task_check_required';
 availability:'full'|'partial'|'blocked'|'task_check_required';
 requiredMissing:string[]; optionalMissing:string[]; reasons:string[];
 risk:string[]; verifiedAt:string|null; expiresAt:string|null};
```

返回按 query.kind 使用判别 union。approval_detail 只返回单条原 PermissionApproval/XiaozhiApproval 的现有公开安全投影，复用 PiPermissionApproval/PiCopyApproval；summary 不返回秘密值、完整请求正文、projection、原生 JSONL、模型/工具响应。资源/目的使用现有安全摘要与 permissionPresentation 口径。schema/version/ref/hash 是元数据，均不授予权限。

每页至多 50 条，cursor 稳定排序 updatedAt/id；counts/matched/total 使用同一筛选定义与读一致性。按 Task ID 去重，状态计数取原保存 state，完成和 ended 分列且默认过滤，审批/Effect 数量独立列。一个 Task 可有多种阻塞事实，筛选计数不相加推导 Task 总数。损坏行独立 unavailableCount/partial，页面明确“记录未完整核对”，禁止显示伪准确总数。归档会话默认排除，旧数据缺字段使用明确 unknown/null。

TaskRow.resumeCandidate 仅是可打开核对的候选。非当前 latest Task 保留历史/阻塞事实，沿原 previewResume 的 latest 规则关闭继续，禁止替换成同会话的新 Task。全局 nativeInspection 固定 not_checked；只在选中会话后通过原 getTask/recovery inspector 读真实 native 状态，避免扫描全部历史文件。

CapabilityRow 必须展示当前选中的 session/Task 上下文。上下文缺失显示“需任务核对”，不伪造 active owner。allowed 仅来自原领域可证明的当前 Scope/Grant 元数据；缺具体资源/动作或合法 request 时维持 task_check_required。记录级 verified/health 与有效期按原证据派生，不能推断当前调用已授权。可只读评估的条件由 core 复用现有 Resolver/assessConformance/PermissionEngine.evaluate；不调用 authorize/run/request 或创建审批。required/conditional 缺口不得进入合格集，optional 缺口保留 partial。未知候选维持 quarantined/unverified，MCP readOnlyHint 仍是元数据。

## 已核对的只读陷阱

- tasks/coordinator.ts:114 的 snapshot 会 recover。全局 reader 不循环调用 getXiaozhiTask、getXiaozhiSnapshot、getAiConversationSession，也不加载所有会话消息/projection。
- permissions/api.ts:18→service.ts:109 的 view 调用 workspace 和 engine.revalidate，可能写审批失效。全局与单项只读查询应复用 PermissionStore 的验证/SELECT 路径。显示过期/需重读事实，实际决定沿原 Engine 再核验。
- production-host.ts:547 的 acquisitionView 调 ensureReviewed；acquisition/service.ts:242 会 cache 写入。acquisition/state.ts:42~43 的 get/list 又 await migrate。新 summary 不能直接复用这些可能写入的 view。若原 store 缺纯只读 getter，由 core 增加最小 readonly/inspection seam，复用原 hash/decode；不复制验证器或伪造 noop Sql。
- Registry.snapshot 在 registry.ts:157 是纯 read。以其为中心，原 Acquisition/MCP/Extension/Skill/Managed metadata 做有界关联。打开页面不调用 search、probe/connect、prepare/repair、健康 guest、install、activePending 或 resolve 自动 fallback，不读凭据值。

## Renderer 未来允许范围

按以下纵向切片串行释放，当前全为提案。

1. 恢复与待办入口。PiWorkspaceShell.tsx 仅挂现 EduPanel 的“恢复与待办”入口；PiEducationWorkspace.tsx 仅接父会话选择、重读与恢复回调。新增 workbench/PiRecoveryOverview.tsx 与 workbench/PiApprovalInbox.tsx，复用现有按钮/Disclosure/列表样式。已有 PiWorkbenchBridge/WorkbenchState 只提供导航元数据，可复用，保持其无快照/权限真源定位。
2. 能力中心。PiSettingsWorkspace.tsx 只添加“能力中心”tab/搜索条目和现 tools/skills/permissions 页的跳转。新增 PiCapabilityCenter.tsx，读单一 summary 展示分轴状态与来源/版本/风险，按需展开。准备/连接/授权/版本操作转到 Phase3/4/5 原组件，中心初开保持纯读。PiManagedTools/PiMcpSettings/PiAcquisitionSettings/PiExtensionSettings/PiSkillSettings 的实现保持复用。
3. PiPermissionApproval.tsx 仅在实际 Phase7 定点需要时替换原生 details 为现 DisclosureCard，补拒绝后果与当前 scope 的准确文字，保持原 decide CAS/输入。S1/S2 与 PTY/流式/标题栏默认不改源码，实际门禁发现具体缺陷后再授权窄改。

初始允许列表为上述四个已有 renderer 文件和三个新组件。必要样式限新组件专属局部模块，避免沿用装饰编号/大卡片。新增测试命名 phase7-workbench-* / phase7-capability-*，须正式授权后写。OfficeComposer、底部工具栏/弹层、全局导航、vendor、其他页面样式、所有冻结 Phase6/8 源持续受保护。

## 恢复与审批操作约束

恢复点击由父组件持有 single-flight 和 scope(session/task/revision/requirements)→commandId。先 await 原 sessionNavigation.select(row.sessionId)，再验证选择仍有效且 hydrate 成功，重读 getXiaozhiTask。只有精确选中 Task/requirements/revision 和 main canResume 仍相符才调用一次原 resumeXiaozhiTask；双击复用 commandId，切会话/关闭/新选择使迟到结果失效。变化/未知结果先刷新核对，保留原 Task 与所有旧 Run/Artifact/Effect，无隐式重放或 Provider 切换。

Inbox 从原 ai_confirmation_items/权限领域读取跨会话持久索引。选一项才读单项安全详情，展示目的、资源、数据范围、有效期和拒绝后果。批准/拒绝仍走原 decideXiaozhiPermission，legacy copy 沿原 decide/resumeLegacy；范围和时限沿原合同，拒绝后不自动再申请。状态更新只接受同 session/id/revision 的返回，成功后刷新索引和当前选中会话，失败给原错误与重读入口。离开页面不把旧决定投影覆盖到新对象。

## 后续固定证据与停止点

core 先冻结该纯读 DTO/reader，证明 summary 请求不写 Sql、不读完整 projection/nativeJSONL、不 probe/install/guest，也不新建 Task/Run/Grant。合成 DB 的完成/中断/待审批/阻塞、多会话、corrupt/legacy 和分页 counts 对照原真源。组件专项只覆盖新入口与 fence。root 集成 build 后由独立 Terra 在同最终身份下验 W1~3/A1~2/C1~2/S1~2、两尺寸、键盘、刷新/重启、取消/错误/partial/retry、真实鼠标拖窗及流式/PTY原合同。Task 恢复恰一新 Run/Generation，已完成过滤、数量和权限/文件 readback 必须一致。

当前无页面 PASS。回滚只撤销新入口、三个组件与一个 read-only 接缝，原 Task/权限/技能/安装页保留，数据库无迁移。Gate6+Git 释放前不实施、不构建、不运行任何验收。

## 本次只读身份

全树 MCP 图当前 0 节点且 search_graph 返回未索引，因此使用已知文件的有界读取和字面量定位，未重复全仓索引。以下 SHA 是本次实际磁盘读回，后续以 Gate6 最终提交重新绑定。

| 文件 | SHA256 |
| --- | --- |
| docs/goal/xiaozhi-harness/PHASE_7_PAGE_CONTRACT.md | f9363ee7c58523477da78f6c7cef10ab51c5b0bfe843171e8bf661c19d578692 |
| docs/goal/xiaozhi-harness/ACCEPTANCE_MATRIX.json | 81fa350ab2b841d624bc75a250020dff76b51bc16d35134af6f179bfa7a0e96b |
| apps/desktop/src/renderer/components/office/PiWorkspaceShell.tsx | ee0f56ee6c667385fb65ce7080eac9856d5d15f590a64e592013adad380b3595 |
| apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx | 201f8cad75a4f25bc5a4ea6e947f80a091fd7d1f3edb96d1e9e6959b56154feb |
| apps/desktop/src/renderer/components/office/PiSettingsWorkspace.tsx | 52deb14f49d3abef991536cb62959e06aad87b9afc3b57c38badba87b6755250 |
| apps/desktop/src/renderer/components/office/PiPermissionApproval.tsx | 58853791b52220446ee27b81c07eb4c4d5f3fae58db1e9dafca1196bd40fa84f |
| apps/desktop/src/renderer/components/office/skills/SkillGovernancePanel.tsx | b89718d0f488f684d86cf1da8e10fd7ab1c6b63d5160f8c0d8f592099d910e79 |
| apps/desktop/src/main/xiaozhi-agent/capabilities/registry.ts | 10336b10036e42b48c2402b73a647f30a16e3b57b5753ae8ba1900a857f8ddb0 |
| apps/desktop/src/main/xiaozhi-agent/capabilities/acquisition/state.ts | 8a1259091fd2816f8aa5f72a5e5e40fb1e274398d867b20f70e1e53cb2cd83a5 |
| apps/desktop/src/preload/index.ts | dc6eb82b47486a07accf873339357cdec6692f4d17d6ff89458555081367b8c1 |
