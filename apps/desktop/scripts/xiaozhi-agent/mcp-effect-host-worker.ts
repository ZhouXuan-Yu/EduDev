import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { net } from 'electron';
import { OmniEduStore } from '../../src/main/db';
import { createXiaozhiProductionHost } from '../../src/main/xiaozhi-agent/production-host';
import { mcpToolName } from '../../src/main/xiaozhi-agent/mcp-runtime';
import { startMcpFixture } from './fixtures/mcp-server.mjs';

const output = process.argv[2];
const dataRoot = path.join(output, 'data');
const workspace = path.join(output, 'workspace');
fs.mkdirSync(workspace);
process.env.DEEPSEEK_API_KEY = 'synthetic-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let phase = 'pending';
let index = 0;
let toolName = '';
let sessionId = '';
let holdBegin = false;
let beginReached = false;
let releaseBegin = () => {};
const fixture = await startMcpFixture();
const requests: {phase: string; body: unknown}[] = [];
const checks: {name: string; pass: boolean}[] = [];
const report: any = { success: false, output, checks, paidCalls: 0, fixture: fixture.url };

function makeHost() {
    const journal = store.xiaozhiState.eventJournal;
    const originalBegin = journal.beginToolEffect;
    // Delegate-only pause after the real SQLite COMMIT. No state/result is
    // synthesized: stop/revoke must invalidate the original authority at resume.
    journal.beginToolEffect = async (...args) => {
        const at = Date.now();
        await originalBegin(...args);
        if (args[2]) {
            (report.dispatchCommits ??= []).push({ at, elapsedMs: Date.now() - at, owner: args[0], callId: args[1] });
            if (holdBegin) {
                beginReached = true;
                await new Promise<void>(resolve => releaseBegin = resolve);
            }
        }
    };
    return createXiaozhiProductionHost({ store, dataRoot, enabled: true, emit() { } });
}

