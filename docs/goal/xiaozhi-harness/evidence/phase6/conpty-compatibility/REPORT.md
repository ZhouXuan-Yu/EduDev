# ConPTY + AppContainer + Job 最小实际 PoC

2026-11-12，TEMP-only。结论为本机最小组合可用。候选由 root/writer 审阅后才能进入产品实施。

## 结果

| 项目 | 状态 | 真实证据 |
|---|---|---|
| ConPTY 附加受限 PS5 | PASS | v4 CreatePseudoConsole、SECURITY_CAPABILITIES 与 PSEUDOCONSOLE attribute、CreateProcess 均成功 |
| 进程身份 | PASS | 两个 PS 子进程 TokenIsAppContainer=1，独有 SID 匹配，IL S-1-16-4096，capabilityCount=0，IsProcessInJob=true |
| 真 console 与交互输入 | PASS | PTY 输出 CONSOLE_INPUT_REDIRECTED=False，Read-Host 收到 hello-42，输出 ANSWER=hello-42 |
| resize | PASS | 初始80×24，ResizePseudoConsole(96,32) 返回 S_OK，子进程实际输出 SIZE=96x32 |
| 正常退出 | PASS | interactive case 实际 exit0，case含cleanup 737ms |
| Job取消 | PASS | CANCEL_READY 后 TerminateJobObject(125)，实际 exit125，case含cleanup 581ms |
| 清理 | PASS | 每次运行包括失败均 Job active0、专用SID ACE0、profile移除、profile目录消失。已创建的ConPTY关闭，已启动的reader终止 |
| 独立残留核对 | PASS | 已知helper/child六个PID均不存在，按这些PID过滤的后代为空。4个本次profile mapping/package目录均不存在，37个owned fixture条目最终恢复Medium标签 |
| 生产接线/完整安全 | NOT_RUN | 原Permission Engine/Grant寿命、Task/Run、Electron/worker、Ctrl+C、Node/Python、长时背压、CPU/内存、全安全矩阵和跨机未在本PoC验收 |

v4 probe内部两case总计1331ms。PowerShell计时的真实exe调用为3521ms，exit0，区别包含CLR装载等Main前成本。

## 文件与精确命令

本目录含单文件可独立编译fixture的四个保留版本。ConPtyProbe-v4.cs 包含复用的原helper/PlatformInfo/TrustedRuntimes源码及专用 ConPtyProbe 入口。原产品 Program/Sandbox 实现也被编译，运行入口固定为 /main:Xiaozhi.PermissionRuntime.ConPtyProbe，未调用产品协议入口。

最终source SHA256
e7114e41b1ff79ce33101c28e9e5d2f2d45de6bcfeaaf6a5a4c94dcd6bd29a93

最终exe 58880B，SHA256
341a0af7d189d75c9f12928117638db5dd84e1696f7592ea0bb68b2d26a90c35

精确编译命令在 compile-v4-command.txt，内容如下。

```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:exe /platform:x64 /optimize+ /main:Xiaozhi.PermissionRuntime.ConPtyProbe /out:"C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c\ConPtyProbe-v4.exe" "C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c\ConPtyProbe-v4.cs"
```

