# E10/E12 Mastery quiz queue eval

## Contract

`mastery_quiz(questionCount=1..5)` creates one bounded, ordered question queue in
the Omni SQLite source of truth. The host exposes only the current question;
`mastery_grade` advances one answered item at a time. A second queue for the
same student is blocked until the first queue is drained. `expectedAnswer` and
submitted answers never appear in public tool output.

## Adversarial cases

- count above 5 is rejected by the local tool schema;
- a duplicate queue is blocked while any question is pending or answered;
- fallback grading consumes the oldest answered question for the bound student;
- explicit question IDs cannot reorder the queue or cross the student boundary;
- an answered later question cannot be graded before the queue head;
- close/reopen preserves the remaining queue and the public projection stays redacted;
- after the final grade, no pending question remains.

## Acceptance command

```text
npm run test:deeptutor-mastery-quiz-queue
```

Expected output is a JSON record with `ok=true`, `cases=23`,
`batchCreated=true`, `sequentialGrade=true`, `duplicateBatchBlocked=true`,
`restartSafe=true`, `answerRedaction=true`, and `outOfOrderBlocked=true`.
