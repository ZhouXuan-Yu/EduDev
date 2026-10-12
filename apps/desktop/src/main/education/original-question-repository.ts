import {appendContextRevision} from './question-context-revision';
import {validQuestionContextEdit,type QuestionContextEditInput} from '../../shared/question-context-edit';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA} from '../../shared/question-document';
import {ORIGINAL_MULTI_ACTION,ORIGINAL_MULTI_MAX_IMAGE_BYTES} from '../../shared/original-multi-review';
import {validQuestionProjection,type QuestionProjection} from '../../shared/question-projection';
import {contextHistory,latestOriginalVersion,type ContextRevision} from './question-context-revision';
import {createHash,randomUUID} from 'node:crypto';
import {ORIGINAL_REVIEW_SCHEMA,ORIGINAL_REVIEW_ACTION,validOriginalDraft,validOriginalRegion,type OriginalQuestionDraft,type OriginalQuestionDecision,type OriginalQuestionView} from '../../shared/original-question-review';
import {QUESTION_DOCUMENT_SCHEMA,validQuestionDocument,type QuestionDocument} from '../../shared/question-document';
import {QUESTION_CONTEXT_SCHEMA,type QuestionContextSource} from '../../shared/question-context';
import type {QuestionReviewSummary} from '../../shared/question-review';
import type {QuestionReviewSql} from './question-review-repository';
import {questionVersion} from './question-context-provider';
import {MATERIAL_PREVIEW_SCHEMA,type MaterialPreviewQuery} from '../../shared/material-page-preview';
import {previewMaterialPage,type PageRenderer} from '../assets/material-page-preview';
import {QuestionAssets,type OriginalImage} from '../assets/question-assets';
import type {MaterialRepository} from '../assets/material-repository';
import {OriginalMultiQuestionRepository} from './original-multi-repository';
type Payload={schemaVersion:typeof ORIGINAL_REVIEW_SCHEMA;callId:string;studentId:string;draft:OriginalQuestionDraft;sourceTitle:string;image:OriginalImage};
type Effect={schemaVersion:typeof ORIGINAL_REVIEW_SCHEMA;complete:true;draft:OriginalQuestionDraft;saved:QuestionContextSource;digest:string;contextRevisions?:ContextRevision[]};
type Host=QuestionReviewSql&{transaction:<T>(work:(sql:QuestionReviewSql)=>Promise<T>)=>Promise<T>};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const summary=(row:Record<string,unknown>,p:Payload):QuestionReviewSummary=>({id:String(row.id),runId:String(row.run_id),callId:p.callId,state:row.status as QuestionReviewSummary['state'],count:1,kind:'original'});
/** Only main-rendered, original-backed candidates. Same ledger, same question facts and SQL transaction. */
export class OriginalQuestionRepository{
 private host:Host;private materials:()=>MaterialRepository;readonly assets:QuestionAssets;private render:PageRenderer;
 readonly multi:OriginalMultiQuestionRepository;
 constructor(host:Host,materials:()=>MaterialRepository,assets:QuestionAssets,render:PageRenderer){this.host=host;this.materials=materials;this.assets=assets;this.render=render;this.multi=new OriginalMultiQuestionRepository(host,materials,assets,render,(id,version,signal)=>this.context(id,version,signal));}
 private async binding(questionId:string,sql:QuestionReviewSql=this.host){
  const rows=await sql.all("SELECT * FROM ai_confirmation_items WHERE action_type IN (?,?) AND status='confirmed' AND json_extract(result_json,'$.saved.questionId')=?",[ORIGINAL_REVIEW_ACTION,ORIGINAL_MULTI_ACTION,questionId]);if(rows.length!==1)throw new Error('permission_denied');const row=rows[0];
  if(row.action_type===ORIGINAL_MULTI_ACTION)return this.multi.binding(questionId,sql);
  const{p}=await this.get(sql,String(row.session_id),String(row.id),false);return{row,effect:this.effect(row,p),images:[{role:'question' as const,image:p.image}]};
 }
 private async currentOriginal(q:import('../../shared/contracts').QuestionBankItem,b:Awaited<ReturnType<OriginalQuestionRepository['binding']>>,signal:AbortSignal){
  signal.throwIfAborted();if(questionVersion(q)!==latestOriginalVersion(b.row,b.effect)||!q.document||q.document.blocks.length!==b.images.length+1)throw new Error('source_changed');
  const first=b.images[0].image;if(q.document.source.resourceId!==first.resourceId||q.document.source.resourceVersion!==first.version)throw new Error('source_changed');await this.materials().original(first.resourceId,first.version,signal);let total=0;
  for(const[x,item]of b.images.entries()){signal.throwIfAborted();const block=q.document.blocks[x];if(block.kind!=='image'||block.assetId!==item.image.assetId||block.sha256!==item.image.sha256||block.width!==item.image.width||block.height!==item.image.height||JSON.stringify(block.anchors)!==JSON.stringify([{page:item.image.page,box:item.image.box}]))throw new Error('source_changed');total+=(await this.assets.read(item.image,true,signal)).length;if(total>ORIGINAL_MULTI_MAX_IMAGE_BYTES)throw new Error('too_large');}
 }
 async context(questionId:string,version:string,signal:AbortSignal=new AbortController().signal):Promise<QuestionProjection>{
  signal.throwIfAborted();const q=await this.host.read(questionId);if(!q||questionVersion(q)!==version)throw new Error('source_changed');if(q.document?.schemaVersion!==QUESTION_DOCUMENT_COMPLETE_SCHEMA)throw new Error('document_context_unavailable');
  const b=await this.binding(questionId),history=contextHistory(b.row,b.effect),projection=history.at(-1)?.projection||('projection'in b.effect.draft?b.effect.draft.projection:undefined);if(!validQuestionProjection(projection,true)||JSON.stringify(projection)!==JSON.stringify(q.document.context.projection))throw new Error('source_changed');await this.currentOriginal(q,b,signal);const latest=await this.host.read(questionId);signal.throwIfAborted();if(!latest||questionVersion(latest)!==version)throw new Error('source_changed');return JSON.parse(JSON.stringify(projection)) as QuestionProjection;
 }
 /** Main-only bytes for the existing Office host; no path or new authority from a model. */
 async officeImages(questionId:string,version:string,signal:AbortSignal=new AbortController().signal){
  await this.context(questionId,version,signal);const q=await this.host.read(questionId),b=await this.binding(questionId);
  if(!q||questionVersion(q)!==version)throw new Error('source_changed');await this.currentOriginal(q,b,signal);
  const result=[];for(const [index,item]of b.images.entries()){
   signal.throwIfAborted();const block=q.document!.blocks[index];if(block.kind!=='image')throw new Error('source_changed');
   result.push({blockId:block.id,role:item.role,assetId:item.image.assetId,sha256:item.image.sha256,width:item.image.width,height:item.image.height,bytes:await this.assets.read(item.image,true,signal)});
  }
  signal.throwIfAborted();return result;
 }
 async completeContext(input:QuestionContextEditInput,current:()=>boolean,afterWrite?:(current:()=>boolean)=>Promise<void>):Promise<QuestionContextSource>{
  if(!validQuestionContextEdit(input))throw new Error('invalid_input');return this.host.transaction(async sql=>{
   const check=()=>{if(!current())throw new Error('cancelled');};check();const b=await this.binding(input.questionId,sql),q=await sql.read(input.questionId);if(!q)throw new Error('source_changed');
   // Local teacher notebook authority. The caller cannot choose another student/session/run; archived chat retains canonical ownership.
   const owner=(await sql.all('SELECT s.student_id,t.status,r.session_id AS run_session,r.student_id AS run_student FROM ai_conversation_sessions s LEFT JOIN students t ON t.id=s.student_id JOIN ai_agent_runs r ON r.id=? WHERE s.id=?',[String(b.row.run_id),String(b.row.session_id)]))[0];if(!owner||String(owner.student_id||'')!==String(b.row.student_id||'')||owner.run_session!==b.row.session_id||String(owner.run_student||'')!==String(b.row.student_id||'')||owner.student_id&&owner.status!=='active')throw new Error('permission_denied');
   const history=contextHistory(b.row,b.effect),prior=history.find(x=>x.requestId===input.requestId);if(prior){if(questionVersion(prior.before)!==input.version||JSON.stringify(prior.projection)!==JSON.stringify(input.projection)||questionVersion(q)!==questionVersion(prior.after))throw new Error('conflict');await this.currentOriginal(q,b,new AbortController().signal);check();return{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)};}
   if(questionVersion(q)!==input.version)throw new Error('source_changed');await this.currentOriginal(q,b,new AbortController().signal);check();const next=appendContextRevision(b.row,b.effect,q,input.projection,input.requestId),after=next.revision.after;
   await sql.run('UPDATE question_bank_items SET document_json=?,stem=?,updated_at=? WHERE id=?',[JSON.stringify(after.document),after.stem,after.updatedAt,q.id]);await sql.run("UPDATE ai_confirmation_items SET result_json=?,updated_at=? WHERE id=? AND status='confirmed' AND result_json=?",[JSON.stringify(next.effect),after.updatedAt,String(b.row.id),String(b.row.result_json)]);await afterWrite?.(current);check();
   const saved=await sql.read(q.id);if(!saved||questionVersion(saved)!==questionVersion(after))throw new Error('source_changed');await this.currentOriginal(saved,await this.binding(q.id,sql),new AbortController().signal);check();return{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(saved)};
  });
 }
 private async authorize(sql:QuestionReviewSql,sessionId:string,runId?:string,studentId?:string){const r=(await sql.all(`SELECT s.student_id,t.status FROM ai_conversation_sessions s LEFT JOIN students t ON t.id=s.student_id WHERE s.id=? AND s.archived_at IS NULL`,[sessionId]))[0];if(!r||r.student_id&&r.status!=='active'||studentId!==undefined&&studentId!==String(r.student_id||''))throw new Error('permission_denied');
  if(runId){const run=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!run||String(run.student_id||'')!==String(r.student_id||''))throw new Error('permission_denied');}return String(r.student_id||'');}
 private async get(sql:QuestionReviewSql,sessionId:string,id:string,activeSession=true){const r=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type=?',[id,sessionId,ORIGINAL_REVIEW_ACTION]))[0];if(!r)throw new Error('permission_denied');if(activeSession)await this.authorize(sql,sessionId,String(r.run_id),String(r.student_id));
  const p=JSON.parse(String(r.payload_json)) as Payload;if(p.schemaVersion!==ORIGINAL_REVIEW_SCHEMA||p.studentId!==r.student_id||!validOriginalDraft(p.draft)||!validOriginalRegion({resourceId:p.image.resourceId,version:p.image.version,page:p.image.page,box:p.image.box})||!['pending','confirmed','rejected'].includes(String(r.status)))throw new Error('unavailable');return{r,p};}
 private effect(r:Record<string,unknown>,p:Payload){const e=JSON.parse(String(r.result_json)) as Effect;if(e.schemaVersion!==ORIGINAL_REVIEW_SCHEMA||e.complete!==true||!validOriginalDraft(e.draft)||e.digest!==hash({id:r.id,sessionId:r.session_id,runId:r.run_id,proposal:p,draft:e.draft,saved:e.saved}))throw new Error('unavailable');contextHistory(r,e);return e;}
 private async sourceCurrent(p:Payload,signal:AbortSignal){await this.materials().original(p.image.resourceId,p.image.version,signal);}
 async list(sessionId:string){await this.authorize(this.host,sessionId);const rows=await this.host.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id',[sessionId,ORIGINAL_REVIEW_ACTION]);const result=[];for(const r of rows){const {p}=await this.get(this.host,sessionId,String(r.id));result.push(summary(r,p));}return [...result,...await this.multi.list(sessionId)];}
 async propose(sessionId:string,runId:string,callId:string,draft:OriginalQuestionDraft,region:Pick<MaterialPreviewQuery,'resourceId'|'version'|'page'|'box'>,signal:AbortSignal,current:()=>boolean){
  if(!validOriginalDraft(draft)||draft.answer||draft.analysis||!validOriginalRegion(region)||!callId||callId.length>128)throw new Error('invalid_input');
  const check=()=>{signal.throwIfAborted();if(!current())throw new Error('cancelled');};check();await this.authorize(this.host,sessionId,runId);
  const prior=(await this.host.all(`SELECT id,payload_json FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ORIGINAL_REVIEW_ACTION,callId]))[0];
  if(prior){const {r,p}=await this.get(this.host,sessionId,String(prior.id));if(JSON.stringify(p.draft)!==JSON.stringify(draft)||JSON.stringify([p.image.resourceId,p.image.version,p.image.page,p.image.box])!==JSON.stringify([region.resourceId,region.version,region.page,region.box]))throw new Error('conflict');check();return summary(r,p);}
  const rendered=await previewMaterialPage(this.materials(),{schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),...region},signal,this.render),{dataUrl,...image}=rendered;check();
  await this.assets.put(image,Buffer.from(dataUrl.split(',')[1],'base64'),false,signal);check();const resource=await this.materials().resource(region.resourceId);
  return this.host.transaction(async sql=>{check();const studentId=await this.authorize(sql,sessionId,runId);await this.materials().original(region.resourceId,region.version,signal);const p:Payload={schemaVersion:ORIGINAL_REVIEW_SCHEMA,callId,studentId,draft,sourceTitle:resource.originalFileName,image};
   const old=(await sql.all(`SELECT * FROM ai_confirmation_items WHERE session_id=? AND run_id=? AND action_type=? AND json_extract(payload_json,'$.callId')=?`,[sessionId,runId,ORIGINAL_REVIEW_ACTION,callId]))[0];if(old){const parsed=JSON.parse(String(old.payload_json));if(hash({...parsed,image:{...parsed.image,requestId:''}})!==hash({...p,image:{...image,requestId:''}}))throw new Error('conflict');return summary(old,parsed);}
   const id='xioriginal_'+randomUUID(),at=new Date().toISOString();await sql.run(`INSERT INTO ai_confirmation_items (id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,ORIGINAL_REVIEW_ACTION,draft.title,JSON.stringify(p),at,at]);check();return summary((await this.get(sql,sessionId,id)).r,p);
  });
 }
 async review(sessionId:string,id:string):Promise<OriginalQuestionView>{const {r,p}=await this.get(this.host,sessionId,id),effect=r.status==='confirmed'?this.effect(r,p):undefined;const bytes=await this.assets.read(p.image,!!effect,new AbortController().signal);let sourceCurrent=true;try{await this.sourceCurrent(p,new AbortController().signal);}catch{sourceCurrent=false;}return{summary:summary(r,p),draft:effect?.draft||p.draft,sourceCurrent,sourceTitle:p.sourceTitle,image:{...p.image,dataUrl:'data:image/png;base64,'+bytes.toString('base64')},...(effect?{saved:effect.saved}:{})};}
 async decide(input:OriginalQuestionDecision,current:()=>boolean,afterWrite?:(current:()=>boolean)=>Promise<void>){return this.host.transaction(async sql=>{const check=()=>{if(!current())throw new Error('cancelled');};check();const {r,p}=await this.get(sql,input.sessionId,input.id);check();
  if(r.status!=='pending'){if(r.status==='rejected'&&input.action==='reject')return summary(r,p);if(r.status==='confirmed'&&input.action==='confirm'&&JSON.stringify(this.effect(r,p).draft)===JSON.stringify(input.draft))return summary(r,p);throw new Error('conflict');}
  const at=new Date().toISOString();if(input.action==='reject'){await sql.run(`UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'`,[at,at,input.id]);check();return summary((await this.get(sql,input.sessionId,input.id)).r,p);}
  const draft=input.draft;if(input.complete!==true||!validOriginalDraft(draft))throw new Error('invalid_input');await this.sourceCurrent(p,new AbortController().signal);check();await this.assets.promote(p.image,new AbortController().signal);check();
  const anchors=[{page:p.image.page,box:p.image.box}],document:QuestionDocument={schemaVersion:QUESTION_DOCUMENT_SCHEMA,source:{resourceId:p.image.resourceId,resourceVersion:p.image.version,parserVersion:'teacher-transcription.v1+'+p.image.engine,ocrVersion:''},blocks:[{id:'original',kind:'image',anchors,assetId:p.image.assetId,sha256:p.image.sha256,mime:'image/png',width:p.image.width,height:p.image.height},{id:'transcription',kind:'text',anchors,text:draft.stem}],answer:draft.answer.trim()?{origin:'teacher',text:draft.answer,anchors:[]}:{origin:'missing',text:'',anchors:[]},analysis:draft.analysis.trim()?{origin:'teacher',text:draft.analysis,anchors:[]}:{origin:'missing',text:'',anchors:[]}};
  if(!validQuestionDocument(document))throw new Error('invalid_input');
  const q=await sql.create({...draft,stem:document.blocks[1].kind==='text'?document.blocks[1].text:'',answer:document.answer.text,analysis:document.analysis.text,sourceKind:'teacher_resource',sourceTitle:p.sourceTitle,tags:['教师核对题面']});
  await sql.run('UPDATE question_bank_items SET document_json=?,stem=?,answer=?,analysis=? WHERE id=?',[JSON.stringify(document),draft.stem,document.answer.text,document.analysis.text,q.id]);const savedQ=await sql.read(q.id);if(!savedQ)throw new Error('unavailable');
  const saved:QuestionContextSource={schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(savedQ)},effect:Effect={schemaVersion:ORIGINAL_REVIEW_SCHEMA,complete:true,draft,saved,digest:hash({id:r.id,sessionId:r.session_id,runId:r.run_id,proposal:p,draft,saved})};
  await sql.run(`UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'`,[JSON.stringify(effect),at,at,input.id]);await afterWrite?.(current);await this.sourceCurrent(p,new AbortController().signal);await this.assets.read(p.image,true,new AbortController().signal);check();return summary((await this.get(sql,input.sessionId,input.id)).r,p);
 });}
 async questionImage(questionId:string,version:string){const q=await this.host.read(questionId);if(!q||questionVersion(q)!==version)throw new Error('source_changed');const rows=await this.host.all(`SELECT * FROM ai_confirmation_items WHERE action_type=? AND status='confirmed' AND json_extract(result_json,'$.saved.questionId')=?`,[ORIGINAL_REVIEW_ACTION,questionId]);
  // Main-frame teacher notebook owns approved canonical questions, including archived-chat history.
  // This local-only receipt is never a Pi/student/model context or authority to approve a pending item.
  if(rows.length!==1)throw new Error('permission_denied');const r=rows[0],{p}=await this.get(this.host,String(r.session_id),String(r.id),false),e=this.effect(r,p);if(latestOriginalVersion(r,e)!==version||q.document?.blocks[0].kind!=='image'||q.document.blocks[0].sha256!==p.image.sha256||q.document.blocks[0].assetId!==p.image.assetId)throw new Error('source_changed');return 'data:image/png;base64,'+(await this.assets.read(p.image,true,new AbortController().signal)).toString('base64');
 }
}
