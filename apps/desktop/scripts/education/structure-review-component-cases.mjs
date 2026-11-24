import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export async function structureReviewComponentCases(server) {
  const { MaterialStructureReview } = await server.ssrLoadModule(
    "/src/renderer/components/product/MaterialStructureReview.tsx",
  );
  const { QuestionArchiveFields } = await server.ssrLoadModule(
    "/src/renderer/components/QuestionArchiveFields.tsx",
  );
  const props = {
    question: {
      id: "q",
      kind: "question",
      status: "needs_review",
      issues: ["low_ocr_score"],
    },
    reference: {},
    disabled: false,
    onDirty: () => {},
    onSaved: () => {},
  };
  const render = (extra) =>
    renderToStaticMarkup(
      React.createElement(MaterialStructureReview, { ...props, ...extra }),
    );
  assert.match(render({}), /核对并保存到题本/);
  assert.match(render({ disabled: true }), /disabled/);
  assert.match(
    render({ reviewedId: "question-saved" }),
    /教师修正已保存到题本/,
  );
  assert(
    !render({
      question: { ...props.question, issues: ["missing_figure"] },
    }).includes("structure-review-open"),
  );
  assert.equal(render({ question: { ...props.question, kind: "answer" } }), "");
  const fields = {
    stem: "<script>题干</script>",
    answer: "D",
    analysis: "步骤",
    subject: "物理",
    grade: "初三",
    knowledgePoint: "运动",
    questionType: "选择题",
    difficulty: "easy",
  };
  const form = renderToStaticMarkup(
    React.createElement(QuestionArchiveFields, {
      fields,
      onChange: () => {},
      disabled: true,
      difficultyChosen: true,
      onDifficultyChosen: () => {},
      prefix: "structure-review",
    }),
  );
  assert.match(form, /structure-review-stem/);
  assert.match(form, /structure-review-difficulty/);
  assert(form.includes("&lt;script&gt;"));
  assert(!form.includes("<script>"));
  assert.equal((form.match(/<(?:input|textarea|select)\b[^>]*\bdisabled/g) || []).length, 8);
  assert.match(
    render({question: {...props.question, issues: ['native_unconfirmed']}}),
    /structure-review-open/,
  );
  const { structureFormulaCandidate } = await server.ssrLoadModule(
    "/src/renderer/components/product/material-structure-formula-candidate.ts",
  );
  const reference = { resourceId: "resource", version: "version", generation: "generation", candidateId: "q", sha256: "candidate" };
  const source = { page: 2, box: [0.1, 0.2, 0.4, 0.5], rasterSha256: "raster", lineIds: ["lead", "upper", "lower", "side"] };
  const lines = [
    { id: "lower", text: "3a−2", score: 0.96 },
    { id: "lead", text: "求出 y=", score: 0.99 },
    { id: "side", text: "+b", score: 0.99 },
    { id: "upper", text: "m×2", score: 0.97 },
  ];
  const view = {
    summary: reference,
    references: { q: reference },
    page: { ...reference, page: 2, rasterSha256: "raster", lines },
    questions: [{ id: "q", formulaSources: [source] }],
  };
  assert.deepEqual(structureFormulaCandidate(view, reference, source),
    { numerator: "m×2", denominator: "3a−2", copyText: "(m×2)/(3a−2)" });
  assert.equal(structureFormulaCandidate(view, { ...reference, generation: "other" }, source), undefined);
  assert.equal(structureFormulaCandidate(view, { ...reference, sha256: "other" }, source), undefined);
  assert.equal(structureFormulaCandidate(view, reference, { ...source, rasterSha256: "other" }), undefined);
  assert.equal(structureFormulaCandidate(view, reference, { ...source, lineIds: ["lead", "side", "lower"] }), undefined);
  assert.equal(structureFormulaCandidate({ ...view, page: { ...view.page, lines: lines.slice(1) } }, reference, source), undefined);
  const lowerScore = [ { ...lines[0], score: 0.89 }, ...lines.slice(1) ];
  assert.equal(structureFormulaCandidate({ ...view, page: { ...view.page, lines: lowerScore } }, reference, source).copyText, undefined);
  const uncertainGlyph = [ { ...lines[0], text: "a²" }, ...lines.slice(1) ];
  assert.equal(structureFormulaCandidate({ ...view, page: { ...view.page, lines: uncertainGlyph } }, reference, source).copyText, undefined);
  return 15;
}
