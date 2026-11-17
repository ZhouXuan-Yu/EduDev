# Phase 5 核心接缝只读预审

## 1. 范围与证据基线

本轮仅定位 T5.0 双向 stdio、T5.4 OS CPU/内存、active acquisition 和 H23 统一治理的实现接缝。实施方案与测试清单供后续唯一 writer 冻结合同。该文档中的增量均未实施，列出的运行验收均为 NOT_RUN。

- 读取位置为 `D:/WorkProject/EduProject-harness`，2026-11-12，HEAD `052bd6885c4280b49ab36228fe9ac605799a769b`。Phase3 的 Gate3 接受状态沿用已有报告，本轮未复验其 OS 安全矩阵。
- 范围依据为 `12_MARKETPLACE_AND_MCP.md`、`13_EXTENSION_AND_ENVIRONMENT.md`、`EXECUTION_BOOK.md` T5.0–T5.5、`05_PI_RUNTIME_INTEGRATION.md` 和 `00_HARNESS_DECISION_LOG.md` H23。相关正式验收为 A-P0-03/A-P0-05、M-02–M-09，以及后续 Effect/Recovery 的 T-05–T-07。
- codebase-memory 的目标 worktree 图不可用。邻近图仅作导航，本轮事实均回读当前目标源码与锁定依赖。没有重建图或扫描全仓安全状态。
- 此文档是本轮唯一写入。过程中已看到 Phase4 writer 的 `managed-skills.ts`、`session-state.ts`、`skills/`、共享治理契约及合同变更，另有 root 的 Phase8 计划文件，均由各自 owner 继续维护。
- build、组件测试、Electron、安全测试、helper 运行、安装和付费模型调用均为 0。本轮未启动子进程沙箱、修改 ACL、建立 profile 或变更运行时缓存。

下面表中源码路径均相对 `D:/WorkProject/EduProject-harness/apps/desktop/`，代码行号用于当前 HEAD 导航。Phase4 并行改动后须重新核行号。

## 2. T5.0 的公开 API 与现有真实入口

### 2.1 锁定 Pi MCP 契约

当前安装的 `@earendil-works/pi-mcp` 为 **1.0.2**。`node_modules/@earendil-works/pi-mcp/package.json` 的主公开入口映射到 `dist/index.js` 与 `dist/index.d.ts`，后者公开导出 `McpClient`、`McpTransport` 类型、`JsonRpcMessage`、`parseJsonRpcMessage`、相关 listener 类型与错误类型。

```ts
interface McpTransport {
  start(): Promise<void>;
  send(message: JsonRpcMessage): Promise<void>;
  close(): Promise<void>;
  onMessage(listener: McpTransportMessageListener): () => void;
  onError(listener: McpTransportErrorListener): () => void;
  onClose(listener: McpTransportCloseListener): () => void;
  setProtocolVersion?(version: string): void;
}
```

`McpClient.connect(transport)` 是可复用的注入入口。`dist/client.js:112` 在 `transport.start()` 前注册监听，再发送 `initialize`、校验协商版本、调用可选 `setProtocolVersion`，最后发送 `notifications/initialized`。原客户端继续负责协议生命周期、request ID、进度、超时与 pending 请求。

`callTool(name,args,{signal,timeoutMs})` 的 signal 会经过 `cancelPending`，该函数在 `dist/client.js:395` 拒绝本地 pending 并尽力发送 `notifications/cancelled`。这只能证明客户端已请求取消。受控执行器仍须拥有关闭 Job 的停止路径。`connect` 的 initialize 本身没有外部 signal 参数，宿主已有的 abort → client.close 接线应继续覆盖初始化悬挂。`onError` 单独触发只报告错误，pending 的终止依赖后续 close 或请求超时。

`StdioTransportOptions` 没有 spawn 工厂。`dist/transports/stdio.js` 的 `start()` 直接使用 `crossSpawn`，Windows 关闭路径另有 taskkill。接入方案应实现公开 `McpTransport`，复用原 `McpClient`。内部 `TransportEvents` 没有从包主入口公开导出，adapter 可自行维护 listener 集合及 close-once 状态。

### 2.2 源码复用与缺口

