# T14 ModelState identity inspection correction

SOURCE_DONE. The old twelve-group freeze remains historical evidence. This correction changes the original inspector and its dedicated smoke test. The owned typecheck script remains unchanged.

## Reproduced counterexample

The original inspector SHA097debc56ac0f166afd8c83ed5e3943362db9bab917eec0e933af3db8ce3853d failed the new thirteenth group. The original twelve groups passed. The red run exited 1 with 12/13 at TEMP/xiaozhi-phase6-recovery-inspection-VxNNYQ/report.json. Raw output is red.log and the report is copied as red-report.json.

The fixture uses the actual createModelSwitchState.migrate/seed APIs to create a valid SQLite ModelIdentity for the original session binding. Its legitimate offset-zero native capture does not include header bytes in the anchor. After replacing only the legal JSONL header ID with another UUID, readNativeToolEntries returned the exact same entries and receipts. The old inspector returned available. The new assertion expected changed and failed. This isolates the gap from anchor, marker, parent and tool digest checks.

## Minimal correction

Strict full-file JSONL validation now returns the validated header ID alongside its validation result. If the original model-state table exists, the inspector calls createModelSwitchState.current(sessionId), whose original read-only identity and binding validation uses validModelIdentity. A present ledger must match the inspected header ID plus the current file/model binding. Its identity or binding failure is diagnosed as changed. If the table or the session's ledger row is absent, the old legacy behavior is preserved. The correction adds no migration, SQL write, file mutation, header signature or digest authority, shared contract, Task state or runtime action.

## Verification

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs passed 13/13, skipped 0, exit 0. Final report is TEMP/xiaozhi-phase6-recovery-inspection-KBPwag/report.json, copied as green-report.json. Raw output is green.log. Whole fixture-run wall time was about 2.40s.
- The thirteenth group verifies matched ledger and header, drift with unchanged native receipt proof, exact current model/file binding conflicts, malformed ledger identity, and absent per-session ledger legacy behavior. It restores a matching record and verifies available again.
- Original twelve groups passed. Every inspection retained the existing actual read-only SQLite adapter, zero write-attempt assertion, full owned-directory manifest equality and DB/native SHA equality. Final report writesAttempted is 0.
- node scripts/xiaozhi-agent/phase6-recovery-inspection-typecheck.mjs exited 0 with owned diagnostics 0. Its 61 dependency diagnostics remain recorded in TEMP/xiaozhi-phase6-recovery-inspection-types-rG713O/report.json and copied typecheck-report.json. The original ES2020 tsconfig library diagnostics remain outside this leaf's completion claim.
- node --check scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs exited 0. The two changed source files also passed a direct trailing-whitespace check.

The final source hashes are in freeze.json and immutable source copies accompany this report. Core-owned dependency hashes record their identity at handoff.

## Remaining verification and rollback

NOT_RUN includes normal Pi/native-model-switch open with an actual SessionManager, T14 Host integration, explicit recovery/rebuild, Electron/UI, native helper, restart E2E, real provider/model, production SQLite and packaged installation. No build, native execution, network, key/configuration read, actual paid-request ledger operation or Git action was performed. No product performance comparison is claimed by the fixture timing.

The core can independently rerun this same 13-group suite, then use its final whole-tree typecheck/build and actual T14 open/recovery gate. Source rollback restores these two files from the preserved previous freeze. No stored data or schema rollback is needed.
