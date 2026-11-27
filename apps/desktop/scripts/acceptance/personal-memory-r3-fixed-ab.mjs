import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
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
assert(['R3-EVAL-013','R3-EVAL-014','R3-EVAL-015','R3-EVAL-016','R3-EVAL-021','R3-EVAL-022'].includes(task?.caseId),
  'Select a supported frozen case');
const preferenceCase=['R3-EVAL-013','R3-EVAL-014'].includes(task.caseId);
const correctedPreference=task.caseId==='R3-EVAL-014';
const outage=task.caseId==='R3-EVAL-022';
const sourceCase=['R3-EVAL-015','R3-EVAL-016'].includes(task.caseId);
const sourceRevoked=task.caseId==='R3-EVAL-016';
const historySeed=outage||sourceCase?fs.realpathSync(process.argv[5]||'missing'):undefined;
if(historySeed){
  const approved=JSON.parse(fs.readFileSync(path.join(historySeed,'report.json'),'utf8'));
  assert.equal(approved.lane,'B');
  assert.equal(approved.variant,'rebuild');
  assert(approved.checks.length>=9);
}
assert.equal(contract.tasks.length,24);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'r3-fixed-ab-'));
const git=dir=>execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
assert.equal(git(baseline),'ca2a51425619dc14412508839e0799338567c399');
const bSource=process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA;
const bBuild=process.env.OMNI_EDU_R3_EVAL_BUILD_SHA256;
assert(/^[a-f0-9]{40}$/.test(bSource??'')&&/^[a-f0-9]{64}$/.test(bBuild??''));
execFileSync('git',['diff','--exit-code',bSource,'--','src','package-lock.json','package.json',
  ':(exclude)src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json',
  ':(exclude)src/main/xiaozhi-agent/capabilities/generated/core-tool-static-definitions.json'],{cwd:desktop,stdio:'ignore'});
