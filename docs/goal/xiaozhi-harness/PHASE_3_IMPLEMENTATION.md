# Phase3 实施合同

2026-11-12，实施树 `D:/WorkProject/EduProject-harness`，分支 `codex/xiaozhi-harness-20261112`。本合同基于 Gate2 接受后的整合提交 `0e23b90bb72af8463630bcf3b9220fbe76b8aebf`，于只读准备阶段冻结，随后收到总控 RELEASE 并实际实施。总控负责进度文档、验收台账和 Git，实施者独占生产与测试写入。最终源码、构建与专项结果补充在本页，正式阶段接受由独立 Gate3 决定。

## 教师结果与完成边界

本阶段服务 M10 AI 治理、M01 本地数据和 M12 Windows 交付。教师在现有四模式和资料与权限页明确授权后，小智连续完成范围内的文件加工、复杂脚本、已授网络/MCP和非敏感环境配置。超出范围时显示可理解的集中申请，拒绝后同 Task 不重复申请同一请求。审批跨重启保留，撤销立即阻断新执行并取消对应活动操作。

执行沿既有 Pi、Task admission、Journal 和 Execution Boundary，Phase2 的 Capability Dispatcher 消费同一 main-owned 权限。权限检查位于实际 IO 前及最终提交点。原模型/renderer 提供的模式、authorized 字段、Skill 声明或环境开关均不能产生 Grant。

受控终端保留完整合法 PowerShell 脚本、管道、脚本块、循环和子进程能力。已验证的普通 AppContainer、父持有 Job、明确 handle list 和零直接网络 capability 为 Windows 默认后端。教师原目录的完整性标签保持，脚本在 owned 低完整性执行投影运行，main 按当前 Grant 与原始文件版本提交允许的变动。投影实际 cwd 与教师逻辑目录的映射明确进入工具上下文和结果。

## 实施前核对事实

- `permissionModes.ts` 仍为 `request/请求批准`、`acceptEdits/接受编辑`、`approveForMe/替我批准`、`fullAccess/完全访问`。localStorage 当前只保存偏好，三种非 request 的 copy 自动批准由 renderer 发起。
- `production-host` 已有 active owner、Task admission、Journal admission、Phase2 Snapshot 与 main WorkspaceLease。`approval-coordinator` 复用 `ai_confirmation_items`，当前决定依赖内存 waiter，旧 recover 会把 pending/approved 改为 interrupted。
- `tools/terminal.ts` 已沿原 Pi 公开 `createPowerShellToolDefinition` 调用。锁定 Pi 1.0.2 的公开 `PowerShellToolOptions.operations` 可替换 `exec(command,cwd,{onData,signal,timeout,env})`，保留原输出累积和终端投影。
- MCP 当前 `maxAttempts=1`。annotations/readOnlyHint 会影响现有分类，活跃 Run 的 server 撤销经过 idle-only settings 门禁。
- `managed-tools` 已有固定 recipe、版本/hash、prepare/health/activate/rollback，秘密通过既有安全存储。Phase3 复用这些事实和安全入口。
- 已归档 PoC 在普通 AppContainer 中实际执行 Windows PowerShell 5.1 与现有 7.6.9 的复杂脚本、中文输出、sum=77、exit37、Job 子进程取消和 sibling 拒绝。直接 loopback 未到达监听器。此证据来自 owned TEMP。
- Medium follow-up 对原 Medium 标签目录中新建文件失败，已有文件覆盖成功。直接真实目录完整写能力仍未解决。真正 LPAC 因 PowerShell registry 访问失败，属于额外强化选项。

接缝审计以 `PHASE_3_READONLY_SEAMS_AND_PLAN.md` 为锚点，再按本树核对。已有整仓图索引超时/未索引证据继续采用，按已定位源码核对实施，不重复启动整仓长索引。

## T3.1 主进程权限权威

新增版本化共享 PermissionProfile、ScopeGrant、PermissionRequest、PermissionDecision、Environment 投影。Profile 保存四模式、revision 和默认策略。ScopeGrant 保存 grantId/revision、动作、资源维度、规范化实际范围、session/task、来源审批或可验证历史授权、有效期和撤销 tombstone。沿原 Sql/serialized transaction/CAS 增量迁移，拟新增 `xiaozhi_permission_profiles_v1`、`xiaozhi_permission_grants_v1`、`xiaozhi_permission_audit_v1`。

文件、进程、网络、依赖、MCP、Extension、数据外发和秘密引用分别表达。文件范围绑定 canonical root 与对象 identity，实际文件检查覆盖祖先链接、hardlink、UNC/设备/ADS 和 root 替换。process scope 指定受控 backend、精确 runtime/hash、允许任意脚本的真实 extent、环境白名单与子进程限制。network scope 指定 origin/端口、方法、用途和数据类别，egress 单独校验。

先迁移 main 能证明的既有 workspace/domain 授权及其等价范围，记录来源和摘要。localStorage 只作为模式偏好线索，不能推断历史广泛权限。已有明确授予且可从 main 读回的范围持续消费，连续常规动作免重复询问。mainFrame typed IPC 消费用户明确决策并生成 Grant，renderer 无 Grant JSON 任意写入口。

模式策略在 main 执行。request 自动消费已有 Grant，acceptEdits 自动消费明确编辑范围，approveForMe 按已授策略审核常规请求，fullAccess 在明确广泛授权范围内直接执行。独立高风险资料外发策略仍在。

