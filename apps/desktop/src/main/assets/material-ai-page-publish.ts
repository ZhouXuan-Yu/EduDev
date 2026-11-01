import {pageCropAgrees,pageCropDocument,type PageCrop} from './material-ai-page-crops';
import {createHash} from 'node:crypto';
import {archiveMissing,QUESTION_PAGE_ARCHIVE_SCHEMA,type QuestionArchive} from '../../shared/question-archive';
import {pageQuestionEvidence,pageTranscriptionAgrees,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {aiTextSignature,type AiImageQuestion} from '../../shared/material-ai-image';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {restoredPageQuestions} from './material-ai-page-content';
import type {MaterialSource} from '../../shared/materials';
import type {ExtractedQuestion} from './material-question-extract';
import type {RuleOrigin} from './material-question-origins';
import {nonQuestionPagePurpose} from './material-page-purpose';
import {bookAnswerPage} from './material-book-answer-content';
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;run:(sql:string,p?:(string|number|null)[])=>Promise<void>;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;associate?:(q:QuestionBankItem,origin:RuleOrigin)=>Promise<void>};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const normalized=aiTextSignature;
export function assessAiPage(first:AiPageResponse,final:AiPageResponse,source:MaterialPageSource,answerBook=false,prompt?:AiPagePrompt){
 const numbered=answerBook?[]:restoredPageQuestions(final.pageText,source,final.questions.map(q=>q.number),prompt),omitted=numbered.some(c=>!final.questions.some(q=>q.number===c.number));
 const unstructured=!answerBook&&final.outcome==='no_questions'&&!numbered.length&&/[?？]|求|计算|解方程/.test(final.pageText);
 const answers=answerBook?bookAnswerPage(first,final):undefined;
 const answerReview=!!answers&&(answers.status==='too_large'||answers.status==='unstructured'&&!!(first.pageText||final.pageText)||answers.pageUncertain||answers.firstOnly.length>0||answers.entries.some(e=>!e.agrees||e.issues.some(i=>i!=='missing_analysis')));
 return{numbered,omitted,review:answerReview||omitted||unstructured||final.outcome==='needs_review'||!pageTranscriptionAgrees(first,final)};
}
export function aiPageQuestionIssues(first:AiPageResponse,final:AiPageResponse,source:MaterialPageSource,imageSha:string,q:AiImageQuestion,prompt?:AiPagePrompt,crops:PageCrop[]=[],following:'separate'|'continued'|'unknown'='separate'){
 const assessment=assessAiPage(first,final,source,false,prompt),candidate=assessment.numbered.find(c=>c.number===q.number),evidence=candidate&&!candidate.risks.length?pageQuestionEvidence(first,final,q.number,imageSha,candidate.fields.stem,prompt):undefined;
 const visual=!!candidate&&!candidate.risks.some(r=>r!=='visual_unchecked')&&pageCropAgrees(first,final,q.number,crops,candidate.fields.stem,prompt);
 const issues=[...q.issues.filter(i=>!visual||i!=='requires_image'),...archiveMissing(q)];if(assessment.review||!evidence&&!visual)issues.push('ai_mismatch');
 if(q.number===final.questions.at(-1)?.number&&following!=='separate')issues.push(following==='continued'?'cross_page':'incomplete_question');
 if(!visual&&(q.requiresImage||q.projection.figures.state!=='not_applicable'))issues.push('requires_image');
 if(!candidate||candidate.risks.some(r=>!visual||r!=='visual_unchecked')||normalized(candidate.fields.stem)!==normalized(q.stem))issues.push('incomplete_question');
 for(const role of ['answer','analysis'] as const)if(q[`${role}Origin`]==='source'&&(!candidate||!candidate.fields[role]||normalized(candidate.fields[role]!)!==normalized(q[role])))issues.push('answer_conflict');
 return [...new Set(issues)];
}
/** Called only inside the original executor's guarded writer transaction. */
export async function publishAiPage(host:Host,args:{batchId:string;ordinal:number;source:MaterialPageSource;sources:MaterialSource[];originalQuestions:ExtractedQuestion[];firstRaw:string;finalRaw:string;first:AiPageResponse;final:AiPageResponse;imageSha:string;title:string;model:string;answerBook?:boolean;pagePrompt?:AiPagePrompt;crops?:PageCrop[];following?:'separate'|'continued'|'unknown'}){
 const {batchId,ordinal,source,firstRaw,finalRaw,first,final,imageSha}=args;
 const slot=(await host.all('SELECT source_json FROM material_ai_page_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];if(slot?.source_json!==JSON.stringify(source)||!/^[a-f0-9]{64}$/.test(imageSha))throw Error('source_changed');
 if(args.answerBook&&(first.questions.length||final.questions.length||first.outcome==='questions'||final.outcome==='questions'))throw Error('invalid_response');
 if((first.questions.length||final.questions.length)&&(nonQuestionPagePurpose(first.pageText)||nonQuestionPagePurpose(final.pageText)))throw Error('invalid_response');
 const assessment=assessAiPage(first,final,source,args.answerBook,args.pagePrompt);let review=assessment.review;
 await host.run('UPDATE material_ai_page_units SET first_sha=?,final_sha=?,image_sha=? WHERE batch_id=? AND ordinal=?',[hash(firstRaw),hash(finalRaw),imageSha,batchId,ordinal]);
 for(const q of final.questions){
  const unique=aiPageQuestionIssues(first,final,source,imageSha,q,args.pagePrompt,args.crops,args.following);review||=!!unique.length;
  const candidate=assessment.numbered.find(c=>c.number===q.number),crop=args.crops?.find(c=>c.number===q.number),visual=!!crop&&!!candidate&&!candidate.risks.some(r=>r!=='visual_unchecked')&&pageCropAgrees(first,final,q.number,args.crops!,candidate.fields.stem,args.pagePrompt);
  const document=visual?pageCropDocument(q,crop!,batchId,args.model):undefined;
  const archive:QuestionArchive={schemaVersion:QUESTION_PAGE_ARCHIVE_SCHEMA,extractor:'ai-page-two-pass.v1',state:unique.length?'ai_needs_review':'ai_final',number:q.number,sources:args.sources,pageSource:source,issues:unique,sourceRisks:q.requiresImage&&!visual?['visual_unchecked']:[],sourceChecked:false,answerOrigin:q.answerOrigin,analysisOrigin:q.analysisOrigin,ai:{batchId,ordinal,provider:'deepseek',model:args.model,firstSha:hash(firstRaw),finalSha:hash(finalRaw),imageSha,policy:visual?'page-crop-complete.v1':'page-image-complete.v1'}};
  const {projection:_,...fields}=q,saved=await host.create({...fields,sourceTitle:args.title,sourceKind:'teacher_resource',tags:['AI整理','AI原页还原',...(q.answerOrigin==='ai_generated'?['AI推导答案']:[])]});
  await host.run('UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=?',[JSON.stringify(archive),document?JSON.stringify(document):'',saved.id]);await host.run('INSERT INTO material_ai_members(batch_id,ordinal,number,question_id) VALUES(?,?,?,?)',[batchId,ordinal,q.number,saved.id]);
  const original=args.originalQuestions.find(c=>c.archive.number===q.number);if(original)await host.associate?.({...saved,archive},{sources:original.archive.sources,number:original.archive.number,stem:original.fields.stem,risks:original.archive.sourceRisks});
 }
 await host.run("UPDATE material_ai_units SET status=?,final_json=?,error=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[review?'review':final.outcome==='no_questions'?'no_questions':'complete',finalRaw,assessment.omitted?'ai_omitted_questions':review?'page_content_incomplete':'',batchId,ordinal]);
}
