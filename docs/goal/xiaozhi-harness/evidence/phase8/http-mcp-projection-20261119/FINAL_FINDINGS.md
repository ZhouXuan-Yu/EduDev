# Current HTTP MCP stale-callback evidence

Grant branch: PASS_SCOPED. Full A-P0-02/07 stays open; managed MCP and Extension were not exercised by this evidence.

The exact frozen repo public HTTP fixture runs on loopback and maintains state.calls inside its external tools/call implementation. The actual production Host, Pi registration, Task admission, permission engine, broker and ToolContract journal run unchanged. Observation-only TEMP additions retain the original MCP callback reference and read SQLite before the fixture increments its counter. Model replies are loopback SSE; paid calls and external source GETs are zero.

Identity: red checkout f9546eb / production base 57d300d. Across 781 bundled original source inputs, the only byte difference to green is permissions/mcp.ts: 93fd2dcd...11695 -> 1a562e61967ebeb52dfe0e6709ed73d040e49d36678dace0287aabcc555ac408. This is the separate writer fix. Docs-only checkpoint a9c897d was observed later. Repo out was not launched or rebuilt; these are source-bundled Host tests. Full hashes are in IDENTITY.json and SOURCE_HASHES.json.

## Grant branch

Final root: C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-grant-proof-e54e3e1322

- Same Run run_c0581d0d-c818-4d00-9169-4a5b8c35655b, generation 1, Task xitask_a8a45a89ac5cf2cc7e5c2ea592ca56bde1db9a6b851527653f4cd5c8ccfdfe7e.
- Original normal call call_e73fcd03bbd546558e74592b5104d15e and Provider mcp.tool.t_eb85d3f68151940c32b7cbf6 version 1.0.0+553ef83e5d98fb2f.
- Before external state.calls++: callsBefore=0; independently opened read-only SQLite already contains admitted ToolContract, Task, Provider, snapshot, all 3 exact Grant refs and authority ref. See DISPATCH_DURABLE_PROOF.json.
- Original external tool executes exactly once. Exact MCP Grant xigrant_1453ed95-b58d-42d3-ae6f-4dc88a2f841a is then revoked via original PermissionService.
- The same registered callback is invoked with stale_grant_0f5e8a64-80f5-4f52-9939-dee3c1af50f8 while the Run is active. It returns permission_pending; calls stay 1 and POST requests stay 8. Pi is then asked to invoke its same already registered tool again; calls remain 1.
- Original Run ends succeeded. Both Pi receipts are settled: first success=1, second success=0. Withdrawal preserves the original conservative uncertain Effect for the failed external attempt; no recovery trust was added.
- The explicit test Grants use the original session scope (taskId=null); the execution contract and both Pi calls bind the same Task. This does not prove a task-scoped Grant issuance UI flow.

## Provider/MCP revoke defect

Original mixed fixture: C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-stale-after-4504693ad8

Single-mode trace root: C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-provider-trace-2ca8ee49b0

- Normal external call succeeds, calls=1. host.mcpRevoke clears current authority and revokes the associated Grant. Directly invoking the still-held old MCP callback returns permission_denied, with calls still 1 and POST requests still 8. This narrow boundary passes.
- Pi redispatch through its already registered tool fails incorrectly as event_persistence. Run run_221de819-cb01-4b51-9403-1a645c12a67d is persisted failed.
- Failed callId: call_c2ae2433989144ce95160fe019eaf797. Task: xitask_2915fb6df957aa2b9ed57bd344ece8c6eee51d43ffa6295c857bb08046a506d1.
- Last committed event: sequence 25, kind tool_start. Second receipt remains phase=admitted, admitted=1, success=null, contract_json=null. There is no settled second result or durable terminal journal event.
- CRITICAL_FAILURES.jsonl records the actual original error source_changed, from createRunToolGovernance.assert -> before -> production-host beforeDelivery -> Pi underlying. core-governance.ts:183 compares record.source with current mcp.describeTool(name); revoke makes the latter null. pi-session.ts:952 treats the beforeDelivery error as critical, production-host.ts:1216 forwards it to publisher.fail, and production-host.ts:469 classifies it as generic event_persistence.
- The wrapper count assertions can pass even though the Run fails. SUMMARY.json success is a counter-fixture result, not acceptance of this Run. FINAL_FINDINGS.json records the actual scoped FAIL.

## Reproduction

Use a NEW owned TEMP root and copy only focused-worker.ts + run.mjs from the chosen final root. Do not rerun in the evidence directory (it contains a closed DB and an existing node_modules junction). Example for Grant proof, from D:/WorkProject/EduProject-harness/apps/desktop:

```powershell
$fixtureRoot = Join-Path $env:TEMP 'omni-edu-phase8-p0-grant-proof-e54e3e1322'
$runRoot = Join-Path $env:TEMP ('omni-edu-phase8-p0-grant-repro-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $fixtureRoot 'focused-worker.ts') -Destination (Join-Path $runRoot 'focused-worker.ts')
Copy-Item -LiteralPath (Join-Path $fixtureRoot 'run.mjs') -Destination (Join-Path $runRoot 'run.mjs')
node (Join-Path $runRoot 'run.mjs') $runRoot
```

For the Provider defect, select fixtureRoot C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-provider-trace-2ca8ee49b0 instead. Its onCriticalToolFailure observer preserves the original error unchanged before forwarding it. No production source edit is included.

The old HTTP normal-path red and trace remain in C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-stale-callback-1fe4c4240c and C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-stale-trace-196479b422. Initial endpoint-origin setup failure and one diagnostic-bootstrap escaping failure also remain in their original TEMP directories; neither ran external tools. No existing evidence was overwritten or deleted.

This agent changed no repository source, out, generated file or Git state. The separate permissions/mcp.ts writer owns the production fix and its tests. No real key/config/data, unverified third-party code, paid model or frontend window was used. Performance comparison and production rollback are not applicable to this test-only delivery.

Verified original throw site: provider worker.mjs:56570 is exactly the record.source/current mcp(name) comparison (core-governance.ts:183), not the earlier parameter-hash check. Diagnostic bootstrap escaping setup failure is retained at C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-provider-trace-b2db43ed21.
