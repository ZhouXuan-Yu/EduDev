import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
const { createModelSwitchState } = await import('../../src/main/xiaozhi-agent/model-switch-state.ts');
const { createNativeModelSwitch } = await import('../../src/main/xiaozhi-agent/native-model-switch.ts');
const { assertHanaModelSwitchContext } = await import('../../src/main/xiaozhi-agent/vendor/hana/core/model-switch-context.ts');
const { ModelRuntime, ModelRegistry, SessionManager, SettingsManager, createAgentSession, createExtensionRuntime } = await import('@earendil-works/pi-coding-agent');
const {InMemoryCredentialStore}=await import('@earendil-works/pi-ai');
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-history-model-switch-'));
const checks = [], fixtures = [];
const report = { suite: 'pi-history-model-switch-b1', success: false, checks, boundary: 'Real Pi SDK/SQLite/JSONL instances; no production UI or provider completion claimed' };
const provider = 'xiaozhi_deepseek', flash = 'deepseek-flash', pro = 'deepseek-v4-pro';
const noFetch = globalThis.fetch; let networkRequests = 0;
globalThis.fetch = async () => { networkRequests++; throw new Error('Unexpected network request in idle model switching'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const attach = db => createModelSwitchState({ run: async (sql, values=[]) => db.prepare(sql).run(...values),
  change: async (sql, values=[]) => Number(db.prepare(sql).run(...values).changes), all: async (sql, values=[]) => db.prepare(sql).all(...values) });
const resourceLoader = { getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
  getSkills: () => ({ skills: [], diagnostics: [] }), getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }), getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => 'Synthetic owned fixture. Do not execute tools.', getAppendSystemPrompt: () => [],
  getSystemPromptSource:()=>undefined,getAppendSystemPromptSources:()=>[],getPathMetadata: () => new Map(), extendResources: () => {}, reload: async () => {} };
