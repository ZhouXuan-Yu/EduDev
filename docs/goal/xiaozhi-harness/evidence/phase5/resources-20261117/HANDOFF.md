# P5-06 resource test leaf handoff

Frozen on 2026-11-17 against HEAD 7a93b4baa38f15566c442c69c2d495113757a13b with concurrent core/UI work. This leaf added only two phase5-resources-* scripts. It did not modify the frozen Extension seven files, production C#, main/shared, existing scripts, main out or Goal status, and did not commit/push. Core granted the exclusive native window and received RUNTIME_RELEASED after the final fixed run.

## Command and evidence

Run from D:/WorkProject/EduProject-harness/apps/desktop.

    node scripts/xiaozhi-agent/phase5-resources-native-smoke.mjs

Final exit0, fixed matrix10/10 PASS, failed0, skipped0, paid0. Report is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-resources-YZnxE4/evidence/report.json. Its15 helper executions include7 actual resource workloads and8 invalid-budget attempts that never started a guest. All terminal receipts report Job active processes0, profileRemoved true, remainingOwnedAces0. All owned execution projections were removed after verified cleanup, and the original PermissionEngine active count is0.

SOURCE_MANIFEST.json records the two exact script SHA256s. The final report also hashes the used JobLimits.cs, SessionOptions.cs, NativeSandbox.cs, launcher.ts and synthetic workload source. The prepared runtime's full immutable sandbox-manifest.json under the report root's runtime/versions directory pins all actual helper sources and runtime pins. Actual prepared helper SHA256 is ca2eacbc0fe1b98ecccdae8690bc63faac2f345f2c7c2b7ed2b7a2cec553fac4. Owned workload executable SHA256 is 01003f7d19875d48458178daccac8282c16a90d0daa1c4e4a213d6c43fb5340f.

New-file whitespace checks used git diff --no-index --check -- NUL <each of the two files>. Each command returned1 for the new-file content diff and emitted no whitespace diagnostics. The combined shell command ended0. Core owns the final staged repository whitespace gate.

## Actual Windows execution path

The fixture is an owned synthetic C# Win32 query/VirtualAlloc workload, embedded in phase5-resources-workload.mjs and compiled into the test TEMP root using the currently verified Microsoft framework compiler. Compilation is test artifact preparation. A separate inspect-host mode only queries its inherited Job metadata. Every memory and CPU workload then runs through original PermissionEngine.run, Sql permission grants, prepareExecutionProjection, original managed runtime and runNativeSandbox in the actual AppContainer Job. There is no ordinary process execution fallback for resource load.

The same explicit fixture Dependency/process/filesystem scopes cover its pinned immutable executable bytes. Runtime preparation uses the original approved environment recipe. No download, dependency installation, secret read or global settings change occurred.

## Fixed results

- R01 prepared the original managed runtime, compiled the owned fixture, and recorded Windows10.0.26200 x64,20 logical processors and20 available processors. The host diagnostic inherited a Job with extended flags15360 and CPU control flags0/rate0. The sandbox guest separately queried its own Job using Win32 QueryInformationJobObject, and reported real Job membership.
- R02 committed and touched16MiB under128MiB. Query read back JobMemoryLimit134217728, CPU flags5 and rate5000, maxProcesses4, and cumulative user-time disabled. Completion was normal with exact cleanup.
- R03 under128MiB committed and touched96MiB, then caught VirtualAlloc failure Win32Error1455. The guest's reported peak Job memory was138940416 bytes and maximum process private bytes120918016. The original helper completion-port handling returned failed/memory_limit and cleaned the full Job. The queried peak is recorded as returned by Windows, including its value above the configured cap. It is not substituted for successful committed/touched bytes or interpreted as a single-process working-set limit.
- R04 used192MiB across the parent and two descendants, with three distinct guest PIDs emitting actual query/allocation frames. Each process stayed below the aggregate cap, maximum reported private bytes87175168. The reported aggregate Job peak was215871488 bytes. A descendant caught Win32Error1455 after touching16MiB in that process. Original helper returned failed/memory_limit and cleaned every process. The initial draft contract line said160MiB, while both actual attempts used192MiB to provide fixture runtime headroom. This numeric clarification is appended to CONTRACT.md. The parent-plus-two-descendant invariant and all assertions were retained.
- R05 CPU rate10000 reference measured8000.9827ms wall,7843.75ms user and46.875ms kernel, giving0.98620698 logical CPU.
- R06 CPU rate62 corresponds to0.62percent of the20-core machine, expected0.124 logical CPU. Query read back CPU flags5/rate62. The same workload measured8309.567ms wall,968.75ms user and78.125ms kernel, giving0.12598430 logical CPU and0.12774631 of the reference throughput. The frozen accepted band was0.025 through0.35 logical CPU and at most0.6 of reference. Hard-cap throttling completed normally and remained independent from cumulative user-time.
- R07 queried PerJobUserTimeLimit10000000 in100ns units for1000ms and received actual failed/cpu_limit on the pure-user loop, with no normal completion. Actual helper duration1703ms includes launch and cleanup.
- R08 used the same1000ms cumulative user-time policy with parent and two child loops. Three distinct guest PIDs and aggregate Job membership were observed, followed by failed/cpu_limit. Actual helper duration6810ms includes launch and cleanup. Guest snapshots are initial/pre-loop samples rather than a final CPU accounting sample at OS termination, so the precise terminal CPU overshoot is unmeasured. The typed result comes from the actual Job completion notification.
- R09 rejected memory below minimum and int overflow, CPU0 and10001, user-time negative and above86400000ms, missing memory field, and memory represented as a string unit. All8 returned failed/invalid_protocol before started, with no guest frames and full cleanup.
- R10 verified every actual normal/failure receipt, projection cleanup and original PermissionEngine active count0.

## Preserved first failure

C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-resources-g2EEAv/evidence/report.json remains8PASS/2FAIL. Memory/CPU limit behavior already occurred there, but the first fixture used Process.Start without redirecting child stdout, so R04/R08 lacked the required child-PID frames. The test fixture was corrected to explicitly redirect and forward stdout/stderr. The same fixed10 cases then passed. Production C# and helper were not repaired or bypassed for this finding.

## Limits of this evidence

All relevant Windows resource APIs supported this machine's tested nested-Job environment. No unsupported Windows API branch was triggered, and no simulated failure is counted as real compatibility evidence. Other Windows/RDS versions, different parent CPU policies and processor-group layouts remain unverified. CPU measurements are one isolated pair with explicit core count, inherited Job metadata, interval and tolerance. They do not establish general production stream-latency or memory performance. Peak Job values are preserved exactly, while successful committed/touched bytes and the original completion-port limit error are separate evidence.

This resource leaf does not accept the entire Phase5. Core continues Extension/H23/secret/host wiring and the root owns independent Gate5. Disabling or reverting these two additive test scripts rolls back the test leaf. Original app/user data, binaries and existing scripts remain untouched. Owned TEMP evidence and the original failed report remain available.

## Evidence wording correction

The leaf author corrected the per-command whitespace exit wording after source freeze. The original handoff bytes remain in source-and-resource-evidence.zip. This readable report records each command's actual return1 and the absence of whitespace diagnostics. The native matrix remains10/10 with exit0.
