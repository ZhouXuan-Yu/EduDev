# finesse-skill design workflow reference

- Repository: https://github.com/mouse-lin/finesse-skill
- Pinned commit: `5050b6c71e27b829d1b3087d2be889d29c60db00`
- License: MIT, original notice retained in LICENSE.
- Read: `skills/finesse-ui/SKILL.md`, `references/product-ui.md`, `references/ai-console.md`, and `examples/relay-agent-console.html`.
- References and source manifest retained locally in ignored `apps/desktop/test-results/office-plan/references/finesse/`.
- 2026-10-03: pinned `SKILL.md` and `references/component-scope.md`, `product-ui.md`, `ai-console.md` are also retained here for design recovery across context compaction. `SKILL.md` SHA256: `b3c95a871163a8fbed75dca16a6530170c6311627c577dd12e05242e412a2b8c`. This is a design reference, not a registered teacher execution skill. User screenshots take precedence over general style rules. Full P06 visual acceptance remains pending.

Applied to the Office UI reuse contract: live process visibility, fixed composer/stop position, independent scroll, human approval context and verifiable artifacts. The supplied Codex screenshots fix the palette and geometry. The example's optimistic stopped state and raw payload rendering are adapted to the project rules: display stop requested until the runtime confirms, and render only approved public fields.

No standalone dashboard or synthetic demo from the upstream example is shipped as a functioning Xiaozhi agent. Source components are supplied by the existing HeroUI Pro local reuse. The current production runtime is embedded Pi SDK with Hana adapters (docs/48); the earlier official Codex app-server remains a historical experiment. P04 binds real plan/question/native queue state using the fixed AI-console guidance; complete Codex visual parity remains pending.
