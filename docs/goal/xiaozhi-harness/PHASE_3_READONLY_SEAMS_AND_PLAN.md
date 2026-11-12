# Phase3 只读接缝审计与最小实施方案

日期为2026-11-12。实施树为D:/WorkProject/EduProject-harness，分支为codex/xiaozhi-harness-20261112，HEAD为ab59604cf9937818ed387def21e737ade12264df。依据10_AUTONOMY_PERMISSION_ENGINE.md、13_EXTENSION_AND_ENVIRONMENT.md、EXECUTION_BOOK T3.1–T3.4及用户新增Phase3基础Environment Manager范围。生产源码、测试与root状态文档均未修改，未重建out，未commit/push，真实模型调用0。

现有图D-WorkProject-EduProject-agent-stream-tools用于定位，当前树图nodes=0，结论按本树源码与本轮合成探针。没有重建整仓索引。本报告为实施前方案，Phase3仍待实现与独立验收。

审计收尾HEAD已前进a915f4e06982dec5b8694092d568c7e79d8eb760，Phase2正在修改pi-session、execution-bound、manifest和capabilities领域。本报告以开工ab59604已接受基线及当时读取的接缝为准，Phase2最终接线需要在源码冻结后重新核对。此处没有提前对Phase2 WIP给验收结论。AppContainer/LPAC方案须通过Windows真实canary与实际复杂命令验证，helper符号存在本身不足以验收。

## 1. 当前真实接缝

| 接缝 | 本树源码位置 | 确认事实 |
|---|---|---|
| 四模式 | renderer/components/office/permissionModes.ts第1–39行 | request、acceptEdits、approveForMe、fullAccess存localStorage。main/shared/preload中未找到通用PermissionProfile或ScopeGrant实现。 |
| 自动批准 | renderer/components/office/PiEducationWorkspace.tsx第146–161行 | 三种非request模式对pending copy approval调用decideXiaozhi approve，在此路径行为相同。 |
| 终端准入 | main/xiaozhi-agent/pi-session.ts第790–795行，tools/terminal.ts第31–50行，file-write-policy.ts第2–3行 | 提示公开说明本机用户权限。beforeExecute仅assertFileWritesEnabled环境开关。workdir realpath限制在workspace，命令交原Pi shell执行。环境过滤隐藏部分命名凭据。 |
| Windows实际进程 | node_modules/@earendil-works/pi-coding-agent/dist/core/tools/bash.js第45–72行 | createLocalShellOperations使用child_process.spawn启动shell，设置cwd/env/stdio/windowsHide。没有AppContainer/restricted token装配。 |
| 可插拔执行后端 | 同包dist/core/tools/powershell.d.ts第13行，bash.d.ts第35–51、70–80行 | 公开PowerShellToolOptions.operations可替换BashOperations.exec(command,cwd,{onData,signal,timeout,env})并返回exitCode。可接native隔离launcher并保留原Pi输出/取消与现有终端UI。 |
| 统一执行门禁 | main/xiaozhi-agent/tools/execution-bound.ts第14、53–67、116–124、154–171行，pi-session.ts第860–878行 | schema快照、owner/epoch、callId、锁、超时、取消、attempt、beforeDelivery可复用。尚无通用Profile/Grant检查。beforeDelivery仅在逻辑调用首次准入，后续实际IO仍需最新授权。 |
| main装配 | main/xiaozhi-agent/production-host.ts第857–873行，tasks/plan-runtime.ts第108–112行 | barrier→active owner→Task准入→journal.admitTool。exec_command仅核对latest Task源，命令资源范围待接。 |
| MCP hints | main/xiaozhi-agent/mcp-runtime.ts第143、149–153、195–197行，tools/manifest.ts第20–26行 | annotations生成readOnly并参与trust/工具过滤，host提供的MCP名字被分类safe_read。当前MCP maxAttempts=1。 |
| MCP现有边界 | mcp-runtime.ts第67–76、203–216行 | 密封凭据、stdio inheritEnv=false、调用前Schema/最新选中tool核对、输入脱敏、signal、bounded结果均存在。stdio inspect/connect同样会启动外部进程。 |
| 活跃撤销缺口 | production-host.ts第239–248、1223–1227行 | mcpRevoke走mutateSettings，settingsBusy含active.size，活跃Run时入口返回busy。runtime.revoke改持久状态，在途调用没有按server/grant主动中止索引。 |
| 审批持久化 | main/xiaozhi-agent/persistent-state.ts第6–8、25–31、53–62、106–122行 | ai_confirmation_items/action_type=pi_office_copy保存source/target/sourceSha256/workspaceHash和run/call。transition为CAS。recover将executing→uncertain、pending/approved→interrupted。 |
| 审批协调 | main/xiaozhi-agent/approval-coordinator.ts第14、25–36、39–55、74–83行 | waiting内存Map持有Promise resolver。decide要求pending、waiter及当前Run。beforeCopy/afterCopy及verifyCopy可复用。 |
| 恢复与Task | control-tools.ts第80–92行，production-host.ts第434–442行，tasks/coordinator.ts第120–128行 | ask_teacher已有持久记录及显式新Run恢复，Task prepareResume/resume已有源与revision检查。审批续接可采用相同方向并保留原Task。 |
| 预算 | runtime-budget.ts第7–44行，production-host.ts第645、1395行，budget-state.ts第4行 | 有model/tool计数、等待暂停及abort，生产limitsEnforced=false。环境操作可复用计量和明确超时，避免静默恢复全局16模型调用/90秒教师任务限制。 |
| 受管计算/依赖 | main/managed-tools/service.ts第19–26、36–44、58–75、94–101行，manifest.ts第2–11行，worker.ts第6–32行 | QuickJS-WASI静态recipe、SHA/版本/health、队列、pin、active原子切换、rollback可复用。guest无host IO bridge，内存32MiB与2秒中断。 |
| 诊断与OCR | xiaozhi-agent/diagnostics/api.ts第5–15行、diagnostics/service.ts第9–27行，ocr-host.ts第65–66、95–102行 | 当前诊断为脱敏Run事件/应用版本导出，通用Environment Manager待建。OCR编译期manifest/文件认证和受控投影可复用。 |
| 用户入口 | xiaozhi-agent/ipc.ts第88–103行，preload/index.ts，renderer/components/office/PiSettingsWorkspace.tsx第35、50–51、112–126、163行 | mainFrame门禁、typed preload、资料与权限页、工作区选择/记忆撤销入口可复用。用户意图由main核验并落盘。 |

