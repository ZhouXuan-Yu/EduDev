# Phase6 实施草案

**DRAFT / NOT_RUN，2026-11-17。** 审计快照为 `ffb6c907af1644cade65e917144a2be9a1b1d6d5`，通过 `git show` 读取。本文冻结候选合同，Phase5 正在实施，Effect/lease/transport 接口须在 Gate5 后按实际源码对齐。本轮运行/构建/模型调用0。

依据06–09协议、执行书T6.1–T6.6及终端只读交接。图谱未索引，采用`git show`。源码路径相对`apps/desktop/src/main/xiaozhi-agent/`。

## 教师结果与实施顺序

教师重开后看见进度、成果、待批与待核操作，点击继续沿同Task启动新Run。后台作业跨回答受监管，可查看输出、输入和结束。

依次贯通原Task/Journal → Effect/Checkpoint → 恢复/继续 → 审批/Provider/规划 → 同helper长期作业 → typed UI。Pi承载唯一模型循环，SQLite/本地文件保存事实，JSONL关联对话。

## 冻结源码事实与缺口

| 领域与源码 | 已有真实事实 | Phase6 补齐 |
| --- | --- | --- |
| `tasks/task-state.ts` | SQLite `app_settings.value_json`保存`xiaozhi.task.v1:<taskId>`、`:revision:<n>`及session/goal索引。Document含view/retiredIds/lineage/admissions/eventOwner。Task ID为logical conversationId+原messageId的hash。旧raw CAS与revision历史同事务 | 原Document版本化演进。Task保持ID，logical conversation稳定，Pi Session可换session_file |
| `tasks/coordinator.ts`、`events/{journal,publisher}.ts` | `xiaozhi_event_owners`每logical session单owner；`xiaozhi_event_runs`保存run/generation/revision/sequence/status/turn。`begin`递增generation。Task.binding与lineage核验同owner。`changeTask`把Task事实、公开task event、Journal/outbox放同SQLite事务 | Checkpoint复用该提交边界，旧owner/generation/revision拒写，Task进度与公开恢复卡保持一致 |
| `goal-state.ts` | `xiaozhi_pi_goals`保存goal revision/state/payload，更新CAS同时比conversation/revision/state；`tasks/goal-binding.ts`关联既有Task | 保留原目标与requirementsVersion、教师验收标准和证据，恢复沿绑定Task继续 |
| `events/receipts.ts` | `xiaozhi_tool_receipts`主键run/call，含generation、tool、start_sequence、planned/admitted/settled、result/native digest、effect_state。`xiaozhi_native_run_bindings`绑定JSONL marker/anchor。reconcile输出automaticReplay=false | 补齐执行前Effect身份/目标/幂等键、状态与结果引用，覆盖文件、外部调用和长期Job |
| `events/recovery-readback.ts`、`verification/effect-readback.ts` | 回读白名单为create/edit text、science figure、create document。核原SQLite台账、workspace授权、磁盘bytes/hash/version、Office parent Artifact和来源。Native success仅用于关联 | 扩展按操作注册的readback，持久记录unknown与核对证据，覆盖动态Provider及后台提交 |
| `text-change-state.ts`、`office-artifact-state.ts` | `xiaozhi_pi_text_changes`与`xiaozhi_pi_office_drafts`均按conversation/run/call唯一，state+revision CAS，存hash、来源、staging。Office连接`document_artifacts`。recover将executing/committing归uncertain | 复用已确认台账及owned staging，Effect引用真实版本，文件冲突保留旧成果 |
| `session-state.ts`、`persistent-state.ts` | 同一原Sql经serializeStateWrites组装各state；SQLite `xiaozhi_pi_session_bindings`保存native session_file/model/schema，recover串行恢复各领域。`db.ts:1337`调用此recover | 固定恢复顺序与诊断预算，支持旧JSONL差异、损坏及只读来源核验 |
| `permissions/{store,engine,validation}.ts` | profile/grant/audit在原SQLite。审批在`ai_confirmation_items`，action_type=`xiaozhi_permission_v2`，payload CAS。requestDigest含session/task/requirements/action/input/scopes/files/provider/classification。executing冷启转uncertain；pending/approved保留 | 新Run准入复核原批准摘要与当前授权，拒绝后记录替代策略，长期Job监管覆盖真实寿命 |
| `capabilities/provider-snapshots.ts` | `xiaozhi_capability_snapshots_v1`存task/session/run/generation、selection/contract、providerHash、Registry revision及前snapshot。保存验证当前Task与Registry事实 | 安全点记录切换原因与剩余任务需求；执行时实时核撤销/权限 |

静态恢复接缝必须优先复验。`events/journal.ts recover`将旧Run置interrupted后把owner.generation+1、run_id置空；`tasks/coordinator.ts recover`读取当前owner查询旧Run，找不到即return，Task可能保留active。`shared/xiaozhi-task.ts taskHasRemainingSteps`排除active。Phase6应依据已提交Task.lineage/eventOwner与旧Run建立受限恢复CAS，完成interrupted Task checkpoint，同时保持旧Run失效。此项为源码推导，实际crash场景为NOT_RUN。

