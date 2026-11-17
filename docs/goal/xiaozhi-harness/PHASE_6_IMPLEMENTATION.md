# Phase6 正式实施合同

2026-11-17。状态为RELEASED / IMPLEMENTATION_IN_PROGRESS，所有本阶段验收初始NOT_RUN。基线0f753e572cbdfa20eaaf130a0f7b23d32e8ac2b8，Gate5独立150项及主线整合482项已通过并正常推送main和专项分支。原89条固定标准保持，Phase6按既有T-01至T-14、H-16及终端要求实施。

## 教师可见的最终结果

- 同一个受控终端持续保存变量与cwd，支持真实stdin、多次交互、ANSI/Unicode、resize、Ctrl+C后继续、EOF与明确结束。
- 前台等待结束后，原后台Job继续受监管，老师可读取输出、输入和停止。回答结束后的直接终端操作无需新的模型请求。
- 下一轮明确操作既有终端时沿原Task/Job正确续接。两个会话、两个Task的输入与授权保持各自归属。
- Task、完整Effect和Checkpoint持久化于原SQLite，应用重开只恢复事实与诊断。老师点击继续后，同Task以新Run恢复剩余步骤，已有成果可独立核对。
- Provider安全点刷新、持久审批、拒绝后的可行替代和Level1/2/3规划实际工作。简单任务保留短路径，复杂任务记录依赖、成果与恢复点。
- 原前台exec_command及已有教学业务兼容。复用旧终端WIP的管理、输出游标与xterm界面，执行接入当前受控helper。

## 固定边界及写入顺序

Pi SDK1.0.2为唯一Agent Loop。原Task/Journal/Permission、SQLite和本地文件继续作为事实源。新增Effect/Job为原Sql的附属事实，旧JSON仅承载可重建展示缓存。主core先冻结共享DTO及注入接口，然后root分派ConPTY和终端UI叶域并行实施。NativeSandbox、launcher、runtime、build、package、preload与Host薄接线继续主core独占。正式需求及验收以本合同、06至09协议、EXECUTION_BOOK和原ACCEPTANCE_CRITERIA共同约束。

阶段测试集中执行固定用户路径和失败反例，保留原FAIL。通过后完成独立阶段核对、正常模块Git整合，进入Phase7 Terra页面验收。全部Phase0至8及89项要求完成后停止。本模块功能按既定合同全部完成，修复重复无进展时更换方法。

## 1. 主core先贯通的SQLite边界

复用原Sql/serializeStateWrites和Task Document/revision历史。Task ID、Goal绑定、lineage、admissions、teacher checks和requirementsVersion继续由tasks/task-state持有。建议TaskDocument增加版本化checkpoint字段，checkpoint内容为原Task/plan/requirements revision、Journal cursor、Effect/Artifact/Snapshot/审批引用、剩余预算和原因；现存旧版本字段分支先迁移再校验。通过原publisher.checkpointTask→journal.changeTask同事务提交Task、公开task event与outbox。普通流式文字沿原Journal批处理。

建议Effect为原Sql附属表xiaozhi_effects_v1，外键关联现有run/call receipt，保存effectId/revision、原ToolContractReceipt整体、origin session/run/generation、操作/目标版本/幂等键/inputDigest、真实execution/lease/Job、state、结果/Artifact/核对证据引用。唯一幂等键按Task+operation+logical target+requirements绑定，相同键不同digest拒绝。多次合法stdin使用独立commandId生成各自Effect。复用现contract_json的capability/provider/version/hash/source/schema/contract/snapshot/Registry、Task/step/plan/requirements、target/inputDigest、effect/classification/scopePolicy、grantRefs和authorityRefs，提交时按实际内层authority补齐。

Intent与原admission先提交才允许dispatch。Executing绑定真实executionId。Commit依据操作专属readback，连同receipt结果、Task check及checkpoint同事务提交。unknown/reconciled/compensated保留原历史；外部成功/输入已送但ACK丢失都先核对。旧receipt可读，缺完整Intent按原readback及unknown投影。沿H23统一入口覆盖原core与dynamic Provider，继续捕获Dispatcher实际teacher-private结果和历史拒绝来源。