| 现有符号与位置 | 可直接复用的边界 | T5.0 实际缺口 |
|---|---|---|
| `createMcpRuntime`，`src/main/xiaozhi-agent/mcp-runtime.ts:71` | 配置 CAS、sealed credential、schema hash、工具选择、list 分页限制、输出脱敏、撤销与连接组管理 | `transport(server)` 在 89 行拒绝 stdio。尚无受控 transport 注入和已验证本地执行物元数据 |
| 同文件 `connect`、`tools`、`revoke` | 启动失败回收，准备阶段 deadline，每次调用重读 ready/selection/schema，server 级串行资源锁，撤销关闭全部客户端 | 需要将 server/session/Task owner、process Grant、执行物与 transport 生命周期绑定。当前配置里的 command/args/cwd 无法直接作为执行许可 |
| `createMcpPermissionContext`，`permissions/mcp.ts:8` | 现有 Permission Engine、owner fence、input digest、provider identity、每次调用 Grant 审核 | 第一条 guard 仅接受 HTTP。stdio 元数据握手也会启动代码，需要 process/dependency/secret/filesystem 等适用 Scope。普通 `inspect` 当前直接 connect，active acquisition 应走显式授权 preparation 服务 |
| `runNativeSandbox` / `SandboxStart`，`permissions/windows/launcher.ts:12,115` | helper bytes pin、strict NDJSON 帧、父生命周期、取消、watchdog、精确 cleanup 验证 | 输入只支持 start/cancel。返回单个终态 Promise。`onData` 把双 stream 解码后合流，没有 stream-preserving byte callback 或可写 session handle |
| `NativeSandbox.cs` `Launch`，1886–1979 行 | AppContainer、显式继承句柄、owned 投影、固定执行物 SHA、suspended → Job → resume、stdout/stderr 管道、Job 全树清理 | 1897 行子进程 stdin 是 `NUL`。1696 行 `ReadControls` 仅接 cancel。需要真 stdin pipe、异步受限写入、EOF、背压及相应协议版本 |
| `createControlledPowerShellOperations`，`permissions/windows/operations.ts` | Grant assert、Low 执行副本、main 按源版本 CAS 提交、恢复记录 | 当前是 bounded PowerShell 脚本执行，不能直接承担长期 MCP 会话。投影自动提交与常驻 server 的后台写入须单独定义 |
| `createPermissionRuntimeManager`，`permissions/windows/runtime.ts:18` | 固定可信 C# recipe、编译器/hash/签名核验、版本目录、receipt、健康检查、指针切换与失败回滚 | 当前 helper 的可信执行物为 PS runtime pin。通用 Node/Python/原生 server 的包与启动映像 pin、依赖闭包和隔离兼容性尚无准备路径 |

### 2.3 最小落地方案

1. 先冻结兼容的 helper 协议增量，并保留现有 v1 PowerShell 与 cleanup 语义。新增受控进程会话只从 main-owned 执行计划产生，绑定 owner、executionId、Grant hash、manifest/executable/package hash、明确 argv/cwd/env 及预算。若采用新版本或新 mode，应由 manifest 明示支持，旧 helper 遇到新需求返回类型化不支持。
2. 为子进程建立真 stdin pipe。主进程仍通过 helper 的 NDJSON 控制管道发送数据帧。每帧包含 executionId、单调序号与有界 base64 字节，helper 写入完成后返回确认。固定单帧、in-flight、总排队和时间预算，重复或乱序处理规则须明确。stdin writer 独立于 control reader，子 server 不读取 stdin 时 cancel/父退出仍能打断写入。stdin-close 幂等，半关闭后可继续 drain stdout，最终 close 受 cleanup deadline 约束。
3. launcher 增加私有会话对象，至少提供 ready、按 stream 的 bytes、bounded write、closeInput、cancel 和 terminal result。MCP stdout 的 UTF-8/换行 buffer 仅在 transport adapter 解析，stderr 单独限量脱敏。helper started/output/ack/result 等控制帧与子进程 JSON-RPC 完整分层。保留 helper stdout 单一协议输出的约束。
4. `ControlledStdioTransport` 实现公开 `McpTransport`。`send()` 在有界写入确认后 resolve，错误触发 error 并终止连接，close 只发送一次。逐条用公开 `parseJsonRpcMessage` 校验 stdout，限制每行、总缓冲、消息速率及 stderr。先注册监听再 start，以覆盖同步早到数据。完整 `initialize → initialized → tools/list → tools/call` 继续由原客户端处理。
5. `mcp-runtime.ts` 注入受控 transport factory，factory 只接受主进程准备好的启动计划及当前 authority。补齐 `permissions/mcp.ts` 的 stdio preparation/call 两条授权路径，撤销关闭该 owner 所有 session。现有 settings/secrets/schema 审计继续由原 runtime 保存。仅在真实验收通过的 runtime 与执行物范围解除对应 guard。
6. 第一条真实 fixture 可沿已支持 PS5 执行物运行合成 NDJSON server，证明 duplex 和原 MCP Runtime 接线。通用 server 仍依赖相应运行时/包 recipe。需要外部 DLL、package tree、配置或 executable 的 ACL/MIC 时，仅可在已验证的 owned 执行环境准备。Node/Python 原安装目录的可访问性仍须逐 runtime 实测。

