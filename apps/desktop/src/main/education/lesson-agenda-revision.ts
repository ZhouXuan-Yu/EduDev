import type {ClassroomPlanDocument, ClassroomPlanScene} from '../../shared/classroom-plan';
import {lessonPhaseLabels, type LessonPhase} from '../../shared/teaching-lesson';

type PhaseKind = LessonPhase['kind'];
export type LessonAgendaRevision = {activity: PhaseKind} | {minutes: Partial<Record<PhaseKind, number>>; totalMinutes?: number};

const phaseNames: Record<PhaseKind, string> = {
  introduction: '导入', activity: '探究与讲授|探究|讲授', practice: '练习', assessment: '评价|检测', closure: '总结|小结',
};
function phaseKind(name: string) {
  return (Object.keys(phaseNames) as PhaseKind[]).find(kind => phaseNames[kind].split('|').includes(name));
}
const phasePattern = Object.values(phaseNames).join('|');
const timingClause = new RegExp(`^(全课(?:总时长|时长)?|总时长|${phasePattern})(?:环节)?(?:的?时长)?\\s*(?:改为|改成|调为|调整为|设为|用|为|[:：])\\s*([0-9]{1,3})\\s*分钟$`, 'u');

export function lessonAgendaRevision(text: string, target: string): LessonAgendaRevision | undefined {
  const activity = target.match(new RegExp(`(${phasePattern})环节(?:的)?(?:学生活动|活动)(?=\\s*$|[，,])`, 'u'));
  if (activity) {
    const otherPhase = new RegExp(`(?:${phasePattern})(?:环节)?\\s*(?:和|与|及|、|还有)`, 'u');
    const extraMinuteEdit = new RegExp(`[，,；;](?:再|并|另)?(?:把|将)?(?:全课|总时长|${phasePattern})(?:环节|总时长|时长)?(?:改为|改成|调为|调整为|设为)\\s*\\d+\\s*分钟`, 'u');
    if (otherPhase.test(target.replaceAll('探究与讲授','探究')) || extraMinuteEdit.test(text.normalize('NFKC'))) return;
    const kind = phaseKind(activity[1]);
    if (kind) return {activity:kind};
  }
  const timing = text.normalize('NFKC').split(/教案(?:的|中|里)?\s*[:：]?\s*/u, 2)[1];
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

export function lessonAgendaContext(document: ClassroomPlanDocument, edit: LessonAgendaRevision) {
  if ('activity' in edit) {
    const scene=uniqueScene(document,edit.activity);
    const phase=document.lesson!.phases.find(item=>item.sceneId===scene.sceneId)!;
    return {current:{activity:scene.activity}, stage:{label:lessonPhaseLabels[edit.activity],title:scene.title,
      minutes:scene.durationMinutes, teacherPrompt:phase.teacherPrompt, checks:phase.checks}};
  }
  return {current:document.scenes.map(scene=>({title:scene.title,minutes:scene.durationMinutes})),
    requested:edit, proposedTotalMinutes:applyLessonAgenda(document,edit,{}).totalMinutes};
}

export class LessonTimingMismatch extends Error {
  constructor(readonly expected: number, readonly scheduled: number) {super('lesson_timing_mismatch');}
}

export function applyLessonAgenda(document: ClassroomPlanDocument, edit: LessonAgendaRevision, patch: Record<string, unknown>): ClassroomPlanDocument {
  if ('activity' in edit) {
    const activity=patch.activity;
    if(Object.keys(patch).length!==1 || typeof activity!=='string' || !activity.trim() || activity.length>3000)throw Error('invalid_input');
    const target=uniqueScene(document,edit.activity);
    return {...document, scenes:document.scenes.map(scene=>scene.sceneId===target.sceneId?{...scene,activity:activity.trim()}:scene)};
  }
  if(Object.keys(patch).length)throw Error('invalid_input');
  const durations=new Map(Object.entries(edit.minutes).map(([kind,value])=>[uniqueScene(document,kind as PhaseKind).sceneId,value]));
  const scenes=document.scenes.map(scene=>durations.has(scene.sceneId)?{...scene,durationMinutes:durations.get(scene.sceneId)!}:scene);
  const totalMinutes=edit.totalMinutes??document.totalMinutes;
  const scheduled=scenes.reduce((sum,scene)=>sum+scene.durationMinutes,0);
  if(scheduled!==totalMinutes)throw new LessonTimingMismatch(totalMinutes, scheduled);
  return {...document,totalMinutes,scenes};
}
