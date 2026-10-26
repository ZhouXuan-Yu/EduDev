/** Teaching text travels with the reviewed illustration, never generated at export. */
export const SCIENCE_TEACHING_SCHEMA = 'xiaozhi.science-teaching.v1' as const;
export type ScienceTeaching = {
  schemaVersion: typeof SCIENCE_TEACHING_SCHEMA;
  audience: string;
  objective: string;
  observation: string;
  steps: {part: string; explanation: string; question: string; notes: string}[];
  check: {question: string; answer: string};
};
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\x00-\x1f<>]/.test(v);
export const sciencePartCategory = (label: string) => label.replace(/[\s#]*[0-9０-９]+$/u, '') || label;
export function validScienceTeaching(v: unknown): v is ScienceTeaching {
  return obj(v) && exact(v, ['schemaVersion','audience','objective','observation','steps','check'])
    && v.schemaVersion === SCIENCE_TEACHING_SCHEMA && text(v.audience, 24) && text(v.objective, 80) && text(v.observation, 100)
    && Array.isArray(v.steps) && v.steps.length >= 1 && v.steps.length <= 4
    && v.steps.every(s => obj(s) && exact(s, ['part','explanation','question','notes']) && text(s.part, 64)
      && text(s.explanation, 100) && text(s.question, 80) && text(s.notes, 160))
    && obj(v.check) && exact(v.check, ['question','answer']) && text(v.check.question, 100) && text(v.check.answer, 140)
    && new TextEncoder().encode(JSON.stringify(v)).length <= 4096;
}
const field = (maxLength: number) => ({type:'string',minLength:1,maxLength});
export const scienceTeachingParameters = {
  type:'object',description:'教师要求备课、课堂演示或课件时填写此项；沿用已知授课对象和知识点，不询问坐标、帧率或编码。随图一起预览确认；讲解与问题进入学生课件，notes及check.answer仅放教师备注。不得虚构实验测量。',
  properties:{schemaVersion:{type:'string',const:SCIENCE_TEACHING_SCHEMA},audience:field(24),objective:field(80),observation:field(100),
    steps:{type:'array',minItems:1,maxItems:4,items:{type:'object',properties:{part:{...field(64),description:'必须精确对应图中部件类别，如散热肋片；数字后缀可省略。'},explanation:field(100),question:field(80),notes:field(160)},required:['part','explanation','question','notes'],additionalProperties:false}},
    check:{type:'object',properties:{question:field(100),answer:field(140)},required:['question','answer'],additionalProperties:false}},
  required:['schemaVersion','audience','objective','observation','steps','check'],additionalProperties:false
} as const;