## Effect Intent → Executing → Commit / Reconcile

候选在原SQLite增加Effect附属记录或版本化扩展receipt，表/字段待Gate5对齐。原Task Document保存计划/步骤，Effect引用taskId。记录含schema/effectId、session/task、origin run/generation、step/plan/requirements revision、callId、Capability/Provider版本/hash/Contract与Snapshot、operation/目标/版本/inputDigest、Grant refs/revision、幂等键、state/revision及result/Artifact/Receipt/核对摘要。秘密及正文沿原本地权限保存。

1. **Intent**。原Task/Execution Boundary与权限预检通过后，冻结输入并持久化Intent及关联admission。提交成功才可调用provider/helper。相同幂等键+相同digest返回已有事实，内容变化拒绝。当前permission audit的execution_intent与receipt.admitted继续关联完整Effect。
2. **Executing**。持久化真实execution/lease ID、开始、预算、取消/timeout与外部回执引用。启动失败可据明确未送达证据记failed。transport断链或执行中退出保留unknown。
3. **Commit**。操作结果经独立readback匹配，沿原SQLite事务提交Effect结果、Artifact引用与Step核验/Checkpoint。文件提交走原owned staging、Grant、source version与CAS。Journal发送失败仍可从outbox重读。
4. **Reconcile**。崩溃或COMMIT不确定时，先查真实状态。文件核目标hash/version、staging marker及原台账；安装查版本/锁；Skill查不可变目录与publication；外部发送查服务回执/幂等键。证据不足记unknown并显示“需要核对”。删除核实际目标，补偿单独留compensated事实。只读查询按成本/时效重查。

Effect白名单状态为intent、executing、committed、failed、unknown、reconciled、compensated，状态转换、写入owner和预期revision由main限定。恢复核对旧Effect可用新的reconciliation owner记录核验，原执行owner保持历史。Step verified依赖核对结果。SQLite/文件/远程副作用各自核验提交。

## Checkpoint、启动与继续

- Task checkpoint记录原目标引用、Task/plan/requirements revision、steps/checks、已核事实、Effect/Artifact/Snapshot/审批引用、剩余预算和恢复原因。普通流式event沿原Journal批处理。触发点为任务/计划、阶段、Provider切换、审批、成果保存、暂停/中断/恢复与交付。候选附属checkpoint以Task revision及Journal cursor关联，派生摘要可重建。
- 启动顺序为schema/旧数据适配 → 原Run终结与generation fence → Task受限恢复checkpoint → 未完成Effect只读核对 → Provider/授权/审批/Artifact诊断 → main Presentation State。启动允许持久恢复状态/审计，业务诊断限白名单文件存在/hash/已装版本/本地Registry。安装、网络写入和任务执行由显式动作触发。
- 点击继续走原`production-host.resumeTask → host.start → tasks.resume`。UI防重与commandId去重保持同Task，新Run/generation，加载可靠checkpoint，核对未完Effect、原Provider和审批后补剩余步骤。Task.resume已有checks→unknown及lineage追加语义应保留，重新独立读回再解锁依赖。
- 恢复上下文包含教师原目标、计划revision、已完成/未完成、Artifact/hash、Effect状态、Capability/Provider、权限/待批及剩余预算。SQLite优先，JSONL缺失/分支/压缩与session identity变化提供可诊断差异。恢复预算覆盖尝试数、总耗时、provider重试和副作用，耗尽后保存阻塞。

## Provider、审批与复杂度规划

先核旧Provider来源/version/hash、health、Contract/Conformance、撤销和Grant。不合格时Resolver按剩余任务Required/Optional/Conditional重新解析，Required缺失保持阻塞，Optional缺口披露。写Effect执行中保持原Provider，完成或reconcile后才切换，保存新Snapshot与原因。Pi API以锁定版本能力为准，必要时安全点重建native Session并保留同Task。

pending审批跨重启保留。批准消费前重核requestDigest、目标/源hash、Provider安全属性、权限范围/revision、有效期、Task/requirements，改变则invalidated。原operation审批consume绑定新的admittedOwner，旧Run回调拒绝。rejected按相同Task+语义摘要抑制重复申请，尝试已有Grant、兼容Provider、可完成步骤或本地配置修复，说明剩余阻塞。

复用`tasks/plan-runtime.ts update_task_plan`及原Pi调度。当前safe_read可直行，exec_command/environment_repair/skill_create/可信MCP为辅助准入。Phase6补Level1/2/3持久复杂度理由与相应能力/依赖/风险/恢复点预检，辅助副作用同样进Effect。Level1保留短路径，Level2表达依赖，Level3冻结成果和恢复点。模型reported仅为报告，实际checks解锁步骤，教师要求保持版本追溯。

## 持久 PTY / stdin / background

旧WIP `terminal/{session-manager,pty-backend,tools,host,store,event-adapter}`、preload/renderer择取复用，修复已知refs/bridge类型错误。manager JSON缓存输出游标/展示。原SQLite Job附属记录保存job/Task、origin Run/generation、controller owner/lease revision、call/effect/execution/helper、runtime/hash、Grant/expiry、workspace/projection、input/output sequence+ack、预算及terminal/cleanup。PID核对结合helper身份、创建证据及owned路径。

