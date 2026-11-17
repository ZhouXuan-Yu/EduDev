# Phase5 Electron exit 134 narrow diagnosis

## Result

Reproduced the original six functional assertions with report.success=true, 6/6 checks and Electron child exitCode=134. The diagnostic remains FAIL at process level. Paid calls were 0 and loopback fixture modelCalls were 15. Check durations summed to 72782.9157 ms. The original candidate check durations summed to approximately 73955 ms. These instrumented durations establish no performance acceptance claim.

## Direct runtime evidence

- Input bundle D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-extension-host-4wWVJ0/worker.mjs, SHA256 d8ab760db8a3268b0f656f7eb6a7d8b3858e044ef186d7185f76c96a7e687ce4.
- TEMP instrumented bundle SHA256 713d1ef70095fd4b750a408471d9312883abc1c38d93b07cf084a51e138d5180.
- exit-evidence.json contains exactly one uncompleted serializeStateWrites writer, id 837. Its synchronous submission stack is write -> serializeStateWrites.transaction -> skillGovernanceState.transaction -> createSkillGovernance.transaction -> skillGovernance.initialize -> production-host skillsReady.then.
- Compiled diagnostic coordinates are 45781, 45808, 51244, 75742, 75780 and 93328. Their source anchors are src/main/xiaozhi-agent/serialized-state-sql.ts write/transaction, skills/state.ts transaction, skills/service.ts initialize lines 79-82, and production-host.ts skillsReady initialization (lines 382-388 when initially inspected, lines 383-389 during final read due concurrent owner work).
- The only still-live native resource is sqlite3.Statement.Prepare. Its stack is Database.all -> OmniEduStore.all -> MaterialParseQueue.recoverUntracked -> MaterialParseQueue.close -> OmniEduStore.close -> xiaozhiState source.transaction finally work.close. This matches the prior 4wWVJ0 exit resource.
- worker.log shows all six PASS lines, success=true, DIAGNOSTIC_GRACEFUL_QUIT and the original Error::ThrowAsJavaScriptException napi_throw fatal under node::FreeEnvironment.
- process-result.json records child code 134 and signal null. The enclosing Node runner exits normally after recording child status.

## Cause supported by the trace

The final functional case constructs a cold production host, reads extension state, and soon closes it. createXiaozhiProductionHost starts managedSkills.initialize().then(recordReviewedRole, skillGovernance.initialize) as skillsReady. Its catch observer prevents an unhandled rejection. The original close path does not join that promise. An already admitted Skill initialization transaction is still closing its transaction-local OmniEduStore when application teardown begins. MaterialParseQueue.recoverUntracked is the observed operation in the transaction's awaited cleanup.

The trace identifies the missing host lifecycle join. It does not establish a leaked explicit sqlite3.Statement or a reason to change the database framework. Database.prototype.all in the installed sqlite3 wrapper calls statement.all(...).finalize().

## Additional source-proven lifecycle gap

production-host beforeTerminalEmit deletes the run from active before execute finishes publisher.flush, latency audit and decisions.sealRoute. waitForRun and close originally join only active runs. A separate execution completion collection can retain full execute promises after terminal UI unlock. The current reproduced outstanding writer came from skillsReady. The experiment did not observe sealRoute as the surviving writer.

## Owner repair direction

1. Make production-host close await skillsReady settlement before the owner closes OmniEduStore. Set closing first so the existing governance open checks retain shutdown admission semantics. Wait through rejected transaction cleanup.
2. Retain complete execute promises independently of active UI ownership. Have waitForRun and close join the original execute lifetime.
3. Re-run the original frozen six-case functional harness and require both report.success and process exit 0. Keep all previous failure reports.

The unique core owner received both findings. This diagnostic agent made no production changes.

## Instrumentation and exact command

Executed from D:/WorkProject/EduProject-harness/apps/desktop

```powershell
node 'C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-exit-diag-b0b855947ea649a7890c97db4d9bceec/run.cjs'
```

prepare.cjs copied the original bundle to the owned TEMP root and added a pending writer map in serializeStateWrites.write. Entries capture submission stacks and are deleted on original promise settlement. No original await, assertion, timeout, permission check or function behavior was removed. bootstrap.cjs retained the original async_hooks sqlite resource census and graceful app.quit. The TEMP root uses this worktree's own installed dependencies through a node_modules junction and an unchanged desktop package.json copy for the existing trusted application-root locator.

One preliminary launch reached 0 checks and exited normally because the TEMP copy initially lacked the application package.json. That preserved preflight-failed directory contains capability_untrusted_dependency_root evidence. The same diagnostic was then corrected with the original package.json and performed one substantive six-case run. No build or production out writes occurred.

## Boundaries and ownership

The core owner granted the runtime window before launch and received release notification immediately after child termination. All writes are confined to the owned TEMP diagnostic and the original worker's newly generated synthetic TEMP data root xiaozhi-phase5-extension-host-sABuUr. No real credentials were read, no actual model API was invoked, and no commit or push was attempted. Production/Goal/scripts/out files were read only. The source graph was used first for extension lifecycle symbol lookup and returned only the small extension domain. Specific non-indexed host/database source anchors were inspected directly after the graph proved insufficient.

The repair and corrected process exit are unverified by this diagnostic. Final Gate5 acceptance is pending independently. Rollback is unnecessary for production because it was unchanged. The TEMP artifacts preserve the reproduction and do not affect application startup.
