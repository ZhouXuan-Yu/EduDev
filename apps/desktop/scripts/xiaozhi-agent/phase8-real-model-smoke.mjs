import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {channel} from 'node:diagnostics_channel';
import {JSDOM} from 'jsdom';
import {openBudgetLedger} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-real-model-protocol-'));
const report = {success: false, output, checks: [], realProviderCalls: 0, actualGoalLedgerOpened: false,
  boundary: 'Node-only protocol and local HTTP fixtures. No Electron, builds, native UI, real credentials or models.'};
const resources = [];
async function check(name, action) {
  try {await action(); report.checks.push({name, pass: true});}
  catch (error) {report.checks.push({name, pass: false, error: error.stack});}
  console.log(JSON.stringify(report.checks.at(-1)));
}
try {
  const {schedule, tasks, syntheticFiles, validateManifest, preparePlan, q5Source, question, sha256} = await import('./phase8-real-model-plan.mjs');
  const {readFrozenQuestionSeed} = await import('./phase8-question-seed.mjs');
  const {installProviderBridge} = await import('./phase8-real-model-transport.mjs');
  const {verifiedRunBinding, collectFiles, exportBlindBundle, readOriginalRecords, q5ContinuationDecision, verifyQ5ApprovalConsumption,readQ5SourceEvidence,q5PermissionScopes} = await import('./phase8-real-model-readback.mjs');
  const {executePlan, rendererObservation, collectScheduledRuns, streamTransportComplete, continueApprovedQ5, bindDispatchAttempts} = await import('./phase8-real-model-run.mjs');
  const {observeQ5WebTiming} = await import('./phase8-web-timing.mjs');
  const {selectCorrectionRows, correctionBudget} = await import('./phase8-correction-plan.mjs');
  const {plannedSyntheticSave} = await import('./phase8-correction-artifacts.mjs');
  await check('Q5 records exact URL timings without storing unrelated requests, headers or credentials', () => {
    const target = new URL(q5Source);
    const matched = {method: 'GET', origin: target.origin, path: target.pathname};
    const unrelated = {...matched, path: target.pathname + '?q=private-canary'};
    const publish = (event, data) => channel('undici:' + event).publish(data);
    const observer = observeQ5WebTiming();
    try {
      publish('request:create', {request: unrelated});
      publish('request:create', {request: matched});
      publish('client:sendHeaders', {request: matched, headers: 'authorization: private-canary'});
      publish('request:headers', {request: matched, response: {statusCode: 200, headers: ['private-canary']}});
      publish('request:trailers', {request: matched, trailers: ['private-canary']});
      const evidence = observer.snapshot();
      assert.equal(evidence.rows.length, 1);
      const row = evidence.rows[0];
      assert.equal(row.status, 200);
      assert(row.createdAt <= row.sendingHeadersAt && row.sendingHeadersAt <= row.headersAt && row.headersAt <= row.responseEndAt);
      assert(!JSON.stringify(evidence).includes('private-canary'));
    } finally {
      observer.dispose();
    }
    publish('request:create', {request: {...matched}});
    assert.equal(observer.snapshot().rows.length, 1);
  });
  await check('Frozen plan has exact Q1-Q8 ABBA order, 32 identities and precise role-submit observation', () => {
    assert.equal(tasks.length, 8); assert.equal(schedule.length, 32);
    for (const task of tasks) assert.deepEqual(schedule.filter(row => row.task === task.id).map(row => row.version), ['A', 'B', 'B', 'A']);
    assert.equal(new Set(schedule.map(row => row.id)).size, 32);
    assert.equal(syntheticFiles['scores.csv'], 'id,score\nA,60\nB,80\nC,100\n');
    assert.throws(() => validateManifest({schemaVersion: 1, databasePath: path.join(output, 'fixture.sqlite')}));
    assert.equal(typeof executePlan, 'function');
    const prepared = preparePlan(path.join(output, 'prepared'));
    assert.equal(prepared.actualGoalLedgerOpened, false); assert.equal(prepared.runs, 32);
    assert.equal(JSON.parse(fs.readFileSync(path.join(prepared.output, 'manifest-template.json'))).versions.B, null);
    const dom = new JSDOM('<button aria-label="发送消息" data-phase8-real-submit="true"><span>发送</span></button><button aria-label="其他操作">其他</button>');
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    try {
      globalThis.window = dom.window; globalThis.document = dom.window.document;
      let publish;
      window.omniEdu = {onXiaozhiEvent: callback => {publish=callback;return () => {};}};
      assert.equal(document.querySelector('[data-testid="office-prompt-send"]'), null);
      rendererObservation('test-session');
      document.querySelector('[aria-label="发送消息"]').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
      document.querySelector('span').dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
      document.querySelector('[aria-label="其他操作"]').click();
      const observed = window.phase8RealObservation.snapshot();
      report.submitObservation = {count: observed.submissions.length, trusted: observed.submissions[0]?.trusted ?? null,
        boundary: 'Actual DOM marker matching in JSDOM. DOM event is untrusted. Actual Electron trusted click remains NOT_TESTED.'};
      assert.equal(observed.submissions.length, 1); assert.equal(observed.submissions[0].trusted, false);
      const observer = window.phase8RealObservation;
      const status = (runId, state, sessionId='test-session') => publish({kind:'status',sessionId,runId,status:state});
      status('unrelated','running','other-session');assert.equal(observer.runSignal(),null);
      status('original','running');assert.deepEqual(observer.runSignal(),{runId:'original',terminal:false});
      status('original','completed');assert.deepEqual(observer.runSignal(),{runId:'original',terminal:true});
      observer.expectContinuation();
      status('original','completed');assert.equal(observer.runSignal('original'),null);
      status('continued','running');assert.deepEqual(observer.runSignal('original'),{runId:'continued',terminal:false});
      status('continued','failed');assert.deepEqual(observer.runSignal('original'),{runId:'continued',terminal:true});
    } finally {
      window.phase8RealObservation?.dispose(); dom.window.close();
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });
  const received = [];
  const upstream = http.createServer(async (request, response) => {
    let bytes = 0; for await (const chunk of request) bytes += chunk.length;
    received.push({path: request.url, bytes, syntheticAuthorization: request.headers.authorization === 'Bearer fixture-value'});
    response.writeHead(request.url === '/fail' ? 503 : 200, {'content-type': 'text/event-stream'});
    response.write('data: {"choices":[{"delta":{"content":"fixture"}}]}\n\n');
    response.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  resources.push(() => new Promise(resolve => {upstream.close(resolve); upstream.closeAllConnections();}));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const ledger = openBudgetLedger({databasePath: path.join(output, 'fixture-only.sqlite'), limit: 4});
  resources.push(() => ledger.close());
  const context = {task: 'Q1', version: 'A', round: 1, evidenceRef: 'fixture/Q1-A-r1'};
  const proxy = await startCountingProxy({ledger, providerEndpoint: origin + '/chat', fixtureHttp: true, context});
  resources.push(() => proxy.close());
  let modelGets = 0, delegated = 0;
  const native = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'api.deepseek.com') {modelGets++; return new Response('{"data":[]}');}
    if (url.hostname !== '127.0.0.1') {delegated++; return new Response('other allowed transport');}
    return fetch(input, init);
  };
  const net = {fetch: native};
  const bridge = installProviderBridge(net, {chatRoutes: {'/v1/chat/completions': proxy.url, '/chat/completions': proxy.url}});
  resources.push(() => bridge.restore());
  const send = endpoint => net.fetch(endpoint, {method: 'POST', redirect: 'error', headers: {authorization: 'Bearer fixture-value'},
    body: JSON.stringify({model: 'fixture-model', stream: true, temperature: 0.2, max_tokens: 100, thinking: {type: 'disabled'}, messages: [{role: 'user', content: 'fixture body excluded from telemetry'}]})});
  await check('Provider-scoped net bridge meters both exact chat paths and records only safe actual-wire fields', async () => {
    const globalFetch = globalThis.fetch;
    for (const suffix of ['/v1/chat/completions', '/chat/completions']) {
      const response = await send('https://api.deepseek.com' + suffix); assert((await response.text()).includes('[DONE]'));
    }
    assert.equal(globalThis.fetch, globalFetch); assert.equal(received.length, 2); assert(received.every(row => row.syntheticAuthorization));
    assert.equal(ledger.summary().used, 2); assert.equal(bridge.snapshot().chats.length, 2);
    const rows = bridge.snapshot().chats;
    assert(rows.every(row => row.configuration.model === 'fixture-model' && row.firstByteAt !== null && row.endAt !== null));
    const safe = JSON.stringify({rows, attempts: ledger.attempts()});
    assert(!safe.includes('fixture-value')); assert(!safe.includes('fixture body excluded from telemetry'));
    assert(!safe.includes('messages')); assert(!safe.includes('authorization'));
  });
  await check('A reader termination after the exact SSE terminal event preserves protocol evidence', async () => {
    const cases = [
      {chunks: ['data: {"content":"' + 'a'.repeat(90), '"}\r\n\r\nda', 'ta: [DO', 'NE]\r\n\r', '\n'], ended: true},
      {chunks: ['data: {"content":"[DONE]"}\n\n', 'data: [DO'], ended: false},
      {chunks: ['data: [DONE]\n', 'data: second field\n\n'], ended: false},
      {chunks: ['data: [DONE]\n'], ended: false},
    ];
    for (const {chunks, ended} of cases) {
      const remaining = [...chunks];
      const testNet = {fetch: async () => new Response(new ReadableStream({
        pull(controller) {
          if (!remaining.length) {controller.error(new DOMException('closed by reader', 'AbortError')); return;}
          controller.enqueue(new TextEncoder().encode(remaining.shift()));
        },
      }), {status: 200, headers: {'content-type': 'text/event-stream; charset=utf-8'}})};
      const testBridge = installProviderBridge(testNet, {chatRoutes: {'/v1/chat/completions': proxy.url, '/chat/completions': proxy.url}});
      try {
        const response = await testNet.fetch('https://api.deepseek.com/chat/completions', {method: 'POST', body: '{}'});
        await assert.rejects(() => response.text(), /phase8_response_stream_failed/);
        const [evidence] = testBridge.snapshot().chats;
        assert.equal(evidence.state, 'stream_failed');
        assert.equal(Number.isFinite(evidence.terminalFrameAt), ended);
        assert.equal(streamTransportComplete(evidence), ended);
      } finally {testBridge.restore();}
    }
    assert.equal(ledger.summary().used, 2);
  });
  await check('Models GET is separately observed and unknown provider routes fail before any upstream reservation', async () => {
    await net.fetch('https://api.deepseek.com/v1/models', {redirect: 'error'});
    await net.fetch('https://example.test/resource', {redirect: 'error'});
    await assert.rejects(() => send('https://api.deepseek.com/v1/unrecognized'));
    await assert.rejects(() => send('https://api.deepseek.com/v1/chat/completions?unexpected=1'));
    assert.equal(modelGets, 1); assert.equal(delegated, 1); assert.equal(ledger.summary().used, 2);
    assert.equal(bridge.snapshot().models.length, 1); assert.equal(bridge.snapshot().rejected.length, 2);
  });
  await check('Subsequent SDK-shaped HTTP attempts each consume allowance and budget rejection occurs before upstream', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {const response = await send('https://api.deepseek.com/v1/chat/completions'); await response.text();}
    assert.equal(received.length, 4); assert.equal(ledger.summary().used, 4);
    assert.equal(bridge.snapshot().chats.at(-1).httpStatus, 429);
    assert.equal(ledger.attempts().length, 4);
  });
  await check('Original SQLite Run identity is required before binding all actual attempts to a runtime Run', () => {
    const dbPath = path.join(output, 'app-fixture.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec("CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT); CREATE TABLE app_settings(key TEXT,value_json TEXT);");
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run('run_fixture', 'session_fixture', 'succeeded', 'fixture-model'); db.close();
    const records = readOriginalRecords(dbPath, 'session_fixture', 'run_fixture');
    const binding = verifiedRunBinding({sessionId: 'session_fixture', runId: 'run_fixture', records,
      snapshot: {projection: {turns: [{id: 'run_fixture'}]}}});
    assert.equal(binding.taskId, null); assert.equal(binding.runId, 'run_fixture');
    assert.throws(() => verifiedRunBinding({...binding, records, snapshot: {projection: {turns: [{id: 'wrong'}]}}}));
    for (const attempt of ledger.attempts()) ledger.bindRun(attempt.reservationId, binding.runId);
    assert(ledger.attempts().every(row => row.context.runId === binding.runId));
  });
  await check('Blind export preserves artifact bytes and keeps version identity in a separate map', () => {
    const artifact = path.join(output, 'synthetic.txt'); fs.writeFileSync(artifact, 'synthetic artifact');
    const result = exportBlindBundle(path.join(output, 'blind'), [{id: 'Q1-r1-A', task: 'Q1', version: 'A', round: 1,
      answer: '合成回答', artifacts: [{path: artifact, relativePath: 'synthetic.txt'}]}]);
    assert.equal(result.samples.length, 1);
    const sample = JSON.parse(fs.readFileSync(path.join(output, 'blind', result.samples[0].id, 'sample.json')));
    assert.equal(sample.task, 'Q1'); assert(!Object.hasOwn(sample, 'version')); assert(!Object.hasOwn(sample, 'runId'));
    assert.equal(fs.readFileSync(path.join(output, 'blind', result.samples[0].id, 'artifacts/synthetic.txt'), 'utf8'), 'synthetic artifact');
  });
  await check('Blind export binds copied artifact bytes and shares only bounded readback facts', () => {
    const workspace = path.join(output, 'blinded-q8-fixture');
    fs.mkdirSync(workspace);
    const artifact = path.join(workspace, 'facts.txt');
    fs.writeFileSync(artifact, 'owned synthetic facts');
    const file = collectFiles(workspace)[0];
    const row = {id: 'Q8-r1-B', task: 'Q8', version: 'B', round: 1, answer: '未复制。', terminal: 'completed',
      binding: {runId: 'unblinded-run', sessionId: 'unblinded-session'}, artifacts: [file, {unsupported: 'symlink', relativePath: 'ignored'}],
      coldRecords: {runs: [{id: 'unblinded-run', session_id: 'unblinded-session', status: 'succeeded', model: 'unblinded-model'}]},
      explicitChecks: {copyAbsent: true, refusalObserved: true}, decisions: [{id: 'unblinded-approval', decision: 'reject'}]};
    const directory = path.join(output, 'blind-observations');
    const result = exportBlindBundle(directory, [row]);
    const raw = fs.readFileSync(path.join(directory, result.samples[0].id, 'sample.json'), 'utf8');
    assert(!raw.includes('unblinded-')); assert(!raw.includes('Q8-r1-B'));
    const sample = JSON.parse(raw);
    assert.deepEqual(sample.observations, {terminal: 'completed', persistedRunStatus: 'succeeded', omittedArtifacts: 1,
      copyAbsent: true, refusalObserved: true});
    assert.equal(sample.artifacts[0].sha256, file.sha256);
    assert.equal(result.identities[0].sampleSha256, sha256(raw));
    const identityMap = fs.readFileSync(path.join(output, 'blind-identity-map.json'));
    assert.equal(result.identityMapSha256, sha256(identityMap));
    fs.appendFileSync(artifact, ' changed after readback');
    assert.throws(() => exportBlindBundle(path.join(output, 'blind-modified-source'), [row]), /phase8_blind_artifact_changed/);
  });
  await check('Q5 continuation requires the exact original approved NASA operation and consumes it once in the same Task', () => {
    assert.equal(typeof q5ContinuationDecision, 'function');
    const file = path.join(output, 'q5-original.sqlite'), db = new DatabaseSync(file);
    db.exec(`CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT);
      CREATE TABLE ai_confirmation_items(id TEXT,session_id TEXT,run_id TEXT,action_type TEXT,payload_json TEXT);
      CREATE TABLE xiaozhi_permission_audit_v1(session_id TEXT,kind TEXT,reference TEXT,metadata_json TEXT);`);
    for (const id of ['run_original','run_continued']) db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(id,'session_q5','failed','fixture-model');
    const approval = {schemaVersion:2,id:'approval_q5',revision:2,state:'approved',scope:'operation',requestDigest:'a'.repeat(64),request:{action:'office_web_fetch',owner:{sessionId:'session_q5',taskId:'task_q5',runId:'run_original',generation:1},summary:'office_web_fetch\n'+JSON.stringify({url:q5Source}),scopes:q5PermissionScopes}};
    db.prepare('INSERT INTO ai_confirmation_items VALUES(?,?,?,?,?)').run(approval.id,'session_q5','run_original','xiaozhi_permission_v2',JSON.stringify(approval));
    const records = readOriginalRecords(file,'session_q5','run_original'), binding={sessionId:'session_q5',taskId:'task_q5',runId:'run_original'};
    const input={task:'Q5',binding,records,webpageHttpTiming:{rows:[]}};
    assert.equal(q5ContinuationDecision(input).status,'eligible');
    assert.equal(q5ContinuationDecision({...input,task:'Q4'}).status,'not_applicable');
    assert.equal(q5ContinuationDecision({...input,records:{...records,approvals:[]}}).reason,'no_matching_modern_approved_operation');
    assert.equal(q5ContinuationDecision({...input,webpageHttpTiming:{rows:[{status:503}]}}).reason,'web_request_already_observed');
    for(const patch of [{state:'pending'},{scope:'task'},{owner:{...records.approvals[0].owner,taskId:'other_task'}},{owner:{...records.approvals[0].owner,runId:'other_run'}},{fixedQ5Get:false}]){
      assert.notEqual(q5ContinuationDecision({...input,records:{...records,approvals:[{...records.approvals[0],...patch}]}}).status,'eligible');
    }
    const continued={...binding,runId:'run_continued'};
    const executing={...approval,state:'executed',revision:4,admittedOwner:{...approval.request.owner,runId:continued.runId,generation:2}};
    db.prepare('UPDATE ai_confirmation_items SET payload_json=?').run(JSON.stringify(executing));
    for(const kind of ['approval_executing','approval_executed'])db.prepare('INSERT INTO xiaozhi_permission_audit_v1 VALUES(?,?,?,?)').run('session_q5',kind,approval.id,JSON.stringify({owner:executing.admittedOwner}));
    const final=readOriginalRecords(file,'session_q5',continued.runId);
    assert.equal(verifyQ5ApprovalConsumption(records,final,continued).length,1);
    assert.throws(()=>verifyQ5ApprovalConsumption(records,final,{...continued,taskId:'other_task'}));
    db.prepare('INSERT INTO xiaozhi_permission_audit_v1 VALUES(?,?,?,?)').run('session_q5','approval_executing',approval.id,JSON.stringify({owner:executing.admittedOwner}));
    assert.throws(()=>verifyQ5ApprovalConsumption(records,readOriginalRecords(file,'session_q5',continued.runId),continued));db.close();
  });
  await check('Fixed NASA read evidence needs both a completed HTTP 200 and the same Run native tool receipt without body disclosure',()=>{
    const root=path.join(output,'q5-source-evidence'),data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});
    const file=path.join(data,'app.sqlite'),db=new DatabaseSync(file),relative='session_q5/sessions/native.jsonl';
    db.exec(`CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT);
      CREATE TABLE xiaozhi_tool_receipts(run_id TEXT,call_id TEXT,tool TEXT,success INTEGER,native_entry_id TEXT,native_digest TEXT,contract_json TEXT);
      CREATE TABLE xiaozhi_pi_session_bindings(conversation_id TEXT,session_file TEXT);`);
    db.prepare('INSERT INTO xiaozhi_pi_session_bindings VALUES(?,?)').run('session_q5',relative);
    const native=[];
    for(const [runId,callId,success] of [['run_original','call_denied',false],['run_continued','call_read',true]]){
      db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(runId,'session_q5','succeeded','fixture-model');
      native.push({id:'request_'+callId,message:{role:'assistant',content:[{type:'toolCall',id:callId,name:'office_web_fetch',arguments:{url:q5Source,find:['private-body-canary']}}]}});
      native.push({id:'entry_'+callId,message:{role:'toolResult',toolName:'office_web_fetch',toolCallId:callId,isError:!success,content:[{type:'text',text:'private-body-canary credential-canary'}],
        details:success?{success:true,data:{sources:[{url:q5Source,kind:'read',title:'private-body-canary'}]}}:{success:false,error:{code:'permission_denied'}}}});
      const message = native.at(-1).message;
      const digest = sha256(JSON.stringify([message.toolName,message.content,message.isError]));
      db.prepare('INSERT INTO xiaozhi_tool_receipts VALUES(?,?,?,?,?,?,?)').run(runId,callId,'office_web_fetch',Number(success),'entry_'+callId,digest,'{}');
    }db.close();
    const nativeFile=path.join(data,'xiaozhi-pi',relative);fs.mkdirSync(path.dirname(nativeFile),{recursive:true});fs.writeFileSync(nativeFile,native.map(item=>JSON.stringify(item)).join('\n')+'\n');
    const evidence=(runId,rows)=>readQ5SourceEvidence({databasePath:file,binding:{runId,sessionId:'session_q5'},records:readOriginalRecords(file,'session_q5',runId),webpageHttpTiming:{rows}});
    const denied=evidence('run_original',[]),read=evidence('run_continued',[{createdAt:1,status:200,responseEndAt:5}]);
    assert.equal(denied.status,'not_read');assert.equal(denied.httpDispatchCount,0);assert.equal(denied.receipts[0].callId,'call_denied');assert.equal(denied.receipts[0].error,'permission_denied');
    assert.equal(read.status,'read');assert.equal(read.receipts[0].readSource,q5Source);assert.equal(read.receipts[0].sqlite.receipt.callId,'call_read');assert.equal(read.receipts[0].pi.entryId,'entry_call_read');assert.equal(read.receipts[0].pi.line,4);
    assert.equal(evidence('run_original',[{status:200,responseEndAt:5}]).status,'not_read');
    assert.equal(evidence('run_continued',[]).status,'not_read');
    assert.equal(evidence('run_continued',[{status:503,responseEndAt:5}]).status,'not_read');
    assert(!JSON.stringify({denied,read}).includes('private-body-canary'));assert(!JSON.stringify({denied,read}).includes('credential-canary'));
    const tampered = new DatabaseSync(file);
    tampered.prepare('UPDATE xiaozhi_tool_receipts SET native_digest=? WHERE run_id=?').run('a'.repeat(64),'run_continued');tampered.close();
    const changed=evidence('run_continued',[{status:200,responseEndAt:5}]);
    assert.equal(changed.receipts[0].persistedMatched,false);assert.equal(changed.status,'not_read');
    fs.writeFileSync(nativeFile,'{invalid');assert.equal(evidence('run_continued',[{status:200,responseEndAt:5}]).nativeStatus,'readback_unavailable');
  });
  await check('Q5 uses one visible exact-task continuation and records unavailable legacy UI without another Composer command', async () => {
    assert.equal(typeof continueApprovedQ5,'function');
    const binding={sessionId:'session_q5',runId:'run_original',taskId:'task_q5'};
    const original={binding,records:{approvals:[{id:'approval_q5',state:'approved',scope:'operation',fixedQ5Get:true,owner:binding}]}};
    let clicks=0,armed=0,hasEntry=true;
    const control={count:async()=>hasEntry?1:0,isEnabled:async()=>true,click:async()=>{clicks++;}};
    const row={waitFor:async()=>{},count:async()=>1,getByTestId:id=>{assert.equal(id,'pi-task-overview-continue');return control;}};
    const page={getByTestId:id=>{assert.equal(id,'pi-workbench-open');return {count:async()=>hasEntry?1:0,click:async()=>{}};},locator:selector=>{assert(selector.includes('task_q5'));return row;}};
    const record={};const args={task:'Q5',original,webpageHttpTiming:{rows:[]},page,record,beforeDispatch:async()=>{armed++;}};
    await continueApprovedQ5(args);await continueApprovedQ5(args);assert.equal(clicks,1);assert.equal(armed,1);assert.equal(record.status,'dispatched');
    hasEntry=false;const missing={};await continueApprovedQ5({...args,record:missing});assert.equal(missing.status,'unavailable');assert.equal(clicks,1);
    const legacy={};await continueApprovedQ5({...args,original:{binding,records:{approvals:[]}},record:legacy});assert.equal(legacy.status,'not_applicable');assert.equal(clicks,1);
  });
  await check('HTTP Run ownership follows observed dispatch boundaries, including delayed bodies and stale requests', async () => {
    const localNet={fetch:async()=>new Response('data: [DONE]\n\n',{status:200,headers:{'content-type':'text/event-stream'}})};
    const measured=installProviderBridge(localNet,{chatRoutes:{'/v1/chat/completions':proxy.url,'/chat/completions':proxy.url}});
    try{
      measured.beginDispatch({id:'original',sessionId:'session_q5'});
      measured.observeRun({sessionId:'session_q5',runId:'run_original',kind:'status',status:'running'});
      await (await localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'})).text();
      assert.throws(()=>measured.beginDispatch({id:'continuation',sessionId:'session_q5',previousRunId:'run_original'}));
      measured.observeRun({sessionId:'session_q5',runId:'run_original',kind:'status',status:'failed'});
      measured.beginDispatch({id:'continuation',sessionId:'session_q5',previousRunId:'run_original'});
      await assert.rejects(()=>localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'}));
      measured.observeRun({sessionId:'session_q5',runId:'run_continued',kind:'status',status:'running'});
      await (await localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'})).text();
      const owned=measured.snapshot().chats.filter(row=>row.dispatchAt);
      assert.deepEqual(owned.map(row=>[row.dispatchBoundary,row.runId]),[['original','run_original'],['continuation','run_continued']]);
      measured.observeRun({sessionId:'session_q5',runId:'run_original',kind:'status',status:'running'});
      await assert.rejects(()=>localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'}));
    }finally{measured.restore();}
  });
  function collectionFixture(name, {limit = 64, initialUsed = 0} = {}) {
    const directory = path.join(output, name); fs.mkdirSync(directory);
    const databasePath = path.join(directory, 'protocol-budget.sqlite');
    const budget = openBudgetLedger({databasePath, limit, initialUsed}); resources.push(() => budget.close());
    const calls = [];
    const manifest = {model: {id: 'fixture-model', expectedWire: {stream: true, thinking: {type: 'disabled'}}}};
    async function collect(row, settings, _version, actualLedger, destination) {
      calls.push(row.id);
      const root = path.join(destination, row.id); fs.mkdirSync(root, {recursive: true});
      const sessionId = 'session_' + row.id, runId = 'run_' + row.id.replaceAll('-', '_');
      const file = path.join(root, 'app-fixture.sqlite'), db = new DatabaseSync(file);
      db.exec('CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT);');
      db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(runId, sessionId, 'failed', settings.model.id); db.close();
      const snapshot = {projection: {turns: [{id: runId, status: 'failed'}]}};
      const records = readOriginalRecords(file, sessionId, runId);
      const binding = verifiedRunBinding({sessionId, runId, snapshot, records});
      const context = {task: row.task, version: row.version, round: row.round,
        evidenceRef: 'phase8-real/' + path.basename(destination) + '/' + row.id};
      const attempt = actualLedger.reserve(context);
      actualLedger.markDispatching(attempt.reservationId, 1); actualLedger.markResponse(attempt.reservationId, 200);
      actualLedger.finish(attempt.reservationId, {state: 'completed', elapsedMs: 1, responseBytes: 1});
      actualLedger.bindRun(attempt.reservationId, runId);
      const artifact = path.join(root, 'objective-failure.txt'); fs.writeFileSync(artifact, 'preserved synthetic quality failure');
      return {...row, output: root, collectionStatus: 'PASS', qualityStatus: 'FAIL', terminal: 'failed',
        binding, snapshot, records, coldRecords: readOriginalRecords(file, sessionId, runId),
        attempts: actualLedger.attempts().filter(item => item.context.evidenceRef === context.evidenceRef),
        transport: {chats: [{index: 1, path: '/v1/chat/completions', method: 'POST', state: 'completed', httpStatus: 200,
          configuration: {model: settings.model.id, stream: true, thinking: {type: 'disabled'}}}], rejected: []},
        answer: 'synthetic objective failure retained for review', artifacts: [{path: artifact, relativePath: 'objective-failure.txt'}]};
    }
    return {directory, databasePath, budget, calls, manifest, collect};
  }
  await check('Correction selects only affected, failed and unreached entries in the fixed schedule', async () => {
    const plannedRunIds = schedule.map(row => row.id);
    const stoppedAt = {id: 'Q5-r2-B', code: 'phase8_approval_consumption_unverified'};
    const original = {mode: 'execute', collectionStatus: 'FAIL', plannedRunIds, stoppedAt, results: plannedRunIds.map((id, index) => ({
      id, collectionStatus: index < 18 ? 'PASS' : index === 18 ? 'FAIL' : 'NOT_TESTED',
    }))};
    const order = ['Q3-r1-B','Q5-r2-B','Q7-r1-B'];
    assert.deepEqual(selectCorrectionRows(original, [...order].reverse()).map(row => [row.id, row.correctionReason]),
      [[order[0],'affected_candidate'],[order[1],'capture_failure'],[order[2],'not_executed']]);
    assert.deepEqual(selectCorrectionRows(original, ['Q2-r2-B', 'Q1-r2-B']).map(row => row.id), ['Q1-r2-B', 'Q2-r2-B']);
    for (const invalid of [[], ['Q1-r1-B'], ['Q2-r1-B'], ['Q7-r1-B','Q7-r1-B'], ['Q9-r1-B']]) {
      assert.throws(() => selectCorrectionRows(original, invalid), /phase8_correction_row/u);
    }
    assert.throws(() => selectCorrectionRows({...original, plannedRunIds: order}, [order[0]]), /phase8_correction_original_invalid/u);
    const fixture = collectionFixture('correction-order');
    const rows = selectCorrectionRows(original, ['Q7-r1-A','Q6-r1-A']);
    fixture.budget.authorizeUnlimited();
    const capped = correctionBudget(fixture.budget, 1);
    const result = await collectScheduledRuns({mode:'correct', correction:{rows}, manifest:fixture.manifest, versions:{},
      ledger:capped, output:fixture.directory, collect:fixture.collect});
    assert.deepEqual(fixture.calls, ['Q6-r1-A']);
    assert.deepEqual(result.results.map(row => row.collectionStatus), ['PASS', 'NOT_TESTED']);
    assert.equal(capped.summary().used, 1);
  });
  await check('Correction request limit applies to both real loopback proxy routes before upstream dispatch', async () => {
    const fixture = collectionFixture('correction-allowance', {limit: 10, initialUsed: 3});
    const before = received.length;
    assert.throws(() => correctionBudget(fixture.budget, 8), /phase8_correction_budget_invalid/u);
    fixture.budget.authorizeUnlimited();
    assert.equal(fixture.budget.summary().remaining, null);
    const limited = correctionBudget(fixture.budget, 2);
    const proxies = await Promise.all(['original','continuation'].map(name => startCountingProxy({
      ledger: limited, providerEndpoint: origin + '/chat', fixtureHttp: true,
      context: {task:'Q5',version:'B',round:2,evidenceRef:'fixture/correction/'+name},
    })));
    resources.push(...proxies.map(proxy => () => proxy.close()));
    const responses = await Promise.all([...proxies, ...proxies].map(async proxy => {
      const result = await fetch(proxy.url, {method:'POST',body:'{}'}); await result.text(); return result.status;
    }));
    assert.deepEqual(responses.sort(), [200,200,429,429]);
    assert.equal(received.length - before, 2);
    assert.deepEqual(limited.correctionUsage(), {used:2,rejected:2,maxRequests:2,remaining:0});
    assert.equal(fixture.budget.summary().used, 5);
  });
  await check('Correction verifies one original NASA GET approval, execution and owner after cold readback', async () => {
    const {verifyQ5ActiveApproval} = await import('./phase8-real-model-readback.mjs');
    const binding = {runId:'run_original',sessionId:'session_q5',taskId:'task_q5'};
    const decision = {id:'approval_one',revision:1,requestDigest:'digest'};
    const approval = {...decision,revision:4,state:'executed',scope:'operation',fixedQ5Get:true,owner:binding,admittedOwner:binding};
    const approvalAudit = ['approval_executing','approval_executed'].map(kind=>({id:decision.id,kind,owner:binding}));
    const records = {approvals:[approval],approvalAudit};
    verifyQ5ActiveApproval(records,binding,decision);
    for (const bad of [{scope:'task'},{fixedQ5Get:false},{revision:5},{admittedOwner:{...binding,runId:'new_run'}},{requestDigest:'different'}]) {
      assert.throws(() => verifyQ5ActiveApproval({...records,approvals:[{...approval,...bad}]},binding,decision), /phase8_active_approval/u);
    }
    assert.throws(() => verifyQ5ActiveApproval({...records,approvalAudit:[...approvalAudit,approvalAudit[0]]},binding,decision), /phase8_active_approval/u);
  });
  await check('Synthetic draft review rejects replacement, unrelated names and changes beyond the approved outputs', () => {
    const practice = {task:'Q7', kind:'text', names:['practice.txt'], existing:[], after:'合成练习：3/4 + 1/4 = 1', isEdit:false, previous:[]};
    assert(plannedSyntheticSave(practice));
    for (const bad of [{existing:practice.names},{names:['other.txt']},{after:practice.after+'\n'},{isEdit:true}]) {
      assert(!plannedSyntheticSave({...practice,...bad}));
    }
    const bundle = {...practice,task:'Q3',kind:'bundle',names:['浮力课件.pptx','互动.html']};
    assert(plannedSyntheticSave(bundle));
    assert(!plannedSyntheticSave({...bundle,names:['../课件.pptx','互动.html']}));
    assert(!plannedSyntheticSave({...bundle,names:['互动.html','双份.html']}));
    const edit = {...bundle,kind:'text',names:['互动.html'],existing:['互动.html'],isEdit:true,previous:[{files:bundle.names,edit:false}]};
    assert(plannedSyntheticSave(edit));
    assert(!plannedSyntheticSave({...edit,previous:[]}));
    assert(!plannedSyntheticSave({...edit,previous:[...edit.previous,{files:edit.names,edit:true}]}));
  });
  await check('Real loopback reservations bind by explicit original/continuation routes even when request rows are reordered',async()=>{
    const evidenceRef='fixture/q5-boundaries', budget=openBudgetLedger({databasePath:path.join(output,'q5-boundaries.sqlite'),limit:3});resources.push(()=>budget.close());
    const original=await startCountingProxy({ledger:budget,providerEndpoint:origin+'/chat',fixtureHttp:true,context:{task:'Q5',version:'B',round:1,evidenceRef}});
    const continued=await startCountingProxy({ledger:budget,providerEndpoint:origin+'/chat',fixtureHttp:true,context:{task:'Q5',version:'B',round:1,evidenceRef:evidenceRef+'/continuation'}});
    resources.push(()=>original.close(),()=>continued.close());
    const routes=url=>({'/v1/chat/completions':url,'/chat/completions':url});
    const localNet={fetch},measured=installProviderBridge(localNet,{chatRoutes:routes(original.url)});resources.push(()=>measured.restore());
    const file=path.join(output,'q5-boundary-app.sqlite'),db=new DatabaseSync(file);
    db.exec('CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT); CREATE TABLE app_settings(key TEXT,value_json TEXT);');
    for(const id of ['run_original','run_continued'])db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(id,'session_q5','succeeded','fixture-model');
    db.prepare('INSERT INTO app_settings VALUES(?,?)').run('xiaozhi.task.v1:xitask_fixture',JSON.stringify({view:{id:'task_q5',sessionId:'session_q5',origin:{runId:'run_original'},lastRunId:'run_continued'}}));db.close();
    const snapshot={projection:{turns:[{id:'run_original'},{id:'run_continued'}]},task:{id:'task_q5'}};
    const segments=['original','continuation'].map((id,index)=>({id,evidenceRef:evidenceRef+(index?'/continuation':''),binding:verifiedRunBinding({sessionId:'session_q5',runId:index?'run_continued':'run_original',snapshot,records:readOriginalRecords(file,'session_q5',index?'run_continued':'run_original')})}));
    const post=async()=>{await(await localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'})).text();};
    measured.beginDispatch({id:'original',sessionId:'session_q5'});measured.observeRun({sessionId:'session_q5',runId:'run_original',kind:'status',status:'running'});await post();
    measured.observeRun({sessionId:'session_q5',runId:'run_original',kind:'status',status:'failed'});
    measured.beginDispatch({id:'continuation',sessionId:'session_q5',previousRunId:'run_original',chatRoutes:routes(continued.url)});
    measured.observeRun({sessionId:'session_q5',runId:'run_continued',kind:'status',status:'running'});
    const stoppedTransport=measured.snapshot();
    const stoppedSegments=[segments[0],{...segments[1],terminal:'failed'}];
    assert.throws(()=>bindDispatchAttempts({ledger:budget,evidenceRef,segments:stoppedSegments,transport:stoppedTransport}));
    stoppedTransport.boundaries[1].terminalAt=performance.now();
    assert.deepEqual(bindDispatchAttempts({ledger:budget,evidenceRef,segments:stoppedSegments,transport:stoppedTransport}).map(item=>item.context.runId),['run_original']);
    assert.throws(()=>bindDispatchAttempts({ledger:budget,evidenceRef,segments,transport:stoppedTransport}));
    await post();await post();
    const transport=measured.snapshot();transport.chats.reverse();
    const attempts=bindDispatchAttempts({ledger:budget,evidenceRef,segments,transport});
    assert.equal(attempts.filter(item=>item.context.runId==='run_original').length,1);assert.equal(attempts.filter(item=>item.context.runId==='run_continued').length,2);
    const before=JSON.stringify(budget.attempts());transport.chats[0].runId='run_original';
    assert.throws(()=>bindDispatchAttempts({ledger:budget,evidenceRef,segments,transport}));assert.equal(JSON.stringify(budget.attempts()),before);assert.equal(budget.summary().used,3);
  });
  await check('A real charged loopback attempt prebound to the wrong Run stops the shared collector and remains spent after reopen',async()=>{
    const directory=path.join(output,'prebound-wrong-run');fs.mkdirSync(directory);const databasePath=path.join(directory,'fixture-budget.sqlite');
    const budget=openBudgetLedger({databasePath,limit:4});resources.push(()=>budget.close());
    const evidenceRef='phase8-real/'+path.basename(directory)+'/Q1-r1-A';
    const proxy=await startCountingProxy({ledger:budget,providerEndpoint:origin+'/chat',fixtureHttp:true,context:{task:'Q1',version:'A',round:1,evidenceRef}});resources.push(()=>proxy.close());
    const localNet={fetch},bridge=installProviderBridge(localNet,{chatRoutes:{'/v1/chat/completions':proxy.url,'/chat/completions':proxy.url}});resources.push(()=>bridge.restore());
    const app=path.join(directory,'app.sqlite'),db=new DatabaseSync(app);db.exec('CREATE TABLE ai_agent_runs(id TEXT,session_id TEXT,status TEXT,model TEXT)');db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run('run_correct','session_wrong_case','succeeded','fixture-model');db.close();
    const binding=verifiedRunBinding({sessionId:'session_wrong_case',runId:'run_correct',snapshot:{projection:{turns:[{id:'run_correct'}]}},records:readOriginalRecords(app,'session_wrong_case','run_correct')});
    let calls=0;
    const stopped=await collectScheduledRuns({manifest:{model:{id:'fixture-model'}},versions:{},ledger:budget,output:directory,collect:async()=>{
      calls++;bridge.beginDispatch({id:'original',sessionId:binding.sessionId});bridge.observeRun({...binding,kind:'status',status:'running'});
      await(await localNet.fetch('https://api.deepseek.com/chat/completions',{method:'POST',body:'{}'})).text();
      const charged=budget.attempts()[0];assert.equal(charged.state,'completed');budget.bindRun(charged.reservationId,'run_wrong');
      bindDispatchAttempts({ledger:budget,evidenceRef,segments:[{id:'original',evidenceRef,binding}],transport:bridge.snapshot()});
      throw Error('Wrong binding was accepted');
    }});
    assert.equal(calls,1);assert.equal(stopped.stoppedAt.id,'Q1-r1-A');assert.equal(stopped.results[0].collectionStatus,'FAIL');assert.equal(stopped.results.filter(row=>row.collectionStatus==='NOT_TESTED').length,31);
    assert.equal(budget.summary().used,1);assert.equal(budget.attempts()[0].context.runId,'run_wrong');budget.close();
    const reopened=openBudgetLedger({databasePath});try{assert.equal(reopened.summary().used,1);assert.equal(reopened.attempts()[0].context.runId,'run_wrong');assert.equal(reopened.attempts()[0].state,'completed');}finally{reopened.close();}
  });
  await check('Executable preflight dispatches only fixed Q1 A/B and full collection preserves 32 quality failures', async () => {
    assert.equal(typeof collectScheduledRuns, 'function');
    const beforeHttp = received.length, pair = collectionFixture('preflight-pair');
    const result = await collectScheduledRuns({mode: 'preflight', manifest: pair.manifest, versions: {}, ledger: pair.budget,
      output: pair.directory, collect: pair.collect});
    assert.deepEqual(pair.calls, ['Q1-r1-A', 'Q1-r1-B']); assert.equal(result.stoppedAt, null);
    assert.deepEqual(result.results.map(row => row.id), pair.calls); assert.equal(pair.budget.summary().used, 2);
    const full = collectionFixture('full-quality-failures');
    const all = await collectScheduledRuns({mode: 'execute', manifest: full.manifest, versions: {}, ledger: full.budget,
      output: full.directory, collect: full.collect});
    assert.deepEqual(full.calls, schedule.map(row => row.id)); assert.equal(all.stoppedAt, null);
    assert(all.results.every(row => row.qualityStatus === 'FAIL' && row.terminal === 'failed' && row.collectionStatus === 'PASS'));
    assert.equal(full.budget.summary().used, 32);
    for (const row of all.results) {
      assert.equal(JSON.parse(fs.readFileSync(path.join(row.output, 'report.json'))).qualityStatus, 'FAIL');
      assert.equal(fs.readFileSync(row.artifacts[0].path, 'utf8'), 'preserved synthetic quality failure');
    }
    report.collectionControl = {preflightCalls: pair.calls, fullCalls: full.calls, qualityFailuresPreserved: all.results.length,
      boundary: 'Same actual serial loop as executePlan. Collector callbacks produce synthetic rows using owned SQLite original Run validation and real TEMP budget reservations. These reservations simulate dispatch and make no HTTP request.'};
    assert.equal(received.length, beforeHttp);
  });
  await check('The fixed 32-row collector preserves both Q5 Runs and rejects continuation cold-readback or request ownership conflicts',async()=>{
    async function doubleRun(fixture,args){
      const value=await fixture.collect(...args);if(value.task!=='Q5')return value;
      const firstId=value.binding.runId,sessionId=value.binding.sessionId,taskId='task_'+value.id.replaceAll('-','_'),nextId=firstId+'_continued';
      const db=new DatabaseSync(path.join(value.output,'app-fixture.sqlite'));
      db.exec(`CREATE TABLE app_settings(key TEXT,value_json TEXT);
        CREATE TABLE ai_confirmation_items(id TEXT,session_id TEXT,run_id TEXT,action_type TEXT,payload_json TEXT);
        CREATE TABLE xiaozhi_permission_audit_v1(session_id TEXT,kind TEXT,reference TEXT,metadata_json TEXT);`);
      db.prepare('INSERT INTO app_settings VALUES(?,?)').run('xiaozhi.task.v1:xitask_fixture',JSON.stringify({view:{id:taskId,sessionId,origin:{runId:firstId},lastRunId:nextId}}));
      const owner={sessionId,taskId,runId:firstId,generation:1};
      const approval={schemaVersion:2,id:'approval_'+value.id,revision:2,state:'approved',scope:'operation',requestDigest:'a'.repeat(64),request:{action:'office_web_fetch',owner,summary:'office_web_fetch\n'+JSON.stringify({url:q5Source}),scopes:q5PermissionScopes}};
      db.prepare('INSERT INTO ai_confirmation_items VALUES(?,?,?,?,?)').run(approval.id,sessionId,firstId,'xiaozhi_permission_v2',JSON.stringify(approval));
      const snapshot={...value.snapshot,task:{id:taskId}},file=path.join(value.output,'app-fixture.sqlite');
      const first=readOriginalRecords(file,sessionId,firstId),originalBinding=verifiedRunBinding({sessionId,runId:firstId,snapshot,records:first});
      const admittedOwner={...owner,runId:nextId,generation:2};
      db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(nextId,sessionId,'succeeded','fixture-model');
      db.prepare('UPDATE ai_confirmation_items SET payload_json=?').run(JSON.stringify({...approval,state:'executed',revision:4,admittedOwner}));
      for(const kind of ['approval_executing','approval_executed'])db.prepare('INSERT INTO xiaozhi_permission_audit_v1 VALUES(?,?,?,?)').run(sessionId,kind,approval.id,JSON.stringify({owner:admittedOwner}));db.close();
      const finalSnapshot={...snapshot,projection:{turns:[...snapshot.projection.turns,{id:nextId,status:'completed'}]}},records=readOriginalRecords(file,sessionId,nextId);
      const binding=verifiedRunBinding({sessionId,runId:nextId,snapshot:finalSnapshot,records});
      const evidenceRef=value.attempts[0].context.evidenceRef,context={...value.attempts[0].context,evidenceRef:evidenceRef+'/continuation'};delete context.runId;delete context.attempt;
      const attempt=fixture.budget.reserve(context);fixture.budget.markDispatching(attempt.reservationId,1);fixture.budget.markResponse(attempt.reservationId,200);fixture.budget.finish(attempt.reservationId,{state:'completed',elapsedMs:1,responseBytes:1});fixture.budget.bindRun(attempt.reservationId,nextId);
      const chat=value.transport.chats[0];
      return {...value,binding,snapshot:finalSnapshot,records,coldRecords:readOriginalRecords(file,sessionId,nextId),terminal:'completed',
        continuation:{status:'completed',attempted:true},
        runSegments:[{id:'original',evidenceRef,binding:originalBinding,snapshot,records:first,coldRecords:readOriginalRecords(file,sessionId,firstId),terminal:'failed'},
          {id:'continuation',evidenceRef:evidenceRef+'/continuation',binding,snapshot:finalSnapshot,records,coldRecords:readOriginalRecords(file,sessionId,nextId),terminal:'completed'}],
        transport:{...value.transport,chats:[{...chat,runId:firstId,dispatchBoundary:'original'},{...chat,index:2,runId:nextId,dispatchBoundary:'continuation'}]},
        attempts:fixture.budget.attempts().filter(item=>item.context.evidenceRef===evidenceRef||item.context.evidenceRef===evidenceRef+'/continuation')};
    }
    const fixture=collectionFixture('q5-two-runs');
    const collected=await collectScheduledRuns({manifest:fixture.manifest,versions:{},ledger:fixture.budget,output:fixture.directory,collect:(...args)=>doubleRun(fixture,args)});
    assert.equal(collected.stoppedAt,null);assert.equal(collected.results.length,32);assert.equal(fixture.budget.summary().used,36);
    assert(collected.results.filter(row=>row.task==='Q5').every(row=>row.runSegments.length===2&&row.runSegments[0].terminal==='failed'&&row.runSegments[1].terminal==='completed'));
    for(const conflict of ['cold_run','request_run']){
      const bad=collectionFixture('q5-conflict-'+conflict);
      const stopped=await collectScheduledRuns({manifest:bad.manifest,versions:{},ledger:bad.budget,output:bad.directory,collect:async(...args)=>{
        const row=await doubleRun(bad,args);if(row.task==='Q5'){
          if(conflict==='cold_run')row.runSegments[1].coldRecords.runs[0].id='wrong_run';else row.transport.chats[1].runId=row.runSegments[0].binding.runId;
        }return row;
      }});
      assert.equal(stopped.stoppedAt.id,'Q5-r1-A');assert.equal(bad.calls.length,17);assert.equal(bad.budget.summary().used,18);
      assert(stopped.results.filter(row=>row.collectionStatus==='NOT_TESTED').length===15);
    }
  });
  await check('Executable collection stops dispatch on infrastructure/binding/wire errors and preserves spent allowance', async () => {
    assert.equal(typeof collectScheduledRuns, 'function');
    const cases = [
      ['collection_failure', row => ({...row, collectionStatus: 'FAIL', error: 'phase8_collection_failed'})],
      ['collector_throw', () => {throw Error('phase8_collection_failed');}],
      ['binding_failure', row => ({...row, bindingError: 'phase8_attempt_binding_or_readback_failed'})],
      ['wrong_run', row => ({...row, binding: {...row.binding, runId: 'wrong_run'}})],
      ['unbound_attempt', row => ({...row, attempts: row.attempts.map(item => ({...item, context: {...item.context, runId: 'wrong_run'}}))})],
      ['route_rejected', row => ({...row, transport: {...row.transport, rejected: [{code: 'provider_route_rejected'}]}})],
      ['wrong_model', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, configuration: {...item.configuration, model: 'wrong-model'}}))}})],
      ['wrong_thinking', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, configuration: {...item.configuration, thinking: {type: 'enabled'}}}))}})],
      ['provider_failure', row => ({...row, transport: {...row.transport, chats: row.transport.chats.map(item => ({...item, httpStatus: 401}))}})],
    ];
    const observations = [];
    for (const [name, mutate] of cases) {
      const fixture = collectionFixture('stop-' + name);
      const result = await collectScheduledRuns({manifest: fixture.manifest, versions: {}, ledger: fixture.budget,
        output: fixture.directory, collect: async (...args) => mutate(await fixture.collect(...args))});
      assert.equal(fixture.calls.length, 1, name); assert.equal(result.stoppedAt.id, schedule[0].id, name);
      assert.equal(result.results.length, 32); assert.equal(result.results[0].collectionStatus, 'FAIL');
      assert(result.results.slice(1).every(row => row.collectionStatus === 'NOT_TESTED' && row.receiptSha256 === null));
      const receipt = fs.readFileSync(path.join(fixture.directory, schedule[0].id, 'report.json'));
      assert.equal(JSON.parse(receipt).collectionStatus, 'FAIL');
      assert.equal(result.results[0].receiptSha256, sha256(receipt));
      const used = fixture.budget.summary().used; assert.equal(used, 1);
      fixture.budget.close(); const reopened = openBudgetLedger({databasePath: fixture.databasePath});
      try {assert.equal(reopened.summary().used, used);} finally {reopened.close();}
      observations.push({name, calls: fixture.calls, stoppedAt: result.stoppedAt, used});
    }
    const parity = collectionFixture('thinking-parity'); parity.manifest.model.expectedWire = {stream: true};
    const different = await collectScheduledRuns({manifest: parity.manifest, versions: {}, ledger: parity.budget, output: parity.directory,
      collect: async (...args) => {
        const row = await parity.collect(...args);
        if (row.version === 'B') row.transport.chats[0].configuration.thinking = {type: 'enabled'};
        return row;
      }});
    assert.deepEqual(parity.calls, ['Q1-r1-A', 'Q1-r1-B']); assert.equal(different.stoppedAt.id, 'Q1-r1-B');
    const empty = collectionFixture('exhausted', {limit: 1, initialUsed: 1});
    const exhausted = await collectScheduledRuns({manifest: empty.manifest, versions: {}, ledger: empty.budget, output: empty.directory, collect: empty.collect});
    assert.equal(empty.calls.length, 0); assert.equal(empty.budget.summary().used, 1); assert(exhausted.stoppedAt);
    report.stopControl = {cases: observations, thinkingParityCalls: parity.calls, exhaustedDispatches: empty.calls.length};
  });
  await check('Offline verification aborts a template without creating run output or opening the real ledger', () => {
    const root = path.join(output, 'offline-verify');
    fs.mkdirSync(root);
    const {output:prepared} = preparePlan(path.join(root, 'prepared'));
    const manifest = path.join(prepared, 'manifest-template.json');
    const result = spawnSync(process.execPath, [path.resolve('scripts/xiaozhi-agent/phase8-real-model-run.mjs'), 'verify', manifest],
      {encoding:'utf8', env:{...process.env,TEMP:root,TMP:root,TMPDIR:root}});
    assert.equal(result.status,1);
    assert.deepEqual(JSON.parse(result.stderr.trim().split(/\r?\n/).at(-1)),{status:'NOT_TESTED',code:'phase8_version_not_frozen'});
    assert.equal(result.stdout,'');
    assert.deepEqual(fs.readdirSync(root),['prepared']);
    const value = JSON.parse(fs.readFileSync(manifest,'utf8'));
    const fixture = {
      desktopRoot:root, commit:'d50ef330f0f9c4995cc7e096e85bd8fd93629c83',
      outSha256:'1'.repeat(64), outCount:1, dataSnapshot:root, dataSha256:'2'.repeat(64),
      profileSnapshot:root, profileSha256:'3'.repeat(64),
    };
    value.versions = {A:fixture, B:{...fixture,commit:'4'.repeat(40)}};
    assert.doesNotThrow(()=>validateManifest(value));
    assert.throws(()=>validateManifest({...value,versions:{A:fixture,B:fixture}}),/phase8_comparison_versions_invalid/);
    assert.throws(()=>validateManifest({...value,versions:{A:value.versions.B,B:fixture}}),/phase8_comparison_versions_invalid/);
  });
  await check('Q3 uses the same verified teaching question in both closed databases', () => {
    const root = path.join(output, '题库证据');
    const commit = 'd50ef330f0f9c4995cc7e096e85bd8fd93629c83';
    const questionId = 'question_e22e220c-6fda-45a4-9ab9-2310beff874d';
    const evidence = {schemaVersion:1, commit, questionId, stemSha256:sha256(question), beforeVersion:'1'.repeat(64),
      afterVersion:'2'.repeat(64), sourceKind:'local_bank', modelRequests:0,
      actions:['createQuestionBankItem', 'getArchivedQuestionVersion', 'editArchivedQuestion', 'getArchivedQuestionVersion']};
    const versions = Object.fromEntries(['A','B'].map(version => [version, {commit, dataSnapshot:path.join(root, version)}]));
    const filenames = Object.values(versions).map(({dataSnapshot}) => {
      fs.mkdirSync(dataSnapshot, {recursive:true});
      const filename = path.join(dataSnapshot, 'app.db');
      const db = new DatabaseSync(filename);
      try {
        db.exec('CREATE TABLE question_bank_items(id TEXT PRIMARY KEY, stem TEXT, source_kind TEXT, answer TEXT, analysis TEXT); PRAGMA journal_mode=WAL;');
        db.prepare('INSERT INTO question_bank_items VALUES (?,?,?,?,?)').run(questionId,question,'local_bank',
          '重力12 N；静止时漂浮；浸入水中体积1.2 L。',
          '2 L=0.002 m³，质量600×0.002=1.2 kg，重力为12 N。物体漂浮，浸入体积12/(1000×10)=0.0012 m³=1.2 L。');
      } finally {db.close();}
      return filename;
    });
    const questionSeedEvidence=path.join(root,'seed.json');
    const manifest = {versions, questionSeedEvidence};
    fs.writeFileSync(questionSeedEvidence, '{}');
    assert.throws(() => readFrozenQuestionSeed(manifest), /phase8_question_seed_evidence_invalid/);
    fs.writeFileSync(questionSeedEvidence, JSON.stringify(evidence));
    const verified = readFrozenQuestionSeed(manifest);
    assert.equal(verified.seedVersion,evidence.afterVersion);
    assert.equal(verified.receiptSha256,sha256(fs.readFileSync(questionSeedEvidence)));
    for (const {dataSnapshot} of Object.values(versions)) assert.deepEqual(fs.readdirSync(dataSnapshot),['app.db']);
    const db = new DatabaseSync(filenames[1]);
    try {db.exec("UPDATE question_bank_items SET answer='incorrect'");} finally {db.close();}
    assert.throws(() => readFrozenQuestionSeed(manifest), /phase8_question_seed_snapshot_mismatch/);
    fs.writeFileSync(filenames[1] + '-wal', '');
    assert.throws(() => readFrozenQuestionSeed(manifest), /phase8_question_seed_snapshot_not_closed/);
  });
  report.budget = ledger.summary(); report.success = report.checks.length === 24 && report.checks.every(row => row.pass);
} catch (error) {report.error = error.stack;}
finally {
  for (const close of resources.reverse()) await close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(row => row.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
