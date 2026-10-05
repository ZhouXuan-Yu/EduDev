import { createHash } from 'node:crypto';

const CURRENT_COPY_RULE = '\n本会话已授权当前工作目录；文件路径使用相对路径。复制通过 office_copy_file 请求一次确认，教师拒绝或取消后本轮不得自动重复请求同一操作。教师后续重新发起任务须新审阅、新确认，旧批准不复用。未确认不要宣称完成。';
// Exact historical source rule, retained only for creation identity validation.
// It never becomes the effective model instruction or a workspace grant.
const ORIGINAL_COPY_RULE = '\n本会话已授权当前工作目录；文件路径使用相对路径。复制通过 office_copy_file 请求一次确认，教师拒绝或取消后不要重复请求同一操作。未确认不要宣称完成。';

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
