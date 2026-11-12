# Explicit Medium integrity follow-up

Executed 2026-11-12 13:19–13:22 Asia/Shanghai. This follow-up writes only the new `medium-followup` TEMP subdirectory. The original PoC files and raw evidence are preserved.

## Result

The exact-SID DACL-only route is PARTIAL for a complete writable workspace on this machine. A Low integrity AppContainer can overwrite the existing explicitly Medium-labelled fixture file. Creating a new file in the explicitly Medium-labelled directory fails with an IOException reporting that the client lacks a required privilege. The existing-file write is persisted and both the existing file and directory remain Medium with NO_WRITE_UP before and after execution.

| Operation | Observed status |
|---|---|
| Parent token | Ordinary AppContainer=0, Medium integrity S-1-16-8192 |
| Child token | AppContainer=1, Low integrity S-1-16-4096, unique package SID, capabilities=0 |
| Medium directory label | Preserved, `(OI)(CI)(NW)` |
| Existing file Medium label | Preserved, `(NW)` |
| Exact package SID Modify DACL | Applied to this owned fixture only |
| New file creation | FAIL, client does not hold a required privilege |
| Existing file overwrite | PASS, final content MEDIUM_OVERWRITE_SUCCESS |
| New file rename | NOT_RUN as an independent rename check, source creation failed and Move reported source missing |
| Sibling canary write | Rejected, original contents preserved |
| Shell stdout/exit/Job | PASS, exit 41, Job active processes 0 on completion |
| Profile cleanup | PASS, DeleteAppContainerProfile HRESULT 0, profile folder and mapping absent |
| Unique package SID ACL cleanup | PASS, remaining ACEs 0 across fixture and descendants |

No fixture was lowered to Low integrity in this follow-up. No elevation, privilege adjustment, real-workspace access or system ACL change occurred. The script uses the same AppContainer native helper as the earlier successful Low-labelled fixture test.

## Implication for Phase3

Direct real-workspace ACL access still needs a verified MIC and new-object-creation solution. The current measured implementation should default to an owned Low-integrity execution copy with main-process Grant validation and commit into the real workspace. Existing-file overwrite success supplies a narrower positive capability. It does not establish arbitrary directory mutation or full script workspace compatibility.

This bounded test did not identify or validate a supported ordinary-user token adjustment that solves the new-file failure while preserving the real directory's integrity labels. No general claim that all possible Windows token mechanisms are unsupported follows from this result. Additional token/API work is a separate implementation decision.

Microsoft documents AppContainer Low IL, dual-principal DACL access and the possibility of Medium-labelled resource access through package/capability SIDs. This test confirms existing-file write access and records the separate new-file failure on build 26200.9711. [Microsoft AppContainer launch and access model](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

## Exact reproduction

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-windows-sandbox-3314308a542041038fb20355f5e385dc\medium-followup\run-medium.ps1'
```

The script compiles the original `NativeProbe.cs` using existing PowerShell Add-Type. Explicit fixture labels are created with `icacls <owned-directory> /setintegritylevel '(OI)(CI)M'` and `icacls <owned-existing-file> /setintegritylevel M`. The only ACL principal added is this follow-up profile's unique SID. `before-icacls.txt`, `granted-icacls.txt`, `after-icacls.txt`, `stdout.log`, `transcript.log`, `payload.ps1`, `results.json` and `cleanup.json` retain evidence.
