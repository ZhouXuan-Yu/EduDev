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
console.log(JSON.stringify({passed:results.length,results,scope:'Actual SQLite, files and original resource lifecycle with controlled render/import callbacks. Real LibreOffice/PDF OCR and UI are separate checks; zero model calls.'}));
