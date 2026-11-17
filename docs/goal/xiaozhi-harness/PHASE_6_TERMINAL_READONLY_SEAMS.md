# Phase6 持久终端只读交接

## 基线与范围

2026-11-12。仅新增本文，未构建、测试、安装、改 OS 或调用模型。方案待验证，Phase3 沿用原验收。

- WIP 根为 `D:/WorkProject/EduProject-agent-stream-tools`，HEAD `1945965c6ab36a4785b53f196b4a3048ec612b50`，原脏改与 `%TEMP%/xiaozhi-harness-pre-goal-wip/{tracked.patch,untracked.zip}` 保留。
- Harness 根为 `D:/WorkProject/EduProject-harness`，读取 HEAD `052bd6885c4280b49ab36228fe9ac605799a769b`，Phase4 writer 并行修改由其维护。
- 下表路径相对相应根的 `apps/desktop/`。图未包含未跟踪 PTY 模块，已回读实际文件。Phase5 duplex 计划见 `PHASE_5_CORE_READONLY_SEAMS.md`。

## 旧 WIP 的可复用部分

| 文件 / 符号 | 已有实现与接入差距 |
|---|---|
| `src/main/xiaozhi-agent/terminal/session-manager.ts` / `createTerminalSessionManager` | session 所有权、同 shell 多次输入、序列游标/reset、有界输出、合并异步持久化、寿命超时、list/read/write/close/dispose。需注入受控 backend，补 Task/Job/Grant 与严格资源/副作用生命周期 |
| `terminal/pty-worker.cjs` / `finish`、`close` | 修复后的自然退出路径执行 ending-once、flush、发送 exit 后回调 `process.exit(0)`，另有 300ms unref 兜底。disconnect 关闭。保留此收束顺序，终态须等待受控 cleanup。旧 Windows taskkill 与直接 `pty.spawn` 路线须替换 |
| `terminal/pty-backend.ts` / `spawnTerminal` | 独立 worker IPC、启动 deadline、stderr 尾部、write/resize/close handle。当前 fork 普通 Node worker，由 worker 启动普通 PowerShell，缺受控进程入口 |
| `terminal/tools.ts` / `createPersistentTerminalTools` | 扩展 exec_command 的 tty/background/yield_time_ms，新增 write_stdin/list_terminals/close_terminal，普通前台委托原 Tool。现有终端状态经 `terminal/event-adapter.ts` 投影 |
| `terminal/host.ts`、`ipc.ts`、`src/preload/terminal.ts` | typed list/read/write/close/update，session/归档/workspace 检查。当前 5 秒 sweep 只核 workspace，需接活跃 Grant 撤销/到期监管 |
| `terminal/store.ts` / `createTerminalStore` | 原子 JSON、有界历史、冷启 running → cancelled/app_restart。仅作辅助快照，Task/Run/Effect 与 Job 权威进入原 SQLite/Journal |
| `src/renderer/components/office/terminal/{TerminalViewport,TerminalConsole,TerminalJobs,useTerminalJobs}.tsx/ts` | xterm 懒加载、FitAddon、onData、resize、输入框、Ctrl+C、结束、会话任务列表、重读失败状态。真实入口在 `OfficeConversation.tsx` 与 `AgentPublicTool.tsx` |

保留自然退出收束逻辑，manager 消费受控 handle。可由 helper 直接负责 ConPTY，保留 worker 时仅作受控协议中转，shell 创建和全树关闭由 helper 负责。

## 原始证据与 renderer 边界

本轮读到了 `%TEMP%/xiaozhi-hana-t1-test.log` 和 `%TEMP%/xiaozhi-hana-terminal-kO0oJP/report.json`，两者记录 `ok:true` 与以下 7 项历史通过。对应脚本为 WIP `scripts/xiaozhi-agent/persistent-terminal-boundaries.mjs`。

1. 真实 ConPTY，多次输入保持变量与 cwd。
2. Read-Host 后续输入成功，foreign session 拒绝。
3. 后台返回后继续写实际文件，保留 exit 7。
4. 输出合并、脱敏、32768 字符上限和游标增量。
5. 结束实际 shell child，后续延迟写入未发生。
6. 寿命 timeout 与 workspace 撤销关闭作业。
7. 冷读保留输出，将未完成元数据标记 app_restart，未启动进程。

原报告记录 102 次事件、冷启 598ms、warm command 93ms。`%TEMP%/xiaozhi-hana-t1-legacy.log` 另记录前台 8/8。旧普通权限 backend 本轮未重跑。7 项仅核 shell child PID，worker/helper/ConHost 完整库存需补测。

`%TEMP%/xiaozhi-hana-t2-build.log` 保留真实失败。`TerminalConsole.tsx:13,23` 与 `TerminalViewport.tsx:7,25` 的无初始值 useRef / undefined 赋值触发 TS2554/TS2322，Console 与 useTerminalJobs 的 `window.omniEdu` 可空触发 TS18048。当前源码仍可见这些写法。需修正 refs、typed bridge 可用状态与 async 错误路径，再验证真实 renderer。历史 7 项不能充当完整构建或两尺寸 UI 验收。

## 公开 API 与同一受控 helper

WIP 锁定 `node-pty 1.1.0`、`@xterm/xterm 6.0.0`、`@xterm/addon-fit 0.11.0`。`node_modules/node-pty/typings/node-pty.d.ts` 公开 `spawn(file,args,options)`，IPty 提供 onData/onExit/write/resize/pause/resume/kill。Windows options 有 useConpty/useConptyDll，缺少 token/AppContainer、Job、既有 HPCON 或创建进程工厂注入。仅设置 cwd/env 不满足本任务隔离。依赖 ABI、MIT、体积及 Electron/asar native 资源仍待交付验收。

