import {validClassroomPlanSource,type ClassroomPlanSource} from './classroom-plan';

export const TEACHING_LESSON_OFFICE_SCHEMA='xiaozhi.teaching-lesson-office.v1' as const;
export const TEACHING_LESSON_EXPORT_TOOLS=['education_read_teaching_lesson','education_export_teaching_lesson'] as const;
/** The authoritative document remains in SQLite; this immutable reference is
 * checked against the current confirmed revision before every file effect. */
export type TeachingLessonOfficeSource=ClassroomPlanSource&{revision:number};
export type TeachingLessonExportInput={planId:string;version:string;outputs:{format:'docx'|'pdf';path:string}[]};
export function validTeachingLessonOfficeSource(value:unknown):value is TeachingLessonOfficeSource{
 const v=value as TeachingLessonOfficeSource;
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===3&&Object.keys(v).every(k=>['id','version','revision'].includes(k))
  &&validClassroomPlanSource({id:v.id,version:v.version})&&Number.isSafeInteger(v.revision)&&v.revision>0;
}