`PermissionEngine.run`当前finally移除active并清expiry；后台Tool提前返回会结束监管。Phase6须让main supervisor持有同helper长期lease到terminal result及cleanup完成，撤销/到期/父退出/停止仍可中止Job。跨回答允许受控Job继续，旧Run仅保留原归属，输入、resize和接管由新Task owner经CAS授权。Task完成前明确处理仍活跃Job。

共享transport候选至少含version/mode、executionId/leaseId、带序号bytes/ack、有界input/output/backpressure、resize、input-close、cancel、terminal-result、cleanup ack。MCP保留stdout/stderr分流，PTY传VT流。write_stdin每次输入重核当前owner/Grant并记Effect，ack无法确认时核对输入序号及作业状态。Ctrl+C、EOF、关闭输入和强制Job结束各有显式语义。输出持续drain，限额/脱敏/游标重读及重复close幂等。

后台写入先位于owned Low投影，停止/静止后经原Grant+CAS提交到正式文件，记录Artifact与Effect。启动只读恢复Job历史并清理已证明owned残留，原命令和stdin仅在显式继续且安全核对后提交新的执行。

已读TEMP `xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c/REPORT.md`及归档报告。v4 source/exe hash依次为`e7114e41b1ff79ce33101c28e9e5d2f2d45de6bcfeaaf6a5a4c94dcd6bd29a93`、`341a0af7d189d75c9f12928117638db5dd84e1696f7592ea0bb68b2d26a90c35`。历史两case通过本机受控ConPTY的Read-Host/resize/exit/cancel。产品lease/Ctrl+C/Node/Python/背压/Task/UI仍待测，原失败及Phase3接受证据保留。

## 迁移、UI与回滚

schema增量幂等，复用原SQLite事务/CAS/Journal队列。旧Task严格schema分支迁移，保留旧revision、teacher checks、Goal绑定、receipt/native marker、Skill/Provider Snapshot及Artifact。旧收据缺fullIntent时按可证明readback归类，缺证据保留unknown。旧manager running缓存冷启投影为中断，SQLite Job关联证据经显式校验后建立。迁移分别在全新库及旧库副本验证，真实用户文件保持可核版本。

UI沿原Task恢复卡/审批Inbox/工具卡/作业列表接typed IPC。main投影可继续、等待授权、正在核对、能力暂不可用、部分完成、已完成、需要处理。输入传task/job、expected revision/commandId及用户内容。补loading/empty/error/retry、expired/rejected/stale owner、unknown/背压/重读/close反馈。两尺寸、键盘与异步切会话贯通实际main，完整视觉由Phase7接受。

回滚先关闭应用并备份原SQLite、JSONL、managed资源、owned作业记录及Artifact证据。恢复已接受Gate5生产接线，保留Phase6新增附属事实/不可变文件/旧schema，停止已登记Job并核cleanup。迁移失败保持原Task与成果版本，可读诊断；禁止通过删除台账消除unknown。

## Gate6 必需验收候选

以下均 **NOT_RUN**。原API/SQLite专项后验真实Pi+Electron用户路径，记录DB/文件hash、owner/generation、命令/日志、失败及owned库存，使用隔离合成目录。

| 集合 | 必要真实场景与完成条件 |
| --- | --- |
| T-01–04/12–14 | 教师实际生成成果后强停/重开，恢复卡准确；启动零业务执行；点击一次仅一个新Run、同Task、新generation，可重建Pi Session；两Task上下文/权限隔离；JSONL缺失或差异以SQLite诊断 |
| T-05–07/13 | Intent后、Executing中、文件/外部已成功而Commit前、Commit后四崩溃点，各重开两次；成果hash/readback与Effect一致；外部loopback幂等回执/timeout断链保持可核unknown；副作用计数不重复 |
| T-08–11 | 旧Provider有效/撤销/版本变化及写Effect中切换；Required缺失披露；pending审批重开可见；源/目标/provider/Grant/requirements变化失效；拒绝后相同请求不循环，兼容替代继续 |
| H-16与fencing | 简单查询短路径、多工具依赖/复杂能力预检、真实失败后改计划；模型reported完成仍需readback；旧Run在新generation后迟到Task/Effect/Artifact/Job写入全部拒绝；CAS竞争与checkpoint/outbox失败可恢复 |
| PTY/后台 | 原Pi工具启动同受控helper，Read-Host、变量/cwd、多次stdin、Ctrl+C后shell可继续、ANSI/Unicode、resize；Tool返回后Job继续且可重读；stdin重复/未知ack、flow control、自然非0退出、timeout、重复close、父退出/断链保持terminal+cleanup库存一致 |
| Grant/资源/兼容UI | 活跃Job撤销/到期/换workspace即收束；新Run接管拒旧输入；CPU/内存/process/input/output预算沿Gate5实际接口；旧前台及旧库不回归；1366×768/1920×1080实际输入/停止/审批/恢复，冷启零自动重放 |

Gate5后对齐接口并转正式合同，独立Gate6按T-01–T-14/H-16验收。