建议Job为原Sql附属表xiaozhi_jobs_v1，jobId可沿旧term_UUID以减少展示adapter。保存Task/origin Run/generation/call/effect、execution/helper/runtime hash、Grant refs/expiry、owned projection、controller与lease revision、预算、输入sent/ack序号、输出cursor及terminal/cleanup。每次输入的digest、序号和ACK放对应Effect事实中，避免另设输入权威。原session-manager/store JSON作为有界展示缓存，原SQLite及owned输出文件保存可重读事实。

## 2. lease / controller / 恢复顺序

Phase5 openPermissionLease已复用Engine.run，500ms核assert，close等待lifetime及在途inspection。它的assert仍要求原Run current。publisher.persist/checkpointTask在sealed后拒写。两处都需要core明确扩展。

主core提供main-private openJobLease(request, jobIdentity)并复用原authorize/evaluate/approval消费、Grant expiry/revoke审计及active库存。运行期current仅允许经过原Task准入、已持久化的精确Job/lease代际证明。该证明只授权同一已启动Job的持续运行、输出和清理。普通Tool仍走原Run current判定。原Run自然回答结束后，Job lifetime由main supervisor持有，持续到真实terminal+helper close+cleanup；原Task取消、Grant撤销/到期、workspace/包身份变化与应用退出终止Job。close允许精确清理已撤销资源。

origin owner保留历史。Job运行期authority与教师、Agent控制者分别保存。教师在模型回答结束后可直接输入、resize、EOF或停止，main派生同会话、同Task/Job的精确教师commandId与controller lease，沿原授权与Effect记录执行，模型HTTP请求数保持不增加。Agent在下一轮明确操作原终端时，沿原Task/Job续接及新Run controller接管。旧Agent回调失效，跨Task/会话仍拒绝。控制者通过独立CAS保存controllerRevision与leaseRevision。输出cursor推进不递增输入CAS使用的业务revision。每次stdin按controller/lease及commandId/sequence核对，先持久化Intent再发送，真实ACK后记录ack。同commandId同digest返回原事实，未知ACK先核对。输入按块ACK及有界背压，Ctrl+C保持有序及时。后台输出及terminal提交走原Sql的Job级CAS，避免保存sealed publisher闭包。交互期间使用已获授权的准确Scope，发生实际权限变化时走原审批。

启动顺序建议冻结为schema/旧数据迁移 → 找出旧Run与Task.lineage/eventOwner对应关系 → 原journal终结旧Run并失效generation → 受限恢复CAS把其Task active转interrupted/可继续checkpoint → 未完成Effect与Job只读核对 → Provider/Grant/审批/Artifact白名单诊断 → Presentation State。恢复CAS仅接受原Task revision、已提交lineage与原Run终态，原Run不恢复写权。当前journal清owner后coordinator按空run_id查不到旧Run的接缝先做真实crash反例再修。

启动保留待批与unknown，不启动命令或重发stdin。点击继续经原resumeTask/start/tasks.resume，同Task新Run/generation加载checkpoint并核对Effect、审批、Provider及预算。Provider切换复用原Snapshot/Resolver安全点，写Effect执行中先完成或核对。拒绝摘要抑制沿原审批机制，再选择兼容Provider、已有Grant或可完成步骤。Level1/2/3理由、依赖、能力与风险预检进入原计划/Task，不增加模型Loop。

## 3. 共享terminal DTO建议

保留现XiaozhiTerminalOutput的version1字段与前台exec_command返回。新的Job envelope与动作类型供UI/WIP adapter消费。owner、Grant、运行路径、秘密均不从renderer输入。下面的TerminalResult及TaskOwner引用原类型。

共享DTO的单一事实来源为 `apps/desktop/src/shared/xiaozhi-terminal-jobs.ts`。Result为 `{ok:true,data:T}` 或 `{ok:false,error:TerminalError}`。JobView显式提供business、controller、lease三种revision及独立outputSequence。控制命令包含三种expected revision和xicmd_UUID commandId。list/read/write及event精确字段直接复用该源类型，renderer依据main的controls和typed错误反馈操作。