表内main与renderer路径均相对apps/desktop/src。node_modules路径相对apps/desktop。

## 2. 本轮决定性探针

所有文件均在本报告同目录，数据为自有TEMP合成fixture。

1. node terminal-canary.mjs通过，证据terminal-canary-report.json。直接调用原createTerminalTool及生产使用的assertFileWritesEnabled。workdir在workspace，仍成功读取相邻outside-canary.txt，第二条命令成功访问自有loopback HTTP，计数1。没有访问教师资料、用户凭据或公网。
2. node mcp-approval-probes.mjs通过，证据mcp-approval-report.json。真实MCP Runtime、loopback服务、SQLite和原execution boundary。readOnlyHint=true服务实际写自有canary后返回isError，boundary记录effect=none，调用次数1、maxAttempts1。F02准确范围为不可信只读声明影响效果和并发分类。
3. 同脚本使用原persistent state和真实SQLite。新coordinator对持久pending审批返回permission_denied，recover后状态interrupted。coordinator使用只含真实persistent state的Store facade，本探针范围为该持久/协调接缝。

F01/F02/F03继续OPEN，活跃Run的MCP撤销入口缺口纳入T3.4。

## 3. 权威数据、模式与审批最小方案

以下均为实施建议。

### Profile与ScopeGrant

新增main-owned permission领域，复用session-state的Sql、serialized transaction和CAS，保持现有四模式ID/标签。Profile保存id/revision/mode/default policy，实际授权保存ScopeGrant。建议新增xiaozhi_permission_profiles、xiaozhi_permission_grants、xiaozhi_permission_audit，版本化JSON加id/revision/status/task/session索引，撤销保留tombstone。Task继续原事实来源。

ScopeGrant至少包含grantId/revision、用户或已认证历史授权来源、session/task关联、资源维度、规范化资源、read/write/delete等动作、TTL、revokedAt、来源审批引用。权限维度独立表达filesystem、process、network、dependency、MCP、Extension、data egress、secret reference，秘密继续现有密封存储。

