# Phase 8 四项 P0 源码与证据核查

2026-11-19。独立源码审计角色。范围仅 A-P0-01、A-P0-02、A-P0-07、A-P0-09。生产源码、out、仓库文档和 Git 写入为 0。新测试与报告均在 C 盘专属 TEMP。实际付费模型调用为 0，未启动可见窗口。

## 核查结论

| 条目 | 当前源码/机制 | 系统条目建议 | 理由与明确边界 |
|---|---|---|---|
| A-P0-01 唯一 Runtime | PASS | PASS | 正常 prompt 仅装配 Pi AgentSession并调用其prompt，计划、恢复、Resolver、动态准备都是被调用宿主服务。源码与既有真实Pi/Host阶段记录一致。显式shadow分类为一次无Tool模型调用，不具备任务编排循环 |
| A-P0-02 动态Provider执行边界 | PASS | NOT_TESTED，已有范围证据 | 当前具名工具、Capability Dispatcher、managed MCP和Extension接线均可追到原Boundary、Permission、Task和Journal。当前11项governance及10项contract通过。完整生产会话中的动态MCP/Extension负例主要来自旧阶段，部分接线/adapter已变化，本轮未运行当前B的完整生产动态负例 |
| A-P0-07 撤销优先 | PASS | NOT_TESTED，已有范围证据 | 当前Grant撤销和具名Provider撤销机制实际通过，源码每次检查最新Provider/Grant/MCP authority。当前B缓存生产补证含正常与冷恢复Host，以及部分metadata撤销负例。完整当前B中已注册MCP/Extension旧closure撤销后的实际调用阻断仍需合并相应运行证据 |
| A-P0-09 旧Generation不能覆盖Task | PASS | PASS，可用于关闭此条的写入围栏要求 | 当前Journal23含旧owner迟到写入拒绝，startup2验证冷启后同Task、generation增长、旧owner失效及幂等。Phase6真实Host恢复/Job归档补充上游回调与冷恢复。当前Pi、governance、Journal、Permission Engine与Phase6提交2376c84字节无差异，TaskState只新增只读summaryRecord一行。此结论只证明Task/Journal写入围栏，不把它延伸成所有外部物理副作用已经停止 |

本次没有确认新的 P0 源码缺陷。上述两项 NOT_TESTED 表示系统运行证据尚待汇总，不表示已观察到失败。总控可以组合其他独立Agent和当前B实际链证据完成系统判断，本报告不改写矩阵。

## 身份与证据适用性

- 工作树为 `D:/WorkProject/EduProject-harness`，分支为 `codex/xiaozhi-harness-20261112`，读取的HEAD为 `f9546eb7e8b6f64c9b6cb3577775331e31ddc9b6`。
- `git diff --name-only 57d300d HEAD -- apps/desktop/src apps/desktop/package.json apps/desktop/package-lock.json` 返回空，当前生产源码与57d300d一致。
- 使用原 `phase8-real-model-plan.mjs` 的 `fingerprint()` 实际重算out，共481文件，SHA256为 `0a8c18e8201b58b84c63b9acc7bb14208f65ab865b3f18e2125c7f46cde247f1`，与总控冻结值一致。完整文件列表算法使用相对路径与逐文件SHA的原JSON序列。
- 当前主进程域图 `D-WorkProject-EduProject-harness-apps-desktop-src-main-xiaozhi-agent` 可以检索。根图index_status返回project not found，改用已有主进程小域图定位。关键实现再直接核查当前源码，未索引或改写生产文件。
- Phase5独立归档zip实算SHA为 `df162c5a14be0601e1a9bf5e8a231c88e80b90705e2c8f69a94f381e7490eebe`，匹配MANIFEST。
- Phase6独立归档zip实算SHA为 `c46a4a8ab44f5773079a028f9561be4bd37c662b7e8d06951af429f4c1099ca2`，匹配FINAL_ARCHIVE。
- Phase5冻结中相关域96个文件，本次比对37个已变化，59个相同。Phase6冻结中相关域127个文件，14个变化，113个相同。逐文件结果保存在 `upstream-current-source-parity.json`。这些计数只针对选定的Pi/Host/Capability/Permission/Event/Effect/Task/Extension/Terminal域，不能当全仓前后比对。
- `git diff 2376c8433df55e49c33c64b3b4fbdab6ba981a73 f9546eb -- apps/desktop/src/main/xiaozhi-agent/tasks/task-state.ts` 仅新增 `summaryRecord` 只读方法。相同两提交间的pi-session、core-governance、events/journal、permissions/engine diff为空。
- 最终git状态含总控/并行验收者正在更新的四份Harness状态文档与新证据。本审计没有编辑这些文件。

## 当前源码执行链

