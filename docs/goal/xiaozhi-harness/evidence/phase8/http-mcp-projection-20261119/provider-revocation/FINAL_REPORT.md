# Independent original Host revoke regression

Verdict: PASS_SCOPED for the two original HTTP MCP Grant / MCP-authority revoke scenarios, including persisted terminal/recovery state and successful same-Task fallback. The previous Provider redispatch journal failure is fixed on these frozen sources. Full A-P0-02/07 remains open: managed stdio MCP, Extension and other Provider families were not retested here.

| Original branch | External calls before / after old direct / after old Pi | Run | Denied receipt | Recovery | Same-Task fallback |
|---|---|---|---|---|---|
| grant | 1 / 1 / 1 | succeeded | settled, admitted=1 | needs_check; effect=uncertain | success |
| provider | 1 / 1 / 1 | succeeded | settled, admitted=0 | not_delivered; effect=not_checked | success |

Both branches retain 8 actual external fixture POST requests across revocation and the old direct/Pi redispatch. No new external tool or metadata POST occurs. The original registered callback object is retained; the Pi tool remains registered in the same active Run. The loopback fixture maintains the actual implementation counter.

Before each first external state.calls++ (counter=0), an independently opened read-only SQLite connection already sees the admitted original call contract, matching active Run/generation, Task, Provider version, snapshot, three exact Grant refs and authority ref. Those proofs are in DISPATCH_DURABLE_PROOFS.json. Normal tool results are produced by the real loopback MCP service, not supplied by the model stub.

The final test adds one harmless office_read_text of fallback.txt after each denied Pi call. Its settled successful receipt has the same Task ID, and its actual file text reaches the next model request. Both Runs have a committed completed status. The closed runtime SQLite readback independently confirms all results in COLD_READBACK.json.

Conservative boundary: only the Provider/MCP authority pre-dispatch TaskAdmissionError produces delivery=not_delivered. Its failed receipt settles with admitted=0/effect_state=not_checked and recovery.disposition=not_delivered. The Grant callback internally returns permission_pending; its failed receipt correctly remains admitted=1/effect_state=uncertain, recovery=needs_check. No error JSON was treated as proof of no delivery. Both recovery snapshots retain automaticReplay=false.

Exact final identities are in EXPECTED_PRODUCTION_HASHES.json and IDENTITY.json. All 781 original bundle inputs were rehashed after execution without drift. Against the preserved Provider red, the byte differences are the four writer-owned production files plus generated/core-tool-manifest.json; the remaining 776 inputs are identical and there are no added/removed inputs. The generated manifest had already changed before this run; this reviewer did not generate or write it. RED_GREEN_SOURCE_PARITY.json lists all hashes.

The test launches an owned TEMP esbuild bundle of actual Host production source and a hidden Electron main with no BrowserWindow. It does not launch/rebuild repository out. The observed repository checkpoint after execution is 02bbc51; four production files were uncommitted but matched the writer final hashes at preflight. No claim is made that these fixes were in the packaged out.

Original failure remains at C:\Users\ZhouXuan\AppData\Local\Temp\omni-edu-phase8-p0-provider-trace-2ca8ee49b0. Its Run run_221de819-cb01-4b51-9403-1a645c12a67d / failed call call_c2ae2433989144ce95160fe019eaf797 ends failed with the last journal event tool_start, receipt admitted/contract=null, original source_changed escalated to event_persistence. The original mixed two-case fixture is also preserved at TEMP/omni-edu-phase8-p0-stale-after-4504693ad8. No original red was overwritten or relabelled.

Current exact bindings:
- grant: Run run_07c4d1ef-3e1d-4465-874f-d606da5f4d1b; Task xitask_e9a6927d36f2379293249e42a988e0acf7f79b37bab89c5247f80162b617c354; denied Pi call call_9ce19059a6c5458ab39e366cd970bb2c.
- provider: Run run_733001b3-69a2-4538-b71e-fb3a3efd0bac; Task xitask_6ce698cf8e07863e2c8778a6618ac770f1809d94399513e5c5cb7e9b8093dd4e; denied Pi call call_b1faa015f1b74b448331c038d8e87aa2.

Reproduction from D:/WorkProject/EduProject-harness/apps/desktop must use a NEW owned TEMP root:

```powershell
$fixtureRoot = Join-Path $env:TEMP 'omni-edu-phase8-p0-revoke-retest-98a6a26c7b'
$runRoot = Join-Path $env:TEMP ('omni-edu-phase8-p0-revoke-repro-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $fixtureRoot 'focused-worker.ts') -Destination (Join-Path $runRoot 'focused-worker.ts')
Copy-Item -LiteralPath (Join-Path $fixtureRoot 'run.mjs') -Destination (Join-Path $runRoot 'run.mjs')
node (Join-Path $runRoot 'run.mjs') $runRoot
```

The original invocation used the same command against this newly prepared root, exit 0, checks=2, no failures or skips. Preparation checked the four exact final production hashes and parsed the focused worker. The source-based HTTP test needs no native helper build or large public package fixture. Synthetic loopback model calls only; paid calls=0, public source GET=0, real config/key/data untouched. Test Grants have exact original session scopes (taskId=null); execution contracts and fallback bind the same Task, which is not a Task-scoped Grant issuance UI claim.

This reviewer wrote only owned TEMP files, performed no production/out/generated/Git write, and did not broaden the tests beyond these two branches and their required fallback. Source rollback belongs to the writer/root. Performance was not evaluated in this correctness-only retest.