async function fixture() {
  const sessionId = 'aisession_' + randomUUID(), root = path.join(output,randomUUID());
  const workspace = path.join(root,sessionId,'workspace'), directory = path.join(root,sessionId,'sessions');
  fs.mkdirSync(workspace,{ recursive: true }); fs.mkdirSync(directory,{ recursive: true });
  const database = path.join(root,'app.db');
  let db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
    CREATE TABLE xiaozhi_pi_session_bindings(conversation_id TEXT PRIMARY KEY,schema_version INTEGER,session_file TEXT,model TEXT,updated_at TEXT)`);
  db.prepare('INSERT INTO ai_conversation_sessions VALUES (?,NULL)').run(sessionId);
  let manager = SessionManager.create(workspace,directory);
  manager.appendCustomEntry('xiaozhi.education.snapshot.v1',{ fingerprint: 'immutable-synthetic-identity' });
  manager.appendModelChange(provider,flash);
  manager.appendMessage({ role: 'user', content: '合成备课历史标记 TEST-EDU-317', timestamp: Date.now() });
  manager.appendMessage({ role: 'assistant', content: [{ type: 'text', text: '已记录合成备课历史标记。' }],
    api: 'openai-completions', provider, model: flash, stopReason: 'stop', timestamp: Date.now(),
    usage: { input: 20, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input:0,output:0,cacheRead:0,cacheWrite:0,total:0 } } });
  const file = manager.getSessionFile(); assert(file && fs.existsSync(file));
  const relative = path.relative(root,file).replaceAll('\\','/');
  db.prepare('INSERT INTO xiaozhi_pi_session_bindings VALUES (?,4,?,?,?)').run(sessionId,relative,flash,new Date().toISOString());
  let state = attach(db); await state.migrate(); await state.migrate();
  const initial = { sessionId,sessionFile:relative,nativeSessionId:manager.getSessionId(),originModel:flash,model:flash,revision:2 };
  await state.seed(initial); await state.seed(initial);
  const auth=await ModelRuntime.create({credentials:new InMemoryCredentialStore(),modelsPath:null,allowModelNetwork:false,refreshOnCreate:false});await auth.setRuntimeApiKey(provider,'synthetic-key-not-a-live-credential');
  const registry = new ModelRegistry(auth);
  registry.registerProvider(provider,{ api:'openai-completions',apiKey:'synthetic-key-not-a-live-credential',baseUrl:'https://api.deepseek.com/v1',
    models: [flash,pro].map(id => ({ id,name:id,reasoning:false,input:['text'],contextWindow:1048576,maxTokens:4096,
      cost:{ input:0,output:0,cacheRead:0,cacheWrite:0 } })) });
  let session;
  async function load(model=flash) {
    session?.dispose();
    const created = await createAgentSession({ cwd:workspace,agentDir:path.join(root,sessionId,'agent'),modelRuntime:auth,
      model:registry.find(provider,model), sessionManager:manager, settingsManager:SettingsManager.inMemory({ compaction:{enabled:false},retry:{enabled:false}, defaultThinkingLevel:'off' }),
      tools:[],customTools:[],noTools:'all',resourceLoader });
    assert(!created.modelFallbackMessage); session=created.session; assert.equal(session.model.id,model);
    return session;
  }
  await load();
  const originalMessages = sha(JSON.stringify(manager.getEntries().filter(entry => entry.type==='message')));
  const originalSnapshot = JSON.stringify(manager.getEntries().find(entry=>entry.type==='custom' && entry.customType==='xiaozhi.education.snapshot.v1'));
  let busy=false, authorized=true;
  const coordinator = (afterStage) => createNativeModelSwitch({ state,root,assertIdle:()=>{ if(busy)throw new Error('busy'); },
    assertAuthorized: async id => { assert.equal(id,sessionId); if(!authorized)throw new Error('permission_denied'); },afterStage });
  const instance = { root,database,file,sessionId,initial,registry,originalMessages,originalSnapshot,load,coordinator,
    get manager(){return manager;},get session(){return session;},get db(){return db;},get state(){return state;},
    set busy(v){busy=v;},set authorized(v){authorized=v;},
    async restart() { session?.dispose(); db.close(); db=new DatabaseSync(database); db.exec('PRAGMA foreign_keys=ON');
      state=attach(db); await state.migrate(); manager=SessionManager.open(file,directory,workspace); },
    assertHistory() { assert.equal(manager.getSessionId(),initial.nativeSessionId);
      assert.equal(sha(JSON.stringify(manager.getEntries().filter(entry=>entry.type==='message'))),originalMessages);
      assert.equal(JSON.stringify(manager.getEntries().find(entry=>entry.type==='custom'&&entry.customType==='xiaozhi.education.snapshot.v1')),originalSnapshot); },
    close() { session?.dispose(); db.close(); } };
  fixtures.push(instance); return instance;
}
const check = async (name,action) => { await action(); checks.push({ name,pass:true }); };
try {
  await check('Real native setModel round trip preserves exact JSONL messages, header and creation fingerprint',async()=>{
    const f=await fixture(); let identity=await f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro));
    assert.equal(identity.model,pro); assert.equal(identity.revision,3); f.assertHistory();
    await f.restart(); identity=await f.coordinator().recover(f.manager,f.sessionId); await f.load(pro);
    assert.equal(f.session.messages.length,2); assert(f.session.messages[0].content.includes('TEST-EDU-317'));
    identity=await f.coordinator().switch(f.session,identity,f.registry.find(provider,flash));
    assert.equal(identity.model,flash); assert.equal(identity.revision,4); f.assertHistory();
    assert.deepEqual({...f.db.prepare('SELECT schema_version,model FROM xiaozhi_pi_session_bindings').get()},{schema_version:5,model:flash});
    await f.restart(); await f.coordinator().recover(f.manager,f.sessionId); f.assertHistory();
    assert.equal((await f.state.transitions(f.sessionId)).filter(row=>row.status==='committed').length,2);
  });
  for(const stage of ['prepared','intent','native','receipt','committed']) {
    await check(`Crash after ${stage}: reopen real native file and SQLite, recover once, no replay on second recovery`,async()=>{
      const f=await fixture();
      await assert.rejects(f.coordinator(async actual=>{if(actual===stage)throw new Error('simulated-exit');}).switch(f.session,f.initial,f.registry.find(provider,pro)),/simulated-exit/);
      await f.restart(); const recovered=await f.coordinator().recover(f.manager,f.sessionId);
      const committed=['native','receipt','committed'].includes(stage);
      assert.equal(recovered.model,committed?pro:flash); assert.equal(recovered.revision,committed?3:2);
      const before=sha(fs.readFileSync(f.file)); assert.deepEqual(await f.coordinator().recover(f.manager,f.sessionId),recovered);
      assert.equal(sha(fs.readFileSync(f.file)),before); f.assertHistory();
      assert.equal((await f.state.transitions(f.sessionId))[0].status,committed?'committed':'aborted');
      await f.load(recovered.model); assert.equal(f.session.messages.length,2);
    });
  }
  await check('Aborted pre-native intent allows a later native switch without resurrecting old request',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{if(stage==='intent')throw new Error('exit');}).switch(f.session,f.initial,f.registry.find(provider,pro)),/exit/);
    await f.restart(); await f.coordinator().recover(f.manager,f.sessionId); await f.load();
    assert.equal((await f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro))).model,pro); f.assertHistory();
  });
  await check('Concurrent durable prepare and stale CAS rejected across independent SQLite handles',async()=>{
    const f=await fixture(), secondDb=new DatabaseSync(f.database), second=attach(secondDb);
    try { const first=await f.state.prepare(f.initial,pro); await assert.rejects(second.prepare(f.initial,pro),/conflict/);
      await f.state.abort(first); const next=await second.prepare(f.initial,pro); await second.abort(next);
      await assert.rejects(second.prepare({...f.initial,revision:1},pro),/conflict/); } finally{secondDb.close();}
  });
  await check('Binding conflict rolls back transition and ledger in the same SQLite statement',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{
      if(stage==='receipt') f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET model=?').run('foreign-model');
    }).switch(f.session,f.initial,f.registry.find(provider,pro)),/conflict/);
    assert.equal(f.db.prepare('SELECT current_model,revision FROM xiaozhi_pi_model_state').get().current_model,flash);
    assert.equal(f.db.prepare('SELECT status FROM xiaozhi_pi_model_transitions').get().status,'prepared');
    f.db.prepare('UPDATE xiaozhi_pi_session_bindings SET model=?').run(flash); await f.restart();
    assert.equal((await f.coordinator().recover(f.manager,f.sessionId)).model,pro); f.assertHistory();
  });
  await check('Archiving between native receipt and commit atomically rejects, never unarchives or aborts actual native change',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{if(stage==='receipt')f.db.prepare('UPDATE ai_conversation_sessions SET archived_at=?').run('owned-archive');}).switch(f.session,f.initial,f.registry.find(provider,pro)),/conflict/);
    assert.equal(f.db.prepare('SELECT current_model FROM xiaozhi_pi_model_state').get().current_model,flash);
    assert.equal(f.db.prepare('SELECT model FROM xiaozhi_pi_session_bindings').get().model,flash);
    await f.restart(); await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/conflict/); f.assertHistory();
  });
  await check('Runtime host lock, permission denial and Hana target context guard reject before native intent',async()=>{
    const f=await fixture(); f.busy=true; await assert.rejects(f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro)),/busy/);
    f.busy=false; f.authorized=false; await assert.rejects(f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro)),/permission_denied/); f.authorized=true;
    await assert.rejects(f.coordinator().switch(f.session,f.initial,{...f.registry.find(provider,pro),contextWindow:100}),/context_limit/);
    assert.equal((await f.state.transitions(f.sessionId)).length,0); f.assertHistory();
  });
  await check('Hana uses current context usage and token-estimation fallback with its original capacity reserve',async()=>{
    assert.throws(()=>assertHanaModelSwitchContext({ getContextUsage:()=>({tokens:50000}),agent:{state:{messages:[]}} },{contextWindow:50000}),error=>error.code==='MODEL_CONTEXT_TOO_LARGE' && error.effectiveWindow===41000);
    assertHanaModelSwitchContext({ getContextUsage:()=>({tokens:NaN}),agent:{state:{messages:[{role:'user',content:'short',timestamp:0}]}} },{contextWindow:50000});
  });
  await check('Unrecorded native model_change cannot be accepted because it matches a target model string',async()=>{
    const f=await fixture(); f.manager.appendModelChange(provider,pro); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/); assert.equal((await f.state.current(f.sessionId)).model,flash);
  });
  await check('Native mutation throwing after appendModelChange is recoverable without calling setModel again',async()=>{
    const f=await fixture(), original=f.session.setModel.bind(f.session);
    f.session.setModel=async model=>{await original(model); throw new Error('post-native-event-failure');};
    await assert.rejects(f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro)),/post-native-event-failure/);
    await f.restart(); assert.equal((await f.coordinator().recover(f.manager,f.sessionId)).model,pro); f.assertHistory();
  });
  await check('Foreign native identity/file and unsafe saved path rejected without mutating history',async()=>{
    const a=await fixture(), b=await fixture(); await assert.rejects(a.coordinator().recover(b.manager,a.sessionId),/configuration/);
    a.db.prepare('UPDATE xiaozhi_pi_model_state SET session_file=?').run('../outside.jsonl');
    await assert.rejects(a.coordinator().recover(a.manager,a.sessionId),/configuration/); a.assertHistory(); b.assertHistory();
  });
  await check('Altered native receipt rejected with ledger unchanged',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{if(stage==='receipt')throw new Error('exit');}).switch(f.session,f.initial,f.registry.find(provider,pro)),/exit/);
    f.session.dispose(); const entries=fs.readFileSync(f.file,'utf8').trimEnd().split('\n').map(JSON.parse);
    const receipt=entries.find(entry=>entry.customType==='xiaozhi.model-switch.commit.v1'); receipt.data.revision++;
    fs.writeFileSync(f.file,entries.map(entry=>JSON.stringify(entry)).join('\n')+'\n'); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/); assert.equal((await f.state.current(f.sessionId)).model,flash);
  });
  await check('Unexpected user/tool/compaction history inside a pending idle switch cannot be adopted',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{if(stage==='native')throw new Error('exit');}).switch(f.session,f.initial,f.registry.find(provider,pro)),/exit/);
    f.manager.appendMessage({role:'user',content:'unexpected concurrent turn',timestamp:Date.now()}); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/);
    assert.equal((await f.state.current(f.sessionId)).model,flash);
  });
  await check('Ledger revision conflict rolls back binding and transition, recovery requires exact original revision',async()=>{
    const f=await fixture(); await assert.rejects(f.coordinator(async stage=>{if(stage==='receipt')f.db.prepare('UPDATE xiaozhi_pi_model_state SET revision=99').run();}).switch(f.session,f.initial,f.registry.find(provider,pro)),/conflict/);
    assert.equal(f.db.prepare('SELECT status FROM xiaozhi_pi_model_transitions').get().status,'prepared');
    assert.equal(f.db.prepare('SELECT model FROM xiaozhi_pi_session_bindings').get().model,flash);
    await f.restart(); await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/);
    f.db.prepare('UPDATE xiaozhi_pi_model_state SET revision=2').run(); assert.equal((await f.coordinator().recover(f.manager,f.sessionId)).model,pro);
  });
  await check('Authority isolation branch cannot silently restore removed model markers or old messages in B1',async()=>{
    const f=await fixture(); await f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro));
    const origin=f.manager.getEntries().find(entry=>entry.type==='model_change'); f.manager.branch(origin.id);
    f.manager.appendCustomEntry('owned-authority-isolation',{revoked:true}); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/); f.assertHistory();
  });
  await check('Unknown ledger schema and malformed native IDs fail closed',async()=>{
    const f=await fixture(); f.db.prepare('UPDATE xiaozhi_pi_model_state SET native_session_id=?').run('not-a-native-session');
    await assert.rejects(f.state.current(f.sessionId),/configuration/);
    assert.throws(()=>f.db.prepare('UPDATE xiaozhi_pi_model_state SET schema_version=2').run(),/CHECK/);
  });
  await check('Already-selected model is a real no-op with no new native entries or revision bump',async()=>{
    const f=await fixture(), before=sha(fs.readFileSync(f.file));
    assert.deepEqual(await f.coordinator().switch(f.session,f.initial,f.registry.find(provider,flash)),f.initial);
    assert.equal(sha(fs.readFileSync(f.file)),before); assert.equal((await f.state.transitions(f.sessionId)).length,0);
  });
  await check('Damaged native JSONL cannot be silently tolerated by SDK during identity mutation',async()=>{
    const f=await fixture(); fs.appendFileSync(f.file,'{damaged-partial-record\n'); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/);
    assert.equal((await f.state.transitions(f.sessionId)).length,0);
  });
  await check('A stale cached manager cannot overwrite or adopt another file writer',async()=>{
    const f=await fixture(), foreign=SessionManager.open(f.file,path.dirname(f.file),path.join(f.root,f.sessionId,'workspace'));
    foreign.appendCustomEntry('owned-concurrent-writer',{version:1});
    await assert.rejects(f.coordinator().switch(f.session,f.initial,f.registry.find(provider,pro)),/configuration/);
    assert.equal((await f.state.transitions(f.sessionId)).length,0);
  });
  await check('Duplicate IDs and cyclic parents rejected before native branch traversal',async()=>{
    const f=await fixture(); const lines=fs.readFileSync(f.file,'utf8').trimEnd().split('\n').map(JSON.parse);
    const last=lines.at(-1); last.parentId=last.id;
    fs.writeFileSync(f.file,lines.map(row=>JSON.stringify(row)).join('\n')+'\n'); await f.restart();
    await assert.rejects(f.coordinator().recover(f.manager,f.sessionId),/configuration/);
  });
  await check('All actual native switching and recovery instances make zero provider requests',async()=>assert.equal(networkRequests,0));
  await check('Neither transition persistence nor native history contains the synthetic credential',async()=>{
    for(const f of fixtures) { assert(!fs.readFileSync(f.file,'utf8').includes('synthetic-key-not-a-live-credential'));
      assert(!JSON.stringify(f.db.prepare('SELECT * FROM xiaozhi_pi_model_transitions').all()).includes('synthetic-key-not-a-live-credential')); }
  });
  report.success=true;
} catch(error) { report.error={name:error.name,message:error.message,stack:error.stack}; process.exitCode=1; }
finally { globalThis.fetch=noFetch; for(const f of fixtures) f.close(); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); }
console.log(JSON.stringify({ output,success:report.success,checks:checks.length,networkRequests,...(report.error?{error:report.error}:{}) },null,2));
