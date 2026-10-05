import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getPiProtectedContext } from '../../src/main/xiaozhi-agent/compaction-context.ts';
import { resolveCreationPromptIdentity } from '../../src/main/xiaozhi-agent/creation-prompt-identity.ts';

const calls = [], approvals = Array.from({ length: 30 }, (_, n) => ({ source: `资料${n}-${'a'.repeat(470)}.md`, target: `草稿${n}-${'b'.repeat(470)}.md`, state: 'rejected', sourceSha256: String(n).padStart(64, '0') }));
const plans = Array.from({ length: 15 }, (_, n) => ({ kind: 'plan', steps: Array.from({ length: 12 }, () => ({ text: `步骤${n}${'c'.repeat(240)}`, status: 'pending' })) }));
const titles = Array.from({ length: 25 }, (_, n) => ({ title: `来源${n}-${'d'.repeat(220)}` }));
let sanitizedInput = '';
const store = {
  xiaozhiState: { controls: async id => { calls.push(id); return plans; }, approvals: async id => { calls.push(id); return approvals; } },
  getAiConversationSession: async id => { calls.push(id); return { messages: [{ metadata: { piVersion: 'xiaozhi.pi.education.v1', publicItems: [{ kind: 'tool', sources: titles }] } }] }; },
  sanitizeProblemText: async text => { sanitizedInput = text; return { sanitizedText: text.replaceAll('来源24', '脱敏标题') }; },
};
const context = await getPiProtectedContext(store, 'own-session');
assert(calls.every(id => id === 'own-session')); assert(sanitizedInput.length <= 12000);
const selected = context.split('\n').filter(line => line.startsWith('文件审批：')).map(line => JSON.parse(line.slice('文件审批：'.length)));
assert.equal(selected[0].sourceSha256, approvals.at(-1).sourceSha256); assert(selected.every(item => item.sourceSha256.length === 64 && item.state === 'rejected'));
const omitted = context.match(/省略记录：计划(\d+)，审批(\d+)，修改(\d+)，产物(\d+)，来源(\d+)/); assert(omitted);
assert.equal(Number(omitted[2]), approvals.length - selected.length);
assert.equal(Number(omitted[1]), plans.length - context.split('\n').filter(line => line.startsWith('计划：')).length);
assert.equal(Number(omitted[3]), 0); assert.equal(Number(omitted[4]), 0);
assert.equal(Number(omitted[5]), titles.length - context.split('\n').filter(line => line.startsWith('已检索来源标题：')).length);
assert(!context.includes('来源24')); assert(context.includes('非新增授权')); assert(context.includes('旧写入不可自动重放'));
const report = { suite: 'pi-compaction-context-boundary', success: true, checks: [
  { name: 'Only requested conversation is read and fresh education sanitizer receives bounded input', pass: true },
  { name: 'Newest authority has full hash and complete JSON, omitted records counted precisely', pass: true },
  { name: 'Sanitized result and explicit non-authorizing provenance are retained', pass: true },
] };
const identityOptions = { provider: 'xiaozhi_deepseek', model: 'deepseek-flash', workspace: 'D:\\teacher\\authorized',
  tools: ['office_read_text', 'office_file_stat', 'office_list_files', 'office_copy_file', 'search_teacher_knowledge'],
  basePrompt: '教育基本规则', copyAllowed: true, restoring: false, snapshot: undefined };
const hashPrompt = (prompt, options = identityOptions) => createHash('sha256').update(JSON.stringify({provider:options.provider,model:options.model,workspace:options.workspace,tools:options.tools,prompt})).digest('hex');
const current = resolveCreationPromptIdentity(identityOptions);
assert.equal(current.identityPrompt,current.effectivePrompt);assert.equal(current.fingerprint,hashPrompt(current.effectivePrompt));
const original = identityOptions.basePrompt + '\n本会话已授权当前工作目录；文件路径使用相对路径。复制通过 office_copy_file 请求一次确认，教师拒绝或取消后不要重复请求同一操作。未确认不要宣称完成。';
const snapshot = {fingerprint:hashPrompt(original)}, restore = {...identityOptions,restoring:true,snapshot};
const legacy = resolveCreationPromptIdentity(restore);
assert.equal(legacy.identityPrompt,original);assert.equal(legacy.fingerprint,snapshot.fingerprint);
assert.equal(legacy.effectivePrompt,current.effectivePrompt);assert(legacy.effectivePrompt.includes('旧批准不复用'));
assert.deepEqual(snapshot,{fingerprint:hashPrompt(original)});
report.checks.push({name:'Exact original creation identity restores without rewriting it; effective copy rules remain current',pass:true});
assert.equal(resolveCreationPromptIdentity({...restore,snapshot:{fingerprint:current.fingerprint}}).identityPrompt,current.effectivePrompt);
for(const changed of [{model:'other-model'},{workspace:'D:\\other-authority'},{tools:identityOptions.tools.slice(0,4)},{provider:'other-provider'},
  {copyAllowed:false},{basePrompt:'changed rules'},{snapshot:{...snapshot,extra:true}},{snapshot:{fingerprint:'0'.repeat(64)}},{snapshot:undefined}]){
  assert.throws(()=>resolveCreationPromptIdentity({...restore,...changed}),/configuration/);
}
report.checks.push({name:'Unknown or altered provider/model/workspace/tools/base rules and extra snapshot fields still fail closed',pass:true});
const privateOptions={...identityOptions,copyAllowed:false,tools:identityOptions.tools.filter(n=>n!=='office_copy_file')};
const privateIdentity=resolveCreationPromptIdentity(privateOptions);
assert.equal(privateIdentity.effectivePrompt,privateOptions.basePrompt);
assert.equal(resolveCreationPromptIdentity({...privateOptions,restoring:true,snapshot:{fingerprint:privateIdentity.fingerprint}}).identityPrompt,privateOptions.basePrompt);
assert.equal(resolveCreationPromptIdentity({...identityOptions,snapshot}).fingerprint,current.fingerprint);
report.checks.push({name:'Private sessions remain exact and new sessions always use current creation identity',pass:true});
fs.writeFileSync('test-results/xiaozhi-agent/pi-compaction-context-boundary.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
