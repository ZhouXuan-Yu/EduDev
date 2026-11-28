import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './build-root.mjs';
import {confirmTeachingTarget} from './confirm-teaching-target.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const fixture=fs.realpathSync(process.argv[2]);
const bytes=fs.readFileSync(fixture);
const sha=data=>createHash('sha256').update(data).digest('hex');
const fixtureSha256=sha(bytes);
assert.equal(fixtureSha256,'53000255841392a5d3ef6cae264623d89e2326cfab6ac6fb114a19c28b4ade20');
const contract=JSON.parse(bytes);
const scenario=contract.cases.find(row=>row.id==='R3-FX-002');
assert.equal(scenario?.expectedBehavior,'save_only_r2');
assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT&&process.env.DEEPSEEK_API_KEY);
const source=process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA,main=testMain(desktop);
const buildSha256=sha(fs.readFileSync(main));
assert.match(source??'',/^[a-f0-9]{40}$/);
assert.equal(buildSha256,process.env.OMNI_EDU_R3_EVAL_BUILD_SHA256);
execFileSync('git',['diff','--exit-code',source,'--','src','package.json','package-lock.json',
  ':(exclude)src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json',
  ':(exclude)src/main/xiaozhi-agent/capabilities/generated/core-tool-static-definitions.json'],
  {cwd:desktop,stdio:'ignore'});
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'r3-frozen-preference-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const report={fixture:scenario.id,fixtureSha256,expected:scenario.expectedBehavior,
  exactRequest:scenario.teacherRequest,source,buildSha256,model:'deepseek-flash',ok:false};
let app,page;
async function until(probe,timeout=110000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const result=await probe();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('The requested desktop state did not settle');
}
const read=(sql,...arguments_)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).get(...arguments_);}
  finally{db.close();}
};
const preference=async()=>{
  const state=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
  assert(state.ok);
  return state.value.preference;
};
const snapshot=sessionId=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function launch(capture){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:report.model};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK',
    'OMNI_EDU_HISTORY_TOKEN','OMNI_EDU_R2_PYTHON'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000,
    executablePath:path.join(desktop,'node_modules/electron/dist/electron.exe')});
  if(capture)await app.evaluate(({net},teacherRequest)=>{
    const original=net.fetch.bind(net);
    globalThis.frozenPreferenceRequests=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return original(input,init);
      const payload=JSON.parse(init.body);
      const status={model:payload.model,
        exactTeacherRequest:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes(teacherRequest)),
        savedPreferenceReceipt:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('宿主已保存本次明确的长期表达偏好')),
        status:0};
      globalThis.frozenPreferenceRequests.push(status);
      const response=await original(input,init);
      status.status=response.status;
      return response;
    };
  },scenario.teacherRequest);
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('office-prompt-input').waitFor();
}
try{
  await launch(true);
  const sessionId=await until(async()=>{
    const id=await page.locator('.office-composer-container').getAttribute('data-session-id');
    return id?.startsWith('aisession_')?id:null;
  });
  report.confirmedScope=await confirmTeachingTarget(until,app,page,sessionId,scenario.taskScope);
  const baseline=await preference();
  assert.equal(baseline.values.handoutSectionOrder,undefined);
  assert.deepEqual((await snapshot(sessionId)).memoryScope.selections,[]);
  await page.getByTestId('office-prompt-input').fill(scenario.teacherRequest);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const latest=await until(async()=>{
    const state=await snapshot(sessionId);
    const turn=state.projection.turns.at(-1);
    return !state.running&&['completed','failed','interrupted'].includes(turn?.status)?turn:null;
  });
  report.terminal={id:latest.id,status:latest.status,error:latest.error??null};
  report.requests=await app.evaluate(()=>globalThis.frozenPreferenceRequests);
  report.before={revision:baseline.revision,sectionOrder:baseline.values.handoutSectionOrder??null};
  const adopted=await preference();
  report.after={revision:adopted.revision,sectionOrder:adopted.values.handoutSectionOrder};
  assert.equal(latest.status,'completed',latest.error);
  assert.equal(adopted.revision,baseline.revision+1);
  assert.equal(adopted.values.handoutSectionOrder,'examples_first');
  const sourceRow=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='user'",sessionId);
  assert.equal(sourceRow.content,scenario.teacherRequest);
  const persisted=read("SELECT value_json FROM app_settings WHERE key='xiaozhi.teacher-preference.v1:head'");
  assert(persisted?.value_json);
  report.headSha256=sha(persisted.value_json);
  assert.deepEqual((await snapshot(sessionId)).memoryScope.selections,[]);
  assert(report.requests.some(row=>row.status===200&&row.exactTeacherRequest&&row.savedPreferenceReceipt));
  await app.close();app=undefined;
  await launch(false);
  const recovered=await preference();
  assert.deepEqual(recovered,adopted);
  assert.equal(sha(read("SELECT value_json FROM app_settings WHERE key='xiaozhi.teacher-preference.v1:head'").value_json),report.headSha256);
  report.restarted=true;
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error).slice(0,2000);
  if(app&&!report.requests)report.requests=await app.evaluate(()=>globalThis.frozenPreferenceRequests).catch(()=>[]);
  await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(root);
}