typed preload沿旧WIP命名接listXiaozhiTerminals(sessionId)、readXiaozhiTerminal({sessionId,jobId,sinceSequence})、writeXiaozhiTerminal(TerminalWrite)、resizeXiaozhiTerminal(TerminalResize)、closeInputXiaozhiTerminal(TerminalJobRef)、closeXiaozhiTerminal(TerminalJobRef)、takeControlXiaozhiTerminal(TerminalJobRef)、onXiaozhiTerminal({sessionId,job})。read返回TerminalRead，write返回{job,ack}，其余控制返回JobView，统一typed TerminalResult。旧terminalId/sinceSequence输入由core adapter映射，禁止renderer自授Scope。get/read保持只读，mutation按main controls及精确CAS校验。

Ctrl+C发送原stdin ETX，Windows typed EOF发送Ctrl+Z+Enter，physical closeInput关闭输入管道并保留实际hangup退出码，close终止Job并等待cleanup。各命令分别记录Effect。工具yield_time_ms只是前台等待预算。Run activeMs、单次input ACK deadline、Job lease/expiry与OS预算各自计时，正常多步交互按已授权Job寿命运行。view投影可用动作与明确错误，UI不自行推导权力。

## 4. ConPTY leaf的精确输入/输出及core薄接线

复用旧D:/WorkProject/EduProject-agent-stream-tools的manager游标/reset、32KiB展示/64段history、异步flush、自然退出ending-once/flush/exit语义，以及tools/host/event-adapter与renderer。执行backend替换为同helper受控路径，旧pty.spawn/taskkill实现留在旧树。ConPTY互操作优先复用已归档v4兼容探针，当前产品接线仍NOT_RUN。

建议leaf仅新增permissions/windows/ConPtyNative.cs、ConPtySession.cs及terminal/controlled-backend.ts和专属测试。ConPtyNative独立static类，避免更改现Native类。ConPtySession提供Create(cols,rows,onBytes,onFailure)、Handle、WriteInput(byte[])、Resize(cols,rows)、CloseInput()、Close()/Dispose()。它持有HPCON/pipe/read-drain线程，UTF8 VT输出持续drain，关闭幂等且保留真实HRESULT。原SessionInput独立writer/input队列与input_ack由core复用，PTY writer调用WriteInput。

core先发布launcher additive接口给TS leaf。现SandboxInput.write(Buffer):Promise<void>/close()保持stdio兼容，新增main-only writeSequenced({sequence,bytes}):Promise<{sequence}>、resize({controlId,cols,rows}):Promise<void>。sequence由core先登记Intent，再提交launcher，ACK只证明helper已写入pipe。runNativeSandbox继续等待child close和result.cleanup，leaf不得用result帧提前释放lease。

TS后端注入的单一事实来源为 `apps/desktop/src/main/xiaozhi-agent/terminal/controlled-types.ts`。leaf实现createControlledTerminalBackend，core注入已准入launch及AbortController。ready等待真实started，write/resize等待精确ACK，closed等待真实child close及result.cleanup。authority、Job事实与Effect由core持有。

createControlledTerminalBackend由core注入一次已准入launch回调及AbortController，回调形状沿runNativeSandbox的onStarted/onBytes/onSession；leaf仅转换handle和VT数据。Scope、JobStore、controller、Effect、projection/提交和cleanup authority归core，leaf收不到renderer目录或数据库。

wire建议保留schemaVersion1及sessionProtocolVersion1的stdio字节，另加manifest.ptyProtocolVersion1。session.mode新增pty分支及cols/rows，output.stream新增仅PTY可用的pty；resize/resize_ack以controlId关联独立于stdin sequence。core同步exact validators。输入仍每帧16KiB、最多4待ACK，完整预算沿SessionOptions/JobLimits。PTY branch采用已验证的security capabilities+pseudoconsole组合，suspended→同JobLimits→token核对→resume。core持有NativeSandbox/SessionOptions/SessionInput/launcher/runtime与build源清单，leaf交付后才由core接StartupInfo/HANDLE/flag和cleanup薄分支。编译recipe与source hash必须一起更新。

