/** Native SQLite/files + actual source readers. No Electron, provider, migrations or business writes.
 * Only owned fixture copies are changed for negative tests. The old fixture stays byte-identical.
 * DB mappers are extracted verbatim with the TS AST; compilation stays in memory.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {fingerprint} from '../acceptance/evidence.mjs';

const desktop=fileURLToPath(new URL('../..',import.meta.url));
const original='D:/WorkProject/EduProject/apps/desktop/test-results/education-journey-YlBdIe';
const multiOriginal='D:/WorkProject/EduProject/apps/desktop/test-results/education-journey-0T0vdK';
const output=fs.mkdtempSync(path.join(desktop,'test-results/original-image-legacy-receipt-'));
const data=path.join(output,'data'),originalBefore=fingerprint(original).sha256;
const report={success:false,output,checks:[],electronLaunches:0,modelCalls:0,businessWrites:0,
 originalBefore,seams:['Owned copy transport path only; no receipt/version rebinding',
  'Native read-only SQLite adapter and verbatim formal DB mappers',
  'Post-read barriers delegate to actual QuestionAssets before owned-file/row mutations']};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=async(name,work)=>{
 try{await work();report.checks.push({name,status:'PASS'});}
 catch(e){report.checks.push({name,status:'FAIL',stack:String(e.stack)});}
 console.log(report.checks.at(-1).status+' '+name);persist();
};
const deny=()=>{report.businessWrites++;throw Error('Business writes forbidden');};
globalThis.fetch=async()=>{throw Error('Network forbidden');};
let db,reader;
try{
 const source=fs.readFileSync(path.join(desktop,'src/main/db.ts'),'utf8');
 const ast=ts.createSourceFile('db.ts',source,ts.ScriptTarget.Latest,true),parts=new Map();
 const wanted=['mapQuestionBankItem','mapTeacherResource','jsonArray'];
 function visit(node){
  if((ts.isMethodDeclaration(node)||ts.isFunctionDeclaration(node))&&
   wanted.includes(node.name?.getText(ast))){
   parts.set(node.name.getText(ast),node.getText(ast).replace(/^private /,'function '));
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);assert.equal(parts.size,wanted.length);
 const entry=`import {readQuestionDocument} from '../shared/question-document';
 import {readQuestionArchive} from '../shared/question-archive';
 export {isCompleteQuestionDocument} from '../shared/question-document';
 export {questionVersion} from './education/question-context-provider';
 export {OriginalQuestionRepository} from './education/original-question-repository';
 export {MaterialRepository} from './assets/material-repository';
 export {QuestionAssets} from './assets/question-assets';
 export {legacyOriginalImageReceipt} from './education/original-image-legacy-receipt';
 ${[...parts.values()].join('\n')}
 export {mapQuestionBankItem,mapTeacherResource};`;
 const compiled=await build({stdin:{contents:entry,loader:'ts',resolveDir:path.join(desktop,'src/main')},
  bundle:true,platform:'node',format:'cjs',packages:'external',write:false});
 const loaded=new Module(path.join(desktop,'__original_image_focused__.cjs'));
 loaded.filename=path.join(desktop,'__original_image_focused__.cjs');
 loaded.paths=Module._nodeModulePaths(desktop);
 loaded._compile(compiled.outputFiles[0].text,loaded.filename);
 const m=loaded.exports;

 fs.cpSync(path.join(original,'data'),data,{recursive:true});
 db=new DatabaseSync(path.join(data,'app.db'));
 for(const row of db.prepare('SELECT id,local_path,content_hash FROM teacher_resources').all()){
  const relative=path.relative(path.join(original,'data'),row.local_path);
  assert(!relative.startsWith('..')&&!path.isAbsolute(relative));
  const owned=path.join(data,relative);
  assert.equal(sha(fs.readFileSync(owned)),row.content_hash);
  db.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?').run(owned,row.id);
 }
 reader=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 const all=async(sql,args=[])=>reader.prepare(sql).all(...args);
 const read=async id=>{const row=reader.prepare('SELECT * FROM question_bank_items WHERE id=?').get(id);
  return row?m.mapQuestionBankItem(row):undefined;};
 const materials=new m.MaterialRepository({root:path.join(data,'teacher_resources'),all,
  mapResource:m.mapTeacherResource,mapChunk:deny,change:deny,commit:deny,reuse:deny,failure:deny});
 const assets=new m.QuestionAssets(()=>data);
 const repo=new m.OriginalQuestionRepository({all,read,run:deny,create:deny,transaction:deny},
  ()=>materials,assets,deny);
 const questionId='question_78d96406-9590-4678-99f7-64c829651a1a';
 const q=await read(questionId),version=m.questionVersion(q);
 const row=reader.prepare("SELECT * FROM ai_confirmation_items WHERE status='confirmed' AND "+
  "json_extract(result_json,'$.saved.questionId')=?").get(questionId);
 const proposal=JSON.parse(row.payload_json),effect=JSON.parse(row.result_json);
 const sourceFile=reader.prepare('SELECT local_path FROM teacher_resources WHERE id=?')
  .get(proposal.image.resourceId).local_path;
 const assetFile=path.join(data,'question-assets/v1',proposal.image.assetId+'.png');
 const sourceBytes=fs.readFileSync(sourceFile),assetBytes=fs.readFileSync(assetFile);
 const tables=['question_bank_items','ai_confirmation_items','ai_agent_runs',
  'ai_conversation_sessions','ai_conversation_messages','teacher_resources','resource_chunks'];
 const baseline=()=>sha(JSON.stringify(tables.map(t=>reader.prepare(`SELECT * FROM ${t} ORDER BY id`).all())));
 const baselineHash=baseline();
 const expectReject=async(code,work=()=>repo.questionImage(questionId,version))=>
  assert.rejects(work,e=>e.message===code);
 const receipt=async(change,work)=>{
  const next=structuredClone(effect);change(next);
  db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(JSON.stringify(next),row.id);
  try{await work();}finally{
   db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(row.result_json,row.id);
  }
 };
 const rowChange=async(table,column,value,id,work)=>{
  assert(tables.includes(table));assert(/^[a-z_]+$/.test(column));
  const old=db.prepare(`SELECT ${column} AS v FROM ${table} WHERE id=?`).get(id).v;
  db.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`).run(value,id);
  try{await work();}finally{db.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`).run(old,id);}
 };
 const redigest=e=>{e.digest=sha(JSON.stringify({id:row.id,sessionId:row.session_id,
  runId:row.run_id,proposal,draft:e.draft,saved:e.saved}));};

 await check('Real old receipt returns exact immutable PNG, without upgrading facts',async()=>{
  assert.deepEqual(Object.keys(effect).sort(),['digest','draft','saved']);
  assert.equal(version,effect.saved.version);
  assert.equal(await repo.questionImage(questionId,version),'data:image/png;base64,'+assetBytes.toString('base64'));
  assert.equal((await read(questionId)).answer,'');
  assert.equal((await read(questionId)).document.answer.origin,'missing');
  assert.equal(m.isCompleteQuestionDocument((await read(questionId)).document),false);
  assert.equal(baseline(),baselineHash);assert.equal(report.businessWrites,0);
 });
 await check('Global effect validator remains strict for the very same old receipt',async()=>{
  assert.throws(()=>repo.effect(row,proposal),/unavailable/);
 });
 await check('Pending, rejected, foreign action and duplicate confirmation are refused',async()=>{
  for(const status of ['pending','rejected'])await rowChange('ai_confirmation_items','status',status,row.id,
   ()=>expectReject('permission_denied'));
  await rowChange('ai_confirmation_items','action_type','foreign',row.id,()=>expectReject('permission_denied'));
  const columns=Object.keys(row),duplicate={...row,id:'xioriginal_00000000-0000-0000-0000-000000000000'};
  db.prepare(`INSERT INTO ai_confirmation_items (${columns.join()}) VALUES (${columns.map(()=>'?').join()})`)
   .run(...columns.map(k=>duplicate[k]));
  try{await expectReject('permission_denied');}
  finally{db.prepare('DELETE FROM ai_confirmation_items WHERE id=?').run(duplicate.id);}
 });
 await check('Every missing legacy field and every extra field is refused',async()=>{
  for(const field of ['draft','saved','digest'])await receipt(e=>{delete e[field];},
   ()=>expectReject(field==='saved'?'permission_denied':'unavailable'));
  await receipt(e=>{e.contextRevisions=[];},()=>expectReject('unavailable'));
  await receipt(e=>{e.complete=true;},()=>expectReject('unavailable'));
 });
 await check('Digest tampering is refused',async()=>{
  await receipt(e=>{e.digest='0'.repeat(64);},()=>expectReject('unavailable'));
 });
 await check('Saved question ID/version mismatch is refused even with a matching digest',async()=>{
  await receipt(e=>{e.saved.version='0'.repeat(64);redigest(e);},()=>expectReject('source_changed'));
  // Direct helper covers an identity mismatch before the SQL lookup's exact saved.questionId filter.
  const e=structuredClone(effect);e.saved.questionId='question_00000000-0000-0000-0000-000000000000';redigest(e);
  assert.throws(()=>m.legacyOriginalImageReceipt({...row,result_json:JSON.stringify(e)},proposal,q,version),
   /source_changed/);
 });
 await check('Question fact changes and wrong caller version are refused',async()=>{
  await rowChange('question_bank_items','stem',q.stem+' changed',questionId,()=>expectReject('source_changed'));
  await expectReject('source_changed',()=>repo.questionImage(questionId,'0'.repeat(64)));
 });
 await check('Payload student binding mismatch is refused',async()=>{
  await rowChange('ai_confirmation_items','student_id','foreign-student',row.id,()=>expectReject('unavailable'));
 });
 await check('Source document/asset bindings cannot be rebound with a valid new saved hash',async()=>{
  for(const mutate of [d=>{d.source.resourceVersion='0'.repeat(64);},
   d=>{d.source.resourceId='resource_00000000-0000-0000-0000-000000000000';},
   d=>{d.blocks[0].assetId='asset_00000000-0000-0000-0000-000000000000';},
   d=>{d.blocks[0].anchors[0].page=1;}]){
   const changed=structuredClone(q);mutate(changed.document);
   const e=structuredClone(effect);e.saved.version=m.questionVersion(changed);redigest(e);
   assert.throws(()=>m.legacyOriginalImageReceipt({...row,result_json:JSON.stringify(e)},proposal,
    changed,e.saved.version),/source_changed/);
  }
 });
 await check('Real source-byte changes are refused by the formal material reader',async()=>{
  const changed=Buffer.from(sourceBytes);changed[changed.length-1]^=1;fs.writeFileSync(sourceFile,changed);
  try{await expectReject('source_changed');}finally{fs.writeFileSync(sourceFile,sourceBytes);}
 });
 await check('SQL source hash changes are refused',async()=>{
  await rowChange('teacher_resources','content_hash','0'.repeat(64),proposal.image.resourceId,
   ()=>expectReject('source_changed'));
 });
 await check('PNG corruption and missing PNG are refused by actual QuestionAssets',async()=>{
  const changed=Buffer.from(assetBytes);changed[changed.length-1]^=1;fs.writeFileSync(assetFile,changed);
  try{await expectReject('unavailable');}finally{fs.writeFileSync(assetFile,assetBytes);}
  const held=assetFile+'.held';fs.renameSync(assetFile,held);
  try{await expectReject('unavailable');}finally{fs.renameSync(held,assetFile);}
 });
 await check('Source changes after the actual PNG read are caught before return',async()=>{
  const actual=assets.read.bind(assets);assets.read=async(...args)=>{
   const bytes=await actual(...args);const changed=Buffer.from(sourceBytes);
   changed[changed.length-1]^=1;fs.writeFileSync(sourceFile,changed);return bytes;
  };
  try{await expectReject('source_changed');}
  finally{assets.read=actual;fs.writeFileSync(sourceFile,sourceBytes);}
 });
 await check('Question or receipt changes during actual PNG read cannot return stale bytes',async()=>{
  const actual=assets.read.bind(assets);
  for(const target of ['question','receipt']){
   assets.read=async(...args)=>{const bytes=await actual(...args);
    if(target==='question')db.prepare('UPDATE question_bank_items SET stem=? WHERE id=?')
     .run(q.stem+' changed',questionId);
    else db.prepare("UPDATE ai_confirmation_items SET status='rejected' WHERE id=?").run(row.id);
    return bytes;
   };
   try{await expectReject('source_changed');}
   finally{assets.read=actual;
    db.prepare('UPDATE question_bank_items SET stem=? WHERE id=?').run(q.stem,questionId);
    db.prepare('UPDATE ai_confirmation_items SET status=? WHERE id=?').run(row.status,row.id);
   }
  }
 });
 await check('Modern strict branch still accepts its receipt and rejects incomplete markers/digest',async()=>{
  await receipt(e=>{e.schemaVersion='xiaozhi.education.original-review.v1';e.complete=true;},async()=>{
   assert.equal(await repo.questionImage(questionId,version),'data:image/png;base64,'+assetBytes.toString('base64'));
  });
  await receipt(e=>{e.schemaVersion='xiaozhi.education.original-review.v1';e.complete=false;},
   ()=>expectReject('unavailable'));
  await receipt(e=>{e.schemaVersion='foreign';e.complete=true;},()=>expectReject('unavailable'));
  await receipt(e=>{e.schemaVersion='xiaozhi.education.original-review.v1';e.complete=true;
   e.digest='0'.repeat(64);},()=>expectReject('unavailable'));
 });
 await check('Legacy receipt cannot confer complete document or context authority',async()=>{
  await expectReject('document_context_unavailable',()=>repo.context(questionId,version));
 });
 await check('Native multi fixture already has modern receipts; no legacy relaxation required',async()=>{
  const before=fingerprint(multiOriginal).sha256;
  const multi=new DatabaseSync(path.join(multiOriginal,'data/app.db'),{readOnly:true});
  try{
   const rows=multi.prepare("SELECT * FROM ai_confirmation_items WHERE status='confirmed' AND "+
    "action_type='pi_original_question_multi_candidate'").all();assert.equal(rows.length,2);
   for(const r of rows){const p=JSON.parse(r.payload_json),e=JSON.parse(r.result_json);
    assert.equal(e.schemaVersion,'xiaozhi.education.original-review.v2');assert.equal(e.complete,true);
    assert.doesNotThrow(()=>repo.multi.effect(r,p));
   }
  }finally{multi.close();}
  assert.equal(fingerprint(multiOriginal).sha256,before);
 });
 await check('All owned baseline rows and original bytes remain exact; no business writes',async()=>{
  assert.equal(baseline(),baselineHash);assert.equal(sha(fs.readFileSync(sourceFile)),sha(sourceBytes));
  assert.equal(sha(fs.readFileSync(assetFile)),proposal.image.sha256);
  assert.equal(fingerprint(original).sha256,originalBefore);assert.equal(report.businessWrites,0);
 });
 report.success=report.checks.every(x=>x.status==='PASS');
}catch(e){report.fatal=String(e.stack);}
finally{
 reader?.close();db?.close();report.originalAfter=fingerprint(original).sha256;
 report.originalUnchanged=report.originalAfter===originalBefore;
 report.success=report.success&&report.originalUnchanged;persist();
}
console.log(JSON.stringify({success:report.success,checks:report.checks.length,output}));
process.exitCode=report.success?0:1;
