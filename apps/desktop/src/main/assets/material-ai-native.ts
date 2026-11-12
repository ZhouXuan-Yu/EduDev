import {NATIVE_REVIEW_ARCHIVE,parseNativeAiReview,isNativeFieldReview} from '../../shared/material-ai-native-review';
import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import type {AiBatchInput,AiUnitInput,AiModel} from '../../shared/material-ai';
import {parseNativeAiResponse,type NativeAiQuestion} from '../../shared/material-ai-native-response';
import {QUESTION_NATIVE_ARCHIVE_SCHEMA,archiveMissing,type QuestionArchive} from '../../shared/question-archive';
import {NATIVE_QUESTION_SCHEMA,NATIVE_QUESTION_ROLES,nativeQuestionComplete,type NativeQuestionDocument} from '../../shared/native-question';
import {QUESTION_PROJECTION_FIELDS} from '../../shared/question-projection';
import type {WordQuestionSource} from '../../shared/material-word-question';
import type {MaterialWordRepository} from './material-word-repository';
import type {NativeQuestionRepository,NativeTranscription} from './native-question-repository';
import {nativeSourceRoleText,nativeTextContentDigest,wordRoleContentDigest,nativeProjectionCoversSource,nativeCheckedProjection} from './native-question-content';
import {validNativeAiContext,nativeMetadata,type NativeAiContext} from './material-ai-native-context';
import {completeMaterialAi,type AiCompletionInput} from './material-ai-provider';
import {nativeChoiceAnswerConflict} from './word-booklet';
import type {AiRuntime} from './material-ai-repository';
import type {MaterialSource} from '../../shared/materials';

type Row=Record<string,unknown>;type Value=string|number|null;
export type NativeAiHost={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;native:()=>NativeQuestionRepository;word:()=>MaterialWordRepository;associate?:(q:QuestionBankItem,source:WordQuestionSource,sources:MaterialSource[])=>Promise<void>};
export type NativeAiPreparation=<T>(action:(native:NativeQuestionRepository,word:MaterialWordRepository)=>Promise<T>)=>Promise<T>;
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const signature=(q:NativeAiQuestion)=>JSON.stringify([q.number,q.stem,q.answer,q.analysis,q.answerOrigin,q.analysisOrigin,q.requiresImage,[...q.issues].sort(),...QUESTION_PROJECTION_FIELDS.map(f=>[q.projection[f].state,q.projection[f].text])]);

