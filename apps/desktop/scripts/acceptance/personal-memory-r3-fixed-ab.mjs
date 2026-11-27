import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const baseline=fs.realpathSync(process.argv[2]||'missing');
const fixture=fs.realpathSync(process.argv[3]||'missing');
const requestedCase=process.argv[4];
assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT&&process.env.DEEPSEEK_API_KEY);
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureHash=hash(fixture);
assert.equal(fixtureHash,'740fb52650849c5d3d0240956859fae392e27668e2e0228e51a73298e2fe0bdc');
const contract=JSON.parse(fs.readFileSync(fixture,'utf8'));
const task=contract.tasks.find(item=>item.caseId===requestedCase);
assert.equal(task?.caseId,'R3-EVAL-021','This lane currently owns the frozen empty-history case');
assert.equal(contract.tasks.length,24);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'r3-fixed-ab-'));
const git=dir=>execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
assert.equal(git(baseline),'ca2a51425619dc14412508839e0799338567c399');
const arms=[
  {id:'A',desktop:baseline,main:path.join(baseline,'out/main/index.js'),source:git(baseline)},
  {id:'B',desktop,main:testMain(desktop),source:git(desktop)},
];
const report={
  caseId:task.caseId,fixtureHash,caseCount:contract.tasks.length,target:task.expectedObservableResult,
  results:[],model:'deepseek-flash',scope:'One frozen synthetic case; no inference over the other 23.',
};
function read(data,sql,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...args);}
  finally{db.close();}
}
async function until(work,timeout=60000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await work();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Expected desktop state did not settle');
}
async function seedClass(app,page,sessionId,scope){
  const folder=await page.evaluate(async name=>{
    const workspace=await window.omniEdu.createAiConversationFolder({name});
    return workspace.folders.find(folder=>folder.name===name)?.id;
  },scope.classRef+' 班');
  assert(folder);
  await page.evaluate(([session,selector])=>window.omniEdu.moveAiConversationSession(session,selector),[sessionId,folder]);
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  for(const [field,value] of [['subject',scope.subject],['grade',scope.grade]]){
    await settings.getByTestId('teacher-memory-'+field).click();
    await settings.getByRole('option',{name:value,exact:true}).click();
  }
  await settings.getByTestId('teacher-memory-save').click();
  const profile=await until(async()=>{
    const result=await settings.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
    return result.ok&&result.value.profile.subject===scope.subject&&result.value.profile.grade===scope.grade
      ? result.value.profile:null;
  });
  await settings.getByTestId('pi-settings-tab-permissions').click();
  const memory=settings.getByTestId('pi-memory-scope');
  if(!await memory.getByTestId('pi-memory-enabled').isVisible())
    await memory.locator('[data-slot="chat-tool-trigger"]').click();
  await memory.getByRole('button',{name:'本会话的班级和学期'}).click();
  const [,year,semester]=/^(20[0-9]{2})([FS])$/.exec(scope.termRef)||[];
  assert(year);
  const term=year+'-'+(semester==='F'?'fall':'spring');
  await memory.getByLabel('学期年份',{exact:true}).fill(year);
  await memory.getByLabel('学期',{exact:true}).selectOption(semester==='F'?'fall':'spring');
  await memory.getByTestId('pi-memory-confirm-class').click();
  await memory.getByText('已确认班级和学期，可重新选择本会话的记忆。',{exact:true}).waitFor();
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  return {folder,term,profile};
}

for(const arm of arms){
  const data=path.join(root,arm.id,'data'),profile=path.join(root,arm.id,'profile');
  const result={arm:arm.id,source:arm.source,main:arm.main,buildSha256:hash(arm.main),
    lockSha256:hash(path.join(arm.desktop,'package-lock.json')),realModel:[],status:'NOT_RUN'};
  report.results.push(result);
  let app,page;
  try{
    const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(arm.desktop,'../..'),
      OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:report.model};
    for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK',
      'OMNI_EDU_HISTORY_TOKEN','OMNI_EDU_R2_PYTHON'])delete env[key];
    app=await electron.launch({args:[arm.main,'--user-data-dir='+profile],cwd:arm.desktop,env,timeout:60000,
      executablePath:path.join(arm.desktop,'node_modules/electron/dist/electron.exe')});
    await app.evaluate(({net},prompt)=>{
      const original=net.fetch.bind(net),records=globalThis.r3FixedABRequests=[];
      net.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!=='https://api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return original(input,init);
        if(records.length>=4)throw Error('Fixed evaluation case request cap reached');
        const payload=JSON.parse(init.body);
        const observation={model:payload.model,reasoning:payload.reasoning_effort??null,maxTokens:payload.max_tokens,
          hasSubmittedPrompt:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes(prompt)),
          memoryProjection:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('宿主核验的本轮历史资料')),
          status:0};
        records.push(observation);
        const started=performance.now(),response=await original(input,init);
        observation.status=response.status;
        void response.clone().text().then(stream=>{
          for(const line of stream.split('\n').filter(line=>line.startsWith('data: {'))){
            const event=JSON.parse(line.slice(6));
            if(event.usage)observation.usage=event.usage;
          }
          observation.elapsedMs=Math.round(performance.now()-started);
        }).catch(()=>{});
        return response;
      };
    },task.userPrompt);
    page=await app.firstWindow();
    await assertIsolatedPiMain(app,arm.main,profile);
    const input=page.getByTestId('office-prompt-input');
    await input.waitFor();
    const sessionId=await until(async()=>{
      const id=await page.locator('.office-composer-container').getAttribute('data-session-id');
      return id?.startsWith('aisession_')?id:null;
    });
    const classState=await seedClass(app,page,sessionId,task.taskScope);
    const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
    const now=await until(async()=>{
      const value=await snapshot();
      return value.memoryScope?.teachingTarget?.folderId===classState.folder&&
        value.memoryScope?.teachingTarget?.term===classState.term?value:null;
    });
    assert.deepEqual(now.memoryScope.selections,[]);
    result.scope={classRef:task.taskScope.classRef,term:classState.term,...classState.profile,selections:0};
    const began=performance.now();
    await input.fill(task.userPrompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const state=await until(async()=>{
      const value=await snapshot(),last=value.projection.turns.at(-1);
      const question=value.controls?.find(item=>item.kind==='question'&&item.runId===last?.id&&item.state==='pending');
      return question||(!value.running&&['completed','failed','interrupted'].includes(last?.status))
        ? {last,question}:null;
    },110000);
    result.elapsedMs=Math.round(performance.now()-began);
    result.realModel=await app.evaluate(()=>globalThis.r3FixedABRequests);
    assert(result.realModel.some(item=>item.status===200&&item.hasSubmittedPrompt));
    assert(result.realModel.every(item=>!item.memoryProjection));
    result.teacherPrompts=read(data,"SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='user' ORDER BY rowid",sessionId)
      .map(row=>row.content);
    assert.deepEqual(result.teacherPrompts,[task.userPrompt]);
    result.output=state.last.items.filter(item=>item.role==='assistant'&&typeof item.text==='string').map(item=>item.text);
    result.clarifications=state.question?1:0;
    result.status=state.question?'ASKED':state.last.status==='completed'?'CAPTURED':'FAIL';
    result.cost='UNKNOWN';
    console.log(arm.id+' '+result.status);
  }catch(error){
    result.status='FAIL';
    result.error=String(error.stack||error).slice(0,2600);
    await page?.screenshot({path:path.join(root,'failure-'+arm.id+'.png')}).catch(()=>{});
    process.exitCode=1;
  }finally{
    await app?.close().catch(()=>{});
    fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  }
}
console.log(root);
