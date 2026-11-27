import { CLASSROOM_PLAN_SCHEMA, type ClassroomPlanDocument, type ClassroomLessonIntent } from "../../shared/classroom-plan";
import { TEACHING_LESSON_SCHEMA, teachingLessonToolSchema, type TeachingLesson, type LessonPhase } from "../../shared/teaching-lesson";

import { includeLessonMaterials, lessonMaterialsToolSchema } from "./natural-lesson-materials";
import { lessonSlotMatches, type LessonAgendaSlot } from "./natural-lesson-agenda";

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

type DraftShape={type?:string;properties?:Record<string,DraftShape>;items?:DraftShape};
function prepareDraftValue(value:unknown,schema:DraftShape,nested=false):unknown {
  if(Array.isArray(value)&&schema.items)return value.map(item=>prepareDraftValue(item,schema.items!,true));
  if(!value||typeof value!=="object"||Array.isArray(value)||!schema.properties)return value;
  const properties=schema.properties;
  return Object.fromEntries(Object.entries(value).flatMap(([name,child])=>{
    if(Object.hasOwn(properties,name))return [[name,prepareDraftValue(child,properties[name],true)]];
    return nested&&child===""?[]:[[name,child]];
  }));
}

/** Strip empty model annotations before the original strict schema and action checks. */
export function prepareNaturalLessonArguments(value:unknown) {
  return prepareDraftValue(value,naturalLessonToolSchema);
}

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

function keepClosingSlot(scenes:NaturalLessonInput['scenes'],agenda?:readonly LessonAgendaSlot[]) {
  const assessment=scenes.at(-2),closing=scenes.at(-1),slot=agenda?.at(-1);
  if(!agenda||slot?.kind!=='closure'||scenes.length!==agenda.length+1||
     assessment?.kind!=='assessment'||closing?.kind!=='closure'||
     assessment.durationMinutes+closing.durationMinutes!==slot.minutes||
     !agenda.slice(0,-1).every((item,index)=>lessonSlotMatches(item,scenes[index].kind,scenes[index].durationMinutes)))
    return scenes;
  const title=assessment.title+' · '+closing.title;
  const activity=assessment.activity+'\n'+closing.activity;
  const teacherPrompt=assessment.teacherPrompt+'\n'+closing.teacherPrompt;
  const checks=[...assessment.checks,...closing.checks];
  if(title.length>160||activity.length>3000||teacherPrompt.length>1500||checks.length>3)return scenes;
  return [...scenes.slice(0,-2),{...assessment,title,activity,teacherPrompt,checks,durationMinutes:slot.minutes,
    objectiveIndices:[...new Set([...assessment.objectiveIndices,...closing.objectiveIndices])]}];
}

export function naturalLessonDocument(raw: unknown, intent: ClassroomLessonIntent, requestedMaterials?: number, agenda?:readonly LessonAgendaSlot[]):
  { document: ClassroomPlanDocument; materialCount: number } | { issue: string; error: string } {
  if(JSON.stringify(raw)?.includes("\uFFFD"))return {
    error:"lesson_text_encoding",
    issue:"教案含有解码损坏标记 U+FFFD。请按已读资料重新生成对应文字，保留原题、目标和环节安排。来源确实缺字时请明确标为待核对。",
  };
  const { title, totalMinutes, objectives, preparation, details, scenes:submittedScenes, materials, mappings:submittedMappings=[] } = raw as NaturalLessonInput;
  const mappings=intent.curricula.length?submittedMappings:[];
  const scenes=keepClosingSlot(submittedScenes,agenda);
  const included = includeLessonMaterials(details.content, materials, requestedMaterials);
  if ("issue" in included) return { ...included, error: "lesson_materials_incomplete" };
  const missingBasis = intent.curricula.findIndex((_,index) => !mappings.some(mapping => mapping.curriculumIndex === index));
  if (missingBasis >= 0) return {
    error: "source_required", issue: `请为第 ${missingBasis + 1} 份备课依据至少关联一个教学目标，并逐字引用实际读到的相关正文。`,
  };
  const missingSources = !intent.curricula.length ? ["本轮未选用课标或教材，请教师对照适用版本。"] :
    objectives.flatMap((_,index) => mappings.some(mapping => mapping.objectiveIndex === index) ? [] :
      [`目标 ${index + 1} 尚无直接对应的资料依据，请教师复核。`]);
  const closing=scenes.at(-1);
  // A final check can share the closing slot. Coverage still validates every actual check.
  const scheduled=closing?.kind==="closure"&&closing.checks.length&&!scenes.some(scene=>scene.kind==="assessment")
    ? scenes.with(-1,{...closing,kind:"assessment"}) : scenes;
  const sceneId = (index: number) => `lesson-${index + 1}`;
  const document: ClassroomPlanDocument = {
    schemaVersion: CLASSROOM_PLAN_SCHEMA,
    title,
    totalMinutes,
    objectives: objectives.map(({ goal }) => goal),
    scenes: scheduled.map(({ title, kind, activity, durationMinutes }, index) => ({
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
      phases: scheduled.map(({ kind, objectiveIndices, teacherPrompt, checks }, index) => ({
        sceneId: sceneId(index), kind, objectiveIndices, teacherPrompt, checks,
      })),
      mappings,
      missingSources,
    },
  };
  return { document, materialCount: included.materialCount };
}
