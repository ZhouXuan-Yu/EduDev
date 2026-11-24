import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles,productEntry} from '../product-navigation.mjs';
import {readMockExamZip} from './read-mock-exam-zip.mjs';

const {OMNI_EDU_ACCEPTANCE_ROOT:root,OMNI_EDU_SHARED_ANSWER_FIXTURE:fixture}=process.env;
assert(root&&fixture);
const baseline=process.argv.includes('--baseline');
const seed=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(seed.success&&seed.cloudRequests===0);
const output=fs.mkdtempSync(path.join(root,'shared-archive-')),oldData=path.join(fixture,'data');
const data=path.join(output,'data'),profile=path.join(output,'profile'),wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||!fs.statSync(wal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,baseline,output,mainSha256:sha(main),paidRequests:0,checks:[]};
let app,page,catalogId;

function sql(statement,args=[],write=false){
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write,timeout:5000});
 try{return write?db.prepare(statement).run(...args):db.prepare(statement).all(...args);}finally{db.close();}
}
const originals=sql('SELECT id,original_file_name,content_hash,local_path FROM teacher_resources');
assert.equal(originals.length,3);
for(const item of originals){
 const relative=path.relative(oldData,item.local_path);
 assert(relative.startsWith('teacher_resources'+path.sep));
 item.local_path=path.join(data,relative);
 assert.equal(sha(item.local_path),item.content_hash);
 sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[item.local_path,item.id],true);
}
const first=originals.find(r=>r.original_file_name==='试题.pdf');
const second=originals.find(r=>r.original_file_name==='试题乙.pdf');
const answer=originals.find(r=>r.original_file_name==='答案.pdf');
assert(first&&second&&answer);
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
const held=()=>sql('SELECT id,status,file_name,content_hash FROM mock_exam_archives');
const current=()=>sql('SELECT revision,digest,state FROM mock_exam_compilation_versions WHERE catalog_id=? ORDER BY revision DESC LIMIT 1',[catalogId])[0];
const detail=()=>page.getByTestId('mock-exam-detail');
const pane=()=>detail().getByTestId('mock-exam-archive-plan');
const timeout=60000;
async function until(read){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){const result=await read();if(result)return result;await new Promise(resolve=>setTimeout(resolve,150));}
 throw Error('Catalogue transition timed out');
}
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:'synthetic-shared-mock-exam-archive',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[name];
 app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout});
 await app.evaluate(({net},isCold)=>{
  globalThis.archiveWire={calls:0,illegal:[]};
  net.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input.url);
   if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return Response.json({object:'list',
    data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]});
   const name='education_build_mock_exam_catalog',wire=globalThis.archiveWire;
   if(isCold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions'||wire.calls>=2){
    wire.illegal.push(url.pathname);throw Error('Unexpected dispatch');
   }
   const body=JSON.parse(init.body),toolCall=wire.calls++===0;
   if(toolCall&&!body.tools?.some(tool=>tool.function.name===name))throw Error('Catalogue tool unavailable');
   const payload=toolCall?{tool_calls:[{index:0,id:'shared-archive-catalog',type:'function',function:{name,arguments:'{"year":2025}'}}]}:
    {content:'已整理两份模考试卷，请核对。'};
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'shared-archive',object:'chat.completion.chunk',
    created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant'})+chunk(payload)+chunk({},toolCall?'tool_calls':'stop')+'data: [DONE]\n\n',
    {headers:{'content-type':'text/event-stream'}});
  };
 },cold);
 await assertIsolatedPiMain(app,main,profile);
 page=await app.firstWindow();
 page.setDefaultTimeout(30000);
 if(!cold){
  const saved=await page.evaluate(async()=>{
   const settings=await window.omniEdu.getXiaozhiSettings();
   return window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:settings.value.version,
    defaultModel:'deepseek-flash',apiKey:'synthetic-shared-mock-exam-archive'});
  });
  assert(saved.ok,JSON.stringify(saved));
 }
}
async function openCatalogue(){
 await openTeachingFiles(page);
 await page.getByTestId('teaching-mock-exams-tab').click();
 await page.getByTestId('mock-exam-result-'+catalogId).getByRole('button').click();
 await detail().getByTestId('mock-exam-archive-preview').waitFor();
}
async function preview(revision=current()){
 const sessionId=sql('SELECT session_id FROM mock_exam_compilations WHERE id=?',[catalogId])[0].session_id;
 const key={schemaVersion:'xiaozhi.mock-exam-archive.v1',sessionId,catalogId,revision:revision.revision,digest:revision.digest};
 const planned=await page.evaluate(input=>window.omniEdu.previewMockExamArchive(input),key);
 assert(planned.ok,JSON.stringify(planned));
 await detail().getByTestId('mock-exam-archive-preview').click();
 await pane().waitFor();
 return {...planned.value,key};
}
const row=(form,source)=>form.getByTestId('mock-exam-row').filter({has:page.getByText(source.original_file_name,{exact:true})});

