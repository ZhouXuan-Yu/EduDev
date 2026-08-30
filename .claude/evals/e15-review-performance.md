# EVAL: E15 review queue/reminder SQLite performance

## Capability evals

1. A real native SQLite store with multiple students and bounded learning history can rebuild mastery, queue and reminder summaries concurrently.
2. Normal local concurrency remains within the product SLO: p95 and max for one bounded student snapshot+policy+reminder request stay at or below 2 seconds.
3. Three consecutive benchmark rounds pass (pass^3), with deterministic item IDs/counts and no raw record content in output.
4. One slow/invalid student request cannot mutate learning records or poison other concurrent requests.

## Adversarial evals

- 8 students × 200 learning records each
- 16 concurrent read-only requests against the same SQLite file
- mixed due/upcoming/unknown/free-form records
- repeated rounds after SQLite close/reopen
- missing student and oversized output checks
- output scan for content/title/path/answer leakage

## Regression gates

- `npm run test:deeptutor-review-performance`
- `npm run test:deeptutor-review-performance-electron`
- `npm run test:deeptutor-review-reminder`
- `npm run test:deeptutor-review-reminder-electron`
- `npm run test:deeptutor-review-recovery`
- `npm run test:ai-observability`
- `npm run build`

## Acceptance threshold

- pass^3 = 100% for the local SQLite benchmark
- p95 <= 2,000 ms and max <= 2,000 ms for each round
- benchmark is local evidence only; it does not claim DeepSeek network latency or external teacher acceptance
