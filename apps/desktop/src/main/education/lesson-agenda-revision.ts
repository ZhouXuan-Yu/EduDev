import type {ClassroomPlanDocument, ClassroomPlanScene} from '../../shared/classroom-plan';
import {lessonPhaseLabels, type LessonPhase} from '../../shared/teaching-lesson';

type PhaseKind = LessonPhase['kind'];
export const lessonStageFields = {
  activity: {label:'学生活动', limit:3000, names:'学生活动|活动'},
  teacherPrompt: {label:'教师提示语', limit:1500, names:'教师提示语|教师提问|提示语'},
  checkPrompt: {label:'检查题', limit:1500, names:'检查题或任务|检查题|评价题'},
  expectedEvidence: {label:'预期证据', limit:1500, names:'预期证据|参考回答'},
  criterion: {label:'判断标准', limit:500, names:'判断标准|评价标准'},
} as const;
type StageField = keyof typeof lessonStageFields;
type LessonStageRevision = {phase: PhaseKind; fields: StageField[]; checkNumber?: number};
export type LessonAgendaRevision = LessonStageRevision | {minutes: Partial<Record<PhaseKind, number>>; totalMinutes?: number};

const stageFieldKeys = Object.keys(lessonStageFields) as StageField[];
const checkFields = ['checkPrompt','expectedEvidence','criterion'] as const;
const checkNumbers: Record<string, number> = {'一':1,'二':2,'三':3,'1':1,'2':2,'3':3};

const phaseNames: Record<PhaseKind, string> = {
  introduction: '导入', activity: '探究与讲授|探究|讲授', practice: '练习', assessment: '评价|检测', closure: '总结|小结',
};
function phaseKind(name: string) {
  return (Object.keys(phaseNames) as PhaseKind[]).find(kind => phaseNames[kind].split('|').includes(name));
}
const phasePattern = Object.values(phaseNames).join('|');
const timingClause = new RegExp(`^(全课(?:总时长|时长)?|总时长|${phasePattern})(?:环节)?(?:的?时长)?\\s*(?:改为|改成|调为|调整为|设为|用|为|[:：])\\s*([0-9]{1,3})\\s*分钟$`, 'u');
const stageTarget = new RegExp(`教案(?:中|里)?的?\\s*(${phasePattern})环节的?(?:(?:第([一二三123])(?:个|项|道)?(?:检查题|检查|评价题)|检查([一二三123]))的?)?(.+)$`, 'u');
const stageFieldPattern = Object.values(lessonStageFields).map(field=>field.names).join('|');
const separateEdit = new RegExp(`[，,；;。]\\s*(?:再|并|另|同时)?(?:把|将)?(?:(?:这份|本份)?教案的?)?(?:(?:${phasePattern})环节(?:的)?(?:${stageFieldPattern}|时长)?|全课(?:总时长|时长)?|总时长|${stageFieldPattern})(?:改为|改成|调为|调整为|设为|换成|换为)`, 'u');

function stageRevision(text: string, target: string): LessonStageRevision | undefined {
  const match = target.normalize('NFKC').trim().match(stageTarget);
  if (!match || separateEdit.test(text.normalize('NFKC'))) return;
  const phase = phaseKind(match[1]);
  if (!phase) return;
  const names = match[4].trim().replace(/[,，]$/u,'').split(/、|以及|和|与|及/u).map(name=>name.trim());
  const fields: StageField[] = [];
  for (const name of names) {
    const field = stageFieldKeys.find(key=>lessonStageFields[key].names.split('|').includes(name));
    if (!field || fields.includes(field)) return;
    fields.push(field);
  }
  const ordinal = match[2] ?? match[3];
  const checkNumber = ordinal === undefined ? undefined : checkNumbers[ordinal];
  if (checkNumber !== undefined && !fields.some(needsCheck)) return;
  return {phase, fields, ...(checkNumber === undefined ? {} : {checkNumber})};
}

function needsCheck(field: StageField) {
  return field !== 'activity' && field !== 'teacherPrompt';
}

export function lessonAgendaRevision(text: string, target: string): LessonAgendaRevision | undefined {
  const stage = stageRevision(text, target);
  if (stage) return stage;
  const timing = text.normalize('NFKC').split(/教案(?:中|里)?的?\s*[:：]?\s*/u, 2)[1];
  if (!timing) return;
  const clauses = timing.trim().replace(/[。！!]$/u,'').split(/[,，;；、]/u).map(clause=>clause.trim());
  const minutes: Partial<Record<PhaseKind, number>> = {};
  let totalMinutes: number | undefined;
  for (const clause of clauses) {
    if (/^(?:其他|其余)(?:环节)?(?:保持原样|照旧|不变)$/u.test(clause)) continue;
    const match = clause.match(timingClause);
    if (!match) return;
    const value = Number(match[2]), kind = phaseKind(match[1]);
    if (kind) {
      if (Object.hasOwn(minutes,kind) || value < 1 || value > 120) return;
      minutes[kind] = value;
    } else {
      if (totalMinutes !== undefined || value < 2 || value > 240) return;
      totalMinutes = value;
    }
  }
  if (Object.keys(minutes).length) return {minutes, ...(totalMinutes === undefined ? {} : {totalMinutes})};
}

