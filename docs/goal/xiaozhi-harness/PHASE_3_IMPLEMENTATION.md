# Phase3 实施合同

2026-11-12，实施树 `D:/WorkProject/EduProject-harness`，分支 `codex/xiaozhi-harness-20261112`。本合同基于 Gate2 接受后的整合提交 `0e23b90bb72af8463630bcf3b9220fbe76b8aebf`。当前仅冻结合同和核对接缝，生产、测试与 out 的修改等待总控 RELEASE。总控负责进度文档、验收台账和 Git，实施者独占生产与测试写入。

## 教师结果与完成边界

本阶段服务 M10 AI 治理、M01 本地数据和 M12 Windows 交付。教师在现有四模式和资料与权限页明确授权后，小智连续完成范围内的文件加工、复杂脚本、已授网络/MCP和非敏感环境配置。超出范围时显示可理解的集中申请，拒绝后同 Task 不重复申请同一请求。审批跨重启保留，撤销立即阻断新执行并取消对应活动操作。

执行沿既有 Pi、Task admission、Journal 和 Execution Boundary，Phase2 的 Capability Dispatcher 消费同一 main-owned 权限。权限检查位于实际 IO 前及最终提交点。原模型/renderer 提供的模式、authorized 字段、Skill 声明或环境开关均不能产生 Grant。

受控终端保留完整合法 PowerShell 脚本、管道、脚本块、循环和子进程能力。已验证的普通 AppContainer、父持有 Job、明确 handle list 和零直接网络 capability 为 Windows 默认后端。教师原目录的完整性标签保持，脚本在 owned 低完整性执行投影运行，main 按当前 Grant 与原始文件版本提交允许的变动。投影实际 cwd 与教师逻辑目录的映射明确进入工具上下文和结果。

## 已核对事实

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
