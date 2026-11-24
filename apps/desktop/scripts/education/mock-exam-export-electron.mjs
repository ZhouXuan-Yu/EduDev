import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles} from '../product-navigation.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_MOCK_EXAM_FIXTURE;
assert(root&&fixture,'Use the fixed acceptance directory and synthetic catalogue fixture');
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(baseline.ok&&baseline.paidRequests===0);
const {catalogId,sessionId}=baseline;
const scoped=Boolean(baseline.scope?.districts||baseline.scope?.rounds);
const output=fs.mkdtempSync(path.join(root,'mock-exam-export-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const oldData=path.resolve(fixture,'data'),wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||!fs.statSync(wal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,output,catalogId,sessionId,main,mainSha256:sha(main),paidRequests:0,checks:[],pageErrors:[]};
const lanes={
  word:{outputs:[{format:'docx',path:'上海模考目录.docx'}],button:'docx'},
  bundle:{outputs:[{format:'docx',path:'同期模考目录.docx'},{format:'pdf',path:'同期模考目录.pdf'}]},
  drift:{outputs:[{format:'pdf',path:'来源变化不应保存.pdf'}],button:'pdf'},
  reject:{outputs:[{format:'pdf',path:'老师拒绝不应保存.pdf'}],button:'pdf'},
};
let app,page;

function sql(query,args=[],write=false){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write});
  try{db.exec('PRAGMA busy_timeout=5000');return write?db.prepare(query).run(...args):db.prepare(query).all(...args);}
  finally{db.close();}
}
for(const row of sql('SELECT id,local_path,content_hash FROM teacher_resources')){
  const relative=path.relative(oldData,row.local_path),local=path.resolve(data,relative);
  assert(relative.startsWith('teacher_resources'+path.sep)&&sha(local)===row.content_hash);
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[local,row.id],true);
}
const catalogues=()=>sql('SELECT c.id,c.title,v.state,v.revision,v.digest,v.image_json FROM mock_exam_compilations c JOIN mock_exam_compilation_versions v ON v.catalog_id=c.id AND v.revision=c.revision WHERE c.session_id=?',[sessionId]);
const initial=catalogues(),confirmed=initial.find(row=>row.id===catalogId),draft=initial.find(row=>row.id!==catalogId&&row.title===confirmed?.title);
assert.equal(confirmed?.state,'confirmed');
if(!scoped)assert.equal(draft?.state,'draft');
const entries=JSON.parse(confirmed.image_json).entries;
const source={catalogId,revision:confirmed.revision,digest:confirmed.digest};
const ledger=()=>sql("SELECT relative_path,format,state,draft_json,result_path,artifact_id FROM xiaozhi_pi_office_drafts WHERE json_extract(draft_json,'$.schemaVersion')='xiaozhi.mock-exam-office.v1'");
const facts=()=>sql('SELECT id,file_path,content_hash FROM document_artifacts WHERE session_id=?',[sessionId]);
const lastRun=()=>sql('SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1',[sessionId])[0];
function check(label){report.checks.push(label);console.log('PASS '+label);}
async function until(read){
  const deadline=Date.now()+100_000;
  while(Date.now()<deadline){
    const value=await read();if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,140));
  }
  throw Error('Timed out waiting for renderer or saved data');
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-mock-exam-export',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60_000});
  await app.evaluate(({net},{source,draftId,cold})=>{
    const wire=globalThis.mockExamExport={requests:[],errors:[]};
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      try{
        if(cold||!wire.mode||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external request');
        const body=JSON.parse(init.body),index=wire.index++,mode=wire.mode,outputs=wire.lane.outputs;
        const read='education_read_mock_exam_for_export',write='education_export_mock_exam_catalog';
        if(body.tools.some(tool=>tool.function.name==='education_build_mock_exam_catalog'))throw Error('Export unexpectedly exposes catalogue creation');
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        const previous=index&&text?JSON.parse(text.split('\n')[0]):undefined;
        const system=body.messages.filter(message=>message.role==='system').map(message=>message.content).join('\n');
        const active=system.split('\n').findLast(line=>line.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
        const task=active?JSON.parse(active):{requirementsVersion:Number([...system.matchAll(/"requirementsVersion":(\d+)/gu)].at(-1)?.[1]||1),revision:0};
        let call,content;
        const wrongTarget=mode==='word'&&Boolean(draftId),phase=wrongTarget?index-1:index;
        if(wrongTarget&&index===0)call={name:read,args:{catalogId:draftId}};
        else if(phase===0){
          if(wrongTarget&&(previous?.success!==false||previous.error!=='version_conflict'))throw Error('Selected catalogue was not enforced');
          call={name:read,args:mode==='bundle'?{catalogId:source.catalogId}:{}};
        }else if(phase===1){
          if(!previous?.success||previous.catalogId!==source.catalogId||previous.revision!==source.revision||previous.digest!==source.digest)
            throw Error('Exact confirmed version was not observed: '+JSON.stringify(previous));
          if(wire.lane.button&&(previous.formats.length!==1||previous.formats[0]!==wire.lane.button))throw Error('Selected format was not enforced');
          const grouped=outputs.length===2;
          call={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
            expectedRevision:task.revision,reason:'导出老师选择的确认版模考目录',steps:[
              {id:'deliver',text:'保存同源目录文件',dependsOn:[],reported:'pending',kind:grouped?'saved_bundle':'saved_office',target:grouped?'current':outputs[0].path},
              {id:'review',text:'老师核对文件',dependsOn:['deliver'],reported:'pending',kind:'human'}]}};
        }else if(phase===2)call={name:write,args:{...source,outputs,taskStepId:'deliver'}};
        else {
          const saved=mode==='word'||mode==='bundle';
          if(Boolean(previous?.success)!==saved)throw Error('Unexpected export result: '+JSON.stringify(previous));
          content=saved?'模考目录已保存。':'本次未生成新文件。';
        }
        if(call&&!body.tools.some(tool=>tool.function.name===call.name))throw Error('Missing tool '+call.name);
        wire.requests.push({mode,index,tool:call?.name,previous});
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'mock-exam-export',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const update=call?{tool_calls:[{index:0,id:'mock-export-'+mode+'-'+index,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(update)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{source,draftId:draft?.id,cold});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  if(await page.locator('.office-composer-container').getAttribute('data-session-id',{timeout:15_000}).catch(()=>null)!==sessionId)
    await page.getByTestId('workbench-session-'+sessionId).click();
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}
async function openCatalogue(id=catalogId){
  if(!await page.getByTestId('mock-exam-workspace').isVisible()){
    await openTeachingFiles(page);
    await page.getByTestId('teaching-mock-exams-tab').click();
  }
  await page.getByTestId('mock-exam-result-'+id).getByRole('button').click();
  await until(async()=>await page.getByTestId('mock-exam-detail').getAttribute('data-catalog-id')===id);
  return page.getByTestId('mock-exam-detail');
}
async function send(mode){
  const before=lastRun()?.id,lane=lanes[mode];
  await app.evaluate((_,value)=>Object.assign(globalThis.mockExamExport,{...value,index:0}),{mode,lane});
  if(lane.button){
    const detail=await openCatalogue();
    await detail.getByTestId('mock-exam-export-'+lane.button).click();
  }else{
    await page.getByTestId('office-prompt-input').fill('将已确认的上海模考汇编目录导出成 Word 和 PDF，一次预览确认。');
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
  }
  await until(()=>lastRun()?.id!==before&&lastRun());
}
async function ready(button){
  await until(async()=>{
    const run=lastRun();
    assert.notEqual(run?.status,'failed',run?.error_message);
    if(await button.isVisible()&&!await button.isDisabled())return true;
    if(run&&['succeeded','cancelled','interrupted'].includes(run.status))
      throw Error('Export completed without an actionable approval: '+run.status);
    return false;
  });
}
async function settle(){
  await until(()=>lastRun()?.status!=='running');
  const wire=await app.evaluate(()=>globalThis.mockExamExport);
  assert.deepEqual(wire.errors,[]);
  assert.equal(lastRun()?.status,'succeeded',lastRun()?.error_message);
  await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId)).running);
  report.wire=wire.requests;
}
const officeCard=filename=>page.getByTestId('pi-office-artifact').filter({hasText:filename}).last();
function readDocument(file,format){
  const program=[
    'import json,sys,zipfile,xml.etree.ElementTree as ET',
    'file,format=sys.argv[1:]',
    "if format == 'pdf':",
    ' import fitz',
    ' with fitz.open(file) as document:',
    "  result={'text':'\\n'.join(page.get_text() for page in document),'page':[list(page.rect)[2:] for page in document]}",
    'else:',
    ' with zipfile.ZipFile(file) as archive:',
    "  root=ET.fromstring(archive.read('word/document.xml'))",
    "  ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}",
    "  result={'text':'\\n'.join(item.text or '' for item in root.findall('.//w:t',ns)),'page':list(root.find('.//w:pgSz',ns).attrib.values())}",
    'print(json.dumps(result,ensure_ascii=True))',
  ].join('\n');
  const result=spawnSync('python',['-c',program,file,format],{encoding:'utf8'});
  assert.equal(result.status,0,result.error?.message||result.stderr);
  return JSON.parse(result.stdout);
}

try{
  await launch();
  await page.setViewportSize({width:1366,height:768});
  if(draft){
    const draftDetail=await openCatalogue(draft.id);
    await draftDetail.getByTestId('mock-exam-origin-conversation').waitFor();
    assert.equal(await draftDetail.getByTestId('mock-exam-export-docx').count(),0);
  }
  const factCount=facts().length;
  await send('word');
  const single=officeCard(lanes.word.outputs[0].path),approve=single.getByTestId('pi-office-approve');
  await ready(approve);
  assert.equal(facts().length,factCount);
  assert.equal(await single.getByRole('tab',{name:'修改拟内容'}).count(),0);
  await single.getByRole('tab',{name:'来源',exact:true}).click();
  assert.match(await single.getByTestId('pi-mock-exam-office-source').innerText(),new RegExp('第 '+source.revision+' 版'));
  await page.screenshot({path:path.join(output,'word-preview-1366.png'),animations:'disabled'});
  await approve.click();
  await settle();
  assert.equal(ledger().find(row=>row.relative_path===lanes.word.outputs[0].path)?.state,'saved');
  check(draft?'Workbench enforces the selected confirmed version and format over a same-title draft, then saves Word after review':
    'Workbench exports the selected confirmed scoped catalogue as Word after review');

  await page.setViewportSize({width:1920,height:1080});
  await send('bundle');
  const bundle=page.getByTestId('pi-delivery-bundle').last(),approveBoth=bundle.getByTestId('pi-delivery-approve');
  await ready(approveBoth);
  assert.equal(await bundle.getByTestId('pi-delivery-file').count(),2);
  assert.equal(facts().length,factCount+1);
  await page.screenshot({path:path.join(output,'bundle-preview-1920.png'),animations:'disabled'});
  await approveBoth.click();
  await settle();
  assert.equal(facts().length,factCount+3);
  report.files=ledger().filter(row=>row.state==='saved').map(row=>{
    assert.deepEqual(JSON.parse(row.draft_json).mockExamSource,source);
    const fact=facts().find(item=>item.id===row.artifact_id);
    assert.equal(fact?.file_path,row.result_path);
    assert.equal(sha(row.result_path),fact.content_hash);
    const result=readDocument(row.result_path,row.format),stripped=result.text.replace(/\s+/gu,'');
    for(const value of ['徐汇区','缺答案','已关联独立答案册','许可待核对','甲卷'])assert(stripped.includes(value),value);
    assert.doesNotMatch(stripped,/乙卷/u);
    if(scoped){
      for(const district of baseline.scope.districts??[])assert(stripped.includes(district),district);
      for(const round of baseline.scope.rounds??[])assert(stripped.includes(round),round);
      for(const title of baseline.excludedTitles??[])assert(!stripped.includes(title),title);
      assert.doesNotMatch(stripped,/虹口区|二模|2024/u);
    }
    if(row.format==='docx')assert(result.page.includes('11906')&&result.page.includes('16838'));
    else assert(result.page.length&&result.page.every(([w,h])=>Math.abs(w-595.3)<3&&Math.abs(h-841.9)<3));
    return {format:row.format,path:row.result_path,sha256:fact.content_hash,...result};
  });
  check('One bundle approval saves two readable A4 files with the same source version, answer status, exclusions and disk hashes');

  await send('drift');
  const drift=officeCard(lanes.drift.outputs[0].path),driftApprove=drift.getByTestId('pi-office-approve');
  await ready(driftApprove);
  const linked=entries.find(entry=>entry.include&&entry.answer.state==='linked');
  const [{local_path:answer}]=sql('SELECT local_path FROM teacher_resources WHERE id=?',[linked.answer.resourceId]);
  const original=fs.readFileSync(answer);
  try{
    fs.appendFileSync(answer,'\nSynthetic answer version drift\n');
    await driftApprove.click();
    await settle();
    assert.equal(ledger().find(row=>row.relative_path===lanes.drift.outputs[0].path)?.state,'conflict');
  }finally{fs.writeFileSync(answer,original);}
  await send('reject');
  const refused=officeCard(lanes.reject.outputs[0].path);
  await ready(refused.getByTestId('pi-office-approve'));
  await refused.getByTestId('pi-office-reject').click();
  await settle();
  assert.equal(ledger().find(row=>row.relative_path===lanes.reject.outputs[0].path)?.state,'rejected');
  assert.equal(facts().length,factCount+3);
  assert.deepEqual(catalogues(),initial);
  check('Changed answer bytes and user rejection prevent new files and catalogue mutation');

  await app.close();app=undefined;
  await launch(true);
  await until(async()=>await officeCard(lanes.word.outputs[0].path).getAttribute('data-state')==='saved');
  const wire=await app.evaluate(()=>globalThis.mockExamExport);
  assert.deepEqual(wire.errors,[]);
  assert.deepEqual(wire.requests,[]);
  assert.deepEqual(report.pageErrors,[]);
  check('Cold Electron restores saved artifact cards without repeating model dispatch or writes');
  report.ok=true;
}catch(error){
  report.error=error.stack;
  if(app)report.wire=await app.evaluate(()=>globalThis.mockExamExport).catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
  throw error;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(output);
}