async function until(condition: () => boolean) {
    const end = Date.now() + 30000;
    while (Date.now() < end) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error('owned_fixture_timeout');
}
const model = http.createServer(async (req, res) => {
    try {
        if (req.url === '/v1/models') {
            res.end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text'] }] }));
            return;
        }
        let raw = '';
        for await (const chunk of req)
            raw += chunk;
        const body = JSON.parse(raw);
        requests.push({ phase, body });
        const n = index++;
        let tool: {name: string; input: Record<string, unknown>} | undefined;
        if (n === 0) {
            tool = { name: 'find_education_tools', input: { query: '合成课程连接 查询公开课程', limit: 5 } };
        } else if (n === 1) {
            const topics: Record<string, string> = {drop: '合成断线课程', drop_retry: '合成断线课程', cancel: '合成停止课程', revoke: '合成撤销课程'};
            tool = { name: toolName, input: { topic: topics[phase] ?? '合成公开课程' } };
        }
        const base = { id: 'owned-mcp-effect', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash' };
        const chunk = (delta: Record<string, unknown>, finish_reason: string | null = null) =>
            'data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] }) + '\n\n';
        const message = tool
            ? { role: 'assistant', tool_calls: [{
                index: 0, id: 'c2_' + phase + '_' + n, type: 'function',
                function: { name: tool.name, arguments: JSON.stringify(tool.input) }
            }] }
            : { role: 'assistant', content: '请核对合成课程的真实回执。' };
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(chunk(message) + chunk({}, tool ? 'tool_calls' : 'stop') + 'data: [DONE]\n\n');
    }
    catch (error) {
        report.error = String((error as Error).stack);
        res.writeHead(500).end();
    }
});
const original = net.fetch;
const receipts = async (runId: string) => store.xiaozhiState.sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND tool=?', [runId, toolName]);
async function effect(runId: string) {
    const [row] = await store.xiaozhiState.sql.all(
        "SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND operation='tool' AND json_extract(document_json,'$.tool')=?",
        [runId, toolName]);
    return row ? JSON.parse(String(row.document_json)) : null;
}

async function start(continueTask?: {taskId: string; requirementsVersion: number}) {
    index = 0;
    const result = await host!.start({
        sessionId, commandId: 'xicmd_' + randomUUID(),
        prompt: '请使用合成课程连接查询合成公开课程，按实际回执回答。',
        ...(continueTask ? { continueTask } : {})
    });
    assert(result.ok, JSON.stringify(result));
    await host!.waitForRun(sessionId, result.runId);
    assert(!report.error, report.error);
    return result.runId;
}

async function cold() {
    await host!.close();
    await store.close();
    store = new OmniEduStore(dataRoot);
    await store.init();
    host = makeHost();
}
try {
    await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve));
    const address = model.address() as any;
    net.fetch = async (input, init) => { const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); assert.equal(url.origin, 'https://api.deepseek.com'); return fetch('http://127.0.0.1:' + address.port + url.pathname, init); };
    await store.init();
    host = makeHost();
    await host.skillCatalog();
    let catalog = await host.mcpAdd({ name: '合成课程连接', transport: 'http', url: fixture.url });
    const serverId = catalog.servers[0].id;
    catalog = await host.mcpInspect({ schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId });
    catalog = await host.mcpTrust({ schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId, schemaHash: catalog.servers[0].schemaHash!, tools: ['lookup_lesson'] });
    toolName = mcpToolName(serverId, 'lookup_lesson');
    report.serverId = serverId;
    report.toolName = toolName;
    sessionId = (await store.createAiConversationSession({ title: '合成MCP续跑', folderId: null })).session.id;
    await store.xiaozhiState.setWorkspace(sessionId, workspace, 'Owned teaching source');
    await host.permissions.view(sessionId);
    const first = await start();
    const firstRows = await receipts(first), firstEffect = await effect(first);
    report.first = { runId: first, receipts: firstRows, effect: firstEffect, calls: fixture.state.calls };
    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0].success, 0);
    assert.equal(fixture.state.calls, 0);
    assert.equal(firstEffect?.state, 'failed', 'A denied inner authorization must not become an unknown dispatched external effect');
    assert.equal(firstEffect.execution, null);
    assert.equal(firstEffect.outcome.error, 'not_delivered');
    checks.push({ name: 'Actual pending HTTP tool has a settled failed intent with no dispatch and zero tools/call', pass: true });
    const pending = (await host.permissions.view(sessionId)).approvals.find(row => row.state === 'pending' && row.request.action === 'mcp_call');
    assert(pending);
    report.approvalBefore = pending;
    await host.permissions.decide({ sessionId, approvalId: pending.id, revision: pending.revision, decision: 'approve', scope: 'task' });
    const task = (await host.snapshot(sessionId)).task!;
    assert(task);
    const binding = JSON.parse(String((await store.xiaozhiState.sql.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?', [first]))[0].binding_json)), native = path.join(dataRoot, 'xiaozhi-pi', binding.file), prefix = fs.readFileSync(native);
    report.originalNative = { path: native, bytes: prefix.length, sha256: hash(prefix) };
    await cold();
    assert.equal(fixture.state.calls, 0);
    assert.equal((await effect(first)).state, 'failed');
    const recovered = await host.snapshot(sessionId);
    report.recovered = recovered;
    assert.equal(recovered.task?.id, task.id);
    phase = 'authorized';
    const next = await start({ taskId: task.id, requirementsVersion: task.requirementsVersion });
    const nextRows = await receipts(next);
    assert.equal(fixture.state.calls, 1);
    assert.equal(nextRows.length, 1);
    assert.equal(nextRows[0].success, 1);
    assert(nextRows[0].contract_json);
    assert.notEqual(next, first);
    assert.deepEqual(await effect(first), firstEffect);
    assert(fs.readFileSync(native).subarray(0, prefix.length).equals(prefix));
    report.next = { runId: next, receipts: nextRows, effect: await effect(next), calls: fixture.state.calls };
    checks.push({ name: 'Cold Host resumes the same Task under a fresh Run and exact current authority sends once, preserving original evidence', pass: true });
    phase = 'drop';
    fixture.state.drop = true;
    const dropped = await start({ taskId: task.id, requirementsVersion: task.requirementsVersion });
    assert.equal(fixture.state.calls, 2);
    assert.equal((await effect(dropped)).state, 'unknown');
    const lostRows = await receipts(dropped);
    assert.equal(lostRows[0].success, 0);
    report.dropped = { runId: dropped, receipts: lostRows, effect: await effect(dropped) };
    await cold();
    fixture.state.drop = false;
    phase = 'drop_retry';
    const retried = await start({ taskId: task.id, requirementsVersion: task.requirementsVersion });
    assert.equal(fixture.state.calls, 2);
    const retryRows = await receipts(retried);
    assert.equal(retryRows.length, 1);
    assert.equal(retryRows[0].admitted, 0);
    assert.equal((await effect(dropped)).state, 'unknown');
    assert.equal(await effect(retried), null);
    report.retry = { runId: retried, receipts: retryRows };
    checks.push({ name: 'Sent-then-lost HTTP effect remains unknown after cold read and blocks replay before another tools/call', pass: true });
    for (const action of ['cancel', 'revoke']) {
        phase = action;
        index = 0;
        holdBegin = true;
        beginReached = false;
        const pendingRun = await host!.start({ sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续核对合成课程连接的实际回执。', continueTask: { taskId: task.id, requirementsVersion: task.requirementsVersion } });
        assert(pendingRun.ok, JSON.stringify(pendingRun));
        await until(() => beginReached);
        let stopped: Promise<unknown> | undefined;
        if (action === 'cancel')
            stopped = host!.stop(sessionId);
        else {
            const grant = (await host!.permissions.view(sessionId)).grants.find(row => !row.revokedAt && row.scope.kind === 'mcp' && row.scope.serverId === serverId);
            assert(grant);
            await host!.permissions.revoke({ sessionId, grantId: grant.grantId, revision: grant.revision });
        }
        holdBegin = false;
        releaseBegin();
        await stopped;
        await host!.waitForRun(sessionId, pendingRun.runId);
        assert.equal(fixture.state.calls, 2);
        const fenced = await effect(pendingRun.runId);
        assert.equal(fenced.state, 'unknown');
        assert(fenced.execution);
        (report.lateFences ??= []).push({ action, runId: pendingRun.runId, effect: fenced, receipts: await receipts(pendingRun.runId), calls: fixture.state.calls });
        checks.push({ name: 'Actual ' + action + ' after durable begin fences the original HTTP send and retains conservative unknown', pass: true });
    }
    report.success = true;
}
catch (error) {
    report.error = String((error as Error).stack);
    process.exitCode = 1;
}
finally {
    releaseBegin();
    await host?.close();
    await store.close();
    net.fetch = original;
    model.closeAllConnections();
    await new Promise<void>(resolve => model.close(() => resolve()));
    await fixture.close();
    report.requests = requests;
    report.fixtureState = fixture.state;
    fs.writeFileSync(path.join(output, 'REPORT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ success: report.success, checks: checks.length, output, error: report.error }));
}