进程启动授权涵盖 server 在存活期间可使用的资源。逐 Tool 的主进程检查与进程启动时已注入的资源必须保持一致。不同 Task、Grant、secret consumer 或包版本应独立会话，撤销时关闭对应 Job。常驻 server 已得到的 secret 无法通过一次 Tool 调用结束立即收回。最小实现可采用 bounded、按 owner 隔离的会话并在关闭后提交投影。若允许跨 call 常驻并写投影，需要额外证明提交期间 server 已停止写入、授权仍有效和旧源 CAS 一致。Phase3 已验的原教师目录 MIC/DACL 保留，执行发生在 owned Low 副本，main 按 Grant 提交。

零网络 capability 的 AppContainer 仍适用于纯本地 stdio。需要联网的 server 必须使用可约束的 broker/独立 HTTP adapter 路线，并按 egress Scope 核验目的地与数据分类。增加环境变量或代理配置不能完成此边界。

## 3. T5.4 的 OS 资源预算

### 3.1 当前事实

`NativeSandbox.cs:442,461` 已声明 user time 与 process/job memory 字段。`Launch:1934–1936` 实际仅设置 `0x2000 | 0x8` 与 `MaxProcesses`，随后写入 `JobObjectExtendedLimitInformation`。本轮源码未见 CPU rate、job user-time 或 memory limit 的启用。现有 `timeoutMs`、`maxOutputBytes`、`maxProcesses` 提供 deadline/输出/进程数控制，Capability 的 `resourceUnits` 属于 Resolver 预算输入。

### 3.2 推荐冻结的预算语义

| 预算 | 最小 OS 映射 | 真实结果与测试判定 |
|---|---|---|
| 聚合 committed memory bytes | `JOBOBJECT_EXTENDED_LIMIT_INFORMATION.JobMemoryLimit` 加 `JOB_OBJECT_LIMIT_JOB_MEMORY` 0x200，在 resume 前设置并 query 核对 | OS 拒绝超过 Job 总量的 commit。失败分配可能被 server 捕获，宿主要观测超限并按合同决定关闭 Job 与返回资源错误 |
| 可选单进程 committed bytes | `ProcessMemoryLimit` 加 0x100 | 仅在产品确实区分单进程和总量时增加，避免仅测父 server 而漏掉子进程聚合 |
| CPU 调度份额 | `JOBOBJECT_CPU_RATE_CONTROL_INFORMATION`，information class 15，ENABLE 0x1 与 HARD_CAP 0x4，CpuRate 为百分比乘 100 | 达到当前调度区间配额后等待下一区间。验收应证明实际节流与 configured/query 一致，不能期待每次达到份额即退出 |
| 聚合 CPU user-time 总量 | 如合同要求执行量到限终止，另设 `JOB_OBJECT_LIMIT_JOB_TIME` 0x4 与 `PerJobUserTimeLimit`，100ns 单位 | 全 Job user CPU 累计超限触发 end-of-job action，默认终止。CPU rate 与累计 user-time 各自有明确字段和结果语义 |
| deadline/process/output | 复用现有 helper 预算 | 在 duplex 模式增加输入与消息预算，累积值覆盖 server 全会话及全部子进程 |

