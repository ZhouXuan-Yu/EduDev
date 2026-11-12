# Phase 0 Harness 源码基线审计

审计日期为 2026-11-12。角色为源码审计 Agent，按总控要求保持生产源码只读。本文供独立 Gate 0 审查与后续有限实施使用。

## 冻结与证据范围

- 最终冻结目录为 `D:/WorkProject/EduProject-harness`，分支 `codex/xiaozhi-harness-20261112`，冻结 SHA 为 `d50ef330f0f9c4995cc7e096e85bd8fd93629c83`。
- 初始源码读取与专项测试在 `D:/WorkProject/EduProject`，初始 HEAD 为 `e03e03c8d6ac85e43d24ee71bc59d96521e5faeb`，分支 `codex/ui-goal-implementation-20261101`，当时 ahead 44。存在另一个 UI 线程的暂存 CSS、报告和大量图证，另有未暂存 Anatomy 文档与科普说明，Harness 合同目录当时未跟踪。本 Agent 未编辑这些文件。
- 已用 Git 两提交差异核验迁移适用性。两个提交之间 `src/main/xiaozhi-agent` 仅 `ocr-host.ts` 增加 `rasterizeLocalMetafiles` 4 行及 `ocr-runtime-manifest.json` 更新。本文所列 Pi、Task、Event、Skill、MCP、Permission、typed preload、核心 Task shared contract、package/lockfile 无差异。全文行号均为这些无差异文件的行号。
- 新实施工作树第一次读取时仍显示大量文件删除状态，符合 checkout 未完成现场。审计未执行修复、reset 或 checkout。后续验证必须等待总控确认工作树实际展开完成。
- 已完整读取 Harness 00–13、EXECUTION_BOOK、ACCEPTANCE_CRITERIA、GOAL，以及根 AGENTS.md、CLAUDE.md。H01–H31 共同适用。最新总控传达的用户指令允许团队自行审查 Gate 后连续推进，覆盖旧文档的逐阶段等待产品负责人确认流程。
- Node 为 v24.12.0，npm 为 11.6.2。桌面项目使用 npm 与 `apps/desktop/package-lock.json`。
- 代码发现先用 codebase-memory。D 盘图为 ready、8475 nodes，own WIP 图 `D-WorkProject-EduProject-agent-stream-tools` 为 13779 nodes。图用于定位，最终实现逐一以生产文件与冻结 Git 差异核验。图调用链有同名方法误连，不能直接当运行路径证据。

## 生产调用链

```text
renderer 教师操作
  → preload/index.ts startXiaozhi / resumeXiaozhiTask
  → ipc.ts xiaozhi:start / tasks/api.ts xiaozhi:task-resume
  → createXiaozhiProductionHost.start / resumeTask
  → TaskCoordinator + EventPublisher + journal owner/generation
  → createPiXiaozhiSession
  → createAgentSession(tools allowlist, customTools dispatchers, noTools builtin)
  → dispatcher.execute
  → createToolExecutionBoundary.execute
  → beforeDelivery 主宿主 admission + journal.admitTool
  → 原领域 Tool.execute / MCP Tool.execute
  → result capture + Event Journal + Receipt + 原领域 Artifact readback
```

主要锚点如下。

