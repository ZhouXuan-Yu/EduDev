# Phase5 完整实施合同草稿

**DRAFT_REVIEWED，2026-11-17 经唯一 writer 合同审阅。Phase4 独立 Gate4 通过并完成 Git 整合后，由 root 正式 RELEASE。**

## 1. 交付范围与基线

覆盖T5.0–T5.5、12/13、H23、A-P0-03/05和M-01–09。原入口提供候选发现/状态、可信策略自动准备、未知隔离审批。贯通受控stdio、OS CPU/内存、core治理、active acquisition、Extension和环境/离线/撤销/恢复。

树D:/WorkProject/EduProject-harness，HEAD 052bd6885c4280b49ab36228fe9ac605799a769b+Phase4 WIP。writer仍只实施Phase4。本轮只写本文并做公开元数据读取，未构建/运行候选/安装/调用模型，新验收全NOT_RUN。

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

writer在正式 RELEASE 后按实际接缝冻结wire/budget/错误码、必要迁移/receipt、core清单、首批实际包/adapter/recipe/Extension、API/cache限额及精确命令。候选名称、帧大小、表布局与示例预算可随定向兼容测试收敛，H01–H31及本合同的真实交付结果保持。Phase4先验收整合，再按root RELEASE实施。本文状态为 DRAFT_REVIEWED，Gate5全部新验收保持NOT_RUN。
