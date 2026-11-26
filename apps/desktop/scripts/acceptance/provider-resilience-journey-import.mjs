import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const [prepared, acceptance, mode]=process.argv.slice(2);
assert(path.isAbsolute(prepared??'')&&path.isAbsolute(acceptance??''));
assert(mode===undefined||mode==='--require-text');
const dependencyDesktop=process.env.OMNI_EDU_PROVIDER_JOURNEY_DESKTOP;
const desktop=fs.realpathSync(dependencyDesktop||path.resolve(import.meta.dirname,'../..'));
const main=testMain(desktop);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const mainSha256=sha(main);
const executablePath=dependencyDesktop?createRequire(path.join(desktop,'package.json'))('electron'):undefined;
if(dependencyDesktop)assert.equal(mainSha256,process.env.OMNI_EDU_PROVIDER_JOURNEY_MAIN_SHA256);
const files=JSON.parse(fs.readFileSync(path.join(prepared,'inputs.json'),'utf8')).scans;
const expected=['SYN-OCR-01','SYNTHETIC-A-A','SYNTHETIC-A-B','SYNTHETIC-M-A','SYNTHETIC-M-B','SYNTHETIC-M-C'].map(name=>name+'.pdf');
assert.deepEqual(files.map(row=>row.file).sort(),expected);
const root=fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-journey-import-'));
const source=path.join(root,'source'),data=path.join(root,'data'),profile=path.join(root,'profile');
const report={ok:false,scope:mode?'Fixture archiving and native OCR per source':'Fixture archiving and source identity',root,mainSha256,
  build:{entry:main,dependency:Boolean(dependencyDesktop),electron:executablePath},parseTimeline:[],
  inputs:{prepared,sha256:sha(path.join(prepared,'inputs.json'))}};
fs.mkdirSync(source);
for(const file of files){
  const raw=path.join(prepared,file.file);
  assert.equal(sha(raw),file.sha256);
  fs.copyFileSync(raw,path.join(source,file.file),fs.constants.COPYFILE_EXCL);
}

const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(name)));
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1'});
delete env.OMNI_EDU_E2E_DIALOG_MODE;
let app,page;
const dbFile=path.join(data,'app.db');
function read(query){
  const db=new DatabaseSync(dbFile,{readOnly:true,timeout:5000});
  try{return db.prepare(query).all();}finally{db.close();}
}
try{
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],executablePath,cwd:desktop,env,timeout:60_000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({dialog,net},folder)=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});
    globalThis.journeyExternalCalls=0;
    net.fetch=async()=>{globalThis.journeyExternalCalls++;throw Error('Synthetic material intake is offline');};
  },source);
  page=await app.firstWindow();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await page.getByTestId('materials-select-folder').click();
  const selection=page.getByTestId('material-import-selection');
  const submit=selection.getByRole('button',{name:'导入 6 个文件',exact:true});
  await submit.waitFor({timeout:60_000});
  assert.equal(read('SELECT count(*) n FROM teacher_resources')[0].n,0);
  report.selection=await selection.innerText();
  try {
    await selection.screenshot({path:path.join(root,'fixed-inputs-selected.png'),animations:'disabled',timeout:5_000});
  } catch (error) {
    report.selectionScreenshotError=String(error.message??error);
  }
  await submit.click();
  const deadline=performance.now()+60_000;
  while(performance.now()<deadline){
    const [batch]=read('SELECT id,status FROM material_import_batches ORDER BY created_at DESC LIMIT 1');
    if(batch&&['completed','partial','failed'].includes(batch.status)){report.batch=batch;break;}
    await delay(100);
  }
  assert.equal(report.batch?.status,'completed');
  const rows=read('SELECT id,original_file_name,local_path,parse_status,parse_engine FROM teacher_resources ORDER BY original_file_name');
  assert.deepEqual(rows.map(row=>row.original_file_name),expected);
  report.files=rows.map(row=>{
    const actual=sha(row.local_path);
    assert.equal(actual,files.find(file=>file.file===row.original_file_name).sha256);
    return {file:row.original_file_name,id:row.id,sha256:actual,parseStatus:row.parse_status,parseEngine:row.parse_engine};
  });
  if(mode){
    // The native owner may use up to five minutes per PDF. Archiving and
    // native parsing have separate observation windows.
    const parseStarted=performance.now(),parseDeadline=parseStarted+files.length*300_000+60_000;
    let previous='';
    while(performance.now()<parseDeadline){
      const sources=read('SELECT original_file_name,parse_status,parse_engine FROM teacher_resources ORDER BY original_file_name');
      const chunks=read(`SELECT r.original_file_name,c.page_number,c.content_md
        FROM resource_chunks c JOIN teacher_resources r ON c.resource_id=r.id ORDER BY r.original_file_name,c.chunk_index`);
      const snapshot={sources,publishedPages:chunks.map(({original_file_name,page_number})=>({original_file_name,page_number}))};
      const signature=JSON.stringify(snapshot);
      if(signature!==previous){report.parseTimeline.push({elapsedMs:Math.round(performance.now()-parseStarted),...snapshot});previous=signature;}
      if(new Set(chunks.map(chunk=>chunk.original_file_name)).size===files.length){report.ocr=chunks;break;}
      if(sources.some(source=>source.parse_status==='failed'))break;
      assert(!page.isClosed(),'The isolated desktop closed before the local parse jobs completed');
      await delay(500);
    }
    assert(report.ocr,'All fixed scans need text from the real local parser');
    assert(report.ocr.every(chunk=>chunk.page_number===1&&chunk.content_md.trim()));
    const inSource=name=>report.ocr.filter(chunk=>chunk.original_file_name===name+'.pdf').map(chunk=>chunk.content_md).join('\n');
    for(const suffix of ['A','B']){
      assert.match(inSource('SYNTHETIC-A-'+suffix),/ANSWER\s*KEY/iu);
      assert.doesNotMatch(inSource('SYNTHETIC-M-'+suffix),/ANSWER\s*KEY/iu);
    }
    assert.match(inSource('SYNTHETIC-M-C'),/PAGE\s*1\s*OF\s*2/iu);
    report.processed=read('SELECT original_file_name,parse_status,parse_engine FROM teacher_resources ORDER BY original_file_name');
  }
  report.externalCalls=await app.evaluate(()=>globalThis.journeyExternalCalls);
  assert.equal(report.externalCalls,0);
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({root,ok:report.ok,files:report.files?.length,error:report.error}));
}
