import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {once} from 'node:events';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {windowsOcrMetrics} from '../acceptance/windows-ocr-metrics.mjs';

// Byte capacity is deliberately distinct from natural-corpus recall/recognition quality.
const arg=(key,fallback)=>Number(process.argv.find(v=>v.startsWith(key+'='))?.split('=')[1]??fallback);
const totalGiB=arg('--total-gib',1),stageGiB=arg('--stage-gib',1),fileMiB=arg('--file-mib',1024);
const observationMs=arg('--observation-ms',1800000);
assert([totalGiB,stageGiB,fileMiB].every(v=>Number.isSafeInteger(v)&&v>0));
assert(totalGiB<=40&&stageGiB<=10&&fileMiB<=2048);
assert(Number.isSafeInteger(observationMs)&&observationMs>=1000&&observationMs<=1800000);
const fileBytes=fileMiB*1024**2,stageCount=stageGiB*1024/fileMiB;
assert(Number.isSafeInteger(stageCount)&&totalGiB%stageGiB===0);
const desktop=process.cwd(),resume=process.argv.find(v=>v.startsWith('--resume='))?.slice(9);
const main=testMain(desktop),acceptance=fs.realpathSync(process.env.OMNI_EDU_ACCEPTANCE_ROOT||os.tmpdir());
const output=resume?path.resolve(resume):fs.mkdtempSync(path.join(acceptance,'omni-byte-capacity-'));
if(resume){assert.equal(path.dirname(output),acceptance);assert(/^omni-byte-capacity-[a-z0-9]+$/i.test(path.basename(output)));assert.equal(fs.realpathSync(output),output);}
const data=path.join(output,'data'),profile=path.join(output,'profile');
const buildSha256=createHash('sha256').update(fs.readFileSync(main)).digest('hex');
const report=resume?JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8')):{output,totalGiB,stageGiB,fileMiB,checks:[],stages:[],samples:[],queries:[],rendererErrors:[],
  main,buildSha256,
  scope:'Production Electron folder UI, real non-sparse PDF bytes/copy/SHA, native PDF Worker and SQLite/FTS. Small visible synthetic text plus unreferenced binary load; NOT natural 40GiB teaching content, high-cardinality semantic recall, OCR/cloud quality or installer acceptance.'};
assert(report.output===output&&report.totalGiB===totalGiB&&report.stageGiB===stageGiB&&report.fileMiB===fileMiB);
if(resume){const backup='report-attempt-'+Date.now()+'.json';fs.copyFileSync(path.join(output,'report.json'),path.join(output,backup),fs.constants.COPYFILE_EXCL);(report.attempts??=[]).push({backup,error:report.error,success:report.success,resumedAt:Date.now()});delete report.error;delete report.closeError;delete report.success;}
let app,page,timer,sampling=false;
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const sql=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
async function until(fn,ms=observationMs){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,500));}throw Error('Capacity deadline exceeded');}
async function space(needed){const s=await fsp.statfs(output);assert(s.bavail*s.bsize>needed+8*1024**3,'Insufficient disk: preserve at least 8GiB');}
async function hashFile(file){const h=createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}

