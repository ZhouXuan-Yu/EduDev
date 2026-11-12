# Phase3 Windows helper wire contract v1

2026-11-12 冻结，供自有 TEMP 候选实现与唯一生产 writer 集成。候选仅写自己的 TEMP，不写 repo/out。生产接线沿 Pi 1.0.2 公开 operations.exec，helper 单次启动执行一个脚本，主进程保持 Grant、Task 与审批权威。

## 传输和命名

helper.exe 使用 `--protocol-stdio`，stdin/stdout 为 UTF-8 NDJSON。stdout 仅协议帧，程序自身诊断走 stderr，限 8192 bytes。start 首帧限 1 MiB，后续仅 cancel。原 shell stdout/stderr 通过 output 帧 base64 传输，每块最多 16384 bytes。每个 frame 包含 schemaVersion=1、executionId。执行 ID 使用 `xiexec_` 加 UUID，不重复执行收到的第二个 start。

start 字段如下，全部必填，拒绝未知字段。

```json
{
  "schemaVersion": 1,
  "type": "start",
  "executionId": "xiexec_UUID",
  "owner": {"sessionId": "aisession_UUID", "taskId": "existingTaskId", "runId": "existingRunId", "generation": 1},
  "grantHash": "64 lowercase hex",
  "executable": "canonical absolute trusted powershell.exe or pwsh.exe",
  "executableHash": "64 lowercase hex",
  "projectionRoot": "owned canonical absolute Low-integrity projection",
  "cwd": "existing canonical directory inside projectionRoot",
  "command": "arbitrary PowerShell script, internal maximum 32768 characters including fixed main broker prefix",
  "env": {"XIAOZHI_WORKSPACE": "projectionRoot"},
  "timeoutMs": 60000,
  "maxOutputBytes": 1048576,
  "maxProcesses": 32
}
```

timeoutMs 范围 1000–120000，maxOutputBytes 范围 1024–4194304，maxProcesses 范围 1–64。env 只接受 `XIAOZHI_WORKSPACE`、`XIAOZHI_BROKER_ROOT`，值须在 projectionRoot 内。helper 自行构造已验证系统变量与 owned TEMP/TMP/用户配置目录，禁止继承 API Key/Token/密码/任意父环境。无网络 capability SID。

cancel 帧包含 schemaVersion/type=cancel/executionId/reason，reason 为 cancelled/revoked/timeout。stdin EOF 视为取消，结束 owned Job。stdout 管道断开同样结束 owned 进程。每次 cancel 只处理相同 executionId，重复 cancel 幂等。

## 输出

started 帧包含 schemaVersion/type=started/executionId/pid/tokenIsAppContainer=true/jobAssigned=true/profileName/projectionRoot。PID 必须为实际 shell PID，先 suspended、加入 parent-held KILL_ON_JOB_CLOSE Job，再 resume。禁止使用普通 spawn 回退。

output 帧包含 schemaVersion/type=output/executionId/stream=stdout或stderr/data=base64，忠实返回子进程 bytes。超过预算停止继续发送，最终 truncated=true，仍完整 drain 或受控终止。shell 强制 UTF-8 输出，中文回读单独测试。

result 终帧包含 schemaVersion/type=result/executionId/state/exitCode/truncated/durationMs/cleanup，可选 error。state 为 completed/cancelled/timed_out/failed，exitCode 为真实整数或无法启动时 null。error 为固定错误码，禁止脚本正文和环境内容。cleanup 包含 jobActiveProcesses、profileRemoved、remainingOwnedAces，全部完成清理后发终帧。正常 exit 37 的 state=completed、exitCode=37，由原 Pi 处理非零退出。

失败码最少覆盖 invalid_protocol/executable_changed/invalid_projection/launch_failed/cleanup_failed。cancelled 对应取消请求/EOF，timed_out 对应 deadline。取消后最终 Job active processes=0。

## 隔离与构建

候选复用 PoC Win32 API、普通 AppContainer、显式 handle list、零网络 capability、唯一 profile 与 Job。仅 projectionRoot 及 owned helper TEMP/profile 授对应 SID 权限和 Low MIC。教师原目录、系统目录、registry、其他用户数据的 ACL/MIC 保持。root/cwd 与已有祖先需拒绝 reparse，资源文件拒绝 hardlink。可在唯一 owned TEMP 运行根下生成 UTF-8 payload，再通过固定 shell 参数读取执行，以支持长命令，不把任意脚本拼进 helper 命令行。

