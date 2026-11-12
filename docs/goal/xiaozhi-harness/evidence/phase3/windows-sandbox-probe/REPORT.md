# Windows controlled PowerShell feasibility probe

Executed 2026-11-12, approximately 13:08–13:17 Asia/Shanghai. All written artifacts and fixture ACL changes are under this owned TEMP directory. The only additional state created was the uniquely named AppContainer profile, subsequently removed through its Windows API. Production source, tests, out, root documentation and Git were untouched. Real model calls, real documents, downloaded tools and paid services were zero.

## Observed results

| Probe | Status | Evidence |
|---|---|---|
| Ordinary AppContainer Windows PowerShell 5.1.26100.9711 | PASS | Full encoded script executed, exit 37 |
| Ordinary AppContainer existing bundled PowerShell 7.6.9 | PASS | One compatibility attempt, same full encoded script, exit 37 |
| Positive workspace read/write | PASS | Input 4,5,6, pipeline filters, nested script blocks, loop, square sum 77, Unicode file readback `sum=77 unicode=教师中文` |
| Sibling file read rejection | PASS | System.UnauthorizedAccessException in both shells |
| Sibling file write rejection | PASS | System.UnauthorizedAccessException in both shells, original canary unchanged |
| Direct loopback socket rejection | PASS within bounded test | Unsandboxed TcpClient positive control connected. Both AppContainer scripts timed out after 1500 ms against the same live listener. Pending remained false. No capability SIDs were assigned. |
| stdout and exit propagation | PASS | HELLO_APP_CONTAINER / exit 23, full script stdout / exit 37, explicit UTF-8 preserves Chinese |
| Job cancellation including actual PowerShell child | PASS | Child marker created. Timeout 2500 ms. Job active processes 4 before cancellation, 0 after, child PID absent, parent exit 124. |
| Real LPAC with ALL_APPLICATION_PACKAGES_POLICY | FAIL for unmodified system PowerShell | Corrected attribute 0x2000f, OPT_OUT 1. Exit 4294639616 (0xfffb0000). Startup reports inability to open registry key SOFTWARE\Microsoft\PowerShell, access denied. No system ACL was changed. |
| Profile and ACL cleanup | PASS | Profile folder and mapping absent, remaining unique-SID ACEs 0 including descendants, integrity reset to Medium, all observed probe PIDs absent |
| Restricted-token alternative | NOT_RUN | Ordinary AppContainer already supplied the required minimum feasibility evidence |
| Node/Python, PTY/ConPTY, direct public internet, arbitrary installer, hardlink/junction/reparse attacks, cross-session IPC/process attacks | NOT_RUN | Outside the bounded probe |

Raw final ordinary-shell outputs are `full-stdout.log`, `powershell7-stdout.log`, `basic-stdout.log` and `cancel-stdout.log`. `run-transcript.log` preserves all attempts, including failed and superseded experiments. Final real LPAC bytes are `lpac-corrected-stdout.log`, decoded from UTF-16LE into `lpac-corrected-stdout-decoded.txt`.

## Exact execution and compilation