## T3.2 实际执行门禁和 Windows 后端

首次 admission 生成 main-owned decision/grant 引用，继续经过原 Task/Journal。每次 attempt、实际文件/网络/MCP/进程 IO 和最终 commit 重验当前 Grant、撤销、owner 和规范化资源。readonly stat 保持 safe_read，辅助读取允许原协议支持的空 stepId。模型或 Provider 仅获得必要引用和只读投影。

新增 `permissions` 领域的执行检查与活动 operation 索引，核心文件工具、Hana、Phase2 Native Adapter、terminal、MCP 和实际网络 writer 接同一服务。新增领域 helper 分文件组织，大型宿主仅接线。真实教师成果继续原业务保存、版本/确认和来源流程。

Windows helper 复用归档 C# Win32 API 代码，正式化版本化 start/cancel/result 协议、executionId、Run/generation、grant digest、固定可信 shell、bounded stdout/stderr、明确继承 handle 与环境白名单。build 阶段编译并生成源码/二进制 hash manifest，开发与资源布局加载相同受核验身份。当前已有 .NET Framework csc/PowerShell 编译能力可复用，交付记录实际工具链、运行时与包体。helper 运行时接受 main 冻结的协议，目标进程 suspended 后加入父持有 KILL_ON_JOB_CLOSE Job，再 resume。

投影准备仅遍历明确授权范围，记录原件版本和路径映射，限制总文件/字节、单文件及时间预算。拒绝链接、特殊路径和不支持的资源。脚本对投影的创建/修改/删除形成变动集，main 对每项重验 read/write/delete Grant、原版本 CAS 和目标安全性后提交。撤权、原件变化或取消时停止提交并保留明确失败事实，真实目录 MIC/ACL 保持。沿现有 Task/receipt 记录状态与已提交文件，通用多文件 Effect Ledger 与更完整 reconcile 在 Phase6 贯通。

默认不给 AppContainer 直接网络 capability。受控 broker 对原网络工具和脚本的结构化请求执行当前 network/egress Grant、DNS/redirect/目的地与输入数据检查。公共依赖由 main 按已授 source、锁版本/hash 和 recipe 下载后离线安装到 owned 环境。任意脚本在已授 OS 范围内执行，直接 socket、原始目录越界和未授外发由实际后端阻断。脚本使用投影路径与 broker 的兼容边界明确报告。

当前生产终端为前台非交互，先完成其真实路径。Persistent PTY/stdin/background 旧 WIP 的接入必须复用同一 operations/helper、Grant 和原 Task/Run 归属，按 Phase3/6 依赖贯通。旧 manager JSON 仅能作进程辅助元数据，logical conversation ID 沿原业务会话字段。

## T3.3 持久审批 v2

扩展原 `Approval Coordinator` 和 `ai_confirmation_items`，新增版本化 action payload，覆盖 capability acquisition、dependency、MCP、Extension、filesystem 和 external data。绑定 Task、originRun、admission Run/generation、冻结 action/target/scope、Provider/version/source/schema、requestDigest、相关 permissionSnapshotHash、数据类别、TTL、状态和审计。

相关资源和摘要形成去重指纹。已匹配 Grant 自动通过，重复 pending 复用同一记录。拒绝保存 Task 级指纹，相同请求免重复弹窗，继续无关步骤并通过 Resolver 寻找合格低风险替代。申请投影显示用途、资源、期限和拒绝后果。

pending/approved 跨重启保持。内存 waiter 负责通知，决定依据 SQLite CAS 和当前 Task 事实。无 active Run 时批准只保存决定。教师沿原继续入口启动同一 Task 的新 Run/generation，重新 admit 相同请求，核对摘要、Provider/范围、TTL 和当前 Grant，一次性批准以 CAS 消费。启动恢复零副作用，旧 Run 回调由原 owner 围栏拒绝。

目标/输入摘要/安全来源或 Schema/相关 Grant/TTL/Task 取消等变化使对应审批 invalidated，无关设置变化保留合法审批。executing 重启标记 uncertain，沿已有 verifyCopy 与后续 Effect 核验。v1 pi_office_copy 保留原读取/verify 和失败事实，旧 interrupted 不自动重放，显式续接时建立关联 v2 请求并核对原语义。

## T3.4 活跃撤销与 MCP

撤销使用专用 main CAS 入口，在活跃 Run 期间可调用。先持久撤销和相关审批失效，再按 grant/server 找到 controller，取消排队和在途操作，关闭对应 transport/Job。新 IO 前重读撤销，已提交成果保持，无法证明未发生的外部副作用保留 unknown/uncertain。

MCP hints 保留展示价值，未知外部工具按保守 effect 和 server 资源锁处理。保留 maxAttempts=1，失败不声称 effect none。inspect/connect、stdio 启动、每次 call、Schema/source 变化和重连核对 process/network/server/tool scope。合法已授 server 范围自动调用，readOnlyHint 不能生成 safe_read 权限或 Grant。

## T3.5 Environment 基座

新增 environment service 聚合现有 managedTools.view、已编译 runtime/OCR manifest、OS/arch/Node/Electron、已授目录、固定目标端口与受管服务健康。只运行可信固定 exe 的固定诊断参数，输出 ready/needs_configuration/missing_credential/unavailable/offline。诊断限制在已授资源，不导出完整 env。