候选路线在同一 C# helper 内使用 `CreatePseudoConsole`、`PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE`、`ResizePseudoConsole` 与 `ClosePseudoConsole`。输入与输出为 UTF-8/VT，经同步 pipe 独立线程服务。输出须持续 drain，避免关闭时最终帧堵塞。尺寸为字符列/行，resize 需核 HRESULT。官方文档见 [创建会话](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session)、[CreatePseudoConsole](https://learn.microsoft.com/en-us/windows/console/createpseudoconsole)、[ResizePseudoConsole](https://learn.microsoft.com/en-us/windows/console/resizepseudoconsole) 与 [ClosePseudoConsole](https://learn.microsoft.com/en-us/windows/console/closepseudoconsole)。

当前 Harness `permissions/windows/NativeSandbox.cs` 的 `Launch:1886` 使用 STARTUPINFOEX security capabilities、显式句柄、suspended → Job → CheckToken → resume。PTY mode 需在该路径增加 HPCON 属性与资源释放，核对现有 HANDLE_LIST、STARTF_USESTDHANDLES、CREATE_NO_WINDOW 及 `-NonInteractive` 启动参数组合。AppContainer 与 HPCON 组合、PowerShell Read-Host/Ctrl+C、ConHost 生命周期均为 NOT_RUN，需真实验证后才报告支持。失败保持明确错误，禁止普通 user shell 回退。

Phase5 duplex 预留 mode、带序号的 bytes/ack、resize、input-close、cancel、bounded drain/terminal result。MCP stdio 保留 stdout/stderr 分流，PTY mode 传单一 VT stream。Ctrl+C 是终端输入，强制结束仍终止所属 Job 并完成 HPCON/pipe/profile 清理。单独的协议 EOF、用户 Ctrl+D 与停止含义须冻结。后台 Tool 返回后 main 继续持有 helper stdin，保留原父退出/EOF清理。

## Task / Job / Grant 与最小接线

Harness 的 `tasks/task-state.ts`、`tasks/coordinator.ts`、`events/{journal,publisher}.ts` 和 `06_TASK_EXECUTION_PROTOCOL.md` 已规定 Task 唯一 owner/generation 与 SQLite/Journal 真源。新增 terminal Job 子记录关联原 logical conversationId、Task、origin Run/generation、admission callId、executionId、Grant refs、provider/runtime hash、投影与输出游标，JSON 只缓存展示。

当前 `permissions/engine.ts:126–178` 的 run 在 operation 返回时删除 active 监管，assert 要求 current Run。后台 Tool 若早返回会失去该段活跃撤销管理，复用旧 Run closure 又会在新 Run 失效。需为持久 Job 建受控 lease/supervisor，保留 expiry/revoke/cancel 直到真实 cleanup，冻结新 Run 的接管或停止规则。终端跨回答存活和旧 generation 禁止继续发指令须同时实现，原 Task owner fence 继续适用。后台仍有 deadline、CPU/内存/process/output/input 预算。

最小增量如下。

- 共享契约沿 `src/shared/xiaozhi-terminal.ts` 版本化扩展，保留旧前台字段。Tool 完成、后台 Job running 与 Task 完成分别持久化，write_stdin 作为可产生副作用的受控执行，经原 admission/permission/effect 边界，读游标单独处理。
- typed IPC 复用 list/read/write/resize/close/update，严格字段/范围/调用方/Job owner、sequence 与输入 ack 校验。renderer 仅传 jobId 和输入/尺寸，authority 来自主进程。每次输入重核授权，关闭路径允许清理已撤销 Job。
- `permissions/windows/{operations,launcher,projection}.ts` 复用投影、Grant assert、audit recovery、CAS提交及 cleanup-owned。PTY/后台写入先留 owned Low 副本，明确关闭/静止后才按 Grant+CAS 提交，避免活进程边写边提交。原教师目录标签保持。
- startup 只读重建历史，核原恢复记录并回收 owned 资源，running 转中断/待核。教师继续时沿同 Task 新 Run/generation 重新核验并启动，命令与输入不自动重放。PID 不能单独作为接管证明。
- UI复用旧工具卡与独立作业列表、xterm/fallback输入、Ctrl+C、resize、结束和重读。补桥缺失/loading/denied/stale owner/expired/reconcile 状态，限制粘贴和队列，异步错误可见。刷新/切会话后旧回调不写新会话。

## Phase6 必需真实测试

以下全部 NOT_RUN。后续保留命令、stdout、SQLite/文件读回、失败原件与清理库存。

| 集合 | 验收要求 |
|---|---|
| 真 PTY | helper启动token/Job证据，console API实际可用，多次变量/cwd、Read-Host、授权Node/Python交互、ANSI光标/Unicode、resize与Ctrl+C后shell继续 |
| 后台 | 经原Pi/Task入口返回后继续产生文件/输出，新回答能查看；前台stop与独立Job close符合合同；关闭后无延迟写入 |
| 生命周期 | 自然exit 0/非0、初始化失败、输出堵塞/输入背压、重复close、worker断链、helper强杀/父退出，shell/child/helper/ConHost与owned库存核对 |
| 授权 | foreign session/Task、旧generation、撤销/到期/换workspace、篡改runtime拒绝，新Run接管规则，活跃资源限额与Phase5超限机制接线 |
| 恢复/效果 | SQLite+Journal+缓存一致，崩溃中断不重放，原same Task新Run继续，未提交投影/CAS冲突/未知副作用可核对 |
| UI/兼容 | 修复旧renderer错误后真实Electron 1366×768/1920×1080，输入/粘贴/停止/重读/重开会话，原前台8项与旧数据兼容，依赖ABI/打包路径 |