/** Reconstructs authority from real committed (or same-writer uncommitted) receipts. */
export async function nativeAiTranscription(host:NativeAiHost,q:QuestionBankItem,source:WordQuestionSource,validate:(config:AiBatchInput,unit:AiUnitInput)=>Promise<void>,signal:AbortSignal):Promise<NativeTranscription>{
 const receipt=q.archive?.ai;if(!receipt||!['native-complete.v1',NATIVE_REVIEW_ARCHIVE].includes(receipt.policy))throw Error('source_changed');
 const row=(await host.all('SELECT u.*,b.config_json FROM material_ai_members m JOIN material_ai_units u ON u.batch_id=m.batch_id AND u.ordinal=m.ordinal JOIN material_ai_batches b ON b.id=m.batch_id WHERE m.question_id=? AND m.batch_id=? AND m.ordinal=? AND m.number=?',[q.id,receipt.batchId,receipt.ordinal,q.archive!.number]))[0];
 if(!row||!['complete','review'].includes(String(row.status))||typeof row.first_json!=='string'||typeof row.final_json!=='string'||hash(row.first_json)!==receipt.firstSha||hash(row.final_json)!==receipt.finalSha||row.image_sha!==receipt.imageSha)throw Error('source_changed');
 const unit=JSON.parse(String(row.input_json)) as AiUnitInput,config=JSON.parse(String(row.config_json)) as AiBatchInput&{model:string};if(receipt.model!==config.model)throw Error('source_changed');
 if(!unit.native||JSON.stringify(unit.sources)!==JSON.stringify(q.archive!.sources))throw Error('source_changed');await validate(config,unit);
 const input=await host.native().readInput({batchId:receipt.batchId,ordinal:receipt.ordinal,inputSha:hash(String(row.input_json))},signal);
 if(!input.context||input.digest!==receipt.imageSha||JSON.stringify(input.source)!==JSON.stringify(source))throw Error('source_changed');
 const first=parseNativeAiResponse(row.first_json),reviewed=isNativeFieldReview(unit.native.reviewPolicy)&&first.questions.length===1;
 if(receipt.policy!==(reviewed?NATIVE_REVIEW_ARCHIVE:'native-complete.v1'))throw Error('source_changed');
 const final=reviewed?parseNativeAiReview(row.final_json,first,receipt.firstSha,unit.native.reviewPolicy).response:parseNativeAiResponse(row.final_json),item=final.questions[0];
 if(!item||item.number!==source.number||q.archive!.number!==source.number)throw Error('source_changed');
 if(q.archive!.state==='ai_final'&&nativeChoiceAnswerConflict(source,[item.answer,parseNativeAiResponse(row.first_json).questions[0]?.answer||'']))throw Error('source_incomplete');
 for(const role of ['answer','analysis'] as const)if(item[role+'Origin' as 'answerOrigin']==='source'&&!source.parts[role].length)throw Error('source_changed');
 if(q.archive!.state!=='teacher_edited')for(const field of ['subject','grade','knowledgePoint','questionType','difficulty'] as const)if(q[field]!==item[field])throw Error('source_changed');
 return{projection:nativeCheckedProjection(source,item.projection),roles:{question:{text:item.stem,origin:'source'},answer:{text:item.answer,origin:item.answerOrigin},analysis:{text:item.analysis,origin:item.analysisOrigin}},imagesObserved:true};
}

type Execution={complete?:(args:AiCompletionInput,beforeSend:()=>Promise<void>)=>Promise<string>;host:NativeAiHost;prepare:NativeAiPreparation;runtime:AiRuntime;row:Row;config:AiBatchInput&{model:AiModel};unit:AiUnitInput;signal:AbortSignal;
 guard:()=>Promise<void>;transport?:()=>void;dispatch:(expected:string)=>Promise<string>;owned:(host:NativeAiHost,lease:string)=>Promise<void>;lease:(value:string)=>void;
 write:<T>(action:(host:NativeAiHost)=>Promise<T>)=>Promise<T>};
