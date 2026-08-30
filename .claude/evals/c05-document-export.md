# C05 Document Export Eval

## Objective

Verify that the teaching-book artifact path produces real, readable Markdown/PDF/DOCX files without losing Unicode text or falsely reporting success.

## Contract

- Export is main-process only and teacher-triggered.
- `document_artifacts` is the source of truth for `status`, path, byte size and SHA-256 readback.
- PDF uses a Unicode CID font and UTF-16BE text encoding; DOCX preserves title/heading/list/code paragraph styles.
- Empty content, invalid type and failed filesystem writes are fail-closed.
- Renderer never writes a file or executes block payloads.

## Cases

1. Markdown/PDF/DOCX export creates non-empty files under the requested destination.
2. PDF has `%PDF-`, `/Subtype /Type0`, UTF-16BE text and no CJK replacement `?` bytes.
3. DOCX is a ZIP package containing `word/document.xml`, `word/styles.xml`, and heading style markers.
4. Artifact rows are readable after export and hashes match the file bytes.
5. Empty body is rejected and no successful artifact is reported.

## Commands and evidence

- `npm run test:ai-document-export` — pass (real SQLite store, three file formats, hash/readback and fail-closed empty body).
- `npm run test:deeptutor-book-renderer` — pass (book preview remains bounded and preview-only before export).
- `npm run test:deeptutor-c05-advanced-blocks` — pass^3 (unsafe interactive/animation payloads stay non-executable).
- `npm run build` — pass.

This is a deterministic local artifact gate. It does not claim full office pagination, image/animation rendering, or external teacher visual acceptance.
