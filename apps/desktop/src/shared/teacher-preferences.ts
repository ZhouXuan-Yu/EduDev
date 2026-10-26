/** Presentation preferences are not educational facts, permissions or instructions. */
export const TEACHER_PREFERENCE_SCHEMA='xiaozhi.teacher-preference.v1' as const;
export const TEACHER_PREFERENCE_VALUES={
 length:['concise','detailed'],structure:['step_by_step','continuous'],
 answerOrder:['hint_first','answer_first'],presentation:['table','paragraph'],
 exportFormat:['docx','pdf','pptx'],
} as const;
export type TeacherPreferenceValues={ [K in keyof typeof TEACHER_PREFERENCE_VALUES]?:typeof TEACHER_PREFERENCE_VALUES[K][number] };
export type TeacherPreferenceSnapshot={schemaVersion:typeof TEACHER_PREFERENCE_SCHEMA;revision:number;values:TeacherPreferenceValues};
export function validTeacherPreferenceValues(raw:unknown):raw is TeacherPreferenceValues{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 return Object.entries(raw).every(([key,value])=>Object.prototype.hasOwnProperty.call(TEACHER_PREFERENCE_VALUES,key)&&typeof value==='string'&&(TEACHER_PREFERENCE_VALUES[key as keyof TeacherPreferenceValues] as readonly string[]).includes(value));
}
