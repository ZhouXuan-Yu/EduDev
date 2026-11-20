import type {StructureQuestion} from "../../shared/material-document-structure";
import {questionSection} from "./material-structure-numbering";

/** A published question inherits the printed section when its own shape agrees. */
export function printedStructureQuestionType(question: StructureQuestion): string | undefined {
  if (question.kind !== "question" || question.status !== "candidate") return;
  const heading = questionSection.exec(question.section.trim());
  if (!heading) return;
  const suffix = question.section.trim().slice(heading[0].length).trim();
  // Descriptions such as “选择题的命制” or “选择题 答案” are not sections.
  if (suffix && !/^(?:[:：]\s*)?(?:[（(]|(?:本[大]?题|共|每[小]?题|在|请))/u.test(suffix)
      && !/^[:：]$/u.test(suffix)) return;

  const type = heading[1];
  if (type.endsWith("选择题")) {
    if (question.subquestions.length || question.options.length < 2 ||
        !question.options.every((option, index) =>
          option.label === String.fromCharCode(65 + index) && option.text.trim())) return;
  } else if (question.options.length) {
    return;
  }
  return type;
}
