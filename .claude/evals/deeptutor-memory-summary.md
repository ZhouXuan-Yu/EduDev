# C12 — DeepTutor L2 memory summary

## Contract

L2 is a bounded, editable surface document, not a chat transcript. Candidate summaries are read-only and evidence-bound; only an explicit teacher action may create or edit a formal entry. Every reference must resolve to a local `ai_agent_runs` or `ai_agent_events` row. Hidden reasoning, raw prompts, student records, and secret-like text must never enter the public summary.

## Code-based acceptance

- `npm run test:deeptutor-memory-summary` passes all 36 cases.
- `npm run test:ai-harness` preserves explicit `memory_summary` routing and 116/116 cases.
- `npm run test:deeptutor-memory-trace` preserves the L1 boundary.
- `npm run build` and Electron smoke pass with the renderer memory view loaded through preload IPC only.
- Stale entry versions, invalid evidence references, derived-origin writes, banned absolute claims, and disabled/deleted entries fail closed.

## Evidence boundary

The deterministic smoke suite is local/seeded evidence. It proves contracts, persistence, routing, and adversarial guards; it does not claim live DeepSeek quality, teacher agreement, or high-load SLO.

## C13 extension — L3 synthesis

- `npm run test:deeptutor-memory-synthesis` passes 18 cases.
- L3 routing is isolated to `memory_synthesis`; student, knowledge, and graph contexts remain excluded.
- Draft synthesis is bounded and read-only; teacher adoption is the only formal write path.
- Cross-surface source names are allowlisted, stale versions fail closed, and prompt/hidden reasoning probes remain absent.

## C14 extension — evidence graph

- The graph projection links active L3 entries to active L2 entries and L2 evidence refs to local run/event nodes.
- `inspect_memory_graph` is only available under `memory_synthesis`, is bounded, and returns labels/edge kinds/statuses—not source text.
- The synthesis smoke now covers graph presence, edge integrity, tool round-trip, and sensitive-field exclusion (24 cases).

## C15 extension — governance

- Governance report is read-only and declares `writableByAi=false`.
- It counts L2/L3 documents/entries, disabled/deleted entries, graph size, and dangling evidence refs.
- The C15 smoke extends the synthesis suite to 30 cases and requires zero dangling refs for valid fixtures.
- `npm run test:deeptutor-memory-performance` seeds 100 L2 + 1 L3 entries and runs 20 concurrent graph/governance samples; the local fixture p95 must be below 2 seconds.