async function pdf(file,label){
  await space(fileBytes*2);
  const out=fs.createWriteStream(file,{flags:'wx'}),h=createHash('sha256');let offset=0;const offsets=[0];
  const writeBytes=async value=>{const b=Buffer.isBuffer(value)?value:Buffer.from(value);h.update(b);offset+=b.length;if(!out.write(b))await once(out,'drain');};
  const obj=async(n,body)=>{offsets[n]=offset;await writeBytes(`${n} 0 obj\n${body}\nendobj\n`);};
  try{
    await writeBytes('%PDF-1.7\n');
    await obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    await obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    await obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
    await obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const body=`BT /F1 12 Tf 35 720 Td (${label}: Light travels in straight lines in a uniform medium.) Tj 0 -25 Td (Prisms split white light into different colours. Original source remains immutable.) Tj ET`;
    await obj(5,`<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);
    offsets[6]=offset;const payload=fileBytes-4096;
    await writeBytes(`6 0 obj\n<< /Length ${payload} >>\nstream\n`);
    const block=randomBytes(1024**2);for(let left=payload;left>0;left-=block.length)await writeBytes(block.subarray(0,Math.min(left,block.length)));
    await writeBytes('\nendstream\nendobj\n');
    const padding=fileBytes-offset-500;assert(padding>=0);await writeBytes('%'+ ' '.repeat(padding)+'\n');
    const xref=offset;
    await writeBytes('xref\n0 7\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join(''));
    await writeBytes(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    // Exact file length makes byte accounting independently checkable.
    await writeBytes(' '.repeat(fileBytes-offset));out.end();await once(out,'close');
    assert.equal((await fsp.stat(file)).size,fileBytes);return h.digest('hex');
  }catch(error){out.destroy();throw error;}
}

async function sample(){
  if(sampling||!app)return;sampling=true;
  try{
    const s=await app.evaluate(async({app})=>({time:Date.now(),metrics:app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,workingSetKiB:m.memory.workingSetSize})),main:await process.getProcessMemoryInfo(),workers:globalThis.capacityWorkers||[],reads:globalThis.capacityReads||[],cloudRequests:globalThis.capacityCloud||0}));
    const native=await windowsOcrMetrics(s.metrics.map(m=>m.pid));
    s.nativeWorkers=native.workers;
    if(native.error)s.nativeWorkerSampleError=native.error;
    s.view=await page.evaluate(()=>({view:document.querySelector('.edu-shell[data-view]')?.getAttribute('data-view'),materials:!!document.querySelector('[data-testid="materials-workspace"]'),commands:globalThis.capacityCommands||[],events:globalThis.capacityEvents||[]})).catch(()=>undefined);
    report.samples.push(s);write();
  }catch{}finally{sampling=false;}
}
async function launch(){
  const launch={time:Date.now(),buildSha256};
  (report.launches??=[]).push(launch);
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:output,env,timeout:60000});
  await app.evaluate(({net})=>{
    globalThis.capacityCloud=0;globalThis.capacityWorkers=[];globalThis.capacityReads=[];
    for(const object of [globalThis,net]){object.fetch=async()=>{globalThis.capacityCloud++;throw Error('Capacity fixture blocks all network');};}
    const cp=process.getBuiltinModule('child_process'),spawn=cp.spawn;
    cp.spawn=function(...args){const child=spawn.apply(this,args);if(String(args[0]).endsWith('omni-edu-ocr.exe')&&child.pid)globalThis.capacityWorkers.push(child.pid);return child;};
    const fs=process.getBuiltinModule('fs'),read=fs.createReadStream;
    fs.createReadStream=function(...args){const start=Date.now(),stream=read.apply(this,args);stream.once('end',()=>{if(stream.bytesRead>=1024**2)globalThis.capacityReads.push({file:String(args[0]),bytes:stream.bytesRead,elapsedMs:Date.now()-start,highWaterMark:stream.readableHighWaterMark});});return stream;};
    process.getBuiltinModule('module').syncBuiltinESMExports();
  });
  page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
  await page.evaluate(()=>{globalThis.capacityCommands=[];globalThis.capacityEvents=[];window.omniEdu.onDesktopCommand?.(command=>globalThis.capacityCommands.push({command,time:Date.now()}));document.addEventListener('click',e=>{globalThis.capacityEvents.push({time:Date.now(),testId:e.target.closest('[data-testid]')?.getAttribute('data-testid')});globalThis.capacityEvents=globalThis.capacityEvents.slice(-20);},true);});
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await page.getByTestId('materials-select-folder').waitFor();
  launch.libraryUsableMs=Date.now()-launch.time;
  await assertIsolatedPiMain(app,main,profile);
  timer=setInterval(()=>void sample(),5000);await sample();
}
async function close(){
  clearInterval(timer);await until(()=>!sampling,10000);
  if(app){
    await sample();
    const cloud=await app.evaluate(()=>globalThis.capacityCloud||0);report.cloudRequests=(report.cloudRequests||0)+cloud;
    await app.close();app=undefined;assert.equal(cloud,0,'Unexpected network request blocked by capacity fixture');
  }
}

async function revealBatches(){
  const queue=page.getByTestId('materials-queue-toggle');
  if(await queue.getAttribute('aria-expanded')!=='true')await queue.click();
  const batches=page.getByTestId('materials-batches').getByRole('button',{name:'文件夹批次与恢复'});
  if(await batches.getAttribute('aria-expanded')!=='true')await batches.click();
}
async function query(label){
  const before=await page.evaluate(()=>({view:document.querySelector('.edu-shell[data-view]')?.getAttribute('data-view'),materials:!!document.querySelector('[data-testid="materials-workspace"]'),commands:globalThis.capacityCommands||[],events:globalThis.capacityEvents||[]}));
  if(!before.materials){(report.navigationInterruptions??=[]).push({time:Date.now(),label,...before});await page.screenshot({path:path.join(output,'navigation-interruption-'+Date.now()+'.png')});}
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await page.getByTestId('materials-workspace').waitFor();
  await page.getByTestId('materials-mode-text').click();
  const start=performance.now();await page.getByTestId('materials-search-mode').selectOption('keyword');
  await page.getByTestId('materials-text-query').fill(label);await page.getByTestId('materials-text-submit').click();
  await until(async()=>!(await page.getByTestId('materials-text-submit').isDisabled()));
  const hits=page.locator('[data-testid^="material-text-hit-"]');await until(async()=>await hits.count()>0);
  await page.getByTestId('materials-text-results').getByText(label,{exact:false}).first().waitFor();
  const result=await page.getByTestId('materials-text-results').innerText();assert(result.includes(label));
  const elapsedMs=performance.now()-start;report.queries.push({label,elapsedMs,mode:'keyword',archiveBytes:sql('SELECT SUM(file_size) n FROM teacher_resources')[0].n});
}

try{
  write();await launch();
  for(let stage=0;stage<totalGiB/stageGiB;stage++){
    let s=report.stages.find(s=>s.stage===stage);
    if(s?.completed&&s.ownedInputsRemoved){assert.equal(sql('SELECT COUNT(*) n FROM material_import_entries WHERE batch_id=? AND status=?',[s.batchId,'saved'])[0].n,stageCount);continue;}
    const folder=path.join(output,`source-${stage}`);
    if(!s){
      await space(stageGiB*2*1024**3);await fsp.mkdir(folder);const manifest=[],generatedAt=Date.now();
      for(let i=0;i<stageCount;i++){
        const label=`KBLOAD${stage}DOC${String(i).padStart(3,'0')}`,file=path.join(folder,label+'.pdf');
        manifest.push({label,file,bytes:fileBytes,sha256:await pdf(file,label)});
      }
      s={stage,manifest,generationMs:Date.now()-generatedAt,started:Date.now(),bytes:stageGiB*1024**3};report.stages.push(s);write();
    }
    const manifest=s.manifest;assert.equal(manifest.length,stageCount);for(const item of manifest){assert.equal(path.dirname(item.file),folder);assert.equal(item.bytes,fileBytes);}
    if(!s.batchId){
      await app.evaluate(({dialog},folder)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async(_win,options)=>{dialog.showOpenDialog=old;assertDirectory(options);return{canceled:false,filePaths:[folder]};};function assertDirectory(options){if(!options.properties.includes('openDirectory'))throw Error('Not a directory chooser');}},folder);
      const selectedAt=performance.now();
      await page.getByTestId('materials-select-folder').click();
      const confirm=page.getByTestId('material-import-selection').getByRole('button',{name:`导入 ${stageCount} 个文件`,exact:true});
      await confirm.waitFor();
      s.selectionMs=performance.now()-selectedAt;
      await page.screenshot({path:path.join(output,`selection-${stage}.png`)});
      s.confirmedAt=Date.now();
      await confirm.click();
    }
    const batch=await until(()=>sql('SELECT * FROM material_import_batches WHERE root_path=?',[folder])[0]);s.batchId=batch.id;
    if(stage===0&&!report.checks.some(c=>c.startsWith('Teacher pauses'))){
      await revealBatches();
      await page.getByTestId('batch-pause-'+batch.id).click();
      await until(()=>sql('SELECT status FROM material_import_batches WHERE id=?',[batch.id])[0].status==='paused');
      await close();await launch();assert.equal(sql('SELECT status FROM material_import_batches WHERE id=?',[batch.id])[0].status,'paused');
      await revealBatches();
      s.resumedAt=Date.now();
      await page.getByTestId('batch-resume-'+batch.id).click();report.checks.push('Teacher pauses real large-file import; native restart preserves pause and UI resume uses the same batch');
    }
    const finished=await until(()=>{const row=sql('SELECT * FROM material_import_batches WHERE id=?',[batch.id])[0];return ['completed','partial','failed'].includes(row.status)?row:undefined;});
    s.archiveMs??=Date.now()-s.started;assert.equal(finished.status,'completed',JSON.stringify(finished));
    await until(()=>{const rows=sql('SELECT r.parse_status FROM teacher_resources r JOIN material_import_entries e ON e.resource_id=r.id WHERE e.batch_id=?',[batch.id]);
      if(rows.some(r=>['failed','needs_ocr'].includes(r.parse_status)))throw Error('Native parser failed: '+JSON.stringify(rows));
      return rows.length===stageCount&&rows.every(r=>r.parse_status==='ready');});
    s.parseMs??=Date.now()-s.started;
    if(s.confirmedAt)s.parseFromConfirmationMs??=Date.now()-s.confirmedAt;
    if(s.resumedAt)s.parseFromResumeMs??=Date.now()-s.resumedAt;
    const saved=sql('SELECT r.id,r.original_file_name,r.local_path,r.file_size,r.content_hash,r.parse_status FROM teacher_resources r JOIN material_import_entries e ON e.resource_id=r.id WHERE e.batch_id=?',[batch.id]);
    assert.equal(saved.length,manifest.length);
    for(const item of manifest){const r=saved.find(r=>r.original_file_name===path.basename(item.file));assert(r);assert.equal(r.file_size,item.bytes);assert.equal(r.content_hash,item.sha256);assert.equal(await hashFile(r.local_path),item.sha256);assert(sql('SELECT content_md FROM resource_chunks WHERE resource_id=?',[r.id]).some(c=>c.content_md.includes(item.label)));}
    await query(manifest[0].label);await query(manifest.at(-1).label);await sample();
    const before=sql('SELECT id,content_hash,file_size,parse_status FROM teacher_resources ORDER BY id');
    await close();await launch();assert.deepEqual(sql('SELECT id,content_hash,file_size,parse_status FROM teacher_resources ORDER BY id'),before);
    await query(manifest.at(-1).label);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
    s.completed=Date.now();s.archivedBytes=sql('SELECT SUM(file_size) n FROM teacher_resources')[0].n;
    assert.equal(s.archivedBytes,(stage+1)*stageGiB*1024**3);report.checks.push(`${(stage+1)*stageGiB}GiB actual archive verified by SHA, readable native pages, keyword lookup and native restart`);write();
    // Delete only exact generated inputs after their immutable managed originals were verified.
    for(const item of manifest){assert.equal(path.dirname(item.file),folder);assert.equal(await hashFile(item.file),item.sha256);await fsp.unlink(item.file);}await fsp.rmdir(folder);s.ownedInputsRemoved=true;write();
    console.log(JSON.stringify({stage,archivedBytes:s.archivedBytes,archiveMs:s.archiveMs,parseMs:s.parseMs,output}));
  }
  await query('KBLOAD0DOC000');await query(report.stages.at(-1).manifest.at(-1).label);
  report.final={...sql('SELECT COUNT(*) files,SUM(file_size) bytes FROM teacher_resources')[0],chunks:sql('SELECT COUNT(*) n FROM resource_chunks')[0].n,
    sqliteBytes:fs.statSync(path.join(data,'app.db')).size};
  assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;try{report.failureView=await page.evaluate(()=>({view:document.querySelector('.edu-shell[data-view]')?.getAttribute('data-view'),text:document.body.innerText.slice(0,1500),commands:globalThis.capacityCommands||[],events:globalThis.capacityEvents||[]}));await page.screenshot({path:path.join(output,'failure-'+Date.now()+'.png')});}catch{}}
finally{try{await close();}catch(e){report.closeError=String(e);report.success=false;process.exitCode=1;}write();console.log(JSON.stringify({success:report.success,error:report.error,checks:report.checks,output}));}
