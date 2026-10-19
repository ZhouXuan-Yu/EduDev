# Role
Execution worker T2 — W08 error review single transaction + batch confirm.

# Context
Branch from the T0 baseline. Do not touch paper comparison/export, OCR/vision, or the migration registry. Reuse the existing DeepTutor four-class taxonomy and confirmation queue; do not create a second write path.

# Target
- `apps/desktop/src/main/db.ts` (`save_error_review` executor + related helpers only)
- `apps/desktop/src/renderer/components/MistakesWorkspace.tsx`
- `apps/desktop/scripts/error-review-write-smoke.mjs`
- docs/26 and 2.Memory at the end

# Change
1. Single transaction:
   - Wrap all `learning_records` error_review writes in one `BEGIN IMMEDIATE`; any failure rolls back all; readback after commit; no partial writes.
   - Preserve existing validation (student ownership, window, category, non-empty).
2. Batch confirm/reject:
   - UI multi-select for pending `save_error_review` items; batch confirm/reject with per-item server-side validation; idempotency; duplicate confirmation rejected.
   - Keep single-item flow.
3. Tests:
   - Extend `test:error-review-write` with failure injection -> zero writes; batch all-or-nothing; rejected zero writes; duplicate reject; restart readback.
   - Electron E2E: select multiple -> batch confirm -> records readback -> restart.
4. Update docs/26 and 2.Memory.

# Constraints
- No new tables or migrations.
- Preserve `parseAiConfirmationPayload` whitelist; add any new payload fields there.
- No partial writes; no bypass of teacher confirmation.
- No sync IO; typed preload only.
- Do not change paper/OCR/vision code.
- Commit locally only; no push.

# Ownership
- Only the files above.

# Observable acceptance
- `npm run build`
- `npm run test:error-review-write`
- `npm run test:renderer-components`
- Electron E2E evidence
- docs updated
- report `.orchestration/run_a4dbfcb56a64/t2-report.md`
- worker_done with outcome.
