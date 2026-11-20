# Phase8 real-model execution preparation

Status is DRAFT / NOT_TESTED for Electron, native UI and real providers. This delivery prepares the fixed Q1–Q8, 32-run paired sequence. Current validation runs only Node and loopback fixtures with fake credentials and separate TEMP ledgers. The actual Goal database stays outside this preparation's test paths.

## Released seams

Both current trees register the Pi provider with baseUrl https://api.deepseek.com/v1 and supply the provider-scoped createDeepSeekFetch function. In Electron it calls electron.net.fetch with credentials omitted and redirect:error. Both installed Pi implementations pass model.baseUrl to the OpenAI client, whose chat resource posts /chat/completions. The observed wire URL remains recorded at runtime. The bridge supports the two explicitly configured provider paths /v1/chat/completions and /chat/completions using separate fixed upstream proxy endpoints. Other DeepSeek paths fail closed, except separately observed GET /models and GET /v1/models. Existing production provider, permission and endpoint checks stay in place.

The bootstrap patches electron.net.fetch before importing the selected tree's existing built main. Chat POSTs go through the original net.fetch to the dedicated loopback counting proxy, which durably reserves each upstream HTTP attempt. The global fetch function stays untouched. The existing counting proxy performs zero retries. SDK retries and tool loops therefore consume separate reservations. Other provider traffic remains separately observable. Body and authorization bytes exist only in the transport and the app's existing credential handling. Telemetry retains only whitelisted model configuration, byte counts, status, safe identity and timing fields.

Each run has a unique prebound task/version/round/evidenceRef. Real Run identity is cross-checked against snapshot and original ai_agent_runs before bindRun. Actual Task identity is recorded separately from the Q label using snapshot and original Task/receipt facts. A legacy missing Task is reported explicitly. UI submission count and HTTP attempt count remain separate.

## Prepared entry points

The plan module freezes synthetic facts.txt, scores.csv, the question text and exact Q inputs, and generates round1 A→B / round2 B→A for each Q. Preparation emits a manifest template and input hashes. The future executor requires frozen A/B commits, out lists and independently prepared synthetic data/profile snapshots, selects the owned workspace through the existing UI picker, submits through Office Composer, records permission choices and terminal snapshots, and collects artifacts, original SQLite readback, request bindings and timings for independent review. It creates no production AgentLoop or business ledger.

Only the existing shared absolute Goal database is accepted for future real execution. It must already exist. No execution path resets its limit or used count. Fixture validation uses a separately named TEMP database. The final B build, local credential setup, seeded question-bank snapshots, actual settings equality, real UI/provider/TLS coverage and quality scores remain NOT_TESTED until root supplies the actual frozen inputs and executes the coordinated gates.

## Offline input verification

From the harness desktop directory, run `node scripts/xiaozhi-agent/phase8-real-model-run.mjs verify "<absolute manifest path>"`. This uses the same manifest and build/snapshot fingerprint validation as the live collector. The original A commit must match and the two desktop roots must be distinct. The verification reports evidence digests without creating an output directory, opening the goal ledger or starting Electron. It does not establish provider setup, runtime behavior or quality. The initial 32-row manifest verified offline with A d50ef330 and provisional B 70b19a8. Use only an accepted final B for formal dispatch.

## Scope and rollback

Only new phase8-real-model-* scripts and owned TEMP evidence are written. Existing budget, stream-performance, production and frozen UI files remain untouched. Removing these new helper files rolls back this preparation. The budget schema and existing Goal database require no migration.

## Bounded preflight and collection control

The explicit future commands are run from the selected harness desktop directory with the final frozen manifest.

```powershell
node scripts/xiaozhi-agent/phase8-real-model-run.mjs preflight "D:/path/to/frozen-manifest.json"
node scripts/xiaozhi-agent/phase8-real-model-run.mjs execute "D:/path/to/frozen-manifest.json"
```

Preflight collects original Q1-r1-A followed by Q1-r1-B and returns. Its output is independently preserved. A later execute invocation collects the original 32-entry ABBA schedule. HTTP attempts from both invocations consume the same existing absolute Goal ledger with maximum 200. Existing usage and unknown reservations remain charged. Credentials, snapshots, provider-scoped bridge, original SQLite Run/Task readback and artifact collection follow the released collector path.

Both commands use the same serial collection loop. Each acquired row is checked against original Run and cold SQLite records, its durably metered attempts, exact provider chat route, actual wire model and all manifest expectedWire fields. Set the intended thinking/reasoning fields explicitly in expectedWire when they are part of the comparison. Actual thinking and reasoning fields are also checked against the first acquired wire configuration throughout that invocation. Provider route rejection, missing/incomplete transport, HTTP error, acquisition/cleanup/binding failure or configuration mismatch is persisted as a collection infrastructure failure. Later row dispatch stops, remaining original row identities are preserved as NOT_TESTED, progress and spent allowance are retained, and the command returns exit 1. Budget exhaustion stops before another row dispatch.

Task terminal status and independently assigned qualityStatus remain separate recorded fields. A collected task with a failed result continues through the fixed schedule and retains its answer, artifacts and readback for blind review. The frozen A baseline's objective failures remain evidence. Independent quality scoring and the delivery threshold for final B remain part of Phase8 acceptance.

The Node regression invokes this same serial loop with an explicitly synthetic collector callback, real owned SQLite Run records and separate TEMP budget ledgers. It checks the two-row preflight, all 32 collected quality failures, immediate dispatch stop for infrastructure/Run/wire failures, thinking parity and exhaustion. The callback's reservations simulate dispatch without HTTP. Existing six loopback protocol groups remain in the suite. Real executePlan, Electron, provider configuration, credentials and the actual Goal ledger remain NOT_TESTED in this preparation.