内存计量对应 committed virtual memory。测试需使用实际 commit/touch 的分配，并记录 Job 聚合使用与失败返回。可用 completion port 获取 process/job memory limit 信号，结合 supervised termination 输出明确 `resource_limit` 及子类原因。allocation failure 本身允许进程继续运行，终帧不能仅依据普通退出码猜测内存超限。官方定义见 [Job 扩展限制](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information) 与 [Job 基本限制](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)。

CPU HARD_CAP 会限制调度份额。嵌套 Job 的份额相对父 Job，RDS DFSS 环境可能拒绝 CPU rate control。设置失败必须在 resume 前返回明确错误并清理，宿主仅对已确认可实施的约束报告 Ready。实际测量需记录核心数、父 Job 情况、观测区间、CPU 时间/墙钟时间和容差。官方定义见 [CPU rate control](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information) 与 [SetInformationJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-setinformationjobobject)。

预算由可信 main 从策略/Grant 和 provider 配置取较严格值，跟随启动身份与 receipt 保存。请求缺字段、溢出、极大值、单位错误、后续增大、被替换启动计划均需在创建进程前拒绝。helper 与父进程的控制预算单独限量，防止 child 的输出压力使清理线程失去响应。

## 4. Active acquisition 与安全激活

### 4.1 已有可复用点

| 符号 / 源码 | 当前能力 |
|---|---|
| `capabilities/registry.ts` `createCapabilityRegistry` / `register` / `providerVersion` / revoke 系列 | 原 Sql writer/transaction，registry revision CAS，definition 合同约束，provider-version archive 和 hash 校验，版本撤销 |
| `capabilities/provider-snapshots.ts:50` `createProviderSnapshotStore` | 同 Task/Run/generation owner 核对，版本化 selection，prior snapshot 链与 registry revision |
| `capabilities/runtime.ts` `createCapabilityTaskRuntime.resolveCurrent` / `resolve` | current fence，序列化 refresh，`canRefresh` 两次核对，publisher 持久化快照，优先复用既有选择，显式 refresh |
| `production-host.ts:946` / `pi-session.ts:1226` | Task runtime 使用 publisher owner 与 `persist`，`canRefreshCapabilities()` 当前以 execution boundary 的 activeEffectCount 为安全条件 |
| `permissions/windows/runtime.ts` / `environment/service.ts` | 固定 permission runtime recipe 已有 prepare、receipt、health、version pointer、回滚。`environment_repair` 可在原 Tool 授权边界执行 |
| `production-host.ts:1352–1364` | 普通 MCP add/inspect/trust/remove 保持 settings idle-only。revoke 独立支持 active 取消并撤销相关 Grant |

### 4.2 当前缺口

- `capability_inspect`、`capability_resolve`、`capability_execute` 是当前三个稳定 Dispatcher 名称。resolve 已可刷新选择，但没有候选搜索、隔离准备、许可证/依赖验证与安全激活服务。`execute` 的公开 schema 固定 `{path}`，runtime 直接调用 `options.native.execute`。Registry 的 generic type 并未使它成为完整外部 provider runtime。
- `createEnvironmentService` 当前处理诊断、固定受控 helper recipe 与工作区 UTF-8/CRLF 配置。它未实现任意外部包的锁定下载、license 核验、install script 隔离、离线有效性与回滚状态机。
- `mcp.tools()` 在 `sessionConfiguration` 阶段生成一次定义，当前 Session 的 tool map 在 `createPiXiaozhiSession` 构建。`canRefreshCapabilities` 目前只约束 provider snapshot 更新，尚无已验的 active MCP tool list 热替换路径。active acquisition 若直接调用 UI mcpAdd/Inspect/Trust 会被 busy 阻断。

### 4.3 最小增量

