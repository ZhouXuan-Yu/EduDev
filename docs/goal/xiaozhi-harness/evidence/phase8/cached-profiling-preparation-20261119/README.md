# Focused cached Pi5 profiling seam

Prepared 2026-11-19. This directory is the owned frozen runner; the earlier timing-prep directory is superseded. No repository source, out, generated manifest, existing database, Git or Electron process was changed during preparation.

## Commands

```powershell
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase8-cached-profile-frozen-ecTPbl\cached-profile.mjs' --preflight
# Only after Phase7 independent runtime acceptance has ended:
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase8-cached-profile-frozen-ecTPbl\cached-profile.mjs' --run
```

Run the same --run command once for frozen baseline and once after the scoped fix. Each call creates a separate random owned output, fresh app profile, fresh synthetic original Pi5 database and workspace. An optional PHASE8_REPO selects another authorized checkout; default is D:/WorkProject/EduProject-harness. Use identical checkout/runtime machine conditions and the same public fixture for both. Each output records the exact original source hashes, helper/manifest hashes, three public file pins, original worker hash, instrumented worker hash and script hash. Do not compare warm counts to the first cold session counts.

## Fixture

The known synthetic grcqce fixture exists. The runner opens its original app.db readOnly and obtains only the public ready artifact and locked operation metadata. It reads/hash-checks node.exe, server.mjs and package.json during preflight. It copies only the 2,928 explicit installedFiles into its fresh owned root and seeds cached artifact/plan through original createAcquisitionState.saveArtifact/saveOperation. Existing DB/history/Grants/config/keys are never copied or updated. The original fixed cached-prepare path subsequently rehashes the entire copied tree and enforces the original plan digest, file pins and TTL. Fixture expires 2026-12-17T11:35:08.719Z; expired or missing fixture is a real missing input, not permission to download or scan elsewhere.

This is cold session / warm cached-flow profiling using an existing public installation. It does not test a fresh internet download/install. The historical first original Pi5 check name still mentions install; interpret it under this explicit cached-fixture contract.

## Evidence contract

Original phase5-production-worker five business/security checks remain, including synthetic private result lineage, subsequent/cold-run private rejection, native cleanup receipts and final fullAccess prepare/resolve/execute with zero new approvals. Extra assertions block all non-loopback net.fetch calls and all requested network/egress approval scopes. API keys/tokens/password/secret environment names are scrubbed before Electron; the worker sets its original synthetic loopback model key. No live model or public GET is permitted. First cold synthetic acquisition uses ordinary original local scopes and may need the original automated local approvals; only the final already-authorized fullAccess Run must have approval delta 0.

Actual native execution uses the original runNativeSandbox -> verifySandboxBinary -> helper held-handle executable SHA path. No native validator is replaced. Native spans are inclusive total helper lifetimes; the helper's internal held-handle SHA is preserved but not separately timed.

profile.json records inclusive monotonic spans and owner/runId/callId context where available: file.hash, file.lstat/stat/copyFile for the three execution files; each forOwner instance/method; Registry-only SQL method/table/operation (no SQL text/parameters); native helper lifetime; main event-loop delay. SQL registration gets original publisher owner; per-call Registry assert gets Run owner. Source hash byte totals target execution files; other tree hash rows are marked other. Inclusive spans overlap and must not be summed as an exclusive timeline. File copy uses original fs.promises.copyFile, hash wrapper delegates to the unchanged original stream function. All canary and terminal business receipts remain original output/DB.

For each run inspect report.json success=true, all 5 checks, sourceRequests=[], approvals, paidCalls=0, native owned-canary-probes and profile.json. Identify the final fullAccess phase/runId before comparing repeated owner Node source hashes/bytes, lstat/copy counts and Registry SQL counts. Use per-owner count reduction plus total final check duration; do not infer causation from a single wall-clock difference. Actual run may expose a fixture/runtime incompatibility; preparation does not claim runtime PASS.

## Preparation validation

node --check passes. Final no-Electron bundle preflight passed at preflight-o9MEnT, 769 original TypeScript sources recorded. Observer selftest passed (3 expected rows/groups, exact synthetic owner preserved). No Electron or native helper started. Runtime --run is NOT_RUN pending Phase7 acceptance. No missing fixture/native inputs identified by preflight.
