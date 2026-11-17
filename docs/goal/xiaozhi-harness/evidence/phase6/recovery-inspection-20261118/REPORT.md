# Recovery inspection leaf handoff

SOURCE_DONE. The dedicated source-only inspection suite passed 12/12, skipped 0, exit 0. SQLite write attempts were 0. Each inspection compared the complete owned fixture directory manifest plus DB/native SHA before and after. The final raw report is TEMP/xiaozhi-phase6-recovery-inspection-NftCMu/report.json and the captured stdout/stderr is smoke.log in this handoff directory.

The inspector reads the original TaskState.inspection view/lineage/checkpoint, existing Effect records, exact Task permission_v2 approvals and validated provider snapshot history. Output contains only the shared references. All six native states were observed. Rebuild eligibility is gated by actual validated Task state and the diagnostic result. Native success leaves Effect facts untouched and automaticReplay is false.

Native I/O is async, bounded to 32MiB, uses a regular single-link file, rejects symlink/junction ancestors and paths outside the supplied root, verifies opened/final file identity, checks strict UTF8/JSON/newline/header, and reuses the original anchor/marker/parent/tool result reader. JSONL format uses core's lightweight NATIVE_SESSION_FORMAT_VERSION, with a static assertion against the locked SDK export. A verified rebuild archive only exempts its explicitly named previous file when the archive owner belongs to validated Task lineage and its replacement matches the bound replacement Run. No file is retired or changed by inspection.

## Commands and actual results

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs ran 12/12, exit 0, about 2.15s whole-process wall time.
- node scripts/xiaozhi-agent/phase6-recovery-inspection-typecheck.mjs checked one owned source root with original tsconfig noEmit. Owned diagnostics 0, exit 0. Dependency diagnostics 61 are retained at TEMP/xiaozhi-phase6-recovery-inspection-types-gXRzMv/report.json and typecheck.log. This is not whole-tree typecheck acceptance. Many dependency diagnostics are ES2020 lib issues for existing Object.hasOwn/Array.at consumers.
- node --check scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs passed, exit 0.
- node --check scripts/xiaozhi-agent/phase6-recovery-inspection-typecheck.mjs passed, exit 0.

## Preserved earlier evidence

- x2sLsP/report.json records the initial missing-module red, exit 1.
- SlTJ2e/report.json records the first full 11/12 run, exit 1. The pending SDK-import observation is corrected by import-observation-correction.md in that directory. The process completed by itself. Stop-Process found no matching process and terminated none.
- 3wqen3/report.json preserves 11/12 after removing the broad SDK import. The rebuild fixture lacked its parent event-run FK row.
- JhZkXE/report.json preserves 11/12 after adding that row. The synthetic archive embedded a null-prototype Node SQLite row, whose hash differed after JSON round-trip. The fixture normalizes the row. Core independently normalized its archive implementation.
- 3OSzlh/report.json and UDdTsD/report.json retain the later 12/12 passes. Final collected raw evidence is NftCMu.

All named run directories use the TEMP/xiaozhi-phase6-recovery-inspection- prefix. No earlier failure report was removed.

## Coverage and outstanding boundaries

The 12 groups cover original interrupted Task/checkpoint, active/ended rebuild policy, legacy missing checkpoint, absent bindings, missing file, malformed JSON/header/UTF8/partial line, anchor/marker/parent/declaration/result conflicts, receipt conflicts and missing/unassociated results, root containment/hardlink/junction/oversize, missing/corrupt/cross-session Task/checkpoint, unknown Effect refs, exact Task approvals, validated provider refs/hash corruption, and verified archive association. Completed Task eligibility is explicitly denied in source. A completed teacher-acceptance fixture was not executed. The ended/legacy archive policy cases are clearly fixture state projections derived from an original created Task. The initial Task and checkpoint use actual TaskState/Journal APIs. Approval, Effect, provider, receipt and multi-Run archive rows are synthetic domain fixtures checked by the original validators.

NOT_RUN includes Host recovery IPC, actual Pi SessionManager opening, atomic resume glue, teacher approvals, actual file reconstruction, Electron/UI, helper/PTY, actual models/providers, restart E2E and packaged installation. No application performance comparison is claimed. The 2.15s value measures this local fixture runner only. No production dependency, actual budget DB, key or provider configuration was changed or opened by the leaf. No build, native helper launch, Git operation or network request was performed.

## Integration and rollback

Core owns the callers, shared contract, async native reader and atomic archive/pointer/newRun-binding transaction. The leaf keeps missing current marker association classified as changed. Core reported it will commit pointer and native Run binding in one original Sql transaction. Final integration must run core's whole-tree typecheck/build and real recovery user-path gates. The new inspector and its two scripts can be removed together before caller integration. After integration, core should revert its call site with the inspector as one coordinated source rollback. The leaf introduces no schema migration or persistent state.

Source copies and exact SHA256 values are frozen in this directory and freeze.json. Core-owned dependency hashes are a readback at handoff and make no claim that concurrently edited core sources were stable throughout the fixture runs.
