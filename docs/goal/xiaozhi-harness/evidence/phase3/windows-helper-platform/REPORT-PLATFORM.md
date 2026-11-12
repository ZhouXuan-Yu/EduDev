# Read-only Windows platform diagnostic candidate

2026-11-12. The approved increment adds `--platform-info` to the existing helper. The frozen handoff is `snapshot-platform`. Execution and cleanup-owned retain their wire-v1 implementation. Roslyn reports equivalent syntax for all seven existing execution classes, recorded in platform-execution-equivalence.json. Production repository/out/root-document writes, installed dependencies and paid model calls total zero.

## Final identity

| Artifact | Identity |
|---|---|
| Helper SHA256 | 783b05208d7ac4f0bb8add9a1f8186079f5a62cf5f4770fae871a94f97d2fa85 |
| Source SHA256 | 3659282563b4178c57b7a53ef7bde0984cbcb445198b85306f9a63ad1038c06d |
| Generated pins SHA256 | dd5d906eb27868382cbf9cd28c6ac335eaec96faf16beb30612707721d230926 |
| Helper bytes | 46592 |
| Compiler | Existing Framework64 csc 4.8.9221.0, x64 .NET Framework 4.x |

NativeSandbox.cs, TrustedRuntimes.cs, exe, sandbox-manifest.json, exact build-command.txt, test programs, verification.json and artifact hashes accompany this report. The build uses the existing build-time csc command.

## Output contract

`--platform-info` consumes zero stdin and writes one UTF-8 JSON line. It has schemaVersion 1, type platform_info, platform win32, architecture x64, windowsDirectory and exactly two runtimes. Runtime kind is powershell5 or framework_csc. Each runtime contains path, sha256, fileVersion, trust, trustSource, publisher and reason. sha256/fileVersion/publisher/reason can be null when unavailable. trust is verified/unavailable/untrusted. trustSource is embedded/catalog/none. Exit 0 means the diagnostic frame is valid. Main consumes only verified entries with a real SHA256.

Windows directory comes from native GetWindowsDirectory. The two tools use fixed relative paths under that native directory. Parent PATH and user-provided paths supply no tool discovery. Final paths and their existing ancestors reject reparse points. The file is pinned with read sharing while SHA256, file version and trust are inspected.

The diagnostic initializes its own in-process SystemRoot/windir values from native GetWindowsDirectory before Windows trust-provider resolution. This affects only the short-lived diagnostic process. It keeps the real tool paths and trust-provider resolution independent of forged parent environment values.

## Offline signature policy

WinVerifyTrust uses generic Authenticode verification, WTD_UI_NONE, WTD_REVOKE_NONE and provider flags 0x1010. These flags combine WTD_CACHE_ONLY_URL_RETRIEVAL and WTD_REVOCATION_CHECK_NONE. No online revocation retrieval is requested. Windows local trust-store policy and existing cached chain material supply the result. This is an offline trust result. [Microsoft WINTRUST_DATA flags](https://learn.microsoft.com/en-us/windows/win32/api/wintrust/ns-wintrust-wintrust_data)

Verified requires WinVerifyTrust success and the verified signer certificate's Microsoft Corporation organization plus an accepted Microsoft publisher name. Signer metadata comes from WinVerifyTrust provider state. Embedded verification is attempted first. When it cannot establish trust, the code queries catalogs for the specific file's computed catalog hash and verifies that file member through WinVerifyTrust with the same offline flags. SHA256 and legacy SHA1 catalog hash lookup are bounded to at most 16 matching catalog contexts each. The independent output hash remains SHA256.

The catalog search targets only the queried file hash. It supplies the member tag, actual pinned file handle, computed hash and matched catalog to WinVerifyTrust. [Microsoft catalog lookup](https://learn.microsoft.com/en-us/windows/win32/api/mscat/nf-mscat-cryptcatadminenumcatalogfromhash), [Microsoft catalog file hashing](https://learn.microsoft.com/en-us/windows/win32/api/mscat/nf-mscat-cryptcatadmincalchashfromfilehandle2)

## Actual local findings

| Tool | Actual verification |
|---|---|
| System PowerShell | verified, catalog, Microsoft Windows |
| Framework csc | verified, embedded, Microsoft Corporation |

The system PowerShell has catalog-backed trust on this machine. Its missing embedded signature is handled by actual file-member catalog verification. Its SHA256 is 60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f. Framework csc SHA256 is 46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00. The raw frame reports file versions and exact native-derived paths.

## Tests and preserved failure

The original execution/cleanup suite ran once on this final candidate and passed **51/51**, with raw evidence in evidence-1794472094190. The final diagnostic suite passed **11/11**, with raw evidence in platform-evidence-1794472051733.

Diagnostic cases cover one-frame schema, independent SHA256 of both actual files, verified Microsoft trust for both, forged SystemRoot/windir/PATH/TEMP/TMP/LOCALAPPDATA/USERPROFILE, identical owned file bytes with valid catalog membership, mutated actual bytes, unsigned bytes, reparse paths and a missing file. The test-only TrustProbe entry compiles the same production inspector and accepts owned fixture paths. The shipped helper exposes fixed native-derived tool paths.

The first forged-environment case retained the real paths and SHA256 values but Windows trust-provider resolution returned an error. That false-negative case is preserved in platform-evidence-1794471996215. Initializing only the diagnostic process's SystemRoot/windir from GetWindowsDirectory fixed the issue. The complete diagnostic matrix then passed. The execution and cleanup classes remain syntax-equivalent to the readable snapshot.

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\build-helper.ps1'
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\test-platform-info.mjs'
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\test-helper.mjs'
```

The diagnostic itself took approximately 0.13 s in the independent before/after inventory. platform-readonly-inventory.json records identical runtime/helper/candidate ACL descriptors, identical owned profile-name lists and identical PowerShell/helper PID sets around the call. There were no new shell processes, AppContainer profiles or ACL changes. The call returned one frame and exit 0.

The refreshed independent execution inventory covers 214 observed profiles, 411 owned fixtures and 2794 objects. Remaining owned profiles, profile mappings, exact owned ACEs and owned processes are all zero. PID reuse for unrelated later processes is identified by creation time and retained in the raw inventory. All old snapshots, original Medium/LPAC failures and earlier candidate failures remain available.

## Handoff boundary

The local required components now have verified offline identities suitable for the writer's fixed Environment recipe admission. Other machines, missing offline chains/catalogs, updated OS files, packaged/asar execution and complete distribution policy remain Phase8 work. A valid frame with unavailable or untrusted status carries a concrete gap to main. The current machine's diagnostic supplies no other-machine acceptance evidence.

The existing noninteractive AppContainer execution, Low owned projection, detached host launch, strict start/cancel/result wire, protected recovery identity and main-owned Grant/CAS commit boundaries continue through their tested entry points. Source edits have stopped after this snapshot.
