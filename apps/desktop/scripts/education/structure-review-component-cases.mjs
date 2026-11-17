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
  return 6;
}