非敏感配置修复采用固定 recipe 草稿、schema/Grant、预期 hash CAS、原子写、health 和 rollback。接现有 managed-tools prepare/activate/rollback，在下载、启动、激活与最终配置写入各点重验。失败保留旧配置/active 版本与审计，缺凭据转现有安全输入。Phase5 继续外部来源发现、获取和完整安装生命周期。

## 文件与用户入口

| 边界 | 计划文件组 |
| --- | --- |
| 单一共享协议 | `src/shared/xiaozhi-permissions.ts`、`xiaozhi-environment.ts`，原 xiaozhi-agent/public approval 类型增量扩展 |
| main 权威 | `src/main/xiaozhi-agent/permissions/` 下 contract、store、engine、resources、operations、network broker，Session Store 初始化接线 |
| 审批 | 原 `approval-coordinator.ts`、`persistent-state.ts`，新增独立 v2 payload/validation 模块，原 Task coordinator/resume 仅作对应接线 |
| 终端 | `permissions/windows/` helper 源码、协议/manifest/launcher、projection/commit，原 `tools/terminal.ts` 注入 Pi operations |
| 环境 | `src/main/xiaozhi-agent/environment/` 诊断/recipe/config repair，复用 managed-tools 和安全输入 |
| 原执行链 | `production-host.ts`、`pi-session.ts`、`tools/execution-bound.ts`、`tools/manifest.ts`、文件/Hana/Phase2 Native 与 MCP 实际 IO 接缝 |
| typed 用户路径 | 新领域 IPC register 文件、现有 preload/window 类型、`PiSettingsWorkspace`、权限模式读回与原审批卡 |
| 构建与测试 | helper 构建/复制/hash 校验，权限/审批/文件/网络/MCP/Environment 专项及真实 Electron/Pi/SSE 集成 |

路径相对 `apps/desktop`。UI 使用 edudev-design，保留 OfficeComposer 输入框、底部工具栏和弹层，四模式 ID/标签保持。移除 renderer 的统一非 request 自动 approve authority，由 main 返回真实策略结果。现有资料与权限页承载范围/撤销/诊断，原审批入口承载决定和恢复，完整页面集中验收在 Phase7。

## 验证和 Gate3

逐项记录实际 PASS/FAIL/NOT_RUN、精确命令、冻结 hash 与原始失败。测试使用自有 TEMP 合成资料和 loopback，本阶段真实付费请求保持 0。

1. 新库和真实旧库副本迁移、幂等/CAS/tombstone、可证明历史授权继承、四模式 main 冷启读回。伪 mode/authorized/Grant payload 和 Skill 声明不能授予权限。
2. 同一明确范围连续复杂脚本/文件加工和配置修复零重复审批。实际文件结果、Grant 引用、原 Task/Run/Journal readback 一致。
3. canonical root/路径边界、父目录、junction/symlink/hardlink、UNC/ADS/设备路径、root 替换反例，外部 owned canary 未读/未改。真实目录 MIC/ACL 前后保持。
4. PowerShell 5.1 和可用 7 的复杂管道/脚本块/循环、中文与空格、长脚本、子进程、stdout/stderr/exit/截断/超时/取消。AppContainer token 与 Job 归属可核验，直接 socket 和 sibling 访问被拒，投影修改经 main Grant+CAS 提交。
5. 已授目的地/broker 正向，未授 origin/端口、redirect、DNS/代理与合成敏感数据外发反例。网络和 egress 独立授权，未授 endpoint 计数 0。
6. pending 持久化后实际终止并冷启，批准只保存，再显式继续同 Task/新 Run 恰一执行。并发消费/决定 CAS、拒绝去重、相关失效与无关变化、v1 uncertain/verify 兼容均覆盖。
7. 排队、启动、执行与 commit 前撤 Grant，MCP 长调用撤 server。先持久撤销，活动 controller/Job/transport 取消，未知效果如实保留。恶意 readOnlyHint 服务实际写后失败，调用次数 1。
8. Environment 缺配置/错版本或 hash/offline/缺凭据、只读目录和固定端口占用，配置原子写/CAS/health失败回滚。受管 recipe 来源/hash/目标约束继续生效。
9. 从现有资料与权限页、模式、审批入口执行 typed IPC 到真实 main，再用 SQLite/实际文件/网络计数及冷启核验。1366×768 与 1920×1080 关键控件可达，截图与布局完整验收归 Phase7。
10. `npm run build`、`npm run test:renderer-components`、相关 Phase1/2/Task/Office/MCP 回归、`git diff --check`。真实 Pi 使用本地 SSE 验证主链，不以单独 helper 或 Node smoke 代替生产接线。

性能记录 Grant 冷/热判定与实际 IO 附加耗时、SQLite事务、审批恢复、helper冷启动/包体、投影准备/提交文件量与用时、broker调用、取消延迟和残留 owned 进程/profile/ACL。与同合成 fixture 的直接 Native/Phase2 基线对比，不由构建时间推断产品响应。

## 兼容、回滚与交接

权限迁移采用新表与版本化 JSON，审批复用原表并按 schema 分支读取。原 Task、Run、Journal、教师文件、确认事实和秘密存储保持原事实来源。迁移或修复失败事务保留原 revision，健康失败保留旧 active 配置。启动只恢复状态、诊断与 owned helper 清理，零自动业务写入。