新增 main-private acquisition coordinator，挂在同一 Task 的 Bootstrap/Dispatcher 路径。输入为规范化 candidate identity 与逻辑 Capability requirement，由 main 生成来源、license、package hash、lockfile、runtime recipe、schema、权限差异与隔离测试结果。先 quarantine，原 Permission Engine 判定后 prepare，功能验证成功后以 expected registry revision 注册。可信且符合现有策略的候选可自动推进，未知/不可验证候选留待审核，保留原因和可恢复阶段。

每次异步切换前后重读 current Task/Run/generation、requirementsVersion、source/package/schema 与 Grant。运行中的取消/撤销先取消 acquisition 和受控 Job，再记录 terminal 状态。restart 读取 receipt、阶段、hash 与最新撤销策略，重做纯验证和 reconcile，副作用未知时保留核对入口。原始 command、secret 或真实教师内容不写恢复记录。

注册后复用现有 Registry revision 与 provider snapshot safe refresh。稳定 Dispatcher 的 executor 增加已验证 provider adapter 路由和逐 Capability input/output validator，避免把任意未知 JSON 直送通用执行器。当前 Task 保持原 ID，正在执行的旧版本持有其 immutable snapshot。新的 resolve 在安全点使用新 revision。若必须出现新的显式 MCP Tool 定义，需要另外验证 Pi 公共 Session 重配 API或受控 Session 重建，保持 Task/已持久化历史、权限与旧调用 fence。首个 bounded 路线可通过稳定 Dispatcher 执行新 provider，避免把 UI 全局 busy 锁改成宽松设置写入。

离线复用只接受完整 hash、已验证 receipt、未撤销且在有效期内的本地版本。外部目录不可达时，原生教育 Tool 与既有本地能力继续按自身条件工作。市场 UI 的多来源聚合与最终页面体验由其他 Phase5/7 切片处理。

## 5. H23 已统一部分与剩余接缝

### 5.1 当前共享执行边界

`pi-session.ts:851–895` 把 core、MCP、Capability Dispatcher、environment 与其他现有 Tool 合并进 definitions，经 task envelope 和原教育 Tool Catalog 后，统一创建 `manifestForTools` 与 `createToolExecutionBoundary`。boundary 已有 input snapshot/SDK validation、callId 去重、SessionExecutionRegistry、owner epoch、超时、cancel、资源锁、重试限制、有界结果和持久 tool_attempt。MCP 名称由本次准备的 trustedMcpNames 进入 manifest，效果保守按 external_effect。此链路应继续成为共同执行入口，core 名称、schema 与现有专用实现保持兼容。

### 5.2 需要补齐的统一治理

| 边界 | 当前实际缺口 | 最小修正方向 |
|---|---|---|
| Registry identity | 当前启动注册的是 `edu.workspace.file.stat` 及两种 Native stat Provider。core identity 分散于 ToolManifest 和 `nativePermissionProvider`，MCP authority 存在另一份 app_settings CAS 状态 | 建立 main-owned 注册投影/adapter，使 core、MCP、external Provider 都可解析到同一个 source/version/schema/effect identity。复用原 Registry 和版本 archive，配置/secret 继续原存储 |
| Permission | `createToolPermissionRuntime` 只对列出的文件/命令/web/environment 等路径产生请求，其余返回 null。`capability_execute` 当前按 `{path}` 推导文件 scope，provider identity 并非从选择快照完整构造。MCP 另走 context | 公共执行上下文携带可信 selected Provider/Tool authority，各领域 builder 产出实际 Scope。拒绝 schema/包版本/owner 不一致，不能仅按 `capability_execute` 名称给未来外部 adapter 继承 safe_read 权限 |
| Effect / retry | `toolManifest('capability_execute')` 当前 safe_read 对应已实现 stat。未来动态 effect 变化会影响 read slot、资源锁、activeEffectCount、安全刷新与 retry。MCP hint 当前仍保守 | 在分派前从可信 binding 解析真实 effect/idempotency/cancel/lock/budget，接入同一 boundary。未知 effect 的 remote/local write 不自动重发，调用取消后未核对副作用须保留 unknown |
| Result | `provider-contract.ts` 已有 `CapabilityExecutionResult` 与 `validProviderResult`，但 `providerResult` 仍输入 NativeStatResult/输出 NativeStatOutput。MCP 输出使用另一层 Pi details | 保留 Pi 返回格式，新增可验证的 provider execution details，明确 result schema、provenance、snapshot、artifacts、effect receipt。按绑定 validator 核验业务结果，外部文本仍标 untrusted |
| Durable effects | `verification/effect-readback.ts` 已有部分领域 readback，boundary 的 call 去重为 Run 内存态。已有 tool_attempt 不等于完整持久 Effect Ledger | 复用已有 journal/admission/readback 接缝，Phase5 产出稳定 execution/effect identity 与 receipt。Phase6 承担完整 Intent/checkpoint/reconcile 合同，Phase5 验收如有写入/安装则仍需实现该切片的幂等提交与恢复 |

