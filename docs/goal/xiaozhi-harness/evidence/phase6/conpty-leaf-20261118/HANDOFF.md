# Phase6 ConPTY leaf交付

2026-11-18。SOURCE_DONE / LEAF_FROZEN。主树D:/WorkProject/EduProject-harness，实施基线0f753e572cbdfa20eaaf130a0f7b23d32e8ac2b8。正式Gate6由root组织，当前交付为受控ConPTY叶域。

## 文件及稳定接口

仅新增以下5个文件。精确SHA及字节数见同目录PRODUCTION_SOURCE_MANIFEST.json。

| 文件，相对apps/desktop | SHA256 |
| --- | --- |
| src/main/xiaozhi-agent/permissions/windows/ConPtyNative.cs | 3bdecfc531a4c268879e548b09b3fd6f5960485d45c7b20bc2c5710f897a298f |
| src/main/xiaozhi-agent/permissions/windows/ConPtySession.cs | 0e4fbc65ea2c76421e5b9c123a5fbd9672c49ba05042f7051eaf7bc84635343d |
| src/main/xiaozhi-agent/terminal/controlled-backend.ts | f3d7d88afd50a2b026e47042f9cc473d998230d0ee1ba3da969d9f6b07f69155 |
| scripts/xiaozhi-agent/phase6-conpty-protocol-smoke.mjs | 0bafbcc8e2a0150bcd89e79fd96c0fe4aec1cc54927ce01c90befbd2d5405e8a |
| scripts/xiaozhi-agent/phase6-conpty-native-smoke.mjs | 4a8a8616c8ec3b693a56c797900824a2e405d8d96b64b5f0b0ee4dd85f57bab9 |

C# namespace Xiaozhi.PermissionRuntime，ConPtySession的internal接口为Create(cols,rows,Action<byte[]>,Action<Exception>)、Handle、StartReading、WriteInput、Resize、CloseInput、Close及public Dispose。尺寸1..1000、输出块最大16384字节，HRESULT沿原异常保留。该实例拥有HPCON、pipe、reader与单次closer。core原queue writer调用WriteInput后生成ACK，core在started后、Resume前调用StartReading，在原Job归零后调用Close。Close持续drain，等待HPCON线程最多5秒、reader最多3秒，失败抛pty_cleanup_failed，重复关闭幂等。

TS导出createControlledTerminalBackend(options:ControlledTerminalBackendOptions):ControlledTerminalHandle，直接依赖core冻结controlled-types.ts。core注入一次已准入launch、AbortController及onData(Buffer)。write保持原sequence/Buffer，resize保持controlId/cols/rows，ready等真实started，closed等原launcher的helper child-close和cleanup。原Task/Effect/Job/Grant/controller、Sql、projection与IO前admission继续由core持有。

core已经接入PtyRunner、SessionOptions/Input、launcher、runtime/build manifest。正式Host/工具侧应复用core terminalShellArguments及terminalEofBytes，typed EOF使用Ctrl+Z+Enter，physical input-pipe close保留独立hangup含义。core生产launcher对PTY使用detached:false，stdio继续原detached:true。旧WIP manager的write/resize应await真实ACK，展示端统一处理原始UTF8/VT字节。

## 最终实际证据

工作目录均为D:/WorkProject/EduProject-harness/apps/desktop。

```powershell
D:/Node/node.exe scripts/xiaozhi-agent/phase6-conpty-protocol-smoke.mjs
D:/Node/node.exe scripts/xiaozhi-agent/phase6-conpty-native-smoke.mjs --only-interactive
D:/Node/node.exe scripts/xiaozhi-agent/phase6-conpty-native-smoke.mjs
```

