import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {wordFixture} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {MaterialWordRepository}=await import('../../src/main/assets/material-word-repository.ts');
const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
const {WORD_PARSER,WORD_LEGACY_PARSER}=await import('../../src/shared/material-word.ts');
const {wordUpgradeCompatible}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const payload=await parseWord(await wordFixture());
function legacyDocument(){
 const document=structuredClone(payload.document);document.parser=WORD_LEGACY_PARSER;delete document.unscopedWarnings;
 function strip(blocks){for(const block of blocks){delete block.warnings;if(block.kind==='table')for(const row of block.rows)for(const cell of row.cells)strip(cell.blocks);}}
 strip(document.blocks);return document;
}
const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
async function fixture(){
 const root=await fs.mkdtemp(path.join(tmpdir(),'omni-word-upgrade-')),db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,content_md TEXT,contains_personal_data INTEGER);INSERT INTO resource_chunks VALUES('chunk-one','kept-resource','教师保存正文',1)");
 const state={version:'a'.repeat(64),parses:0,beforeParse:undefined,beforeCommit:undefined};let word;
 const id='resource_'+randomUUID(),resource=()=>({id,contentHash:state.version,parseStatus:'ready'});
 const host={root:()=>root,all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{db.prepare(q).run(...p);},resource:async()=>resource(),
  verify:async(_id,version,signal)=>{signal.throwIfAborted();if(version!==state.version)throw Error('source_changed');},stamp:async()=> 'original-stamp',
  parse:async(_id,_version,signal)=>{state.parses++;await state.beforeParse?.(signal);signal.throwIfAborted();return structuredClone(payload);},
  writer:async(action,beforeCommit)=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(word);await state.beforeCommit?.();beforeCommit?.();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}};
 word=new MaterialWordRepository(host);await word.migrate();const legacy=legacyDocument();await word.prepare({...payload,document:legacy},new AbortController().signal);await word.commit(id,state.version,legacy);
 return {root,db,state,id,host,legacy,get word(){return word;},query:{schemaVersion:'xiaozhi.word-question-source.v1',resourceId:id,version:state.version,offset:0,ordinal:1},reopen(){word=new MaterialWordRepository(host);return word;},close(){db.close();}};
}
await check('Unattended compatibility preserves all native content and exact question/answer ranges',async()=>{
 assert(wordUpgradeCompatible(legacyDocument(),payload.document));
 const changed=structuredClone(payload.document);changed.blocks[0].inlines[0].text+='新条件';assert(!wordUpgradeCompatible(legacyDocument(),changed));
 const asset=structuredClone(payload.document);asset.assets[0].sha256='f'.repeat(64);assert(!wordUpgradeCompatible(legacyDocument(),asset));
});
await check('Oversized questions keep their original unavailable disposition without blocking warning-only document upgrades',async()=>{
 const next=structuredClone(payload.document);next.assets=[];next.blocks=[{kind:'paragraph',id:'wb_'+'1'.repeat(32),anchor:{part:'word/document.xml',path:'/document/body/p[1]'},inlines:[{kind:'text',text:'第1题 '+ '内容'.repeat(30000)}],warnings:[]}];next.warnings=[];next.unscopedWarnings=[];
 const old=structuredClone(next);old.parser=WORD_LEGACY_PARSER;delete old.unscopedWarnings;delete old.blocks[0].warnings;
 const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
 assert(wordUpgradeCompatible(old,next));assert.equal(indexWordQuestions(old).total,indexWordQuestions(next).total);
 assert.throws(()=>indexWordQuestions(old).read(1),/too_large/);assert.throws(()=>indexWordQuestions(next).read(1),/too_large/);
});
await check('SQLite upgrade retains legacy sources, image bytes and body/privacy facts while new reads select v2',async()=>{
 const f=await fixture();try{
  const before=f.db.prepare('SELECT * FROM resource_chunks').all(),oldSource=(await f.word.questions(f.query)).source;
  const asset=f.legacy.assets[0],imageQuery={schemaVersion:'xiaozhi.word-source.v1',resourceId:f.id,version:f.state.version,assetId:asset.id};
  const image=await f.word.image(imageQuery),oldSha=hash(f.legacy);
  assert.equal(await f.word.upgrade(f.id,f.state.version,new AbortController().signal),true);
  assert.equal((await f.word.document(f.id,f.state.version)).parser,WORD_PARSER);
  assert.deepEqual((await f.word.questions(f.query,oldSha)).source,oldSource);
  assert.equal((await f.word.image(imageQuery,oldSha)).dataUrl,image.dataUrl);
  assert.deepEqual(f.db.prepare('SELECT * FROM resource_chunks').all(),before);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_document_versions').get().n,1);
  assert.equal(await f.word.upgrade(f.id,f.state.version,new AbortController().signal),false);assert.equal(f.state.parses,1);
  await f.reopen().migrate();assert.deepEqual((await f.word.questions(f.query,oldSha)).source,oldSource);
 }finally{f.close();}
});
await check('Unknown and corrupted historical digests cannot fall through to the latest representation',async()=>{
 const f=await fixture();try{
  const oldSha=hash(f.legacy);await f.word.upgrade(f.id,f.state.version,new AbortController().signal);
  assert.equal(await f.word.questions(f.query,'f'.repeat(64)),undefined);
  const ai=Object.create(MaterialAiRepository.prototype);
  ai.nativeHost=()=>({word:()=>f.word});
  const question={archive:{native:{source:{resourceId:f.id,resourceVersion:f.state.version,documentSha:'f'.repeat(64),ordinal:1}}}};
  await assert.rejects(ai.validateSource(question,new AbortController().signal,false),/source_changed/);
  f.db.prepare('UPDATE material_word_document_versions SET document_json=?').run('{}');
  await assert.rejects(f.word.questions(f.query,oldSha),/source_changed/);
  assert.equal((await f.word.document(f.id,f.state.version)).parser,WORD_PARSER);
 }finally{f.close();}
});
await check('Cancellation at commit rolls back the latest representation and history together',async()=>{
 const f=await fixture();try{
  const controller=new AbortController();f.state.beforeCommit=()=>controller.abort();
  await assert.rejects(f.word.upgrade(f.id,f.state.version,controller.signal),/abort/i);
  assert.deepEqual(await f.word.document(f.id,f.state.version),f.legacy);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_document_versions').get().n,0);
  f.state.beforeCommit=undefined;assert(await f.word.upgrade(f.id,f.state.version,new AbortController().signal));
 }finally{f.close();}
});
await check('Original changes during parse refuse publication and keep the previous snapshot',async()=>{
 const f=await fixture();try{
  f.state.beforeParse=()=>{f.state.version='b'.repeat(64);};
  await assert.rejects(f.word.upgrade(f.id,'a'.repeat(64),new AbortController().signal),/source_changed/);
  assert.equal(f.db.prepare('SELECT parser FROM material_word_documents').get().parser,WORD_LEGACY_PARSER);
 }finally{f.close();}
});
await check('A concurrent representation commit is retained instead of being overwritten by an earlier parse',async()=>{
 const f=await fixture();try{
  const concurrent=legacyDocument();concurrent.warnings.push('concurrent-marker');
  f.state.beforeParse=()=>f.word.commit(f.id,f.state.version,concurrent);
  await assert.rejects(f.word.upgrade(f.id,f.state.version,new AbortController().signal),/source_changed/);
  assert.deepEqual(await f.word.document(f.id,f.state.version),concurrent);
 }finally{f.close();}
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual SQLite/OOXML parser/content-addressed image files and production repository. Worker/UI/provider delivery are separate evidence.'}));
