import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright';

const [build,acceptance]=process.argv.slice(2);
assert(path.isAbsolute(build??'')&&path.isAbsolute(acceptance??''));
const main=fs.realpathSync(path.join(build,'main/index.js'));
const root=fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-environment-refusal-'));
const require=createRequire(import.meta.url);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,root,mainHash:sha(main),checks:[]};
const desktop=path.resolve(import.meta.dirname,'../..');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>
  !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',
  OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),TEMP:root,TMP:root});
const bootstrap=path.join(root,'intercept-observation.cjs');
fs.writeFileSync(bootstrap,String.raw`
const {app,dialog,net}=require('electron'),fs=require('node:fs');
const observations=globalThis.environmentAcceptance={calls:[],messages:[]};
net.fetch=async (input,init)=>{
  const item=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(process.env.OMNI_EDU_PROVIDER_ENV_MODEL==='1'&&item.origin==='https://api.deepseek.com'){
    if(item.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
      id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']
    }]}),{headers:{'content-type':'application/json'}});
    if(item.pathname==='/v1/chat/completions'){
      const body=JSON.parse(init.body),attempt=observations.calls.length;
      observations.calls.push('owned synthetic model response');
      if(attempt>1)throw Error('Unexpected model replay in refusal test');
      if(!body.tools?.some(tool=>tool.function.name==='environment_repair'))throw Error('The real recipe tool must be visible');
      const tool={name:'environment_repair',arguments:JSON.stringify({recipe:'disable_permissions',expectedHash:null})};
      const delta=attempt?{role:'assistant',content:'保持现有授权和文件。'}:{role:'assistant',tool_calls:[
        {index:0,id:'ac26_invalid_recipe',type:'function',function:tool}
      ]};
      const chunk=(delta,reason)=>'data: '+JSON.stringify({id:'ac26-'+attempt,object:'chat.completion.chunk',created:1,model:body.model,
        choices:[{index:0,delta,finish_reason:reason}]})+'\n\n';
      return new Response(chunk(delta,null)+chunk({},attempt?'stop':'tool_calls')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    }
  }
  observations.calls.push(item.origin);
  throw Error('The fixture prohibits network side effects');
};
dialog.showErrorBox=(title,message)=>{
  observations.messages.push({title,message});
  fs.writeFileSync(process.env.OMNI_EDU_PROVIDER_ENV_OBS,JSON.stringify(observations));
};
import(${JSON.stringify(pathToFileURL(main).href)}).catch(error=>{console.error(error.stack);app.exit(2);});
`,{flag:'wx'});
let app;
function readFacts(data){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return Object.fromEntries(['ai_agent_runs','xiaozhi_permission_audit_v1','xiaozhi_effects_v1'].map(name=>
    [name,db.prepare('SELECT count(*) AS n FROM '+name).get().n]));}finally{db.close();}
}
try{
  const data=path.join(root,'data'),workspace=path.join(root,'workspace'),profile=path.join(root,'profile');
  fs.mkdirSync(path.join(workspace,'.xiaozhi'),{recursive:true});
  const settings=path.join(workspace,'.xiaozhi/environment.json'),original=path.join(workspace,'原资料.txt');
  fs.writeFileSync(settings,'{"schemaVersion":1,"private":"synthetic-keep"}');
  fs.writeFileSync(original,'只在验收目录使用的合成教学文件');
  const originalHash=sha(original),settingsHash=sha(settings);
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,
    env:{...env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_PROVIDER_ENV_OBS:path.join(root,'normal-startup-error.json')},timeout:60_000});
  const page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();
  await app.evaluate(({dialog},local)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[local]});},workspace);
  const session=await page.evaluate(async()=>{
    const {session}=await window.omniEdu.createAiConversationSession({title:'固定环境修复拒绝',folderId:null});
    const selected=await window.omniEdu.selectXiaozhiWorkspace(session.id);
    if(!selected.ok)throw Error(JSON.stringify(selected));
    return session.id;
  });
  report.view=await page.evaluate(id=>window.omniEdu.getXiaozhiEnvironment(id),session);
  assert(report.view.ok);
  assert(report.view.value.checks.some(check=>check.id==='model_credential'&&check.status==='missing_credential'&&/安全输入/u.test(check.detail)));
  const before=readFacts(data);
  report.refused=await page.evaluate(async id=>Promise.all(['repair_database','download_unknown','disable_permissions'].map(recipe=>
    window.omniEdu.repairXiaozhiEnvironment(id,recipe))),session);
  assert.deepEqual(report.refused,Array.from({length:3},()=>({ok:false,error:'permission_denied'})));
  assert.deepEqual(readFacts(data),before);
  assert.deepEqual((await app.evaluate(()=>globalThis.environmentAcceptance)).calls,[]);
  assert.equal(sha(settings),settingsHash);
  assert.equal(sha(original),originalHash);
  report.checks.push('The actual preload rejects unknown sources and policy-changing recipes with no run, Effect, file or network change');
  await app.close();
  app=undefined;

  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,
    env:{...env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_PROVIDER_ENV_MODEL:'1',DEEPSEEK_API_KEY:'owned-synthetic-no-external',
      DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_PROVIDER_ENV_OBS:path.join(root,'model-startup-error.json')},timeout:60_000});
  const modelPage=await app.firstWindow();
  await modelPage.getByTestId('office-prompt-input').waitFor();
  const started=await modelPage.evaluate(async id=>window.omniEdu.startXiaozhi({sessionId:id,
    commandId:'xicmd_'+crypto.randomUUID(),prompt:'核查合成环境配置，保持教师的有效授权。'}),session);
  assert(started.ok,JSON.stringify(started));
  const modelDeadline=Date.now()+35_000;
  let failedTool;
  while(Date.now()<modelDeadline){
    const state=await modelPage.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
    const turn=state.projection.turns.find(item=>item.id===started.runId);
    if(!state.running&&turn&&turn.status!=='running'){
      failedTool=turn.items.find(item=>item.kind==='tool'&&item.toolName==='environment_repair');
      report.model={runId:started.runId,turn:turn.status,tool:failedTool};
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,80));
  }
  assert(failedTool&&failedTool.status!=='completed','The model-proposed policy change must receive a real failed tool receipt');
  assert.equal(readFacts(data).xiaozhi_effects_v1,before.xiaozhi_effects_v1);
  assert.equal(sha(settings),settingsHash);
  assert.equal(sha(original),originalHash);
  assert((await app.evaluate(()=>globalThis.environmentAcceptance)).calls.every(call=>call==='owned synthetic model response'));
  report.checks.push('Real Pi and the frozen recipe tool reject a model-proposed policy change while preserving original files and Effects');
  await app.close();
  app=undefined;

  const corrupt=path.join(root,'corrupt'),cold=path.join(root,'corrupt-profile');
  fs.mkdirSync(corrupt);
  const originalDb=path.join(corrupt,'app.db'),observed=path.join(root,'failed-startup.json');
  fs.writeFileSync(originalDb,'Owned synthetic invalid SQLite bytes. Preserve exactly.',{flag:'wx'});
  const beforeHash=sha(originalDb),logs=[];
  const child=spawn(require('electron'),[bootstrap,'--user-data-dir='+cold],{cwd:desktop,windowsHide:true,
    env:{...env,OMNI_EDU_DATA_ROOT:corrupt,OMNI_EDU_PROVIDER_ENV_OBS:observed},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{if(logs.length<128)logs.push(bytes);});
  const timer=setTimeout(()=>child.kill(),30_000);
  let exit;
  try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,pid:child.pid}));});}
  finally{clearTimeout(timer);fs.writeFileSync(path.join(root,'failed-startup.log'),Buffer.concat(logs));}
  assert.equal(exit.code,1);
  assert.equal(exit.signal,null);
  assert.equal(sha(originalDb),beforeHash);
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  const visible=read(observed),diagnostic=read(path.join(cold,'xiaozhi-database-startup.json'));
  assert.deepEqual(visible.calls,[]);
  assert.match(visible.messages[0]?.title??'',/数据库未打开/u);
  assert.match(visible.messages[0]?.message??'',/备份|诊断/u);
  assert(diagnostic.issue);
  report.database={exit,sha256:beforeHash,visible,diagnostic};
  report.checks.push('Real cold startup stops on corrupt SQLite, preserves original bytes and surfaces the existing backup and diagnostics entry');
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));
}
