/** Local original-question representation; validity is structural, never a correctness/approval claim. */
import {QUESTION_PROJECTION_SCHEMA,validQuestionProjection,type QuestionProjection} from './question-projection';
import {validBookDocumentProof,type BookDocumentProof} from './question-book-document';
import {QUESTION_WEB_EVIDENCE_SCHEMA,validQuestionWebEvidence,type WebAnswerRoleProof} from './question-web-answer';
export const QUESTION_DOCUMENT_SCHEMA='xiaozhi.question-document.v1' as const;
export const QUESTION_DOCUMENT_COMPLETE_SCHEMA='xiaozhi.question-document.v2' as const;
export const QUESTION_DOCUMENT_BOOK_SCHEMA='xiaozhi.question-document.v3' as const;
export const QUESTION_DOCUMENT_WEB_SCHEMA='xiaozhi.question-document.web.v1' as const;
export const QUESTION_DOCUMENT_MAX_BYTES=128*1024;
export type QuestionAnchor={page:number;box:[number,number,number,number]};
type BlockBase={id:string;anchors:QuestionAnchor[]};
export type QuestionBlock=BlockBase&(
 |{kind:'text'|'latex';text:string}
 |{kind:'image';assetId:string;sha256:string;mime:'image/png'|'image/jpeg';width:number;height:number}
 |{kind:'table';rows:{kind:'text'|'latex';text:string}[][]}
 |{kind:'choices';options:{label:string;blocks:QuestionBlock[]}[]}
 |{kind:'subquestion';label:string;blocks:QuestionBlock[]}
);
export type QuestionEvidence={origin:'source'|'teacher'|'missing';text:string;anchors:QuestionAnchor[]}
 |{origin:'ai_generated';text:string;anchors:QuestionAnchor[];generator:{provider:string;model:string;runId:string}}
 |{origin:'book_extracted';text:string;anchors:[];book:BookDocumentProof}
 |{origin:'web_extracted';text:string;anchors:[];web:WebAnswerRoleProof};
type QuestionDocumentBase={source:{resourceId:string;resourceVersion:string;parserVersion:string;ocrVersion:string};blocks:QuestionBlock[];answer:QuestionEvidence;analysis:QuestionEvidence};
export const QUESTION_TEXT_PRESENTATION_SCHEMA='xiaozhi.question-text-presentation.v1' as const;
export type QuestionTextPresentation={schemaVersion:typeof QUESTION_TEXT_PRESENTATION_SCHEMA;mode:'teacher_text'|'needs_review';figureBlockIds:string[]};
export type QuestionDocument=QuestionDocumentBase&({schemaVersion:typeof QUESTION_DOCUMENT_SCHEMA}|{schemaVersion:typeof QUESTION_DOCUMENT_COMPLETE_SCHEMA|typeof QUESTION_DOCUMENT_BOOK_SCHEMA|typeof QUESTION_DOCUMENT_WEB_SCHEMA;context:{schemaVersion:typeof QUESTION_PROJECTION_SCHEMA;projection:QuestionProjection;sourceBlockIds:string[];presentation?:QuestionTextPresentation}});
export type CompleteQuestionDocument=Extract<QuestionDocument,{context:unknown}>;
export function isCompleteQuestionDocument(v:QuestionDocument|undefined):v is CompleteQuestionDocument{return !!v&&(v.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA||v.schemaVersion===QUESTION_DOCUMENT_BOOK_SCHEMA||v.schemaVersion===QUESTION_DOCUMENT_WEB_SCHEMA);}
export function hasTeacherTextPresentation(v:QuestionDocument|undefined):v is CompleteQuestionDocument&{context:{presentation:QuestionTextPresentation&{mode:'teacher_text'}}}{return isCompleteQuestionDocument(v)&&v.context.presentation?.mode==='teacher_text';}
/** Preserve both independent role sources; teacher removal of the last proof returns to the complete schema. */
export function questionDocumentSchemaForRoles(v:Pick<QuestionDocument,'answer'|'analysis'>){return [v.answer,v.analysis].some(e=>e.origin==='web_extracted')?QUESTION_DOCUMENT_WEB_SCHEMA:[v.answer,v.analysis].some(e=>e.origin==='book_extracted')?QUESTION_DOCUMENT_BOOK_SCHEMA:QUESTION_DOCUMENT_COMPLETE_SCHEMA;}
type ObjectValue=Record<string,unknown>;
const object=(v:unknown):v is ObjectValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:unknown,names:string[]):v is ObjectValue=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const string=(v:unknown,max:number,min=1):v is string=>typeof v==='string'&&v.length>=min&&v.length<=max&&!/[\u0000]/.test(v);
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const identifier=(v:unknown,prefix:string)=>typeof v==='string'&&new RegExp(`^${prefix}_${uuid}$`).test(v);

