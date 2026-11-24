import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles,productEntry} from '../product-navigation.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const inputs=JSON.parse(process.env.OMNI_EDU_NATURAL_MOCK_EXAM_INPUTS??'[]');
assert(acceptance&&inputs.length===2&&inputs.every(path.isAbsolute));
const expected=[
  {name:'上海杨浦区2025届高三一模数学试卷.pdf',pages:4,sha256:'c05eb0867d2ca3cdeeee8e6dd73fdd6e20c617cd43f4e89be304601f938d87f6'},
  {name:'上海杨浦区2025届高三一模数学试卷（缺页对照）.pdf',pages:3,sha256:'0094802e2861d9c87f9708fc806540807c7fce3c19094369566f816b5991af5a'},
];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output=fs.mkdtempSync(path.join(acceptance,'natural-mock-exam-'));
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const data=path.join(output,'data'),profile=path.join(output,'profile');
const files=expected.map(({name,sha256},index)=>{
  assert.equal(sha(inputs[index]),sha256,'Use the approved original local scan and its known missing-page control');
  const file=path.join(output,name);
  fs.copyFileSync(inputs[index],file,fs.constants.COPYFILE_EXCL);
  return file;
});
const report={ok:false,output,mainSha256:sha(main),sources:expected,checks:[],paidRequests:0};
let app,page;
const check=message=>{report.checks.push(message);console.log('PASS '+message);};
function sql(statement){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(statement).all();}finally{db.close();}
}
async function until(read,description,timeout=90000){
  const end=Date.now()+timeout;
  do{
    const actual=await read();
    if(actual)return actual;
    await new Promise(resolve=>setTimeout(resolve,250));
  }while(Date.now()<end);
  throw Error('Timed out: '+description);
}