回滚关闭本轮入口并恢复已接受 Phase2 接线，保留权限/审批审计、新表和保留 Artifact 以便核对。新终端后端不可用时保留明确 unavailable/unsupported_constraint，禁止回落普通用户 shell 执行受限 Grant。正常退出、取消和崩溃只清理本应用 owned Job/profile/执行投影及精确 SID ACE，不降低或重置真实教师目录标签。

PoC 原失败、Medium 直接创建失败、LPAC registry 失败和实施内所有失败保留。Phase3 交付后冻结源码/out，提交独立 Gate3，Gate 通过后由总控推进 Phase4。完整市场安装发现留 Phase5，通用 Effect Ledger/恢复及旧 PTY/background 依赖贯通留 Phase6，页面和最终集中回归沿 Phase7/8。

## 最终候选实施与边界记录

Phase3 生产/测试已按 RELEASE 实施。主进程权限服务、实际 IO wrapper、原 Task/Journal admission、持久审批 v2、活跃撤销、Environment 固定修复与受控 PowerShell operations 已接通。新增文件按 permissions/environment/windows 领域拆分，原主文件承担接线。G3A-F01 批准期限交集、G3A-F02 旧 workspace 迁移证明和 G3B-F01 会话权限卡的知情批准问题已修复。

历史事实与迁移使用实际 SQLite 副本验证。合法 v1 pending/approved 保留原行，核对原来源/目录身份/版本与输入摘要后建立关联 v2。存在 Task 关联时继续同一 Task 的新 Run/generation。没有原 Task 事实的旧行通过明确 legacy 适配启动原 Task admission，报告单独标示。pending/approved 在正常 app_shutdown 和强制主进程崩溃后保留，启动恢复不执行文件操作。executing 沿 uncertain 事实恢复，旧 interrupted 不自动重放。模式偏好不推导 Grant。

受控终端 public Tool 最大 16384 Unicode codepoints，内部 helper 最大 32768 codepoints，包含固定 broker prefix。helper 先以 65536 UTF-16 code units 有界读取，再核对实际 codepoint 数。ASCII 和 emoji 最大合法输入均通过真实 Pi operations，public 超限仍由公开 SDK 校验拒绝。helper 采用实际 AppContainer、Job、deadline/process/output 限额。当前 resourceUnits 只是领域预算元数据，Job 级内存/CPU 限额需要在 Phase5 外部代码及 Phase6 执行预算进入前落地验证。

stdio MCP 当前以 typed unsupported_constraint 保留配置、秘密引用和审计，HTTP transport 为已验证替代。Phase5 前段必须复用原 MCP Runtime 公开 Transport 完成受控双向 stdio，再开展市场接入。Phase6 PTY/stdin/background 继续共用该权限与进程边界。当前没有普通用户权限 spawn 回退。MCP 未知效果采用 external_effect，maxAttempts=1；实际写入后失败 fixture 只调用一次，结果保留 unknown。核心 Tool/动态 Provider 的完整 H23 Registry/Permission/Execution/Effect/验证贯通留明确 Phase5/6 接缝，保持既有 Tool 名称和 Schema。

原教师目录通过 owner、DACL、mandatory integrity label 前后 SDDL 字节相等核验。脚本工作目录为 owned Low 投影，工具结果披露实际 cwd、逻辑 cwd、排除文件与提交变动。main 对每个提交重新核对 Grant 与源版本 CAS。目录投影与 broker 的原始失败均保留。

### Windows 构建与加载身份

正式 C# 编译输入为 NativeSandbox.cs、PlatformInfo.cs 和 TrustedRuntimes.cs，源码 aggregate、逐文件 hash、pins hash 与实际 exe 字节写入 manifest。build 固定 csc recipe，未变化且已核验的输出按字节复用。Framework csc PE 时间戳/MVID 会使重新编译的相同源码产生不同字节，因此验收依据实际 exe hash，未声称完全可重现二进制。

最终 helper 为 47104 bytes，SHA256 为 d0d1a92473cd017ef5e56a3d37940e21fc3c4f3b1a69cdf41ea1c3d217d9e56a。生成物位于 apps/desktop/src/main/xiaozhi-agent/permissions/windows/generated，构建复制到 apps/desktop/out/main/permission-runtime。开发与资源布局使用相同 manifest/exe 校验。此处是安装布局资源路径验证，完整安装包/asar/换机实测在 Phase8。没有新增 npm 依赖，C# 为项目代码，PowerShell/.NET Framework/csc 使用本机既有 Microsoft 系统组件。可选开发机 PS7 pin 仅表示本机已测；正式默认采用 Native Windows 路径和离线 Microsoft embedded/catalog 信任验证的系统 PS5，运行时变更经固定源码/csc recipe 重新构建、health 后激活，旧 helper recovery 引用保留。

helper 使用 detached:true、windowsHide:true、三 pipe 启动，按父 PID/EOF/cancel 结束 owned Job 后清理。独立 cleanup-owned 仅核验原 marker 加受保护 private identity，零 shell，精确恢复 owned SID ACE/profile。最终实际 helper 51/51、只读 platform 11/11 与 Pi operations 9/9 通过，报告分别为 TEMP/xiaozhi-phase3-helper-final-7hHCB8/report.json 和 TEMP/xiaozhi-phase3-operations-Bn4Ff1/report.json。