- 原协议固定12/12，最终报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-conpty-protocol-UKKUkO/report.json。初次qf65Vm的12/12也保留。
- 正常生产源的完整P02先2/2通过，报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-conpty-native-olkrDe/evidence/report.json。
- 随后正常生产源固定9/9通过，报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-conpty-native-7JWAoT/evidence/report.json。detachedCandidate为false。各检查耗时之和15985.39ms。包含实际console/Read-Host、变量42、owned cwd及后续.runtime、ANSI/中文/emoji、96x32、raw ETX后同shell继续、自然exit7、typed EOF实际ReadLine结束exit0、timeout124、revoked原因取消125、四帧取消、output_limit及非法尺寸。
- 最终7个已启动PTY均为Job active0/profileRemoved true/remainingOwnedAces0/ptyClosed true。非法尺寸在创建shell前被拒。该报告旁known-pid-inventory.json核对14个已知helper/shell PID，alive为空。
- 四帧各16384字节，100ms取消前有2个ACK pending，取消后4个promise均settled。部分ACK可在清理取消期间完成，结果保留实际fulfilled记录。
- 实际managed helper SHA为9d0d0c9403a0f1a9645f8023610f6e60d9d53ef378f100dba12b55313e702947，recipe sourceSha256为d8aab792d41d4a0d7686563112a560386b5c189ed0b5dc467227d9fc455e24f2。9源清单及实际exe保留在最终root/runtime/versions/b251beb4aa6c4a725bbe3c8d8d7c93759b46b221d0cee5688319ff36c5b0ea23。
- TEMP Framework64 csc /target:library /platform:x64编译两叶C#成功。strict TypeScript noEmit从backend实际入口及其依赖检查，最终diagnostics0。git diff --check返回0。整树out构建由core持有。

## 全部原失败及修复归属

原cM5QpM固定4/9、pAgbJb固定8/9、Zl2YFU完整P02的Ctrl+C失败全部原样保留。早期csc相对slash路径触发CS1504，改为Resolve-Path绝对Windows路径后编译成功。

测试端保留原actionError，单列Engine.run取消后的authority error。PS5编码/cwd改用core正式bootstrap。physical pipe EOF的原0xC000013A结果保留，typed EOF已单独真实通过。P09 preparse未创建PTY时的清理判定由core修正。

cwd诊断pbCJbB及bY0jdg保留。Win32初始/SetCurrentDirectory都指向正确owned root。PowerShell provider的absolute Set-Location拒绝，而shell-local PSDrive及规范化ProviderPath核验成功。core正式入口据此映射逻辑drive，并在用户command前核验实际physical cwd。

Ctrl+C A/B证据oVTckh保留。仅TEMP esbuild精确替换launcher detached:true为false，原source SHA、patch、候选bundle SHA均保留。raw ETX ACK0.8423ms，新prompt在30.79ms内，同shell后续marker及exit0通过。Win32 packet比较因raw已成功而SKIPPED。core据此正式接detached:!pty。历史--detached-false诊断模式要求旧源精确匹配，其严格匹配在新生产源上会拒绝，正常最终命令不使用该参数。

官方ConPTY输入实现把raw ETX和Win32 key event都送入WriteCtrlKey，primary source核查帮助避免不必要的字节转译。官方SetConsoleCtrlHandler与process creation flags说明Ctrl+C ignore属性和进程组继承。此处的具体行为以上述真实对照为准。来源见[输入实现](https://github.com/microsoft/terminal/blob/main/src/terminal/parser/InputStateMachineEngine.cpp)、[进程组标志](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags)、[控制处理器](https://learn.microsoft.com/en-us/windows/console/setconsolectrlhandler)。

## 验证边界与后续owner

P06验证显式revoked原因的transport取消，实际Grant撤销/expiry watcher、跨Run controller、后台Task/Effect/Job、父进程死亡/应用重启、Node/Python、Electron UI及provider仍由core与Gate6验证。独立ConHost PID库存未采集，HPCON/reader通过helper ptyClosed及双Join核验。CPU/内存超限沿原Phase5 JobLimits，当前叶专项只运行固定已授权预算。完整产品验收状态保持由root管理。

root持有Git整合及回滚。回滚范围应包含这5个文件与core相关薄接线，先沿原Job停止和cleanup保全已有资源事实，原报告继续保留。模型调用0，真实key访问0。

RUNTIME_RELEASED已发送root/core，leaf收尾后不再占用runtime。
