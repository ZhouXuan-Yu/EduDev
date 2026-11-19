# Phase8 focused cached-tool baseline

2026-11-19, PASS for this explicitly bounded experiment. Repository source/out/manifest/dependencies/Git were not modified. Only isolated C TEMP databases and profiles were written. Previous full-chain/fresh-scope attempts remain failed evidence; this pass does not redeem them.

## Exact next command

```powershell
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase8-cached-baseline-xGCbZ2\cached-profile.mjs' --run
```

Run this identical command once after the scoped source fix. PHASE8_REPO optionally selects an explicitly authorized checkout; default D:/WorkProject/EduProject-harness. The runner builds only its TEMP worker, does not regenerate manifests/out, and uses original source/native helper paths. Each invocation records original source hashes plus runner/focused-worker/helper/manifest hashes and gets a fresh synthetic database, profile, public package copy and workspace. No live model/network/key is used. Public GET is blocked; model requests terminate at the owned loopback fixture.

## Effective experiment contract

The grcqce synthetic fixture is opened readOnly only for its public locked artifact/plan metadata; its 2,928 installed public files are copied to a fresh owned directory. The three execution files are hash-pinned before launch, with node.exe exactly 89,935,872 B SHA256 2ffe3acc0458fdde999f50d11809bbe7c9b7ef204dcf17094e325d26ace101d8. Original cached preparation later validates the complete tree and original plan digest/TTL.

Setup uses only normal production PermissionService APIs: setMode(fullAccess), issue exact public cached dependency and AppContainer Node process scopes for the isolated synthetic session with 1h TTL (normal verifyProcess still hashes/verifies Node); legacy workspace read scope already comes from the original workspace API. Initial discovery/prepare runs the original native catalog probe, then returns the original discovered MCP read_text_file scope approval. Original permissions.decide(scope=persistent) approves its exact actual serverId/sourceHash/schemaHash scope. The original partially prepared Task and unknown Effect remain intact. A new normal Task then executes the measured cached prepare/resolve/execute chain with no new approvals, real private-source readback and original native cleanup/probe assertions.

No Grant row was fabricated, no Effect was rewritten, no permission/native validator was bypassed. The session-level teacher grants and original discovered scope approval are explicit synthetic experiment setup, not a claim that production grants exist automatically.

The runner deliberately measures one successfully authorized Task. Original Phase7 TaskAdmission currently blocks a repeated same-Task capability_prepare with task_effect_recheck_required even after prior operation phase=ready, because its generic Effect remains unknown. Repeating that unsupported same-Task scenario is outside this bounded performance comparison. read_effect_receipt is intentionally read-only and cannot clear it. Preserve this separate functional finding.

## Baseline result

Output run-7DwWgZ; synthetic data root C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-production-J4FxiJ. Measured Run run_a6d1347e-d480-48ca-9f05-5e61917aa071, Task xitask_8a0b8466b92c91153aa101d9fb7543447a18b9231d2928b9d62caf7fcf1a8428. report.json success=true, exit=0, 1 bounded check PASS, 24,109.337ms. Whole experiment model calls 8, all loopback; paidCalls=0, sourceRequests=[]; measured Task approval delta=0. Three original native terminals completed with jobActiveProcesses=0, profileRemoved=true, remainingOwnedAces=0; function probe healthMarker=true/failed=false. Original provider result includes the exact synthetic teacher_private text and source version/hash; source file readback is unchanged.

| Measured Run operation | Count | Processed bytes | Inclusive ms |
|---|---:|---:|---:|
| owner-attributed installed Node stream SHA | 6 | 539,615,232 | 2,279.335 |
| complete-tree inventory Node SHA, same measured phase without authority context | 1 | 89,935,872 | 346.613 |
| projected Node stream SHA | 3 | 269,807,616 | 2,792.954 |
| Node copyFile | 3 | 269,807,616 | 68.016 |
| owner installed Node lstat | 44 | metadata only | 6.291 |
| owner projected Node lstat | 6 | metadata only | 0.462 |
| Registry provider-version SQL | 104 | not recorded | 18.488 |
| Registry document SQL | 20 | not recorded | 24.266 |

Times are single-sample inclusive spans; do not add helper lifetime to tool/hash intervals. Node copy bytes identify source payload. lstat profile bytes are file-size labels, not bytes read. Native held-handle executable SHA remains active but is not individually instrumented. SQL spans time original SQL delegates, not all Registry JSON/schema/hash CPU.

## Precisely scoped first source fix

In createManagedMcpProviderRuntime, create one const stdio=owned(options) for that runtime/owner; use it in authorized and tools rather than constructing a fresh forOwner on each path. Leave registerManagedMcpArtifact's separate stdio and production session tools unchanged. This only shares the existing verifiedFiles map; every binding still performs original lstat/fileVersion and recipe/TTL checks, every authority still uses original PermissionService decisions, source changes invalidate the hash cache, and actual native execution still performs held-handle SHA.

Observed four managed-runtime source Node hashes use four distinct controlledId values: 6971 resolve scopes, 7012 execute authorization scopes, 7032 dispatcher scopes, 7050 tools transport. Sharing the object should reduce those four to one in this exact fixed scenario: expected owner source SHA 6 -> 3, a 269,807,616 B reduction; whole measured phase source SHA 7 -> 4. Projected SHA/copy counts and native jobs should remain 3. These are count acceptance predictions, not promised wall-clock savings. Run the identical command after the source fix and compare same check, owner counts, scoped grants, private readback, cleanup/probe and source manifests.

Do not begin Registry batch/read caching or broader client reuse in this first change. The measured Registry SQL delegates total about 42.755ms and do not independently establish total Registry CPU; retain this baseline for a later narrow measurement.

## Evidence

run-7DwWgZ/report.json, profile.json, TIMING_SUMMARY.json, source-hashes.json, preflight.json, owned-canary-probes.jsonl, native-tool-bodies.json, worker.log; original synthetic SQLite was read back readOnly after close. This directory contains the exact executable runner, observer and focused worker for replay.
