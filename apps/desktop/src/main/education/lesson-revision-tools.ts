import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {ClassroomPlanSource} from '../../shared/classroom-plan';
import {LESSON_DETAIL_LIMIT, lessonDetailLabels, type LessonDetails} from '../../shared/teaching-lesson';
import type {createClassroomPlanState} from './classroom-plan-state';
import {matchesLessonRevision, type LessonRevisionRequest} from './lesson-revision-request';

export const LESSON_REVISION_TOOLS = ['education_read_classroom_plan', 'education_propose_classroom_outline'] as const;
const knownErrors = new Set(['conflict', 'source_changed', 'source_required', 'invalid_input', 'permission_denied', 'sensitive_content']);
const result = (data: object, failed = false) => ({
  content: [{type: 'text' as const, text: JSON.stringify({success: !failed, ...data})}],
  details: {success: !failed}, ...(failed ? {isError: true} : {}),
});

export function createLessonRevisionTools(options: {
  sessionId: string; runId: string; request: LessonRevisionRequest;
  state: ReturnType<typeof createClassroomPlanState>;
  current: () => boolean; sanitize: (text: string) => Promise<string>;
  teacherSelection: () => Promise<string | undefined>;
}): [ToolDefinition, ToolDefinition] {
  const {sessionId, runId, request, state} = options;
  let source: ClassroomPlanSource | undefined;
  let delivered = false;
  let candidates: Promise<{rootId: string; id: string; label: string}[]> | undefined;
  const visible = Object.fromEntries(request.fields.map(field => [field, lessonDetailLabels[field]]));
  function check(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!options.current()) throw Error('cancelled');
  }
  async function assertSanitized(data: object, signal?: AbortSignal) {
    const json = JSON.stringify(data);
    if (await options.sanitize(json) !== json) throw Error('sensitive_content');
    check(signal);
  }
  function failed(error: unknown, signal?: AbortSignal) {
    check(signal);
    const code = error instanceof Error && knownErrors.has(error.message) ? error.message : 'unavailable';
    const message = ['conflict', 'source_changed', 'source_required'].includes(code)
      ? '教案版本或依据已变化，请打开当前教案核对后重新提交。本次未保存修改。'
      : code === 'sensitive_content' ? '此修改涉及需要脱敏的内容，请在本机教案编辑器中处理。'
        : '没有保存修改。请先读取教案，只提交本轮点名的栏目，且每项包含完整的新内容。';
    return result({error: code, message}, true);
  }
  return [{
    name: LESSON_REVISION_TOOLS[0], label: '读取待修订教案',
    description: '读取本次教师请求绑定的教案、当前版本和允许修改的栏目。没有参数。若返回 choices，调用 ask_teacher 逐字提供这些选择，收到老师回答后再读取。',
    parameters: {type: 'object', additionalProperties: false, properties: {}} as ToolDefinition['parameters'],
    async execute(_id, input, signal) {
      try {
        check(signal);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw Error('invalid_input');
        if (!source) {
          candidates ??= state.reviews(sessionId).then(rows => rows.filter(row => matchesLessonRevision(row, request)).map((row, index) => ({
              rootId: row.rootId, id: row.id, label: `${index + 1}. ${row.title}（第 ${row.revision} 版）`,
            })));
          const matches = await candidates;
          if (!matches.length) return result({error: 'lesson_not_found', message: '此对话未找到匹配的教案，请核对完整标题。'}, true);
          const choices = matches.map(row => row.label);
          const answer = matches.length === 1 ? undefined : await options.teacherSelection();
          const target = matches.length === 1 ? matches[0] : matches.find(row => row.label === answer);
          if (!target) {
            await assertSanitized({choices}, signal);
            if (choices.length > 3) return result({error: 'lesson_target_required', message: '本会话有多份教案，请让老师指定完整标题后重新提交。'}, true);
            return result({error: 'lesson_target_required', choices, message: '请选择要修改的教案。'}, true);
          }
          const opened = await state.open({sessionId, rootId: target.rootId});
          if (opened.id !== target.id) throw Error('conflict');
          source = {id: opened.id, version: opened.version};
        }
        const lesson = await state.readLessonForRevision(sessionId, source);
        const data = {title: lesson.document.title, revision: lesson.revision, editableFields: visible,
          current: Object.fromEntries(request.fields.map(field => [field, lesson.document.lesson!.details![field]])),
          objectives: lesson.document.objectives, totalMinutes: lesson.document.totalMinutes};
        await assertSanitized(data, signal);
        delivered = true;
        return result(data);
      } catch (error) {return failed(error, signal);}
    },
  }, {
    name: LESSON_REVISION_TOOLS[1], label: '保存教案局部修订草稿',
    description: '先读本次绑定的教案。只提交教师指定的栏目字段，值为完整的新栏目正文。其余内容、依据、课时和目标由宿主从原版本保留。仅产生待教师确认的同谱系草稿。',
    parameters: {type: 'object', additionalProperties: false, required: request.fields,
      properties: Object.fromEntries(request.fields.map(field => [field, {type: 'string', minLength: 1, maxLength: LESSON_DETAIL_LIMIT}]))} as ToolDefinition['parameters'],
    async execute(callId, input, signal) {
      try {
        check(signal);
        if (!source || !delivered || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== request.fields.length) throw Error('invalid_input');
        const patch: Partial<LessonDetails> = {};
        for (const field of request.fields) {
          const value = (input as Record<string, unknown>)[field];
          if (!Object.hasOwn(input, field) || typeof value !== 'string' || !value.trim() || value.length > LESSON_DETAIL_LIMIT) throw Error('invalid_input');
          patch[field] = value.trim();
        }
        await assertSanitized(patch, signal);
        const saved = await state.reviseLesson(sessionId, runId, callId, source, request.fields, patch,
          () => options.current() && !signal?.aborted);
        return result({title: saved.document.title, id: saved.id, rootId: saved.rootId,
          revision: saved.revision, reviewed: false, status: saved.status, changedFields: visible});
      } catch (error) {return failed(error, signal);}
    },
  }];
}