| 文件与行号 | 符号或事实 |
|---|---|
| apps/desktop/src/preload/index.ts 248–254 | getXiaozhiTask、reviewXiaozhiTask、correctXiaozhiTask、resumeXiaozhiTask、startXiaozhi |
| apps/desktop/src/main/xiaozhi-agent/ipc.ts 49、97–98、131 | createXiaozhiProductionHost、registerMcpIpc、registerTaskIpc、xiaozhi:start |
| apps/desktop/src/main/xiaozhi-agent/tasks/api.ts 4–9 | 主窗口来源门禁后的 task snapshot/review/correct/resume |
| apps/desktop/src/main/xiaozhi-agent/production-host.ts 796、856–866 | 创建唯一 Pi Session，tool attempt 持久化 barrier，beforeDelivery 校验当前 active owner，journal.admitTool |
| apps/desktop/src/main/xiaozhi-agent/production-host.ts 1108 | resumeTask 使用 TaskCoordinator.prepareResume 后进入原 start 路径 |
| apps/desktop/src/main/xiaozhi-agent/pi-session.ts 216、260–280 | createPiXiaozhiSession、SessionManager create/open、原明确工具白名单 |
| apps/desktop/src/main/xiaozhi-agent/pi-session.ts 849–897 | taskEnvelope、education catalog、manifest、boundary、dispatchers、createAgentSession |
| apps/desktop/src/main/xiaozhi-agent/tools/execution-bound.ts 57–190 | createToolExecutionBoundary 输入快照和 schema 校验、callId 去重、owner/current fence、资源锁、超时、重试、结果上限、unknown effect |

现有 `dispatchers` 是对每个已经装配的 Tool 的执行包装。它尚未实现协议定义的稳定 Capability Dispatcher。现有 `education-tool-catalog.ts` 是按工具名和 BM25 查找/延迟展示 Schema 的进程内目录，不含 Capability Definition、Provider Binding、Conformance 或 SQLite Registry Revision。

## 锁定 Pi SDK 的真实 API

- `apps/desktop/package.json` 固定 `@earendil-works/pi-agent-core`、`pi-ai`、`pi-coding-agent`、`pi-tui` 为 1.0.2。lockfile 中 agent-core 从 1482 行、pi-ai 从 1495 行、pi-coding-agent 从 1532 行记录相同版本。安装包 `node_modules/@earendil-works/pi-coding-agent/package.json` 第 3 行也为 1.0.2。
- `dist/core/sdk.d.ts` 47 行存在 `customTools?: ToolDefinition[]`，107 行为 `createAgentSession`。`sdk.js` 298 行把 customTools 传入 Session。
- `dist/core/agent-session.d.ts` 412 行公开 `setActiveToolsByName(toolNames)`。`agent-session.js` 1084 行实现仅激活 registry 已存在且非 hidden 的工具，未知名称忽略，下一 Agent turn 生效。它不能证明可直接注册新 customTools。
- `agent-session.js` 174 行保存 `_customTools = config.customTools ?? []`。2772 行附近 `_refreshToolRegistry` 合并 Extension Runner 已注册工具和 `_customTools`。`_refreshToolRegistry` 为私有接口。
- `agent-session.d.ts` 739 行公开 `reload({ beforeSessionStart? })`。生产 loader 在 `pi-session.ts` 733–734 使用 `noExtensions:true` 与内置 `extensionFactories`。这不能成为任意第三方扩展进入主进程的授权。
- 建议 Phase 2 首选启动时注册有限稳定 Dispatcher，每次调用读取最新本地 Registry，安全点更新 Task/Run Snapshot。保持已存在明确业务 Tool。SDK 的既有激活 API可用于已有工具 loadout。新增任意工具定义的热注册没有足够当前生产 API/测试证据，避免调用私有字段。
- 同 Session 新 Provider 可由稳定 Dispatcher 路由，若确需换 Session，沿原 Task resume 和 SessionManager/session binding 接缝做安全重建，保持 Task ID。

## SQLite、Task、Event 与 Artifact 复用地图