- 文件root使用canonical path和根目录file identity，路径按segment比较，复用workspace-authority/WorkspaceLease，实际IO重验。覆盖junction/symlink祖先、hardlink、UNC/设备路径/ADS、根目录被替换。
- process记录backend、确切exe路径/hash、结构化argv或审核recipe、env白名单和子进程范围。解释器任意代码参数按任意代码权限评估。
- network记录目的地origin/端口、方法、用途与数据类别。main broker校验DNS/redirect/代理和外发正文，复用office-network接缝。
- dependency记录批准source、锁package/version/hash、目标env、installScripts策略、health与rollback。Phase3先接现有受管recipe和明确模板，Phase5接市场发现和新recipe获取。
- PermissionDecision返回allow/blocked/pending、grantIds/revisions、规范化实际资源与原因。模型/Provider只消费必要只读投影和引用。Grant writer由main用户决策入口消费冻结Request。

request消费已有Grant，缺少授权时申请。acceptEdits按明确已授工作区编辑范围自动执行。approveForMe由主进程已授策略审核常规操作。fullAccess在明确广泛目录、命令、必要网络和来源范围内直接执行，免逐命令弹窗。高风险资料外发继续既有独立策略。

profile首次迁移从可证明的原workspace/domain授权导入等价范围并保存provenance。localStorage模式作为偏好迁移线索。已有明确且main可核对的广泛授权原范围继续消费，避免重复批准。

### 持久审批v2

复用ai_confirmation_items，新增action_type和schemaVersion=2 payload，扩展原Approval Coordinator。绑定taskId、originRunId、当前admission Run/generation、action/target/scope、providerId/version/sourceHash/schemaHash、requestDigest、相关permissionSnapshotHash、数据类别、TTL、状态与审计。public投影按类型显示目的、资源、期限和替代。

- 主进程冻结请求语义，taskId+action+资源/目的地+requestDigest+范围形成去重键。相关Grant与Provider进入snapshotHash。无关设置无需使全部审批失效。
- task/session/persistent Grant匹配范围时自动允许。拒绝保存任务级denied fingerprint，相同请求免重复弹窗，Resolver尝试低风险替代并继续无关步骤。
- v2 pending/approved跨应用重启保持可见。内存waiting只通知/唤醒，decide依据SQLite CAS和任务事实。无active Run时批准只保存决策。
- 教师显式继续原Task，新Run/generation重新admit相同Request，重验digest/Provider/资源/TTL/当前Grant，一次性批准CAS消费。旧Run callback沿原owner fence拒绝。
- executing重启保持uncertain，复用verifyCopy/现有效果核验。启动执行次数0。范围扩大、来源/目标/hash变化、过期、相关Grant撤销、Task取消使审批invalidated并保存原因。
- v1 pi_office_copy保持旧读取/verify语义，原interrupted不自动变成可执行批准。显式续接时建立关联v2 Request，重新核对原来源和目标。

### Environment Manager基础

新增environment service聚合managedTools.view、OCR manifest验证、Node/Electron/OS/arch、审核runtime版本、scope目录/磁盘/受管服务/配置健康，输出ready/needs_configuration/missing_credential/unavailable/offline。诊断不得扫描未授权目录或导出完整env。

非敏感配置修复采用recipe草稿→schema/Grant校验→预期hash CAS原子写→health→前后hash与rollback。复用managed-tools prepare/activate/rollback，在下载、启动、激活各点消费Grant。固定版本诊断使用可信exe固定参数，不把用户参数拼接shell。密钥缺失接现有安全输入，秘密不进入Skill/日志/JSONL。修复失败保持旧配置/active版本。

## 4. 贯通实现文件与执行顺序

| 切片 | 拟改接缝 | 完成证据 |
|---|---|---|
| T3.1主进程权威 | shared版本化Permission/Approval/Environment类型，permission store/engine，session-state init | 新旧库、CAS、冷启、tombstone、相关snapshotHash |
| 真实模式与用户决策 | preload typed API、ipc.ts fromMain、PiSettingsWorkspace资料与权限、现有mode/审批卡。renderer移除统一非request自动approve，由main判定 | reload从main读回，伪authorized/Grant JSON拒绝，既有范围多次自动通过 |
| T3.2统一准入 | production-host beforeDelivery先Permission admission，再原Task/Journal。pi-session给核心工具和Phase2 Dispatcher注入同一main callback | 实际资源/Grant引用持久化，owner与Task原门禁保持 |
| 实际IO门禁 | tools/execution-bound每attempt检查授权，Hana/file/network/process/MCP操作前消费当前Grant，旧最终commit点再检查 | 排队/执行/commit前撤权反例，范围内真实文件/网络正向 |
| 审批与恢复 | persistent-state按schema分支增量recover，approval-coordinator去除waiter权威依赖，复用Task resume/EventPublisher/Receipt | pending冷启→批准→显式同Task新Run执行一次，旧generation零交付 |
| MCP保守效果 | mcp-runtime保留hint展示，effect assessment独立。未知外部工具为external_effect、maxAttempts1、合适的exclusive/server资源锁 | 恶意hint不产生safe_read资格，失败效果unknown；合法已授MCP范围无逐工具审批 |
| T3.4活跃撤销 | revoke专门main CAS通道解除idle-only限制。复用SessionExecutionRegistry，加grant/server到活动controller关联 | 先持久撤销后abort/关闭transport，新调用0执行，在途未知保留 |
| 环境诊断/修复 | environment service聚合现有受管组件/编译manifest/诊断投影，recipe化非敏感修复 | offline/缺配置/缺凭据真实投影，CAS原子写、health失败回滚 |

