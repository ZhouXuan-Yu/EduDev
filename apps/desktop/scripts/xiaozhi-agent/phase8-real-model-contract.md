# Phase8 real-model execution preparation

Status is DRAFT / NOT_TESTED for Electron, native UI and real providers. This delivery prepares the fixed Q1–Q8, 32-run paired sequence. Current validation runs only Node and loopback fixtures with fake credentials and separate TEMP ledgers. The actual Goal database stays outside this preparation's test paths.

## Released seams

Both current trees register the Pi provider with baseUrl https://api.deepseek.com/v1 and supply the provider-scoped createDeepSeekFetch function. In Electron it calls electron.net.fetch with credentials omitted and redirect:error. Both installed Pi implementations pass model.baseUrl to the OpenAI client, whose chat resource posts /chat/completions. The observed wire URL remains recorded at runtime. The bridge supports the two explicitly configured provider paths /v1/chat/completions and /chat/completions using separate fixed upstream proxy endpoints. Other DeepSeek paths fail closed, except separately observed GET /models and GET /v1/models. Existing production provider, permission and endpoint checks stay in place.

The bootstrap patches electron.net.fetch before importing the selected tree's existing built main. Chat POSTs go through the original net.fetch to the dedicated loopback counting proxy, which durably reserves each upstream HTTP attempt. The global fetch function stays untouched. The existing counting proxy performs zero retries. SDK retries and tool loops therefore consume separate reservations. Other provider traffic remains separately observable. Body and authorization bytes exist only in the transport and the app's existing credential handling. Telemetry retains only whitelisted model configuration, byte counts, status, safe identity and timing fields.

Each run has a unique prebound task/version/round/evidenceRef. Real Run identity is cross-checked against snapshot and original ai_agent_runs before bindRun. Actual Task identity is recorded separately from the Q label using snapshot and original Task/receipt facts. A legacy missing Task is reported explicitly. UI submission count and HTTP attempt count remain separate.

## Prepared entry points

The plan module freezes synthetic facts.txt, scores.csv, the question text and exact Q inputs, and generates round1 A→B / round2 B→A for each Q. Preparation emits a manifest template and input hashes. The future executor requires frozen A/B commits, out lists and independently prepared synthetic data/profile snapshots, selects the owned workspace through the existing UI picker, submits through Office Composer, records permission choices and terminal snapshots, and collects artifacts, original SQLite readback, request bindings and timings for independent review. It creates no production AgentLoop or business ledger.

Only the existing shared absolute Goal database is accepted for future real execution. It must already exist. No execution path resets its limit or used count. Fixture validation uses a separately named TEMP database. The final B build, local credential setup, seeded question-bank snapshots, actual settings equality, real UI/provider/TLS coverage and quality scores remain NOT_TESTED until root supplies the actual frozen inputs and executes the coordinated gates.

## Scope and rollback

Only new phase8-real-model-* scripts and owned TEMP evidence are written. Existing budget, stream-performance, production and frozen UI files remain untouched. Removing these new helper files rolls back this preparation. The budget schema and existing Goal database require no migration.
