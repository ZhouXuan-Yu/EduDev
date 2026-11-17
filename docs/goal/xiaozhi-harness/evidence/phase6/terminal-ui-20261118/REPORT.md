# Phase6 terminal feedback ordering repair

## Result and reproduced root evidence

PASS for the bounded repair. Root's preserved9-group probe passed the original8 and failed the9th. It issued a pending write, clicked the still-available close control, observed permission_denied, then resolved the earlier write with its exact ACK. The old confirmed() cleared the newer close error. Root's exact before/after observations remain in root-9-red-report.json and the complete root-9-red-probe.mjs. previous-freeze.json preserves the previous ten-file candidate.

The renderer now keeps read, input, explicit-control and resize feedback separately. The small pure reducer lives in existing terminalState.ts. A successful read clears its read feedback, an input ACK clears only feedback owned by its exact commandId, and explicit control retry clears the control feedback. Input admission failures are retained across an older ACK. Automatic resize feedback has its own slot. Existing session and control-token checks additionally fence late rejected control/resize promises. No main API, revision, input replay, Task or Job authority changed.

The visible feedback prioritizes explicit control failure, then input, resize and read messages. Existing unknown-input disclosure stays independent and visible. Thus an old ACK or successful poll cannot erase the newer close failure. Main-derived controls, prompt cancellation and session/controller/lease fencing retain the original implementation.

## Actual commands and results

Cwd D:/WorkProject/EduProject-harness/apps/desktop.

- Root's original TEMP/xiaozhi-phase6-terminal-ui-close-error-ordering-probe.mjs returned exit1 with8/9 at TEMP/xiaozhi-phase6-terminal-renderer-QWDKtB/report.json. Both source and raw report are copied here and stay unchanged at their original locations.
- node scripts/xiaozhi-agent/phase6-terminal-renderer-smoke.mjs returned exit0 with9/9 at TEMP/xiaozhi-phase6-terminal-renderer-dcuOWb/report.json. after-report.json and after.log retain the actual run. This was the concentrated post-fix original8 plus the retained9th regression.
- The9th now additionally waits for a real successful scheduled poll and retries close explicitly. Actual observations are {"beforeAck":"当前任务没有此终端操作的授权。","writeCalls":1,"afterAck":"当前任务没有此终端操作的授权。","afterPoll":"当前任务没有此终端操作的授权。","afterExplicitRetry":""}. The write count remains1.
- node C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase6-terminal-feedback-949a140bed914559a758a0bbae10d7b6\owned-typecheck.cjs returned exit0. Eight owned TS/TSX roots and their declaration/dependency graph produced zero owned and zero dependency-graph diagnostics. owned-types-final.json and the complete CJS script retain the exact scoped check. No emit or build occurred.
- A direct read-only trailing-whitespace check covered the ten owned source files and found0 issues. Its exact result is whitespace-check.json. No Git command was executed in this repair.

## Source freeze and unchanged scope

Three source files changed. Seven of the previous ten files retain their exact SHA256 values, including both parent entries and all UI/style components. The reducer adds feedback ownership to the existing state helper, while the existing session hook routes feedback to its owner. The original8 checks and root's9th remain in the dedicated suite. Complete hashes and source snapshots are in freeze.json and source-snapshot.

- apps/desktop/src/renderer/components/office/terminal/terminalState.ts = 7f0ddbea45a493faa47506f68b9a532b437fd6e0b47a0bf25a4dc0c1c25dbc1d
- apps/desktop/src/renderer/components/office/terminal/useTerminalSession.ts = 1558af3d5477418d342bb4f813341bcd145993e306c047e7e0745e7ecf3d4d99
- apps/desktop/scripts/xiaozhi-agent/phase6-terminal-renderer-smoke.mjs = 55f439942f5599218d6ee5e17e817f5749d14a11b54cc21ed3ed4038b5f3f5f3

The prior component candidates, original setup/fatal failure evidence and previous freeze remain preserved in TEMP/xiaozhi-phase6-terminal-ui-ef4cc55a1e64481a979496e892be1e15. This repair also keeps exact before copies of the three changed files.

## Verification boundary and rollback

NOT_RUN for whole-tree TypeScript/build, Electron/native/ConPTY, actual keyboard/two-size reachability, persistent Job/Effect/Task/Run readback, real permissions or helper lifetime, and actual provider/keys/Goal budget. The suite uses actual React/HeroUI components, a typed deferred bridge and explicit xterm adapter fixture in JSDOM. No main/shared/preload/out/package/Git or other UI page action occurred. Core/root retain the integrated gates.

Rollback restores useTerminalSession-before.ts, terminalState-before.ts and smoke-before.mjs into the original three paths. Preserve the other seven delivery files and all collaborator changes.