## 5. 写入分工与集中验收

主core独占tasks/events/permissions/job store/supervisor、共享DTO、terminal tools/host/IPC、preload、production-host/pi-session、NativeSandbox/SessionOptions/SessionInput/launcher/runtime/build/config/package/lock。UI leaf仅写renderer/components/office/terminal/**及紧邻样式、专项，OfficeConversation与AgentPublicTool终端入口需root明确窄授权。依赖由core统一锁定xterm/fit版本、许可、体积和Windows打包，旧WIP的node-pty API作为历史参考。

顺序为core恢复fence+Effect/Checkpoint/Job+DTO和注入签名冻结 → ConPTY/UI leaf并行 → core接同helper/权限/原Pi工具 → 原固定T6.1–T6.6、T-01–T-14/H-16、PTY后台与迁移/UI集中验证 → freeze交独立Gate6。既有要求覆盖Intent/Executing/外部成功Commit前/Commit后四crash点、旧generation迟到、重复输入/未知ACK、背压取消、自然非0退出、Grant撤销/expiry、冷启零重放和两尺寸。新增Run控制和长期Job事实同原Task/Sql体系，恢复与后台监督均由main原领域服务承担。

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

Gate5接口已对齐，按本正式合同及T-01至T-14/H-16验收。

## 实施记录 2026-11-18

当前为实施中。以下为各自限定范围的真实结果，完整Gate6仍待最终源码与输出冻结后的独立验收。

- 原Journal启动恢复的Task active遗留已先复现，再在原事务补Task恢复。初次失败保留于TEMP/xiaozhi-phase6-startup-recovery-ygRgLn，修复后两次冷开2/2通过。原Task coordinator16/16、Journal23/23通过。新增Effect附属Sql、immutable Task checkpoint及原outbox事务的state leaf8/8通过，报告TEMP/xiaozhi-phase6-state-dcaa9y/report.json。首次4/8为测试行原型比较错误，GnI46J原报告保留。
- ConPTY leaf三源及同helper薄接线完成，真实固定9/9通过于TEMP/xiaozhi-phase6-conpty-native-7JWAoT/evidence/report.json，协议12/12通过于UKKUkO。原4/9、8/9及cwd/Ctrl+C失败全部保留。正常产品启动使用UTF-8和shell局部PSDrive核对实际owned cwd，PTY helper继承原控制信号语义。typed EOF与物理关闭输入分别记录。已知14个helper/shell PID终态库存为空，独立ConHost PID未采集。
- terminal共享DTO、typed preload、main IPC、Job Sql、原Scope的Job lifetime、输入Effect与精确ACK、三种revision、独立输出cursor及64段有界输出缓存已接线。原前台默认路径保留。教师接管会fence当前Agent Run，下一次同Task明确续接仍走原Pi Loop。UI leaf最终9/9，root同反例独立9/9，最终10文件freeze为TEMP/xiaozhi-phase6-terminal-feedback-949a140bed914559a758a0bbae10d7b6/freeze.json。
- 实际Electron main、原Pi、Task、Permission与真实PTY的Host纵向最初4/4，随后固定负例集中9/9且完整exit0。最新报告TEMP/xiaozhi-phase6-terminal-host-evidence-cAQfE9/report.json，命令为node scripts/xiaozhi-agent/phase6-terminal-host-smoke.mjs。覆盖回答后idle教师输入和resize零新增模型请求、同Task新Run原shell变量、同command重复输入不重送、教师接管拒旧Run、跨Task/会话零dispatch、重复close、exit7、实际Grant撤销与到期、冷开只读历史。撤销后的未提交投影保留needs_check和unknown事实，未计作已提交成果。
- planning-policy纯策略12/12，六项事实和Level1/2/3接入原Task、计划与Checkpoint。跨Run旧Provider重新核验、持久Effect安全点、普通前台dispatch前真实execution绑定与独立文件/ACK readback已实现，专项仍待集中复验。SQLite/JSONL结构化诊断与明确resume时重建Session正在接线。
- xterm6.0.0与addon-fit0.11.0已精确锁定，均MIT。官方包解包体积分别5921599和20727字节，安装包无新增native addon。依赖原始metadata、许可证、SRI与SHA归档于TEMP/xiaozhi-phase6-terminal-dependencies。Windows执行继续由现有受控C# helper承担。

本阶段实际付费provider调用保持0。上述Host的模型请求全部为owned loopback SSE。完整恢复/父退出/unknown ACK、Provider与拒绝替代、规划用户路径、两尺寸实际UI及最终仓库门禁尚待完成。当前生产源码仍在实施，out尚未作为Phase6最终候选冻结。

### 恢复与工作流收口记录

- Provider原contract10/10与新跨Run恢复12/12通过于YY7TQN、wDBp8x。复用真实Task、Registry、Resolver、Snapshot、Effect，installed/authorize/adapter采用明确metadata seam。此项没有代表真实Provider业务IO。
- JSONL只读inspection最终13/13通过于KBPwag，覆盖当前ModelState ledger与header身份变化。原12/13红VxNNYQ保留。读取沿原async native reader及Task已验证inspection，数据库和被检查文件前后无写入。
- 原实际Electron/Pi成果生成后SIGKILL、正常恢复、缺失JSONL重建、header变化重建、binding INSERT失败事务回滚与显式重试四组已分轮通过。H01为G4Zut1，H02/H03为同根revalidation-8168a507-07be-4f94-85bc-13858a75c849，H04为revalidation-9567c5cf-aa34-482a-8b5d-986b8d62b095。未将这些分轮报告称为最终源码单次4/4。H04沿原持久化错误门禁先显示running=false及eventPersistence unavailable，再由原refreshRecords恢复记录，最后显式resume。同一Task与成果hash保持，恢复请求各仅一次loopback模型、零进程重放，二次冷开零请求。
- 原Pi1.0.2在首条user/assistant消息前延迟落盘。明确重建现在先异步wx与fsync真实manager的metadata，公开setSessionFile保持同身份，再提交原marker及binding事务。真实SDK定向5/5于fu1oDq。旧Phase5 task-plan.v3的精确schemaHash保留，新增可选planning契约以追加marker兼容。
- HTTP Effect固定8/8通过于ZmF0fw，总计7次owned loopback HTTP。响应文件已成功而SQL Commit前SIGKILL，经原Journal恢复unknown后，在同Task新Run按精确回执reconcile，原route仍只请求一次。原7/8 o2EjXl保留。通用missing_result占位只在精确unknown、空proof和对应Journal reference条件下接受真实回执替换，既有真实outcome继续核摘要。
- 退休历史的私有片段拒绝证据沿归档、原marker/anchor及已提交receipt摘要重新加载。真实Creator/managed包/SQLite专项5/5于8VAzXa，私有canary拒绝、通用方法仍可发布。缺失或不可信历史明确private_history_unavailable。归档事务提交后同Run重新核验并替换pending context，完整可核历史不要求额外模型轮次。
- 原Pi规划与审批工作流5/5、完整Electron exit0于mYVR7A。L1只用一次模型请求，L2依赖与理由进入immutable checkpoint，L3缺能力时保存六项预检且继续safe_read，写Effect保持not_delivered。原pending审批冷启零自动派发，教师拒绝后同Task明确continueTask保留抑制与替代读取。原采用planning字段validator及自身计划写边界阻挡预检两个真实缺陷已修，所有首失败保留。预检仅只读观察旧pin/候选，正式Provider采用仍走原安全点。
- 受影响的原foreground operations9/9于c0zTOq，新增同一文件用例的相对cwd断言。前台复用PTY既有UTF8与owned PSDrive初始化。任意脚本、非零退出、取消、隔离、真实网络审批、Unicode边界、撤销与教师原DACL检查保持。
- Task恢复UI最终10/10于dEg20n，三个组件及专属测试freeze在TEMP/xiaozhi-phase6-task-recovery-ui-handoff-197c5d61e4a44d39800674b5d05c6a52。完整构建、两尺寸实际页面仍待最终out核验。

截至本段写入，Job父退出、两种unknown ACK、Task完成关闭及实际终端UI正在固定范围收尾。生产源码临时冻结为core manifest b4f8f07369e37af3598535a2b27d129b043fd6505e07f87c8f4d792424de0f1b，616输入，供Job专项使用。此为运行窗口身份，最终Gate6源码与输出身份仍待发布。

### 最终实施侧交接 2026-11-18

状态为 SOURCE_DONE / WAIT_INDEPENDENT_GATE6。本节替代上述进行中进度，原历史报告与失败记录继续保留。正式独立Gate6和模块Git由root执行。

- Job父退出冷启精确reaper、两种ACK未知边界、原Teacher完成关闭在同一1d73身份的7sHl0t固定三场景四项4/4、完整exit0。两个旧强停残留现场lweCEr 2/2真实回收。缺PID保持needs_check，已知精确PID有限等待收束后才清理，维护任务被Host.close中止并join。投影字节与目录身份保留，失联创建Effect按原Sql原子恢复unknown。
- 最后正常入口补证CfKkwa 2/2、完整exit0。原持久ACK后EffectCommit失败保留unknown，Teacher原review完整preview之后按原reconciler本地核对精确ACK，再closeTask和原独立readback完成Task。脚本已删除直接exported reconciler调用。Teacher阶段新增模型请求0、同command重送0、cleanup全真。未知物理ACK仍不能据缺失事实认定成功。
- 普通Task卡补到当前agentTrace页面，复用原taskReviewInteraction的Task/Goal过滤与精确lastRun/origin身份。最终真实UI lNILQx 10/10、完整exit0，覆盖两尺寸UTF8输入、Task恢复读取、停止控件中心无遮挡、Ctrl+C、自然原Task/Job续接、typedEOF、可见Teacher复选控件与确认按钮、关闭和冷启只读历史。总模型4次全loopback，教师本地控制与确认新增0。
- 最后截图复核发现终端缺data-edu-domain令已有scoped CSS失效、列表在滚动容器外。仅补两个领域根属性并移入原ChatConversation.Content。原CknqNL 9/9的弱bounds断言报告保留，最终加elementFromPoint验证。其余UI夹具失败按FAILURE_INDEX分列，原报告未覆盖。
- 最终build包含全src tsc exit0，renderer246/246、terminal组件9/9、Task恢复组件10/10。原完整Electron207/207、进程exit0使用最后UI滚动修复前out，main/preload与最终out逐字节相同。前后478输出差异仅renderer入口、引用chunk与index.html，out-delta.json保存五路径精确差异。最终UI10与renderer246已在最终候选重跑。
- 集中底座11套94项全部exit0，另原coordinator16、Journal23、governance11全部通过。最终git diff --check exit0。root audit35项的同一lock身份保持，Phase8按原计划处理实际可达性。

完整实施侧报告、原始运行日志、逐文件身份、失败索引、leaf精确报告与四张最终截图在 `evidence/phase6/implementation-final-20261118`。最终core617输入sourceHash为1ec5576c70f76863b61e0f77fb5ad7369fd9dff7c64db06adbd938d866f5c00d，逐项漂移0。生产1697文件列表SHA为cbae410aa2999ee0b6ce8621cb6239cd9bf43dd31045c0c4053eff5780138912，最终478输出列表SHA为0d55a2c48707128e75ad75077177ecb8d4d4b78faf01e6e7df3581778ae556ad。freeze.json SHA为31b80e2afff5831b39d9ce0d4ad6e59e53dfd4c5da492ee964eb5b637d9a6c85。

本阶段真实付费provider为0。独立ConHost PID、其他OS/本机不支持API实际分支、真实教师数据、Phase7视觉终验及Phase8模型/性能/打包终验保持各自边界。旧no_criteria记录可沿原同Task明确continueTask产生新候选再确认，历史metadata及旧副作用保持原事实。
