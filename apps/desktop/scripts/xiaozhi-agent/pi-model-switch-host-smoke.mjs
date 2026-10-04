import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {createModelSettingsApi}=await import('../../src/main/xiaozhi-agent/model-settings-api.ts');
const root=path.resolve('test-results/xiaozhi-agent'),source=fs.realpathSync(path.resolve(process.argv[2] || 'test-results/xiaozhi-agent/pi-history-model-ui-oHn5iY/data'));
assert(!path.relative(root,source).startsWith('..')&&path.basename(source)==='data');
const output=fs.mkdtempSync(path.join(root,'pi-model-switch-host-')),checks=[],fixtures=[];
const sha=v=>createHash('sha256').update(v).digest('hex'),sourceHash=sha(fs.readFileSync(path.join(source,'app.db')));
const report={success:false,checks,boundary:'Actual production host/service/SDK/SQLite/JSONL; owned real-UI data copy and controlled official catalogue, no provider completions claimed'};
const fetchBefore=globalThis.fetch;let officialRemoved=false,requests=0;
globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://api.deepseek.com/v1/models');assert.equal(options.method||'GET','GET');assert.equal(new Headers(options.headers).get('authorization'),'Bearer synthetic-non-live-key');requests++;
  return new Response(JSON.stringify({object:'list',data:(officialRemoved?['deepseek-flash']:['deepseek-flash','deepseek-v4-pro']).map(id=>({id,name:id,context_window:1048576,max_output_tokens:393216}))}),{status:200});};