原 broker 目录 pin 的 metadata-only 访问掩盖了目录重命名，实际攻击 fixture 触发 ENOENT 后安全失败。最终以 FILE_LIST_DIRECTORY 加原安全元数据 mask 0x000E0081 保持 no-delete-sharing，真实目录重命名被阻断，清理复用持有句柄。保留失败 TEMP/xiaozhi-harness-phase3-operations-final.log 与 xiaozhi-phase3-operations-YxHeCf/report.json。更早 MAXIMUM_ALLOWED pin 的 ACL 清理失败在 xiaozhi-phase3-operations-Ndexn3；精确 owned recovery 的日志/结果为 TEMP/xiaozhi-harness-phase3-owned-cleanup.log 与 owned-cleanup-report.json，未扫描或变更用户其他目录。

### 冻结身份

最终 build 日志为 TEMP/xiaozhi-harness-phase3-build-pin-final.log，exit 0。80 份源码/构建/测试文件与 466 份 out 的完整列表位于 TEMP/xiaozhi-harness-phase3-source-freeze-BHobGm/freeze.json。sourceListHash 为 6c57ee1c35ca06c4e306aa5ce4125fc2f61297d687be1345a34ff716a6ea9683，outListHash 为 b06680146509d4086c94d7671a4c05ebd3e42262ee80a60e9103551b7d9f2671。generated/out manifest、exe hash、compiled adapter identity 和 Task 参数归一化接线均相符。前冻结 XhUkHs 及其 e4fe helper 保留为历史候选，不作为最终 helper 身份。

`npm run test:smoke` 已在此前候选完成 207/207，exit 0，日志 TEMP/xiaozhi-harness-phase3-final-smoke.log。该完整 207 绑定 helper 209aeab873c7549742ad852d0ae6a388a76833b2ef27d4ca1ec17d5a40a15b4f。随后 command 边界、真实权限卡和目录 pin 的必要修复使用最终 build 与专项重新核验，207 未被表述为最终 d0d1 二进制同身份测试。最终源码/out 在专项结束后再次核对冻结 hash，独立 Gate3 决定阶段验收。

### 回滚操作与后续验收范围

回滚前正常退出应用，保留 SQLite/原始文件/权限审计与本轮受管 helper 版本备份。将本轮源码接线与构建文件恢复到已接受 Phase2 基线 0e23b90 后重建，不对新增权限表执行 DROP，不删除历史审批或被执行记录引用的 helper/native artifact。已提交教师文件属于业务结果，按原版本恢复能力处理，不能靠源码回滚覆盖。若仅固定 runtime 配置健康失败，active pointer 保持旧健康版本，失败 stage 记录保留；旧 helper 的精确身份供 owned cleanup 使用。受控后端不可用返回 unavailable/unsupported_constraint，保留 HTTP MCP 替代，绝不切换普通用户 shell。

本阶段最小 UI 的文件夹选择采用 main dialog fixture，实际 typed IPC/main canonical Grant/SQLite readback 已测试；没有将 fixture 标为真实系统对话框接受。1366×768 与 1920×1080 验证模式入口可达，完整布局、原生 chooser 和全部权限页由 Phase7 独立 Terra 验收。合成 SSE 未证明真实模型教学质量，真实付费调用累计 0/200。

旧 PTY manager WIP 未合入，持久输入/后台恢复沿 Phase6 和 Phase5 stdio 的同一受控 helper、逻辑 conversation ID 与原 Task/Run 真源接续。Windows 原 Medium 目录新建失败与真正 LPAC registry 不可用保留，正式方案采用 owned Low 执行投影，教师目录 MIC 保持。

### 最终主进程与权限底座结果

`node scripts/xiaozhi-agent/permission-phase3-production-smoke.mjs` 最终 exit 0、success=true、9/9。日志 TEMP/xiaozhi-harness-phase3-production-final.log，完整 report/combined-report/restart-report、三进程日志和 crash checkpoint 位于 apps/desktop/test-results/xiaozhi-agent/permission-phase3-production-aAy5Dp。primary 数据根 TEMP/xiaozhi-phase3-production-JhTgs2，崩溃恢复数据根 TEMP/xiaozhi-phase3-production-VKkG4d。primary 149213.84 ms、预期 SIGKILL 进程 20985.69 ms（exit 1 属测试预期）、冷恢复 2159.09 ms（exit 0）。正常关闭保留审批和强制崩溃保留审批均实际验证。

主路径分段从真实 host.start 请求计时。首次终端首事件 142.81 ms、accepted 219.10 ms、Pi resources ready 6113.42 ms、首本地 SSE 请求 7039.61 ms、Run 完成 16672.30 ms。同 Task 新 Run 的首事件 205.97 ms、accepted 287.85 ms、resources ready 4894.36 ms、首 SSE 5512.84 ms、完成 20076.06 ms。worker 模块载入 37263 ms 与 fixture/store 初始化 1471 ms 单独记录，不能算作模型网络等待。catalog 请求共 1 次，已重定向到本地 fixture。活跃 host.close 569.58 ms，两个待批 Run 设置分别 9721.65/8785.97 ms，没有固定 waiter 关闭超时。

