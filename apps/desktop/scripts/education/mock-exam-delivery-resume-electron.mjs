import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles} from '../product-navigation.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_MOCK_EXAM_FIXTURE;
assert(root&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(baseline.ok&&baseline.paidRequests===0);
const {sessionId,catalogId}=baseline,oldData=path.join(fixture,'data');
const output=fs.mkdtempSync(path.join(root,'mock-exam-resume-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const oldWal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(oldWal)||!fs.statSync(oldWal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const formats=[{format:'docx',path:'模考续做-目录.docx'},{format:'pdf',path:'模考续做-目录.pdf'}],replacement='模考续做-目录补齐.pdf';
const manual=process.argv.includes('--manual'),report={ok:false,main,mainSha256:sha(main),output,sessionId,catalogId,paidRequests:0,checks:[],errors:[]};
let app,page;

function sql(query,args=[],write=false){
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write});
  try{database.exec('PRAGMA busy_timeout=5000');return write?database.prepare(query).run(...args):database.prepare(query).all(...args);}
  finally{database.close();}
}
for(const row of sql('SELECT id,local_path,content_hash FROM teacher_resources')){
  const relative=path.relative(oldData,row.local_path),local=path.join(data,relative);
  assert(relative.startsWith('teacher_resources'+path.sep)&&sha(local)===row.content_hash);
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[local,row.id],true);
}
const bundles=()=>sql('SELECT value_json FROM xiaozhi_delivery_bundles WHERE session_id=? ORDER BY rowid',[sessionId]).map(row=>JSON.parse(row.value_json));
const facts=()=>sql('SELECT * FROM document_artifacts WHERE session_id=?',[sessionId]);
const recent=()=>sql('SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1',[sessionId])[0];
const snapshot=()=>page.evaluate(session=>window.omniEdu.getXiaozhiSnapshot(session),sessionId);
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,timeout=90_000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=await read();if(value)return value;await delay(140);}
  throw Error('Delivery continuation did not reach expected state');
}
async function launch(mode='partial',parentId){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-mock-exam-resume',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60_000});
  await app.evaluate(({net},fixture)=>{
    const {mode,formats,catalogId,parentId,replacement}=fixture;
    const wire=globalThis.mockExamResume={requests:[],errors:[],collision:false};
    const native=process.getBuiltinModule('node:fs'),originalLink=native.linkSync;
    if(mode==='partial')native.linkSync=(temporary,target)=>{
      if(!wire.collision&&String(target).endsWith(formats[1].path)){
        native.writeFileSync(target,'独立目标占用样本',{flag:'wx'});
        wire.collision=true;
      }
      return originalLink(temporary,target);
    };
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      try{
        if(mode==='cold'||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external request');
        const body=JSON.parse(init.body),index=wire.requests.length,tools=body.tools?.map(tool=>tool.function.name)||[];
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        let previous;try{previous=index&&text?JSON.parse(text.split('\n')[0]):undefined;}catch{previous={text};}
        const system=body.messages.filter(message=>message.role==='system').map(message=>message.content).join('\n');
        const active=system.split('\n').findLast(line=>line.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
        const task=active?JSON.parse(active):{requirementsVersion:Number([...system.matchAll(/"requirementsVersion":(\d+)/gu)].at(-1)?.[1]||1),revision:0};
        let call,content;
        if(mode==='partial'&&index===0)call={name:'education_read_mock_exam_for_export',args:{catalogId}};
        else if(mode==='partial'&&index===1){
          if(!previous?.success)throw Error(JSON.stringify(previous));
          wire.source={catalogId,revision:previous.revision,digest:previous.digest};
          call={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
            expectedRevision:task.revision,reason:'合成模考双格式交付',steps:[
              {id:'deliver',text:'保存两种模考目录',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},
              {id:'review',text:'教师核对文件',dependsOn:['deliver'],reported:'pending',kind:'human'}]}};
        }else if(mode==='partial'&&index===2)call={name:'education_export_mock_exam_catalog',args:{...wire.source,outputs:formats,taskStepId:'deliver'}};
        else if(mode==='partial'){
          if(previous?.outcome!=='partial')throw Error('Expected actual partial result: '+JSON.stringify(previous));
          content='Word 已保存，PDF 的目标被占用，可续做未完成文件。';
        }else if(index===0){
          if(!JSON.stringify(body.messages).includes(parentId)||tools.includes('education_export_mock_exam_catalog'))throw Error('Resume did not bind the selected bundle');
          // Attempt a replacement of the saved Word path first. The old bundle and approval remain untouched.
          call={name:'office_deliver_files',args:{resumeBundleId:parentId,renames:[{fileId:'catalog_docx',path:'不允许复制.docx'}],taskStepId:'deliver'}};
        }else if(index===1){
          if(!text?.includes('"reason":"invalid_mock_exam_resume"'))throw Error('Saved member rename was not rejected before dispatch: '+JSON.stringify(previous));
          call={name:'office_deliver_files',args:{resumeBundleId:parentId,renames:[{fileId:'catalog_pdf',path:replacement}],taskStepId:'deliver'}};
        }else{
          if(previous?.outcome!=='saved')throw Error('Expected completed continuation: '+JSON.stringify(previous));
          content='仅补齐了 PDF，已核验并保留原 Word。';
        }
        if(call&&!tools.includes(call.name))throw Error('Missing tool: '+call.name);
        wire.requests.push({mode,index,tool:call?.name,previous});
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'mock-exam-resume',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const delta=call?{tool_calls:[{index:0,id:'mock-resume-'+mode+'-'+index,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{mode,formats,catalogId,parentId,replacement});
  page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  if(mode==='partial'){
    if(await page.locator('.office-composer-container').getAttribute('data-session-id',{timeout:15_000}).catch(()=>null)!==sessionId)
      await page.getByTestId('workbench-session-'+sessionId).click();
    await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
  }
}
const card=id=>page.getByTestId('pi-delivery-bundle').and(page.locator('[data-bundle-id="'+id+'"]')).filter({visible:true});
async function ready(button){
  await until(async()=>await button.isVisible()&&!await button.isDisabled());
}
async function settle(){
  await until(async()=>recent()?.status!=='running'&&!(await snapshot()).running);
  const wire=await app.evaluate(()=>globalThis.mockExamResume);
  assert.deepEqual(wire.errors,[]);
  assert.notEqual(recent()?.status,'failed',recent()?.error_message);
  return wire;
}
async function openBundleInWorkbench(id){
  await openTeachingFiles(page);
  await page.getByTestId('teaching-deliveries-tab').click();
  await page.getByTestId('delivery-'+id).getByRole('button').click();
  const detail=page.getByTestId('delivery-detail');
  await detail.getByTestId('pi-delivery-resume').waitFor();
  return detail;
}

try{
  await launch();
  await page.setViewportSize({width:1366,height:768});
  await page.getByTestId('office-prompt-input').fill('将已确认的上海模考汇编导出 Word 和 PDF 目录，一次审阅确认。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const first=await until(()=>bundles().find(bundle=>bundle.state==='pending'));
  const approve=card(first.id).getByTestId('pi-delivery-approve');
  await ready(approve);await approve.click();
  const initial=await settle();assert(initial.collision);
  const original=bundles().find(bundle=>bundle.id===first.id),oldTask=(await snapshot()).task;
  assert.equal(original.state,'partial');assert.equal(facts().length,1);
  assert.equal(original.taskVersion,oldTask.id+':'+oldTask.requirementsVersion);
  const [word]=facts(),wordTime=fs.statSync(word.file_path).mtimeMs,wordHash=sha(word.file_path);
  const blocked=path.join(path.dirname(word.file_path),formats[1].path),occupant=fs.readFileSync(blocked,'utf8');
  assert.equal(occupant,'独立目标占用样本');
  report.parentId=original.id;report.taskId=oldTask.id;
  check('A real target collision leaves the original bundle partial and preserves one correctly recorded Word file');
  if(!manual){
    await app.close();app=undefined;await launch('resume',original.id);
    const detail=await openBundleInWorkbench(original.id);
    const oldRun=recent().id,resource=sql("SELECT local_path FROM teacher_resources WHERE original_file_name LIKE '%参考答案.pdf'")[0].local_path;
    const answer=fs.readFileSync(resource);
    try{
      fs.appendFileSync(resource,'\nSource integrity change in isolated fixture\n');
      await detail.getByTestId('pi-delivery-resume').click();
      await detail.getByRole('alert').filter({hasText:'目录版本、已保存文件或原任务已变化'}).waitFor();
      assert.equal(recent().id,oldRun);
      assert.equal((await app.evaluate(()=>globalThis.mockExamResume.requests)).length,0);
    }finally{fs.writeFileSync(resource,answer);}
    check('After a cold restart, stale source bytes stop the continuation before another model request');
    await detail.getByTestId('pi-delivery-resume').click();
    const resumed=await until(()=>bundles().find(bundle=>bundle.parentId===original.id&&bundle.state==='pending'));
    const approval=card(resumed.id).getByTestId('pi-delivery-approve');
    await ready(approval);
    assert.equal(resumed.taskVersion,original.taskVersion);
    assert.equal(resumed.files.find(file=>file.fileId==='catalog_docx').draftId,original.files.find(file=>file.fileId==='catalog_docx').draftId);
    assert.equal(resumed.files.filter(file=>file.carried).length,1);
    assert.equal(await approval.innerText(),'确认保存未完成文件');
    assert.equal(facts().length,1);
    await approval.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'resume-review-1366.png'),animations:'disabled'});
    await approval.click();
    const wire=await settle();
    assert.equal(bundles().find(bundle=>bundle.id===resumed.id).state,'saved');
    assert.equal((await snapshot()).task.id,oldTask.id);
    assert.equal((await snapshot()).task.requirementsVersion,oldTask.requirementsVersion);
    assert.equal(facts().length,2);assert.equal(sha(word.file_path),wordHash);assert.equal(fs.statSync(word.file_path).mtimeMs,wordTime);
    assert.equal(fs.readFileSync(blocked,'utf8'),occupant);
    const pdf=facts().find(file=>file.file_name===replacement);assert(pdf&&fs.readFileSync(pdf.file_path).subarray(0,5).toString()==='%PDF-');
    assert.equal(sha(pdf.file_path),pdf.content_hash);
    report.saved={word:word.file_path,wordHash,pdf:pdf.file_path,pdfHash:pdf.content_hash,resumed:resumed.id,wire:wire.requests};
    check('Original task and plan resume after teacher review, with a fresh PDF, unchanged Word, and no overwrite of the occupied target');
    await app.close();app=undefined;await launch('cold');
    await openTeachingFiles(page);
    await page.getByTestId('teaching-deliveries-tab').click();
    await page.getByTestId('delivery-'+resumed.id).getByRole('button').click();
    const result=page.getByTestId('delivery-detail').getByTestId('pi-delivery-bundle');
    await until(async()=>await result.isVisible()&&await result.getAttribute('data-state')==='saved');
    assert.equal((await app.evaluate(()=>globalThis.mockExamResume.requests)).length,0);
    await page.setViewportSize({width:1920,height:1080});
    await page.screenshot({path:path.join(output,'resume-cold-1920.png'),animations:'disabled'});
    check('Cold workbench still reads the parent-child bundle chain and both files without replaying a model request');
  }
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){
  report.error=error.stack;
  if(app)report.wire=await app.evaluate(()=>globalThis.mockExamResume).catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
  throw error;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(output);
}
