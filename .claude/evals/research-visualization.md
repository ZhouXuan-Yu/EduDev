# E07/E08 DeepTutor research + visualization host eval

## Contract

- `research_workspace` routes to `knowledge_retrieval`, never requires a student, and exposes only local knowledge tools.
- `generate_research_outline` returns bounded outline/sourceRefs/unknowns with `omni.research.outline.v1`, `writesFile=false`, and teacher review required.
- `visualization` routes to `lesson_design`, never requires a student, and exposes only local graph tools.
- `render_learning_mermaid` returns bounded Mermaid with no scripts, external URLs, or write side effects.

## Cases

- 4 router cases in `AI_HARNESS_EVAL_CASES` (`research-01/02`, `visualization-01/02`).
- 18 executable smoke assertions cover routing, allowlists, local evidence, empty-state fail-closed, no student context, no-write, output limits, and injection/XSS sanitization.

## Evidence

Run `npm run test:ai-harness` and `npm run test:deeptutor-research-visualization`.

This is a deterministic local host slice. It does not claim live web research, citation verification, chart rendering, or external provider availability.
