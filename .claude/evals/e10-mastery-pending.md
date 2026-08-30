# E10/E12 Mastery Pending-Question Eval

## Objective

Keep DeepTutor's pending mastery question recoverable across SQLite close/reopen while preserving the host's student and answer secrecy boundaries.

## Contract

- `mastery_status` may expose only a bounded public question projection: id, knowledge point, stem, options, status and `answerSubmitted`.
- `expectedAnswer` never enters the model result or status projection.
- Pending/answered questions are read from the same Omni SQLite source of truth; no in-memory-only queue is allowed.
- `mastery_grade.questionId` is optional only when the current bound student has one latest answered question.
- A question from another bound student is blocked before grading, even if its id is known.
- Grading remains deterministic and writes an explicit `mastery_attempt` record.

## Commands and evidence

- `npm run test:deeptutor-mastery-pending` — pass, 14 assertions.
- `npm run test:deeptutor-mastery-policy` — existing policy gate must remain green.
- `npm run test:deeptutor-capability-evals` — capability contract regression.
- `npm run test:ai-harness` — routing/tool schema regression.
- `npm run test:ai-observability` — SQLite evidence/terminal status gate.
- `npm run build` — main/preload/renderer build.

This is a deterministic local persistence gate. It does not claim live model question quality or teacher acceptance.
