import { createHash } from 'node:crypto';

const CURRENT_COPY_RULE = '\n本会话已授权当前工作目录；文件路径使用相对路径。复制通过 office_copy_file 请求一次确认，教师拒绝或取消后本轮不得自动重复请求同一操作。教师后续重新发起任务须新审阅、新确认，旧批准不复用。未确认不要宣称完成。';
// Exact historical source rule, retained only for creation identity validation.
// It never becomes the effective model instruction or a workspace grant.
const ORIGINAL_COPY_RULE = '\n本会话已授权当前工作目录；文件路径使用相对路径。复制通过 office_copy_file 请求一次确认，教师拒绝或取消后不要重复请求同一操作。未确认不要宣称完成。';
const TASK_CONTROL_RULE='\n必要歧义用 ask_teacher 提问并等待回答，已有明确要求不要反复确认。计划完成不能代替文件交付的实际结果。教师追加指令沿当前任务继续，所有权限和确认规则保持。';
const ORIGINAL_CONTROL_RULE='\n复杂任务先用 update_plan 公布简短步骤；执行中更新真实进度。必要歧义用 ask_teacher 提问并等待回答，已有明确要求不要反复确认。计划完成不能代替文件交付的实际结果。教师追加指令沿当前任务继续，所有权限和确认规则保持。';

/** Manual compaction has no live task runtime. Restore the exact known creation
 * style instead of treating its absence as a change to persisted authority. */
export function resolveControlPromptIdentity(options:{base:string;tools:readonly string[];prompt:string;hasControls:boolean;taskRuntime:boolean;snapshot?:unknown}){
  const preferred=options.hasControls?(options.taskRuntime?TASK_CONTROL_RULE:ORIGINAL_CONTROL_RULE):'';
  const candidates=[preferred,...(options.hasControls?[TASK_CONTROL_RULE,ORIGINAL_CONTROL_RULE]:[])];
  for(const suffix of new Set(candidates)){
    const prompt=options.prompt+suffix;
    const fingerprint=createHash('sha256').update(JSON.stringify({fingerprint:options.base,tools:options.tools,prompt})).digest('hex');
    if(options.snapshot===undefined||JSON.stringify(options.snapshot)===JSON.stringify({fingerprint}))return{prompt,fingerprint};
  }
  throw Error('configuration');
}

export function resolveCreationPromptIdentity(options: {
  provider: string; model: string; workspace: string; tools: string[];
  basePrompt: string; copyAllowed: boolean; restoring: boolean; snapshot: unknown;
}) {
  const effectivePrompt = options.basePrompt + (options.copyAllowed ? CURRENT_COPY_RULE : '');
  const fingerprintFor = (prompt: string) => createHash('sha256').update(JSON.stringify({
    provider: options.provider, model: options.model, workspace: options.workspace,
    tools: options.tools, prompt,
  })).digest('hex');
  const candidates = [effectivePrompt, ...(options.copyAllowed ? [options.basePrompt + ORIGINAL_COPY_RULE] : [])];
  for (const identityPrompt of candidates) {
    const fingerprint = fingerprintFor(identityPrompt);
    if (!options.restoring || JSON.stringify(options.snapshot) === JSON.stringify({ fingerprint })) {
      return { fingerprint, identityPrompt, effectivePrompt };
    }
  }
  throw new Error('configuration');
}