Registry 中的 provider.permissions 字符串、cost.resourceUnits、self-declared conformance 与 MCP readOnlyHint 均需主进程证据及实际 enforcement 支撑。新增 provider 类型时须同步解除 `localOnly:true`、native executor、固定 path schema 等当前限制中确实需要改变的部分，并保留各 Capability 合同的独立 validator。外部代码继续进入受控进程。

## 6. 最小真实验收集

本节全部 **NOT_RUN**。后续 writer 应在合同中把每项拆成可核验记录，保存环境/版本、精确命令、stdout/协议帧、SQLite/文件 readback、清理库存与原失败记录。以下只是本次核心切片所需集合，M-01 市场多来源 UI 等正式 Gate5 项仍按原验收矩阵逐项处理。

| 集合 | 必需正常 / 失败行为 | 关键 readback |
|---|---|---|
| 原 MCP Runtime 正常双向 | 使用真实受控 PS5 fixture 完整 initialize/initialized/list/call。多次请求、Unicode 跨 chunk、长请求、独立 stderr、分割/合并 NDJSON，实际接 `createMcpRuntime` 与原 McpClient | main 仅获合法 JSON-RPC，stderr 独立。server身份/schema/选择/Grant正确，result及cleanup匹配 |
| 原协议兼容 | 旧 v1 PowerShell script、cancel、cleanup-owned、platform-info 与既有 manifest 仍按合同使用。新 helper/launcher mode 匹配，旧版不识别需求有明确错误 | 源码/helper/manifest hash同字节，旧recovery记录可读，未扩大ACL/MIC范围 |
| 输入与背压 | server不读stdin、重复/乱序ack、stdin提前EOF、超大/畸形base64、stdout垃圾/超长行/无换行持续写、stderr flood | 队列/内存/时间有界，cancel保持响应，protocol失败仅有单一终态，Job子进程0 |
| 取消与撤销 | initialize悬挂、tool call悬挂、server忽略notifications/cancelled、取消排队write、关闭/重复close、active Grant或schema撤销 | 本地pending settle，server收到可观测取消时保存证据，超出grace后Job关闭，新调用0，旧会话不复活 |
| 冷启动与崩溃 | 保存stdio配置及sealed凭据后重启；运行期间关闭应用/父进程或strong-kill helper，restart调用既有owned恢复 | helper/Job/profile/owned ACE库存归零，教师目录标签保持，原source/schema审计可读，旧Run无伪running |
| 授权与执行物 | 未授process/dependency/secret拒绝，binary/package/schema变化、reparse/hardlink、过期/错owner/错generation拒绝，授权owned文件读写成功 | 原MCP权限边界和固定执行物pin生效，准备前不启动不可信code，旧Grant不承接新版本 |
| 新stdio模式定向隔离 | 同一fixture读写owned副本、访问sibling canary、直接loopback socket、spawn child | owned范围成功，sibling/directsocket拒绝，child全在Job。仅验证新mode接线引入的差异 |
| 内存 | 正常低于cap、父进程过量commit、多个child分别低于单进程cap而总和超Jobcap、捕获allocation失败后继续运行 | resume前设置/query成功，真实commit拒绝/超限信号，resource错误与cleanup。保留测试进程峰值/退出/错误码 |
| CPU | 正常短计算、长纯user循环、child聚合循环，单独测rate与累计user-time，模拟API不支持 | rate观测容差/Query值、累计到限动作、明确类型化不支持，Job全树停止，deadline仍独立有效 |
| Active acquisition 正常 | active Task发现可信缺失能力，经隔离prepare/test/Grant后注册，安全点resolve并执行新provider | Task ID保持，registry CAS递增，旧调用保留旧snapshot，新snapshot含source/hash/evidence，无UIidle锁放宽 |
| Active acquisition 失败/重启 | 未知license、包/hash失配、依赖失败、scope扩大、取消/撤销、owner变化、并行prepare/CAS冲突、安装后激活前崩溃 | candidate阶段可解释，回滚/receipt/隔离产物可核对，无半Ready，无重发未知副作用，重启后可恢复或明确待核 |
| H23 与离线 | core原名称/schema通过正常入口，dynamic provider真实effect影响锁/重试，伪readOnlyHint/假provider identity拒绝，缓存有效/撤销/过期分别测试，外部源离线后native教育Tool继续可用 | 共用execution/permission/provider identity与bounded result，SQLite+journal读回，secret不进普通DB/JSONL/日志 |