Run from the installed PowerShell 7 host. C# compiles in memory through its existing Add-Type compiler. No SDK or compiler installation occurred.

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-windows-sandbox-3314308a542041038fb20355f5e385dc\run-probe.ps1'
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-windows-sandbox-3314308a542041038fb20355f5e385dc\run-probe.ps1' -OnlyLpac
```

The script's actual compilation statement is below.

```powershell
Add-Type -Path (Join-Path $probeRoot 'NativeProbe.cs')
```

The launcher calls CreateProcessW using the fixed executable path, `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand <UTF16LE-base64>`, STARTUPINFOEX, SECURITY_CAPABILITIES with the unique AppContainer SID and zero capabilities, and an explicit inherited handle list containing output and NUL input. The full generated payload is saved as `synthetic-payload.ps1`. The child/cancel payload is saved as `cancel-payload.ps1`.

The original ordinary-token parent had TokenIsAppContainer 0 and Medium integrity S-1-16-8192. Both working shells had TokenIsAppContainer 1, Low integrity S-1-16-4096, the expected unique AppContainer SID and zero capabilities. IsTokenRestricted returned false for these AppContainer tokens. This probe selected the AppContainer security-capability mechanism. A supplemental token-information-class-46 query returned unavailable on this machine and supplies no LPAC evidence.

The child starts suspended, is assigned to a parent-held KILL_ON_JOB_CLOSE Job, and is resumed only after assignment. Timeout uses TerminateJobObject, waits for the parent and drains the Job. The final helper also drains remaining owned Job processes after normal parent exit. The previous compatibility run used the same isolation and handle list and relied on Job close to terminate any residual console host. Later corrected-LPAC cleanup verified active Job count 0 explicitly.

## Toolchain and platform

`machine.json` stores the exact current inventory. This machine is x64, EditionID CoreCountrySpecific, DisplayVersion 25H2, build 26200.9711. Registry ProductName is Windows 10 Home China. Existing .NET runtimes are Microsoft.NETCore.App 8.0.21 and 10.0.9 plus Microsoft.WindowsDesktop.App 10.0.9. No .NET SDK was installed. The legacy Framework64 v4.0.30319 csc.exe exists, while cl/clang/cmake were absent from PATH during the preceding read-only audit. This experiment used Add-Type under PowerShell 7.6.9.

Windows PowerShell script version is 5.1.26100.9711. Its executable file version is 10.0.26100.8875. The successful PowerShell 7 executable is the already-installed Codex runtime at `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1110-778-0_26.1110.778.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe`. No WindowsApps ACL was modified.

## Corrections and limitations

The first CreateProcessW attempt failed with error 203 because the explicit environment omitted standard non-sensitive user profile path variables. Adding APPDATA, LOCALAPPDATA and USERPROFILE together with SystemDrive, SystemRoot, windir, PATH and owned TEMP/TMP produced the successful launches. The exact block is in NativeProbe.cs. Secret-bearing parent variables are excluded.

An initial LPAC-labelled experiment mistakenly used process attribute 0x2000e. That value selects child-process policy. Its 0xc0000142 outcome is invalid as LPAC evidence. The source was corrected to 0x2000f using Microsoft's WinBase.h enum and the corrected-only run was repeated. The actual LPAC result is the concrete registry denial listed above. Both the mistaken attempt and corrected results remain in the raw transcript.

Only the fixture workspace received Modify permission for this unique AppContainer SID. Its integrity label was temporarily set Low for write tests and restored Medium. The sibling retained its original ACL. No true workspace, user directory, Windows program directory or registry DACL was modified. Ordinary AppContainers retain their Windows-provided default system/package resource access and their own profile storage. The result establishes the tested user-fixture boundary and bounded direct loopback rejection. A complete production allow-scope audit needs additional reparse, shared-resource, IPC and destination tests.

The captured output file is deliberately supplied as an inherited write handle by the trusted parent, analogous to a production stdout pipe. No inherited source-file or user-data handles are supplied. This PoC merges stdout/stderr into that file, uses NUL stdin, and passes a bounded script through EncodedCommand. Streaming onData, arbitrary stdin/long-command transport, authenticated helper protocol, execution/grant ownership, revocation, crash recovery and signed/versioned packaging remain production implementation work.

Real LPAC startup needs registryRead or a narrower verified registry-resource solution. The failed message identifies SOFTWARE\Microsoft\PowerShell, while this experiment did not test adding any capabilities or system permissions. Owned copies may solve executable/file dependency access, and a trusted fixed-version PowerShell runtime package can be evaluated independently. Copying an executable alone does not establish that its system registry requirements are satisfied.

## Reusable implementation direction

Ordinary AppContainer plus exact SID fixture ACLs, an explicit handle list, zero direct network capabilities and a suspended-start parent-owned Job can execute complex PowerShell scripts on this Windows Home machine. The existing Pi operations.exec seam can dispatch to a separately built, fixed-version/hash native helper using these mechanisms. Main-process grants still own admission, exact filesystem scope, brokered network/dependencies, cancellation and revocation. LPAC can be evaluated as an incremental hardening option once its resource needs are explicit.

The current files are reviewable feasibility code. Repeated fixture setup and cleanup operate only on this exact owned TEMP root and unique profile. They have no production integration authority.

## Cleanup evidence

`cleanup.json` was collected after the final corrected-LPAC run at 13:17:04+08:00. All 16 observed parent/child PIDs are absent. Profile folder `C:\Users\ZhouXuan\AppData\Local\Packages\xiaozhiprobe3314308a542041038fb20355f5e385dc\AC` and the matching HKCU AppContainer mapping are absent. Unique-SID ACE count is 0 across workspace and descendants. `workspace-cleaned.sddl` records the final descriptor. The loopback listener was stopped in finally after the ordinary-shell run. PoC source, synthetic files and logs remain for review.

## Official references

AppContainer and LPAC launch APIs, dual-principal access and resource requirements are documented by Microsoft. [Launch an AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

Handle-list inheritance and security capabilities are process attributes. [UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)

The corrected LPAC attribute has enum number 15, combined with INPUT bit 0x20000. [Microsoft WinBase.h](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/WinBase.h)
