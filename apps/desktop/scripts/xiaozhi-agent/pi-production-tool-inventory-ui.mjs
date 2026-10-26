import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {toolManifest} from '../../src/main/xiaozhi-agent/tools/manifest.ts';

// Formal host, SDK and provider are unchanged. Only registration and transport
// observers are installed in the owned Electron process; no fake tool responses.
const desktop=process.cwd(),main=testMain(desktop),buildRoot=path.dirname(path.dirname(main));
assert(buildRoot.startsWith(path.join(desktop,'test-results')+path.sep));
const frozen=fingerprint(buildRoot),sourceBuild=JSON.parse(fs.readFileSync(path.join(path.dirname(buildRoot),'build-isolated.json')));
assert.equal(frozen.sha256,sourceBuild.sha256);
for(const s of sourceBuild.source)assert.equal(sha256(fs.readFileSync(s.file)),s.currentSha256,'Frozen Harness source drift: '+s.file);
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-production-tool-inventory-ui-'));
const report={success:false,checks:[],variants:[],build:{root:buildRoot,files:frozen.files.length,sha256:frozen.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),layer:'C: isolated formal Electron, real SDK and DeepSeek',humanAccepted:false,boundaries:[
 'Only fresh owned profiles and synthetic text/student setup; no real student images or private files uploaded.',
 'Native directory chooser returns owned folders. Existing typed web/output/student setup is fixture preparation, not acceptance of its settings/create UI.',
 'Production AgentSession active definitions and actual request schemas observed without changing SDK, provider payload, responses or dispatcher.',
 'Registration and successful blind-code round are not functional acceptance of every registered domain tool; per-tool behavior evidence is reported separately.',
 'VPN/proxy left running as reported by user; no system configuration, daily profile, installer or VPN-off claim.'
]};
let app,page,id,data,profile,mainPid,variant;
const errors=[],check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
async function until(fn,ms=180000){const end=Date.now()+ms;let transient=0;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){if(!/Resulting promise was garbage collected/.test(String(e))||++transient>3)throw e;process.kill(mainPid,0);(variant.observerTransients??=[]).push(String(e));}await new Promise(r=>setTimeout(r,125));}throw Error('Formal production inventory timed out: '+variant.name);}
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const query=(sql,params=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...params);}finally{db.close();}};
const observe=()=>app.evaluate(()=>({sdk:globalThis.productionInventorySdk,requests:globalThis.productionInventoryRequests}));
function native(){const binding=query('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0];assert(binding);const file=path.join(data,'xiaozhi-pi',binding.session_file),bytes=fs.readFileSync(file);return{file,bytes,rows:bytes.toString('utf8').split('\n').filter(Boolean).map(JSON.parse)};}
async function launch(){
 const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});mainPid=await app.evaluate(()=>process.pid);page=await app.firstWindow();
 page.on('pageerror',e=>errors.push(String(e).replaceAll(key,'[redacted]')));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 (variant.launches??=[]).push(await assertIsolatedPiMain(app,main,profile));
 id=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await app.evaluate(async({net},sdkUrl)=>{
  globalThis.productionInventorySdk=[];globalThis.productionInventoryRequests=[];
  // Playwright's evaluate context has no ESM callback. Use Node's original
  // loader in the main VM; this imports the same cached production SDK module.
  const vm=process.getBuiltinModule('vm');
  const {AgentSession}=await vm.runInThisContext('import('+JSON.stringify(sdkUrl)+')',{importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  const originalActive=AgentSession.prototype.getActiveToolNames;
  AgentSession.prototype.getActiveToolNames=function(...args){
   const names=originalActive.apply(this,args),definitions=this.getAllTools().filter(d=>names.includes(d.name)).map(d=>({name:d.name,description:d.description,parameters:JSON.parse(JSON.stringify(d.parameters))}));
   const entry={names,definitions},signature=JSON.stringify(entry);
   if(!globalThis.productionInventorySdk.some(v=>v.signature===signature))globalThis.productionInventorySdk.push({...entry,signature});
   return names;
  };
  const original=net.fetch.bind(net);
  net.fetch=async function(...args){
   const url=typeof args[0]==='string'?args[0]:args[0]?.url;let record;
   if(typeof url==='string'&&new URL(url).hostname==='api.deepseek.com'&&/\/chat\/completions(?:\?|$)/.test(url)&&typeof args[1]?.body==='string'){
    const body=JSON.parse(args[1].body);record={model:body.model,tools:(body.tools||[]).map(t=>t.function),status:null};globalThis.productionInventoryRequests.push(record);
   }
   try{const response=await original(...args);if(record)record.status=response.status;return response;}catch(e){if(record)record.errorName=e.name;throw e;}
  };
 },import.meta.resolve('@earendil-works/pi-coding-agent'));
}
const chooser=dir=>app.evaluate(({dialog},dir)=>{const original=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return{canceled:false,filePaths:[dir]};};},dir);
async function setup(config){
 if(config.student){
  const result=await page.evaluate(async()=>{const students=await window.omniEdu.createStudent({displayName:'合成注册核验学生',grade:'七年级',subjects:['数学']});const student=students.find(s=>s.displayName==='合成注册核验学生');if(!student)throw Error('Synthetic student setup missing');const detail=await window.omniEdu.createStudentConversation({schemaVersion:'xiaozhi.education.student-context.v1',studentId:student.id});return{studentId:student.id,sessionId:detail.session.id};});
  variant.studentSetup=result;id=result.sessionId;await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  await page.getByTestId('ai-conversation-session-'+id).click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===id);
  assert.equal((await snap()).studentContext.id,result.studentId);
 }
 const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());assert(settings.ok);
 const web=await page.evaluate(v=>window.omniEdu.saveXiaozhiWebSettings({schemaVersion:'xiaozhi.web.v1',...v}),{...settings.value.web,enabled:config.web});assert(web.ok);assert.equal(web.value.enabled,config.web);
 if(config.workspace){
  const working=path.join(path.dirname(data),'teacher-work');fs.mkdirSync(working);fs.writeFileSync(path.join(working,'synthetic.txt'),'合成注册核验资料。');
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByTestId('pi-settings-workspace').waitFor();await page.getByTestId('pi-settings-tab-permissions').click();
  await chooser(working);await page.getByTestId('pi-settings-workspace-choose').click();await until(async()=>(await snap()).workspace?.label==='teacher-work');
  await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
 }
 if(config.output){
  const dir=path.join(path.dirname(data),'output-only');fs.mkdirSync(dir);await chooser(dir);
  const chosen=await page.evaluate(id=>window.omniEdu.selectPaperOutput({schemaVersion:'xiaozhi.paper-output.v1',sessionId:id}),id);assert(chosen.ok);
  await until(async()=>(await snap()).paperOutput?.label==='output-only');assert(!(await snap()).workspace);
 }
 variant.configuration={...config,sessionId:id,workspace:(await snap()).workspace,paperOutput:(await snap()).paperOutput,web:web.value};
}
async function run(config){
 const code='EDUTOOLS'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase();variant.blindCode=code;
 if(config.goal){
  await page.getByTestId('pi-goal-open').click();await page.getByTestId('pi-goal-objective').fill(`这是工具注册核验。请仅输出核验码${code}；然后实际调用report_goal_progress提交教师核对，最终回复保留此核验码。无须读取资料、联网或创建文件。`);
  await page.getByTestId('pi-goal-criteria').fill('最终回复完整保留核验码');await page.getByTestId('pi-goal-create').click();await page.getByTestId('pi-goal-dialog').waitFor({state:'hidden'});
 }else{
  await page.getByTestId('office-prompt-input').fill('这是连接及工具注册核验，不需要调用任何工具。请只回复核验码：'+code);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
 }
 assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
 const state=await until(async()=>{const s=await snap(),turn=s.projection.turns.at(-1);return !s.running&&turn&&['completed','failed','interrupted'].includes(turn.status)?s:undefined;});
 variant.turn=state.projection.turns.at(-1);variant.goal=state.goal;variant.observation=await observe();
 assert.equal(variant.turn.status,'completed',variant.turn.error);
 const text=variant.turn.items.filter(i=>i.kind==='message'&&i.role==='assistant'&&i.phase==='final_answer').map(i=>i.text).join('\n');assert(text.includes(code),text);
 const history=native();assert(history.rows.some(r=>r.message?.role==='assistant'&&JSON.stringify(r.message.content).includes(code)));
 const stored=query('SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?',[id,'assistant']).map(r=>JSON.parse(r.metadata_json));assert(stored.some(m=>m.agentRunId===variant.turn.id));
 variant.native={file:history.file,sha256:sha256(history.bytes)};
 check(config.name+': real compose/goal and DeepSeek blind-code reply persist through original native/SQLite');
 const {sdk,requests}=variant.observation;assert(sdk.length,'SDK registration observer must see the actual production AgentSession');assert(requests.length,'Observer must see actual DeepSeek transport');
 assert(requests.every(r=>r.status===200));
 for(const request of requests){
  const names=request.tools.map(t=>t.name);assert.equal(new Set(names).size,names.length);
  const registered=sdk.find(s=>JSON.stringify([...s.names].sort())===JSON.stringify([...names].sort()));assert(registered,'Actual provider tool set differs from SDK active definitions');
  for(const tool of request.tools){const d=registered.definitions.find(d=>d.name===tool.name);assert.equal(tool.description,d.description,tool.name);assert.deepEqual(canonical(tool.parameters),canonical(d.parameters),tool.name);}
 }
 const active=requests[0].tools.map(t=>t.name).sort();assert(requests.every(r=>JSON.stringify(r.tools.map(t=>t.name).sort())===JSON.stringify(active)),'Tool loadout unexpectedly changed within inventory task');
 assert(!active.some(n=>['bash','exec','edit','write','grep','find','ls','tool_search','spawn_agent'].includes(n)));
 for(const name of ['office_web_fetch','office_web_search','office_browser'])assert.equal(active.includes(name),config.web,name);
 for(const name of ['office_copy_file','office_create_text','office_edit_text','office_create_document','office_read_document'])assert.equal(active.includes(name),config.workspace,name);
 for(const name of ['education_export_paper','education_export_classroom'])assert.equal(active.includes(name),Boolean(config.workspace||config.output),name);
 assert.equal(active.includes('report_goal_progress'),Boolean(config.goal));
 variant.manifests=active.map(toolManifest);for(const m of variant.manifests){assert.equal(m.cancel,'signal_and_wait_bound');assert.equal(m.teacherWait,'pause_active_deadline');assert(m.timeoutMs>0&&m.timeoutMs<=300000);assert(m.maxAttempts===1||m.effect==='safe_read'&&['office_web_fetch','office_web_search'].includes(m.name)&&m.maxAttempts===2);if(m.effect!=='safe_read')assert.equal(m.maxAttempts,1);}
 check(config.name+': actual SDK/provider schemas match; permission-dependent tool sets and unique bounded manifest policies agree');
 if(config.goal){assert.equal(state.goal?.state,'review_required');assert(history.rows.some(r=>r.message?.role==='toolResult'&&r.message.toolName==='report_goal_progress'),'Goal must really call its original report tool');}
 const coldTurn=state.projection.turns,before=history.bytes,coldId=id;await app.close();app=undefined;
 await launch();assert.equal(id,coldId,'Cold current session must remain the selected inventory session');
 const cold=await snap();assert.deepEqual(cold.projection.turns,coldTurn);assert(fs.readFileSync(history.file).equals(before));assert.equal((await observe()).requests.length,0);assert(!cold.running);
 variant.cold={nativeUnchanged:true,projectionUnchanged:true,requestsAfterReady:0,earliestStartupObserved:false};
 await page.screenshot({path:path.join(path.dirname(data),'registered-and-restored.png')});
 check(config.name+': cold owned profile preserves original projection/native without replay after ready');
 await app.close();app=undefined;
}
try{
 for(const config of [
  {name:'private-web-off',workspace:false,web:false},
  {name:'teacher-workspace-web-on',workspace:true,web:true},
  {name:'output-only-web-off',workspace:false,output:true,web:false},
  {name:'student-workspace-web-goal',workspace:true,web:true,student:true,goal:true},
 ]){
  variant={name:config.name};report.variants.push(variant);const root=path.join(output,config.name);fs.mkdirSync(root);data=path.join(root,'data');profile=path.join(root,'profile');
  await launch();await setup(config);await run(config);fs.writeFileSync(path.join(root,'observed.json'),JSON.stringify(variant,null,2));
 }
 const grouped=new Map();for(const v of report.variants)for(const m of v.manifests){const item=grouped.get(m.name)||{manifest:m,variants:[],functionalAcceptance:'NOT_ESTABLISHED_BY_REGISTRATION'};assert.deepEqual(m,item.manifest);item.variants.push(v.name);grouped.set(m.name,item);}
 report.tools=[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>({name,...value}));assert(report.tools.length>35,'Full production inventory unexpectedly small');
 assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,frozen.sha256);for(const s of sourceBuild.source)assert.equal(sha256(fs.readFileSync(s.file)),s.currentSha256,'Harness changed during inventory');
 check('Full observed production union is explicit and source/build fingerprints remain frozen; no blanket domain acceptance');report.success=true;
}catch(e){report.error=String(e.stack||e).replaceAll(key,'[redacted]');process.exitCode=1;try{if(app){variant.observation=await observe();variant.snapshot=await snap();await page.screenshot({path:path.join(output,'failure.png')});}}catch{} }
finally{if(app)try{await app.close();}catch{}report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,tools:report.tools?.length,output,error:report.error}));}
