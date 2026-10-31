import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {registerHooks} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({
 resolve(s,c,next){return s==='electron'?{url:'data:text/javascript,export const app={};export const utilityProcess={};',shortCircuit:true}:next(s,c);},
 load(url,c,next){return url.endsWith('/ocr-runtime-manifest.json')?{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true}:next(url,c);}
});
const {materialPageToolBoundaries,materialLayoutBoundaries}=await import('./material-layout-boundaries.mjs');
const {originalQuestionBoundaries}=await import('./original-question-boundaries.mjs');
const {MaterialRepository}=await import('../../src/main/assets/material-repository.ts');
const {createMaterialPageTools}=await import('../../src/main/assets/material-page-tools.ts');
const {validMaterialPageTextInput}=await import('../../src/shared/material-page-text.ts');
const {PDF_LAYOUT_SCHEMA,PDF_LAYOUT_ENGINE}=await import('../../src/shared/material-layout.ts');
const {validOriginalRegion}=await import('../../src/shared/original-question-review.ts');
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-k0-boundary-')),checks=[];
const check=async(name,work)=>{await work();checks.push(name);};
const report={scope:'Source/SQLite boundary tests with injected renderers, not real PDF engine or product acceptance',output,checks};
let db;
try{
 await materialPageToolBoundaries(check,output);
 await materialLayoutBoundaries(check,output);
 await originalQuestionBoundaries(check,output);
 const root=path.join(output,'originals');fs.mkdirSync(root);const source=path.join(root,'book.pdf');fs.writeFileSync(source,'%PDF boundary fixture');fs.truncateSync(source,51*1048576);
 const hash=createHash('sha256');for await(const b of fs.createReadStream(source))hash.update(b);const version=hash.digest('hex'),id='resource_'+randomUUID();
 db=new DatabaseSync(path.join(output,'metadata.db'));
 db.exec('CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,parse_status TEXT);CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,chunk_index INTEGER,content_md TEXT,page_number INTEGER,contains_personal_data INTEGER);CREATE INDEX resource_chunk_idx ON resource_chunks(resource_id,chunk_index)');
 db.prepare('INSERT INTO teacher_resources VALUES (?,?,?)').run(id,version,'ready');
 db.exec('BEGIN');const insert=db.prepare('INSERT INTO resource_chunks VALUES (?,?,?,?,?,0)');for(let i=0;i<10001;i++)insert.run(String(i),id,i,'unread-body-'.repeat(400),i%62+1);db.exec('COMMIT');
 const repo=new MaterialRepository({root,all:async(sql,params=[])=>db.prepare(sql).all(...params),mapResource:r=>({id,contentHash:r.content_hash,originalFileName:'book.pdf',localPath:source}),mapChunk:()=>{throw Error('Body materialization forbidden');}});
 repo.original=async()=>{throw Error('Whole-book byte access forbidden');};repo.readingSnapshot=async()=>{throw Error('Whole-book snapshot forbidden');};
 await check('Metadata-only page authority works above 10000 text chunks and isolates known/unknown-page privacy',async()=>{
  assert.deepEqual(await repo.pageReadAccess(id,62),{version,eligible:true,privatePage:false});
  db.prepare('UPDATE teacher_resources SET parse_status=? WHERE id=?').run('partial',id);assert.equal((await repo.pageReadAccess(id,62)).eligible,true);assert.equal((await repo.pageReadAccess(id,63)).eligible,false);db.prepare('UPDATE teacher_resources SET parse_status=? WHERE id=?').run('ready',id);
  db.prepare('UPDATE resource_chunks SET contains_personal_data=1 WHERE id=?').run('0');assert.equal((await repo.pageReadAccess(id,1)).privatePage,true);assert.equal((await repo.pageReadAccess(id,62)).privatePage,false);
  db.prepare('UPDATE resource_chunks SET page_number=NULL WHERE id=?').run('0');assert.equal((await repo.pageReadAccess(id,62)).privatePage,true);
  db.prepare('UPDATE resource_chunks SET contains_personal_data=0 WHERE id=?').run('0');
 });
 const input={resourceId:id,page:62},region={...input,version,box:[0,0,1,1]};
 await check('Page 51/62 and shared 10000-page bound are accepted without broadening image/region limits',async()=>{
  for(const page of [1,51,62,10000]){assert(validMaterialPageTextInput({...input,page}));assert(validOriginalRegion({...region,page}));}
  for(const page of [0,10001,NaN,Infinity,1.1]){assert(!validMaterialPageTextInput({...input,page}));assert(!validOriginalRegion({...region,page}));}
 });
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZkAAAAASUVORK5CYII=',quad=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
 let action=()=>{},reads=0;
 const layout=async(resource,page,signal)=>{reads++;signal.throwIfAborted();action();return {schemaVersion:PDF_LAYOUT_SCHEMA,ok:true,engine:PDF_LAYOUT_ENGINE,inputSha256:version,page,total:62,width:1,height:1,png,rasterSha256:createHash('sha256').update(Buffer.from(png,'base64')).digest('hex'),lines:[{id:'line-1',kind:'text',needsReview:true,text:'TAIL PAGE 62',score:1,quad,normalizedQuad:quad}]};};
 const store={materials:repo,getDataRoot:()=>output,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text})};
 const tool=createMaterialPageTools(store,()=>true,new Map([[id,version]]),async()=>{throw Error('Byte OCR forbidden');},undefined,{layout,render:async()=>{throw Error('Unexpected preview');}})[0];
 const run=async(signal=new AbortController().signal)=>JSON.parse((await tool.execute('owned',{...input,refresh:true},signal)).content[0].text);
 await check('Pi file path returns page 62 with 51 MiB original and 10001 chunks without original()/readingSnapshot()',async()=>{const r=await run();assert(r.success);assert.equal(r.totalPages,62);assert.equal(r.lines[0].text,'TAIL PAGE 62');assert.equal(reads,1);});
 await check('Privacy changes during OCR block the late result; unrelated text is never returned',async()=>{action=()=>db.prepare('UPDATE resource_chunks SET contains_personal_data=1,page_number=62 WHERE id=?').run('0');assert.equal((await run()).code,'permission_denied');action=()=>{};db.prepare('UPDATE resource_chunks SET contains_personal_data=0 WHERE id=?').run('0');});
 await check('Source change, stopped operation and file-host busy do not fall back to byte processing',async()=>{
  action=()=>db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),id);assert.equal((await run()).code,'source_changed');db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run(version,id);
  const ctl=new AbortController();action=()=>ctl.abort();assert.equal((await run(ctl.signal)).code,'cancelled');action=()=>{throw Error('busy');};assert.equal((await run()).code,'busy');action=()=>{};
 });
 report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{db?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.join(output,'report.json')}));}