| 权威模块 | 当前存储与约束 | 实施复用点 |
|---|---|---|
| tasks/task-state.ts 12–18、62 以后 | TaskDocument 存 app_settings，key 前缀 xiaozhi.task.v1，稳定 taskIdentityFor(session,message)。view revision、requirementsVersion、planRevision，lineage、admissions，immutable revision keys | 保留 Task 作为任务事实来源，扩展版本化字段。避免新建平行 Task 数据库 |
| shared/xiaozhi-task.ts 3、11、17 | Task state 为 active/review_required/paused/interrupted/completed/ended。Step state 为 pending/executing/waiting_dependency/needs_check/verified/needs_fix | 将新协议 status/phase 映射到已有模型，扩展明确而兼容的阶段与能力需求 |
| tasks/task-state.ts 45–57、69–115 | Admission 记录 run/generation/call/tool/step/planRevision/requirementsVersion/inputDigest/resource。跨 Run 同效果重复阻断，当前 owner 对照 event_owners 和 ai_agent_runs | Effect Intent 扩充应使用当前 admission/receipt，不丢失旧去重约束 |
| tasks/task-state.ts 239–275 附近 | settle/pause/resume，resume保留既有 admissions，旧检查改 unknown，新 run lineage，已终结任务不能普通续接 | H24/H25/H28/H09 fencing 现有接缝 |
| tasks/coordinator.ts 30–95 | checkpoint 通过 journal.changeTask 原子提交 Task 和 public task event，committed 对比 event hash 与 Task JSON | 检查点统一使用原 publisher/journal，避免平行事件源 |
| events/journal.ts 117–120 | xiaozhi_event_owners、xiaozhi_event_runs、xiaozhi_event_journal、xiaozhi_event_outbox | owner generation、revision、sequence、hash、outbox持久流 |
| events/journal.ts 124–184、237 | begin 增加 generation，assertOwned，bindNative，admitTool，reconcile，recover 把遗留运行转 interrupted | 用同一 owner fence 接入 Registry Snapshot/Effect metadata |
| events/receipts.ts 20–21、30–87 | xiaozhi_native_run_bindings、xiaozhi_tool_receipts。phase planned/admitted/settled，native matched/conflict，effect_state核对 | 增量补 Effect ID、provider/contract/version、grant、resource/idempotency等引用，旧行必须安全可读 |
| events/recovery-readback.ts 14–50 | 复用原 text changes / office artifacts 与磁盘核对，只覆盖 office_create_text/science_figure/edit_text/create_document | 扩展操作类型 readback/reconcile，未知外部效果保持 unknown，禁止自动重放 |
| session-state.ts 73–95 | xiaozhi_pi_session_bindings，schema_version 1–5，conversation与Pi JSONL文件绑定。init/migrate/recover 聚合既有领域 | 保持 SQLite任务事实、JSONL历史职责分离 |
| persistent-state.ts 37–51 | xiaozhi_pi_commands、xiaozhi_pi_workspaces、xiaozhi_pi_paper_outputs。审批存 ai_confirmation_items，action pi_office_copy，唯一session/run/call | 新权限/审批协议在已有存储边界兼容扩展 |
| goal-state.ts 13–32 | xiaozhi_pi_goals，revision CAS，启动 active/waiting_teacher变interrupted | 长目标复用，避免另一长期任务循环 |
| office-artifact-state.ts 21、57、79–90 | xiaozhi_pi_office_drafts、xiaozhi_pi_office_draft_sources、document_artifact_sources、document_artifact_paper_sources，CAS、独立成果/来源核验 | Artifact Snapshot引用现有ID/版本/哈希，正式产物继续保留教师确认 |
| text-change-state.ts 47–64 | xiaozhi_pi_text_changes | 文件修改和undo证据复用 |
| control-state.ts 24–46 | xiaozhi_pi_controls，state/payload CAS，pending等启动中断 | ask_teacher/instruction 继续原入口，勿误当持久安全 Grant |
| budget-state.ts 40–45，runtime-budget.ts 6–45 | xiaozhi_pi_budget_settings、xiaozhi_pi_usage，模型/工具/token/活跃/等待预算，limitsEnforced开关 | Acquisition/recovery 增量预算，当前宿主多处 limitsEnforced:false需明确启用策略 |

