# Role
Supervisor S — read-only audit. Do not edit code, do not commit, do not push.

# Inputs
- Task specs in `.orchestration/run_a4dbfcb56a64/specs/`
- Worker reports t0/t1/t2/g0
- Integrated git diff and test outputs
- Reference-reuse matrix in `01-plan.md`

# Change (produce)
`.orchestration/run_a4dbfcb56a64/02-supervision.md` with:
1. Per-task verdict: compliant / non-compliant / unverifiable.
2. Findings: severity (P0/P1/P2), file:line, reproduction, expected fix, owner.
3. Boundary checks: privacy consent, no sync IO, typed preload four-place, confirmation queue, migration lane, source labels, docs sync.
4. Process checks: no deleted/weakened tests, no mock-as-real claims, no reference code copied with license/tech mismatch, no temp artifacts.
5. Recommendation: proceed to acceptance / rework required.

# Constraints
- Read-only; may run read-only commands/tests but must not modify files.
- Do not trust worker claims; verify against code and command output.
- Do not access secrets or make network calls.

# Observable acceptance
- Report covers every task and every finding has evidence and an owner.
- `worker_done --files-modified .orchestration/run_a4dbfcb56a64/02-supervision.md --report-path .orchestration/run_a4dbfcb56a64/02-supervision.md --outcome succeeded`.