实际运行命令为下面这一条。调用自动建立新的唯一profile/owned fixture，执行两个合成case，finally清理自身资源。运行仅使用合成fixture。

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c\ConPtyProbe-v4.exe' 1> 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c\run-v4.ndjson' 2> 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-permission-exec-c87d8484-e5b2-4790-b60d-51c1016cba4c\run-v4.stderr.txt'
```

原始 run-v2/run-v3/run-v4.ndjson、stderr、各run-meta.json、编译命令/日志全部保留。v3因子进程沿用了父stdout，有非JSON行及stderr，按原样保存。后续复现应另起日志文件，保留这些原件。evidence/ 复制本次synthetic脚本、marker和captured-output，manifest.json列文件hash。

## 机器与工具

- 原始OS注册表值见 os-registry.json。EditionID=CoreCountrySpecific，DisplayVersion=25H2，build26200.9711，ProductName原值Windows 10 Home China。宿主运行时读取10.0.26200.0。Framework exe缺少兼容性manifest，Environment.OSVersion返回6.2.9200.0，仅记录原值。
- PS5固定 C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe，子进程实际版本5.1.26100.9711，SHA256 60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f。运行期间FileShare.Read pin并核hash。
- csc固定 C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe，4.8.9221.0，SHA256 46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00。
- 候选CLR实际4.0.30319.42000。machine.json的framework=10.0.14来自准备文件的PowerShell宿主运行时。
- 复用生产 NativeSandbox.cs 初始SHA256 3e62dec0279d130f46e41cefb02f192760b94dfe74b364a44e47a0559cbb3a7b。仅从仓库读取，原文件未改。
- parent TokenIsAppContainer=0，IL S-1-16-8192。未提权、安装依赖或运行时Add-Type。

## 三次最小修正与原失败

1. v1编译成功，未执行。运行前检查发现AssignJob失败时可能遗留suspended child，v2增加仅对本次child的finally TerminateProcess兜底。这是第1次修正，v1源码/exe保留。
2. v2实际失败，CreateProcess返回Win32 203 ERROR_ENVVAR_NOT_FOUND。fixture精简环境漏掉了已验helper保留的LOCALAPPDATA。CreatePseudoConsole与两attribute已成功。finally清理完成，interactive失败、cancel未运行。
3. v3恢复与原helper一致的显式系统/owned环境。实际CreateProcess、AppContainer+Low+零capability、Job和ConPTY创建成功，但父exe重定向stdin/stdout被child沿用。CONSOLE_INPUT_REDIRECTED=True，ANSWER为空，WindowWidth产生IOException。Read-Host提示进入PTY，数据输出却泄至父stdout。exit0未使case判为成功，原失败保留。
4. v4第3次修正按锁定node-pty1.1.0的src/win/conpty.cc:385–390设置STARTF_USESTDHANDLES，并显式三std handle=NULL，bInheritHandles=false。随后两个case通过。到此停止修正与扩试。

没有普通user shell回退。helper是普通Medium控制器，唯一受测shell由SECURITY_CAPABILITIES创建为AppContainer，创建时suspended，加入本次Job并查询token后才resume。HPCON属性与security capability同时位于STARTUPINFOEX。启动flags为EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT|CREATE_SUSPENDED，未使用CREATE_NO_WINDOW或-NoInteractive。

官方API依据见 [AppContainer启动](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)、[ConPTY会话](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session) 和 [GetStdHandle附加行为](https://learn.microsoft.com/en-us/windows/console/getstdhandle)。本机结果以上述实际日志为准。

## Owned清理与保留物

cleanup-inventory.json核对四个独有SID、profile路径/mapping、六个已知PID及其直接后代。查询只限日志里的本次PID/SID/路径，没有全机profile或安全扫描。

cleanup-final.json保留最终MIC核对。第一次icacls /setintegritylevel (OI)(CI)M /T只恢复目录标签，文件仍Low，其原日志保留。随后对已验证owned根内每个目录用(OI)(CI)M、每个文件用M分别设置并读回。37项成功，Low标签0，probe SID ACE0，profile residue0，known PID residue0，known-parent child0。既有Inherited ACL保留。

四个owned执行fixture目录作为证据保留，均位于TEMP的xiaozhi-permission-exec-UUID。本候选根与fixture路径详见manifest/cleanup-final.json。文件保留不代表活进程或授权残留。没有递归删除、教师目录/系统程序ACL修改或其他profile处理。

## 后续接线限制

- 本PoC复用原Projection路径/owner/marker验证、Grant专SID ACE与owned Low标签、cleanup及Native Job/token方法。marker的grantHash为合成值，未证明产品Permission Engine已授权本次PTY，后续必须接其真实Grant/撤销/租约。
- fixture输入/输出为最小同步pipe读写，尚无产品级flow control、partial-frame/parser、parent死亡恢复或完整异常注入。Phase5duplex与Phase6PTy仍需版本化mode、bytes/ack/resize/EOF/terminal-result。
- Job此处沿原kill-on-close与process-count配置，CPU/内存依原Phase5合同实施。真实教师目录MIC保持原状态，owned Low执行副本与main Grant/CAS提交路线继续适用。
- 成功范围是本机、系统PS5、合成Read-Host/resize/exit/cancel两个case。Task/Run、后台跨回答、worker自然退出、renderer、Ctrl+C、Node/Python和完整交付验收继续按后续合同。