优先复用的测试入口为 `scripts/xiaozhi-agent/pi-mcp-boundaries.mjs`、`pi-mcp-ui.mjs`、`fixtures/mcp-server.mjs`、`capability-phase2-contract-smoke.mjs`、`capability-phase2-production-smoke.mjs`、`permission-phase3-windows-smoke.mjs`、`permission-phase3-runtime-smoke.mjs`、`permission-phase3-production-smoke.mjs` 与 `scripts/acceptance/configuration-mcp-journey.mjs`。这些现有文件的历史结果不能替代新stdio/CPU/内存模式的运行证据，现有Node fixture也须先满足自身运行时recipe与沙箱兼容要求。

## 7. 实施顺序与交接依赖

1. writer 冻结 helper 双向协议、预算单位与错误语义，保留 v1 兼容和恢复入口。
2. C# stdin pipe/独立 writer/Job budget 与 launcher byte-session 接线，先用已支持 PS5 合成 server。
3. 公开 McpTransport adapter、原 runtime factory、stdio process/dependency/secret Scope、owner隔离及撤销。
4. 真实端到端、背压/取消/冷启/崩溃与资源超限验收，按已验runtime范围解除guard。
5. main-private acquisition coordinator 与已验证runtime/package recipe。Registry safe refresh、dispatcher adapter、H23 identity/effect/validator共用接线。

Phase4 writer 当前占用 Skill/SQLite 相关区，后续 acquisition 对 Skill dependency 的接入须在其冻结共享协议后串行整合。CPU/内存字段变更会影响 helper源码清单、build-time recipe、manifest/helper hash、health、recovery与旧运行时receipt，须同时验证。跨机runtime供应、asar、完整市场UI、PTY/ConPTY与完整Effect Ledger继续由既定后续合同安排。

本轮建议中的 helper mode、ack帧、会话API与资源错误名均为候选设计，尚未成为冻结wire或可运行能力。

## 8. 源码定位指纹

| 文件 | 本轮读取 SHA256 |
|---|---|
| `src/main/xiaozhi-agent/permissions/windows/NativeSandbox.cs` | `3e62dec0279d130f46e41cefb02f192760b94dfe74b364a44e47a0559cbb3a7b` |
| `src/main/xiaozhi-agent/permissions/windows/launcher.ts` | `726f321d9c4e99a7f898bcc06e6dc2b090e46df249b74705db36a81f6a9490da` |
| `src/main/xiaozhi-agent/mcp-runtime.ts` | `91f9c28d03c5841d124e6c369889f4c1ac076562bec6ba4048a780ec183b98f9` |
| `node_modules/@earendil-works/pi-mcp/dist/index.d.ts` | `243fee9cf318b4fb70528e8fc8ef5aa3811f5255ef278ad76a7b0e4ca83eaad8` |
| `node_modules/@earendil-works/pi-mcp/dist/client.js` | `e7cea15988abaef5b5a7d0c98bc597f47d4725678716ba04319265ca55a8c6ad` |
| `node_modules/@earendil-works/pi-mcp/dist/transports/stdio.js` | `c90e0c20bf1052a70fcac794b4b223b477a627f30cbab683203497b5cf769bba` |