MCP的inspect/connect、stdio启动、每次call及重连均需process/network/source scope。选中某tool与验证safe_read分开。静态本地MCP可经已授server scope自动调用，未知效果仅改变并发/失败语义。旧测试中“host names为safe_read”的断言应依据新合同更新并保留恶意反例，不能简单删除。

依赖获取和恢复循环采用明确deadline/attempt与同请求拒绝指纹，复用runtime-budget等待/计量/abort。教师整个Run的全局限制保持现有合同，安装任务健康失败不能无限自动重试。

## 5. Windows实际可落地方案

### 已有模块复用

本树有QuickJS-WASI计算guest和Electron browser/HTML渲染sandbox。前者可直接承担有界纯计算，后者覆盖其Web内容进程。当前native shell没有相应OS隔离模块。Pi公开operations接口提供直接替换底层exec的接缝，保留原createPowerShellToolDefinition结果累积、timeout、取消以及createTerminalTool进度/脱敏/UI，支持完整命令字符串。

建议实现一个受管Windows native launcher组件，第一版覆盖当前前台非交互PowerShell，允许任意合法脚本在被授OS范围内运行，同时提供brokered文件/网络/依赖能力。已有计算与domain工具继续处理常规教师流程。该方案可支撑整工作区授权和复杂脚本，执行范围由Grant和backend共同确定。

### Native helper与低权限令牌

建议可信helper使用CreateAppContainerProfile取得按授权身份隔离的SID，配置STARTUPINFOEX/PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES启动AppContainer。LPAC增加ALL_APPLICATION_PACKAGES_OPT_OUT，用于验证更严格默认资源限制。Grant文件根、程序依赖、临时目录分别授精确DACL，环境白名单、stdin/stdout/stderr、继承handle清单由main冻结。launcher协议带schemaVersion/executionId/run/generation/grantHash，helper仅接受主进程通道。

