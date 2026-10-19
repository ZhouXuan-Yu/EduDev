# Role
Planner P — read-only. Do not modify business code, dependencies, or commit.

# Objective
Freeze the execution plan for Run run_a4dbfcb56a64 and produce a reference-reuse matrix so no worker reinvents existing solutions.

# Target (read only)
- Current Orca workspace: Omni-Edu / 小智教育智能体.
- Required docs: AGENTS.md, 1.Agent.md, 实施计划.md, docs/11, docs/17, docs/24, docs/26, 2.Memory.md.
- Reference projects (never modify):
  - D:\WorkProject\小智智能体借鉴项目\DeepTutor
  - D:\WorkProject\小智智能体借鉴项目\OpenMAIC
  - D:\WorkProject\小智智能体借鉴项目\edu-rag
  - D:\WorkProject\小智智能体借鉴项目\Edurag_study
  - D:\WorkProject\小智智能体借鉴项目\ai-agent-book
  - D:\WorkProject\HeroUIPro\herouipro-v3\src
  - python/vendor/deeptutor (fixed baseline)

# Change (produce)
Create `.orchestration/run_a4dbfcb56a64/01-plan.md` containing:
1. Frozen specs for T0, T1, T2, G0. Each must have Target / Change / Constraints / Ownership / Observable acceptance.
2. Reference-reuse matrix per task:
   - Concrete reference file/dir paths to inspect.
   - What to reuse (component, algorithm, schema, export template, test pattern).
   - What must NOT be copied (license/tech-stack mismatch, product-boundary violation).
   - Adaptation boundary (host/vendor, SQLite, typed preload, confirmation queue).
3. Ownership/conflict map: files per worker, db.ts sections, migration lane (none this cycle; v10 reserved for later W09).
4. Acceptance matrix: command -> expected evidence -> pass/fail criterion.
5. Risk register: privacy, sync IO, migration, memory/GPU, auto-sync, reference license.
6. Explicit "do not reinvent" rules:
   - UI: HeroUI Pro components first (docs/17 §7).
   - Agent/capability/error taxonomy: DeepTutor vendor patterns.
   - Paper/exam render/export: inspect OpenMAIC first.
   - RAG/chunking/retrieval/eval: inspect edu-rag and Edurag_study first.
   - GPU setup: use upstream RapidOCR / ONNX Runtime / sentence-transformers guidance.

# Constraints
- Read-only: do not edit code, package.json, lockfiles, docs/26, or reference projects.
- Do not install dependencies, run builds, or commit.
- Do not guess: if a reference is unreadable, record `unknown` with the exact path/error.
- Keep the output actionable, not a copy of docs.
- Report in Chinese; include exact paths and line references where useful.

# Ownership
- You own only `.orchestration/run_a4dbfcb56a64/01-plan.md`.
- Do not touch any other file.

# Observable acceptance
- `01-plan.md` exists.
- Contains all 6 sections above.
- Every task spec has all five contract fields.
- Every reference-reuse row names a concrete path; no vague "use OpenMAIC".
- Report path in worker_done.
