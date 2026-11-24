import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {ClassroomPlanSource} from '../../shared/classroom-plan';
import {LESSON_DETAIL_LIMIT, lessonDetailLabels} from '../../shared/teaching-lesson';
import type {createClassroomPlanState} from './classroom-plan-state';
import {matchesLessonRevision, type LessonRevisionRequest} from './lesson-revision-request';
import {lessonAgendaChoices, lessonAgendaContext, lessonStageFields, LessonTimingMismatch} from './lesson-agenda-revision';

export const LESSON_REVISION_TOOLS = ['education_read_classroom_plan', 'education_propose_classroom_outline'] as const;
const knownErrors = new Set(['conflict', 'source_changed', 'source_required', 'invalid_input', 'permission_denied', 'sensitive_content','lesson_phase_unresolved','lesson_check_unresolved']);
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
  let effectiveRequest = request;
  let candidates: Promise<{rootId: string; id: string; label: string}[]> | undefined;
  const editable = 'fields' in request ? request.fields.map(key=>({key,label:lessonDetailLabels[key],limit:LESSON_DETAIL_LIMIT})) :
    'phase' in request.agenda ? request.agenda.fields.map(key=>({key,...lessonStageFields[key]})) : [];
  const fields = editable.map(field=>field.key);
  const visible = editable.length ? Object.fromEntries(editable.map(field=>[field.key,field.label])) : {schedule:'环节时长'};
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
    if(error instanceof LessonTimingMismatch)return result({error:'lesson_timing_mismatch',
      message:`全课要求 ${error.expected} 分钟，按本次调整计算为 ${error.scheduled} 分钟。请核对要调整的其他环节，或给出准确的全课时长。本次没有保存草稿。`},true);
    const code = error instanceof Error && knownErrors.has(error.message) ? error.message : 'unavailable';
    const message = ['conflict', 'source_changed', 'source_required'].includes(code)
      ? '教案版本或依据已变化，请打开当前教案核对后重新提交。本次未保存修改。'
      : code === 'lesson_phase_unresolved' ? '这份教案中该环节不存在或有多个同类环节。请打开教案核对具体环节。'
      : code === 'lesson_check_unresolved' ? '这个环节没有匹配的检查题。请核对检查题编号，或在教案里添加检查题。本次未保存修改。'
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
        if('fields' in request&&!lesson.document.lesson?.details)throw Error('invalid_input');
        if ('agenda' in effectiveRequest && 'phase' in effectiveRequest.agenda) {
          const choices = lessonAgendaChoices(lesson.document,effectiveRequest.agenda);
          if (choices.length) {
            const answer = await options.teacherSelection();
            check(signal);
            const selected = choices.find(item=>item.label===answer);
            if (!selected) {
              const labels=choices.map(item=>item.label);
              await assertSanitized({choices:labels}, signal);
              return result({error:'lesson_check_required',choices:labels,message:'请选择要修改的检查题。'},true);
            }
            effectiveRequest={...effectiveRequest,agenda:{...effectiveRequest.agenda,checkNumber:selected.checkNumber}};
          }
        }
        const details='agenda' in effectiveRequest?lessonAgendaContext(lesson.document,effectiveRequest.agenda):{
          current:Object.fromEntries(effectiveRequest.fields.map(field => [field, lesson.document.lesson!.details![field]]))};
        const data = {title: lesson.document.title, revision: lesson.revision, editableFields: visible,...details,
          objectives: lesson.document.objectives, totalMinutes: lesson.document.totalMinutes};
        await assertSanitized(data, signal);
        delivered = true;
        return result(data);
      } catch (error) {return failed(error, signal);}
    },
  }, {
    name: LESSON_REVISION_TOOLS[1], label: '保存教案局部修订草稿',
    description: fields.length?'先读本次绑定的教案。只提交本次指定的栏目或环节字段的新正文。保存同谱系待确认草稿。':
      '先读取教案及确定性时长核对结果。通过时传空对象保存老师原话明确的分钟数。若合计冲突，请向老师说明，避免自行分配时间。',
    parameters: {type: 'object', additionalProperties: false, required: fields,
      properties: Object.fromEntries(editable.map(({key,limit}) => [key, {type: 'string', minLength: 1, maxLength: limit}]))} as ToolDefinition['parameters'],
    async execute(callId, input, signal) {
      try {
        check(signal);
        if (!source || !delivered || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== fields.length) throw Error('invalid_input');
        const patch: Record<string,string> = {};
        for (const {key,limit} of editable) {
          const value = (input as Record<string, unknown>)[key];
          if (!Object.hasOwn(input, key) || typeof value !== 'string' || !value.trim() || value.length > limit) throw Error('invalid_input');
          patch[key] = value.trim();
        }
        await assertSanitized(patch, signal);
        const saved = await state.reviseLesson(sessionId, runId, callId, source, effectiveRequest, patch,
          () => options.current() && !signal?.aborted);
        return result({title: saved.document.title, id: saved.id, rootId: saved.rootId,
          revision: saved.revision, reviewed: false, status: saved.status, changedFields: visible});
      } catch (error) {return failed(error, signal);}
    },
  }];
}
