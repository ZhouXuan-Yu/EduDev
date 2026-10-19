# Role
Execution worker T0 — baseline stabilization. You are the only worker allowed to edit the current workspace in this phase.

# Context
The current workspace has uncommitted changes from the previous session (AI console UI + DeepSeek vision fallback). Treat them as the baseline. Do not revert or discard unknown work. Run `git status` before editing. User approved: local commit only, no push.

# Target
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/deepseek.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/heroui-pro/components/**` (only if needed for the context fix)
- `README.md`, `.gitignore`, `docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md`, `2.Memory.md`, `3.Learning.md`
- root `test-enhanced-components.js` (remove)
- `.playwright-mcp/` (gitignore)

# Change
1. P0 privacy:
   - Remove the automatic DeepSeek vision fallback in `mistakeImages:runOcr` (`main/index.ts`).
   - Keep cloud image recognition only behind an explicit teacher-initiated action. Add a new IPC (e.g. `mistakeImages:runCloudOcr` or equivalent) that requires an explicit confirmation flag/input and uploads the original image only after the teacher confirms "会上传原图到云端". Default local OCR remains unchanged.
   - Do not fabricate confidence. Cloud OCR results must be marked for teacher review (e.g. `confidence=null` / `requiresReview=true`, documented in shared contracts).
   - Record provider/model/audit metadata without logging or storing the image.
   - Keep `deepseek:analyzeImage` only if it is behind the same explicit consent; otherwise remove it and its preload method.
2. P1 sync IO:
   - Replace `readFileSync` in `main/deepseek.ts` with `fs/promises.readFile`; keep the 8MB bound and fail-closed behavior.
3. P1 context regression:
   - In `renderer/App.tsx`, merge the knowledge-graph source into `contextItems` (5 sources) using `aiResult?.graphNodes?.length ?? knowledgeOverview.counts.nodes`; delete the unused `contextData`.
4. Hygiene:
   - Update README to current reality (9 nav entries, OCR/parse/vector landed, W07/W08 status).
   - Delete root `test-enhanced-components.js` (scratch string-check script).
   - Add `.playwright-mcp/` and `.orchestration/` to `.gitignore`.
   - Update docs/26, 2.Memory, 3.Learning with real results.
5. Tests:
   - Add/extend a smoke for the consent boundary: unconfirmed -> zero cloud call/upload; confirmed -> call allowed; rejected -> zero call. Use dependency injection or a fake provider; no real network calls.
   - Extend renderer component tests for 5 context sources.
6. Gates:
   - `npm run build`
   - `npm run test:renderer-components`
   - `npm run test:ai-mistake-image`
   - new consent smoke
   - `git diff --check`
7. Commit locally (no push) with a clear message after all gates pass.

# Constraints
- Do not change database schema or `db.ts`.
- Do not alter AI confirmation queue semantics.
- Do not add sync IO.
- Do not delete existing tests or weaken assertions.
- Preserve uncommitted work; no `git reset/checkout/clean`.
- No push.

# Ownership
- Only the files listed above.
- Do not touch T1/T2 areas (`PaperWorkspace`, error-review executor) beyond what is strictly needed for build.

# Observable acceptance
- All gates pass.
- `git status` clean after local commit (`.orchestration` ignored).
- Evidence bundle: command output, test counts, commit SHA.
- Report `.orchestration/run_a4dbfcb56a64/t0-report.md`.
- `worker_done --files-modified ... --report-path .orchestration/run_a4dbfcb56a64/t0-report.md --outcome succeeded`.