async function fixture(options={}){
  const data=fs.mkdtempSync(path.join(output,'owned-'));fs.cpSync(source,data,{recursive:true});
  const db=new DatabaseSync(path.join(data,'app.db'));let state=createXiaozhiSessionState({run:async(sql,v=[])=>db.prepare(sql).run(...v),change:async(sql,v=[])=>Number(db.prepare(sql).run(...v).changes),all:async(sql,v=[])=>db.prepare(sql).all(...v)});await state.init();
  const id=db.prepare('SELECT conversation_id FROM xiaozhi_pi_model_state LIMIT 1').get().conversation_id;
  const store={xiaozhiState:state,getDeepSeekRuntimeSettings:async()=>({provider:'deepseek',model:'deepseek-flash',apiKey:'synthetic-non-live-key'}),
    getAiConversationSession:async id=>{const row=db.prepare('SELECT * FROM ai_conversation_sessions WHERE id=?').get(id);assert(row);
      return{session:{id,title:row.title,archivedAt:row.archived_at||''},messages:db.prepare('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at').all(id).map(row=>({...row,metadata:JSON.parse(row.metadata_json)}))};},
    sanitizeProblemText:async text=>({sanitizedText:text}),getAiMemoryDocument:async()=>({entries:[]}),getAiMemoryL3Document:async()=>({entries:[]})};
  let host,api;const emitted=[];
  function launch(extra={}){host=createXiaozhiProductionHost({store,dataRoot:data,emit:event=>emitted.push(event),settingsCodec:{available:()=>true,open:()=> 'synthetic-non-live-key',seal:()=> 'synthetic'},...options,...extra});api=createModelSettingsApi(host);}
  launch();
  const counts=()=>({messages:db.prepare('SELECT count(*) AS n FROM ai_conversation_messages').get().n,runs:db.prepare('SELECT count(*) AS n FROM ai_agent_runs').get().n,approvals:db.prepare("SELECT count(*) AS n FROM ai_confirmation_items WHERE action_type='pi_office_copy'").get().n});
  const select=async model=>{const view=await host.modelSettingsView({sessionId:id});return api.select({schemaVersion:'xiaozhi.settings.v1',sessionId:id,version:view.sessionModel.version,model});};
  const f={data,db,id,state,store,emitted,launch,counts,select,get host(){return host;},get api(){return api;},
    async close(){await host.close();db.close();}};fixtures.push(f);return f;
}
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
try{
  await check('Real production host exposes unlocked bound selection and changes model without a new run, message or approval',async()=>{
    const f=await fixture(),before=f.counts(),view=await f.host.modelSettingsView({sessionId:f.id});assert(!view.sessionModel.locked);assert.equal(view.sessionModel.version,2);
    const value=await f.host.selectSessionModel({schemaVersion:'xiaozhi.settings.v1',sessionId:f.id,version:view.sessionModel.version,model:'deepseek-v4-pro'});
    assert.equal(value.model,'deepseek-v4-pro');assert.equal(value.version,3);
    assert.deepEqual(f.counts(),before);assert.equal(f.emitted.length,0);assert.equal((await f.state.getBinding(f.id)).model,'deepseek-v4-pro');
    const stale=await f.api.select({schemaVersion:'xiaozhi.settings.v1',sessionId:f.id,version:2,model:'deepseek-flash'});assert(!stale.ok&&stale.error==='conflict');
    await assert.rejects(f.state.setBinding(f.id,(await f.state.getBinding(f.id)).sessionFile,'foreign-model',4),/configuration/);
  });
  await check('Native switch exit after mutation is recovered by public snapshot without a credential or prompt',async()=>{
    const f=await fixture({afterModelSwitchStage:async stage=>{if(stage==='native')throw new Error('owned-exit');}}),before=f.counts();
    const failed=await f.select('deepseek-v4-pro');assert(!failed.ok&&failed.error==='configuration');
    assert.equal((await f.state.getBinding(f.id)).model,'deepseek-flash');
    const snapshot=await f.host.snapshot(f.id);assert.equal(snapshot.projection.model,'deepseek-v4-pro');assert.equal((await f.state.modelSwitch.current(f.id)).revision,3);
    const transitions=await f.state.modelSwitch.transitions(f.id);assert.equal(transitions.at(-1).status,'committed');assert.deepEqual(f.counts(),before);assert.equal(f.emitted.length,0);
  });
  await check('Exit before native intent aborts only the unexecuted selection and retains source on restart',async()=>{
    const f=await fixture({afterModelSwitchStage:async stage=>{if(stage==='prepared')throw new Error('owned-exit');}}),before=f.counts();
    assert(!(await f.select('deepseek-v4-pro')).ok);await f.host.close();f.launch({afterModelSwitchStage:undefined});
    assert.equal((await f.host.snapshot(f.id)).projection.model,'deepseek-flash');assert.equal((await f.state.modelSwitch.transitions(f.id)).at(-1).status,'aborted');
    assert((await f.select('deepseek-v4-pro')).ok);assert.deepEqual(f.counts(),before);
  });
  await check('Close waits for native mutation ownership, blocks late commit and next host recovers without replay',async()=>{
    let entered,release;const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
    const f=await fixture({afterModelSwitchStage:async stage=>{if(stage==='native'){entered();await gate;}}}),before=f.counts();
    const selection=f.select('deepseek-v4-pro');await ready;let closed=false;const closing=f.host.close().then(()=>closed=true);
    await new Promise(resolve=>setTimeout(resolve,20));assert(!closed);release();const failed=await selection;await closing;assert(!failed.ok&&failed.error==='busy');
    assert.equal((await f.state.modelSwitch.transitions(f.id)).at(-1).status,'prepared');f.launch({afterModelSwitchStage:undefined});
    assert.equal((await f.host.snapshot(f.id)).projection.model,'deepseek-v4-pro');assert.deepEqual(f.counts(),before);
  });
  await check('Archive during model receipt refuses commit and recovery, never reactivates archived conversation',async()=>{
    const f=await fixture({afterModelSwitchStage:async stage=>{if(stage==='receipt')f.db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('owned-archive',f.id);}}),before=f.counts();
    const result=await f.select('deepseek-v4-pro');assert(!result.ok&&result.error==='permission_denied');
    assert.equal((await f.state.modelSwitch.current(f.id)).model,'deepseek-flash');await assert.rejects(f.host.snapshot(f.id),/permission_denied/);
    assert.equal(f.db.prepare('SELECT archived_at FROM ai_conversation_sessions WHERE id=?').get(f.id).archived_at,'owned-archive');assert.deepEqual(f.counts(),before);
  });
  await check('Official model removal refuses selection before native intent or registry mutation',async()=>{
    const f=await fixture(),before=f.counts();officialRemoved=true;const result=await f.select('deepseek-v4-pro');officialRemoved=false;
    assert(!result.ok&&result.error==='model_unavailable');assert.equal((await f.state.modelSwitch.current(f.id)).revision,2);
    assert.equal((await f.state.modelSwitch.transitions(f.id)).length,2);assert.deepEqual(f.counts(),before);
  });
  await check('Complete request capacity failure keeps the real source model and has a stable typed UI error',async()=>{
    const f=await fixture({testContextWindow:100}),before=f.counts();const result=await f.select('deepseek-v4-pro');assert(!result.ok&&result.error==='context_limit');
    assert.equal((await f.state.modelSwitch.current(f.id)).model,'deepseek-flash');assert.equal((await f.state.modelSwitch.transitions(f.id)).length,2);assert.deepEqual(f.counts(),before);
  });
  await check('Migration adds baseline to a prior B1 model table idempotently without altering model/history facts',async()=>{
    const f=await fixture(),before=f.counts(),identity=await f.state.modelSwitch.current(f.id);
    f.db.exec('ALTER TABLE xiaozhi_pi_model_state DROP COLUMN baseline_entries_json');await f.state.init();await f.state.init();
    assert.deepEqual(await f.state.modelSwitch.baseline(f.id),[]);assert.deepEqual(await f.state.modelSwitch.current(f.id),identity);assert.deepEqual(f.counts(),before);
  });
  await check('All idle host scenarios preserve the original owned UI source database',async()=>assert.equal(sha(fs.readFileSync(path.join(source,'app.db'))),sourceHash));report.success=true;
}catch(error){report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally{globalThis.fetch=fetchBefore;for(const f of fixtures)await f.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output,success:report.success,checks:checks.length,officialRequests:requests,...(report.error?{error:report.error}:{})},null,2));
