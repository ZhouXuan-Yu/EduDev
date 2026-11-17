# Phase8 collector preflight and stop-control handoff

SOURCE_DONE. Only phase8-real-model-run.mjs, phase8-real-model-smoke.mjs and phase8-real-model-contract.md changed. The original 32-entry schedule and all other frozen helpers remain intact. Existing six protocol groups plus two concrete dispatch-control groups passed 8/8, skipped 0, exit 0. Real provider calls are 0 and the actual Goal ledger was never opened.

## Future executable commands

Working directory D:/WorkProject/EduProject-harness/apps/desktop. Substitute the final frozen manifest path when Phase8 performs authorized real execution.

```powershell
node scripts/xiaozhi-agent/phase8-real-model-run.mjs preflight "D:/path/to/frozen-manifest.json"
node scripts/xiaozhi-agent/phase8-real-model-run.mjs execute "D:/path/to/frozen-manifest.json"
```

Preflight selects exactly original Q1-r1-A then Q1-r1-B and returns. A later execute invocation uses the unchanged full 32-entry ABBA schedule. Both real commands open only the existing absolute Goal database through the original budget helper. Their HTTP attempts share the same existing 200-attempt allowance, including unknown reservations and prior usage. There is no reset, replacement database, refund, automatic retry or automatic transition from preflight into full collection.

## Actual dispatch control

executePlan delegates to collectScheduledRuns with the original collectRun. The shared serial loop requires an explicit collector callback, and the real collector is supplied only by executePlan after its existing manifest/build/snapshot/actual-ledger checks. Each acquired row is saved and verified using original Run binding against warm/cold readback, actual attempt ownership and matching ledger records, exact provider chat paths, completed transport/status, actual wire model, manifest expectedWire fields and thinking/reasoning parity. The original provider-scoped electron.net.fetch bridge and proxies remain in their frozen modules.

A collection/cleanup/Run-binding/route/transport/model/expected-wire mismatch produces an infrastructureFailure, preserves the failing row and its artifacts, writes progress, marks remaining original identities NOT_TESTED and stops before another collector dispatch. Exhausted allowance stops before the next dispatch. Future CLI collection failure returns exit 1. Terminal and qualityStatus failures alone continue through collection and remain available for independent blind review. The final A baseline's objective failures remain recorded. The B delivery-quality threshold remains with independent Phase8 acceptance.

The normal collector still records artifact bytes, Office readback, decisions, snapshots, timings and original/cold records. The summary now includes mode, planned IDs, stop point, infrastructure reason and separate quality status. The raw failure and progress artifacts are preserved even when later rows are untested.

## Verification and raw evidence

- node scripts/xiaozhi-agent/phase8-real-model-smoke.mjs passed 8/8, exit 0. Final raw report is TEMP/xiaozhi-phase8-real-model-protocol-oi7iVa/report.json, copied as final-report.json. final.log and final.exitcode preserve stdout/stderr and exit status. Whole-process local fixture time was about 2.44s.
- node --check scripts/xiaozhi-agent/phase8-real-model-run.mjs passed, exit 0.
- node --check scripts/xiaozhi-agent/phase8-real-model-smoke.mjs passed, exit 0.
- Direct trailing-whitespace checks passed on the three frozen files.

The first red is TEMP/xiaozhi-phase8-real-model-protocol-wJOVOg/report.json, copied as red-report.json, with red.log/red.exitcode. Existing six groups passed and the two new groups failed because the executable shared-loop export was absent. It is a missing-entry red. No old real Electron/paid 32-run execution was performed to reproduce the previous continuation behavior. The actual new control-flow regression invokes the same shared loop used by executePlan, and verifies dispatch counts and persisted results. The first passing candidate N8A2EZ and later byI2n2 reports remain in their original TEMP directories. No earlier evidence was removed. before-freeze.json and before-* source copies preserve the previous three-file candidate.

The new executable control-flow groups establish the following actual fixture observations.

- Preflight dispatched only Q1-r1-A and Q1-r1-B. The full mode dispatched all original 32 IDs despite every synthetic task having terminal failed and qualityStatus FAIL. Each row's original answer/artifact bytes and its separate quality failure were persisted.
- Collection failure, callback exception, binding error, wrong original Run, wrong attempt Run, provider-route rejection, wrong wire model, wrong thinking and provider HTTP failure each dispatched only Q1-r1-A. Their remaining 31 IDs were NOT_TESTED. Each used allowance remained 1 after closing and reopening its real TEMP ledger.
- An actual A/B thinking mismatch with unspecified manifest thinking stopped at Q1-r1-B after exactly two dispatches. A prefilled exhausted TEMP ledger dispatched zero rows and retained its used allowance.

These callbacks create owned SQLite ai_agent_runs rows and use original readOriginalRecords/verifiedRunBinding. They persist real TEMP budget reservations to simulate dispatch. Those simulated reservations issue no HTTP request. The existing loopback protocol groups made four local upstream requests through the actual counting proxy and preserved its four-attempt limit. The final report retains the actual/synthetic boundary and asserts actualGoalLedgerOpened false.

## Remaining verification and rollback

NOT_RUN includes the real preflight/execute CLI path with frozen A/B Electron builds, actual trusted UI submission, credentials, real DeepSeek/TLS/model/parameter behavior, actual Goal quota consumption and provider retry behavior, actual artifact/Office extraction from model output, real Run-to-wire integration and final quality/latency acceptance. Component fixtures and synthetic failed outputs establish only the declared protocol/control-flow behavior. They make no real-model or product-performance PASS claim.

No production/UI/main/shared/preload/out/package/credential files were edited, and no Electron/native helper, real external network/provider, actual budget DB or Git operation ran. Plan, transport, readback and budget/counting helper hashes are recorded as dependencies. The two corrections can be rolled back by restoring the preserved before-* copies of these three files. No data/schema/budget migration is introduced. Root owns final integration, actual Phase8 execution and status.
