# Phase6 Task planning and recovery UI handoff

SOURCE_DONE. The dedicated actual React/HeroUI component suite passed 10/10, skipped 0, exit 0. Three UI sources and one new dedicated component test are frozen. The initial actual missing-feature red remains preserved as 2/10.

## Teacher-visible changes

PiTaskSteps shows a progressive execution-planning disclosure with the actual main-derived L1/L2/L3 level, translated reasons and all six facet states for available capabilities, runtime dependencies, execution permissions, operation risk, expected artifacts and recovery. Each facet keeps its original ready/blocked/unknown state. L3 blocked preparation opens for inspection. Valid planning can be read before any proposed steps exist. Original step checks and teacher acceptance controls remain present.

PiTaskReview mounts the adjacent PiTaskRecovery using only the original getXiaozhiTask projection. Recovery is tied to the exact current Task ID/session/revision/requirements version. A stale recovery projection asks for a fresh read and supplies no damaged-record guidance. Available/unbound recovery is a calm folded record with checkpoint and automatic-replay-disabled facts. Missing/changed/invalid/unavailable native records show reconstruction guidance. Unknown Effect states and pending/rejected plus other approval states are summarized as actual counts. Checkpoint presence or legacy absence is explicit. Reconstruction guidance follows main canResume, and the existing continue button keeps its original running/synchronization/busy/current/main gates. Refresh and resume use their original typed APIs. There is no automatic action or additional API call on mount.

The new component uses the existing DisclosureCard/HeroUI control and existing task review classes. No CSS, Composer, navigation or other page was changed. Main permission, Task and Effect authority continue through the original actions.

## Actual checks and commands

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase6-task-recovery-renderer-smoke.mjs passed 10/10, exit 0. Final raw report is TEMP/xiaozhi-phase6-task-recovery-renderer-dEg20n/report.json, copied as final-report.json. final.log and final.exitcode record the last run. Whole-process fixture timing was about 3.56s.
- node --check scripts/xiaozhi-agent/phase6-task-recovery-renderer-smoke.mjs passed, exit 0.
- node %TEMP%/xiaozhi-phase6-task-recovery-ui-handoff-197c5d61e4a44d39800674b5d05c6a52/owned-typecheck.mjs passed its owned-source gate, exit 0. It checks the three owned component roots plus original ambient declarations with original tsconfig noEmit. Owned diagnostics are 0. The 58 dependency diagnostics are retained in typecheck-report.json, with stdout in typecheck.log. This gate makes no full-tree typecheck claim. Core owns the final integrated typecheck/build.
- Direct trailing-whitespace checks passed for the four frozen files.

The 10 groups cover legacy Task behavior, L1/L2/L3 reasons and six facet states, planning without steps, all four native damage states and the exact original resume payload, calm available/unbound records, Effect/approval/checkpoint facts with main-controlled continuation, stale Task/revision/requirements metadata, original running/synchronization/busy guards and explicit permission error, refresh from API failure/damage to available, same-mounted-component session fencing and unmount fencing for deferred reads. All bridge responses in these tests are explicitly synthetic. They are absent from production source.

## Preserved earlier evidence

TEMP/xiaozhi-phase6-task-recovery-renderer-RJRXQN/report.json records the original 2/10, exit 1, with red.log/red.exitcode. Legacy behavior and the original late-read protection passed, while eight groups exposed the absent planning/recovery presentation. This report is copied as red-report.json.

The first candidate passed 10/10 at oO8qcI. The session test was then tightened to rerender the same mounted component under the same synchronization wrapper. That pass remains at oLkNcL. The final candidate additionally checks that a main canResume=false projection gives conditional reconstruction guidance while the continue button stays absent. Its result is dEg20n. All run directories use the TEMP/xiaozhi-phase6-task-recovery-renderer- prefix, and no prior raw report was removed.

## Remaining verification and rollback

NOT_RUN includes integrated Electron/native UI, keyboard and screen-reader operation in the real window, 1366x768 and 1920x1080 layout/reachability, actual CSSOM/contrast, teacher visual acceptance, actual Task/SQLite recovery and resume, current permission/approval persistence, real Pi/provider/model, whole-tree build/typecheck and product restart. No before/after product performance comparison is claimed from component-fixture timing. The test creates its esbuild bundle only under owned TEMP.

This leaf made no main/shared/preload/package/style/out edits and ran no full build, Electron, native helper, network/provider/model, actual paid ledger, real key/configuration or Git action. Existing network, inspector, terminal and Phase8 source freezes were preserved. The root owns Git, global status and integrated page acceptance.

Source rollback restores PiTaskReview and PiTaskSteps together and removes the new PiTaskRecovery and dedicated test. No SQLite schema, persistent data or API rollback is required. Exact source copies and SHA256 are frozen in this directory and freeze.json.
