import type { ClassroomLessonIntent } from "../../shared/classroom-plan";
import type { CurriculumEntry } from "../../shared/material-curriculum";
import { equivalentQuestionGradeLabels } from "../../shared/question-grade";

export async function resolveNaturalLessonBasis(
  titles: readonly string[],
  lesson: ClassroomLessonIntent,
  resolve: (title: string) => Promise<CurriculumEntry>,
): Promise<ClassroomLessonIntent> {
  if (titles.length > 3) throw Error("lesson_basis_ambiguous");
  const curricula = new Map<string, string>();
  const grades = equivalentQuestionGradeLabels(lesson.grade);
  for (const title of titles) {
    const { source, id, metadata } = await resolve(title);
    if (metadata.subject !== lesson.subject || !grades.includes(metadata.grade))
      throw Error("lesson_basis_unavailable");
    curricula.set(source.resourceId, id);
  }
  return { ...lesson, curricula: Array.from(curricula, ([resourceId, revision]) => ({ resourceId, revision })) };
}
