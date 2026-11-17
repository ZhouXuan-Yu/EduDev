# Phase8 send-role fixture repair

## Result

PASS for the bounded Node protocol regression. The actual product send role is button named 发送消息. The future executor now locates that exact role, marks that same DOM control data-phase8-real-submit=true, and clicks it. The renderer observer captures click events from that marker, including nested icon/text descendants, and retains event.isTrusted unchanged. Enter on the existing prompt textarea remains supported. Unrelated clicks and non-submit key events stay outside t0 capture.

A DOM fixture with the send role/marker and no office-prompt-send testid reproduced the old observer defect. Before repair the six-group suite returned5/6 with zero observed submissions. After repair it returned6/6 with exactly one submission. The JSDOM event is genuinely untrusted and the recorded flag is false. Actual trusted Playwright/Electron interaction remains NOT_TESTED. This fixture establishes the association without simulating a native trusted event.

## Actual commands and raw evidence

Cwd D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase8-real-model-smoke.mjs before repair returned exit1,5/6 at TEMP/xiaozhi-phase8-real-model-protocol-COFvDa/report.json. before-report.json and before.log retain the failure.
- The same fixed six protocol groups after repair returned exit0,6/6 at TEMP/xiaozhi-phase8-real-model-protocol-ith8Xx/report.json. after-report.json and after.log retain the result.
- node --check for each of the five phase8-real-model-*.mjs files returned exit0. Exact files are in syntax.log.
- git diff --check for all six frozen files returned 0. Its output retains Git's LF-to-CRLF warnings.

Only the future run script and existing protocol smoke changed. The previous six-file freeze remains previous-freeze.json, with its original source snapshots and6/6 report in the earlier preparation directory. The other four source SHA256 values remain identical. No32-run extension, model call, actual Goal database opening/reservation, real-key reading, Electron/native launch or build occurred.

## SQLite readback path source verification

Both inspected trees construct AppStore.dbPath as join(dataRoot,'app.db'). Current B source is apps/desktop/src/main/db.ts line1240, and old A source is the corresponding file line1237. Both main/index.ts files set baseDataRoot from OMNI_EDU_DATA_ROOT before calling selectedBackupRoot(profile,baseDataRoot). The future executor supplies its owned per-run dataRoot through that environment field.

Both backup/activation.ts implementations use profile/xiaozhi-data-selection.v1.json. Absence falls back to baseRoot, and a record with a different baseRoot also falls back. A matching restore selection can redirect dataRoot after verifying its restore receipt and app.db. The default readback path dataRoot/app.db is therefore source-confirmed. Final runtime data-root selection still requires actual Phase8 isolation verification, especially if a supplied profile contains a matching restore selection. No actual application database or profile selection file was opened in this task. The separate actualDatabasePath constant belongs only to the request budget ledger.

## Freeze and remaining boundary

- apps/desktop/scripts/xiaozhi-agent/phase8-real-model-run.mjs = 1c7adf9fcc7d9ad6c2df76d3838e0f97e5b5e4f79f6a13ccfbb78e7afa2bc087
- apps/desktop/scripts/xiaozhi-agent/phase8-real-model-smoke.mjs = 733043ec4c5f534edeab4bd26fd538dbd299bf9cb5ae9bea8f9f1a1194c3a3c4

Complete hashes and source snapshots are in freeze.json and source-snapshot. All prior provider/TLS, actual A/B route, key integration, real Run/Task binding, actual UI, quality and exact cross-process timing boundaries remain NOT_TESTED. Root owns actual Phase8 integration.

Rollback restores run-before.mjs and smoke-before.mjs into their original two paths, preserving all other helpers and the actual Goal ledger.