Task admissions 与 Tool Receipts 已提供执行前持久接缝，但字段不足以声明完整 Provider Effect Ledger。尤其 `exec_command` 在 `tasks/plan-runtime.ts` 111 附近只做 latest owner 校验即返回，未持久化任务级计划资源 admission。它仍经 journal.admitTool，不能说完全无日志，也不能声称已经满足 H26 的 provider/grant/effect全合同。

## Skill、MCP、Permission 与 Environment 复用

| 领域 | 现有能力 | 缺口 |
|---|---|---|
| Skill存储 | skill-catalog-state.ts 59 起建立 xiaozhi_pi_skill_catalog singleton revision CAS。PrivateManagedSkill为 builtin/teacher origin、整数version、immutable版本目录、files sha256 | 无 Personal/Team/Official治理、SemVer发布状态、单团队成员/管理员审批、可选旧版激活/撤回协议 |
| Skill包 | managed-skills.ts 22 noLinks、41 boundedRead、57 readPackage、164 writeVersion、186 mutate、198 commit、237 import、261 edit、275 archive、284 enabledResources | 无 Pi 自动 Draft→隐私/依赖/测试→Personal Publish闭环。现有手动import/edit不能当AI创建完成 |
| Skill Runtime | managed-skill-runtime.ts 16 capture、52 verifyDirectory、83 check、104 read tool。native-skill-epoch.ts 16/41 绑定内容权威与隔离旧历史 | 继续只读指令资源，外部scripts不能直接执行。Capability依赖引用与版本Snapshot待增量实现 |
| MCP | mcp-runtime.ts 16 key xiaozhi.mcp.v1 存app_settings，revision CAS。sealedSecret/sealedBearer走codec。stdio inheritEnv:false，有stderr和message上限。HTTP禁止redirect和不安全URL。每调用检查最新授权、Schema Hash、敏感输入脱敏、取消、bounded文本 | 无市场聚合、来源/许可证/包哈希审核、统一Provider Contract/Binding、行为Conformance。annotations判定只读有P0缺口 |
| Permission模式 | renderer permissionModes.ts四模式 request/acceptEdits/approveForMe/fullAccess 仅localStorage。PiEducationWorkspace.tsx 146–161在任何非request模式下自动批准已有pending copy approval | 无主进程持久Permission Profile→Scope Grant→Execution Check。不同非request模式在该路径行为相同。不能用UI文字声称已有完全授权策略 |
| 执行门禁 | Tool boundary、domain workspace authority、copy approval、source/CAS、MCP revoke检查、隐私sanitize都可复用 | 缺跨文件/命令/网络/依赖/MCP/extension/data egress统一授权、撤销与拒绝指纹 |
| Environment | managed-tools/service.ts有受审核JS版本、锁定哈希、原子active selection、queue、pin、rollback接缝。OCR manifest有版本与宿主协议 | 通用依赖诊断/来源检查/配置修复/Extension隔离仍待实施。不要直接复制整个终端或安装器作为可信系统 |

## P0/P1 风险

