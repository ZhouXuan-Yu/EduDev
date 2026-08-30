# C05 advanced typed blocks eval

## Capability contract

- `timeline` renders at most 20 bounded events with date/title/body and preserves no executable payload.
- `code` renders a fenced code block with a sanitized language and bounded body; it never executes code.
- `deep_explanation` renders bounded sections (claim/evidence/steps/check) and preserves source anchors.
- `user_note` renders teacher-authored notes as quoted Markdown; raw HTML/scripts are neutralized.
- `interactive` and `animation` never execute HTML, JavaScript, iframe, SVG event handlers, or local paths; they return a visible safe fallback and increment `fallbackCount`.
- Unknown fields/types remain fail-safe, Markdown remains bounded, and `writesFile=false` until explicit artifact export.

## Adversarial cases

- malformed arrays/objects, oversized text and control characters;
- `<script>`, `javascript:`, `data:`, iframe and event-handler payloads;
- unsupported/unknown block type and pending/error status;
- source anchor retention and deterministic block ordering.

## Regression gates

- `npm run test:deeptutor-book-renderer`
- `npm run test:deeptutor-c05-advanced-blocks`
- `npm run test:ai-harness`
- `npm run test:ai-observability`
- `npm run build`

The local smoke is deterministic and does not claim live LLM quality, browser HTML execution, Manim rendering, or PDF/DOCX layout fidelity.
