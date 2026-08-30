# EVAL: E15 local review reminder summary

## Capability evals

1. `buildReviewReminder` classifies due, upcoming-within-horizon and clear states from the deterministic review queue.
2. Epoch seconds are used for comparisons; UTC/Asia/Shanghai/America/New_York display metadata cannot move a reminder.
3. Output is bounded to three preview items and never contains raw learning records, titles, answers or file paths.
4. Empty/invalid/oversized queue input fails safe and remains deterministic.
5. Electron IPC recomputes the reminder from the same SQLite `learning_records` snapshot after application restart; no reminder table or second queue source is created.
6. Today workspace renders a due/upcoming/clear card and can jump to the existing review workflow.

## Adversarial evals

- negative/NaN timestamps and malformed queue items
- horizon limits and 10,000-item input
- timezone changes and repeated recomputation
- missing student / unknown student IPC calls
- raw content/path/answer leakage checks
- renderer cannot write or acknowledge away a review item

## Regression gates

- `npm run test:deeptutor-review-reminder`
- `npm run test:deeptutor-review-scheduler`
- `npm run test:deeptutor-review-queue`
- `npm run test:deeptutor-review-recovery`
- `npm run test:ai-harness`
- `npm run test:ai-observability`
- `npm run build`
- `node scripts/electron-smoke.mjs`

## Acceptance threshold

- capability/adversarial: 100% deterministic pass, pass^3 for pure reminder smoke
- release regression: all listed commands pass; no new `failed` observability gate
- human review remains required for reminder wording and teacher usefulness; local smoke is not external teacher evidence
