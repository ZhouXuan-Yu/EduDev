# Phase5 完整实施合同草稿

**RELEASED，2026-11-17 root 已正式 RELEASE。实施基线为 Phase4 功能 4b73441 与 origin/main 37512e4 正常整合并 atomic 推送的 ffb6c907af1644cade65e917144a2be9a1b1d6d5。唯一 writer 串行实施 T5.0–T5.5，完成后交独立 Gate5。**

## 1. 交付范围与基线

覆盖T5.0–T5.5、12/13、H23、A-P0-03/05和M-01–09。原入口提供候选发现/状态、可信策略自动准备、未知隔离审批。贯通受控stdio、OS CPU/内存、core治理、active acquisition、Extension和环境/离线/撤销/恢复。

树D:/WorkProject/EduProject-harness，分支 codex/xiaozhi-harness-20261112，实施 HEAD ffb6c907af1644cade65e917144a2be9a1b1d6d5。Phase4 已独立 Gate4 ACCEPTED，整合后 build、tsc、305 项实施回归通过。Phase5 新验收在实际运行前保持 NOT_RUN，付费累计 0/200。

2026-11-17 审阅依据为 `00_HARNESS_DECISION_LOG.md`、`12_MARKETPLACE_AND_MCP.md`、`13_EXTENSION_AND_ENVIRONMENT.md`、`EXECUTION_BOOK.md` 与现有 core readonly seams。本文保留 2026-11-12 的公开来源查证及候选元数据，Phase5 实施时按选定版本更新精确来源证据。当前 Phase4 的 37 source 与 466 outputs 继续冻结，本文是下一阶段合同准备。

复用同目录PHASE_5_CORE_READONLY_SEAMS.md、PHASE_6_TERMINAL_READONLY_SEAMS.md与evidence/phase6/conpty-compatibility/REPORT.md。归档未改。PoC证明本机PS5受限ConPTY交互/resize/退出/取消，产品Grant/Task/UI仍未接入。

Pi唯一Runtime。原Registry/Task/MCP/Environment真源保留，市场为本地治理投影。复用现有页面，完整市场UI、持久PTY/后台、checkpoint/resume与跨机/asar沿后续阶段。

## 2. 复用与改动边界

下表省略apps/desktop/src/main/xiaozhi-agent前缀，冻结前核Phase4最终字节。

| 现有符号 / 文件 | 接续边界 |
|---|---|
| capabilities/{registry,resolver,provider-snapshots,runtime,dispatcher,provider-contract}.ts | 原Sql/CAS/快照/current/canRefresh/publisher.persist，扩stat专用executor/schema/result为validated adapter |
| mcp-runtime.ts / createMcpRuntime，permissions/mcp.ts | 原配置CAS、sealed secret、schema/selection、分页/锁/revoke，两处stdio guard同时接 |
| permissions/windows/的NativeSandbox.cs、PlatformInfo.cs及runtime/launcher/operations/projection/broker | 原pin、AppContainer/Job、投影/Grant/CAS/broker/cleanup，扩duplex/预算 |
| tools/{manifest,execution-bound,resource-lock}，permissions/{tool-runtime,provider-source,engine,store} | 共同执行/权限，补core身份和dynamic effect/scope/result |
| events/{journal,publisher,receipts}，verification/effect-readback，tasks/{task-state,coordinator} | 原owner/admission/SQLite receipt/readback，关联共享effect |
| ../managed-tools/{manifest,version-service,service,worker-client,worker} | createManagedToolVersion的下载/hash/health/lease，createManagedTools的freeze/atomicSelect/rollback；当前仅reviewed QuickJS |
| environment/{service,tools,api,runtime-diagnostics}，model-settings.ts / SettingsKeyCodec，ipc.ts:76–77 | 原诊断/repair、main safeStorage，扩recipe/secret引用consumer |
| skills/、managed-skills、managed-skill-runtime | Phase4不可变资源/Run快照，依赖接acquisition，不产生Grant |

拟新增marketplace/、capabilities/acquisition/、capabilities/{tool-governance,provider-adapters}、mcp-controlled-transport、environment/recipes。src/shared/xiaozhi-acquisition.ts及原共享类型增量扩展，API/preload分域，宿主仅装配。

## 3. 官方来源、当前响应与限制

### Official MCP Registry

REST v0.1读取servers及servers/{encodedName}/versions/{encodedVersion}，保存原namespace/version/_meta/schema，分页/字节/耗时有界。下游缓存低频抓取，目录无uptime/持久性保证。[官方聚合文档](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/registry-aggregators.mdx)

本轮GET https://registry.modelcontextprotocol.io/v0.1/servers?search=everything&limit=2&version=latest 返回200，Date为2026-11-12 13:19:02 GMT，count2，nextCursor为io.github.EcRal5t/everything-search-mcp:0.1.0，server schema为https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json。

| 实际候选 | 响应声明 / 未验证部分 |
|---|---|
| io.github.EcRal5t/everything-search-mcp 0.1.0 | GitHub EcRal5t/everything-search-mcp，npm everything-mcp-server@0.1.0，stdio。包内容/完整依赖/Windows环境待隔离验证 |

Registry验证namespace并托管metadata，代码安全由包平台/下游验证。official key仅说明元数据来源。应用独立核来源/许可/完整性/隔离，无签名记unavailable。[官方信任说明](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)

### GitHub公共发现

GET https://api.github.com/search/repositories?q=<encoded>&per_page=...&page=...，Accept application/vnd.github+json/API2026-03-10。公共repo匿名，100条/页/最多1000，保存incomplete/Link/限额头，匿名search10/min、REST60/h。[搜索](https://docs.github.com/en/rest/search/search)、[限额](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

