import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {_electron} from 'playwright';

// Byte capacity is deliberately distinct from natural-corpus recall/recognition quality.
const arg=(key,fallback)=>Number(process.argv.find(v=>v.startsWith(key+'='))?.split('=')[1]??fallback);
const totalGiB=arg('--total-gib',1),stageGiB=arg('--stage-gib',1),fileMiB=arg('--file-mib',1024);
assert([totalGiB,stageGiB,fileMiB].every(v=>Number.isSafeInteger(v)&&v>0));
assert(totalGiB<=40&&stageGiB<=10&&fileMiB<=2048);
const fileBytes=fileMiB*1024**2,stageCount=stageGiB*1024/fileMiB;
assert(Number.isSafeInteger(stageCount)&&totalGiB%stageGiB===0);
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-byte-capacity-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const report={output,totalGiB,stageGiB,fileMiB,checks:[],stages:[],samples:[],queries:[],rendererErrors:[],
  buildSha256:createHash('sha256').update(fs.readFileSync(path.join(desktop,'out/main/index.js'))).digest('hex'),
  scope:'Production Electron folder UI, real non-sparse PDF bytes/copy/SHA, native PDF Worker and SQLite/FTS. Small visible synthetic text plus unreferenced binary load; NOT natural 40GiB teaching content, high-cardinality semantic recall, OCR/cloud quality or installer acceptance.'};
let app,page,timer,sampling=false;
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const sql=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
async function until(fn,ms=1800000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,500));}throw Error('Capacity deadline exceeded');}
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
    if(process.platform==='win32'){
      const parents=s.metrics.map(m=>m.pid).filter(Number.isSafeInteger);
      s.nativeWorkers=await new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-Command',`$owned=@(${parents.join(',')}); Get-CimInstance Win32_Process -Filter "Name='omni-edu-ocr.exe'" | Where-Object { $owned -contains [int]$_.ParentProcessId } | ForEach-Object { $p=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if($p){[pscustomobject]@{pid=$p.Id;parentPid=$_.ParentProcessId;workingSetBytes=$p.WorkingSet64;privateBytes=$p.PrivateMemorySize64}} } | ConvertTo-Json -Compress`],{windowsHide:true,timeout:4000},(_e,stdout)=>{try{const j=JSON.parse(stdout);resolve(Array.isArray(j)?j:[j]);}catch{resolve([]);}}));
    }
    report.samples.push(s);write();
  }catch{}finally{sampling=false;}
}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
  app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
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
  await page.locator('[data-testid="product-nav-materials"]:visible').click();
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
async function query(label){
  const start=performance.now();await page.getByTestId('materials-search-mode').selectOption('keyword');
  await page.getByTestId('materials-text-query').fill(label);await page.getByTestId('materials-text-submit').click();
  await until(async()=>!(await page.getByTestId('materials-text-submit').isDisabled()));
  const hits=page.locator('[data-testid^="material-text-hit-"]');await until(async()=>await hits.count()>0);
  const result=await page.getByTestId('materials-text-results').innerText();assert(result.includes(label));
  const elapsedMs=performance.now()-start;report.queries.push({label,elapsedMs,mode:'keyword',archiveBytes:sql('SELECT SUM(file_size) n FROM teacher_resources')[0].n});
}

try{
  write();await launch();
  for(let stage=0;stage<totalGiB/stageGiB;stage++){
    await space(stageGiB*2*1024**3);
    const folder=path.join(output,`source-${stage}`);await fsp.mkdir(folder);const manifest=[];const generatedAt=Date.now();
    for(let i=0;i<stageCount;i++){
      const label=`KBLOAD${stage}DOC${String(i).padStart(3,'0')}`,file=path.join(folder,label+'.pdf');
      manifest.push({label,file,bytes:fileBytes,sha256:await pdf(file,label)});
    }
    const s={stage,manifest,generationMs:Date.now()-generatedAt,started:Date.now(),bytes:stageGiB*1024**3};report.stages.push(s);write();
    await app.evaluate(({dialog},folder)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async(_win,options)=>{dialog.showOpenDialog=old;assertDirectory(options);return{canceled:false,filePaths:[folder]};};function assertDirectory(options){if(!options.properties.includes('openDirectory'))throw Error('Not a directory chooser');}},folder);
    await page.getByTestId('materials-import-folder').click();
    const batch=await until(()=>sql('SELECT * FROM material_import_batches WHERE root_path=?',[folder])[0]);s.batchId=batch.id;
    if(stage===0){
      await page.getByTestId('batch-pause-'+batch.id).click();
      await until(()=>sql('SELECT status FROM material_import_batches WHERE id=?',[batch.id])[0].status==='paused');
      await close();await launch();assert.equal(sql('SELECT status FROM material_import_batches WHERE id=?',[batch.id])[0].status,'paused');
      await page.getByTestId('batch-resume-'+batch.id).click();report.checks.push('Teacher pauses real large-file import; native restart preserves pause and UI resume uses the same batch');
    }
    const finished=await until(()=>{const row=sql('SELECT * FROM material_import_batches WHERE id=?',[batch.id])[0];return ['completed','partial','failed'].includes(row.status)?row:undefined;});
    s.archiveMs=Date.now()-s.started;assert.equal(finished.status,'completed',JSON.stringify(finished));
    await until(()=>{const rows=sql('SELECT r.parse_status FROM teacher_resources r JOIN material_import_entries e ON e.resource_id=r.id WHERE e.batch_id=?',[batch.id]);
      if(rows.some(r=>['failed','needs_ocr'].includes(r.parse_status)))throw Error('Native parser failed: '+JSON.stringify(rows));
      return rows.length===stageCount&&rows.every(r=>r.parse_status==='ready');});
    s.parseMs=Date.now()-s.started;
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
  report.final={...sql('SELECT COUNT(*) files,SUM(file_size) bytes FROM teacher_resources')[0],chunks:sql('SELECT COUNT(*) n FROM resource_chunks')[0].n};
  assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{try{await close();}catch(e){report.closeError=String(e);process.exitCode=1;}write();console.log(JSON.stringify({success:report.success,error:report.error,checks:report.checks,output}));}
