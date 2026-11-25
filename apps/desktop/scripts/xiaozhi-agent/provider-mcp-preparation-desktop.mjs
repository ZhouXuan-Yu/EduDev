import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';

export async function verifyMcpPreparationIsolation({page, app, source, independent, first, report, data, call, success}) {
  let releaseLate;
  try {
    const query = '合成弹簧测力计';
    const events = report.timeline = [];
    const mark = name => events.push({name, at: performance.now()});
    const occurred = name => events.some(event => event.name === name);
    async function until(action, name) {
      const end = performance.now() + 30_000;
      do {
        const value = await action();
        if (value) return value;
        await delay(25);
      } while (performance.now() < end);
      throw Error('Missing actual desktop event: ' + name);
    }
    const session = async title => (await call(page, 'createAiConversationSession', {title, folderId: null})).session.id;
    const fault = await session('原 MCP 会话'), local = await session('独立教师会话');
    assert.notEqual(fault, local);
    const makeQuestion = stem => ({subject: '物理', grade: '初二', knowledgePoint: '力', questionType: '解答题', difficulty: 'medium',
      stem, answer: '先校零', analysis: '测量前检查指针读数。', sourceTitle: '自动验收合成题', tags: []});
    const seeded = await call(page, 'createQuestionBankItem', makeQuestion(query + '如何校零？'));
    await app.evaluate(({net}, query) => {
      const calls = globalThis.mcpIsolationRequests = [];
      net.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin !== 'https://api.deepseek.com') throw Error('Fixture rejects external destinations');
        if (url.pathname === '/v1/models') return new Response(JSON.stringify({object:'list', data:[{id:'deepseek-flash', context_window:1048576,
          max_output_tokens:32768, input_modalities:['text']}]}), {headers:{'content-type':'application/json'}});
        if (url.pathname !== '/v1/chat/completions') throw Error('Unknown fixture model path');
        const body = JSON.parse(init.body);
        const local = JSON.stringify(body.messages).includes('ISO-LOCAL-701');
        const lastTool = body.messages.filter(message => message.role === 'tool').at(-1);
        const search = local && !lastTool;
        if (calls.length > 8) throw Error('Unexpected synthetic request count');
        calls.push({local, search, lastTool: lastTool?.content});
        const id = 'iso_' + calls.length;
        const delta = search ? {role:'assistant', tool_calls:[{index:0,id,type:'function',function:{name:'education_search_questions',
          arguments: JSON.stringify({query, subject:'物理', limit:3})}}]} : {role:'assistant', content:'以本地处理结果为准。'};
        const chunk = (value, reason) => 'data: ' + JSON.stringify({id, object:'chat.completion.chunk', created:1, model:body.model,
          choices:[{index:0, delta:value, finish_reason:reason}]}) + '\n\n';
        return new Response(chunk(delta,null) + chunk({},search?'tool_calls':'stop') + 'data: [DONE]\n\n', {headers:{'content-type':'text/event-stream'}});
      };
    }, query);
    // Hold a single actual connection. The replacement connection can stay healthy.
    source.state.beforeReply = async (request, reply, response) => {
      if (request.method !== 'initialize' || occurred('old-transport-started')) return;
      mark('old-transport-started');
      response.once('close', () => mark('old-transport-closed'));
      await new Promise(resolve => {releaseLate = resolve;});
      mark('old-reply-released');
      return reply;
    };
    independent.state.beforeReply = request => {if (request.method === 'tools/list') mark('independent-schema-replied');};
    async function start(id, prompt) {
      const value = await call(page, 'startXiaozhi', {sessionId:id, commandId:'xicmd_'+randomUUID(), prompt});
      assert(value.ok, JSON.stringify(value));
      return value.runId;
    }
    const oldRun = await start(fault, 'ISO-FAULT-701 查询并总结合成课程，不要使用教师资料。');
    await until(() => occurred('old-transport-started'), 'real held HTTP connection');
    const localRun = await start(local, 'ISO-LOCAL-701 请查题，找出' + query + '。');
    async function turn(id, runId) {
      const view = await call(page, 'getXiaozhiSnapshot', id);
      return !view.running && view.projection.turns.find(item => item.id === runId && item.status !== 'running');
    }
    report.localTurn = await until(() => turn(local, localRun), 'independent Pi question search');
    mark('independent-search-succeeded');
    const saved = await call(page, 'createQuestionBankItem', makeQuestion('隔离期间保存：弹簧测力计校零。'));
    mark('independent-question-saved');
    assert(occurred('independent-schema-replied'));
    report.modelRequests = await app.evaluate(() => globalThis.mcpIsolationRequests);
    const returned = report.modelRequests.find(call => call.local && call.lastTool)?.lastTool;
    assert.match(JSON.stringify(returned), /合成弹簧测力计/u);
    assert(!occurred('old-transport-closed'), 'Another teacher must search and save before the original connection closes');
    const db = new DatabaseSync(path.join(data,'app.db'), {readOnly:true});
    try {
      const stored = db.prepare('SELECT id,stem FROM question_bank_items WHERE id=?');
      assert.equal(stored.get(seeded.id).stem, seeded.stem);
      assert.equal(stored.get(saved.id).stem, saved.stem);
      report.saved = stored.get(saved.id);
    } finally {db.close();}
    report.checks.push('Actual Electron, typed IPC and Pi search plus a local save finish during another session’s real hung MCP connection');

    await until(() => occurred('old-transport-closed'), 'actual transport close');
    report.oldTurn = await until(() => turn(fault, oldRun), 'original end after deadline');
    const original = success(await call(page,'getXiaozhiMcpCatalog')).servers.find(item => item.id === first.id);
    assert.equal(original.trustedSchemaHash, first.trustedSchemaHash);
    releaseLate();
    releaseLate = undefined;
    await until(() => occurred('old-reply-released'), 'release obsolete response bytes');
    const after = success(await call(page,'getXiaozhiMcpCatalog')).servers.find(item => item.id === first.id);
    assert.deepEqual(after, original);
    assert.equal(source.state.calls, 0);
    assert.equal(independent.state.calls, 0);
    report.checks.push('Real TCP close ends the original transport. A late reply leaves the verified selection and the other operation untouched');
  } finally {
    releaseLate?.();
  }
}
