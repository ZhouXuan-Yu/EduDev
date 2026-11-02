import sqlite3 from 'sqlite3';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Relocate mutable file addresses in the new copy. Immutable event/native/check facts stay byte-identical. */
export type RestoredExternalRoot={sourceRoot:string;targetRoot:string;files:string[]};
export async function relocateBackupDatabase(file:string,fromData:string,toData:string,fromOutputs:string,toOutputs:string,external:RestoredExternalRoot[]=[]){
 const db=await new Promise<sqlite3.Database>((resolve,reject)=>{const d=new sqlite3.Database(file,sqlite3.OPEN_READWRITE,e=>e?reject(e):resolve(d));});
 const run=(q:string,a:unknown[]=[])=>new Promise<void>((resolve,reject)=>db.run(q,a,e=>e?reject(e):resolve()));
 const all=(q:string,a:unknown[]=[])=>new Promise<Record<string,unknown>[]>((resolve,reject)=>db.all(q,a,(e,r)=>e?reject(e):resolve(r as Record<string,unknown>[])));
 const externalFiles=new Map(external.flatMap(r=>r.files.map(f=>[path.join(r.sourceRoot,f).toLowerCase(),path.join(r.targetRoot,f)] as const)));
 const relocate=(value:string)=>{for(const [oldRoot,newRoot]of [[fromData,toData],[fromOutputs,toOutputs]]){const relative=path.relative(oldRoot,value);if(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep))return path.join(newRoot,relative);}return externalFiles.get(path.normalize(value).toLowerCase())||value;};
 const relocateRoot=(value:string)=>external.find(r=>path.normalize(r.sourceRoot).toLowerCase()===path.normalize(value).toLowerCase())?.targetRoot||relocate(value);
 const warnings:string[]=[];
 try{
  const integrity=await all('PRAGMA quick_check');if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw Error('备份数据库损坏，未激活恢复');
  const tables=new Set((await all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>String(r.name)));
  await run('BEGIN IMMEDIATE');
  for(const [table,column]of [['attachments','file_path'],['document_artifacts','file_path'],['teacher_resources','local_path'],['mistake_image_analyses','local_path'],['xiaozhi_pi_office_drafts','result_path']]){
   if(!tables.has(table))continue;
   for(const row of await all(`SELECT rowid AS recovery_rowid,"${column}" AS value FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}"<>''`)){
    const old=String(row.value);if(!path.isAbsolute(old))continue;const next=relocate(old);if(next!==old)await run(`UPDATE "${table}" SET "${column}"=? WHERE rowid=?`,[next,row.recovery_rowid]);
   }
  }
  // Default outputs are owned by this instance. External grants are recorded in the receipt but not revived.
  const sessions=tables.has('ai_conversation_sessions')?await all('SELECT id FROM ai_conversation_sessions'):[];
  const hashes=new Map(sessions.map(r=>[hash(path.join(fromOutputs,String(r.id))),hash(path.join(toOutputs,String(r.id)))]));
  for(const root of external)hashes.set(hash(root.sourceRoot),hash(root.targetRoot));
  if(tables.has('xiaozhi_pi_workspaces'))for(const row of await all('SELECT path FROM xiaozhi_pi_workspaces')){
   const old=String(row.path),next=relocateRoot(old);if(next!==old&&next.startsWith(toOutputs+path.sep))hashes.set(hash(old),hash(next));
  }
  for(const table of ['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs']){
   if(!tables.has(table))continue;
   for(const row of await all(`SELECT rowid AS recovery_rowid,path FROM "${table}"`)){
    const old=String(row.path),next=relocateRoot(old);
    if(next!==old&&next.startsWith(toOutputs+path.sep))await run(`UPDATE "${table}" SET path=?${table.endsWith('paper_outputs')?',workspace_hash=?':''} WHERE rowid=?`,table.endsWith('paper_outputs')?[next,hash(next),row.recovery_rowid]:[next,row.recovery_rowid]);
    else{await run(`DELETE FROM "${table}" WHERE rowid=?`,[row.recovery_rowid]);if(!warnings.length)warnings.push('另选工作目录未包含在此备份中；原记录保留，使用其文件前请重新选择已单独恢复的目录。');}
   }
  }
  for(const table of ['xiaozhi_pi_text_changes','xiaozhi_pi_office_drafts'])if(tables.has(table))for(const [before,after]of hashes)await run(`UPDATE "${table}" SET workspace_hash=? WHERE workspace_hash=?`,[after,before]);
  // Keep schedulers usable for new explicit work, but never dispatch the copied backlog.
  if(tables.has('ai_tasks'))await run("UPDATE ai_tasks SET status='cancelled',error_message='cancelled' WHERE task_type='resource_parse' AND status IN ('pending','running')");
  if(tables.has('material_import_batches'))await run("UPDATE material_import_batches SET status='paused',owner_pid=0,owner_nonce='' WHERE status IN ('queued','running')");
  if(tables.has('material_folder_ai'))await run("UPDATE material_folder_ai SET status='paused' WHERE status='running'");
  if(tables.has('material_ai_batches'))await run("UPDATE material_ai_batches SET status='paused' WHERE status='running'");
  // No history is replayed here. Normal original startup recovery settles running/uncertain records.
  await run('COMMIT');return warnings;
 }catch(e){await run('ROLLBACK').catch(()=>undefined);throw e;}
 finally{await new Promise<void>((resolve,reject)=>db.close(e=>e?reject(e):resolve()));}
}