try{
 await launch();
 const restored=await page.evaluate(async({paper,answer})=>{
  const view=await window.omniEdu.getMaterialBookPair(paper.id);
  return window.omniEdu.setMaterialBookPair({schemaVersion:'xiaozhi.material-book-pair.v1',action:'link',resourceId:paper.id,
   version:paper.content_hash,revision:view.revision,answerId:answer.id,answerVersion:answer.content_hash});
 },{paper:first,answer});
 assert(restored.current);
 await productEntry(page,'ask').click();
 await page.getByTestId('pi-new-session').click();
 await page.getByTestId('office-prompt-input').fill('请整理资料库中 2025 年上海徐汇区和虹口区初三物理一模试卷的汇编目录。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const card=page.getByTestId('pi-mock-exam-catalog').last();
 await card.getByRole('button').first().click({timeout});
 catalogId=sql('SELECT id FROM mock_exam_compilations ORDER BY rowid DESC LIMIT 1')[0].id;
 report.catalogId=catalogId;
 for(const [i,paper] of [first,second].entries()){
  const item=row(card,paper);
  await item.getByTestId('mock-exam-row-edit').click();
  await item.getByTestId('mock-exam-permission').selectOption('local_only');
  await item.getByTestId('mock-exam-answer-permission').selectOption(i===0?'local_only':'excluded');
 }
 await card.getByTestId('mock-exam-confirm').click();
 await until(()=>current().state==='confirmed');
 await openCatalogue();
 const heldPlan=await preview();
 assert.equal(heldPlan.paperCount,2);
 assert.equal(heldPlan.answerCount,1);
 assert.equal(heldPlan.entries.find(item=>item.paper.resourceId===second.id).answer.omission,'permission_denied');
 assert(!heldPlan.entries.find(item=>item.paper.resourceId===second.id).answer.path);
 await pane().getByRole('button',{name:'取消预览'}).click();
 assert.equal(held().length,0);
 check('A permit for one paper does not give a second link permission or a path in the ZIP manifest');

 await detail().getByTestId('mock-exam-revise').click();
 await row(detail(),second).getByTestId('mock-exam-row-edit').click();
 await row(detail(),second).getByTestId('mock-exam-answer-permission').selectOption('local_only');
 await detail().getByTestId('mock-exam-confirm').click();
 await until(()=>current().state==='confirmed'&&current().revision>heldPlan.revision);
 const plan=await preview();
 assert.equal(plan.answerCount,baseline?2:1);
 assert.notEqual(plan.previewDigest,heldPlan.previewDigest);
 assert.equal(new Set(plan.entries.map(item=>item.answer.path)).size,baseline?2:1);
 if(!baseline)await pane().getByText(/共用文件，入包一次/u).first().waitFor();
 await page.screenshot({path:path.join(output,'preview.png')});
 const bytes=fs.readFileSync(answer.local_path);
 try{
  fs.appendFileSync(answer.local_path,'\nfixture integrity change');
  await pane().getByTestId('mock-exam-archive-save').click();
  await detail().getByTestId('mock-exam-archive').getByRole('alert').waitFor();
  assert.equal(held().length,0);
 }finally{fs.writeFileSync(answer.local_path,bytes);}
 check('Changing the single shared original after preview rejects both references and leaves no ZIP');

 await preview();
 await pane().getByTestId('mock-exam-archive-save').click();
 await detail().getByTestId('mock-exam-archive-saved').waitFor();
 const [saved]=held();
 assert.equal(saved.status,'exported');
 const artifact=(await page.evaluate(()=>window.omniEdu.listDocumentArtifacts())).find(item=>item.id===saved.id);
 const archive=readMockExamZip(artifact.filePath);
 assert.equal(sha(artifact.filePath),saved.content_hash);
 assert.equal(archive.manifest.answerCount,baseline?2:1);
 assert.equal(Object.keys(archive.files).length,baseline?6:5);
 assert.equal(archive.manifest.entries.length,2);
 for(const item of archive.manifest.entries){
  assert.equal(archive.files[item.answer.path],answer.content_hash);
  assert.equal(archive.files[item.paper.path],originals.find(r=>r.id===item.paper.resourceId).content_hash);
  if(!baseline)assert(item.answer.shared&&item.answer.path.startsWith('答案册/共用/'));
 }
 report.archive={file:artifact.filePath,sha256:saved.content_hash,fileSize:fs.statSync(artifact.filePath).size,answerCopies:archive.manifest.answerCount};
 check('Both permitted entries can open the exact verified originals in the saved ZIP');

 assert.deepEqual(await app.evaluate(()=>globalThis.archiveWire.illegal),[]);
 await app.close();app=undefined;
 await launch(true);await openCatalogue();await preview();
 await pane().getByTestId('mock-exam-archive-save').click();
 await detail().getByTestId('mock-exam-archive-saved').waitFor();
 assert.deepEqual(held(),[saved]);
 assert.equal(sha(artifact.filePath),saved.content_hash);
 assert.deepEqual(await app.evaluate(()=>globalThis.archiveWire),{calls:0,illegal:[]});
 check('Cold confirmation reopens the same byte-identical ZIP without repeated writes or a model request');
 report.ok=true;
}catch(error){
 report.error=error.stack;process.exitCode=1;
 if(app)report.wire=await app.evaluate(()=>globalThis.archiveWire).catch(()=>undefined);
 if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
}finally{
 await app?.close().catch(()=>undefined);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({ok:report.ok,output,checks:report.checks.length,error:report.error}));
}