Release latest仅发现，下载绑定精确asset/version/commit/digest，旧快照不变。[Release API](https://docs.github.com/en/rest/releases/releases?apiVersion=2026-03-10)

本轮search的q=repo%3Amodelcontextprotocol%2Fservers&per_page=1，Invoke-WebRequest/curl/web均失败，curl35 TLS，记PARTIAL，未遇账号401/403。以下替代成功，HEAD/main均e1dc4b18dbb948921da37f3d4224a628730b43b0。

    git -c http.proxy= -c http.sslBackend=schannel -c http.version=HTTP/1.1 ls-remote https://github.com/modelcontextprotocol/servers.git HEAD refs/heads/main

该精确commit的LICENSE已读取。当前MIT→Apache-2.0过渡，新代码/规格贡献Apache-2.0，未重许可历史贡献MIT，普通文档CC-BY-4.0。精确包/源码版本保存license文本hash及适用范围。[固定许可证](https://github.com/modelcontextprotocol/servers/blob/e1dc4b18dbb948921da37f3d4224a628730b43b0/LICENSE)

### npm与可执行替代

精确version保存来源/许可/engines/依赖/scripts/dist，下载核SRI/SHA256/tree，签名/provenance分列verified/unavailable/untrusted。[npm元数据](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md)、[签名](https://docs.npmjs.com/verifying-registry-signatures/)

https://registry.npmjs.org/quickjs-wasi/3.6.2 直接TLS失败。以下root提供的替代exit0，未下载/执行包或改全局配置，空proxy警告保留。

    npm view everything-mcp-server@0.1.0 version license dist.integrity dist.tarball repository engines scripts dependencies --json --proxy= --https-proxy= --registry=https://registry.npmjs.org/

返回MIT、git+https://github.com/EcRal5t/everything-search-mcp.git、Node>=22、SDK1.32.1/zod4.6.7，scripts为cli/start/test/test:live。tarball为https://registry.npmjs.org/everything-mcp-server/-/everything-mcp-server-0.1.0.tgz，SRI为sha512-ByrsLi9rZHo3fQEKnsm1RDOhnk6v5UtSXeCUpfnKFlqmRpHdZ3MQ0oDxv6HFepWp7gM+6eSeRMgmk2KNopeKrQ==。均为metadata声明，候选仍待包内容、依赖与运行需求验证。

本地替代quickjs-wasi@3.6.2，MIT，官方tarball https://registry.npmjs.org/quickjs-wasi/-/quickjs-wasi-3.6.2.tgz。既有managed-tools/manifest.ts保存archive568844B/WASM637405B及双SHA256，本轮与lock/package.json核对，未跑health。不可达时用已验证缓存/原计算路径，新候选待验证。无账号审批依赖，不降TLS。

## 4. 数据、契约与迁移

Candidate严格schema/keys/范围，保存source/API/schema、外部ID/version、repo/publisher、license、包/lock/tree/runtime/entry、Scope/effect、验证/expiry/revocation。main产生可信identity，metadata不能直接变Grant/Provider。

沿原Sql串行writer/transaction，拟新增四个附属表。

| 表 | 核心字段 |
|---|---|
| xiaozhi_discovery_cache_v1 | source+queryKey，API/schema、etag、fetched/expires、bodyHash、bounded normalized JSON、验证/失效原因 |
| xiaozhi_acquisitions_v1 | acquisitionId、原session/task/run/generation、requirementsVersion、candidateDigest、revision/phase、policy/Grant/evidence refs、effect/恢复状态 |
| xiaozhi_capability_artifacts_v1 | contentHash、package/version/runtime/entry/lock/license hash、受管相对路径、validation receipt、lease/撤销/阶段 |
| xiaozhi_tool_authorities_v1 | runId+callId、resolved core/provider/binding/snapshot身份、inputDigest、budget/Grant、原receipt/effect引用 |

原Registry和MCP app_settings各保原数据，adapter复核两端，不建平行active权威。xiaozhi_tool_receipts增量关联effect，旧字段保守readback。包体在<dataRoot>/capability-artifacts/<hash>，环境沿原root，staging与active分离。

以上表名、字段与目录是候选布局。正式 RELEASE 后先核对已有 artifact/version/lease/effect 记录，复用能够保存相同事实的现有表与服务，再冻结必要的增量迁移。Gate5 验证事实、原子性和兼容性，表数量与命名随实际接缝收敛。

安装先持久intent，再有界I/O/验证/rename，短transaction重核owner/Grant/source/revision注册。DB与文件间receipt reconcile，失败保留旧active。迁移验证新旧库/中断幂等。旧stdio不自动执行，Skill/Task历史与资料不重写。

## 5. T5.0受控双向stdio

锁定pi-mcp1.0.2公开McpTransport、McpClient.connect、parseJsonRpcMessage。adapter实现start/send/close/onMessage/onError/onClose及可选setProtocolVersion，复用原client握手/list/call/取消。原StdioTransport内部crossSpawn无替换接口，不走普通权限回退，不深导入非公开TransportEvents。

helper拟v2 mode/manifest，兼容v1/cleanup-owned/platform-info。start锁execution/owner/Grant、runtime/entry/package hash、argv/cwd/env/budget，仅main计划进入launcher。通用server需受管recipe/tree/映像pin，缺runtime由Environment准备，不改系统ACL。

真stdin pipe与控制NDJSON分层。新增序号stdin bytes/ack/input-close，唯一终态。草案限chunk16KiB、4帧in-flight、队列64KiB、单JSON-RPC256KiB，累计输入/输出/频率按recipe限量。send在写入确认后resolve，拒绝乱序、越权与终态后写。control reader/child writer独立，stdin阻塞时cancel/父退出仍能结束Job。EOF后有界drain，超关闭预算回收。

launcher私有byte-session，stdout解析UTF-8 NDJSON，stderr独立脱敏。畸形/无换行/超限/EOF/error使pending settle，初始化悬挂与忽略取消均有Job硬停止。

inspect/connect与每call经实际Scope，核source/schema/selection/revoke。Task/Grant/secret consumer隔离，lease持续到cleanup，revoke关闭对应Job。

### 5.1 stdio 服务与单次请求的生命周期

stdio 启动取得 main 持有的服务 lease，绑定 Task、当前 Run/generation、server/package/runtime/schema 身份及实际 process/filesystem/network/secret Grant。lease 覆盖服务在存活期间实际持有的资源，包括已经注入的 secret 与 owned 投影。主进程逐 call 重核 owner、Grant 与 schema，撤销监听和父生命周期负责服务等待请求期间的监管。关闭、撤销、owner/generation 失效或明确 lease 到期时回收对应 Job，再完成受控清理。跨 Task、consumer 或包版本使用独立会话。

初始化 timeout、单次 tools/list 或 tools/call timeout、stdin ack/backpressure timeout、关闭 grace 与服务 lease 分别保存字段、起止时刻及错误原因。单次请求 timeout 先结束该 pending，按原 MCP 客户端发送取消并核验结果。需要关闭失去响应或结果未知的服务时，保留本次 effect 与其他 pending 的实际状态，再让 Task 按原恢复/替代路径继续。一个请求结束后，健康且授权有效的服务可继续处理同一 Run 后续请求。

前台 `exec_command` 沿自身命令 deadline。stdio 服务采用其独立的 owner lease 和 recipe 资源策略，支持总墙钟时间超过一次前台命令预算的正常多步骤 Run。测试必须在同一 Run 内跨越单请求 timeout 窗口后再成功调用服务，并分别验证请求超时、撤销、generation 变化和应用退出的清理。

Phase6 的长期 Task/PTY/后台 lease 以稳定 leaseId、owner、state、revision、expiresAt/renewal policy 与 cleanup receipt 接续。当前阶段的 Run lease 在 owner 变化时明确终止，后续跨 Run 采用显式重新验证与接管协议。

Phase6预留PTY mode的VT单流/resize/EOF。PoC确认显式环境需保留LOCALAPPDATA，PTY用STARTF_USESTDHANDLES+三NULL标准句柄防父重定向沿用。stdio保留显式双输出pipe。本阶段不把旧WIP直接pty.spawn接回，不宣称已交付持久PTY。

## 6. T5.4资源与Extension隔离

resume前设置/query Job限制，失败清理并报unsupported_constraint/resource_limit。Job memory512MiB、CPU cap2500/10000、累计user CPU30s、前台deadline120s属于原草案示例。正式数值由 main 策略、已有 Grant、运行 recipe 和真实任务需求确定，保存单位、作用对象、计量窗口、有效 lease 与终止语义。模型只能在获准策略内申请预算。

memory/CPU rate 对实际服务 Job 及全部后代持续生效。累计 user-time 与墙钟 deadline 分别按前台命令、单次受控执行或服务 lease 声明适用范围。服务跨多个请求运行时，累计执行量预算需按该服务完整工作负载冻结和验证，健康多步 Run 可在有效 lease 内持续使用服务。父控制通道、心跳/撤销和 cleanup 各自保留有界资源，子进程背压期间仍可响应停止。

内存JOB_MEMORY 0x200/JobMemoryLimit，必要时PROCESS_MEMORY 0x100。CPU rate用class15 ENABLE|HARD_CAP，累计user-time另用JOB_TIME/100ns。保留kill-on-close/process/output/deadline，补input。监督器/完成端口记录真实超限与终态，allocation失败可能被guest捕获，CPU节流测实际份额，不能按普通exitCode猜资源错误。嵌套Job/API不支持明确报告。[内存](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information)、[CPU](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information)

外部Extension进入同helper或已受控worker，main只持内置可信adapter。窄版本化RPC限制schema/参数/结果/速率，文件/网络/进程/secret/IPC回main授权。禁止第三方main import/eval/require或任意IPC channel。默认零网络capability，获准请求沿原broker/egress。现QuickJS guest无host IO/VM预算可保留，普通worker spawn/V8堆上限不能替代新外部代码OS隔离。

Extension有pin/schema/cancel/health/log/更新撤销回滚。钩子逐项RPC合同，不支持项明确unsupported。

C# 增量按领域拆入新 `.cs` 文件，例如 duplex pipe/control、Job resource limits、受控会话监督和协议 DTO。原 `NativeSandbox.cs` 保持入口与既有边界的薄接线，编译 recipe 与 source manifest 覆盖实际全部源文件及 helper hash。新 mode 与 Phase6 ConPTY 共用身份/Job/lease 合同，stdio pipe 和 VT/resize 协议各自明确。

## 7. H23全部核心Tool与动态Provider

从最终真实production Session收集core、Skill Creator、Environment、MCP、Dispatcher定义，治理集合必须等于注册集合，未知/重复Tool阻断注册。core保留原name/schema/专用实现，登记main-owned source/version/schemaHash、effect/idempotency、scope builder、domain validator与receipt/readback。内部控制也显式登记intrinsic策略，不能因缺scope隐式跳过。

全部入口经原执行/Permission边界、Registry身份、effect/结果验证。core投影引用原实现，dynamic经adapter。capability_execute从真实binding解析effect/lock/retry/activeEffectCount，新写Provider不可继承stat safe_read，hint不授信，sourceHash覆盖实际实现/schema。

副作用dispatch前经原admission/journal持久共享Intent，Executing后按实际回执/领域读回Commit，取消/超时且未核对为Reconcile/unknown。复用events/receipts、permission audit、effect-readback关联同executionId，保留原业务确认/CAS。安装、写入、未知外部效果不盲重发，原安全只读重试规则保留。

CapabilityExecutionResult通用化，按binding validator校验，兼容Pi/旧stat，带snapshot/provider/source/schema/version/artifact/conformance/effect。core也附身份/回执，外部内容untrusted。Phase5完成安装/core effect全接线，Phase6扩checkpoint/后台恢复。

### 7.1 私有来源捕获与历史拒绝链

调用的表面 Tool name、逻辑 Capability、真实 Provider/binding/snapshot 与 executionId 一并进入可信执行上下文。领域结果分类与实际成功读取回执确定 teacher-private 来源，覆盖原核心 Tool、MCP Tool 及 `capability_execute` adapter 返回的私有文件/资料正文。统一治理接线须沿 Phase4 已有 private-context 捕获与销毁路径，处理真实成功结果的全部适用文本，动态 Dispatcher 的名称变化继续保留同等拒绝证据。

恢复时沿已验证 native session identity 和真实历史读取回执重建拒绝指纹。Provider 身份/result schema/provenance 的新字段版本化，旧 core 历史继续由既有 reader 解释。新 dynamic 历史须能核验原 Task/Run、Provider/来源分类及实际返回文本，再进入原 historical callback。日志与通用治理元数据保存有界身份/摘要和引用，私有正文遵循原会话数据合同，拒绝指纹继续只影响发布判定。

Gate5 增加真实 dynamic adapter 读取 owned 合成私有源、下一步 Creator 引用片段被拒、同 Task 后续 Run 与冷启直接引用旧片段仍被拒的证据。原 core 私有读取与普通泛化方法发布同时回归，并检查撤销、无 Grant 和失效来源的读取次数。

## 8. Pipeline与active acquisition

状态为discovered→quarantined→validating→policy_pending/blocked→preparing→verifying→ready→registered，另有failed/cancelled/revoked/rollback_required。各段revision/owner/证据/恢复明确，验证且提交后registered。

- sources仅候选，保留来源/version/time/hash，query脱敏，坏条目隔离。
- 核repo/publisher、包/完整lock/license/SRI/tree/entry/runtime/scripts/Scope。remote核endpoint/egress，redirect逐跳核host且凭据不跨域。
- 解包拒绝链接/硬链接/穿越/ADS/设备名，限制文件数/膨胀比/字节/磁盘。quarantine执行本身经Grant。默认禁lifecycle scripts，确需者按recipe隔离审核/授权/回滚，禁止main执行npx latest或全局npm install。
- 可信来源/许可/依赖/权限满足当前模式和已有Grant时自动prepare/health/activate，无泛化追加确认。未知许可、不可审脚本、扩大权限/外发保留pending/blocked，沿原审批UI显示差异，fullAccess仍限获准资源。
- 内容寻址staging经health/schema/功能验证后CAS注册，失败保留旧active，同version变bytes报source_changed。

签名和 provenance attestation 各自保存 verified/unavailable/untrusted 及证据引用。缺少可用签名时，策略继续依据已明确的来源、完整性、许可证、依赖闭包、隔离和当前授权作出判断。确有签名要求的来源/recipe 保存其明确规则及失败原因。Official MCP Registry 的收录保留目录来源事实，包安全与激活决定由完整 pipeline 的独立验证记录产生。

至少选择一个可信来源的实际锁定包及真实 Provider adapter，贯通真实 archive/lock/依赖/许可证核验、隔离准备、启动/连接、功能验证、Registry 注册和 Pi 执行。具体包根据所需能力、Windows runtime 与隔离兼容性选择，当前 everything-search 条目仅保留已读取的候选 metadata。合成 server/包用于可控故障和协议测试，Gate5 另有实际包的来源/字节/安装/功能证据。

拟增稳定capability_search/capability_prepare，原inspect/resolve/execute承载状态/健康/执行，同步pi-session固定名称检查、manifest/catalog/typed测试。输入为候选引用/digest/逻辑requirement，模型不能指定任意安装命令或权限布尔。Skill依赖复用同host服务。

acquisition属原Task子操作，不放宽owner/settingsBusy或借UI idle-only入口。每await/提交核Task/Run/generation/requirements/Grant/source/schema/CAS，无未决effect安全点refresh，旧调用保留snapshot。

active链先走稳定Dispatcher。显式新Tool另验公开Session重配/安全重建、停旧queue及SQLite同Task恢复。关闭/撤销/owner变化取消Job，restart核receipt，不重放未知effect/scripts。

## 9. Environment、秘密、离线与撤销

recipe锁来源/version/hash/依赖/license/platform/ABI/env/port/service/scripts/budget/health/rollback。复用prepare/lease/freeze/atomicSelect，health后切指针，旧lease保留，在用卸载等待/取消。main认可recipe，helper核平台/PS/csc/source/manifest。

配置按expectedHash/CAS修复，未知字段保留。缺依赖/权限、端口冲突、health/离线/空间失败进入原Environment状态与可操作修复。runtime需要ACL/MIC时复制到owned环境，教师/系统目录不改。服务supervisor持续Grant监管，不能复用Tool返回即删除active的短期context冒充长期lease。

秘密沿safeStorage，引用绑定provider/source/version/consumer/Scope，仅内存解封必要值。缺密钥走原安全输入，其余验证继续；解封失败明确storage_unavailable/configuration，不找其他key兜底。secret不进Skill/candidate/恢复JSON/日志，helper审计仅引用/digest，撤销关闭会话。

缓存区分发现metadata与已验证安装，保存API/schema/hash/etag/fetched/expires/撤销tombstone及lastCheckedAt。离线只用hash完整、已验证、未过期且无已知撤销本地版本，必要新证据缺失保持待验证。源离线不影响native教育能力。schema/权限扩大重新审核，旧selectedTools不能承接新范围。

revoke先持久失效，再取消所有关联请求/Job/secret lease，阻断新调用并保留审计。schema变化停止旧schema后续dispatch，重新验证才trust。卸载仅owned artifact/cache/profile/ACE，原cleanup核main身份，撤销Grant不妨碍精确清理。

## 10. 前端、真实验收与实施门禁

复用office下PiMcpSettings/PiManagedTools/PiEnvironmentSettings、权限卡和Task事件，显示来源/版本/许可/状态/进度/离线及取消重试/撤销回滚/安全输入。typed API核caller/schema/revision/owner，公共结果脱敏，控件在现页面可达。

新测试全部NOT_RUN，后续记录命令/数量/失败skipped、raw协议、SQLite/文件/重启/清理。

| 集合 | 必需真实证据 |
|---|---|
| P5-01 / M-01 | 双来源规范化、分页/限额/坏条目、固定ref/精确npm、源不可达缓存 |
| P5-02 / M-02/03/04 | candidate无生产执行；未知license/hash/scripts/scope隔离审批；至少一个可信实际锁定包自动准备/功能验证/注册/执行；签名unavailable在明确来源与隔离策略下的判定 |
| P5-03 / H23 | 最终Session全部Tool治理覆盖等值，正常/越权/未知Tool，真实effect/锁/重试/validator、source/schema变化；core/dynamic私有来源捕获及续聊/冷启拒绝链 |
| P5-04 / T5.0 | 原MCP Runtime→公开Transport→helper initialize/list/call、Unicode/分块/双stream、坏消息/背压、初始化/调用取消；同Run多请求跨timeout窗口仍可用及lease终止清理 |
| P5-05 / 权限 | 缺process/package/secret Grant、binary/tree变化/链接、direct socket/sibling拒绝、owned成功、父退出/strong-kill恢复 |
| P5-06 / T5.4 | 父/child聚合commit到限、捕获分配失败、CPU rate测量/累计user-time终止、API不支持及全部预算/清理 |
| P5-07 / active | 原Pi active Task发现→prepare→注册→安全点resolve/execute，旧新snapshot，取消/撤销/owner/CAS竞争 |
| P5-08 / M-05/06 | schema与新增权限重审，伪readOnlyHint无效，密钥重启/替换/解封失败/echo清理 |
| P5-09 / M-08 | Extension未入main，窄RPC正常/越权/畸形/超限，disable/revoke/health/回滚 |
| P5-10 / 恢复 | 安装中断、落盘注册间/切换后崩溃，新旧库迁移/重启，并发prepare、在用卸载、保留旧active |
| P5-11 / M-07/09 | 缓存有效/过期/撤销分别测试，源离线native可用，撤销关闭旧会话并阻断新调用 |
| P5-12 / UI | 真实Electron原入口发现/准备/未知审批/取消重试/撤销回滚/安全输入，两尺寸与重启读回 |

复用scripts/xiaozhi-agent的pi-mcp、capability-phase2、managed-tools、permission-phase3专项及scripts/acceptance/configuration-mcp-journey.mjs。拟扩phase5-{sources,acquisition,governance,stdio,resources,extension,production,ui}-smoke.mjs，writer冻结命令/断言。

门禁为npm run build、npm run test:renderer-components、专项、关键路径npm run test:smoke、git diff --check，最终源码/helper/manifest/out同字节留证。fixture与外部API可用性分列，安装限合成数据根，须Pi/Electron用户链。付费沿root账本，本稿0次。

## 11. 顺序、回滚与冻结

顺序为schema/迁移/core清单→duplex/OS预算→MCP授权→sources/cache/pipeline/recipe→active→Extension/Environment/UI→集中测试及Gate5。

helper同步source/hash/manifest，旧v1/receipt可读。失败保留旧active，guard仅按已验runtime解除。可停新adapter并保留native，禁止普通spawn回退。回滚保留表/证据，清理核owned/lease，未知effect待恢复。

writer按实际接缝冻结wire/budget/错误码、必要迁移/receipt、core清单、首批实际包/adapter/recipe/Extension、API/cache限额及精确命令。候选名称、帧大小、表布局与示例预算可随定向兼容测试收敛，H01–H31及本合同的真实交付结果保持。Phase4已验收整合，root正式RELEASE有效。Gate5各项在实际验证后逐项记录，阶段完成由独立验收决定。

## 12. 2026-11-17 首片实施检查点

基线 ffb6c90，root 随后仅更新 Goal 状态并提交 7a93b4b，生产实施沿同一代码基线。当前 Phase5 IN_PROGRESS。

受控 helper 新增 `SessionOptions.cs`、`SessionInput.cs`、`SessionPackage.cs`、`JobLimits.cs`，原 `NativeSandbox.cs` 采用 partial 领域薄接线。保留 schemaVersion1 的旧 start/cancel/result，新增严格 `session.schemaVersion1/mode=stdio` 子协议、input/input_ack/input_close。公开 Pi `McpTransport` 接入位于 `mcp-controlled-transport.ts`，原 Runtime 接受 main-private factory，缺失 factory 的旧配置继续保留可诊断守卫。

stdin 单帧 16384 bytes、最多4个待确认帧、消息队列1048576 bytes，JSON-RPC消息262144 bytes。main 构造参数字符串，helper独立writer与control reader保证阻塞输入期间取消可达。Session/Task owner、Grant、包/执行物/资源与原执行ID关联。当前服务 Scope lease 使用原 PermissionEngine.run 保持 active，直到真实 terminal/cleanup 才释放，owner监管沿 `permissions/lease.ts`。服务 lease 与初始化/每次请求/关闭预算分开。

Job memory与CPU rate在resume前设置并Query读回，聚合user-time按显式服务策略可选，completion port采集实际资源超限。包目录采用Medium标签与只读pin，Low进程保持读取/执行，运行期间源码包修改被隔离。新资源协议由manifest标明sessionProtocolVersion与jobResourceProtocolVersion，受管编译recipe、Vite资源复制同步全部C#源。

本机系统PS5已从旧10.0.26100.8875更新为10.0.26100.9949，当前SHA为 `d8f182560210d43baaf767d482ad1dc1207372522e91413b9d5e515a875e552d`，原platform-info实际读回Microsoft Windows/catalog verified。旧shipped pin `60c9b298`正确返回executable_changed。测试经原Runtime.prepare、明确dependency Grant与实际Framework编译生成当前OS兼容managed helper，再通过原AppContainer health。源码固定pins继续保留旧发布事实，受管版本按当前平台证据建立。

当前 `node scripts/xiaozhi-agent/phase5-stdio-smoke.mjs` 实际5/5 PASS、exit0，报告 `apps/desktop/test-results/xiaozhi-agent/phase5-stdio-oAX2Z4/report.json`，原始日志 `%TEMP%/xiaozhi-phase5-stdio-service-eighth.log`。覆盖当前运行时受管准备、公开Pi initialize/list/多次call及Unicode/108KB分块/独立stderr、取消全Job清理、原McpRuntime+PermissionService服务lease跨call保留与实际Grant撤销、真实累计Job CPU超限。所有数据owned TEMP，付费0。typecheck已在该接缝此前候选通过，最终完整构建/资源矩阵/主Host装配仍待本阶段后续集中验证。

首批失败完整保留于各 `phase5-stdio-*` 报告和 `%TEMP%/xiaozhi-phase5-stdio-*.log`。包括夹具目录未用原GUID格式、旧OS pin、夹具Sql缺transaction与SDK返回形状，及受控包pin使用过宽句柄导致读取/cleanup共享冲突。修复保留原安全门禁，当前包pin使用只读访问，并在Job停止后、ACL清理前释放。原Runtime/Service接线已在真实fixture验证，生产Host尚待已验证获取记录resolver装配。

实际公开包候选已读取npm官方元数据并以 `npm pack --ignore-scripts` 下载隔离包，候选为 `@modelcontextprotocol/server-filesystem@2.3.0`，Node>=24。包内缺少其metadata指向的LICENSE，已从npm provenance声明定位源commit `e1dc4b18dbb948921da37f3d4224a628730b43b0` 并读取该commit的官方LICENSE，保留Apache-2.0/MIT过渡与文档CC-BY-4.0说明。attestation当前仅取得声明和subject digest，密码学验签状态待实际核验。当前候选仍待完整依赖锁定、许可证、隔离运行与功能验证，安装/激活尚待pipeline实现。

上述候选原始读取根为 `%TEMP%/xiaozhi-phase5-package-probe-704b4d7b34c844fcab0559fbac0e707b`，包括pack.log、精确tgz、attestations.json与SOURCE-LICENSE.txt。公开原始metadata/签名声明日志另为 `%TEMP%/xiaozhi-phase5-filesystem-package-metadata.json` 和 `xiaozhi-phase5-filesystem-attestation.json`。本机 `D:/Node/node.exe` 实际24.12.0、89935872 bytes，Authenticode为OpenJS Foundation Valid，可供受管运行时recipe验证，仍须锁定复制后的hash与隔离运行证据。

后续串行继续 acquisition 事实/发现缓存/安全包与recipe、真实适配器、Host装配、H23治理与私有来源历史链、Extension/Environment及typed页面，最后集中固定Gate5回归与冻结。Phase6继续保留seam，阶段接受由root独立验收。

## 13. 2026-11-17 原 Task 纵向链实际检查点

`node scripts/xiaozhi-agent/phase5-production-smoke.mjs` 在真实 Electron main、原 OmniEduStore/Pi/Task/Journal/PermissionService 上执行，模型接口仅 loopback SSE。最新新建 owned 根为 `%TEMP%/xiaozhi-phase5-production-grcqce`，报告为 `apps/desktop/test-results/xiaozhi-agent/phase5-production-nlWELK/report.json`，实际5/5 PASS、exit0、skipped0、付费0。原始日志在同目录 `worker.log`，工具原文仅该合成运行的 `native-tool-bodies.json` 与 `owned-canary-probes.jsonl`。

实际公开包 `@modelcontextprotocol/server-filesystem@2.3.0` 经原 Task 的 candidate search、精确 npm 依赖锁、SHA512、逐包许可证与安全解包、受管 Node、bundle、原 dependency/network/process/MCP 审批、真实 AppContainer function probe 后注册 Registry。单次原 Task 内 resolve/snapshot/execute 读取 `nested/private.txt`，随后 Creator 拒绝同 Run 私有片段。下一 Run 与 cold main 续聊均从原 native 历史重建拒绝。fullAccess 在原 Task 已满足的准确 Scopes 内自动 prepare/resolve/execute，零新审批、零新增来源 GET，全部本轮 terminal 的 Job active0/profile removed/owned ACE0，main active lease0。

本次新根 prepare 主链58378.8735ms，续Run6200.0334ms，cold main续Run6550.8439ms，fullAccess已有安装自动链17601.2223ms。当前仅为真实单次运行时延，最终阶段性能尚待统一采集。公共元数据读取30s，大于8MiB的固定资源读取180s，二者均受原 Task 取消。受管 Node fast path 仅接受固定24.12.0、89935872 bytes及官方固定SHA的本地文件，缺失或不符沿同一 installer 从固定 nodejs.org 获取。此前新根 `phase5-production-588w7i` 已真实走缺失分支，下载89935872 bytes并核验SHA/官方许可证。

此前 `phase5-production-588w7i` 3/4保持FAIL，实际Node image清理时过宽MAXIMUM_ALLOWED遇共享冲突，留有一条ACE1。修复改为清理仅申请READ_CONTROL/WRITE_DAC/READ_ATTRIBUTES，并在清理前wait/close真实process handle。对原owned安装根原Task续跑 `phase5-production-pTzt0v` 4/4 PASS，仅证明该范围。本轮进一步发现root pin请求DELETE与Node目录锚定chdir句柄共享冲突，根pin改用原ACL/属性权限且保留禁止删除/重命名的share barrier，临时cwd shim已删除。最新helper为 `915a468e8747b93db77f3fb2c7424e43405ccd7ba973cad029af8b510ef5cf0f`，52736 bytes。未通过cleanup的后续运行将保留完整projection及原identity，并记原permission audit的cleanup_required。旧失败目录与日志继续保留。

另有实际修复包括Framework csc深staging路径CS1619，staging改短GUID名并保留失败输出审计，以及公开包Schema的default注解，限定有界JSON默认值兼容。普通包不进入main import，esbuild仅做可信编译器静态解析。Node大文件使用异步流hash/copy与crypto worker，受控会话在实际文件版本未变化时复用本Run已核验摘要，copy目的及helper执行物仍独立核验并pin。

typed共享入口冻结在 `src/shared/xiaozhi-acquisition.ts`，preload提供 `getXiaozhiAcquisition`、`searchXiaozhiAcquisition`、`mutateXiaozhiAcquisition`，main仅认主窗口caller、严格输入、原active Task owner。prepare沿原Task，cancel/revoke可实际中止，view的context仅由main投影。UI_SOURCE_RELEASED由root分派独立writer，writer边界为现有三设置页、紧邻组件及其专属脚本，父消费者仅两处sessionId props已另授权。生产/out仍由本writer持有，尚未最终冻结。

本检查点的其余必需项仍IN_PROGRESS，包括H23全部core治理、Extension窄RPC与生命周期、secret引用与schema/版本回滚、未知来源审查及离线撤销/中断竞争、资源聚合内存和CPU rate实际矩阵、UI真实Electron与最终仓库门禁。此记录不构成Gate5阶段接受。

## 14. 2026-11-17 治理与生命周期实施检查点

H23 已覆盖最终 Session 全部具名 Tool 和选定 MCP Tool。保留原名称、输入 schema、原实现与领域校验，通过原 CapabilityRegistry、ProviderSnapshot 和 xiaozhi_tool_receipts.contract_json 保存来源/schema/inputDigest、Task/step/planRevision、effect、Scope policy、真实 Grant refs 与内层 authority refs。动态 MCP readOnlyHint 不改变 external_effect 或单次尝试。原 Dispatcher 结果的 teacher_private 分类与原 native 历史继续进入私有指纹拒绝链。最新 `phase5-governance-DfQjuC/report.json` 实际10/10 PASS、exit0，源目录为 `%TEMP%/xiaozhi-phase5-governance-74dOCt`。此前实际 Host 原5项在 `phase5-production-xVp8uP/report.json` 全过，后续源码增量仍需统一重跑。

MCP 密钥采用原 safeStorage 密封保存，仅向 renderer 投影版本化引用。Secret Scope 在解封前检查，替换使用原 catalog revision CAS，清空旧信任并等待旧客户端和原 lease 清理。冷启动、替换后旧 Grant 不匹配、安全存储不可用、clear、普通字段泄漏/NUL 注入和合成 secret echo 脱敏，实际 Electron 专项 `phase5-mcp-lifecycle-WCHlSw/report.json` 8/8 PASS、exit0。当前另补 live schema mutation、离线重连及旧 closure 撤销的固定增量，尚待集中11项结果。

Extension 外部入口仅在原 AppContainer 的 Node worker 中加载。主进程只读取静态 edudev.extension.json、LICENSE 与有界目录快照，保存 local_import 的实际 picked path、目录指纹和 sourceHash。内部身份 edudev-local 与来源 provenance 分离，未因包声明远端地址而授信。原 Extension install/run、dependency、process、空 workspace read Scopes 继续由原 PermissionEngine 处理。受管 Node 与 MCP 共用固定官方 recipe 和 prepareManagedNode。原生叶子 RPC16/16、隔离生命周期21/21通过，包管理最终固定18/18通过，分别为 `%TEMP%/xiaozhi-phase5-extension-protocol-dSa72q/report.json`、`xiaozhi-phase5-extension-4WTRx3/evidence/report.json` 与 `xiaozhi-phase5-extension-package-sO3nK8/evidence/report.json`。包管理保留前两次 Runtime promotion EPERM 及 CJS.js 被父 type module 误解释的真实失败。promotion 现在逐次复核 authority/目录 identity/helper hash，并异步有界重试，最终失败保留 stage。父 package.json 改中性元数据且进入 artifact hash，六种真实模块格式均已隔离运行。

资源叶子真实固定10/10通过、15次原 helper 执行。报告 `%TEMP%/xiaozhi-phase5-resources-YZnxE4/evidence/report.json` 保留父与两 child 聚合 commit、caught allocation failure、CPU hardcap Query 与8秒测量、累计 user-time、8种非法预算及全部清理回执。Windows20核机器低 cap 实测0.126CPU、参考0.986CPU，原始峰值和终止采样边界保留，其他 OS 未计通过。

Host 已接实际包准备、原 ExtensionService、Registry、原 Task 内 extension_inspect/prepare/invoke 和统一 Provider result。只向扩展传入公开有界文本，使用应用 owned 空目录。版本选择完成实际新 health，可更新/回滚，停用与撤销可在 idle 执行。typed acquisition view 增加可选 extensions，三原 API 语义保留，本地导入经 main 原生目录 picker。renderer 的 artifact revision 与 selectionRevision 分开使用，prepare/select 要求当前 Task，长 prepare 可轮询和取消。独立 UI writer 当前27/27通过，真实 Electron 页面及 picker 长等待反例仍在收尾。

Host 扩展专项已有6项功能断言全过，涵盖真实 Pi 双钩子、私有来源拒绝、更新回滚、idle 撤销、cold main、旧 snapshot 优先撤销与所有 Job/profile/ACE 清理，但 U2MNCs、SZ2f88 等候选在 Electron NAPI 环境退出134，整体仍为 FAIL。原始 worker.log、report 和 synthetic native bodies 全部保留。原 lease close 已补等待在途监管 assert，Host 关闭也取消并等待扩展准备/导入/选择工作，最终正常退出仍待复验。本节记录各专项实际范围，Gate5 与最终源码/out 冻结尚未完成。

## 15. 2026-11-17 集中门禁前收尾

独立只读诊断在 owned TEMP 复用原6项 worker，以 sqlite3 async_hooks 和串行 writer 提交栈实际证明冷启动 skillsReady.then 的 SkillGovernance.initialize 尚在事务 finally work.close 时，Host 已返回并关闭 SQLite。精确现场为 `%TEMP%/xiaozhi-exit-diag-b0b855947ea649a7890c97db4d9bceec/exit-evidence.json`。sealRoute 是此前待证推断，实际残留来源为 skillsReady。Host.close 现先等待 skillsReady，另独立登记原 execute Promise，使 waitForRun 和关闭 join terminal 后的完整原执行。最新 `phase5-extension-host-qq0Av2/report.json` 实际6/6 PASS、Electron exit0，退出 sqlite3 未完成资源为零，额外核验中断 intent 的公共可重试状态与原 SQL intent 保持一致。

最新原 Pi 主链复验 `phase5-production-nYlhZl/report.json` 5/5 PASS、exit0，复用 `%TEMP%/xiaozhi-phase5-production-grcqce` 原 Task 与既有已验证公开包，本轮复验范围包括 H23 全定义覆盖、真实 Grant refs、私有来源续聊/冷启和已有 Scope 内的 fullAccess 自动调用。原始 stdout 为 `%TEMP%/xiaozhi-phase5-production-final-2fd0cd4cf3d64121b59d35064ce5a21e.log`。

MCP 生命周期最终增量 `phase5-mcp-lifecycle-Wc9hBl/report.json` 11/11 PASS、exit0，包含原 DPAPI8项、真实 live schema mutation、离线重连及撤销旧 closure。stdio 固定5项在 `phase5-stdio-brrM1u/report.json` 再通过，真实同 Run 在2500ms单请求窗口后继续调用，另一个请求实际 timeout 后独立新请求成功，服务 lease 保持原 Scope 监管。原始日志 `%TEMP%/xiaozhi-phase5-stdio-timeout-8d1374ea9cbe4268a7eee39dd7845e8f.log`。旧 ZqFwyx 因夹具把原 permission_denied 错预期为 schema_changed 而 FAIL，保留原报表，新增用准确错误码并独立断言 catalog schema_changed 与旧信任清空。

获取生命周期原固定14项在 `%TEMP%/xiaozhi-phase5-acquisition-lifecycle-L0xlV0/evidence/report.json` 14/14 PASS。两个实际缺口已修，整 lock 的 scripts/依赖许可证政策在任何 archive GET 前检查，已知撤销的旧 artifact 在新 Task 锁图 GET 前直接阻断。有效 artifact 可跨 Task 复用原锁图并逐文件重核，缺 Grant 仍沿原审批，缓存无 GET 时无 network Scope，过期或已知撤销不能离线续 TTL。源查询关闭受原取消监管，Sql migration 失败可重试。原12/2失败 wxMcuY 保留，原始最终 stdout 为 `%TEMP%/xiaozhi-phase5-acquisition-final-8111dc8fd968410c816a827bfe624f62.log`。

新增直接依赖仅 semver7.8.5，ISC，实装101065 bytes/53 files，用于准确 npm 依赖范围锁定。开发类型 @types/semver7.8.0 为 MIT、24724 bytes/45 files。复用原 tar7.5.22，BlueOak-1.0.0，当前2378959 bytes/262 files。新增 npm 依赖为 JS/类型声明，Windows 执行仍沿已有 esbuild、sqlite3 和受控 helper。受管 Node24.12.0 固定89935872 bytes、官方 SHA 与 LICENSE，各隔离版本使用独立 nlink1 文件和完整 hash 验证，许可证及运行时 bytes 保存于实际 artifact。

当前 renderer 最低门禁246/246 PASS，日志 `%TEMP%/xiaozhi-phase5-renderer-components-ed60fe4a9bad417cbf0901e9abd2f1d8.log`。Phase4 state 原21与 legacy Sql21分别通过，报告根为 `%TEMP%/xiaozhi-skill-phase4-state-phw4vP` 与 `xiaozhi-skill-phase4-state-yfnZtD`。Phase2 原 contract10通过，报告根为 `%TEMP%/xiaozhi-capability-phase2-contract-SpicHp`。构建候选已成功，最终固定源码的 build/smoke、真实页面、恢复后 stage 清理及 freeze 仍在收尾，Gate5 尚未释放。

## 16. 2026-11-17 Implementation 最终冻结交接

状态为 FROZEN_WAIT_GATE5。本节承接前述时间顺序记录，独立阶段接受由root负责。最终实现报告、原始报告索引、归档日志和完整源码/out身份位于 `evidence/phase5/implementation-writer-20261117`。

最后 Extension publisher fence 贯通原Run/Task下的 package attempt、binding intent、prepared 与安装/选择CAS。注册在选择提交前完成，失败保留旧active。最终 build、额外 tsc、Host6与实际UI8全部通过，Host原Electron子进程exit0且退出 sqlite3 resources 为0。Host报告为 `phase5-extension-host-IezAJv/report.json`，UI报告为 `phase5-ui-NYgYZy/report.json`。UI实际完成安全输入、外部效果工具选择、原生目录导入、原Task审批/下载取消重试、同Run隔离执行、双尺寸和撤销后cold读回，rendererErrors为0。UI独立组件最终33/33通过，governance最终为11/11。

原 `npm run test:smoke` 首次启动0case失败定位到主入口ESM `__filename`。四处路径读取最小修复后完整207/207、exit0。该次out清单独立保存。后续最后publisher fence进入新build，再通过受影响Host6/UI8，最终471out清单SHA256为 `3f4b9db94f1cc0f0e69960d1a5943506da7b88941e44577dc8d070d2f8b9102e`。2984源码/构建/测试输入清单SHA256为 `248b93c622ebcb849ebd59d1f40d80a79251e6178bbada97285a6a3952e46e07`，独立Phase8准备脚本另行持有。core sourceHash `79e6d2484ee488979d1f3a108b4536d88a06663de887efd8af36ecf511cb70f5` 逐源0差异。

恢复最终 `xiaozhi-phase5-extension-recovery-nbMgrU/report.json` 两个真实parent SIGKILL边界2/2通过。retry成功后旧完整orphan stage按attempt PID/UUID/owned身份/全hash核验清理，最后stage0。已落最终目录发生漂移时，Scope前返回source_changed、permissionRequests0、fetch0，原intent逐字段保持。恢复精确bytes后新Run显式retry零GET/零network Scope，旧选择和11Grant hash一致。

native-stat manifest保持ffb6c90精确字节，SHA256 `819aca5629e4c55fa3e4605e1c1e824af2964e75412dded68d71a34662d8a438`。Phase5 sandbox manifest SHA256 `4f6fb1963a5864ed424e1bffe7af67d172f1462149c6aca3403786c973c15dd5`，52736-byte shipped helper SHA256 `915a468e8747b93db77f3fb2c7424e43405ccd7ba973cad029af8b510ef5cf0f`。各真实managed helper另保存其编译身份。

资源API unavailable的真实OS分支为NOT_RUN，本Windows资源10项按全部支持实际通过。stdio坏ACK/背压及初始化悬挂取消联动留独立Gate5按既定合同补验。原HTTP MCP初始化deadline断言保留其原transport范围。付费保持0/200，性能统一比较留Phase8。本轮所有历史失败继续保留原状态与证据，最终writer交接后停止生产/out写入并释放runtime。
