import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {OmniEduStore} from '../../src/main/db';

export async function backgroundImportStore(output:string){
 const folder=path.join(output,'教师资料'),root=path.join(output,'data'),checks:string[]=[],count=300;
 await fs.mkdir(folder);for(let i=0;i<count;i++)await fs.writeFile(path.join(folder,`资料-${i}.txt`),`第${i}节：后台目录处理的完整内容；唯一标记用于文件来源复验。`);
 await fs.mkdir(path.join(folder,'子目录'));await fs.writeFile(path.join(folder,'子目录','尾页.txt'),'子目录末尾知识点：压轴二次函数顶点。');await fs.writeFile(path.join(folder,'跳过.zip'),'unsupported fixture');
 let store=new OmniEduStore(root),overviews=0,first:any,unblock:()=>void=()=>{};
 let copied:Promise<void>=new Promise(resolve=>{unblock=resolve;});
 const installOverviewCounter=()=>{const original=store.getKnowledgeOverview.bind(store);store.getKnowledgeOverview=async()=>{overviews++;return original();};};
 const query=(sql:string,p:any[]=[])=>((store as any).all(sql,p)) as Promise<any[]>;
 const until=async<T>(fn:()=>Promise<T>,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,30));}throw Error('background fixture timed out');};
 const started=performance.now();
 try{
  await store.init();await store.materialQueue.start();store.materialSearch.start();store.materialQuestions.start();installOverviewCounter();
  const host=(store.materialImports as any).host,ordinary=host.import;
  host.import=async(files:string[],signal:AbortSignal,guard:()=>Promise<void>)=>{
   if(!first){
    const discovered=Number((await query("SELECT COUNT(*) n FROM material_import_entries WHERE kind='file'"))[0].n);
    first={discovered,elapsedMs:performance.now()-started};const result=await ordinary(files,signal,guard);first.overviews=overviews;first.resourceId=result.resources[0]?.id;unblock();
    // Reproduce a stop after real bytes/business facts exist but before the archive ACK.
    await new Promise<void>((_yes,no)=>{if(signal.aborted)return no(Error('cancelled'));signal.addEventListener('abort',()=>no(Error('cancelled')),{once:true});});
   }
   return ordinary(files,signal,guard);
  };
  const id=await store.materialImports.create(folder);await Promise.race([copied,new Promise((_r,no)=>setTimeout(()=>no(Error('first archive timeout')),60000))]);
  assert(first.discovered<=128,`First copy was delayed until ${first.discovered} files had been discovered`);
  assert.equal(first.overviews,0,'Background single-file work must not request a whole-library overview');checks.push('First real archive begins within 128 discovered items and performs zero full-library overview reads');
  await store.materialImports.action({schemaVersion:'xiaozhi.material-import-batch.v1',batchId:id,action:'pause'});
  assert.equal((await store.materialImports.list()).batches[0].status,'paused');assert.equal(Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),1);
  assert.equal(Number((await query("SELECT COUNT(*) n FROM material_import_entries WHERE status='saved'"))[0].n),0);await store.close();
  store=new OmniEduStore(root);await store.init();await store.materialQueue.start();store.materialSearch.start();store.materialQuestions.start();installOverviewCounter();assert.equal((await store.materialImports.list()).batches[0].status,'paused');
  await store.materialImports.action({schemaVersion:'xiaozhi.material-import-batch.v1',batchId:id,action:'resume'});
  const done=await until(async()=>{const row=(await store.materialImports.list()).batches[0];return ['completed','partial','failed'].includes(row.status)?row:undefined;});
  assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.archived,count+1);assert.equal(done.failed,0);assert.equal(done.skipped,1);assert.equal(done.reused,1);
  assert.equal(Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),count+1);assert.equal(overviews,0);checks.push('Native Store reopen preserves manual pause and reuses the copied-but-unacknowledged resource without duplication');
  await until(async()=>{const queue=await store.materialQueue.snapshot();return !queue.pending&&!queue.running;});
  const resources=await query('SELECT original_file_name,local_path,content_hash,parse_status FROM teacher_resources');
  for(const resource of resources){assert.equal(resource.parse_status,'ready');const bytes=await fs.readFile(resource.local_path);assert.equal(createHash('sha256').update(bytes).digest('hex'),resource.content_hash);}
  checks.push('All 301 supported files reach the existing local text parser, with exact persisted original-file SHA256');
  const firstName=resources[0].original_file_name,selected=firstName==='尾页.txt'?path.join(folder,'子目录',firstName):path.join(folder,firstName);
  const publicResult=await store.importKnowledgeResources([selected],new AbortController().signal,true);assert(publicResult.overview);assert.equal(publicResult.resources.length,1);assert(publicResult.items[0].reused);assert.equal(overviews,1);checks.push('Existing public import still returns the complete overview and unchanged duplicate behavior');
  const noSpace=path.join(output,'空间不足后恢复');await fs.mkdir(noSpace);
  for(let i=0;i<129;i++)await fs.writeFile(path.join(noSpace,`恢复-${i}.txt`),`空间恢复资料 ${i}：光在均匀介质中沿直线传播。`);
  const statfs=fs.statfs,archiveRoot=path.join(root,'teacher_resources');let archiveAttempts=0;
  const currentHost=(store.materialImports as any).host,currentImport=currentHost.import;
  currentHost.import=async(...args:any[])=>{archiveAttempts++;return currentImport(...args);};
  fs.statfs=(async(target:any,options:any)=>{const info=await statfs(target,options);return path.resolve(String(target))===archiveRoot?{...info,bavail:0}:info;}) as typeof fs.statfs;
  let failedId:string;
  try{
   failedId=await store.materialImports.create(noSpace);
   const failed=await until(async()=>{const batch=(await store.materialImports.list()).batches.find(b=>b.id===failedId);return batch&&['failed','partial','completed'].includes(batch.status)?batch:undefined;});
   assert.equal(failed.status,'failed','Disk full must stop the whole batch instead of attempting every file');
   assert.match(failed.error,/磁盘空间不足/);assert.equal(archiveAttempts,1);assert.equal(failed.archived,0);
   assert.equal(Number((await query("SELECT COUNT(*) n FROM material_import_entries WHERE batch_id=? AND kind='directory' AND status='failed'",[failedId]))[0].n),0);
   assert.equal(Number((await query("SELECT COUNT(*) n FROM material_import_entries WHERE batch_id=? AND kind='file' AND status='pending'",[failedId]))[0].n),127);
   assert.equal(Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),count+1);
   checks.push('Real archive disk-space guard stops after one ENOSPC, preserves pending files and unscanned directory, and exposes actionable batch error');
  }finally{fs.statfs=statfs;currentHost.import=currentImport;}
  await store.close();store=new OmniEduStore(root);await store.init();await store.materialQueue.start();store.materialSearch.start();store.materialQuestions.start();
  const reopened=(await store.materialImports.list()).batches.find(b=>b.id===failedId!);assert.equal(reopened?.status,'failed');assert.match(reopened?.error||'',/磁盘空间不足/);
  await store.materialImports.action({schemaVersion:'xiaozhi.material-import-batch.v1',batchId:failedId!,action:'retry'});
  const recovered=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===failedId!);return b&&['completed','partial','failed'].includes(b.status)?b:undefined;});
  assert.equal(recovered.status,'completed');assert.equal(recovered.archived,129);assert.equal(recovered.failed,0);assert.equal(recovered.scanned,129);
  assert.equal(Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),count+130);
  checks.push('After native Store reopen and restored space, explicit retry rescans the interrupted directory and archives all 129 originals without loss or duplicate facts');
  const single=path.join(output,'尾批空间不足');await fs.mkdir(single);await fs.writeFile(path.join(single,'尾批.txt'),'尾批空间恢复后必须能继续归档。');
  fs.statfs=(async(target:any,options:any)=>{const info=await statfs(target,options);return path.resolve(String(target))===archiveRoot?{...info,bavail:0}:info;}) as typeof fs.statfs;
  let tailId:string;
  try{tailId=await store.materialImports.create(single);const tail=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===tailId);return b&&['failed','partial','completed'].includes(b.status)?b:undefined;});assert.equal(tail.status,'failed');assert.match(tail.error,/磁盘空间不足/);}
  finally{fs.statfs=statfs;}
  await store.materialImports.action({schemaVersion:'xiaozhi.material-import-batch.v1',batchId:tailId!,action:'retry'});
  const tail=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===tailId);return b&&['failed','partial','completed'].includes(b.status)?b:undefined;});assert.equal(tail.status,'completed');assert.equal(tail.archived,1);
  checks.push('Final drain below the 128-item discovery window also stops on ENOSPC and recovers through the unchanged retry action');
  const permissions=path.join(output,'单文件权限');await fs.mkdir(permissions);for(let i=0;i<3;i++)await fs.writeFile(path.join(permissions,`${i}.txt`),'权限问题不得阻止其他文件归档。');
  const permissionHost=(store.materialImports as any).host,permissionImport=permissionHost.import;
  permissionHost.import=async(files:string[],...args:any[])=>path.basename(files[0])==='1.txt'?{items:[{sourcePath:files[0],fileName:'1.txt',ok:false,fileSize:0,errorCode:'EACCES',errorMessage:'controlled local permission failure'}],resources:[]}:permissionImport(files,...args);
  try{const permissionId=await store.materialImports.create(permissions);const partial=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===permissionId);return b&&['failed','partial','completed'].includes(b.status)?b:undefined;});assert.equal(partial.status,'partial');assert.equal(partial.archived,2);assert.equal(partial.failed,1);assert.match((await store.materialImports.files(permissionId,0)).files.find(f=>f.status==='failed')?.error||'',/权限/);}
  finally{permissionHost.import=permissionImport;}
  checks.push('Single-file EACCES remains a partial batch with two other real archives and an actionable permission message');
  const dbFullFolder=path.join(output,'复制后数据库空间不足');await fs.mkdir(dbFullFolder);await fs.writeFile(path.join(dbFullFolder,'数据库写满.txt'),'原件复制成功但数据库写满时不得遗留无主副本。');
  const filesBefore=(await fs.readdir(archiveRoot)).sort(),resourcesBefore=Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),ordinaryRun=(store as any).run.bind(store);
  (store as any).run=async(sql:string,...args:any[])=>{if(/INSERT INTO teacher_resources\s*\(/.test(sql))throw Object.assign(new Error('database or disk is full'),{code:'SQLITE_FULL'});return ordinaryRun(sql,...args);};
  let dbFullId:string;
  try{dbFullId=await store.materialImports.create(dbFullFolder);const full=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===dbFullId);return b&&['failed','partial','completed'].includes(b.status)?b:undefined;});assert.deepEqual((await fs.readdir(archiveRoot)).sort(),filesBefore,'A copied original with no SQLite resource must be removed on failed publication');assert.equal(full.status,'failed');assert.match(full.error,/磁盘空间不足/);assert.equal(Number((await query('SELECT COUNT(*) n FROM teacher_resources'))[0].n),resourcesBefore);}
  finally{(store as any).run=ordinaryRun;}
  await store.materialImports.action({schemaVersion:'xiaozhi.material-import-batch.v1',batchId:dbFullId!,action:'retry'});
  const dbRecovered=await until(async()=>{const b=(await store.materialImports.list()).batches.find(b=>b.id===dbFullId);return b&&['failed','partial','completed'].includes(b.status)?b:undefined;});assert.equal(dbRecovered.status,'completed');assert.equal(dbRecovered.archived,1);assert.equal((await fs.readdir(archiveRoot)).length,filesBefore.length+1);
  checks.push('SQLITE_FULL after a real successful copy removes only the unpublished original, preserves existing files/facts and retries without an orphan duplicate');
  return {success:true,checks,first,files:count+1,recoveryFiles:129,tailFiles:1,permissionFiles:2,dbRecoveryFiles:1,overviewsDuringBackground:0,totalMs:performance.now()-started,scope:'Actual OmniEduStore, SQLite and real copy/parser: initial 301 files parsed, plus 129+1 disk-recovery, 2 permission-survivor and 1 SQLITE_FULL recovery archives. Controlled statfs/one permission result/SQLite insert failure, never fills the real disk. Not 40GB, OCR/cloud quality or installer acceptance'};
 }finally{await store.close();}
}
