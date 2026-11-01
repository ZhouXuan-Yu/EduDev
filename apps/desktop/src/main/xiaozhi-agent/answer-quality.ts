import type {XiaozhiModelCapabilities} from '../../shared/xiaozhi-agent';
import { supportedThinking, type ThinkingChoice, type ThinkingDecision } from '../../shared/xiaozhi-thinking';
import { physicsAnswerInstructions } from './physics-answer-quality';

/** Main-only rollback/controlled A/B. Never supplied by the model or renderer. */
export function answerQualityEnabled() { return process.env.XIAOZHI_ANSWER_QUALITY !== 'legacy'; }
export type AnswerPolicy = {mode:'fast'|'standard'|'deep';thinking:'low'|'medium'|'high';maxOutputTokens:number};
/** Deterministic routing is a budget hint, not a claim that a task is understood. */
export function resolveAnswerPolicy(text:string, capacity?:XiaozhiModelCapabilities):AnswerPolicy {
  const fast=/^(你好|您好|谢谢|好的|收到|明白|再见)[！!。\s]*$/.test(text.trim())
    || /简短|简要|一句话|快速回答|只要答案/.test(text);
  const deep=!fast && /证明|推导|严谨|深入|详细|完整|逐步|多[份篇个].*(资料|文档)|对比|比较|分析.*(原因|错因)|教案|试卷/.test(text);
  const mode=fast?'fast':deep?'deep':'standard';
  const requested=mode==='deep'?16384:mode==='standard'?8192:4096;
  const verified=capacity&&!capacity.stale&&Number.isSafeInteger(capacity.maxOutputTokens)&&capacity.maxOutputTokens>0
    &&Number.isSafeInteger(capacity.contextWindow)&&capacity.contextWindow>=4096;
  return {mode,thinking:mode==='deep'?'high':mode==='standard'?'medium':'low',
    maxOutputTokens:verified?Math.min(requested,capacity.maxOutputTokens,Math.floor(capacity.contextWindow/2)):4096};
}

export const isThinkingContinuation=(text:string)=>/^(继续|可以|好的|好|行|没问题|接着做|继续完成|就这样)[！!。\s]*$/u.test(text.trim());
/** Reuse the current-task continuation rule; unrelated new turns get no subject addendum. */
export function resolveSubjectAnswerInstructions(text:string, unfinishedTask='') {
  return physicsAnswerInstructions(isThinkingContinuation(text)&&unfinishedTask ? unfinishedTask : text);
}
export function resolveThinkingPolicy(text:string, capacity?:XiaozhiModelCapabilities,
  requested:ThinkingChoice='auto', scope:ThinkingDecision['scope']='global', unfinishedTask=''):ThinkingDecision {
  const taskText=isThinkingContinuation(text)&&unfinishedTask ? unfinishedTask : text;
  const route=resolveAnswerPolicy(/课件|演示|ppt|html|生成.*(文件|文档)/iu.test(taskText)?'详细 '+taskText:taskText, capacity);
  const supported=supportedThinking(capacity);
  const reason=supported.length===1?'capability_unknown':!supported.includes(requested)?'unsupported_choice':undefined;
  let effective:ThinkingChoice=reason?'auto':requested;
  if(effective==='auto'&&supported.length>1){
    const levels=capacity!.effort!.supportedLevels;
    effective=!levels.length||route.mode==='fast'?'off':route.mode==='deep'?(levels.includes('high')?'high':levels.at(-1)!):(levels.includes('low')?'low':capacity!.effort!.defaultLevel||levels[0]);
  }
  const budget=effective==='max'?32768:effective==='high'?16384:effective==='low'?8192:effective==='off'?4096:route.maxOutputTokens;
  const verified=capacity&&!capacity.stale;
  return {requested,effective,scope,mode:route.mode,thinkingType:effective==='off'?'disabled':'enabled',
    ...(effective==='auto'?{}:{effort:effective==='off'?'none':effective}),
    maxOutputTokens:verified?Math.min(budget,capacity.maxOutputTokens,Math.floor(capacity.contextWindow/2)):4096,
    ...(reason?{reason}:{})};
}

/** The final provider payload is authoritative, including tool and compaction calls. */
export function applyThinkingPayload(payload:unknown, decision:ThinkingDecision):unknown {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('configuration');
  const value={...payload,thinking:{type:decision.thinkingType},max_tokens:decision.maxOutputTokens} as Record<string,unknown>;
  delete value.reasoning_effort;
  if(decision.effort)value.reasoning_effort=decision.effort;
  return value;
}

export const ANSWER_QUALITY_PROMPT = `回答先满足教师当前问题，先给有用结论，再按需要解释；能合理假设的事项标明假设，不反复澄清。
复杂教学任务先核对条件、单位、适用范围和反例，区分已知事实、推导与建议；数学结果用代回/另一种方法核对，不能把自报信心当正确性。
明确字数、数量和格式属于硬要求；控制总篇幅并预留余量，答完当前问题即可，不自行增加整段教学建议或扩展知识。深入预算用于核对，不要求写得更长。
类比必须在学科概念允许的范围内；不要把抽象符号直接解释成现实物理对象。额外常数、量级和推广条件未经核验则省略，不用貌似精确的补充削弱已知结论。
条件不足时给出能确定的范围和缺失条件，不把合理猜测当作符合题意的标准答案；新增建议也必须遵守原条件。完成后核对答案每部分是否直接服务本次要求。
指定多份资料时明确实际覆盖的范围、冲突与缺失；检索片段是线索，关键结论优先实读。只引用本轮工具登记的依据，不把摘要、记忆、计划或读取记录当答案已经验证。
教师本轮明确要求优先于历史呈现偏好；历史偏好只调整表达，不改变事实、来源、权限和确认。
工具描述中的领域操作规则与公共规则共同适用；发现工具只加载说明，不执行任务、不增加授权。普通问答不为使用工具而调用工具。`;

export const TASK_SUMMARY_INSTRUCTIONS = '用简体中文按【当前目标】【明确约束】【授权来源及版本】【已完成及可核验回执】【未完成/失败/冲突】【下一步】压缩；保留教师最新要求、必要公式与条件。摘要不是原始证据、权限或教师确认；恢复后必要来源重新实读，已完成写入不得重放。不把学生隐私或临时资料写成长期偏好。';