目标为 C#/.NET Framework 4.x 独立 Console exe，build-time 编译，优先已有 Framework64 csc.exe，无运行时 Add-Type 编译。候选交付源码、精确 csc 命令、exe、hash、manifest 和真实 OS 报告。生产候选路径拟为 `apps/desktop/src/main/xiaozhi-agent/permissions/windows/NativeSandbox.cs`，生成物拟为同目录 `generated/xiaozhi-sandbox.exe` 与 `sandbox-manifest.json`，资源复制到 `out/main/permission-runtime/`。唯一 writer 审阅后合入，实际 runtime/license/包体记录实施报告。

候选真实测试仅 owned TEMP 与 loopback，覆盖 PS5.1 和可用7、复杂脚本/中文/exit37、stdout/stderr、长命令、外部 sibling/直接socket拒绝、子Job/超时/cancel/EOF、异常父进程结束与profile/ownedACE清理。原 Medium 真实目录创建失败结论保留。PTY/ConPTY 与安装器获取按后续依赖阶段接同一边界。

## v1 兼容维护入口

实际父进程退出测试发现 Windows Node/libuv 会把普通非 detached helper 加入父持有的 kill-on-close Job，父进程异常结束时 helper 来不及清理 profile/ACE。生产 launcher 使用 `detached:true`、`windowsHide:true` 和 stdin/stdout/stderr 三 pipe，helper 用实际父 PID 监控与 stdin EOF 结束自己的 shell Job 后完成清理。原默认 spawn 失败证据保留。

profileName 固定为 `XiaozhiSandbox.` 加 executionId 中去连字符的 UUID。owned projection marker 保持 v1 四字段 `{schemaVersion,executionId,grantHash,owner}`，与 start 一致。main 在受保护辅助记录及原 permission audit 保存必要执行身份，原 Task/Journal 仍是任务真源，辅助记录仅供 owned 进程/profile 清理。

`--cleanup-owned` 读取与 v1 相同结构的 start，核对当前用户 owned TEMP 根、canonical root、marker 四字段和派生 profile SID，零 shell 启动，仅移除对应 owned SID ACE 和 profile。无需读取旧 executable 文件，支持 runtime 更新后的残留清理。返回相同 result/cleanup 终帧，重复清理幂等。主进程仅在撤销、本应用 owned 清理或明确恢复动作调用。启动诊断不会由此重放教师任务、安装或产物写入，禁止扫描或删除任意目录。

## 最终生产 v1 细化

command 的 public Tool 边界为 16384 Unicode codepoints，helper 内部边界为 32768 codepoints，包含固定 main broker prefix。内部先有界读取 65536 UTF-16 code units，再计数 codepoints，避免合法 emoji 输入因 UTF-16 双单元被误拒。超限负例移到内部 32769，public 16385 仍在原公开 SDK 入口拒绝。

cleanup-owned 同时核对 v1 四字段 marker 与 `.runtime/.helper-state/identity.json` 私有 Medium 记录。该记录仅宿主 User/SYSTEM 可读写，绑定原 execution/root/owner/grant/executable/hash/profileName，创建 profile 前原子落盘，子 AppContainer 无权变动。复制 marker 到另一个 root 无法清除其他执行 profile。最终提交始终排除 `.runtime`。

`--platform-info` 输出一个 UTF-8 JSON 行，包含 schemaVersion=1、type=platform_info、platform=win32、architecture=x64、windowsDirectory、runtimes。每个 runtime 包含 kind=powershell5 或 framework_csc、path、sha256、fileVersion、trust=verified/unavailable/untrusted、trustSource=embedded/catalog/none、publisher、reason。Native GetWindowsDirectory 派生固定系统路径，offline WinVerifyTrust cache-only/revocation-none 核验 Microsoft publisher。缺失或未验证 catalog 不会标 verified。该入口不读 stdin、不启动 shell、不变动 ACL/profile。

生产 helper 为三个固定 C# 文件编译，PlatformInfo.cs 承担诊断领域。Windows 普通 Node spawn 的父 Job 失败已保留，生产 detached:true/windowsHide:true/三 pipe 保证 helper 有机会在父退出时自行清理。最终 broker 服务目录持有 FILE_LIST_DIRECTORY 及安全元数据句柄，禁止 delete sharing，防止脚本将 main spool 父目录换成 junction；清理复用原持有句柄。

当前实测的 OS 预算为 deadline、并发 process count 和 output bytes。Job 内存与 CPU 限额在 Phase5/6 继续以同一 helper 落地。v1 不将 resourceUnits 元数据当作已经实施的 OS 内存/CPU 配额。
