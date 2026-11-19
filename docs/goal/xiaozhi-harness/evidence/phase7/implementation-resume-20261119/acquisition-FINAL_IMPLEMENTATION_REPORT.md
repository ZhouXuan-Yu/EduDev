# Phase7 acquisition receipt recovery: final scoped implementation evidence

2026-11-19. Production writer handoff; no Git write, renderer/workbench edit, global document edit, actual provider/network/key use, or repository out build was performed by this writer. Root owns the unified build and explicit Task-scope UI action.

## Delivered

Original capability_prepare now writes a versioned completion receipt into the existing permission audit table inside the original acquisition operation CAS transaction. Its exact operation snapshot hash is first bound into the existing ToolContract authority references. The reader ties original owner/session/task/run/generation/callId/candidate/inputDigest/requirements version to the admitted original ToolReceipt/Effect and this outcome reference. It reads original approval requests and explicitly call-correlated native intent/terminal/function evidence. Known dependency/start/function pauses retain ready=false/success=false while their completed attempt becomes proven; genuine failure/cancellation/unclean or unbound work stays unknown. Ready proof also checks original current MCP source/schema, original Registry binding, artifact facts and three execution-file versions. No new Grant, table, index, generic Effect transition or replay rule was added.

Seven scoped production files: acquisition/prepare-receipts.ts (new), acquisition/service.ts, acquisition/state.ts, acquisition/managed-mcp.ts, mcp-controlled-service.ts, events/recovery-readback.ts, production-host.ts. Three new专项 files: scripts/xiaozhi-agent/phase7-acquisition-recovery-smoke.mjs, phase7-acquisition-recovery-worker.ts, phase7-acquisition-proof-smoke.mjs. FINAL_SCOPED_SOURCE_MANIFEST.json contains their exact final hashes; prepare-receipts.ts is 88cd637d269324288f7f437b40d7748be6fce40803efedaed01bbb15fb43993d.

## Final commands and outcomes

From D:/WorkProject/EduProject-harness/apps/desktop:

```powershell
$env:PHASE7_APPROVAL_SCOPE='task'
node scripts/xiaozhi-agent/phase7-acquisition-recovery-smoke.mjs
node scripts/xiaozhi-agent/phase7-acquisition-proof-smoke.mjs 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase7-acquisition-recovery-3hVxGd'
npx tsc --noEmit
node scripts/xiaozhi-agent/phase5-acquisition-lifecycle-smoke.mjs
git diff --check
```

- Final real production Host 3/3 PASS, exit0: this directory report.json/worker.log/native-tool-bodies.json/source-hashes.json and READBACK_SUMMARY.json. Synthetic DB root C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-production-SHCuXH/data/app.db. The exact original dependency, stdio-start and MCP function approvals are decided with explicit Task scope; all continuations use the same Task and candidate. Known pauses, ready, same-Task cached prepare/resolve/execute and cold-main same-Task continuation all passed. Final six capability_prepare Effects are committed with proofs; stages are three needs_approval then three ready. Ten original native terminal cleanups all Job0/profileRemoved/ACE0. Paid0, public GET0, 17 model calls all owned loopback. This is API/production Host evidence for explicit Task approval, not a claim that the current default single-operation UI button has Task semantics.
- Final strict domain proof 22/22 PASS, exit0: C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase7-acquisition-proof-MKjkZM/report.json. Operates only on a new copy of the final synthetic database. Covers exact ready/waiting, SQLite zero-write reader, old missing receipt, wrong owner/generation/call/candidate/operation, rehashed incorrect operation revision/outcome, wrong approval, missing or misbound native/cleanup, changed source binding/schema/Registry/file version.
- Original acquisition lifecycle 14/14 PASS, exit0: C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-acquisition-lifecycle-Bb1hZ1/evidence/report.json. Old Task grant isolation, TTL, whole-file validation, corruption/CAS, cancel/restart and revoked-source behavior remain.
- npx tsc --noEmit PASS. git diff --check PASS (only repository LF/CRLF informational warnings).

## Preserved red and operation boundaries

- Intended RED before implementation: C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase7-acquisition-recovery-GhGb7x/{report.json,worker.log}, DB root phase5-production-crQX49. After approving the original scope the same Task could not dispatch the next prepare: task_effect_recheck_required. This is not replaced by the later pass.
- Original single-operation UI-equivalent failure: C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase7-acquisition-recovery-lciqQO/{report.json,worker.log}, DB root phase5-production-kzYsw3. First two known pauses now have committed Effects/proofs; third Run genuinely failed permission_denied after the consumed dependency approval became uncertain during child stdio pause. This failure is preserved unchanged.
- Separate expected negative confirms the original single-operation scope is never silently promoted: C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase7-acquisition-recovery-Q1j95w/report.json, exit0/one negative check PASS, DB root phase5-production-KAPsVD. Run via PHASE7_APPROVAL_SCOPE=operation and PHASE7_EXPECT_OPERATION_BOUNDARY=1. It intentionally does not claim capability readiness or successful execution.

The minimal safe product completion is a separately explicit current-Task exact-scope UI action, owned by root. Single-operation approval neither signs a Task Grant nor covers future capability_resolve/execute authority. Reusing stage metadata cannot replace those original PermissionEngine checks. No uncertain approval was reset, no one-shot permission was prolonged, and no default button was widened.

## Performance and limits

Final explicit Task-scope setup/approval chain 76,629.105ms; subsequent same-Task cached chain 25,480.655ms; cold-main same-Task chain 21,650.979ms. Earlier code blocked the same-Task path, so these are observed new functional timings, not a controlled speedup claim. The reader adds bounded metadata reads/hashes and cheap stats of three files; it does not add a Node content hash, package tree rescan, canary, network request or Grant. Phase8 performance reuse remains untouched.

Unified build and renderer/UI acceptance are NOT_RUN by this writer and remain root/Terra work. Historical unknown calls without the new exact receipt remain uncertain. Concurrent duplicate acquisition subscribers without their own exact completion proof fail closed. No retroactive trust upgrade is attempted.

Rollback restores only this scoped source slice and keeps all existing acquisition/audit/Effect rows. No table/schema removal or data rewrite is needed. Old code resumes its conservative unknown behavior; preserve proof records and all failed reports for later inspection.
