import { CLASSROOM_PLAN_SCHEMA, type ClassroomPlanDocument, type ClassroomLessonIntent } from "../../shared/classroom-plan";
import { TEACHING_LESSON_SCHEMA, teachingLessonToolSchema, type TeachingLesson, type LessonPhase } from "../../shared/teaching-lesson";

import { includeLessonMaterials, lessonMaterialsToolSchema } from "./natural-lesson-materials";

const lesson = teachingLessonToolSchema.properties;
const phase = lesson.phases.items.properties;

/** The model supplies pedagogical content; the host owns identifiers and source status. */
export const naturalLessonToolSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "totalMinutes", "objectives", "preparation", "details", "scenes"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    totalMinutes: { type: "integer", minimum: 2, maximum: 240 },
    objectives: {
      type: "array", minItems: 1, maxItems: 8,
      items: {
        type: "object", additionalProperties: false, required: ["goal", "criterion"],
        properties: { goal: lesson.goalCriteria.items, criterion: lesson.goalCriteria.items },
      },
    },
    preparation: lesson.preparation,
    details: lesson.details,
    materials: lessonMaterialsToolSchema,
    mappings: lesson.mappings,
    scenes: {
      type: "array", minItems: 4, maxItems: 12,
      items: {
        type: "object", additionalProperties: false,
        required: ["title", "kind", "activity", "durationMinutes", "objectiveIndices", "teacherPrompt", "checks"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 160 },
          kind: phase.kind,
          activity: { type: "string", minLength: 1, maxLength: 3000 },
          durationMinutes: { type: "integer", minimum: 1, maximum: 120 },
          objectiveIndices: phase.objectiveIndices,
          teacherPrompt: phase.teacherPrompt,
          checks: phase.checks,
        },
      },
    },
  },
};

type NaturalLessonInput = {
  title: string;
  totalMinutes: number;
  objectives: { goal: string; criterion: string }[];
  preparation: string[];
  details: NonNullable<TeachingLesson["details"]>;
  materials?: { title: string; text: string }[];
  mappings?: TeachingLesson["mappings"];
  scenes: (Omit<LessonPhase, "sceneId"> & { title: string; activity: string; durationMinutes: number })[];
};

export function naturalLessonDocument(raw: unknown, intent: ClassroomLessonIntent, requestedMaterials?: number):
  { document: ClassroomPlanDocument; materialCount: number } | { issue: string; error: string } {
  const { title, totalMinutes, objectives, preparation, details, scenes, materials, mappings = [] } = raw as NaturalLessonInput;
  const included = includeLessonMaterials(details.content, materials, requestedMaterials);
  if ("issue" in included) return { ...included, error: "lesson_materials_incomplete" };
  const missingBasis = intent.curricula.findIndex((_,index) => !mappings.some(mapping => mapping.curriculumIndex === index));
  if (missingBasis >= 0) return {
    error: "source_required", issue: `请为第 ${missingBasis + 1} 份备课依据至少关联一个教学目标，并逐字引用实际读到的相关正文。`,
  };
  const missingSources = !intent.curricula.length ? ["本轮未选用课标或教材，请教师对照适用版本。"] :
    objectives.flatMap((_,index) => mappings.some(mapping => mapping.objectiveIndex === index) ? [] :
      [`目标 ${index + 1} 尚无直接对应的资料依据，请教师复核。`]);
  const sceneId = (index: number) => `lesson-${index + 1}`;
  const document: ClassroomPlanDocument = {
    schemaVersion: CLASSROOM_PLAN_SCHEMA,
    title,
    totalMinutes,
    objectives: objectives.map(({ goal }) => goal),
    scenes: scenes.map(({ title, kind, activity, durationMinutes }, index) => ({
      sceneId: sceneId(index),
      type: kind === "assessment" ? "quiz" : "slide",
      title,
      activity,
      durationMinutes,
    })),
    lesson: {
      schemaVersion: TEACHING_LESSON_SCHEMA,
      subject: intent.subject,
      grade: intent.grade,
      preparation,
      details: { ...details, content: included.content },
      goalCriteria: objectives.map(({ criterion }) => criterion),
      phases: scenes.map(({ kind, objectiveIndices, teacherPrompt, checks }, index) => ({
        sceneId: sceneId(index), kind, objectiveIndices, teacherPrompt, checks,
      })),
      mappings,
      missingSources,
    },
  };
  return { document, materialCount: included.materialCount };
}
