import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {openTeachingFiles,productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(root);
const desktop=path.resolve(import.meta.dirname,'../..'),repo=path.resolve(desktop,'../..'),main=testMain(desktop);
const output=fs.mkdtempSync(path.join(root,'district-scan-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const expected=[
  {name:'2026奉贤三模(3).pdf',sha256:'24c4675a7676053459b6223a7bbfc0020e12b1d5c33db5e0dac9484dcde4e9b6'},
  {name:'26年6月风华初三三模模拟测试卷(1).pdf',sha256:'edc42e345797f89f99958228db677c0030229fdcaaa43f5d6a7faa33bb8042d7'},
];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=expected.map(({name,sha256})=>{
  const file=path.join(repo,'test',name);
  assert.equal(sha(file),sha256);
  return file;
});
const report={ok:false,output,mainSha256:sha(main),paidRequests:0,checks:[],expected};
const tableReview=process.argv.includes('--table-review');
let app,page;
function sql(query){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(query).all();}finally{db.close();}
}
function check(text){report.checks.push(text);console.log('PASS '+text);}
async function until(label,read,ms=90000){
  const deadline=Date.now()+ms;
  do{const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,250));}while(Date.now()<deadline);
  throw Error('Timed out: '+label);
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:'isolated-district-scan'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net,dialog},{files,cold})=>{
    const state=globalThis.districtScan={requests:0,receipts:[],unexpected:[]};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url??input.href);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')return Response.json({object:'list',
        data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]});
      if(cold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions'||state.requests>=4){
        state.unexpected.push(url.pathname);throw Error('No outbound model dispatch permitted');
      }
      const body=JSON.parse(init.body),index=state.requests++,year=index<2?2026:2025;
      const name='education_build_mock_exam_catalog';
      const call=index%2===0?{name,arguments:JSON.stringify({year})}:undefined;
      if(call)assertTool();
      else{
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        state.receipts.push(JSON.parse(text?.split('\n').find(line=>line.startsWith('{'))));
      }
      function assertTool(){if(!body.tools?.some(tool=>tool.function.name===name))throw Error('Native catalogue tool unavailable');}
      const next=call?{tool_calls:[{index:0,id:'district-'+year,type:'function',function:call}]}:
        {content:state.receipts.at(-1)?.success?'已生成目录，请核对。':'没有找到符合范围的原件。'};
      const frame=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'district-scan',object:'chat.completion.chunk',
        model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
      return new Response(frame({role:'assistant'})+frame(next)+frame({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{files,cold});
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  await page.setViewportSize({width:cold?1920:1366,height:cold?1080:768});
}
async function ask(year){
  await page.getByTestId('office-prompt-input').fill(`请整理资料库中 ${year} 年上海奉贤区初三物理三模试卷的汇编目录。`);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
}
const scanRead=()=>app.evaluate(()=>globalThis.districtScan);
async function checkTableUI(resourceId,phase){
  await productEntry(page,'materials').click();
  await page.getByTestId('material-'+resourceId).getByRole('button').click();
  await page.getByTestId('materials-section-questions').click();
  const panel=page.getByTestId('material-structure-panel');
  await openMaterialDisclosure(panel);
  for(let n=2;n<=4;n++){
    await panel.getByTestId('structure-next').click();
    await panel.getByText(`第 ${n} 页`,{exact:true}).waitFor();
  }
  const table=panel.getByTestId('structure-table-evidence').filter({hasText:'4 行 4 列'});
  await openMaterialDisclosure(table);
  const rows=table.getByRole('row');
  assert.equal(await rows.count(),4);
  assert.deepEqual(await rows.nth(1).getByRole('cell').allTextContents(),['物距/cm','22.5','30.0','60.0']);
  await table.getByTestId('structure-table-original').click();
  await table.getByTestId('structure-table-original-image').waitFor();
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`ruled-table-${phase}.png`)});
}

