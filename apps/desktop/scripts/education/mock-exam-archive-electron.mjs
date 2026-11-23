import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles,productEntry} from '../product-navigation.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_MOCK_EXAM_FIXTURE;
assert(root&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(baseline.ok&&baseline.paidRequests===0);
const {catalogId,sessionId}=baseline,oldData=path.resolve(fixture,'data');
const output=fs.mkdtempSync(path.join(root,'mock-exam-archive-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),wal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(wal)||!fs.statSync(wal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,output,catalogId,sessionId,main,mainSha256:sha(main),paidRequests:0,checks:[],pageErrors:[]};
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
const source=()=>sql('SELECT v.revision,v.state,v.digest,v.image_json FROM mock_exam_compilations c JOIN mock_exam_compilation_versions v ON c.id=v.catalog_id AND c.revision=v.revision WHERE c.id=?',[catalogId])[0];
const archives=()=>sql('SELECT id,status,stage_json,file_name,content_hash,file_size FROM mock_exam_archives');
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
async function until(read,timeout=75_000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,120));}
  throw Error('Mock exam archive condition timed out');
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-mock-exam-archive',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60_000});
  await app.evaluate(({net},{catalogId,cold})=>{
    const wire=globalThis.mockArchiveTest={requests:[],errors:[],running:false};
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      try{
        if(cold||!wire.running||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external request');
        const body=JSON.parse(init.body),list=body.tools.map(tool=>tool.function.name),index=wire.requests.length;
        const read='education_read_mock_exam_for_export';
        if(!list.includes(read)||list.includes('education_export_mock_exam_catalog')||list.includes('education_build_mock_exam_catalog'))
          throw Error('Unexpected tool route for archive');
        let delta,finish;
        if(!index){
          delta={tool_calls:[{index:0,id:'archive-catalog-read',type:'function',function:{name:read,arguments:JSON.stringify({catalogId})}}]};
          finish='tool_calls';wire.requests.push({tool:read});
        }else{
          const raw=body.messages.findLast(message=>message.role==='tool')?.content;
          const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
          const receipt=JSON.parse(text.split('\n')[0]);
          if(receipt.state!=='preview_available'||receipt.paperCount!==1||receipt.answerCount!==1)throw Error(JSON.stringify(receipt));
          delta={content:'已核对当前目录。请打开模考目录卡，预览后确认保存原件 ZIP。'};
          finish='stop';wire.requests.push({receipt});
        }
        const chunk=(value,finish_reason=null)=>'data: '+JSON.stringify({id:'mock-exam-archive',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta:value,finish_reason}]})+'\n\n';
        return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},finish)+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){wire.errors.push(String(error));throw error;}
    };
  },{catalogId,cold});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
}
async function openCatalogue(){
  await openTeachingFiles(page);
  await page.getByTestId('teaching-mock-exams-tab').click();
  await page.getByTestId('mock-exam-result-'+catalogId).getByRole('button').click();
  await page.getByTestId('mock-exam-detail').getByTestId('mock-exam-archive-preview').waitFor();
}
const detail=()=>page.getByTestId('mock-exam-detail');
const key=row=>({schemaVersion:'xiaozhi.mock-exam-archive.v1',sessionId,catalogId,revision:row.revision,digest:row.digest});
async function preview(){
  await detail().getByTestId('mock-exam-archive-preview').click();
  const pane=detail().getByTestId('mock-exam-archive-plan');
  await pane.waitFor();
  return pane;
}
function readZip(filename){
  const code=[
    'import json,sys,zipfile,hashlib',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    ' assert z.testzip() is None',
    " items={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}",
    " print(json.dumps({'files':items,'manifest':json.loads(z.read('清单.json'))},ensure_ascii=True))",
  ].join('\n');
  const result=spawnSync('python',['-c',code,filename],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return JSON.parse(result.stdout);
}

try{
  await launch();
  await page.setViewportSize({width:1366,height:768});
  await openCatalogue();
  const legacy=source(),legacyKey=key(legacy),first=await preview();
  assert.match(await first.innerText(),/1 份试卷 · 0 份独立答案册/u);
  await first.getByRole('button',{name:'取消预览'}).click();
  assert.equal(archives().length,0);
  const foreign=sql('SELECT id FROM ai_conversation_sessions WHERE id<>? LIMIT 1',[sessionId])[0].id;
  const forged=await page.evaluate(input=>window.omniEdu.previewMockExamArchive(input),{...legacyKey,sessionId:foreign});
  assert.equal(forged.ok,false);
  check('Legacy permission is not inherited by a linked answer booklet; preview or cancellation writes no archive and does not disclose another session');

  await detail().getByTestId('mock-exam-revise').click();
  const paper=detail().getByTestId('mock-exam-row').filter({hasText:'一模试卷甲卷'});
  await paper.getByTestId('mock-exam-row-edit').click();
  await paper.getByTestId('mock-exam-answer-permission').selectOption('local_only');
  await detail().getByTestId('mock-exam-confirm').click();
  const current=await until(()=>source().revision>legacy.revision&&source());
  const linked=JSON.parse(current.image_json).entries.find(entry=>entry.answerPermission?.permission==='local_only');
  assert(linked?.answer.resourceId&&linked.answerPermission.version===linked.answer.version);
  assert.equal((await page.evaluate(input=>window.omniEdu.previewMockExamArchive(input),legacyKey)).error,'version_conflict');
  const pane=await preview();
  assert.match(await pane.innerText(),/1 份试卷 · 1 份独立答案册/u);
  await page.screenshot({path:path.join(output,'approved-source-1366.png'),animations:'disabled'});
  const answer=sql('SELECT local_path FROM teacher_resources WHERE id=?',[linked.answer.resourceId])[0].local_path;
  const prior=fs.readFileSync(answer);
  try{
    fs.appendFileSync(answer,'\nSynthetic integrity change\n');
    await pane.getByTestId('mock-exam-archive-save').click();
    await detail().getByTestId('mock-exam-archive').getByRole('alert').waitFor();
    assert.equal(archives().length,0);
  }finally{fs.writeFileSync(answer,prior);}
  check('Teacher grants permission to one exact linked answer version; source drift and stale preview prevent any new ZIP');

  await page.setViewportSize({width:1920,height:1080});
  await (await preview()).getByTestId('mock-exam-archive-save').click();
  const saved=detail().getByTestId('mock-exam-archive-saved');
  await saved.waitFor();
  await page.screenshot({path:path.join(output,'saved-1920.png'),animations:'disabled'});
  const [row]=archives();
  assert.equal(row.status,'exported');assert.equal(row.stage_json,null);
  assert.equal(sql('SELECT count(*) n FROM document_artifacts WHERE id=?',[row.id])[0].n,0);
  const artifact=(await page.evaluate(()=>window.omniEdu.listDocumentArtifacts())).find(item=>item.id===row.id);
  assert.equal(artifact.type,'zip');assert.equal(artifact.mockExamSource.id,catalogId);
  assert.equal(sha(artifact.filePath),row.content_hash);
  const archive=readZip(artifact.filePath),manifest=archive.manifest;
  assert.equal(manifest.revision,current.revision);
  assert.equal(manifest.digest,current.digest);
  assert.equal(Object.keys(archive.files).length,4);
  const entry=manifest.entries.find(item=>item.paper.path);
  assert(entry.paper.path.startsWith('试卷/'));assert(entry.answer.path.startsWith('答案册/'));
  assert.equal(archive.files[entry.paper.path],linked.version);
  assert.equal(archive.files[entry.answer.path],linked.answer.version);
  assert(manifest.entries.find(item=>item.paper.omission==='permission_denied'));
  assert(manifest.entries.find(item=>item.answer.omission==='answer_missing'));
  await detail().getByRole('button',{name:'在教学文件查看'}).click();
  await page.getByTestId('artifacts-detail').getByRole('heading',{name:artifact.title,exact:true,level:2}).waitFor();
  assert(await page.getByRole('button',{name:'查看原件目录'}).isVisible());
  const location=await page.evaluate(target=>window.omniEdu.artifactFileAction({target,action:'location'}),{kind:'saved',sessionId,artifactId:row.id});
  assert(location.ok&&location.location.includes(row.file_name),JSON.stringify(location));
  report.artifact={id:row.id,filePath:artifact.filePath,sha256:row.content_hash,archive};
  check('Confirmed ZIP is readable in the teaching catalog and contains exact-byte originals, separate answers and an omission manifest');

  await productEntry(page,'ask').click();
  if(await page.locator('.office-composer-container').getAttribute('data-session-id')!==sessionId)
    await page.getByTestId('workbench-session-'+sessionId).click();
  await app.evaluate(()=>{globalThis.mockArchiveTest.running=true;});
  await page.getByTestId('office-prompt-input').fill('将已确认这份上海模考汇编的试卷原件和答案册打包为 ZIP。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(async()=>await app.evaluate(()=>globalThis.mockArchiveTest.requests.length===2||globalThis.mockArchiveTest.errors.length>0));
  const wire=await app.evaluate(()=>globalThis.mockArchiveTest);
  assert.deepEqual(wire.errors,[]);assert.equal(wire.requests[1].receipt.catalogId,catalogId);
  assert.equal(archives().length,1);
  check('Natural chat routes to the verified archive preview, without an autonomous write or ordinary document export');

  const currentKey=key(current);
  const repeat=await page.evaluate(async input=>{
    const preview=await window.omniEdu.previewMockExamArchive(input);
    return preview.ok?window.omniEdu.saveMockExamArchive({...input,previewDigest:preview.value.previewDigest}):preview;
  },currentKey);
  assert(repeat.ok&&repeat.value.artifactId===row.id);
  await app.close();app=undefined;
  // Model the persisted install boundary after the real ZIP exists but before its status was published.
  sql("UPDATE mock_exam_archives SET status='draft' WHERE id=?",[row.id],true);
  await launch(true);
  await openCatalogue();
  await (await preview()).getByTestId('mock-exam-archive-save').click();
  await detail().getByTestId('mock-exam-archive-saved').waitFor();
  assert.equal(archives().length,1);assert.equal(archives()[0].status,'exported');assert.equal(sha(artifact.filePath),row.content_hash);
  assert.deepEqual(await app.evaluate(()=>globalThis.mockArchiveTest.errors),[]);
  assert.deepEqual(report.pageErrors,[]);
  check('Repeat confirmation is idempotent and cold readback completes an installed file with an unpublished receipt without generating a second copy');
  report.ok=true;
}catch(error){
  report.error=error.stack;
  if(app)report.wire=await app.evaluate(()=>globalThis.mockArchiveTest).catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
  throw error;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(output);
}
