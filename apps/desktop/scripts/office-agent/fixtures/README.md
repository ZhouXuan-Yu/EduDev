# DeepSeek public catalog fixture

Public capability metadata from the JSON example in the [official Codex integration guide](https://api-docs.deepseek.com/quick_start/agent_integrations/codex/), inspected 2026-10-02. The fixture includes no credentials and is checked in so the smoke is reproducible without an ignored preparation file.

Adaptation: replace the large coding instruction template with a concise Chinese office role in `model_messages.instructions_template` and `base_instructions`. Other capability fields remain the source example. These fields are provider declarations, not a substitute for live capability checks. Model IDs were also verified through the actual `/models` API. Pin the runtime separately to Codex CLI 0.154.0; regenerate with `codex app-server generate-ts --experimental` when updating it.

Run `node scripts/office-agent/codex-app-server-live-smoke.mjs` from `apps/desktop`. Add `--extended` for native approval and compaction checks. Credentials are read only from ignored `.env.local`; test files, runtime history and sanitized reports remain under ignored `test-results/office-plan`.

`--restricted --extended --packaged-runtime` validates a staged native resource layout with shell/patch/image/agent capabilities removed, an observation relay that keeps the provider key outside the engine, three deterministic unsupported-tool injections, and a transient 500 followed by a real provider response. The injected tool cases are deterministic fault checks, not real model decisions. Production OS sandbox setup and a signed installer are separate gates.