Phase2 原报告 u0XeWR 的同 Task 续接 18216.61 ms，本阶段 fixture 20076.06 ms；fixture 工作内容及本轮机器负载不同，此数值记录前后真实观测，无法归因成权限附加成本或模型响应变化。此次没有完整同输入的直接 shell 受控/非受控 A/B，未给出虚构的 overhead 百分比。实际 runtime 固定源码配置和 AppContainer health 共 2553.69 ms；冷身份读取加未变 prepare 129.76 ms，错误 source recipe 拒绝 8.70 ms。真实 Pi operations 复杂脚本并提交 4839.36 ms、取消 1250.24 ms、活跃 Grant 撤销 1278.79 ms、broker 网络与独立外发批准 3443.90 ms，均为整项操作耗时。helper 本身 51 项 36363.47 ms、platform 11 项 1331.26 ms。

`node scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs` 最终 13/13，日志 TEMP/xiaozhi-harness-phase3-store-final.log，真实 SQLite 报告 TEMP/xiaozhi-permission-phase3-store-dYnwBa/report.json。`node scripts/xiaozhi-agent/permission-phase3-runtime-smoke.mjs` 最终 3/3，日志 TEMP/xiaozhi-harness-phase3-runtime-final.log，报告 apps/desktop/test-results/xiaozhi-agent/permission-phase3-runtime-krzCla/report.json。此 runtime 反例只模拟旧 shipped pin metadata，真实诊断、离线签名验证、固定 csc、当前三份源码、实际 AppContainer health、冷启动 receipt 均真实。

`node scripts/xiaozhi-agent/permission-phase3-approval-components.mjs` 最终 SSR 4/4，日志 TEMP/xiaozhi-harness-phase3-approval-components-final.log。`npm run test:renderer-components` 最终 246/246，日志 TEMP/xiaozhi-harness-phase3-components-final.log。SSR 覆盖冻结 id/revision、真实 exec/MCP 字段和 v1 兼容，实际点击沿独立 Electron UI 专项。

每 Run 本地 resourcesReady 约 5–6 秒、首 SSE 约 5.5–7 秒作为 Phase8 性能待优化项保留。后续定位实际资源加载、Schema 编译和重复初始化，在原安全会话/缓存边界内优化。本阶段冻结后没有临时解冻 Session 重构或把本地准备时间标成远端模型延迟。

最终 UI 第一次复验在 MCP setup 阶段 7/8 FAIL，typed add 返回 busy，前 7 项真实用户路径与 G3B 脚本卡已通过。日志 TEMP/xiaozhi-harness-phase3-ui-final.log，报告 apps/desktop/test-results/xiaozhi-agent/permission-phase3-ui-g44y5A/report.json 保留。fixture 原来只等 snapshot.running=false，设置修改还受 starting/configuring reservation 约束。测试 setup 对无写入的 typed busy 增加 60 秒有界重试等待，生产门禁与 out 保持冻结；没有重试已成功的 add，也没有修改产品 Run 预算。

### UI 最终复验与 Phase5 接口依赖

UI setup 有界等待后 `node scripts/xiaozhi-agent/permission-phase3-ui-smoke.mjs` 最终 exit 0、8/8，日志 TEMP/xiaozhi-harness-phase3-ui-final-round2.log，报告 apps/desktop/test-results/xiaozhi-agent/permission-phase3-ui-wL4Fi8/report.json，owned 数据根 TEMP/xiaozhi-phase3-ui-YIDFDj。真实会话卡从 Composer 到 main 冻结申请，exec 覆盖/删除与 MCP POST 均展示实际范围、分类、期限和脱敏摘要，点击批准绑定原 approvalId/revision/requestDigest，旧 revision 再决定被拒。旧 v1 复制卡文案保留。模型只向本地 SSE fixture 发送，真实付费调用 0。

仅 UI test 修改后重新冻结于 TEMP/xiaozhi-harness-phase3-source-freeze-1SFFDC/freeze.json。sourceListHash 更新为 7498650577583eb747a0ae9f9fc851ab786b41a1dbb55381e44cfd30dd89d33d。outListHash 仍为 b06680146509d4086c94d7671a4c05ebd3e42262ee80a60e9103551b7d9f2671，全部生产源码/out 与最终 d0 helper 身份保持，delta 数组只列 permission-phase3-ui-smoke.mjs。前 BHobGm 冻结保留。

Phase5 合同必须包含 active acquisition 接缝。Run 内获取 Provider/MCP 不能复用普通设置页 idle-only 的 mcpAdd mutation，必须在原 MCP Runtime/Registry 的可信准备路径和明确安全点完成，再更新合格快照。普通 UI 设置门禁继续生效，不借获取能力放开全局忙态配置写入。此依赖与 Phase5 前段受控双向 stdio 一并验收。


### 最终 80 文件清单

以下路径和逐文件 SHA256/size 一一对应最终 freeze.json，包含构建时同步的既有 vendor/source manifest 文件。

- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/package.json`
- `apps/desktop/scripts/build-permission-runtime.mjs`
- `apps/desktop/scripts/xiaozhi-agent/fixtures/permission-security-read.cs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-approval-components.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-operations-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-production-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-production-worker.ts`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-recovery-worker.ts`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-runtime-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-ui-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/permission-phase3-windows-smoke.mjs`
- `apps/desktop/scripts/xiaozhi-agent/pi-mcp-boundaries.mjs`
- `apps/desktop/src/main/office-agent/hana-tool-adapter.ts`
- `apps/desktop/src/main/office-agent/office-network.ts`
- `apps/desktop/src/main/xiaozhi-agent/approval-coordinator.ts`
- `apps/desktop/src/main/xiaozhi-agent/capabilities/generated/native-stat-bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274.cjs`
- `apps/desktop/src/main/xiaozhi-agent/capabilities/generated/native-stat-manifest.json`
- `apps/desktop/src/main/xiaozhi-agent/education-tool-catalog.ts`
- `apps/desktop/src/main/xiaozhi-agent/environment/api.ts`
- `apps/desktop/src/main/xiaozhi-agent/environment/runtime-diagnostics.ts`
- `apps/desktop/src/main/xiaozhi-agent/environment/service.ts`
- `apps/desktop/src/main/xiaozhi-agent/environment/tools.ts`
- `apps/desktop/src/main/xiaozhi-agent/ipc.ts`
- `apps/desktop/src/main/xiaozhi-agent/mcp-runtime.ts`
- `apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts`
- `apps/desktop/src/main/xiaozhi-agent/owned-file-stage.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/api.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/current.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/engine.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/legacy-approval.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/legacy-request.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/mcp-http.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/mcp.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/network.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/provider-source.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/public.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/resources.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/service.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/store.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/summary.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/tool-runtime.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/validation.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/.gitattributes`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/NativeSandbox.cs`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/PlatformInfo.cs`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/TrustedRuntimes.cs`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/broker.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/generated/sandbox-manifest.json`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/generated/xiaozhi-sandbox.exe`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/launcher.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/operations.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/projection.ts`
- `apps/desktop/src/main/xiaozhi-agent/permissions/windows/runtime.ts`
- `apps/desktop/src/main/xiaozhi-agent/persistent-state.ts`
- `apps/desktop/src/main/xiaozhi-agent/pi-session.ts`
- `apps/desktop/src/main/xiaozhi-agent/production-host.ts`
- `apps/desktop/src/main/xiaozhi-agent/session-state.ts`
- `apps/desktop/src/main/xiaozhi-agent/tasks/plan-runtime.ts`
- `apps/desktop/src/main/xiaozhi-agent/tasks/task-state.ts`
- `apps/desktop/src/main/xiaozhi-agent/text-change-service.ts`
- `apps/desktop/src/main/xiaozhi-agent/tools/execution-bound.ts`
- `apps/desktop/src/main/xiaozhi-agent/tools/manifest.ts`
- `apps/desktop/src/main/xiaozhi-agent/tools/terminal.ts`
- `apps/desktop/src/main/xiaozhi-agent/web-tools.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/components/office/PiCopyApproval.tsx`
- `apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx`
- `apps/desktop/src/renderer/components/office/PiEnvironmentSettings.tsx`
- `apps/desktop/src/renderer/components/office/PiInteractionCards.tsx`
- `apps/desktop/src/renderer/components/office/PiPermissionApproval.tsx`
- `apps/desktop/src/renderer/components/office/PiPermissionSettings.tsx`
- `apps/desktop/src/renderer/components/office/PiSettingsWorkspace.tsx`
- `apps/desktop/src/renderer/components/office/permissionPresentation.ts`
- `apps/desktop/src/renderer/components/office/usePermissionMode.ts`
- `apps/desktop/src/shared/xiaozhi-agent.ts`
- `apps/desktop/src/shared/xiaozhi-environment.ts`
- `apps/desktop/src/shared/xiaozhi-mcp.ts`
- `apps/desktop/src/shared/xiaozhi-permissions.ts`

### 最终串行回归命令与报告

命令工作目录均为 D:/WorkProject/EduProject-harness/apps/desktop。各项 exit 0、success=true，以下明确数目均为 PASS，无 skipped。

| 精确命令 | PASS | 报告位置 |
| --- | --- | --- |
| node scripts/xiaozhi-agent/pi-mcp-boundaries.mjs | 29/29 | test-results/xiaozhi-agent/pi-mcp-boundaries-8xAIdK/report.json |
| node scripts/xiaozhi-agent/capability-phase1-smoke.mjs | 32/32 | TEMP/xiaozhi-capability-phase1-grcISL/report.json |
| node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs | 10/10 | TEMP/xiaozhi-capability-phase2-contract-4A1x0W/report.json |
| node scripts/xiaozhi-agent/capability-phase1-production-smoke.mjs | 8/8 | test-results/xiaozhi-agent/capability-phase1-production-PviUpE/report.json |
| node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs | 24/24 | test-results/xiaozhi-agent/capability-phase2-production-Ly85l3/report.json |
| node scripts/office-agent/hana-tools-smoke.mjs | 14/14 | test-results/office-plan/hana-tools-5Frasb/report.json |
| node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs | 12/12 | TEMP/xiaozhi-office-boundary-m0xHWB/report.json |
| node scripts/xiaozhi-agent/pi-goal-task-store-smoke.mjs | 8/8 | test-results/xiaozhi-agent/pi-goal-task-store-0VLwmo/report.json |
| node scripts/xiaozhi-agent/pi-terminal-cancellation-boundaries.mjs | 5/5 | test-results/xiaozhi-agent/pi-terminal-cancellation-GuoDpk/report.json |

每个精确命令、durationMs、exitCode 与完整日志绝对路径在 TEMP/xiaozhi-harness-phase3-regressions-final.json。日志依次为 TEMP/xiaozhi-harness-phase3-regression-{mcp,phase1,phase2-contract,phase1-production,phase2-production,hana,office-boundary,task-store,terminal-cancellation}-final.log。末项为原 Journal 取消恢复边界，真实 shell/Job 取消由 operations 9 和 helper 51 另证。

最终相同合成文件交错测量 direct Native 50 次均值 1.130736 ms、P95 1.4726 ms，Phase1 Adapter 50 次均值 2.863234 ms、P95 3.3868 ms，Resolver 100 次均值 0.699475 ms。Phase2 前轮同类观测为 direct 1.391404 ms、Adapter 3.43256 ms、Resolver 0.732285 ms。本轮性能数字覆盖 Native/Resolver 链，未作为全部权限 Tool 或模型响应的性能证明。

全部专项结束后 TEMP/xiaozhi-harness-phase3-source-freeze-1SFFDC/after-tests-verification.json 再核 80 source、466 out，differences=[]。仓库根 `git diff --check` exit 0，日志 TEMP/xiaozhi-harness-phase3-diff-check-final.log。阶段源码/测试/out 已停止写入并释放独立 Gate3 运行，实施结果不能替代独立验收结论。

### 实施内历史失败保留

- authority-initial.log 中冻结工具输入误用 .input，已修正为原 snapshot .value。
- runtime-initial.log 中 esbuild Go regex 不支持 /u，修正 fixture filter 后实际固定 runtime 3/3。
- production-initial.log 因复制 fixture 缺原 saved_text plan 被 Task admission 拒绝，补真实 update_task_plan 后通过，原复制 admission 保持。
- production-restart.log 为原 180 秒外层 runner FAIL，后续分离 crash-cut 和各段时序，使用有界 240 秒 runner。产品/工具预算保持，主进程退出实测约 570 ms。
- mcp-old-contract.log、mcp-contract-round2.log、mcp-contract-round3.log 保留旧 only-readonly/safe_read/stdio 断言与 fixture 目录复验失败。契约改为保守 external_effect/maxAttempts=1，可信 schema 复验后 29/29。
- windows-current.log 原 50/51，10 秒 native-last-failure case 超时。最终串行 windows-final.log 在原 case 预算 51/51+11/11，原失败未删、未改记为通过。
- operations-broker-pins.log、operations-final.log 保留两轮真实 pin/ACL 清理与目录重命名失败，正式 helper 0x000E0081 修复后 operations-pin-access-round2.log 9/9，owned-cleanup-report.json 记录原 owned 残留精确恢复。
- g3b-ui-final.log、g3b-ui-round2.log 为异步 Grant readback fixture race，round3 旧 new-session selector，round4 隐藏 file-panel 等待，round5 与 ui-final.log 为 settings busy 窗口。最终 user action 和 main authority 保持，fixture 改为实际快照/typed busy 有界等待，ui-final-round2.log 8/8。所有原报告和 screenshots 保留。

上述日志共同前缀为 TEMP/xiaozhi-harness-phase3-。未将包装 PowerShell 的默认退出状态代替 runner 自身判定，最终命令均保存真实 LASTEXITCODE，success=false 始终算 FAIL。原委托候选的非 detached 父进程清理失败、Medium 直接目录新建失败、真正 LPAC registry 失败和所有历史 snapshot 已由总控归档，实际最终 exe/源码身份单独记录。

完整实施日志清单位于 TEMP/xiaozhi-harness-phase3-final-evidence-index.json，包含 77 份日志与 15 份最终成功报告的绝对路径、字节数和 SHA256。单份报告不能覆盖不同测试边界，组件 246、SSR 4 和历史候选 207 的日志单独保留。总控已接管独立验收与归档，本阶段不自行提交/推送或进入下一阶段生产实施。

### Gate3 后 staged CRLF 门禁修正

独立 Gate3 已由总控接受。总控将新增文件 stage 后，`git diff --cached --check` 发现三个 C# 文件共 2525 条 CRLF 空白告警。此前普通 `git diff --check` 没有覆盖未跟踪文件，因此该 exit 0 只证明当时受跟踪 diff，未证明完整新增文件的 staged 门禁。本次保留初始失败事实。

唯一修正为 windows/.gitattributes 的 `*.cs -text whitespace=cr-at-eol`，exe 仍为 `*.exe -text`。只重新 stage 该属性文件，未修改其他 index 内容。最终 `git diff --cached --check` exit 0，日志 TEMP/xiaozhi-harness-phase3-staged-diff-check-attributes.log。没有重新构建或运行 runtime，三份 C#、exe 和全部 out 的已测字节保持。

最终属性修正冻结为 TEMP/xiaozhi-harness-phase3-source-freeze-6eBOp6/freeze.json，80 sourceListHash 为 caaa666f290ef76559b80e471de0653b947b922257239e5175b6d7529c199dd1，466 outListHash 保持 b06680146509d4086c94d7671a4c05ebd3e42262ee80a60e9103551b7d9f2671。与 1SFFDC 的唯一 delta 为 .gitattributes，SHA256 从 ea3ee95719e2ae857549510f28375c3247f82dc351c4d7eda3b6ee8504fbcbc1 变为 4541989d6ff350d0fa21c7880d2481fffe1b1b8a35d46221d5016432306cf300。after-attributes-verification.json 记录其余 79 份 source 与 466 份 out 身份核验，交独立 reviewer 静态签认。