/** Inspect descriptors before accessing values: no getters, prototypes, sparse arrays, cycles or hidden fields. */
function safeTree(v:unknown,seen:Set<object>,budget:{nodes:number;bytes:number},depth=0):boolean{
 if(++budget.nodes>12000||depth>24)return false;
 if(v===null||typeof v==='boolean')return true;
 if(typeof v==='string'){if(v.length>QUESTION_DOCUMENT_MAX_BYTES)return false;budget.bytes+=new TextEncoder().encode(v).byteLength;return budget.bytes<=QUESTION_DOCUMENT_MAX_BYTES;}
 if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||seen.has(v))return false;
 const proto=Object.getPrototypeOf(v),array=Array.isArray(v);
 if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);
 if(names.some(k=>typeof k!=='string'||k.length>256))return false;
 if(array&&(v.length>12000||names.length!==v.length+1))return false;
 seen.add(v);
 for(const name of names){
  if(array&&name==='length')continue;
  const d=descriptors[name as string];
  if(!('value' in d)||!d.enumerable||(array&&!/^(0|[1-9][0-9]*)$/.test(name as string))||!safeTree(d.value,seen,budget,depth+1))return false;
 }
 seen.delete(v);return true;
}
function anchors(v:unknown,required=true):v is QuestionAnchor[]{
 return Array.isArray(v)&&v.length>=(required?1:0)&&v.length<=16&&v.every(a=>
  keys(a,['page','box'])&&integer(a.page,1,100000)&&Array.isArray(a.box)&&a.box.length===4&&
  a.box.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&a.box[0]<a.box[2]&&a.box[1]<a.box[3]);
}
function evidence(v:unknown,bookAllowed=false,webAllowed=false):v is QuestionEvidence{
 if(!object(v))return false;
 if(v.origin==='web_extracted')return webAllowed&&keys(v,['origin','text','anchors','web'])&&string(v.text,32000)&&Array.isArray(v.anchors)&&v.anchors.length===0&&validQuestionWebEvidence({schemaVersion:QUESTION_WEB_EVIDENCE_SCHEMA,base:'ai',roles:{answer:v.web}})&&(v.web as WebAnswerRoleProof).kind==='web_extracted';
 if(v.origin==='book_extracted')return bookAllowed&&keys(v,['origin','text','anchors','book'])&&string(v.text,32000)&&Array.isArray(v.anchors)&&v.anchors.length===0&&validBookDocumentProof(v.book);
 const generated=v.origin==='ai_generated';
 if(!keys(v,generated?['origin','text','anchors','generator']:['origin','text','anchors'])||!anchors(v.anchors,v.origin==='source'))return false;
 if(v.origin==='missing')return v.text===''&&(v.anchors as unknown[]).length===0;
 if(!['source','teacher','ai_generated'].includes(String(v.origin))||!string(v.text,32000))return false;
 if(generated)return keys(v.generator,['provider','model','runId'])&&string(v.generator.provider,128)&&string(v.generator.model,128)&&string(v.generator.runId,128);
 return true;
}
function blocks(v:unknown,ids:Set<string>,depth=0):v is QuestionBlock[]{
 if(depth>3||!Array.isArray(v)||!v.length||v.length>256)return false;
 return v.every(b=>{
  if(!object(b)||!string(b.id,64)||!/^[a-zA-Z0-9_-]+$/.test(b.id)||ids.has(b.id)||ids.size>=256||!anchors(b.anchors))return false;
  ids.add(b.id);const base=['id','kind','anchors'];
  switch(b.kind){
   case 'text':case 'latex':return keys(b,[...base,'text'])&&string(b.text,16000);
   case 'image':return keys(b,[...base,'assetId','sha256','mime','width','height'])&&identifier(b.assetId,'asset')&&sha(b.sha256)&&['image/png','image/jpeg'].includes(String(b.mime))&&integer(b.width,1,16000)&&integer(b.height,1,16000)&&(b.width as number)*(b.height as number)<=16000000;
   case 'table':{
    if(!keys(b,[...base,'rows'])||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>64)return false;
    const width=Array.isArray(b.rows[0])?b.rows[0].length:0;
    return width>0&&width<=32&&b.rows.every(row=>Array.isArray(row)&&row.length===width&&row.every(c=>keys(c,['kind','text'])&&['text','latex'].includes(String(c.kind))&&string(c.text,2000,0)));
   }
   case 'choices':{
    if(!keys(b,[...base,'options'])||!Array.isArray(b.options)||b.options.length<2||b.options.length>8)return false;
    const labels=new Set<string>();return b.options.every(o=>keys(o,['label','blocks'])&&typeof o.label==='string'&&/^[A-H]$/.test(o.label)&&!labels.has(o.label)&&(labels.add(o.label),blocks(o.blocks,ids,depth+1)));
   }
   case 'subquestion':return keys(b,[...base,'label','blocks'])&&string(b.label,32)&&blocks(b.blocks,ids,depth+1);
   default:return false;
  }
 });
}
export function validQuestionDocument(v:unknown):v is QuestionDocument{
 try{
  if(!safeTree(v,new Set(),{nodes:0,bytes:0})||!object(v))return false;
  const web=v.schemaVersion===QUESTION_DOCUMENT_WEB_SCHEMA,book=v.schemaVersion===QUESTION_DOCUMENT_BOOK_SCHEMA,complete=web||book||v.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA;
  if(!keys(v,complete?['schemaVersion','source','blocks','answer','analysis','context']:['schemaVersion','source','blocks','answer','analysis'])||!complete&&v.schemaVersion!==QUESTION_DOCUMENT_SCHEMA)return false;
  if(!keys(v.source,['resourceId','resourceVersion','parserVersion','ocrVersion'])||!identifier(v.source.resourceId,'resource')||!sha(v.source.resourceVersion)||!string(v.source.parserVersion,128)||!string(v.source.ocrVersion,128,0))return false;
  if(!blocks(v.blocks,new Set())||!evidence(v.answer,book||web,web)||!evidence(v.analysis,book||web,web))return false;
  if(book&&[v.answer,v.analysis].every(e=>e.origin!=='book_extracted'))return false;
  if(web&&[v.answer,v.analysis].every(e=>e.origin!=='web_extracted'))return false;
  if(complete){
   const c=v.context;
   if(!keys(c,object(c)&&Object.hasOwn(c,'presentation')?['schemaVersion','projection','sourceBlockIds','presentation']:['schemaVersion','projection','sourceBlockIds'])||c.schemaVersion!==QUESTION_PROJECTION_SCHEMA||!validQuestionProjection(c.projection,true)||!Array.isArray(c.sourceBlockIds)||!c.sourceBlockIds.length||c.sourceBlockIds.length>8||new Set(c.sourceBlockIds).size!==c.sourceBlockIds.length||!c.sourceBlockIds.every(id=>typeof id==='string'&&(v.blocks as QuestionBlock[]).some(b=>b.kind==='image'&&b.id===id)))return false;
   if(Object.hasOwn(c,'presentation')){
    const p=c.presentation;
    if(!keys(p,['schemaVersion','mode','figureBlockIds'])||p.schemaVersion!==QUESTION_TEXT_PRESENTATION_SCHEMA||!['teacher_text','needs_review'].includes(String(p.mode))||!Array.isArray(p.figureBlockIds)||p.figureBlockIds.length>8||new Set(p.figureBlockIds).size!==p.figureBlockIds.length||!p.figureBlockIds.every(id=>(c.sourceBlockIds as string[]).includes(id))||p.mode==='needs_review'&&p.figureBlockIds.length)return false;
    if(p.mode==='teacher_text'&&((c.projection as QuestionProjection).figures.state==='provided'?p.figureBlockIds.length===0:p.figureBlockIds.length!==0))return false;
   }
  }
  return new TextEncoder().encode(JSON.stringify(v)).byteLength<=QUESTION_DOCUMENT_MAX_BYTES;
 }catch{return false;}
}
/** Absent old-column value stays absent. Corrupt/unknown versions never fall back to legacy facts. */
export function readQuestionDocument(value:unknown):QuestionDocument|undefined{
 if(value===undefined||value==='')return undefined;
 if(typeof value!=='string'||value.length>QUESTION_DOCUMENT_MAX_BYTES||new TextEncoder().encode(value).byteLength>QUESTION_DOCUMENT_MAX_BYTES)throw new Error('question_document_invalid');
 let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new Error('question_document_invalid');}
 if(!validQuestionDocument(parsed))throw new Error('question_document_invalid');return parsed;
}
