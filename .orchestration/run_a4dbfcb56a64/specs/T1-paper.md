# Role
Execution worker T1 — W07 paper comparison + answer sheet template.

# Context
Branch from the T0 baseline commit. Do not touch main/index.ts privacy/OCR code, the error-review executor, or the migration registry. Reference-first: inspect OpenMAIC exam/paper/export modules and DeepTutor deep_question/paper patterns before writing new code. Reuse HeroUI Pro components per docs/17.

# Target
- `apps/desktop/src/renderer/components/PaperWorkspace.tsx`
- `apps/desktop/src/main/db.ts` (paper read/export/answer-sheet section only)
- `apps/desktop/src/main/index.ts` + `preload/index.ts` only if a new typed IPC is required (minimal; coordinate)
- `apps/desktop/scripts/paper-blueprint-smoke.mjs`
- `apps/desktop/src/renderer/styles.css` (only if needed)
- docs/26 and 2.Memory at the end

# Change
1. Comparison view:
   - Teacher can select two paper versions (existing `paper_versions`) or two papers and see a read-only diff: added/removed/changed items, order, score, difficulty, knowledge points, source kind.
   - No writes; no automatic merge.
2. Answer sheet template:
   - Configurable header (title, exam info), instructions, answer spacing; keep existing export pipeline (`document_artifacts` + SHA-256 + status).
   - Template settings bounded and validated; no arbitrary HTML.
3. Tests:
   - Extend `test:paper-blueprint` with comparison and template export cases.
   - Electron E2E: select papers -> compare -> export answer sheet -> real file + hash + SQLite readback -> restart readback -> dual-viewport screenshots.
4. Update docs/26 and 2.Memory with real evidence.

# Constraints
- No new DB tables or migrations.
- Do not change paper candidate write paths or AI generation.
- Preserve source labels.
- No sync IO; no renderer direct Node access; typed preload only.
- Reference reuse: cite exact OpenMAIC/DeepTutor/HeroUI paths in the report; do not paste incompatible code.
- Commit locally only; no push.

# Ownership
- Only the files above. Do not edit MistakesWorkspace, error-review executor, OCR/vision code, or migration registry.

# Observable acceptance
- `npm run build`
- `npm run test:paper-blueprint`
- `npm run test:renderer-components`
- Electron E2E evidence + screenshots
- docs updated
- report `.orchestration/run_a4dbfcb56a64/t1-report.md`
- worker_done with outcome.