| ID | 等级 | 当前事实与影响 | 最小阶段归属 |
|---|---|---|---|
| F01 | P0 | tools/terminal.ts 31–50仅校验cwd在workspace，shell command本身可通过绝对路径、脚本或网络操作访问更大范围。beforeExecute为file-write-policy.ts默认开启的环境变量开关，缺宿主scope。pi-session.ts 790提示本机用户权限并可直接安装依赖。cwd约束不能实现A-P0-03/A-P0-08 | Phase3主进程scope与真实shell边界。已有授权不得凭空缩窄，应先落精确Grant并落实执行检查 |
| F02 | P0 | mcp-runtime.ts 160/167/211附近用annotations readOnlyHint与destructiveHint筛选可信任读工具，manifest.ts 26把host-provided MCP集合分类safe_read，继而走只读重试。恶意或错误声明可能执行副作用并被重试，A-P0-05未满足 | Phase2/3形成保守效果分类与验证，Phase5来源/隔离验证。hint保留信息作用 |
| F03 | P0合同缺口 | persistent-state.ts 53–62启动将pending/approved审批变interrupted。approval-coordinator.ts 76附近decide又要求活跃内存waiter。SQLite记录存在但无法跨重启继续等待，H29未满足 | Phase3审批存储与新admission绑定，Phase6启动恢复 |
| F04 | P0执行合同缺口 | receipts缺provider/version/contract/grant/idempotency资源元数据，exec绕过task step admission，RecoveryEffectReader覆盖有限。外部成功COMMIT前崩溃无法完整核对 | Phase2 snapshot先建立引用，Phase6增量Effect/核对，所有未知保持不可盲重试 |
| F05 | P1 | UI权限模式属于renderer本地偏好与自动approve控制，无主进程scope真源。默认request仍会暴露exec_command，不因UI请求批准自动具备命令审批 | Phase3保持现有名称并完成真实策略贯通 |
| F06 | P1 | 当前大多数生产limitsEnforced:false，安装/恢复循环预算尚未形成 | Phase3/5/6独立有界预算，避免新增无限获取或恢复循环 |
| F07 | P1 | Task/Session关系现有TaskView保存sessionId且当前latestTask按session索引。逻辑Pi重建可保conversation，但不能无证据宣称任意conversation迁移 | Phase2/6通过同Task新Run/Pi Session测试验明 |

这些是源代码审计发现，尚未进行恶意命令、真实数据外发、真实外部市场或付费Provider实验。当前风险必须修复并独立验收后才能作为最终产品安全通过。

## WIP 独立盘点

- WIP目录 `D:/WorkProject/EduProject-agent-stream-tools`，分支 `codex/hana-terminal-jobs-20261111`，HEAD `1945965c6ab36a4785b53f196b4a3048ec612b50`。17个已跟踪文件修改另有untracked模块。总控已说明备份在 `%TEMP%/xiaozhi-harness-pre-goal-wip`，本Agent未动备份或原工作树。
- package/lock新增 `node-pty` 1.1.0。terminal/包含 environment、event-adapter、host、ipc、pty-backend、pty-worker.cjs、session-manager、store、tools。新 tools 为 exec_command、write_stdin、list_terminals、close_terminal。原前台行为委托 terminal-foreground.ts。
- typed preload为src/preload/terminal.ts与index接入，renderer有office/terminal下控件，OfficeConversation/AgentPublicTool接入。源码层可见PTY后台跨turn、owned session校验、应用退出dispose、重启running变cancelled/app_restart、有界脱敏输出和原子JSON快照。
- store.ts把作业状态存本机JSON，引用session/workspace。它尚未是Harness SQLite Task/Run/Effect事实源。host.ts有5秒owner/workspace sweep，write_stdin可改变进程状态，需统一Grant与effect/当前generation生命周期。
- 总控传达历史真实PTY7项、原终端8项通过，build存在React ref/window.omniEdu optional类型错误。本轮未重跑WIP测试与构建，历史结论保持未验证。`docs/goal/HANA_TERMINAL_QUALITY.md`当时进度仍写T1/T2待实现、Q1待测量，不能视作文档验收齐全。
- 本轮用户已授权最多200次真实模型请求，继续适用于同一Harness实施与合成任务对照；总控维护全局账本，Phase0已用0。可复用之前必须单独收敛变更、修类型、确认许可证/包体/Windows Electron ABI、接权限和SQLite Effect，再做真实UI与冷恢复验收。

## 实际测试与边界

