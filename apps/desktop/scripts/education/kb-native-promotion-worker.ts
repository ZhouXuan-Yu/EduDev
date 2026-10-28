import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import sqlite3 from 'sqlite3';
import {parseWord} from '../../src/main/assets/word-parser';
import {MaterialWordRepository} from '../../src/main/assets/material-word-repository';
import {MaterialAiRepository} from '../../src/main/assets/material-ai-repository';
import {NativeQuestionRepository} from '../../src/main/assets/native-question-repository';
import {wordProofEnvironment,renderWordQuestionProof} from '../../src/main/assets/word-question-render';
import {nativeSourceRoleText,wordRoleContentDigest} from '../../src/main/assets/native-question-content';
import {questionVersion} from '../../src/main/education/question-context-provider';
import type {QuestionBankItem,TeacherResource} from '../../src/shared/contracts';
import type {WordProofBase} from '../../src/shared/material-word-proof';

const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
/** Real Electron pixels and asynchronous sqlite3, with distinct preparation/writer connections.
 * AI transcription is a controlled private fixture; this does not exercise a real provider. */
export async function promotion(root:string,docx:string,q:QuestionBankItem){
 const signal=new AbortController().signal,checks:string[]=[],original=Buffer.from(docx,'base64'),version=hash(original),file=path.join(root,'original.docx');
 await fs.writeFile(file,original);const parsed=await parseWord(original);
 const resource={id:q.archive!.native!.source.resourceId,contentHash:version,parseStatus:'ready'} as TeacherResource;
 const open=async()=>{const db=await new Promise<sqlite3.Database>((yes,no)=>{const value=new sqlite3.Database(path.join(root,'app.db'),e=>e?no(e):yes(value));});db.configure('busyTimeout',5000);return{
  all:(sql:string,p:unknown[]=[])=>new Promise<Record<string,unknown>[]>((yes,no)=>db.all(sql,p,(e,r)=>e?no(e):yes(r as Record<string,unknown>[]))),
  run:(sql:string,p:unknown[]=[])=>new Promise<void>((yes,no)=>db.run(sql,p,e=>e?no(e):yes())),close:()=>new Promise<void>((yes,no)=>db.close(e=>e?no(e):yes()))};};
 let preparation=await open(),writer=await open(),writing=false;
 const transaction=async<T>(action:()=>Promise<T>)=>{assert(!writing);await writer.run('BEGIN IMMEDIATE');writing=true;try{const result=await action();await writer.run('COMMIT');return result;}catch(error){await writer.run('ROLLBACK');throw error;}finally{writing=false;}};
 const verify=async(_id:string,v:string,s:AbortSignal)=>{s.throwIfAborted();if(v!==version||hash(await fs.readFile(file))!==version)throw Error('source_changed');};
 let word:MaterialWordRepository,writerWord:MaterialWordRepository,repo:NativeQuestionRepository,target:NativeQuestionRepository,transcription:any;
 const make=()=>{
  const wordHost=(connection:typeof preparation)=>({root:()=>root,all:connection.all,run:connection.run,resource:async()=>resource,verify,stamp:async()=>hash(await fs.readFile(file)),writer:async<T>(action:(w:MaterialWordRepository)=>Promise<T>,before?:()=>void)=>transaction(async()=>{const result=await action(writerWord);before?.();return result;})});
  word=new MaterialWordRepository(wordHost(preparation));writerWord=new MaterialWordRepository(wordHost(writer));
  const nativeHost=(connection:typeof preparation,isWriter:boolean)=>({root:()=>root,all:connection.all,run:connection.run,inTransaction:()=>isWriter&&writing,
   read:async(id:string)=>{const row=(await connection.all('SELECT question_json FROM question_bank_items WHERE id=?',[id]))[0];return row?JSON.parse(String(row.question_json)) as QuestionBankItem:undefined;},
   source:async(base:WordProofBase)=>{const page=await (isWriter?writerWord:word).questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:base.resourceId,version:base.version,ordinal:base.ordinal,offset:base.ordinal-1});if(!page?.source)throw Error('source_changed');return page.source;},
   verify:(base:WordProofBase,s:AbortSignal)=>verify(base.resourceId,base.version,s),attest:(proof:any,s:AbortSignal)=>word.proofs.evidence({schemaVersion:proof.schemaVersion,resourceId:proof.resourceId,version:proof.version,documentSha:proof.documentSha,ordinal:proof.ordinal},proof.proofId,s),
   transcription:async()=>structuredClone(transcription),validate:async()=>{}});
  repo=new NativeQuestionRepository(nativeHost(preparation,false));target=new NativeQuestionRepository(nativeHost(writer,true));
 };
 try{
  make();await preparation.run('CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,question_json TEXT NOT NULL)');await word.migrate();await repo.migrate();
  await word.prepare(parsed,signal);await word.commit(resource.id,version,parsed.document);
  const source=(await word.questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:resource.id,version,offset:0,ordinal:1}))!.source!;
  const base:WordProofBase={schemaVersion:'xiaozhi.word-question-proof.v1',resourceId:resource.id,version,ordinal:1,documentSha:source.documentSha};
  const proof=await word.proofs.create({...base,requestId:'wqproof_'+randomUUID()},{environment:wordProofEnvironment,render:(s,i,abort,dataRoot)=>renderWordQuestionProof(s,i,{dataRoot,signal:abort})},signal);
  const evidence=await word.proofs.evidence(base,proof.proofId,signal);assert.deepEqual(evidence.proof,proof);for(const p of proof.pages)assert.equal(hash(evidence.images.get(p.sha256)!),p.sha256);checks.push('Actual isolated Electron role rendering is attested from the published SQLite manifest and exact decoded PNGs');
  const batchId='aibatch_'+randomUUID(),unit={sources:[],text:source.canonical.question,visualRisk:true,stamp:version,native:{schemaVersion:'xiaozhi.material-ai-native-input.v1',base,sourceDigest:hash(JSON.stringify(source))}},inputJson=JSON.stringify(unit),key={batchId,ordinal:1,inputSha:hash(inputJson)};
  await new MaterialAiRepository({all:preparation.all,run:preparation.run} as any).migrate();
  const config={schemaVersion:'xiaozhi.material-ai.v1',resourceId:resource.id,version,settingsRevision:1,start:1,count:1,maxCalls:2,images:true,cloudConsent:true,publicMaterial:true,model:'qwen3-vl-plus'};
  await preparation.run('INSERT INTO material_ai_batches(id,resource_id,version,title,config_json,status,created_at) VALUES(?,?,?,?,?,?,?)',[batchId,resource.id,version,'native promotion',JSON.stringify(config),'running',new Date().toISOString()]);await preparation.run('INSERT INTO material_ai_units(batch_id,ordinal,input_json) VALUES(?,?,?)',[batchId,1,inputJson]);
  await repo.withEvidence(evidence,signal,permit=>transaction(()=>target.stageInput(key,permit,signal)));
  await preparation.run("UPDATE material_ai_units SET status='first_saved',first_json='controlled transcript' WHERE batch_id=?",[batchId]);
  for(const sha of new Set(proof.pages.map(p=>p.sha256)))await fs.unlink(path.join(root,'cache/word-question-pages/v1',sha+'.png'));
  await preparation.run('DELETE FROM material_word_proof_files');await preparation.run('DELETE FROM material_word_proofs');await preparation.close();await writer.close();preparation=await open();writer=await open();make();
  await assert.rejects(word.proofs.evidence(base,proof.proofId,signal),/cache_unavailable/);
  const input=await repo.readInput(key,signal);assert.equal(input.proof.environment.fontDigest,proof.environment.fontDigest);checks.push('Closing both sqlite3 connections and deleting real disposable manifests/PNGs leaves the first-saved managed input unchanged');
  q.archive!.native!.source={kind:'word-native.v1',resourceId:resource.id,resourceVersion:version,documentSha:source.documentSha,ordinal:1,sourceDigest:hash(JSON.stringify(source))};
  for(const role of ['question','answer','analysis'] as const){const text=nativeSourceRoleText(source,role);q.archive!.native!.roles[role]={text,origin:'source',contentSha:wordRoleContentDigest(source,role),figures:proof.pages.filter(p=>p.role===role).map((p,i)=>({blockId:`native_${role}_${i}`,assetId:p.assetId,sha256:p.sha256,width:p.width,height:p.height,bytes:p.bytes}))};q[role==='question'?'stem':role]=text;}
  q.archive!.answerOrigin='source';q.archive!.analysisOrigin='source';q.archive!.sources.forEach(s=>{s.resourceId=resource.id;s.version=version;});q.archive!.native!.projection.statement.text=q.stem;q.archive!.native!.projection.formulas={state:'provided',text:source.canonical.question};q.archive!.native!.projection.figures={state:'not_applicable',text:''};
  Object.assign(q.archive!.ai!,{batchId,ordinal:1,imageSha:input.digest});transcription={projection:structuredClone(q.archive!.native!.projection),roles:Object.fromEntries(['question','answer','analysis'].map(r=>[r,{text:q.archive!.native!.roles[r as 'question'].text,origin:'source'}])),imagesObserved:true};
  await repo.withInput(key,signal,permit=>transaction(async()=>{await writer.run('INSERT INTO question_bank_items VALUES(?,?)',[q.id,JSON.stringify(q)]);await target.publish(q,permit,signal);}));
  const student=await repo.officeImages(q.id,questionVersion(q),'student',signal),teacher=await repo.officeImages(q.id,questionVersion(q),'teacher',signal);
  assert.deepEqual(student.map(p=>p.role),['question']);assert.deepEqual(teacher.map(p=>p.role),['question','answer','analysis']);for(const p of teacher)assert.equal(hash(p.bytes),proof.pages.find(page=>page.role===p.role&&page.sha256===p.figure.sha256)!.sha256);checks.push('A different writer connection atomically publishes bank facts and native role authority, preserving exact real pixels and student answer isolation');
  await fs.appendFile(file,'changed');await assert.rejects(repo.officeImages(q.id,questionVersion(q),'student',signal),/source_changed/);checks.push('The actual original DOCX file changing revokes current managed image reads after cache deletion');
  return{passed:checks.length,checks,root,scope:'Actual Electron Word rendering, private proof attestation, two asynchronous sqlite3 connections, managed input/reopen/cache deletion and bank publication; controlled transcription, not production Store/AI/UI/Office acceptance'};
 }finally{await preparation.close();await writer.close();}
}
