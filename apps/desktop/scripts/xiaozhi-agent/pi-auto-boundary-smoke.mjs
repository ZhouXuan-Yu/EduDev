import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseDeepSeekCapabilities, readDeepSeekCapabilities, resolveDeepSeekCapabilities } from '../../src/main/xiaozhi-agent/model-capabilities.ts';
import { installMidRunCompaction, computeCompactionReserveTokens } from '../../src/main/xiaozhi-agent/vendor/hana/core/session-compaction-runtime.ts';
import { estimateFullRequest, loadNativeCompaction, prepareSafeNativeCompaction } from '../../src/main/xiaozhi-agent/native-compaction.ts';
import { applyXiaozhiEvent } from '../../src/shared/xiaozhi-projection.ts';
const root = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-auto-boundary-'));
const checks = [], check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); };
const raw = { object: 'list', data: [{ id: 'deepseek-flash', name: 'Flash', context_window: 1048576, max_output_tokens: 393216, privateCredential: 'must-drop' }] };
const old = new Date(Date.now() - 48 * 3600000).toISOString();
const file = path.join(root, 'deepseek-capabilities.v1.json');
const save = value => fs.writeFileSync(file, JSON.stringify(value));
const official = parseDeepSeekCapabilities(raw, old); save(official);
const originalFetch = globalThis.fetch;
try {
  await check('Official catalogue validates capacity/IDs and projects only safe fields', () => { assert(!JSON.stringify(official).includes('must-drop')); for (const data of [[], [...raw.data, raw.data[0]], [{ ...raw.data[0], context_window: -1 }], [{ ...raw.data[0], max_output_tokens: Infinity }]]) assert.throws(() => parseDeepSeekCapabilities({ object: 'list', data }, old)); });
  await check('Versioned same-model stale cache survives metadata transport failure', async () => { globalThis.fetch = async () => { throw new Error('offline'); }; const result = await resolveDeepSeekCapabilities(root, 'deepseek-flash', 'fake-test-key'); assert(result.stale); assert.equal(result.source, 'cache'); assert.equal(await resolveDeepSeekCapabilities(root, 'other-model', 'fake-test-key'), undefined); });
  await check('Successful official list removing target rejects and persists removal', async () => { globalThis.fetch = async () => new Response(JSON.stringify({ ...raw, data: [{ ...raw.data[0], id: 'other-model' }] })); await assert.rejects(resolveDeepSeekCapabilities(root, 'deepseek-flash', 'fake-test-key'), /configuration/); assert.equal(await readDeepSeekCapabilities(root, 'deepseek-flash'), undefined); });
  await check('Oversized/redirected or malformed metadata cannot replace valid cache', async () => { save(official); globalThis.fetch = async () => new Response('x'.repeat(65537)); assert((await resolveDeepSeekCapabilities(root, 'deepseek-flash', 'fake-test-key')).stale); assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(official)); });
  await check('Unknown future cache and cancelled fetch never provide fabricated capability', async () => { save({ ...official, version: 2 }); assert.equal(await readDeepSeekCapabilities(root, 'deepseek-flash'), undefined); globalThis.fetch = async () => { throw new Error('cancelled'); }; const controller = new AbortController(); controller.abort(); await assert.rejects(resolveDeepSeekCapabilities(root, 'deepseek-flash', 'fake-test-key', controller.signal), /cancelled/); });
  await check('Complete request estimate includes Unicode, reasoning, system prompt, tools and output', () => { const basic = { systemPrompt: '教师', messages: [{ role: 'user', content: '资料' }] }; const expanded = { ...basic, tools: [{ parameters: { text: 'x'.repeat(500) } }], messages: [...basic.messages, { role: 'assistant', content: [{ type: 'thinking', thinking: 'x'.repeat(1000) }] }] }; assert(estimateFullRequest(expanded, 4096) > estimateFullRequest(basic, 4096) + 1400); assert.equal(computeCompactionReserveTokens(1048576), 104858); });
  await check('Hana wrapper preserves prior SDK context/model hook and adopts native compacted history', async () => { let observed; const session = { agent: { state: { messages: ['new-native-context'] }, prepareNextTurnWithContext: async () => ({ model: 'fixed-model', context: { systemPrompt: 'actual-updated-prompt', tools: ['actual-tool'], messages: ['old'] } }) } }; installMidRunCompaction(session, { runCompaction: async (_session, { turn }) => { observed = turn; return true; } }); const result = await session.agent.prepareNextTurnWithContext({ context: { systemPrompt: 'stale' } }); assert.equal(observed.context.systemPrompt, 'actual-updated-prompt'); assert.equal(result.model, 'fixed-model'); assert.deepEqual(result.context.messages, ['new-native-context']); assert.deepEqual(result.context.tools, ['actual-tool']); });
  await check('Compaction failure propagates instead of continuing over unsafe history', async () => { const session = { agent: { state: { messages: [] } } }; installMidRunCompaction(session, { runCompaction: async () => { throw new Error('context_limit'); } }); await assert.rejects(session.agent.prepareNextTurnWithContext({ context: {} }), /context_limit/); });
  await check('Fixed native 1.0.2 preparation deep adapter loads through actual ESM export', async () => assert.equal(typeof (await loadNativeCompaction()).prepareCompaction, 'function'));
  await check('Latest large tool-result batch keeps matching call and selects a real native cut', async () => {
    const entries = [
      { id: 'user', type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'read first then second' }] } },
      { id: 'call-first', type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'first', name: 'read', arguments: {} }] } },
      { id: 'result-first', type: 'message', message: { role: 'toolResult', toolCallId: 'first', toolName: 'read', content: [{ type: 'text', text: 'a'.repeat(12000) }] } },
      { id: 'call-second', type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'second', name: 'read', arguments: {} }] } },
      { id: 'result-second', type: 'message', message: { role: 'toolResult', toolCallId: 'second', toolName: 'read', content: [{ type: 'text', text: 'b'.repeat(12000) }] } },
    ];
    // Pi1's preparation follows the canonical parent chain, as real JSONL does.
    for(let n=0;n<entries.length;n++)entries[n].parentId=n?entries[n-1].id:null;
    const settings = { enabled: true, keepRecentTokens: 2048, reserveTokens: 4096 };
    const nativePrepared=(await loadNativeCompaction()).prepareCompaction(entries, settings);assert(nativePrepared);
    const prepared = await prepareSafeNativeCompaction(entries, settings);
    assert.equal(prepared.firstKeptEntryId,nativePrepared.firstKeptEntryId);assert.equal(prepared.firstKeptEntryId, 'call-second'); assert(prepared.isSplitTurn);
    assert(prepared.turnPrefixMessages.some(message => message.role === 'toolResult' && message.toolCallId === 'first'));
  });
  await check('Distinct automatic compactions preserve multiple cards and failure truth in one run', () => { let turn = { id: 'run', status: 'running', items: [] }; for (const event of [{ id: 1, state: 'running' }, { id: 1, state: 'completed' }, { id: 2, state: 'running' }, { id: 2, state: 'failed', error: 'compaction_failed' }]) turn = applyXiaozhiEvent(turn, { ...event, kind: 'compaction', automatic: true, sessionId: 'test', runId: 'run', sequence: 1 }); assert.equal(turn.items.length, 2); assert.equal(turn.items[0].status, 'completed'); assert.equal(turn.items[1].status, 'failed'); });
} finally { globalThis.fetch = originalFetch; }
const report = { success: true, suite: 'pi-auto-boundaries', checks, boundaries: ['Unit boundary responses are deterministic, not live provider evidence'] };
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(process.cwd(), path.join(root, 'report.json')) }));