| 命令 | 实际结果 | 证据/边界 |
|---|---|---|
| node scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs | PASS 20/20 | D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/pi-task-plan-boundaries-vzPgKB/report.json。生产Task/Journal/Boundary与合成SQLite/文件，写Tool为declared fixture |
| node scripts/xiaozhi-agent/pi-mcp-boundaries.mjs | PASS 28/28 | D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/pi-mcp-boundaries-jfEYaM/report.json。真实loopback HTTP/stdio合成MCP，owned SQLite。无公网Provider验收 |
| npx tsc --noEmit | PASS exit0 | cwd D:/WorkProject/EduProject/apps/desktop，无诊断输出。源码链与冻结SHA差异已说明 |
| git diff --check | PASS exit0 | 审计时D盘工作树，无输出 |
| build、renderer组件全套、Electron、打包、全量迁移、真实权限越界、当前WIP构建 | NOT_TESTED | Phase0本轮没有声称这些通过。build会同步Pi package capabilities并构建产物，应在已就绪隔离实施工作树执行 |

审计没有生产变更，性能前后比较不适用。专项测试创建了各自test-results合成证据目录，没有读取或写入真实教师资料根。回滚仅需放弃本文审计产物，无应用数据迁移。

## 逐 Phase 缺口与依赖顺序

| Phase | 下一步可核验结果 | 依赖和保护 |
|---|---|---|
| 1 | Capability/Provider/Binding/Conformance/Resolution schema，本地SQLite registry，一个既有低风险只读Native能力试点，两Provider硬过滤 | 推荐office_file_stat既有实现作为首试点，避免真实教师资料。第二Provider可用明确测试适配器验证多实现协议。复用TypeBox/Ajv现有库。Required缺失不能评分放行 |
| 2 | 统一Provider结果/错误/取消与稳定Dispatcher，Task/Run Snapshot，safe-point刷新/撤销 | 所有调用进入原boundary，核心业务明确Tool保留。先建立provider引用和保守effect分类，禁止因新Dispatcher绕过F01/F02 |
| 3 | 主进程Permission Profile/Scope Grant/Execution Check，现有模式真实映射，跨重启Approval requestDigest、撤销与拒绝记录 | 优先修F01/F02/F03/F05。新审批兼容旧pi_office_copy记录，旧已完成/uncertain不复活。renderer只发用户意图 |
| 4 | AI个人说明Skill Draft验证发布、不可变版本/激活回滚、Team单团队及管理员审批、Official审核协议 | 在原catalog/managed runtime增量扩展，不把Skill正文复制进Registry，Skill不得制造Grant |
| 5 | 多来源市场候选、来源/许可/哈希/依赖/权限/隔离验证，MCP Adapter，受控Extension/Environment | 先核实当前外部目录API和条款。无可用凭据应保留明确等待入口。核心教育能力离线独立可用 |
| 6 | 原Task/Journal/Receipt扩充Effect，启动只读诊断和恢复列表，点击新Run/generation，兼容Provider重选，审批续接 | 完整崩溃四切点、旧generation延迟回调、unknown外部效果和多任务隔离。H30允许只读自动诊断，H31拒绝后寻找替代并保留拒绝指纹 |
| 7 | 全P0/P1和实际页面、build/lint/迁移/IPC/领域回归/Windows打包验收 | 独立Terra High真实界面与最终验收，所有NOT_TESTED必须逐项处理，F01–F04关闭前不得宣称最终安全通过 |

固定执行顺序为 Phase1→2→3→4→5→6→7。Effect字段和权限模型设计应提前纳入Phase1/2接口，但写入落地保持任务书阶段串行。同生产文件、迁移、权限和Task State写入由总控分配唯一所有者。

## Gate 0 建议

建议独立审查 Agent 将源码审计评为可接受并允许进入 Phase1。理由为合同已读取、冻结SHA已定位、调用链与SDK公开API已有精确证据、复用状态机明确、历史WIP隔离、关键风险已列入后续阶段，专项与类型基线已真实执行。

该建议只表示审计足以指导实施。Gate0独立审查仍需确认冻结工作树checkout完成、审查本文证据、明确接受F01–F04作为必须修复的阶段任务。Phase1不得借审计通过宣称整体Harness或安全验收通过。本Agent不自行开始实现。
