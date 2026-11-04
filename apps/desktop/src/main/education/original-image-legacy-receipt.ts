import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {QUESTION_CONTEXT_SCHEMA} from '../../shared/question-context';
import {QUESTION_DOCUMENT_SCHEMA} from '../../shared/question-document';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE,MATERIAL_PDF_MAX_PAGES} from '../../shared/material-page-preview';
import {ORIGINAL_REVIEW_ACTION,ORIGINAL_REVIEW_SCHEMA,validOriginalDraft,validOriginalRegion,
 type OriginalQuestionDraft} from '../../shared/original-question-review';
import type {OriginalImage} from '../assets/question-assets';
import {questionVersion} from './question-context-provider';

type Proposal={schemaVersion:typeof ORIGINAL_REVIEW_SCHEMA;callId:string;studentId:string;
 draft:OriginalQuestionDraft;sourceTitle:string;image:OriginalImage};
const keys=(v:unknown,names:string[]):v is Record<string,unknown>=>
 !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===names.sort().join();
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const identity=(value:unknown,prefix:string)=>typeof value==='string'&&new RegExp(`^${prefix}_${uuid}$`).test(value);

/** Only the historic, confirmed single-image receipt. Never grants complete context or write authority.
 * A non-legacy shape must still pass the repository's unchanged modern effect validator.
 */
export function legacyOriginalImageReceipt(row:Record<string,unknown>,proposal:Proposal,
 question:QuestionBankItem,version:string):boolean{
 const effect:unknown=JSON.parse(String(row.result_json));
 if(!keys(effect,['draft','saved','digest']))return false;
 if(row.status!=='confirmed'||row.action_type!==ORIGINAL_REVIEW_ACTION||
  !identity(row.id,'xioriginal')||!identity(row.session_id,'aisession')||!identity(row.run_id,'run')){
  throw new Error('permission_denied');
 }
 const image=proposal.image,saved=effect.saved;
 if(proposal.schemaVersion!==ORIGINAL_REVIEW_SCHEMA||proposal.studentId!==row.student_id||
  !validOriginalDraft(proposal.draft)||!validOriginalDraft(effect.draft)||!sha(effect.digest)||
  !keys(saved,['schemaVersion','questionId','version'])||saved.schemaVersion!==QUESTION_CONTEXT_SCHEMA||
  !identity(saved.questionId,'question')||!sha(saved.version)||
  !keys(image,['schemaVersion','ok','requestId','resourceId','version','engine','assetId','page','total',
   'box','width','height','sha256'])||image.schemaVersion!==MATERIAL_PREVIEW_SCHEMA||image.ok!==true||
  typeof image.requestId!=='string'||!new RegExp(`^${uuid}$`).test(image.requestId)||
  image.engine!==PDF_PAGE_ENGINE||!identity(image.assetId,'asset')||!sha(image.sha256)||
  !validOriginalRegion({resourceId:image.resourceId,version:image.version,page:image.page,box:image.box})||
  !Number.isInteger(image.total)||image.total<image.page||image.total>MATERIAL_PDF_MAX_PAGES||
  ![image.width,image.height].every(v=>Number.isInteger(v)&&v>=1&&v<=2401)){
  throw new Error('unavailable');
 }
 const digest=createHash('sha256').update(JSON.stringify({id:row.id,sessionId:row.session_id,
  runId:row.run_id,proposal,draft:effect.draft,saved})).digest('hex');
 if(effect.digest!==digest)throw new Error('unavailable');
 const document=question.document,block=document?.blocks[0];
 if(saved.questionId!==question.id||saved.version!==version||questionVersion(question)!==version||
  question.sourceKind!=='teacher_resource'||document?.schemaVersion!==QUESTION_DOCUMENT_SCHEMA||
  document.source.resourceId!==image.resourceId||document.source.resourceVersion!==image.version||
  document.source.parserVersion!==`teacher-transcription.v1+${image.engine}`||
  document.blocks.length!==2||block?.id!=='original'||block.kind!=='image'||
  block.assetId!==image.assetId||block.sha256!==image.sha256||block.mime!=='image/png'||
  block.width!==image.width||block.height!==image.height||
  JSON.stringify(block.anchors)!==JSON.stringify([{page:image.page,box:image.box}])){
  throw new Error('source_changed');
 }
 return true;
}
