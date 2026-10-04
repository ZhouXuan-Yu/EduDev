import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPiProtectedContext } from '../../src/main/xiaozhi-agent/compaction-context.ts';

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
const omitted = context.match(/省略记录：计划(\d+)，审批(\d+)，来源(\d+)/); assert(omitted);
assert.equal(Number(omitted[2]), approvals.length - selected.length);
assert.equal(Number(omitted[1]), plans.length - context.split('\n').filter(line => line.startsWith('计划：')).length);
assert.equal(Number(omitted[3]), titles.length - context.split('\n').filter(line => line.startsWith('已检索来源标题：')).length);
assert(!context.includes('来源24')); assert(context.includes('非新增授权')); assert(context.includes('旧写入不可自动重放'));
const report = { suite: 'pi-compaction-context-boundary', success: true, checks: [
  { name: 'Only requested conversation is read and fresh education sanitizer receives bounded input', pass: true },
  { name: 'Newest authority has full hash and complete JSON, omitted records counted precisely', pass: true },
  { name: 'Sanitized result and explicit non-authorizing provenance are retained', pass: true },
] };
fs.writeFileSync('test-results/xiaozhi-agent/pi-compaction-context-boundary.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