function uniqueScene(document: ClassroomPlanDocument, kind: PhaseKind): ClassroomPlanScene {
  const phases = document.lesson?.phases.filter(phase=>phase.kind===kind);
  const scene = phases?.length===1 ? document.scenes.find(item=>item.sceneId===phases[0].sceneId) : undefined;
  if (!scene) throw Error('lesson_phase_unresolved');
  return scene;
}

export function lessonAgendaChoices(document: ClassroomPlanDocument, edit: LessonAgendaRevision) {
  if (!('phase' in edit) || edit.checkNumber !== undefined || !edit.fields.some(needsCheck)) return [];
  const scene = uniqueScene(document,edit.phase);
  const checks = document.lesson!.phases.find(item=>item.sceneId===scene.sceneId)!.checks;
  if (checks.length < 2) return [];
  return checks.map((check,index)=>({checkNumber:index+1,
    label:`检查 ${index+1}：${check.prompt.replace(/\s+/gu,' ').slice(0,90)}`}));
}

function stageTargetFor(document: ClassroomPlanDocument, edit: LessonStageRevision) {
  const scene = uniqueScene(document,edit.phase);
  const phase = document.lesson!.phases.find(item=>item.sceneId===scene.sceneId)!;
  const checkIndex = edit.checkNumber === undefined ? 0 : edit.checkNumber - 1;
  if (edit.fields.some(needsCheck) && (!phase.checks[checkIndex] || (edit.checkNumber === undefined && phase.checks.length !== 1))) {
    throw Error('lesson_check_unresolved');
  }
  return {scene,phase,checkIndex};
}

export function lessonAgendaContext(document: ClassroomPlanDocument, edit: LessonAgendaRevision) {
  if ('phase' in edit) {
    const {scene,phase,checkIndex}=stageTargetFor(document, edit);
    const check=phase.checks[checkIndex];
    const values={activity:scene.activity,teacherPrompt:phase.teacherPrompt,checkPrompt:check?.prompt,
      expectedEvidence:check?.expectedEvidence,criterion:check?.criterion};
    return {current:Object.fromEntries(edit.fields.map(field=>[field,values[field]])), stage:{
      label:lessonPhaseLabels[edit.phase],title:scene.title,minutes:scene.durationMinutes,teacherPrompt:phase.teacherPrompt,
      activity:scene.activity,objectives:phase.objectiveIndices.map(index=>document.objectives[index]),
      ...(edit.fields.some(needsCheck)?{checkNumber:checkIndex+1,check}:{checks:phase.checks})}};
  }
  return {current:document.scenes.map(scene=>({title:scene.title,minutes:scene.durationMinutes})),
    requested:edit, proposedTotalMinutes:applyLessonAgenda(document,edit,{}).totalMinutes};
}

export class LessonTimingMismatch extends Error {
  constructor(readonly expected: number, readonly scheduled: number) {super('lesson_timing_mismatch');}
}

export function applyLessonAgenda(document: ClassroomPlanDocument, edit: LessonAgendaRevision, patch: Record<string, unknown>): ClassroomPlanDocument {
  if ('phase' in edit) {
    if (!edit.fields.length || Object.keys(patch).length !== edit.fields.length) throw Error('invalid_input');
    const changes: Partial<Record<StageField,string>> = {};
    for (const field of edit.fields) {
      const value = patch[field];
      if (!Object.hasOwn(patch,field) || typeof value !== 'string' || !value.trim() || value.length > lessonStageFields[field].limit) throw Error('invalid_input');
      changes[field] = value.trim();
    }
    const {scene,phase,checkIndex}=stageTargetFor(document, edit);
    const {activity,teacherPrompt,checkPrompt,expectedEvidence,criterion}=changes;
    const checks=checkFields.some(field=>changes[field]!==undefined)?phase.checks.map((check,index)=>index===checkIndex?{
      ...check,prompt:checkPrompt??check.prompt,expectedEvidence:expectedEvidence??check.expectedEvidence,criterion:criterion??check.criterion,
    }:check):phase.checks;
    const lesson=document.lesson!;
    return {...document,scenes:activity===undefined?document.scenes:document.scenes.map(item=>item.sceneId===scene.sceneId?{...item,activity}:item),
      lesson:{...lesson,phases:lesson.phases.map(item=>item.sceneId===scene.sceneId?{...item,teacherPrompt:teacherPrompt??phase.teacherPrompt,checks}:item)}};
  }
  if(Object.keys(patch).length)throw Error('invalid_input');
  const durations=new Map(Object.entries(edit.minutes).map(([kind,value])=>[uniqueScene(document,kind as PhaseKind).sceneId,value]));
  const scenes=document.scenes.map(scene=>durations.has(scene.sceneId)?{...scene,durationMinutes:durations.get(scene.sceneId)!}:scene);
  const totalMinutes=edit.totalMinutes??document.totalMinutes;
  const scheduled=scenes.reduce((sum,scene)=>sum+scene.durationMinutes,0);
  if(scheduled!==totalMinutes)throw new LessonTimingMismatch(totalMinutes, scheduled);
  return {...document,totalMinutes,scenes};
}