try{
  await launch();
  await page.getByTestId('office-prompt-input').waitFor();
  await productEntry(page,'materials').click();
  const started=Date.now();
  await page.getByTestId('materials-import').click();
  const originals=await until('both scans complete OCR and publish their local structure',()=>{
    const rows=sql(`SELECT r.id,r.original_file_name,r.content_hash,r.local_path,r.parse_status,j.total,j.state FROM teacher_resources r
      JOIN material_pdf_jobs j ON j.resource_id=r.id AND j.version=r.content_hash`);
    if(rows.some(row=>row.state==='failed'))throw Error('Local PDF OCR failed');
    return rows.length===2&&rows.every(row=>row.state==='complete'&&row.parse_status==='ready')?rows:null;
  },360000);
  report.importMs=Date.now()-started;
  for(const item of expected){
    const row=originals.find(row=>row.original_file_name===item.name);
    assert.equal(row.total,6);assert.equal(row.content_hash,item.sha256);assert.equal(sha(row.local_path),item.sha256);
  }
  report.coverReadbacks=sql(`SELECT r.original_file_name,json_extract(p.result_json,'$.text') AS text FROM material_pdf_pages p
    JOIN material_pdf_jobs j ON p.generation=j.generation JOIN teacher_resources r ON r.id=j.resource_id WHERE p.page=1`)
    .map(({original_file_name,text})=>({original_file_name,heading:text.split(/\r?\n/u).slice(0,6).join('\n')}));
  check('Both six-page project scans go through real import and local OCR with their original bytes preserved.');
  const district=originals.find(row=>row.original_file_name===expected[0].name);
  if(tableReview){
    const layouts=sql(`SELECT r.original_file_name,j.engine,p.page,json_extract(p.body_json,'$.tableSources') tables
      FROM material_structure_pages p JOIN material_structure_jobs j ON j.generation=p.generation
      JOIN teacher_resources r ON r.id=j.resource_id WHERE p.page IN (3,4,6) ORDER BY r.original_file_name,p.page`);
    assert(layouts.every(row=>row.engine==='layout-paragraph-question.v28'));
    const grids=(file,num)=>JSON.parse(layouts.find(row=>row.original_file_name===file&&row.page===num).tables??'[]');
    const [pictureTable]=grids(expected[0].name,4).filter(table=>table.rows.length===4);
    assert.deepEqual(pictureTable.rows[1].map(cell=>cell.text),['物距/cm','22.5','30.0','60.0']);
    assert(pictureTable.rows[3].slice(1).every(cell=>cell.needsReview&&!cell.text));
    assert(grids(expected[0].name,3).some(table=>table.rows.length===2&&table.rows[0].length===12));
    assert(grids(expected[0].name,6).some(table=>table.rows.length===3&&table.rows[0].length===3));
    assert(grids(expected[1].name,4).some(table=>table.rows.length===3&&table.rows[0].length===4));
    report.table={resolved:pictureTable.rows.map(row=>row.map(cell=>cell.text)),pending:pictureTable.rows.flat().filter(cell=>cell.needsReview).length};
    await checkTableUI(district.id,'1366');
    check('The real illustrated table keeps its numeric cells and original image, without transcribing diagrams or altering the regular grids.');
  }

  await productEntry(page,'ask').click();
  await ask(2026);
  const card=page.getByTestId('pi-mock-exam-catalog').last();
  await card.getByRole('button').first().click({timeout:90000});
  const row=card.getByTestId('mock-exam-row').filter({hasText:expected[0].name});
  await row.waitFor();
  const snapshot=()=>sql('SELECT image_json,digest,state,revision FROM mock_exam_compilation_versions ORDER BY revision DESC LIMIT 1')[0];
  const draft=JSON.parse(snapshot().image_json);
  report.draft=draft;
  assert.equal(draft.entries.length,1,'School-internal paper must not become a district paper');
  const [entry]=draft.entries;
  assert.equal(entry.version,expected[0].sha256);
  assert.deepEqual(entry.metadata,{district:'奉贤区',year:2026,subject:'物理',grade:'九年级',round:'三模'});
  assert.deepEqual(entry.cover,{page:1,academicYear:2025,examMonth:{year:2026,month:5}});
  assert.equal(entry.include,true);assert.equal(entry.permission,'unknown');assert.equal(entry.answer.state,'missing');
  await row.getByTestId('mock-exam-cover-evidence').getByText(/学年度 2025.*2026 年 5 月/u).waitFor();
  await page.screenshot({path:path.join(output,'district-draft-1366.png')});
  check('Fengxian is matched to the printed 2026 exam month and physical subject; the school-only scan is outside the district scope.');

  const confirm=card.getByTestId('mock-exam-confirm');
  await until('first Run releases catalogue confirmation',()=>confirm.isEnabled());
  await confirm.click();
  const confirmed=await until('confirmed current catalogue',()=>{const next=snapshot();return next?.state==='confirmed'&&next;});
  assert.equal(confirmed.revision,2);
  check('Teacher confirms the actual original with missing answer and use permission retained.');
  await ask(2025);
  const requests=await until('both catalogue replies',async()=>{const current=await scanRead();return current.receipts.length===2&&current;});
  assert(requests.receipts[0].success);assert.equal(requests.receipts[1].success,false);
  assert.equal(requests.receipts[1].error,'no_sources');
  assert.equal(sql('SELECT count(*) AS n FROM mock_exam_compilations')[0].n,1);
  assert.deepEqual(requests.unexpected,[]);
  check('2025 school year is not admitted to a request for 2025 exams; no second catalogue is written.');

  const [{id:catalogId}]=sql('SELECT id FROM mock_exam_compilations');
  await until('negative Run settles',()=>sql("SELECT status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1")[0]?.status==='succeeded');
  await app.close();app=undefined;
  await launch(true);
  await openTeachingFiles(page);
  await page.getByTestId('teaching-mock-exams-tab').click();
  await page.getByTestId('mock-exam-result-'+catalogId).getByRole('button').click();
  await page.getByTestId('mock-exam-detail').getByText(expected[0].name,{exact:true}).waitFor();
  assert.equal((await scanRead()).requests,0);
  assert.deepEqual(snapshot(),confirmed);
  await page.screenshot({path:path.join(output,'district-cold-1920.png')});
  check('Independent workbench opens the confirmed version after restart with no model replay.');
  if(tableReview){
    await checkTableUI(district.id,'cold-1920');
    assert.equal(sql('SELECT count(*) AS n FROM material_structure_reviews')[0].n,0);
    assert.deepEqual(snapshot(),confirmed);
    check('The new table structure remains visible after restart without silently recording teacher confirmation.');
  }
  report.ok=true;
}catch(error){
  report.error=String(error.stack||error);process.exitCode=1;
  if(app)report.wire=await scanRead().catch(()=>undefined);
  if(page)await page.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);
}finally{
  if(app)await app.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));
}
