import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';

export async function resumeInDesktop({build, output, externalRoot, seedPid}) {
  assert(path.isAbsolute(build) && path.isAbsolute(output) && path.isAbsolute(externalRoot));
  const identity = JSON.parse(await fs.readFile(path.join(output, 'cold-identity.json'), 'utf8'));
  const main = await fs.realpath(path.join(build, 'main/index.js'));
  const profile = path.join(externalRoot, 'profile');
  const data = path.join(externalRoot, 'data');
  const database = path.join(data, 'app.db');
  const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const report = {success: false, database, profile, main, mainHash: await hash(main),
    rendererHash: await hash(path.join(build, 'renderer/index.html')), seedPid, coldPid: null,
    paidCalls: 0, requests: [], checks: []};
  assert.equal(identity.pid, seedPid);
  function readRows(taskId, capabilityId) {
    const db = new DatabaseSync(database, {readOnly: true});
    try {
      return db.prepare('SELECT snapshot_json,snapshot_hash FROM xiaozhi_capability_snapshots_v1 WHERE task_id=? ORDER BY rowid')
        .all(taskId).map(row => ({value: JSON.parse(row.snapshot_json), hash: row.snapshot_hash}))
        .filter(row => row.value.capabilityId === capabilityId);
    } finally { db.close(); }
  }
  let app, fixtureError, toolReceipt;
  const fixture = http.createServer(async (request, response) => {
    try {
      if (request.url === '/v1/models') {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,
          max_output_tokens:32768,input_modalities:['text']}]}));
        return;
      }
      assert.equal(request.url, '/v1/chat/completions');
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.equal(body.model, 'deepseek-flash');
      const call = report.requests.length;
      const id = 'fixture_' + randomUUID().replaceAll('-', '');
      report.requests.push({model: body.model, at: new Date().toISOString(), call});
      let delta;
      if (call === 0) {
        assert(body.tools.some(item => item.function.name === 'capability_execute'));
        report.toolCallId = id;
        delta = {role:'assistant', tool_calls:[{index:0,id,type:'function',
          function:{name:'capability_execute',arguments:JSON.stringify({requirement:{capabilityId:identity.previous.capabilityId,
            contractVersion:identity.previous.requirement.contractVersion,required:[],optional:[],conditions:[]},input:{path:'资料.txt'}})}}]};
      } else {
        assert.equal(call, 1);
        const match = body.messages.findLast(item => item.role === 'tool' && item.tool_call_id === report.toolCallId);
        assert(match);
        assert.equal(typeof match.content,'string');
        toolReceipt = JSON.parse(match.content.split('\n')[0]);
        assert.equal(toolReceipt.providerId, identity.previous.selection.providerId);
        assert.equal(toolReceipt.provenance.providerHash, identity.previous.providerHash);
        assert.deepEqual(toolReceipt.data, identity.result.data);
        delta = {role:'assistant', content:'已在原任务中读取同一文件的元信息。'};
      }
      const sse = (value, reason) => 'data: ' + JSON.stringify({id,object:'chat.completion.chunk',created:1,
        model:body.model,choices:[{index:0,delta:value,finish_reason:reason}]}) + '\n\n';
      response.writeHead(200, {'content-type':'text/event-stream'});
      response.end(sse(delta,null) + sse({},call===0?'tool_calls':'stop') + 'data: [DONE]\n\n');
    } catch (error) {
      fixtureError ??= error;
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  const before = readRows(identity.taskId, identity.previous.capabilityId);
  assert.equal(before.length, 1);
  assert.deepEqual(before[0].value, identity.previous);
  try {
    await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
    Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_REPO_ROOT:path.resolve(import.meta.dirname,'../../../..'),
      OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'synthetic-phase2-loopback',
      DEEPSEEK_MODEL:'deepseek-flash',TEMP:externalRoot,TMP:externalRoot});
    app = await electron.launch({args:[main,'--user-data-dir='+profile],env,timeout:60_000});
    report.coldPid = app.process().pid;
    assert.notEqual(report.coldPid, seedPid);
    await app.evaluate(({net}, endpoint) => {
      net.fetch = (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin !== 'https://api.deepseek.com') throw Error('Owned fixture rejects other destinations');
        return fetch(endpoint + url.pathname + url.search, init);
      };
    }, 'http://127.0.0.1:' + fixture.address().port);
    const page = await app.firstWindow();
    await page.getByTestId('office-prompt-input').waitFor();
    const state = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), identity.sessionId);
    const old = await state();
    assert(old.projection.turns.some(item => item.id === identity.runId && item.status === 'interrupted'));
    assert(!old.running);
    assert.equal(report.requests.length,0);
    const started = await page.evaluate(input=>window.omniEdu.startXiaozhi(input), {
      sessionId:identity.sessionId,prompt:'继续',commandId:'xicmd_'+randomUUID(),
      continueTask:{taskId:identity.taskId,requirementsVersion:identity.requirementsVersion}
    });
    assert(started.ok, JSON.stringify(started));
    const deadline = performance.now() + 60_000;
    let turn;
    do {
      if (fixtureError) throw fixtureError;
      const current = await state();
      turn = current.projection.turns.find(item => item.id === started.runId);
      if (turn && !current.running && turn.status !== 'running') break;
      await delay(40);
    } while (performance.now() < deadline);
    assert.equal(turn?.status,'completed',JSON.stringify(turn));
    assert.equal(report.requests.length,2);
    assert(toolReceipt);
    assert.notEqual(started.runId, identity.runId);
    await app.close();
    app = undefined;
    const rows = readRows(identity.taskId, identity.previous.capabilityId);
    assert.equal(rows.length,2);
    assert.deepEqual(rows[0],before[0]);
    const resumed = rows[1].value;
    assert.equal(resumed.taskId,identity.taskId);
    assert.equal(resumed.runId,started.runId);
    assert.equal(resumed.previousSnapshotId,identity.previous.snapshotId);
    assert.equal(resumed.refreshReason,'resume_revalidate');
    assert.deepEqual(resumed.selection,identity.previous.selection);
    assert.equal(resumed.providerHash,identity.previous.providerHash);
    assert.equal(toolReceipt.snapshotId,resumed.snapshotId);
    report.checks.push({pass:true,name:'Formal desktop restores the interrupted turn and continues with the old Provider via typed Preload'});
    Object.assign(report,{rows,toolReceipt,seed:identity,runId:started.runId,success:true});
  } catch (error) {
    report.error = String(error.stack ?? error);
  } finally {
    await app?.close().catch(()=>{});
    fixture.closeAllConnections();
    await new Promise(resolve => fixture.close(resolve));
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  }
  return report;
}
