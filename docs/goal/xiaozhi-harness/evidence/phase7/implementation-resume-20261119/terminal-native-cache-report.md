# U08 PowerShell module cache routing: frozen native change

2026-11-19. Only production file changed in this slice:
D:/WorkProject/EduProject-harness/apps/desktop/src/main/xiaozhi-agent/permissions/windows/NativeSandbox.cs, EnvironmentBlock near line 1902.

Before SHA256: 86efd211842a19765db635f965c27d5a95eb130a1e6cf77b95de852be9734d9f
After SHA256: 01694d0291bb2ed12e44181e5be7d878cd7670390cd00b290a1dd4bf1d665b7d

Adds one fixed child-process environment entry and its comment:
PSModuleAnalysisCachePath = Path.Combine(runtime, "temp", "ModuleAnalysisCache"). The existing .runtime/temp creation/ACLs and existing native projection exclusions remain unchanged. LOCALAPPDATA, parent process environment, permissions, source file semantics and generic projection filtering were not changed. Repository generated/out and Git writes were not performed by this writer. git diff --check passed. Root owns the unified final build.

Microsoft documents that Windows PowerShell 5.1 accepts a full cache filename in PSModuleAnalysisCachePath, set before starting the child process:
https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_windows_powershell_5.1?view=powershell-5.1#module-analysis-cache

## Independent TEMP validation

REPORT.json and cache-regression.mjs in this directory are the exact final bounded experiment. Both variants compile the original nine native sources with the original U08 runtime's pinned TrustedRuntimes.cs. The original U08 helper hash and its signed platform/Framework compiler probe are verified before invoking that same compiler. Only NativeSandbox.cs differs between variants. The helpers run through the original runNativeSandbox, PermissionService, prepareExecutionProjection, original terminalShellScript PSDrive startup and commitExecutionProjection APIs, with owned synthetic scopes and workspace. No broad directory ignore is introduced in code or test.

PASS:
- Before and after real PowerShell Jobs reach the marker, then cancel through the original native cleanup. Both have jobActiveProcesses=0, profileRemoved=true and remainingOwnedAces=0.
- Before prints an empty CACHEPATH; after prints its exact original projection/.runtime/temp/ModuleAnalysisCache full filename, supplied before PowerShell startup.
- Parent LOCALAPPDATA and PSModuleAnalysisCachePath are unchanged.
- Both variants deliberately create Microsoft/Windows/PowerShell/teacher-note.txt. The original projection writer commits that exact file and all three same-named parent directories. After content is teacher-source-kept. This demonstrates that the fix does not hide teacher writes under Microsoft or PowerShell.

Final helper hashes: before 8d7c08c5f86b82ae56fa8b576c35f9e1e8a361a36b657f5d0dc353fa72ea2783; after 75117949c706be817ad3bb6d3a13a496bec166a5bdee1179c8d1431f10dc9ac8.
Native source-set hash after: c5f2df82df5b85a025ed53b2123aa3dfe8c0694179c7ad88a1c522dc7e21feb1.

LIMIT: actual ModuleAnalysisCache bytes were not generated during this short leaf in either variant. It proves the official startup routing and same-name teacher-file counterexample, but does not claim a full reproduction or closure of the original UI U08 failure. Root's final unified-build real U08 rerun is still required.

## Preserved failures

Original UI failure remains untouched:
C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-xiaozhi-phase7-workbench-ui-uOtBqE/data/app.db.

Earlier leaf setup diagnostics also remain untouched:
- omni-edu-phase7-module-cache-fix-OPR2gI/REPORT.json: missing owned data directory before PermissionService normalization; no native Job dispatched.
- omni-edu-phase7-module-cache-verified-AF46nE/REPORT.json: leaf used the wrong launcher return-envelope shape and lacked the original protected-ancestor PSDrive shell startup. Native Job naturally exited1 and cleanup completed.
- omni-edu-phase7-module-cache-native-UkBgeh/REPORT.json: naive full-path Set-Location was denied by protected ancestors, so the leaf command naturally exited1. Final experiment reuses the original terminalShellScript, without weakening ancestors/ACLs.

No failed report was overwritten or treated as product acceptance. Rollback removes only the new fixed environment entry/comment; retain all failure evidence and original projection rules.