```text
production-host.start
  → tasks.start / tasks.resume + EventPublisher
  → createPiXiaozhiSession
  → registerSessionToolGovernance(全部最终Tool Definition)
  → createAgentSession(customTools=dispatchers, noTools=builtin)
  → Pi决定调用某个具名Tool
  → dispatcher.execute
  → ToolExecutionBoundary.execute
  → beforeDelivery 当前Run + Task admission + journal.admitTool + governance.before
  → PermissionService.forRun.execute
  → RunToolGovernance.execute
  → 原Tool / capability runtime / MCP / Extension
  → current/generation校验 + 原Receipt/Effect/Artifact提交
```

| 精确文件与符号 | 当前证据 |
|---|---|
| src/main/xiaozhi-agent/production-host.ts 1945 | prompt先绑定原Task，创建/恢复失败不会继续建立无Task动态工具运行 |
| src/main/xiaozhi-agent/production-host.ts 1158–1215 | managed MCP adapter、CapabilityTaskRuntime、稳定Dispatcher、全部工具治理与Extension/Job入口，均沿原Task和publisher |
| src/main/xiaozhi-agent/production-host.ts 1216–1229 | tool attempt barrier，当前active对象校验，Task准入、admitTool、governance.before |
| src/main/xiaozhi-agent/pi-session.ts 932–985 | 先register所有taskDefinitions，再用统一Boundary包装全部customTools。executeAuthorized先由Permission运行，再进入governance.execute，最后调用原Tool |
| src/main/xiaozhi-agent/pi-session.ts 983、1349 | 唯一createAgentSession与正常session.prompt调用 |
| src/main/xiaozhi-agent/tasks/planning-runtime.ts 14–105 | 读取当前Task、Resolver、Permission与依赖事实，确定性evaluateTaskPlanning，checkpointTask原子保存。没有模型请求或自主Agent循环 |
| src/main/xiaozhi-agent/decisions/deepseek-shadow.ts 7–21 | 显式单次completeSimple，无工具；ledger.ts 72–83为手动shadow API，boundedShadow与结果commit不产生业务执行授权 |
| src/main/xiaozhi-agent/capabilities/core-governance.ts 112、176–219 | register全部已知具名Tool，schema/source/provider/binding/version检查；before保存合同；execute再次检查当前Provider、当前Run、权限引用与Effect |
| src/main/xiaozhi-agent/tools/execution-bound.ts 54、79–97、132–179 | 输入与call去重、beforeDelivery/attempt持久化、epoch fence、PermissionToolExecution、超时后原IO围栏、迟到结果变cancelled |
| src/main/xiaozhi-agent/capabilities/runtime.ts 44–52、68–138、167–225 | 每次current检查、旧snapshot版本重新解析、实际执行前后current与workspace版本验证。Provider切换只在安全点 |
| src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp.ts 136–163、182–208 | artifact状态、TTL、文件hash、server authority、当前Permission重新检查。随后进入原MCP tool.execute |
| src/main/xiaozhi-agent/mcp-runtime.ts 225–230、302–336 | revoke清空信任和selectedTools并关闭当前客户端；每次已注册closure执行仍读取最新state，list实时Schema，callTool前再次检查最新authority，使用permission.run |
| src/main/xiaozhi-agent/extensions/host.ts 115–153 | 宿主当前Task context、service.open、Registry provider版本撤销检查、Snapshot持久化、窄RPC返回校验，作为原extension_invoke工具调用 |
| src/main/xiaozhi-agent/extensions/service.ts 36–85、148–160 | 原Permission lease、owner身份、每次assertSelection、Grant assert，revoke/disable关闭旧session |
| src/main/xiaozhi-agent/permissions/engine.ts 131–207 | operation前后重新evaluate与current校验，Grant到期timer、revoke立即abort相关active操作，cancelRun和Job生命周期分别处理 |
| src/main/xiaozhi-agent/events/journal.ts 41–48、173–205、256–281 | event/task/contract/effect提交都验证当前owner与generation，启动recover令旧owner generation增长并清空run_id |
| src/main/xiaozhi-agent/tasks/task-state.ts 80–103 | 主进程写入对照event owner、running、session归档、Task binding/revision与来源身份 |
| src/main/xiaozhi-agent/effects/state.ts 53–76 | Run写入、Job权威与recovery核对为明确不同入口。Run写入同时核对当前event owner及Task requirements/binding，旧Run不能借恢复入口普通执行 |
| src/main/xiaozhi-agent/capabilities/provider-snapshots.ts 56、101–180 | 保存Snapshot核Task active/binding，并重新检查当前Registry、Binding、Provider health与撤销 |

上述路径均以 `D:/WorkProject/EduProject-harness/apps/desktop/` 为文件前缀。HTTP连接使用的Undici Agent是连接客户端，不构成模型编排器。启动恢复、诊断、市场发现和Job事件监听属于确定性宿主服务。

## 本轮实际运行

以下前三条在 `D:/WorkProject/EduProject-harness/apps/desktop` 运行，直接导入当前源码，无build、无核心manifest生成步骤。

