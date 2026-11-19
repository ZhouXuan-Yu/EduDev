import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {wordFixture} from './word-fixtures.mjs';
const {MaterialWordPagesRepository}=await import('../../src/main/assets/material-word-pages.ts');
const {validWordPagesQuery,WORD_PAGES_SCHEMA}=await import('../../src/shared/material-word-pages.ts');
const results=[];
const sha=data=>createHash('sha256').update(data).digest('hex');
async function check(name,action){await action();results.push(name);console.log('PASS '+name);}

async function fixture(){
 let root=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-word-pages-'));
 const db=new DatabaseSync(':memory:'),resources=new Map(),state={renders:0,publishes:0,failPublish:false,failAck:false};
 const bytes=await wordFixture(),id='resource_'+randomUUID(),version=sha(bytes),file=path.join(root,'source.docx');
 await fs.writeFile(file,bytes);
 resources.set(id,{id,title:'合成带图题',originalFileName:'合成带图题.docx',localPath:file,contentHash:version,fileSize:bytes.length,resourceType:'docx',parseStatus:'ready',parseEngine:'word-ooxml.v2',createdAt:'2026-11-17T00:00:00Z',updatedAt:'2026-11-17T00:00:00Z',chunkCount:1});
 let repo,tail=Promise.resolve();
 const host={root:()=>root,all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>{
  if(state.failAck&&sql.startsWith('UPDATE material_word_page_sources SET pdf_resource_id=')){state.failAck=false;throw Error('SQLITE_BUSY');}
  db.prepare(sql).run(...p);
 },resource:async id=>{const r=resources.get(id);if(!r)throw Error('material_not_found');return {...r};},
 original:async(id,version,signal)=>{signal.throwIfAborted();const r=resources.get(id),data=await fs.readFile(r.localPath);if(r.contentHash!==version||sha(data)!==version)throw Error('source_changed');return data;},
 verify:async(id,version,signal)=>{await host.original(id,version,signal);},
 stamp:async(id,version)=>{const r=resources.get(id);if(!r||r.contentHash!==version)throw Error('source_changed');const s=await fs.stat(r.localPath);return JSON.stringify([r.localPath,s.size,s.mtimeMs,s.ctimeMs]);},
 duplicate:async(name,hash,size,signal)=>{
  for(const r of resources.values())if(r.originalFileName===name&&r.contentHash===hash&&r.fileSize===size){try{await host.verify(r.id,hash,signal);return{...r};}catch(error){signal.throwIfAborted();}}
 },publish:async(file,signal,guard)=>{
  state.publishes++;await guard();const data=await fs.readFile(file),newId='resource_'+randomUUID(),dest=path.join(root,newId+'.pdf');await fs.writeFile(dest,data);await guard();
  const r={...resources.get(id),id:newId,title:'原版页面',originalFileName:path.basename(file),localPath:dest,contentHash:sha(data),fileSize:data.length,resourceType:'pdf',parseStatus:'needs_parser',chunkCount:0};resources.set(newId,r);
  if(state.failPublish){state.failPublish=false;throw Error('unavailable');}return{...r};
 },writer:action=>{const task=tail.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(repo);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}});tail=task.catch(()=>{});return task;}};
 repo=new MaterialWordPagesRepository(host);await repo.migrate();await repo.migrate();
 const query={schemaVersion:WORD_PAGES_SCHEMA,resourceId:id,version};
 const render=async(data,job,signal)=>{state.renders++;signal.throwIfAborted();assert.equal(sha(data),version);const pdf=Buffer.from('%PDF-1.7\ncontrolled repository fixture\n%%EOF');await fs.writeFile(path.join(job,'rendered.pdf'),pdf);return{sha256:sha(pdf),bytes:pdf.length,pages:2};};
 return{db,host,repo,query,render,state,resources,id,version,bytes,root:()=>root,
  restart:()=>new MaterialWordPagesRepository(host),
  relocate:async()=>{const old=root,next=root+'-moved';await fs.rename(old,next);root=next;for(const r of resources.values())r.localPath=path.join(next,path.relative(old,r.localPath));},
  dispose:async()=>{db.close();await fs.rm(root,{recursive:true,force:true});}};
}
await check('Query admits only a registered source identity and exact version',()=>{
 const q={schemaVersion:WORD_PAGES_SCHEMA,resourceId:'resource_'+randomUUID(),version:'a'.repeat(64)};
 assert(validWordPagesQuery(q));for(const bad of [{...q,path:'C:/other.docx'},{...q,version:'bad'},{...q,resourceId:'../outside'},{...q,schemaVersion:'future'}])assert(!validWordPagesQuery(bad));
});
await check('A complete snapshot is source-linked, idempotent and does not alter its original',async()=>{
 const f=await fixture();try{
  const before=JSON.stringify(f.resources.get(f.id));
  assert.equal((await f.repo.view(f.query)).status,'idle');
  const view=await f.repo.prepare(f.query,f.render,new AbortController().signal);
  assert.equal(view.status,'complete');assert.equal(view.pages,2);assert.equal(view.original.id,f.id);
  assert.equal(JSON.stringify(f.resources.get(f.id)),before);
  const again=await f.repo.prepare(f.query,f.render,new AbortController().signal);assert.equal(again.pdf.id,view.pdf.id);
  assert.equal(f.state.renders,1);assert.equal(f.state.publishes,1);
  const origin=await f.repo.view({...f.query,resourceId:view.pdf.id,version:view.pdf.contentHash});assert.equal(origin.role,'pages');assert.equal(origin.original.id,f.id);
 }finally{await f.dispose();}
});
for(const kind of ['publish','ack'])await check('Interrupted '+kind+' resumes the exact registered output without another conversion',async()=>{
 const f=await fixture();try{
  if(kind==='publish')f.state.failPublish=true;else f.state.failAck=true;
  await assert.rejects(()=>f.repo.prepare(f.query,f.render,new AbortController().signal));
  assert.equal((await f.repo.view(f.query)).status,'failed');
  const pdf=[...f.resources.values()].find(r=>r.resourceType==='pdf');assert(pdf);
  assert.equal((await f.repo.view({...f.query,resourceId:pdf.id,version:pdf.contentHash})).original.id,f.id);
  const view=await f.restart().prepare(f.query,f.render,new AbortController().signal);
  assert.equal(view.pdf.id,pdf.id);assert.equal(f.state.renders,1);assert.equal(f.state.publishes,1);
 }finally{await f.dispose();}
});
await check('Concurrent requests cannot produce a second active conversion',async()=>{
 const f=await fixture();let release,entered;
 const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 try{
  const first=f.repo.prepare(f.query,async(...args)=>{entered();await gate;return f.render(...args);},new AbortController().signal);
  await started;await assert.rejects(()=>f.repo.prepare(f.query,f.render,new AbortController().signal),/busy/);
  release();await first;assert.equal(f.state.renders,1);assert.equal(f.state.publishes,1);
 }finally{release?.();await f.dispose();}
});
await check('Cancellation is persisted and can be retried through the same source',async()=>{
 const f=await fixture(),controller=new AbortController();try{
  await assert.rejects(()=>f.repo.prepare(f.query,async()=>{controller.abort();controller.signal.throwIfAborted();},controller.signal),/cancelled/);
  assert.equal((await f.repo.view(f.query)).status,'cancelled');
  assert.equal((await f.repo.prepare(f.query,f.render,new AbortController().signal)).status,'complete');
 }finally{await f.dispose();}
});
await check('An orphaned local owner is interrupted while a live foreign owner stays protected',async()=>{
 const f=await fixture(),controller=new AbortController();try{
  await assert.rejects(()=>f.repo.prepare(f.query,async()=>{controller.abort();controller.signal.throwIfAborted();},controller.signal),/cancelled/);
  f.db.prepare("UPDATE material_word_page_sources SET status='running',owner_pid=?,owner_nonce='orphan'").run(process.pid);
  assert.equal((await f.repo.view(f.query)).status,'interrupted');
  f.db.prepare('UPDATE material_word_page_sources SET owner_pid=?').run(process.ppid);
  assert.equal((await f.repo.view(f.query)).status,'running');
  await assert.rejects(()=>f.repo.prepare(f.query,f.render,new AbortController().signal),/busy/);
  f.db.prepare('UPDATE material_word_page_sources SET owner_pid=?').run(process.pid);
  assert.equal((await f.repo.prepare(f.query,f.render,new AbortController().signal)).status,'complete');
 }finally{await f.dispose();}
});
await check('A redirected conversion cache is rejected before launching the renderer',async()=>{
 const f=await fixture();try{
  const cache=path.join(f.root(),'cache'),redirect=path.join(f.root(),'redirected');
  await fs.mkdir(cache);await fs.mkdir(redirect);
  await fs.symlink(redirect,path.join(cache,'word-pages'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>f.repo.prepare(f.query,f.render,new AbortController().signal),/source_changed/);
  assert.equal(f.state.renders,0);assert.equal(f.state.publishes,0);
  await fs.unlink(path.join(cache,'word-pages'));
 }finally{await f.dispose();}
});
await check('A changed original cannot publish the rendered snapshot',async()=>{
 const f=await fixture();try{
  await assert.rejects(()=>f.repo.prepare(f.query,async(...args)=>{const result=await f.render(...args);await fs.appendFile(f.resources.get(f.id).localPath,'changed');return result;},new AbortController().signal),/source_changed/);
  assert.equal(f.state.publishes,0);assert.equal((await f.repo.view(f.query)).status,'failed');
 }finally{await f.dispose();}
});
await check('A corrupt published PDF creates a new snapshot and retains the earlier lineage',async()=>{
 const f=await fixture();try{
  const before=await f.repo.prepare(f.query,f.render,new AbortController().signal);
  await fs.writeFile(before.pdf.localPath,'corrupted');
  const after=await f.repo.prepare(f.query,f.render,new AbortController().signal);
  assert.notEqual(after.pdf.id,before.pdf.id);assert.equal(f.state.renders,2);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_page_sources').get().n,2);
  assert.equal((await f.repo.view({...f.query,resourceId:before.pdf.id,version:before.pdf.contentHash})).original.id,f.id);
 }finally{await f.dispose();}
});
await check('A snapshot can still identify a removed parent and survives data-root relocation',async()=>{
 const f=await fixture();try{
  const first=await f.repo.prepare(f.query,f.render,new AbortController().signal);
  await f.relocate();const next=await f.repo.prepare(f.query,f.render,new AbortController().signal);assert.equal(next.pdf.id,first.pdf.id);assert.equal(f.state.renders,1);
  f.resources.delete(f.id);const view=await f.repo.view({...f.query,resourceId:first.pdf.id,version:first.pdf.contentHash});assert.equal(view.original.id,f.id);assert.equal(view.originalAvailable,false);
 }finally{await f.dispose();}
});
async function usePhysicalSourceStamp(f){
 const file=f.resources.get(f.id).localPath;
 await fs.utimes(file,1700000000,1700000000);
 f.host.stamp=async(id,version)=>{
  const resource=await f.host.resource(id);
  if(resource.contentHash!==version)throw Error('source_changed');
  const stat=await fs.lstat(resource.localPath,{bigint:true});
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1n)throw Error('missing');
  return [stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].map(String).join(':');
 };
 return file;
}
async function changeMetadataOnly(file){
 await fs.chmod(file,0o400);
 await fs.chmod(file,0o600);
}
await check('An isolated ctime change verifies the locked bytes and completes the same source snapshot',async()=>{
 const f=await fixture();try{
  const file=await usePhysicalSourceStamp(f),before=await f.host.stamp(f.id,f.version),verify=f.host.verify;let originalChecks=0;
  f.host.verify=async(...args)=>{if(args[0]===f.id)originalChecks++;await verify(...args);};
  const view=await f.repo.prepare(f.query,async(...args)=>{
   const result=await f.render(...args);await changeMetadataOnly(file);
   const after=await f.host.stamp(f.id,f.version);
   assert.deepEqual(after.split(':').slice(0,4),before.split(':').slice(0,4));assert.notEqual(after,before);
   return result;
  },new AbortController().signal);
  assert.equal(view.status,'complete');assert.equal(view.original.version,f.version);assert(originalChecks>=3);assert.equal(f.state.publishes,1);
 }finally{await f.dispose();}
});
await check('Restored size and mtime cannot admit changed source bytes after a ctime change',async()=>{
 const f=await fixture();try{
  const file=await usePhysicalSourceStamp(f);
  await assert.rejects(()=>f.repo.prepare(f.query,async(...args)=>{
   const result=await f.render(...args),changed=Buffer.from(f.bytes);changed[changed.length-1]^=1;
   await fs.writeFile(file,changed);await fs.utimes(file,1700000000,1700000000);return result;
  },new AbortController().signal),/source_changed/);
  assert.equal(f.state.publishes,0);assert.equal((await f.repo.view(f.query)).status,'failed');
 }finally{await f.dispose();}
});
for(const mutation of ['mtime','identity','path'])await check('A source '+mutation+' change is rejected before ctime recovery',async()=>{
 const f=await fixture();try{
  const file=await usePhysicalSourceStamp(f),verify=f.host.verify;let originalChecks=0;
  f.host.verify=async(...args)=>{if(args[0]===f.id)originalChecks++;await verify(...args);};
  await assert.rejects(()=>f.repo.prepare(f.query,async(...args)=>{
   const result=await f.render(...args);
   if(mutation==='mtime')await fs.utimes(file,1700000000,1700000002);
   if(mutation==='identity'){
    const replacement=file+'.replacement';await fs.writeFile(replacement,f.bytes);await fs.utimes(replacement,1700000000,1700000000);await fs.rename(replacement,file);
   }
   if(mutation==='path'){
    const moved=file+'.moved';await fs.rename(file,moved);f.resources.get(f.id).localPath=moved;
   }
   return result;
  },new AbortController().signal),/source_changed/);
  assert.equal(originalChecks,0);assert.equal(f.state.publishes,0);
 }finally{await f.dispose();}
});
await check('A second stamp change during SHA verification cannot refresh the source anchor',async()=>{
 const f=await fixture();try{
  const file=await usePhysicalSourceStamp(f),verify=f.host.verify;let checks=0;
  f.host.verify=async(...args)=>{await verify(...args);if(args[0]===f.id){checks++;await changeMetadataOnly(file);}};
  await assert.rejects(()=>f.repo.prepare(f.query,async(...args)=>{const result=await f.render(...args);await changeMetadataOnly(file);return result;},new AbortController().signal),/source_changed/);
  assert.equal(checks,1);assert.equal(f.state.publishes,0);
 }finally{await f.dispose();}
});
await check('SHA recovery cannot replace a changed conversion owner',async()=>{
 const f=await fixture();try{
  const file=await usePhysicalSourceStamp(f),verify=f.host.verify;
  f.host.verify=async(...args)=>{await verify(...args);if(args[0]===f.id)f.db.prepare("UPDATE material_word_page_sources SET owner_nonce='foreign'").run();};
  await assert.rejects(()=>f.repo.prepare(f.query,async(...args)=>{const result=await f.render(...args);await changeMetadataOnly(file);return result;},new AbortController().signal),/source_changed/);
  assert.equal(f.state.publishes,0);const row=f.db.prepare('SELECT status,owner_nonce FROM material_word_page_sources').get();assert.equal(row.owner_nonce,'foreign');assert.equal(row.status,'running');
 }finally{await f.dispose();}
});
console.log(JSON.stringify({passed:results.length,results,scope:'Actual SQLite, files and original resource lifecycle with controlled render/import callbacks. Real LibreOffice/PDF OCR and UI are separate checks; zero model calls.'}));
