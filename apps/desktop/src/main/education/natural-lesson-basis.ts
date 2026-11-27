import { validClassroomPlanStart, type ClassroomLessonIntent } from "../../shared/classroom-plan";
import type { CurriculumEntry } from "../../shared/material-curriculum";
import { equivalentQuestionGradeLabels } from "../../shared/question-grade";
import { MATERIALS_SCHEMA } from "../../shared/materials";
import { materialSource } from "../assets/material-source";
import type { MaterialRepository } from "../assets/material-repository";
import type { OrdinaryLessonDraft } from "./natural-lesson-draft";

/** A named ordinary material may ground a lesson without being promoted to a registered curriculum. */
export async function resolveOrdinaryLessonBasis(
  request: OrdinaryLessonDraft,
  materials: Pick<MaterialRepository,"exactNames"|"body">,
) {
  const matches=await materials.exactNames(request.materialTitle,{includeFileStem:true});
  if(matches.length>1)throw Error("lesson_basis_ambiguous");
  if(matches.length!==1)throw Error("lesson_basis_unavailable");
  const [{resourceId,version}]=matches;
  const {resource,chunks,total}=await materials.body({schemaVersion:MATERIALS_SCHEMA,resourceId,offset:0});
  if(resource.contentHash!==version||resource.parseStatus==="partial"||total===0||total>4||chunks.length!==total||
      chunks.some(chunk=>chunk.containsPersonalData||!chunk.contentMd.trim()||chunk.contentMd.length>12000))
    throw Error("lesson_basis_unavailable");
  const subjects=new Set(chunks.map(chunk=>chunk.subject).filter(Boolean));
  const grades=equivalentQuestionGradeLabels(request.grade);
  const sourceGrades=chunks.map(chunk=>chunk.grade).filter(Boolean);
  const subject=request.subject??(subjects.size===1?[...subjects][0]:undefined);
  if(!subject||[...subjects].some(value=>value!==subject)||sourceGrades.some(value=>!grades.includes(value))||
      (!request.subject&&!sourceGrades.length))
    throw Error("lesson_basis_unavailable");
  const lesson:ClassroomLessonIntent={subject,grade:request.grade,curricula:[]};
  if(!validClassroomPlanStart({mode:"outline",lesson}))throw Error("lesson_basis_unavailable");
  return {lesson,sources:chunks.map((chunk,offset)=>materialSource({resourceId,version,offset,title:resource.title,chunk}))};
}

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
