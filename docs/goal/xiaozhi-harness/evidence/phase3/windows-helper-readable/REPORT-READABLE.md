# Readable Windows helper candidate

Completed 2026-11-12 after the requested C# readability review. The candidate retains wire v1 execution and cleanup-owned maintenance behavior. The final snapshot is `snapshot-readable`. Previous snapshots v1/v2 and every earlier failed case remain under the candidate root.

## Source review and equivalence

NativeSandbox.cs now uses conventional C# block layout, individual statements, expanded branch conditions and multiline interop calls. Canonical, OpenChecked, Grant, protocol parsing, process startup and finally cleanup have expanded control flow and resource operations.

The formatter used the installed PowerShell Roslyn assemblies as a build-time editing tool. It preserved all 12148 syntax tokens exactly. Roslyn reports an equivalent syntax tree and zero syntax errors. The source expanded from 759 to 2045 lines. `readability-equivalence.json` records the exact comparison against snapshot-v2.

The fixed Framework64 csc compilation produced 72 managed method bodies with byte-identical IL to snapshot-v2. `readability-il-equivalence.json` records zero mismatches and equal body counts. Generated TrustedRuntimes.cs and the original test-helper.mjs have matching hashes with v2.

## Frozen identity

| Artifact | Identity |
|---|---|
| Source SHA256 | ce504a6715534029b0cf00ee0254dc5cc866cd5a94a7147b685a3333dc61e6bf |
| Helper SHA256 | 4c3e6298e0b8146190a13749d51053eb9edced70e4d962e8473634d1dd4ab854 |
| Generated pins SHA256 | dd5d906eb27868382cbf9cd28c6ac335eaec96faf16beb30612707721d230926 |
| Helper size | 39936 bytes |
| Build | Existing Framework64 csc 4.8.9221.0, C# 5, x64 .NET Framework 4.x |

`sandbox-manifest.json`, `build-command.txt`, `build.log`, `verification.json` and `artifact-hashes.json` accompany the source and exe. Compilation occurs at build time using the fixed csc command. The helper runs as the standalone compiled exe.

## Regression evidence

One complete run of the original 51-case suite passed **51/51** on the final readable binary. The exact evidence directory is `evidence-1794471175748`, including per-case frozen requests, raw stdout NDJSON, raw diagnostic stderr, decoded child output, final cleanup frames and timings. `test-helper.mjs` matches the v2 test script byte for byte.

```powershell
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\format-readable.ps1'
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\build-helper.ps1'
node 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\test-helper.mjs'
& 'C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-sandbox-candidate-3688589a1d9e4c0091ce910d1425ce8e\cleanup-inventory.ps1'
```

The suite covers PS5.1 and installed PS7.6.9 complex scripts, Chinese output, stdout/stderr, long scripts, nonzero exits, sibling/socket denial, process/output budgets, deadline/cancel/EOF, detached-parent exit, helper SIGKILL recovery, cleanup idempotence and scope rejection, malformed/oversized input, executable changes and Pi-compatible final-command failure semantics.

Sample readable-build wall times were 0.72 s for PS5 complex execution, 1.27 s for optional PS7, 1.07 s for the 1000 ms deadline, 0.29 s for explicit cancel and 0.07–0.08 s for owned recovery. These are isolated helper timings.

The refreshed `cleanup-inventory.json` supplies the independent final exact-profile, PID-identity and owned-fixture ACL inventory. Each case's result also records Job active processes 0, profileRemoved true and remainingOwnedAces 0.

## Integration boundaries

The main launcher must use detached true, windowsHide true and three pipes so the helper can clean after a Node host exits. It keeps stdin open until cancellation or completion. The protected Medium identity record under `.runtime/.helper-state` binds owned recovery to the exact execution/root/owner/grant/executable tuple. Main excludes `.runtime` from commit and constructs recovery from its trusted execution record.

The current build pins the local required Windows PS5 executable and optional installed Codex PS7 executable. Formal cross-machine Environment recipes remain with the production writer. Current scope is x64 Windows noninteractive execution with owned Low-integrity projections and main-owned commit. The preceding Medium directory creation and LPAC registry failures remain in the original reports. Production Pi wiring, original-file CAS commit, teacher UI and independent acceptance remain main-line deliverables.

Production repository/out/root-document changes by this candidate worker total zero. Paid model calls and downloaded tools total zero. The detailed v2 protocol, threat boundary, preserved failures and recovery design are available in the retained REPORT-V2.md.
