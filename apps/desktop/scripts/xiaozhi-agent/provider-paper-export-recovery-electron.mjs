import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';

const build=process.argv[2];
assert(path.isAbsolute(build??''),'Pass the exact verified desktop build root');
const keepFailing=process.argv[3]==='--keep-failing';
assert(!process.argv[3]||keepFailing,'Unknown fixture argument');
const desktop=path.resolve(import.meta.dirname,'../..');
const main=fs.realpathSync(path.join(build,'main/index.js'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'provider-paper-export-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),workspace=path.join(root,'export');
fs.mkdirSync(workspace);
const marker='PHYSICS-RECOVERY-719';
const title='原题卷恢复验证';
const docx=path.join(workspace,'confirmed.docx'),pdf=path.join(workspace,'confirmed.pdf');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileHash=file=>hash(fs.readFileSync(file));
const fileIdentity=file=>{
  const {dev,ino,mtimeMs,birthtimeMs}=fs.statSync(file);
  return {dev,ino,mtimeMs,birthtimeMs};
};
const report={ok:false,root,build,keepFailing,mainHash:fileHash(main),rendererHash:fileHash(path.join(build,'renderer/index.html')),checks:[],paidCalls:0};
let app,page,sessionId;
function sql(query,values=[]) {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try {return db.prepare(query).all(...values);} finally {db.close();}
}
async function until(action,label,timeout=45_000) {
  const deadline=performance.now()+timeout;
  do {
    const result=await action();
    if (result) return result;
    await delay(50);
  } while(performance.now()<deadline);
  throw Error('Timed out: '+label);
}
const confirmedFacts=()=>sql("SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type='pi_paper_candidate' ORDER BY id",[sessionId]);
const artifactFacts=()=>sql('SELECT * FROM document_artifacts WHERE session_id=? ORDER BY id',[sessionId]);
const event=run=>sql('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[run])[0];
function physical(run) {
  return sql("SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND json_extract(document_json,'$.tool')='education_export_paper'",[run])
    .map(row=>JSON.parse(row.document_json));
}
const state=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function startExport(paper,format) {
  const spec={audience:'student',format,template:'paper',path:'confirmed.'+format};
  await app.evaluate((_,spec)=>{globalThis.providerPaperRecovery.phase={spec,index:0};},spec);
  const started=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{
    sessionId,commandId:'xicmd_'+randomUUID(),prompt:`education_export_paper 原样导出教师已确认试卷“${title}”，只保存 ${spec.path}，等待原审批。`,
    paperExportIntent:{schemaVersion:'xiaozhi.paper-export-intent.v1',paperId:paper.id,digest:paper.digest,
      audience:spec.audience,format,template:spec.template}
  });
  assert(started.ok,JSON.stringify(started));
  const runId=started.runId;
  const review=await until(async()=>{
    const live=await state();
    const item=live.officeArtifacts?.find(item=>item.runId===runId&&item.path===spec.path&&item.state==='pending');
    if(item)return {row:item};
    if(event(runId)?.status&&!live.running){
      const turn=live.projection.turns.find(item=>item.id===runId);
      const artifact=live.officeArtifacts.find(item=>item.runId===runId&&item.path===spec.path);
      if(keepFailing&&format==='pdf')return {terminal:{turn,artifact}};
      throw Error('Export ended before approval: '+JSON.stringify({status:turn?.status,error:turn?.errorCode,artifact,tools:turn?.items.filter(item=>item.kind==='tool')}));
    }
  },'actual original Office review '+format);
  if(review.terminal)return {runId,terminal:review.terminal,physical:physical(runId)};
  const {row}=review;
  const file=path.join(workspace,spec.path);
  assert(!fs.existsSync(file));
  assert(!artifactFacts().some(item=>item.file_path===file));
  const result=await page.evaluate(input=>window.omniEdu.decideXiaozhiOffice(input),{
    schemaVersion:'xiaozhi.office-artifact.v1',sessionId,draftId:row.id,revision:row.revision,action:'approve'
  });
  assert(result.ok,JSON.stringify(result));
  const terminal=await until(async()=>{
    const live=await state(),turn=live.projection.turns.find(item=>item.id===runId);
    return turn&&!live.running&&turn.status!=='running'?{turn,artifact:live.officeArtifacts.find(item=>item.id===row.id)}:undefined;
  },'export terminal '+format);
  return {runId,terminal,physical:physical(runId)};
}

try {
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:data,
    OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),DEEPSEEK_API_KEY:'synthetic-provider-paper',DEEPSEEK_MODEL:'deepseek-flash'});
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,timeout:60_000});
  await app.evaluate(({app,dialog,net},{directory,keepFailing})=>{
    const state=globalThis.providerPaperRecovery={requests:[],printing:[],phase:null};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});
    app.on('web-contents-created',(_,contents)=>{
      const native=contents.printToPDF.bind(contents);
      let current;
      contents.once('destroyed',()=>{if(current) current.closed=true;});
      contents.printToPDF=async settings=>{
        if(!contents.getURL().includes('/office-render-'))return native(settings);
        const failed=keepFailing||state.printing.length===0;
        current={id:contents.id,failed,previousClosed:state.printing.at(-1)?.closed??true,closed:false};
        state.printing.push(current);
        if(failed) throw new Error('Controlled settled native PDF print rejection');
        return native(settings);
      };
    });
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('Synthetic fixture rejects external destinations');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,
        max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});
      if(url.pathname!=='/v1/chat/completions'||!state.phase)throw Error('Unexpected synthetic request');
      const {spec,index}=state.phase;
      if(index>3)throw Error('Synthetic request budget exceeded');
      state.phase.index++;
      const body=JSON.parse(init.body),id='pdf_recovery_'+spec.format+'_'+index;
      let tool;
      if(index===0)tool={name:'find_education_tools',arguments:JSON.stringify({query:'education_export_paper 导出已确认试卷'})};
      if(index===1)tool={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:1,
        expectedRevision:0,reason:'沿确定的快照导出',steps:[{id:'save',text:'保存选定的文件',dependsOn:[],reported:'pending',kind:'saved_office',target:spec.path},
          {id:'review',text:'教师核对文件',dependsOn:['save'],reported:'pending',kind:'human'}]})};
      if(index===2)tool={name:'education_export_paper',arguments:JSON.stringify({...spec,taskStepId:'save'})};
      state.requests.push({format:spec.format,index,tool:tool?.name,receipt:index===3?body.messages.filter(item=>item.role==='tool').at(-1)?.content:undefined});
      const delta=tool?{role:'assistant',tool_calls:[{index:0,id,type:'function',function:tool}]}:{role:'assistant',content:'以实际保存结果为准。'};
      const chunk=(value,reason)=>'data: '+JSON.stringify({id,object:'chat.completion.chunk',created:1,model:body.model,
        choices:[{index:0,delta:value,finish_reason:reason}]})+'\n\n';
      return new Response(chunk(delta,null)+chunk({},tool?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    };
  },{directory:workspace,keepFailing});
  page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();
  sessionId=await page.evaluate(async()=> (await window.omniEdu.createAiConversationSession({title:'原题卷恢复验收',folderId:null})).session.id);
  assert.match(sessionId,/^aisession_[a-f0-9-]{36}$/u);
  await page.evaluate(({marker})=>window.omniEdu.createQuestionBankItem({subject:'物理',grade:'初二',knowledgePoint:'浮力',questionType:'解答题',
    difficulty:'medium',stem:'木块在水中漂浮，说明所受浮力方向。'+marker,answer:'竖直向上',analysis:'浮力方向为竖直向上。',sourceTitle:'自动验收合成题',tags:[]}),{marker});
  const proposed=await page.evaluate(input=>window.omniEdu.createPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,
    requestId:randomUUID(),blueprint:{title,subject:'物理',grade:'初二',durationMinutes:20,totalPoints:10,mode:'source_only',
      sections:[{id:'main',label:'解答题',questionType:'解答题',count:1,points:10}]}});
  assert(proposed.ok&&proposed.value.complete,JSON.stringify(proposed));
  const confirmed=await page.evaluate(input=>window.omniEdu.decidePaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,
    id:proposed.value.id,revision:proposed.value.revision,action:'confirm'});
  assert(confirmed.ok&&confirmed.value.state==='confirmed',JSON.stringify(confirmed));
  const paper=confirmed.value;
  const selected=await page.evaluate(sessionId=>window.omniEdu.selectPaperOutput({schemaVersion:'xiaozhi.paper-output.v1',sessionId}),sessionId);
  assert(selected.ok,JSON.stringify(selected));
  const facts=confirmedFacts();
  report.first=await startExport(paper,'docx');
  assert.equal(report.first.terminal.artifact?.state,'saved',JSON.stringify(report.first));
  const oldHash=fileHash(docx),oldIdentity=fileIdentity(docx),oldOutput=artifactFacts(),oldEffect=physical(report.first.runId);
  assert.deepEqual(confirmedFacts(),facts);
  assert.equal(oldOutput.length,1);
  assert.equal(oldEffect.filter(item=>item.state==='committed'&&item.proofs.length===1).length,1);
  report.checks.push('Teacher-confirmed paper is unchanged after the actual Word export');
  report.second=await startExport(paper,'pdf');
  report.instrumentation=await app.evaluate(()=>globalThis.providerPaperRecovery);
  assert.deepEqual(report.instrumentation.printing.map(p=>[p.failed,p.previousClosed,p.closed]),[[true,true,true],[keepFailing,true,true]]);
  assert.equal(fileHash(docx),oldHash);
  assert.deepEqual(fileIdentity(docx),oldIdentity);
  assert(!fs.readdirSync(data).some(name=>name.startsWith('office-render-')));
  assert.deepEqual(confirmedFacts(),facts);
  assert.deepEqual(physical(report.first.runId),oldEffect);
  assert.deepEqual(artifactFacts().filter(row=>row.file_path===docx),oldOutput);
  if(keepFailing){
    assert.notEqual(report.second.terminal.artifact?.state,'saved');
    assert(!fs.existsSync(pdf));
    assert.equal(artifactFacts().filter(row=>row.file_path===pdf).length,0);
    assert.equal(report.second.physical.filter(item=>item.state==='committed').length,0);
    report.checks.push('Persistent print rejection stops at two physical attempts and produces no saved fact');
  }else{
    assert.equal(report.second.terminal.artifact?.state,'saved',JSON.stringify(report.second));
    assert.equal(artifactFacts().filter(row=>row.file_path===pdf).length,1);
    assert.equal(report.second.physical.filter(item=>item.state==='committed'&&item.proofs.length===1).length,1);
    const parsed=spawnSync(process.env.OMNI_EDU_FIXTURE_PYTHON||'python',['-c',`
import json,sys,zipfile,xml.etree.ElementTree as ET
from pypdf import PdfReader
doc,pdf,marker=sys.argv[1:]
with zipfile.ZipFile(doc) as source:
    xml=ET.fromstring(source.read('word/document.xml'))
    text=''.join(xml.itertext())
    assert marker in text
reader=PdfReader(pdf)
assert len(reader.pages)>0
body=' '.join(''.join((page.extract_text() or '').split()) for page in reader.pages)
assert marker in body
print(json.dumps({'pageCount':len(reader.pages),'marker':marker}))
`,docx,pdf,marker],{encoding:'utf8'});
    assert.equal(parsed.status,0,parsed.stderr||parsed.stdout);
    report.files={docx,docxHash:oldHash,pdf,pdfHash:fileHash(pdf),parse:JSON.parse(parsed.stdout)};
    report.checks.push('Settled PDF failure recovers only the missing export under the original run and survives independent Word/PDF readback');
  }
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  if(app){
    report.instrumentation??=await app.evaluate(()=>globalThis.providerPaperRecovery).catch(()=>undefined);
    await app.close().catch(()=>{});
  }
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error?.split('\n')[0]}));
}
