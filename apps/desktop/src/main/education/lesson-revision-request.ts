import {lessonDetailKeys, type LessonDetails} from '../../shared/teaching-lesson';
import type {ClassroomPlanReview} from '../../shared/classroom-plan';
import {lessonAgendaRevision, type LessonAgendaRevision} from './lesson-agenda-revision';

export type LessonDetailKey = keyof LessonDetails;
export type LessonRevisionRequest = {title?: string} & ({fields: LessonDetailKey[]} | {agenda: LessonAgendaRevision});

export function matchesLessonRevision(review: ClassroomPlanReview, request: LessonRevisionRequest) {
  return review.kind === 'lesson' && ['draft', 'confirmed'].includes(review.status) &&
    (!request.title || review.title === request.title);
}

const aliases: Record<LessonDetailKey, RegExp> = {
  content: /教学内容/u, focus: /教学重点|重点/u, difficulty: /教学难点|难点/u,
  boardwork: /板书/u, homework: /作业/u, reflection: /课后反思|教学反思/u,
};

/** Scope comes from the teacher's edit target, before any replacement prose. */
export function lessonRevisionRequest(prompt: string): LessonRevisionRequest | undefined {
  const text = prompt.trim();
  if (!/^(?:(?:请你|请|麻烦|帮我|只|仅)\s*)*(?:把|将|对|在|修改|调整|改|补充|更新|重写|润色)/u.test(text)) return;
  if (!/(?:修改|调整|改写|改为|改成|换为|换成|调为|设为|替换|补充|更新|重写|润色|改一下|只改|仅改)/u.test(text)) return;
  const target = text.split(/[。！；;\r\n]|改为|改成|换为|换成|替换为|调整为|调为|设为|写成|[，,](?=\s*(?:保留|其他|其余|不要|别动|不改|不调整|并|再|[^，,。]{1,16}(?:照旧|不变|保持原样)))/u, 1)[0];
  if (!target.includes('教案') || /(?:新建|另起|另写|新编|教案示例|教案模板|不改教案|不修改教案)/u.test(target)) return;
  const names = [...target.matchAll(/《([^《》]{1,160})》/gu)];
  if (names.length > 1) return;
  const selection = names[0] ? {title: names[0][1].trim()} : {};
  const unnamedTarget=target.replace(/《[^《》]+》/gu, '');
  const fields = lessonDetailKeys.filter(key => aliases[key].test(unnamedTarget));
  const agenda=lessonAgendaRevision(text.replace(/《[^《》]+》/gu, ''), unnamedTarget);
  if (agenda) return fields.length ? undefined : {...selection, agenda};
  if (fields.length) return {...selection, fields};
}
