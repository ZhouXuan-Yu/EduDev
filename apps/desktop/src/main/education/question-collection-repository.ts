import {randomUUID} from 'node:crypto';
import {QUESTION_REVIEW_SCHEMA,type QuestionReviewDraft,type QuestionReviewDecision} from '../../shared/question-review';
import {QUESTION_COLLECTION_SCHEMA,validCollectionBlueprint,validCollectionReference,validQuestionCollection,type QuestionCollectionDecision,type QuestionCollectionView,type QuestionCollectionSummary} from '../../shared/question-collection';
import {generatedPaperCount,type PaperBlueprint} from '../../shared/paper-blueprint';
import {questionContentIdentity} from '../../shared/question-identity';
import {questionVersion} from './question-context-provider';
import {questionQualityCandidate} from './question-quality';
import {paperSectionMatches} from './paper-selection';
import type {QuestionReviewHost,QuestionReviewRepository} from './question-review-repository';
import {validateQuestionReviewFormat} from './question-review-repository';
import {COLLECTION_ACTION,collectionAuthorize,collectionHash,getCollection,saveCollection,type CollectionPayload} from './question-collection-ledger';

/** A bounded aggregate in the existing approval ledger. Pi owns generation; this class only reads/writes facts. */
export class QuestionCollectionRepository{
 private readonly host:QuestionReviewHost;
 private readonly questions:QuestionReviewRepository;
 constructor(host:QuestionReviewHost,questions:QuestionReviewRepository){this.host=host;this.questions=questions;}
 async begin(sessionId:string,runId:string,callId:string,blueprint:PaperBlueprint,current:()=>boolean){
  if(!validCollectionBlueprint(blueprint)||!callId||callId.length>128)throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   if(!current())throw new Error('cancelled');const studentId=await collectionAuthorize(sql,sessionId),run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||String(run.student_id||'')!==studentId)throw new Error('permission_denied');
   const rows=await sql.all('SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND (status=\'pending\' OR (run_id=? AND json_extract(payload_json,\'$.callId\')=?)) ORDER BY created_at,id',[sessionId,COLLECTION_ACTION,runId,callId]);
   if(rows.length>1)throw new Error('conflict');if(rows.length){const v=await getCollection(sql,sessionId,String(rows[0].id));if(JSON.stringify(v.p.blueprint)!==JSON.stringify(blueprint)||v.r.student_id!==studentId)throw new Error('conflict');if(!current())throw new Error('cancelled');return{id:String(v.r.id),reference:v.p.reference};}
   const id='xicollection_'+randomUUID(),at=new Date().toISOString(),payload:CollectionPayload={schemaVersion:QUESTION_COLLECTION_SCHEMA,studentId,callId,reference:'整卷_'+randomUUID().replace(/-/g,'').slice(0,24),blueprint};
   await sql.run("INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)",[id,runId,sessionId,studentId,COLLECTION_ACTION,blueprint.title,JSON.stringify(payload),at,at]);
   await saveCollection(sql,{id,session_id:sessionId,student_id:studentId},payload,{phase:'drafting',members:[]});if(!current())throw new Error('cancelled');return{id,reference:payload.reference};
  });
 }
 async resume(sessionId:string,runId:string,current:()=>boolean){
  if(!current())throw new Error('cancelled');const studentId=await collectionAuthorize(this.host,sessionId),run=(await this.host.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||String(run.student_id||'')!==studentId)throw new Error('permission_denied');
  const rows=await this.host.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND status='pending'",[sessionId,COLLECTION_ACTION]);if(rows.length!==1)throw new Error(rows.length?'conflict':'unavailable');
  const value=await getCollection(this.host,sessionId,String(rows[0].id));if(!current())throw new Error('cancelled');return{id:String(value.r.id),reference:value.p.reference};
 }
 /** Only prior model proposals, never the teacher's local checked edits, are sent back for continuation. */
 async continuation(sessionId:string,id:string){
  const prepared=await this.inspect(sessionId,id),staged=[];let repair:unknown;
  for(const group of prepared.view.groups){const row=JSON.parse(prepared.snapshots.get(group.review.id)!),p=JSON.parse(String(row.payload_json));
   staged.push({sectionId:group.sectionId,count:p.draft.items.length,proposedStemSummaries:p.draft.items.map((q:{stem:string})=>q.stem.slice(0,280)),summaryOnly:true});
   if(!repair&&prepared.s.phase==='drafting'&&group.review.quality?.state==='blocked'){
    const feedback=await this.questions.repairFeedbackForQuestion(sessionId,group.review.id);
    if(feedback&&feedback.attempt<3)repair={sectionId:group.sectionId,repairReference:feedback.reference,attempt:feedback.attempt,generationKind:feedback.generationKind,issues:feedback.issues,draft:p.draft,mathChecks:p.mathPlans.map((v:{input:unknown}|null)=>v?.input||null),sourceQueries:p.sources.map((q:{subject:string;grade:string;knowledgePoint:string;stem:string})=>({subject:q.subject,grade:q.grade,query:(q.knowledgePoint||q.stem).slice(0,128)})),message:'variation必须重新检索并读取全部当前父题，使用本轮实读sourceReferences；失败题仍占配额。'};
   }
  }
  return{view:prepared.view,staged,repair};
 }
 async resolve(sessionId:string,reference:string){
  if(!validCollectionReference(reference))throw new Error('invalid_input');await collectionAuthorize(this.host,sessionId);
  const rows=await this.host.all("SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? AND json_extract(payload_json,'$.reference')=?",[sessionId,COLLECTION_ACTION,reference]);if(rows.length!==1)throw new Error('permission_denied');return getCollection(this.host,sessionId,String(rows[0].id));
 }
 private async inspect(sessionId:string,id:string){
  const value=await getCollection(this.host,sessionId,id),{r,p,s}=value,groups:QuestionCollectionView['groups']=[],issues:QuestionCollectionView['issues']=[],snapshots=new Map<string,string>();
  let count=0,sourceCurrent=true;const counts=new Map<string,number>(),identities=new Map<string,{groupId:string;index:number;answer:string}[]>();
  for(const m of s.members){
   const head=m.ids.at(-1)!,before=(await this.host.all('SELECT * FROM ai_confirmation_items WHERE id=?',[head]))[0];if(!before||before.session_id!==sessionId||before.student_id!==p.studentId||before.action_type!=='pi_question_candidate')throw new Error('unavailable');
   const review=await this.questions.review(sessionId,head);const after=(await this.host.all('SELECT * FROM ai_confirmation_items WHERE id=?',[head]))[0];if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('quality_stale');snapshots.set(head,JSON.stringify(after));
   const payload=JSON.parse(String(after.payload_json)) as {sources:{id:string}[]};
   for(const parent of payload.sources){const q=await this.host.read(parent.id);try{if(!q)throw new Error('source_changed');await this.host.validate?.(q);}catch{review.sourceCurrent=false;}}
   if(review.collectionId!==id||review.supersededBy||review.state!==r.status||review.draft.subject!==p.blueprint.subject||review.draft.grade!==p.blueprint.grade||p.blueprint.mode==='ai_original'&&review.generationKind!=='ai_original')throw new Error('unavailable');
   for(const saved of review.saved){const q=await this.host.read(saved.question.questionId);if(!q||questionVersion(q)!==saved.question.version)review.sourceCurrent=false;}
   if(s.phase==='confirmed'&&JSON.parse(String(after.result_json)).digest!==s.effects?.find(e=>e.id===head)?.digest)throw new Error('unavailable');
   groups.push({sectionId:m.sectionId,review});count+=review.count;counts.set(m.sectionId,(counts.get(m.sectionId)||0)+review.count);sourceCurrent=sourceCurrent&&review.sourceCurrent;
   const section=p.blueprint.sections.find(v=>v.id===m.sectionId)!;if(!review.draft.items.every((q,i)=>paperSectionMatches(questionQualityCandidate(q,review.draft,i),p.blueprint,section)))issues.push({sectionId:m.sectionId,groupId:head,code:'quota_mismatch'});
   if(!review.sourceCurrent)issues.push({sectionId:m.sectionId,groupId:head,code:'source_changed'});
   if(!review.qualityHistoryCount||!review.quality)issues.push({sectionId:m.sectionId,groupId:head,code:'quality_required'});
   else if(review.quality.state==='blocked')issues.push({sectionId:m.sectionId,groupId:head,code:'quality_blocked'});
   review.draft.items.forEach((q,index)=>{const identity=questionContentIdentity(questionQualityCandidate(q,review.draft,index));if(identity.status==='available'){const peers=identities.get(identity.key)||[];peers.push({groupId:head,index,answer:q.answer});identities.set(identity.key,peers);}});
  }
  for(const [_,peers]of identities)if(peers.length>1){const conflict=new Set(peers.map(v=>v.answer)).size>1;for(const peer of peers)issues.push({sectionId:groups.find(g=>g.review.id===peer.groupId)!.sectionId,...peer,code:conflict?'answer_conflict':'duplicate_collection'});}
  for(const section of p.blueprint.sections){const required=generatedPaperCount(p.blueprint,section),actual=counts.get(section.id)||0;if(actual!==required)issues.push({sectionId:section.id,code:actual<required?'shortage':'quota_mismatch'});}
  const latest=await getCollection(this.host,sessionId,id);if(JSON.stringify(latest.r)!==JSON.stringify(r))throw new Error('quality_stale');
  const required=p.blueprint.sections.reduce((n,section)=>n+generatedPaperCount(p.blueprint,section),0),revisionHash=collectionHash({id,sessionId,studentId:p.studentId,payload:p,state:s,groups:groups.map(g=>({sectionId:g.sectionId,id:g.review.id,draft:g.review.draft,quality:g.review.quality,history:g.review.qualityHistoryCount,sourceCurrent:g.review.sourceCurrent,saved:g.review.saved}))});
  const view:QuestionCollectionView={id,sessionId,runId:String(r.run_id),title:p.blueprint.title,state:r.status as QuestionCollectionSummary['state'],phase:s.phase,count,required,blueprint:p.blueprint,groups,issues,revisionHash,complete:issues.length===0&&sourceCurrent,sourceCurrent,answerVerified:false};
  return{...value,view,snapshots};
 }
 async review(sessionId:string,id:string){return(await this.inspect(sessionId,id)).view;}
 async list(sessionId:string){await collectionAuthorize(this.host,sessionId);const rows=await this.host.all('SELECT id FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id',[sessionId,COLLECTION_ACTION]);const out:QuestionCollectionSummary[]=[];for(const row of rows){const {r,p,s}=await getCollection(this.host,sessionId,String(row.id));let count=0;for(const m of s.members){const q=(await this.host.all('SELECT payload_json FROM ai_confirmation_items WHERE id=?',[m.ids.at(-1)!]))[0];if(!q)throw new Error('unavailable');count+=(JSON.parse(String(q.payload_json)) as {draft:QuestionReviewDraft}).draft.items.length;}out.push({id:String(r.id),sessionId,runId:String(r.run_id),title:p.blueprint.title,state:r.status as QuestionCollectionSummary['state'],phase:s.phase,count,required:p.blueprint.sections.reduce((n,section)=>n+generatedPaperCount(p.blueprint,section),0)});}return out;}
 async seal(sessionId:string,id:string,current:()=>boolean){
  const before=await this.inspect(sessionId,id);if(before.view.issues.some(i=>i.code==='shortage'||i.code==='quota_mismatch'))throw new Error('invalid_input');
  await this.host.transaction(async sql=>{if(!current())throw new Error('cancelled');const value=await getCollection(sql,sessionId,id);if(JSON.stringify(value.r)!==JSON.stringify(before.r)||value.r.status!=='pending')throw new Error('conflict');await saveCollection(sql,value.r,value.p,{phase:'review',members:value.s.members});if(!current())throw new Error('cancelled');});return this.review(sessionId,id);
 }
 async decide(input:QuestionCollectionDecision,current:()=>boolean,afterWrite?:(current:()=>boolean)=>Promise<void>){
  if(!validQuestionCollection(input,true))throw new Error('invalid_input');if(!current())throw new Error('cancelled');
  const prepared=await this.inspect(input.sessionId,input.id),formats=new Map<string,Awaited<ReturnType<typeof validateQuestionReviewFormat>>>();
  if(prepared.r.status!=='pending'){if(input.action===(prepared.r.status==='confirmed'?'confirm':'reject')&&(input.action==='reject'||input.revisionHash===prepared.s.approvalRevision))return prepared.view;throw new Error('conflict');}
  if(input.action==='confirm'){
   if(prepared.s.phase!=='review')throw new Error('quality_required');if(input.revisionHash!==prepared.view.revisionHash)throw new Error('quality_stale');if(!prepared.view.complete)throw new Error('quality_blocked');
   for(const g of prepared.view.groups)formats.set(g.review.id,await validateQuestionReviewFormat(g.review.draft,new AbortController().signal));
  }
  await this.host.transaction(async sql=>{
   const lease=()=>{if(!current())throw new Error('cancelled');};lease();const latest=await getCollection(sql,input.sessionId,input.id);if(JSON.stringify(latest.r)!==JSON.stringify(prepared.r))throw new Error('quality_stale');
   for(const[id,snapshot]of prepared.snapshots){const row=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0];if(JSON.stringify(row)!==snapshot)throw new Error('quality_stale');}lease();
   const effects:{id:string;digest:string}[]=[];
   for(const g of prepared.view.groups){
    const review=g.review,decision:QuestionReviewDecision={schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId:input.sessionId,id:review.id,action:input.action,...(input.action==='confirm'?{draft:review.draft,qualityConfirmation:{revisionHash:review.quality!.revisionHash,reviewed:true}}:{})};
    await this.questions.applyDecision(sql,decision,current,formats.get(review.id),input.id,afterWrite);lease();
    if(input.action==='confirm'){const row=(await sql.all('SELECT result_json FROM ai_confirmation_items WHERE id=?',[review.id]))[0];effects.push({id:review.id,digest:JSON.parse(String(row.result_json)).digest});}
   }
   await saveCollection(sql,latest.r,latest.p,{phase:input.action==='confirm'?'confirmed':'rejected',members:latest.s.members,...(input.action==='confirm'?{approvalRevision:input.revisionHash,effects}:{})});lease();
  });return this.review(input.sessionId,input.id);
 }
}