| 精确命令 | 结果 | 实际报告 |
|---|---|---|
| node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs | 10/10，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase2-contract-FG3K8z/report.json |
| node scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs | 13/13，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-permission-phase3-store-fRgCfo/report.json |
| node scripts/xiaozhi-agent/phase6-startup-recovery-smoke.mjs | 2/2，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-startup-recovery-Qqvv2V/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase8-p0-source-audit-20261119/current-governance.mjs | 11/11，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase8-current-governance-t3TxZg/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase8-p0-source-audit-20261119/current-event-journal.mjs | 23/23，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase8-current-journal-TkWfxh/report.json |

合计59 PASS、0 FAIL、0 skipped。运行输出完整保存本目录各log。

`current-governance.mjs` 保留原 `phase5-governance-smoke.mjs` 全部11项断言，移除会改写仓库generated manifest的buildCoreToolManifest调用、将test-results输出改到TEMP，直接导入当前源码取代中间esbuild bundle。定义和原测试fixture保持原边界。这个适配运行的是Registry/governance合同夹具，不是完整Pi生产会话。

`current-event-journal.mjs` 保留原 `pi-event-journal-boundaries.mjs` 的23项断言，只把源码导入改为绝对file URL、产物目录改为TEMP，并增加node:os引用。该专项运行真实本机SQLite与事件接收器，没有模型、Provider或UI。

59项的相关覆盖如下。

- Governance11验证所有已知核心Tool及选定MCP身份进入相同Registry，未知与重复工具拒绝，MCP hints仍为external_effect/one attempt，旧Provider撤销后具名调用被拒绝，旧Task current失效后intrinsic工具被拒绝。
- Permission13验证持久Grant/Approval/CAS、重建后审批、新generation仅一次消费、活动撤销abort、任意一个组合Grant撤销即阻断操作，真实loopback网络broker的目的地范围。
- Contract10验证SQLite版本不可变、统一结果校验与当前执行上下文，以及底层工具已超时但实际尚未完成时不能刷新能力。
- Startup2验证冷启动后同Task变interrupted、generation增长、旧Owner失效，第二次恢复幂等。
- Journal23验证旧Owner迟到append拒绝、current owner隔离、批量事务失败回滚、通知丢失恢复、UI导航epoch、私有写入围栏。

## 已归档生产集成证据与尚缺的跨层部分

Phase5 Gate5为11套145项加5项stdio补证，共150/150。生产Pi5、Host6、MCP lifecycle11、Extension native21/package18/recovery2与真实UI8均有原命令与范围记录。其运行包含实际Grant与原Task/Journal，模型为loopback，受测源码/out属于Phase5冻结身份。

Phase6 Gate6最终独立23项包括恢复Host4、Job正常Host2、真实终端UI10、Job列表6及失败重新规划1。H01–H04每例两次cold，共8次冷恢复，显式继续创建新Run和generation；原Effect/Job ACK与实际文件hash独立核对。它补充A-P0-09的生产入口证据。当前相关Pi、Journal、Permission、governance围栏与该生产提交一致，TaskState新增只读方法不会更改这些写入路径。

当前B补证 `docs/goal/xiaozhi-harness/evidence/phase8/cached-profiling-preparation-20261119/production-cache-checkpoint.json` 的productionBuild指纹与本次out一致。三组各3个实际Host检查覆盖原审批继续、同Task缓存执行与cold继续。其边界断言另覆盖warm校验不缓存TTL/availability、撤销后新transport拒绝、owner改变拒绝旧view/fork。报告自己明确部分负例为metadata projection/validation seam，故不能把它们变成所有真实进程/网络入口的运行结论。

要将A-P0-02和A-P0-07系统条目提升PASS，尚需从当前B相同out的真实链证据中补齐或找到以下明确记录。

1. 当前生产Pi注册后的动态MCP/managed Dispatcher与Extension调用，证明实际底层调用之前已经持久化原Task/Grant/Provider合同，拒绝或撤销后原实现计数和副作用均未增加。
2. 缓存已暖、Schema已注册、原闭包仍在时，Provider或相关Grant撤销后的新调用被当前宿主阻断。覆盖当前支持的MCP和Extension两个外部实现族，避免只证明registry元数据或孤立Permission Engine。
3. 关联当前callId、Task、run/generation、Provider版本、Grant refs和实际底层计数/文件/回执，继续沿原Journal读回。已有阶段证据可以复用字节相同部分，变化的managed MCP、MCP runtime、acquisition service/state与Extension package-manager接缝需要当前补证。

这些机制可以使用合成资料、loopback模型和隐藏Electron运行，不依赖付费模型或真实教师数据。本Agent按最小机制测试任务收束，不启动额外集成套件。总控同时进行的页面、安装包、流式性能和模型质量验收继续由其负责人完成。

## 交付与限制

本目录还包含 `identity-report.json`、逐源parity、原测试的TEMP适配器、精确运行日志。原生成文件、out与仓库测试脚本内容均未改动。源报告路径与归档SHA都能重复核查。未运行新的build、打包、完整Electron生产否定测试、可见界面或真实模型。没有应用功能变更，性能前后对比和源码回滚不适用。
