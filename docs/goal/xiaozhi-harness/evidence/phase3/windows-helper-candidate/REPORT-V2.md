# Windows controlled PowerShell helper candidate

Completed 2026-11-12 in an independent owned TEMP candidate. Production repository, out, teacher files and system ACLs were untouched. Downloaded tools and paid model calls were zero. The preceding LPAC registry failure and explicit-Medium new-file failure remain valid boundaries.

## Frozen identity and artifacts

Final helper SHA256 is `2e041ab69b69a83b07d1518543fa4e15931f23ef78b336d1c9ee35ea852bd220`, size 39936 bytes. Source SHA256 is `74f3615422fdc3d225e87e16ab1307bd73299b4058501234fa80cd538b582beb`. `sandbox-manifest.json` records the source, compiled runtime pins, architecture, compiler identity, host spawn requirements and maintenance mode. `snapshot-v2` contains the immutable integration handoff. Earlier `snapshot-v1` and failed test evidence remain available.

The build uses existing `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`, compiler file version 4.8.9221.0, C# 5, x64 console exe, .NET Framework 4.x. No runtime Add-Type, runtime compilation, SDK installation or external package dependency is used.

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\build-helper.ps1'
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\test-helper.mjs'
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\cleanup-inventory.ps1'
```

`build-command.txt` contains the exact csc command. It compiles NativeSandbox.cs and TrustedRuntimes.cs with `/target:exe /platform:x64 /optimize+ /checked+ /warn:4`. The helper uses Windows Win32 APIs and installed .NET Framework assemblies. It introduces no third-party libraries. The distribution/licensing and cross-machine runtime provisioning review remains with the application packaging stage.

## Accepted wire and launch behavior

stdin accepts strict UTF-8 NDJSON with a 1 MiB first frame and 4096-byte control frames. All start and owner fields are required. Unknown fields, duplicate JSON keys, malformed UTF-8, invalid IDs/hashes, out-of-range budgets and scripts exceeding 16384 UTF-16 code units are rejected. Only cancel controls follow start. Mismatched execution cancel is ignored and repeated matching cancel is idempotent.

stdout contains started, output and result frames. output carries distinct stdout/stderr bytes in base64 chunks of at most 16384 bytes. Both streams share the bounded byte budget. Queue capacity is bounded. Exceeded output terminates the owned Job and reports truncated plus fixed output_limit. Diagnostics use fixed codes on stderr with an 8192-byte bound. A malformed request lacking a usable ID uses reserved `xiexec_00000000-0000-0000-0000-000000000000`.

The shell executable path and SHA256 must match both the frozen start request and the build-compiled pins. Its file remains open without write/delete sharing across hash verification and process creation. The required local pin is Windows PowerShell 5.1.26100.9711. The optional pin is currently the existing Codex-bundled PowerShell 7.6.9. Its exact WindowsApps path is a machine-local option and carries required false in the manifest. Other machines or updated binary hashes require a newly verified runtime manifest/build.

The helper accepts only a current-user-owned `%TEMP%\xiaozhi-permission-exec-UUID` root and strict marker `{schemaVersion,executionId,grantHash,owner}` matching start. Root/cwd, existing ancestors and initial resource entries reject reparse paths. Initial resource files reject hardlinks. Cwd and the two permitted extra environment path values must be inside projectionRoot. Special, relative, UNC, device and ADS-style path inputs are rejected. The root identity is held open. Shared user/TEMP ancestors are validated with read-attribute handles to avoid conflicting with existing Windows directory users.

Only the owned execution projection receives the unique AppContainer SID and Low MIC. Runtime and system program DACLs are unchanged. A new ordinary AppContainer has zero capability SIDs. Its actual token is checked for package SID, Low integrity and zero capabilities. The fixed shell starts suspended, is assigned to a parent-held KILL_ON_JOB_CLOSE/process-limited Job, then resumes. stdout/stderr have separate pipes. The inherited handle list contains only their write ends and NUL stdin. Environment construction excludes arbitrary parent variables and secrets.

Commands are saved as UTF-8/BOM payload files under `.runtime`, with a fixed UTF-8 console prefix. The shell reads the fixed payload path. A final `if (-not $?) { exit 1 }` retains Pi's original `-Command` last-command failure behavior. Explicit script exit codes remain actual process exits. The isolated process's Windows exit code is represented as signed 32-bit integer, as in .NET Process.ExitCode.

Node must spawn helper with detached true, windowsHide true and three protocol pipes. Keep stdin open while executing. Cancellation, EOF, stdout breakage and the real parent-process handle terminate the helper-owned Job. The helper survives ordinary host-process termination long enough to clean its owned profile and ACEs. [libuv Windows parent Job implementation](https://raw.githubusercontent.com/libuv/libuv/v1.x/src/win/process.c)

## Maintenance recovery

`--cleanup-owned` is the authorized wire-v1 maintenance entry. It reads the same strict start frame, with a harmless placeholder command. It validates the original marker and the helper-written `.runtime/.helper-state/identity.json`. The private record is written before profile creation and binds schema, execution, root, owner, grant, executable path/hash and deterministic profile name.

The private state directory has a protected DACL limited to the host user and SYSTEM, plus Medium MIC. Its file is also Medium-labelled. The AppContainer grant skips this subtree. The shell's attempts to read, overwrite and recursively delete it were all rejected in the real test. Host token validation requires a non-AppContainer Medium-or-higher host.

Profile names are `XiaozhiSandbox.` followed by the execution UUID without hyphens. Cleanup derives this execution's package SID and removes only its matching ACEs from the owned projection, followed by the matching profile. It launches zero shell processes and emits a single result frame. Actual executable reads and active Grant checks are skipped during recovery so revoked or updated-runtime executions can be cleaned from a trusted main record. No profile enumeration is performed by the helper.

The private record prevents a copied writable marker in another root from supplying a valid recovery identity. Wrong execution, altered grant, cloned marker, mismatched executable identity and reparse resources are rejected. Recovery is idempotent. Main must preserve its trusted execution record, ignore writable markers as authority after a script runs, and exclude the entire `.runtime` tree from commit.

## Final real Windows verification

Final frozen binary run `evidence-1794470182707/summary.json` reports **51/51 PASS**, with each request, raw protocol stdout, raw helper stderr, decoded child streams, helper process exit and timing retained in that directory. Tests cover the original 20-item suite and the following maintenance/boundary cases.

| Area | Actual evidence |
|---|---|
| Full scripts | PS5.1 and installed PS7.6.9 pipelines, loops, script blocks, Chinese file/output, separate stderr and exit 37 |
| Long command | 15000 Unicode characters read from an owned UTF-8 payload |
| Filesystem boundary | Positive projection write, sibling read/write denied, sibling unchanged, cwd/env out-of-root denied |
| Direct networking | Unconfined loopback control connected once, confined direct socket reached the listener zero times |
| Lifecycle | 1000 ms deadline, explicit revoke cancel, EOF, actual PowerShell child Job cancellation, repeated cancel, wrong execution cancel |
| Parent failure | Detached Node host exited abruptly, helper cancelled its Job and returned a clean result |
| Helper failure | Actual helper SIGKILL killed the shell Job, left its private recovery record, then cleanup-owned removed the profile and ACEs |
| Recovery scope | Idempotence, wrong execution, cloned writable marker in a different root, grant mismatch, executable-identity mismatch and reparse rejection |
| Private identity | Child read/write/delete attacks denied while trusted host recovered the same identity |
| Output boundary | Combined byte limit, output chunk bounds, UTF-8 Chinese, stdout pipe break and bounded exit |
| Protocol boundary | Duplicate start/key, unknown field, secret env key, invalid UTF-8, oversized frame, schema and all configured budget boundaries |
| Process budget | Four attempted simultaneous children with maxProcesses 2 permitted at most one executing child and rejected the excess |
| Executable changes | Wrong supplied hash rejected, actual byte mutation of an owned build-pinned runtime rejected before started |
| Exit semantics | Last native failure, nonterminating error and throw exit 1, a recovered final success exits 0, explicit exit 37 preserved |

The actual-byte-mutation case compiles the same NativeSandbox.cs against a test-only pin for an owned copy of powershell.exe, mutates that copy after pin compilation, then verifies executable_changed with zero started frames. Its exact csc command and separate variant are retained under that evidence directory. System runtime bytes and ACLs were untouched.

Final sample wall times are approximately 0.58 s for PS5 complex execution, 1.66 s for optional PS7, 1.05 s for the 1000 ms deadline case, 0.30 s for explicit cancellation, 0.22 s for EOF and 0.08–0.09 s for recovery. The 1 MiB oversized-frame rejection takes approximately 2.4 s because the bounded parser reads it before rejection. This is isolated helper evidence. Production grant/commit and teacher-page latency require main-path measurements.

## Preserved failures and corrections

- The first csc invocation split `/out:` from its path because of a PowerShell array-expression mistake. Parenthesized the single argument. Final exact argv is recorded. Initial tool output remains in the chat trace.
- Early strict path tests failed due to directory sharing conflicts. Existing user/TEMP directories have active Windows handles. Ancestors now use read-attribute/shared handles, and the exact owned root reuses its stable writable handle. Early request/result evidence remains in `evidence-1794468001168` and following failed directories.
- The first abrupt-parent test used Node's default Windows child Job. It killed helper before its finally cleanup. This failed case is preserved in `evidence-1794468426563`. Its one owned residual profile/ACE set was explicitly removed by the compiled bounded utility, with `cleanup-default-spawn-failure.log`. Detached-spawn retests passed.
- .NET Console stdout suppressed broken-pipe failure in the first breakage test, allowing the script to last until deadline. Protocol writes now use checked Win32 WriteFile, and bounded breakage passed. The failed suite remains in `evidence-1794469269441`.
- The first process-budget test incorrectly expected maxProcesses 2 to reject one child. It was corrected to attempt four concurrent children and verify the actual active allowance. The original expectation failure remains in `evidence-1794469522509`.
- Original Pi uses `-Command`. A direct owned control showed exit 1 for a final native failure while the initial `-File` transport returned 0. The fixed trailer and four explicit semantic regressions now preserve the intended failure result. The owned control payload remains `exit-semantics.ps1`.

## Cleanup and remaining boundaries

`cleanup-inventory.json` records an independent exact-profile and fixture ACL inventory. It derives only profile names already emitted by these tests, checks their exact HKCU mappings and package paths, and checks only fixture roots listed in the owned test summaries. Reparse test entries are skipped without traversal. All observed profiles/mappings and all matching owned ACEs were absent in the final inventory. The owned projections and raw evidence remain for review. Their Low labels are intentional disposable-execution labels, while the private identity subtrees remain Medium.

Root/main retains current Grant, Task/Run ownership, audit, cancellation, projection preparation and original-file-version CAS commit. A live helper that is force-killed requires explicit cleanup-owned from that trusted record. Recovery rejects reparse or hardlinked trees and can return cleanup_failed for unsafe/unavailable residues, preserving the scope boundary. Automated repair of arbitrarily attacker-mutated output trees remains a separate reviewed recovery operation.

The command transport is noninteractive and uses NUL stdin. Script-path introspection observes the owned runtime payload path. PTY/ConPTY, interactive stdin, installer acquisition, public-internet destinations, complete OS escape coverage, ARM64 and other Windows builds were not run. The optional Codex PS7 installation is a local compatibility result. No ordinary-user shell fallback exists in this helper.

This candidate is ready for the unique writer's source review and main/Pi integration. Product acceptance remains with the fresh independent reviewer after production wiring and real user-path tests.

AppContainer token/DACL/Low-IL behavior is documented by Microsoft. [Launch an AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

Per-object ACL updates use handle-based SetSecurityInfo. Handles opened with MAXIMUM_ALLOWED avoid propagation to child objects, allowing explicit bounded per-entry grant and removal. [SetSecurityInfo](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo)
