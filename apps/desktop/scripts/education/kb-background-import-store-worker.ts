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
  return {success:true,checks,first,files:count+1,overviewsDuringBackground:0,totalMs:performance.now()-started,scope:'Actual OmniEduStore, SQLite, real file copying and local text parsing; synthetic 301 files, not 40GB, OCR, cloud quality or installer acceptance'};
 }finally{await store.close();}
}