const arms=[
  {id:'A',desktop:baseline,main:path.join(baseline,'out/main/index.js'),source:git(baseline)},
  {id:'B',desktop,main:testMain(desktop),source:bSource},
];
assert.equal(hash(arms[1].main),bBuild,'The B arm must use the recorded product build');
const selectedArm=process.env.OMNI_EDU_R3_EVAL_ARM;
assert(selectedArm===undefined||selectedArm==='A'||selectedArm==='B');
const report={
  caseId:task.caseId,fixtureHash,caseCount:contract.tasks.length,target:task.expectedObservableResult,
  results:[],model:'deepseek-flash',harnessCheckout:git(desktop),scope:'One frozen synthetic case per invocation.',
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
let activeArm;
const faults=[];
const server=outage?createServer((request,response)=>{
  faults.push({arm:activeArm,path:new URL(request.url,'http://localhost').pathname,status:503});
  request.resume();
  response.writeHead(503,{'content-type':'application/json'});
  response.end(JSON.stringify({message:'Controlled index outage'}));
}):undefined;
if(server){
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
}
const knownTask='当前已知的任务要求：面向八年级，用两句话解释冰水共存时为什么会出现温度平台。接下来我会让你完成这项说明。现在只确认已收到，先不要生成说明或文件。';
const localQuery='查询冰水共存及冰融化实验温度平台的观察要求';
const firstPreference='请记住，以后我的讲义答案统一放最后。请简单确认。';
const nextPreference='请记住，今后学案每道题后附参考答案。请简单确认。';

async function seedPrompt(page,input,snapshot,text){
  const prior=(await snapshot()).projection.turns.at(-1)?.id;
  await input.fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const turn=await until(async()=>{
    const value=await snapshot(),last=value.projection.turns.at(-1);
    return !value.running&&last?.id!==prior&&['completed','failed','interrupted'].includes(last?.status)?last:null;
  });
  assert.equal(turn.status,'completed',turn.error);
  return turn;
}

async function seedPreferences(page,input,snapshot){
  const versions=[];
  for(const [prompt,value] of [[firstPreference,'at_end'],...(correctedPreference?[[nextPreference,'after_each']]:[])]){
    const turn=await seedPrompt(page,input,snapshot,prompt);
    const observed=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
    assert(observed.ok);
    const preference=observed.value.preference;
    assert.equal(preference.values.handoutAnswerPlacement,value);
    const prior=versions.at(-1);
    if(prior)assert(preference.revision>prior.revision);
    versions.push({revision:preference.revision,value,runId:turn.id});
  }
  return versions;
}

async function chooseHistory(app,page,data,input,source,snapshot){
  await input.fill(localQuery);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-search').click();
  const finder=page.getByTestId('history-lookup');
  await finder.getByTestId('history-candidate-'+source.record_id).click();
  await finder.getByTestId('history-lookup-preview').getByText(source.content,{exact:true}).waitFor();
  const explicitSession=finder.getByTestId('history-lookup-use-session');
  if(await explicitSession.isVisible())await explicitSession.click();
  else await finder.getByTestId('history-lookup-use').click();
  await until(async()=>(await snapshot()).memoryScope.selections.some(item=>item.id===source.source_id&&item.state==='ready'));
  if(sourceRevoked){
    const opening=app.waitForEvent('window');
    await page.getByRole('button',{name:'设置',exact:true}).click();
    const settings=await opening;
    await settings.getByTestId('pi-settings-tab-teacher-memory').click();
    await settings.getByTestId('history-settings-session').selectOption(source.session_id);
    await settings.getByTestId('history-settings-source-'+source.record_id).getByRole('button',{name:'暂停参考',exact:true}).click();
    const revoked=await until(()=>read(data,`SELECT generation FROM memory_source_access
      WHERE source_id=? AND index_allowed=0 AND memory_state='disabled'`,source.source_id)[0]);
    assert(revoked.generation>source.generation);
    await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
    return {from:source.generation,to:revoked.generation,state:'disabled'};
  }
  return {version:source.generation,state:'active'};
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

for(const arm of arms.filter(arm=>!selectedArm||arm.id===selectedArm)){
  activeArm=arm.id;
  const data=path.join(root,arm.id,'data'),profile=path.join(root,arm.id,'profile');
  if(historySeed){
    fs.mkdirSync(path.dirname(data),{recursive:true});
    fs.cpSync(path.join(historySeed,'data'),data,{recursive:true,errorOnExist:true,force:false});
  }
  const source=sourceCase?read(data,`SELECT a.source_id,a.record_id,a.session_id,a.generation,m.content
    FROM memory_source_access a JOIN memory_index_catalog c USING(source_id)
    JOIN ai_conversation_messages m ON m.id=a.record_id
    WHERE a.index_allowed=1 AND a.discover_allowed=1 AND c.status='ready'`)[0]:undefined;
  if(sourceCase)assert(source);
  const result={arm:arm.id,source:arm.source,main:arm.main,buildSha256:hash(arm.main),
    lockSha256:hash(path.join(arm.desktop,'package-lock.json')),realModel:[],status:'NOT_RUN'};
  report.results.push(result);
  let app,page;
  try{
    const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(arm.desktop,'../..'),
      OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:report.model};
    for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK',
      'OMNI_EDU_HISTORY_TOKEN','OMNI_EDU_R2_PYTHON'])delete env[key];
    if(server){
      env.OMNI_EDU_HISTORY_LOOPBACK='http://127.0.0.1:'+server.address().port;
      env.OMNI_EDU_HISTORY_TOKEN='owned-fixed-outage-fixture';
    }
    app=await electron.launch({args:[arm.main,'--user-data-dir='+profile],cwd:arm.desktop,env,timeout:60000,
      executablePath:path.join(arm.desktop,'node_modules/electron/dist/electron.exe')});
    await app.evaluate(({net},{prompt,protectedSource})=>{
      const original=net.fetch.bind(net),records=globalThis.r3FixedABRequests=[];
      globalThis.r3FixedABStage='setup';
      net.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!=='https://api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return original(input,init);
        if(records.length>=6)throw Error('Fixed evaluation case request cap reached');
        const payload=JSON.parse(init.body);
        const observation={phase:globalThis.r3FixedABStage,model:payload.model,reasoning:payload.reasoning_effort??null,maxTokens:payload.max_tokens,
          hasSubmittedPrompt:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes(prompt)),
          memoryProjection:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('宿主核验的本轮历史资料')),
          includesProtectedSource:Boolean(protectedSource)&&JSON.stringify(payload.messages).includes(protectedSource),
          includesPreferenceGuidance:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('当前教师表达偏好')),
          includesConfirmedPreferenceReadback:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('已确认偏好的宿主状态')),
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
    },{prompt:task.userPrompt,protectedSource:source?.content});
    page=await app.firstWindow();
    await assertIsolatedPiMain(app,arm.main,profile);
    const input=page.getByTestId('office-prompt-input');
    await input.waitFor();
    const composer=page.locator('.office-composer-container');
    const previous=await composer.getAttribute('data-session-id');
    if(historySeed)await page.getByTestId('pi-new-session').click();
    const sessionId=await until(async()=>{
      const id=await composer.getAttribute('data-session-id');
      return id?.startsWith('aisession_')&&(!historySeed||id!==previous)?id:null;
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
    if(source)result.historyAccess=await chooseHistory(app,page,data,input,source,snapshot);
    if(preferenceCase)result.preferenceVersions=await seedPreferences(page,input,snapshot);
    if(outage){
      result.seedRun=(await seedPrompt(page,input,snapshot,knownTask)).id;
      await input.fill(localQuery);
      await page.getByTestId('history-lookup-open').click();
      const before=faults.length;
      await page.getByTestId('history-lookup-search').click();
      const lookup=page.getByTestId('history-lookup');
      await lookup.getByText('历史索引暂不可用，当前使用本机关键词查找。',{exact:true}).waitFor();
      assert.equal(await lookup.getAttribute('data-mode'),'local');
      result.faults=faults.slice(before);
      assert(result.faults.some(fault=>fault.arm===arm.id&&fault.status===503));
      await lookup.getByRole('button',{name:'不再查找',exact:true}).click();
      assert.deepEqual((await snapshot()).memoryScope.selections,[]);
    }
    const priorTurn=(await snapshot()).projection.turns.at(-1)?.id;
    await app.evaluate(()=>{globalThis.r3FixedABStage='target';});
    const began=performance.now();
    await input.fill(task.userPrompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const state=await until(async()=>{
      const value=await snapshot(),last=value.projection.turns.at(-1);
      if(last?.id===priorTurn)return null;
      const question=value.controls?.find(item=>item.kind==='question'&&item.runId===last?.id&&item.state==='pending');
      return question||(!value.running&&['completed','failed','interrupted'].includes(last?.status))
        ? {last,question}:null;
    },110000);
    result.elapsedMs=Math.round(performance.now()-began);
    const requests=await app.evaluate(()=>globalThis.r3FixedABRequests);
    result.realModel=requests.filter(item=>item.phase==='target');
    if(outage||preferenceCase)result.setupRequests=requests.filter(item=>item.phase==='setup');
    assert(result.realModel.some(item=>item.status===200&&item.hasSubmittedPrompt));
    assert(result.realModel.every(item=>!item.memoryProjection));
    if(sourceRevoked)assert(result.realModel.every(item=>!item.includesProtectedSource));
    result.teacherPrompts=read(data,"SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='user' ORDER BY rowid",sessionId)
      .map(row=>row.content);
    const setupPrompts=outage?[knownTask]:preferenceCase?[firstPreference,...(correctedPreference?[nextPreference]:[])]:[];
    assert.deepEqual(result.teacherPrompts,[...setupPrompts,task.userPrompt]);
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
if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
console.log(root);