/** One native Word question at a time; no Agent, service or unbounded image collection. */
export async function executeNativeAi(input:Execution){
 const {host,runtime,row,config,unit,signal}=input,batchId=String(row.batch_id),ordinal=Number(row.ordinal),key={batchId,ordinal,inputSha:hash(String(row.input_json))};
 if(!unit.native||!config.images||!runtime.word||!runtime.ocr)throw Error('configuration');
 let stored=await host.all('SELECT 1 FROM material_ai_native_inputs WHERE batch_id=? AND ordinal=?',[batchId,ordinal]);
 if(!stored.length){
  if(row.first_json)throw Error('source_changed');
  await input.prepare(async(native,word)=>{
   await input.guard();const proof=await word.proofs.create({...unit.native!.base,requestId:'wqproof_'+randomUUID()},runtime.word!,signal),evidence=await word.proofs.evidence(unit.native!.base,proof.proofId,signal);
   const context:NativeAiContext={schemaVersion:'xiaozhi.native-ai-context.v1',cleanVersion:'student-context-sanitizer.v1',number:evidence.source.number,metadata:nativeMetadata(evidence.source),roles:Object.fromEntries(NATIVE_QUESTION_ROLES.map(role=>[role,nativeSourceRoleText(evidence.source,role)])) as NativeAiContext['roles'],ocr:[]};
   for(const page of proof.pages){await input.guard();const ocr=await runtime.ocr!(evidence.images.get(page.sha256)!,signal);context.ocr.push({role:page.role,index:page.index,sha256:page.sha256,engine:ocr.engine,text:ocr.text});}
   if(!validNativeAiContext(context,evidence.source,proof))throw Error('unit_too_large');
   if(await runtime.clean(JSON.stringify(context))!==JSON.stringify(context))throw Error('privacy_blocked');await input.guard();
   await native.withEvidence(evidence,signal,permit=>input.write(h=>h.native().stageInput(key,permit,signal,context)));
  });
 }
 const evidence=await host.native().readInput(key,signal);if(!evidence.context)throw Error('source_changed');
 const text=JSON.stringify(evidence.context);if(await runtime.clean(text)!==text)throw Error('privacy_blocked');
 const images=evidence.proof.pages.map(p=>({role:p.role,index:p.index,mime:'image/png' as const,data:evidence.images.get(p.sha256)!.toString('base64')}));
 if(row.first_json&&row.image_sha!==evidence.digest)throw Error('source_changed');
 const settingsKey=(await host.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.material-ai.v1']))[0];if(!settingsKey&&!runtime.account)throw Error('configuration');
 const apiKey=runtime.account?(await runtime.account()).apiKey:runtime.codec.open(JSON.parse(String(settingsKey.value_json)).sealedKey);
 const beforeSend=async()=>{if(await runtime.clean(text)!==text)throw Error('privacy_blocked');await input.guard();};
 const complete=async(args:AiCompletionInput)=>{if(input.complete)return input.complete(args,beforeSend);if(runtime.complete){await beforeSend();input.transport?.();return runtime.complete(args,signal);}return completeMaterialAi({...args,beforeSend,onTransport:input.transport},signal);};
 let firstRaw=String(row.first_json),first=firstRaw?parseNativeAiResponse(firstRaw):undefined;
 if(!first){
  await input.guard();const lease=await input.dispatch('pending');input.lease(lease);
  if(await runtime.clean(text)!==text)throw Error('privacy_blocked');await input.guard();
  firstRaw=await complete({model:config.model,apiKey,text,native:true,images,...(unit.native.reviewPolicy?{nativeReviewPolicy:unit.native.reviewPolicy}:{})});first=parseNativeAiResponse(firstRaw);
  await input.write(async h=>{await input.guard();await input.owned(h,lease);await h.run("UPDATE material_ai_units SET status='first_saved',first_json=?,image_sha=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[firstRaw,evidence.digest,batchId,ordinal]);});input.lease('');
 }
 const safeFirst=structuredClone(first);for(const q of safeFirst.questions){for(const field of ['stem','answer','analysis','subject','grade','knowledgePoint','questionType'] as const)q[field]=await runtime.clean(q[field]);for(const field of QUESTION_PROJECTION_FIELDS)q.projection[field].text=await runtime.clean(q.projection[field].text);q.projection.statement.text=q.stem;}
 parseNativeAiResponse(JSON.stringify(safeFirst));await input.guard();if(await runtime.clean(text)!==text)throw Error('privacy_blocked');
 const reviewed=isNativeFieldReview(unit.native.reviewPolicy)&&first.questions.length===1;
 if(reviewed&&JSON.stringify(safeFirst)!==JSON.stringify(first))throw Error('privacy_blocked');
 const lease=await input.dispatch('first_saved');input.lease(lease);
 if(await runtime.clean(text)!==text)throw Error('privacy_blocked');await input.guard();
 const finalRaw=await complete({model:config.model,apiKey,text,native:true,images,previous:safeFirst,...(unit.native.reviewPolicy?{nativeReviewPolicy:unit.native.reviewPolicy}:{}),...(reviewed?{nativeReviewSha256:hash(firstRaw)}:{})}),final=reviewed?parseNativeAiReview(finalRaw,first,hash(firstRaw),unit.native.reviewPolicy).response:parseNativeAiResponse(finalRaw),q=final.questions[0],prior=first.questions[0];
 if(reviewed&&await runtime.clean(JSON.stringify(final))!==JSON.stringify(final))throw Error('privacy_blocked');
 if(q&&q.number!==evidence.source.number)throw Error('invalid_response');
 const issues=q?[...q.issues,...archiveMissing(q),...(q.requiresImage?['requires_image']:[])]:['incomplete_question'];
 if(q&&nativeChoiceAnswerConflict(evidence.source,[q.answer,prior?.answer||'']))issues.push('answer_conflict');
 if(evidence.source.issues.length||q&&!nativeProjectionCoversSource(evidence.source,q.projection))issues.push('incomplete_question');
 if(!q||!prior||signature(q)!==signature(prior)||first.outcome!==final.outcome)issues.push('ai_mismatch');
 if(final.outcome!=='questions')issues.push('ai_review');
 const document=q?nativeDocument(q,evidence):undefined;
 if(document&&!nativeQuestionComplete(document))issues.push('incomplete_question');
 const unique=[...new Set(issues)],review=unique.length>0;
 await input.prepare((native)=>native.withInput(key,signal,permit=>input.write(async h=>{
  await input.guard();await input.owned(h,lease);
  await h.run("UPDATE material_ai_units SET status=?,final_json=?,error=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[review?'review':'complete',finalRaw,q?'':'ai_omitted_questions',batchId,ordinal]);
  if(q&&document){
   const archive:QuestionArchive={schemaVersion:QUESTION_NATIVE_ARCHIVE_SCHEMA,extractor:'ai-native-two-pass.v1',state:review?'ai_needs_review':'ai_final',number:q.number,sources:unit.sources,issues:unique,sourceRisks:[],sourceChecked:false,answerOrigin:q.answerOrigin,analysisOrigin:q.analysisOrigin,native:document,
    ai:{batchId,ordinal,provider:config.model==='deepseek-flash'?'deepseek':'qwen',model:config.model,firstSha:hash(firstRaw),finalSha:hash(finalRaw),imageSha:evidence.digest,policy:reviewed?NATIVE_REVIEW_ARCHIVE:'native-complete.v1'}};
   const saved=await h.create({...q,sourceKind:'teacher_resource',sourceTitle:String(row.title),tags:['AI整理',...(q.answerOrigin==='ai_generated'?['AI推导答案']:[])]});
   await h.run('UPDATE question_bank_items SET archive_json=? WHERE id=?',[JSON.stringify(archive),saved.id]);await h.run('INSERT INTO material_ai_members VALUES(?,?,?,?)',[batchId,ordinal,q.number,saved.id]);
   await h.native().publish({...saved,archive},permit,signal);
   await h.associate?.({...saved,archive},evidence.source,unit.sources);
  }
  await input.guard();
 })));
 input.lease('');
}
function nativeDocument(q:NativeAiQuestion,evidence:Awaited<ReturnType<NativeQuestionRepository['readInput']>>):NativeQuestionDocument{
 const {source,proof}=evidence;
 const roles=Object.fromEntries(NATIVE_QUESTION_ROLES.map(role=>{
  const text=role==='question'?q.stem:q[role],origin=role==='question'?'source':q[`${role}Origin`];if(origin==='source'&&!source.parts[role].length)throw Error('invalid_response');
  return[role,{text,origin,contentSha:origin==='source'?wordRoleContentDigest(source,role):nativeTextContentDigest(text),figures:origin==='source'?proof.pages.filter(p=>p.role===role).map((p,i)=>({blockId:`native_${role}_${i}`,sha256:p.sha256,assetId:p.assetId,width:p.width,height:p.height,bytes:p.bytes})):[]}];
 })) as NativeQuestionDocument['roles'];
 return{schemaVersion:NATIVE_QUESTION_SCHEMA,source:{kind:'word-native.v1',resourceId:proof.resourceId,resourceVersion:proof.version,documentSha:source.documentSha,ordinal:source.ordinal,sourceDigest:proof.sourceDigest},projection:nativeCheckedProjection(source,q.projection),roles};
}
