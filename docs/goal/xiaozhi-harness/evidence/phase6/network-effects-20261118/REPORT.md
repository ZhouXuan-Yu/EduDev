# Phase6 Network Effects foundation handoff

SOURCE_DONE. Fixed groups N01 through N08 passed 8/8, skipped 0, exit 0. The final run received exactly 7 actual HTTP requests, retained stable identities for all 12 measured production/fixture sources, closed the owned server and collected the actual crash child's SIGKILL exit. Only two new test scripts were written by this leaf.

## Exact command and evidence

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase6-network-effects-smoke.mjs passed 8/8, exit 0, about 2.55s whole-process wall time. The raw report is TEMP/xiaozhi-phase6-network-effects-ZmF0fw/report.json, copied as final-report.json. final-run.log and final-run.exitcode preserve stdout/stderr and status.
- node --check scripts/xiaozhi-agent/phase6-network-effects-smoke.mjs passed, exit 0.
- node --check scripts/xiaozhi-agent/phase6-network-effects-worker.mjs passed, exit 0.
- Direct trailing-whitespace checks passed on both new script sources. The sources and copies match the exact script SHA in the final raw report and freeze.json.

## Actual normal API path

The scripts reuse phase6-state-foundation-worker.openFixture for the real Node built-in SQLite connection and original TaskCoordinator, TaskState, Journal, publisher, receipt, Effect and checkpoint APIs. PermissionStore and PermissionEngine use actual persisted Scope grants. The Engine current callback validates the exact Task and original three-field TaskOwner through TaskState.validateCurrent. The Broker runs inside an actual Engine.run plus runWithPermission parent context tied to an admitted original tool receipt and its Effect. Authority references are recorded through the original Journal.recordToolContract API. Explicit resume uses original TaskCoordinator.resume for the same Task and a new Run, then a distinct admitted parent tool.

The HTTP transport is the actual createPermissionNetworkBroker loopback path and createNetworkEffects persistence. The literal owned 127.0.0.1 origin receives explicit task-scoped network GET/POST and public egress grants through PermissionStore.issue. The identity sanitizer is a synthetic test adapter. Real teacher approval UI, privacy transformation and external provider permission policy are outside this test.

## Fixed coverage and physical counts

| Group | Verified result | Actual HTTP |
| --- | --- | --- |
| N01 | Same Task/requirements/digest POST, new child calls and a distinct admitted parent return the exact original status/body from the recorded Effect | 1 POST |
| N02 | Real GET with the same child call reuses its exact cached response | 1 GET |
| N03 | Explicit IdempotencyKey reuses an identical POST and rejects the same key with a changed body before another request | 1 POST |
| N04 | Real delivered POST with a lost response remains unknown and refuses replay for a new call and an explicit same-Task new Run | 1 POST |
| N05 | Complete response receipt is published before Effect commit, actual child SIGKILL, cold Journal recovery and same-Task new Run reconcile from the file, then a second cold read preserves revision | 1 POST |
| N06 | Cancellation after delivery preserves unknown, and an explicit retry cannot send another request | 1 POST |
| N07 | Actual network Scope revocation aborts the delivered operation, preserves unknown, and renewed grants still cannot replay it | 1 POST |
| N08 | An independently valid foreign Task cannot borrow another Task's parent receipt, and the stale original owner is rejected | 0 |

Every retry/cached/reconcile path therefore added 0 HTTP. Wire records contain method, route, synthetic request body/hash, service Idempotency-Key, ordinal and response completion. Responses on N01, N02, N03 and N05 completed. N04 drops its connection and N06/N07 retain interrupted response observations. Exact response strings include whitespace and UTF8 characters.

## Preserved failures and core correction

The first fixture attempt is retained at TEMP/xiaozhi-phase6-network-effects-hRb0kg/report.json, copied as first-fixture-failure-report.json, with first-run.log. It produced 0/8 and 0 HTTP because the fixture adapter passed the four-field PermissionOwner into the original three-field TaskOwner validator. Correcting the typed projection restored normal current-owner validation. No product guard was bypassed.

The first corrected product run is retained at TEMP/xiaozhi-phase6-network-effects-o2EjXl/report.json, copied as first-product-failure-report.json, with owner-shape-corrected.log. It produced 7/8, exit 1, 7 actual HTTP requests and zero tested-source drift. All eleven original measured sources were copied with matching SHA into first-product-failure-sources.

N05 exposed an actual recovery-service gap. Independent read-only SQLite observed the network Effect executing at revision 2 with null outcome after a complete status-201 response file existed. The child was killed before the original Effect UPDATE committed. Original Journal.recover changed the Effect to unknown revision 3, empty proofs and an outcome digest derived from missing_result. NetworkEffects.start compared that placeholder against the complete receipt response digest and threw side_effect_unknown. The original failed run and every cold DB/file/child receipt remain intact.

Core repaired its owned network-receipts.ts, network.ts and reconcile.ts. Its shared networkOutcomeMatches helper allows the exact original unknown/no-proof/missing_result/single-journal-reference placeholder to be replaced by a verified file response. The original file/request/Scope checks remain in the actual APIs. Committed/reconciled and other non-placeholder outcomes retain digest matching. This leaf changed no production source.

After the repair, the same N05 fixed scenario persisted executing revision 2 before kill, unknown revision 3 after Journal recovery and reconciled revision 4 with the remote_receipt digest after explicit same-Task new-Run access. It returned the exact original status/body with total route requests still 1. A second cold open preserved revision 4.

The final measured core source SHA256 values are frozen in freeze.json. The three correction files were network.ts 741144b4b6647a042bd237695cd24b415a972918475319ae115d06e440ef360a, network-receipts.ts d8d8580c98eaac2a7edc319ace73d6137a3dadba41d3a319d11bfa0df2887537, and reconcile.ts 10620dec63d6a7c2ca43f97ccdf16a0f0091bbe2579e085cd72509e09ad4969f. Exact final production readback copies accompany the handoff.

## Boundary and rollback

The result is PASS for this network/effect service foundation suite. NOT_RUN includes full Pi/AgentLoop execution, Host IPC, recovery/teacher UI, real external HTTPS/provider/model, TLS or redirect matrices, native helper/PTY, actual application restart, packaged delivery, full TypeScript/build and real-model acceptance. Synthetic fixture timing is the only duration reported here. It makes no product performance or security-completion claim.

This leaf performed no production/shared edits, build/out mutation, key/configuration read, actual paid-budget access, download, remote request or Git operation. Inspector13, UI10, Phase8 and the original foundation worker remain frozen. The complete test fixture and HTTP response artifacts live under owned TEMP. Each suite run spawned one owned Node worker. The initial fixture worker exited 1. The corrected failing and final workers both exited on SIGKILL at the declared Sql boundary. Their exit records are preserved.

Rollback of this test-only deliverable removes its two new scripts together. The core owns rollback and independent acceptance of its three-file production correction. Production data and schema were unchanged by this leaf. All failed and final reports remain available for independent review.