async function open(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'natural-mock-exam-loopback',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  const bootstrap=path.join(output,cold?'restart.cjs':'startup.cjs');
  fs.writeFileSync(bootstrap,`
    const {ipcMain,net}=require('electron');
    globalThis.naturalBeforeWindow=0;
    net.fetch=async input=>{
      const url=new URL(typeof input==='string'?input:input.url??input.href);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      globalThis.naturalBeforeWindow++;throw Error('Outbound requests are disabled during launch');
    };
    if(!${cold}){
      const handle=ipcMain.handle.bind(ipcMain);
      const first=globalThis.naturalFirstConversation={saved:false};
      const hold=new Promise(resolve=>{first.release=resolve;});
      ipcMain.handle=(name,listener)=>handle(name,name==='aiConversations:createSession'?async(...args)=>{
        const result=await listener(...args);
        if(!first.saved){first.saved=true;await hold;}
        return result;
      }:listener);
    }
    import(${JSON.stringify(pathToFileURL(main).href)});
  `);
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net,dialog},{files,cold})=>{
    const wire=globalThis.naturalCatalogFixture={cold,calls:[],blocked:globalThis.naturalBeforeWindow};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url??input.href);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      if(cold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions'){
        wire.blocked++;throw Error('Unexpected outbound request in local scan test');
      }
      const body=JSON.parse(init.body),history=wire.calls;
      const stage=wire.delivery?'export':'compile';
      const index=history.filter(item=>item.stage===stage).length;
      let call,content;
      if(stage==='compile'){
        if(index===0)call={name:'education_build_mock_exam_catalog',args:{year:2025,subject:'数学',grade:'高三'}};
        else if(index===1)content='已生成待核对目录。';
        else throw Error('Unexpected extra catalogue call');
      }else{
        const {source,outputs}=wire.delivery;
        const toolData=body.messages.findLast(item=>item.role==='tool')?.content;
        const returned=typeof toolData==='string'?toolData:toolData?.map(part=>part.text||'').join('\n');
        const firstLine=index&&returned?JSON.parse(returned.split('\n')[0]):undefined;
        const system=body.messages.filter(item=>item.role==='system').map(item=>item.content).join('\n');
        const line=system.split('\n').findLast(value=>value.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
        const task=line?JSON.parse(line):{requirementsVersion:Number([...system.matchAll(/"requirementsVersion":(\d+)/gu)].at(-1)?.[1]||1),revision:0};
        if(index===0)call={name:'education_read_mock_exam_for_export',args:{catalogId:source.catalogId}};
        else if(index===1){
          if(!firstLine?.success||firstLine.digest!==source.digest)throw Error('Confirmed source does not match the export request');
          call={name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
            expectedRevision:task.revision,reason:'保存含原件证据和缺页提醒的模考目录',steps:[
              {id:'deliver',text:'保存目录',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},
              {id:'review',text:'老师核对目录',dependsOn:['deliver'],reported:'pending',kind:'human'},
            ]}};
        }else if(index===2)call={name:'education_export_mock_exam_catalog',args:{...source,outputs,taskStepId:'deliver'}};
        else if(index===3){
          if(firstLine?.outcome!=='saved')throw Error('Both outputs were not saved');
          content='目录已保存，保留原卷缺页待核提示。';
        }else throw Error('Unexpected extra export call');
      }
      if(call&&!body.tools?.some(item=>item.function.name===call.name))throw Error('Tool unavailable: '+call.name);
      history.push({stage,tool:call?.name});
      const delta=call?{tool_calls:[{index:0,id:'natural-'+stage+'-'+index,type:'function',function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
      const frame=(value,finish_reason=null)=>'data: '+JSON.stringify({id:'natural-local',object:'chat.completion.chunk',created:1,
        model:'deepseek-flash',choices:[{index:0,delta:value,finish_reason}]})+'\n\n';
      return new Response(frame({role:'assistant',content:''})+frame(delta)+frame({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{files,cold});
  await page.setViewportSize({width:1366,height:768});
}

async function send(text){
  await page.getByTestId('office-prompt-input').fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
}
const artifacts=()=>sql('SELECT id,file_name,file_path,content_hash FROM document_artifacts ORDER BY file_name');
const extract=[
  'import json,sys,zipfile,xml.etree.ElementTree as ET','file=sys.argv[1]',
  "if file.endswith('.pdf'):"," import fitz"," with fitz.open(file) as doc: text=' '.join(page.get_text() for page in doc)",
  'else:'," with zipfile.ZipFile(file) as archive:","  root=ET.fromstring(archive.read('word/document.xml'))",
  "  text=' '.join(node.text or '' for node in root.iter() if node.tag.endswith('}t'))",
  'print(json.dumps(text,ensure_ascii=True))',
].join('\n');

try{
  await open();
  await until(()=>app.evaluate(()=>globalThis.naturalFirstConversation.saved),'main persists the first conversation while its reply is held');
  await productEntry(page,'materials').click();
  await app.evaluate(()=>globalThis.naturalFirstConversation.release());
  await page.getByTestId('materials-workspace').waitFor();
  await productEntry(page,'ask').click();
  await until(async()=>await page.getByTestId('office-prompt-input').isEnabled(),'return from the library reopens the first conversation',12000);
  const initialSessions=sql('SELECT id FROM ai_conversation_sessions WHERE archived_at IS NULL');
  assert.equal(initialSessions.length,1);
  assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'),initialSessions[0].id);
  assert.equal(sql('SELECT count(*) n FROM ai_agent_runs')[0].n,0);
  check('Leaving Ask during the first saved session reply keeps the library open. Returning reuses exactly that session and enables typing without sending.');
  await productEntry(page,'materials').click();
  const started=Date.now();
  await page.getByTestId('materials-import').click();
  const originals=await until(()=>{
    const resources=sql('SELECT id,original_file_name,local_path,content_hash,parse_status FROM teacher_resources');
    const jobs=sql('SELECT resource_id,total,state FROM material_pdf_jobs');
    if(jobs.some(job=>job.state==='failed'))throw Error('Local PDF parse failed');
    return resources.length===2&&resources.every(item=>item.parse_status==='ready')&&jobs.length===2&&jobs.every(job=>job.state==='complete')
      ?resources.map(resource=>({...resource,pages:jobs.find(job=>job.resource_id===resource.id).total})):null;
  },'both PDFs parsed locally from an empty database',300000);
  report.importMs=Date.now()-started;
  for(const fixture of expected){
    const record=originals.find(resource=>resource.original_file_name===fixture.name);
    assert.equal(record?.pages,fixture.pages);
    assert.equal(record.content_hash,fixture.sha256);
    assert.equal(sha(record.local_path),fixture.sha256);
  }
  check('Fresh UI import preserves both real scan hashes and independently parses four and three pages.');

  await productEntry(page,'ask').click();
  await send('请把资料库里的2025年上海杨浦高三数学一模试卷整理成年度目录，保留来源与许可。');
  const card=page.getByTestId('pi-mock-exam-catalog').last();
  await card.waitFor({timeout:90000});
  await card.getByRole('button').first().click();
  const full=card.getByTestId('mock-exam-row').filter({hasText:expected[0].name});
  const missing=card.getByTestId('mock-exam-row').filter({hasText:expected[1].name});
  await missing.waitFor();
  assert.match(await full.getByTestId('mock-exam-page-evidence').innerText(),/文件 4 页.*一致/u);
  assert.match(await missing.getByTestId('mock-exam-page-evidence').innerText(),/疑似缺页.*疑缺第 2 页/u);
  for(const entry of [full,missing])assert.match(await entry.getByTestId('mock-exam-cover-evidence').innerText(),/封面学年度 2024.*封面考试月份 2024 年 12 月.*文件名 2025 届/u);
  assert.match(await missing.innerText(),/缺答案.*许可待核对/us);
  await page.screenshot({path:path.join(output,'natural-draft-1366.png')});
  await until(()=>sql("SELECT status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1")[0]?.status==='succeeded','catalogue first Run completes');
  check('The catalogue retains the intact original, flags page 2 in the control, and distinguishes the school year from the exam month and graduating class.');

  await missing.getByTestId('mock-exam-row-edit').click();
  await missing.getByTestId('mock-exam-include').check();
  const confirm=card.getByTestId('mock-exam-confirm');
  await confirm.click();
  const issue=card.getByTestId('mock-exam-error');
  await issue.waitFor();
  assert.match(await issue.innerText(),/年份.*需要核对/u);
  assert.equal(sql("SELECT count(*) n FROM mock_exam_compilation_versions WHERE state='confirmed'")[0].n,0);
  const year=missing.getByTestId('mock-exam-field-year');
  assert.equal(await year.inputValue(),'');
  await year.fill('2025');
  await confirm.click();
  const source=await until(()=>sql("SELECT c.id catalogId,v.revision,v.digest FROM mock_exam_compilations c JOIN mock_exam_compilation_versions v ON c.id=v.catalog_id AND c.revision=v.revision WHERE v.state='confirmed'")[0],'teacher-reviewed classification');
  report.catalog=source;
  assert.match(await missing.getByTestId('mock-exam-page-evidence').innerText(),/疑缺第 2 页/u);
  check('The year needs a teacher decision before confirmation, and confirming it preserves unresolved scan and rights evidence.');

  const outputs=[{format:'docx',path:'杨浦模考缺页核对.docx'},{format:'pdf',path:'杨浦模考缺页核对.pdf'}];
  await app.evaluate((_,delivery)=>{globalThis.naturalCatalogFixture.delivery=delivery;},{source,outputs});
  await send('把已确认的上海杨浦模考汇编目录导出一份 Word 和一份 PDF，保留缺页核对提示。');
  const bundle=page.getByTestId('pi-composer-pending-panel').getByTestId('pi-delivery-bundle');
  const approve=bundle.getByTestId('pi-delivery-approve');
  await approve.waitFor({timeout:90000});
  assert.equal(await bundle.getByTestId('pi-delivery-file').count(),2);
  assert.equal(artifacts().length,0);
  await page.screenshot({path:path.join(output,'natural-delivery-1366.png')});
  await approve.click();
  const saved=await until(()=>{const rows=artifacts();return rows.length===2&&rows;},'both approved files are saved');
  for(const file of saved){
    assert.equal(file.content_hash,sha(file.file_path));
    const result=spawnSync('python',['-c',extract,file.file_path],{encoding:'utf8',windowsHide:true,timeout:15000});
    assert.equal(result.status,0,result.stderr||String(result.error));
    const text=JSON.parse(result.stdout).replace(/\s+/gu,'');
    assert.match(text,/疑缺第2页/u);
    assert.match(text,/封面学年度2024.*封面考试月份2024年12月.*文件名2025届/u);
  }
  report.files=saved.map(({file_name,content_hash})=>({name:file_name,sha256:content_hash}));
  await until(()=>sql('SELECT status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0]?.status==='succeeded','export Run completes');
  const wire=await app.evaluate(()=>globalThis.naturalCatalogFixture);
  assert.equal(wire.blocked,0);
  report.localRequests=wire.calls;
  check('One confirmation above the input saves two files; actual Word and PDF text retain both the missing page and year evidence.');

  await app.close();app=undefined;
  await open(true);
  await openTeachingFiles(page);
  await page.getByTestId('teaching-mock-exams-tab').click();
  await page.getByTestId('mock-exam-result-'+source.catalogId).getByRole('button').click();
  const detail=page.getByTestId('mock-exam-detail');
  await detail.getByTestId('mock-exam-page-evidence').filter({hasText:'疑缺第 2 页'}).waitFor();
  await page.setViewportSize({width:1920,height:1080});
  await page.screenshot({path:path.join(output,'natural-cold-catalog-1920.png')});
  assert.deepEqual(artifacts(),saved);
  for(const original of originals)assert.equal(sha(original.local_path),original.content_hash);
  const cold=await app.evaluate(()=>globalThis.naturalCatalogFixture);
  assert.deepEqual(cold.calls,[]);assert.equal(cold.blocked,0);
  check('Cold launch restores the original catalogue and unchanged output and input hashes without replay.');
  report.ok=true;
}catch(error){
  report.error=String(error.stack||error);
  if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
  process.exitCode=1;
}finally{
  await app?.evaluate(()=>globalThis.naturalFirstConversation?.release()).catch(()=>undefined);
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));
}