AppContainer按用户SID与package/capability SID交集授权，LPAC还需明确授予部分系统资源。可先验证PowerShell的程序/系统库只读资源和工作区访问，再扩展Node/Python/依赖工具。当前仓库没有此helper，本轮尚未运行AppContainer成功探针。[Microsoft AppContainer实现](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

构建建议采用C++/Win32小型exe，使用系统API并随现有Windows资源包发布固定版本/hash，避免运行时编译。helper源码沿项目许可，Windows SDK/工具链按其分发条款核对，新增第三方库才增加其许可清单。实际exe字节、签名、x64/arm64包体和冷启动开销须在实现后测量。本机PATH有dotnet，未发现cl/clang/cmake；可以选择工作区可信工具链或审查过的C# P/Invoke helper方案，C#自包含/依赖运行时的包体要单独核算。用户已授权必要可信依赖，实施阶段可在授权范围内准备组件，审计阶段无需安装。

### ACL生命周期、崩溃与回滚

- 首个探针使用owned TEMP运行目录与合成输入，证明外部canary、应用数据根和用户profile不可访问。授予程序目录只读/执行，输出目录按Grant分read/write/delete。
- 直接共享实际workspace时，新增仅本helper SID对应的ACE，保存Grant ID、对象identity、原SDDL/ACE与新增差异的原子journal。不能整体覆盖DACL。撤销先阻断新执行并结束有关进程，删除本应用SID的精确ACE。协作者并发ACL修改通过当前ACL比对合并，冲突保留现场并标出需恢复对象。
- 崩溃启动先只读恢复journal，停止旧owned worker/Job，清理本应用的临时profile/ACE。原始文件内容与其他SID权限保留。避免每条命令永久变更真实root ACL，可按一个授权生命周期维护SID/lease，授权范围变化换新SID/worker。
- 另一条实现路线使用owned隔离工作副本，通过现有domain writer CAS提交结果到正式workspace。明确返回原件版本、工作副本路径映射和改动，原正式产物沿旧确认/保存。该路线适合解析/转换/依赖构建，实时目录编辑使用直接Grant DACL后端。

### 命令、stdin、取消与PTY

Phase3第一步将BashOperations.exec映射为helper.start，命令作为版本化stdin协议内容传输，参数数组调用固定shell路径。stdout/stderr流交原onData，exitCode继续原SDK回执，signal/timeout沿executionId取消。PowerShell启动禁profile，环境和临时输出目录重定向到owned范围，启动时再次核对scopeHash。

helper创建目标process suspended，加入由可信父持有的Job，再resume。Job负责进程组资源限制与取消，KILL_ON_JOB_CLOSE处理宿主退出。Job本身的security设置需与token/DACL共同实施，WMI/breakaway等子进程路径需要反例验证。[Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

后续持续终端/PTY可在同一launcher协议增量加入ConPTY HANDLE_LIST、输入、resize、close及PTY进程归属，继续使用相同Grant/Run身份。现有本树终端为前台非交互，Phase3门禁可先覆盖当前用户路径。历史WIP PTY移入时必须调用同一受控operations或launcher，避免恢复为普通用户spawn。

RestrictedToken可移除权限、加限制SID，访问需要普通SID和限制SID两次检查共同通过。其实现还需DACL/desktop配置，可作为经实测的native后端选项。[Microsoft Restricted Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens)

### 网络broker与完整命令可用性

初版AppContainer不授直接网络capability。脚本通过受控本地IPC使用main network broker，broker按Grant核对origin/方法/数据类别、DNS/redirect和敏感输入。代理环境变量只能辅助兼容，OS层仍阻止直接socket。不能声称仅设置HTTP_PROXY已强制所有程序走broker。

必要依赖可先由main按锁package/version/hash从批准来源下载到隔离cache，再在受控环境离线安装。现有QuickJS recipe可直接复用此形态。任意npm/pip安装器、安装脚本和复杂工具的联网兼容逐个适配，必要时使用按scope校验的下载broker命令/库。脚本自身仍可进行复杂计算、文件批处理与已授目录内的子进程调用。

任意脚本同时拥有原始资料读取和任意网络时会突破已有脱敏外发约束。network broker的第一版只接受用途明确、结构化且经main脱敏的数据，固定公共包下载按审核recipe执行。Teacher授必要目的地后连续同类调用自动完成，越界返回具体资源缺口并合并申请。

### 广泛可信原生命令模式

原SDK普通spawn使用调用进程安全上下文，cwd决定初始目录。若Grant允许这个后端任意PowerShell，实际extent包含该用户令牌能访问的文件/网络/子进程，需与明确授权一致。scope仍限定目录/网络时选broker或已验证AppContainer后端，不能把字符串白名单视为OS边界。[Microsoft CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)

已有明确广泛授权由main记录真实extent后继续自动消费，范围内免逐条确认。backend不支持某项限定时返回unsupported_constraint和已可用替代，工程继续完成其余已授任务。开发阶段应先交付完整可测的broker正向路径和Windows helper探针，再用上述反例收敛隔离配置，无需把整个Phase3停在通用sandbox需求上。

### 本机平台与WSB

只读盘点得到EditionID=CoreCountrySpecific、build=26200、UBR=9711、DisplayVersion=25H2。注册表ProductName原值为Windows 10 Home China，报告保留原值。Get-Command没有发现WindowsSandbox.exe。WSB官方支持Pro/Enterprise/Education，Home不支持。本机可先走broker/QuickJS并验证AppContainer后端，WSB用于支持平台上的独立未知安装脚本验证。[Microsoft Windows Sandbox](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)

WSB网络默认开启，可写mapped folder直接影响宿主。使用时需明确关闭网络/剪贴板并最小映射。本轮未安装或启用WSB。[Microsoft WSB配置](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)

## 6. 反例、真实用户入口与完成条件

下表为Phase3计划测试，本轮实际执行范围见第二节。

| ID | 操作 | 通过条件 |
|---|---|---|
| G3-01完全授权正向 | 已授整workspace read/write、计算和必要下载源，连续3次复杂脚本/文件加工及2次同recipe环境修复 | 范围内零新增弹窗，真实文件/网络/Grant引用一致，最终教师成果确认保留 |
| G3-02文件scope | 先同目录成功，再用绝对路径、父目录、junction祖先、symlink/hardlink、UNC/ADS、大小写和根目录替换访问外部合成canary | 外部canary未读/未改，未授权IO计数0，原目录正向仍成功 |
| G3-03解释器 | 用编码脚本、另一解释器、子进程或本地脚本打开外部canary | backend维持同一scope，普通spawn不会被错误认定满足限定权限 |
| G3-04网络/外发 | 允许一个endpoint，尝试其它端口/域、redirect、代理、DNS变化、query嵌入合成敏感内容、direct socket或子进程上传 | 未授权服务计数0，敏感canary不外发，具体缺口可见 |
| G3-05撤销时序 | 在排队/schema检查/启动/下载中/commit前撤销Grant，MCP长请求中撤server | 活跃入口可撤权，持久撤销先于新调用，活动controller取消，未知效果可见，已提交成果保持 |
| G3-06假只读 | readOnlyHint=true服务写canary后报错或断链 | hint不产生safe_read资格，调用一次，失败effect unknown，source/schema变化失效 |
| G3-07跨重启 | pending持久化→实际kill→restart，只读显示→批准→显式resume原Task→新Run执行 | 相同Task、正确digest、实际效果一次，启动零副作用，旧Run延迟回调拒绝 |
| G3-08审批失效 | 批准后改target/input/provider version/source/schema/相关Grant/TTL/数据类别 | 相关审批invalidated且0执行，无关主题或其他Provider设置改变保留合法批准 |
| G3-09并发 | 两次批准或消费同一一次性请求、重复同id但不同摘要 | CAS恰一执行者，相同决定幂等，冲突拒绝且不产生额外Grant |
| G3-10拒绝替代 | 同Task重复申请同资源/摘要，随后提出低风险本地方案 | 原请求免重复弹窗，替代经硬过滤，继续无关步骤，Skill/模型文字不能伪造Grant |
| G3-11旧数据 | 新库/旧库副本，v1 pending/approved/interrupted/uncertain/verified及未知schema/损坏payload | 增量幂等，原事实保留，旧已执行/未知效果不重放，未知authority失败关闭 |
| G3-12基础诊断 | 缺runtime/错版本/hash损坏、端口占用/offline、只读目录、空间不足、缺密钥 | 类型化状态真实，诊断不扫未授权目录/完整env，凭据转现有安全输入 |
| G3-13配置修复 | 正确修复后注入write/rename/health/active切换故障或撤权 | CAS原子写，旧配置/版本可读，health失败回滚，scope保持 |
| G3-14依赖 | 授权包/锁版本/env内连续prepare，再测试恶意安装脚本/hash不符/来源变化/目标越界 | 范围内自动执行，未审核脚本隔离评估，失败不激活，许可/版本/rollback可追溯 |
| G3-15真实页面/IPC | 当前导航→资料与权限→模式/范围→集中申请→批准/拒绝→重启，两分辨率 | typed IPC/mainFrame门禁，状态与Grant readback一致，renderer伪造authorized/grant拒绝 |
| G3-16helper生命周期 | 异常kill宿主/helper、撤权后旧进程继续、子进程逃离Job、ACL清理中途失败 | owned进程受控结束，旧handle权限不延续新执行，精确ACE恢复，协作者ACL及文件保持 |
| G3-17命令兼容 | 中文/空格/长命令/stdin、多子进程、输出截断、取消、安装离线包 | 原终端输入输出/timeout/脱敏正常，完整任意脚本在已授OS范围内可用，错误scope有具体原因 |

建议实施顺序为冻结权限/审批合同→main authority和broker真实正向→Windows operations/helper最小隔离探针→接核心Tool/Native/Phase2 Dispatcher→v2审批冷启→活跃撤销→环境诊断/非敏感配置修复→真实页面与上述反例。可先完善当前非交互终端，再接持续PTY。市场发现/任意外部安装器获取在Phase5，完整Effect Ledger/通用崩溃核对在Phase6。

最后验收必须从现有OfficeComposer/资料与权限页用户操作开始，检查主进程Grant、原Task/Run、SQLite审批及实际文件/网络计数。build、renderer-components与领域专项照最低门禁执行。AppContainer兼容探针的失败是具体工程反馈，安全可用的broker与受管计算路径继续推进。

本轮工具写长PowerShell here-string报告时自动策略拒绝该写入，已改用文件patch完成自有TEMP报告。所有生产源码和root文档保持只读，临时探针进程及loopback服务均已结束。
