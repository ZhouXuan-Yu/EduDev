import {bookAnswerPage,bookSectionAt,bookSectionKey} from './material-book-answer-content';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import type {MaterialBookAnswerIndex} from './material-book-answer-index';
import {sameMaterialBookIdentity} from '../../shared/material-book-pair';
import {MATERIAL_BOOK_PAGE_CONTINUED_TABLE_POLICY,pageTranscriptionAgrees} from '../../shared/material-ai-page';
import type {BookAnswerPage} from '../../shared/material-book-answer';
import type {ShanghaiMockSectionPolicy} from '../../shared/shanghai-mock-sections';

type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;
export const BOOK_SECTION_CONTEXT='xiaozhi.book-section-context.v1' as const;
export const BOOK_ANSWER_SECTION_CONTEXT='xiaozhi.book-answer-section-context.v1' as const;
export const BOOK_SECTION_LOOKBACK=32;
type Page={batchId:string;ordinal:number;source:NonNullable<Proof['unit']['pageSource']>;firstSha:string;finalSha:string;imageSha:string};
export type BookQuestionSectionEvidence={schemaVersion:typeof BOOK_SECTION_CONTEXT;section:string;pages:Page[]};
export type BookAnswerSectionEvidence={schemaVersion:typeof BOOK_ANSWER_SECTION_CONTEXT;section:string;pages:Page[]};
type Host={receipt:(batch:string,ordinal:number)=>Promise<Proof>};
function numbers(proof:Proof,section:string|undefined,mockTitles:ShanghaiMockSectionPolicy){
 const read=(response:Proof['first'])=>bookAnswerPage(response,response,undefined,proof.unit.bookPagePolicy,mockTitles).entries.filter(e=>section===undefined?!e.section:e.sectionKey===bookSectionKey(section)).map(e=>Number(e.number));
 const a=read(proof.first),b=read(proof.final);
 return JSON.stringify(a)===JSON.stringify(b)&&b.every((n,i)=>n>0&&(!i||n>b[i-1]))?b:undefined;
}
function cleanContinuityPage(proof:Proof,page:BookAnswerPage,mockTitles:ShanghaiMockSectionPolicy){
 return proof.first.outcome==='no_questions'&&proof.final.outcome==='no_questions'&&
  pageTranscriptionAgrees(proof.first,proof.final)&&page.status==='compared'&&
  !page.pageUncertain&&!page.unresolvedTables&&!page.firstOnly.length&&
  !proof.final.pageText.split('\n').some(line=>{
   const text=line.trim().replace(/^#{1,6}\s*/u,'').normalize('NFKC');
   return /^(?:[^。！？?]{0,15})\d{4}(?:年|学年|年度)[^。！？?]{1,64}(?:考试|试卷|试题|真题)[^。！？?]{0,20}$/u.test(text)&&bookSectionAt(text,undefined,mockTitles)===undefined;
  })&&page.entries.every(entry=>
   entry.agrees&&entry.issues.every(issue=>issue==='missing_section'||issue==='missing_analysis'));
}
/** Derived context only. Original paid transcripts and canonical question text are untouched. */
export class MaterialBookQuestionSection{
 constructor(private host:Host,private index:MaterialBookAnswerIndex,private mockTitles:ShanghaiMockSectionPolicy=true){}
 async resolve(current:Proof,signal=new AbortController().signal):Promise<BookQuestionSectionEvidence|undefined>{
  return this.resolveRole(current,false,signal) as Promise<BookQuestionSectionEvidence|undefined>;
 }
 async resolveAnswer(current:Proof,signal=new AbortController().signal):Promise<BookAnswerSectionEvidence|undefined>{
  return this.resolveRole(current,true,signal) as Promise<BookAnswerSectionEvidence|undefined>;
 }
 async answerPage(current:Proof,signal?:AbortSignal){
  const raw=bookAnswerPage(current.first,current.final,undefined,current.unit.bookPagePolicy,this.mockTitles);
  const context=process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE!=='0'&&raw.entries.some(e=>!e.section)?await this.resolveAnswer(current,signal):undefined;
  return{page:context?bookAnswerPage(current.first,current.final,context.section,current.unit.bookPagePolicy,this.mockTitles):raw,context};
 }
 private async resolveRole(current:Proof,answers:boolean,signal:AbortSignal):Promise<BookQuestionSectionEvidence|BookAnswerSectionEvidence|undefined>{
  const source=current.unit.pageSource;if(!source||source.page<=1||(current.unit.bookRole?.kind==='answers')!==answers)return;
  const raw=answers&&current.unit.bookPagePolicy===MATERIAL_BOOK_PAGE_CONTINUED_TABLE_POLICY?
   bookAnswerPage(current.first,current.final,undefined,current.unit.bookPagePolicy,this.mockTitles):undefined;
  const continuedKey=raw?.leadingKeyContinuation===true;
  if(raw?.leadingKeyContinuation&&!cleanContinuityPage(current,raw,this.mockTitles))return;
  const leading=numbers(current,undefined,this.mockTitles);if(!leading?.length)return;let nextNumber=leading[0];
  const markers=await this.index.sectionPages(source.resourceId,source.version,source.page,BOOK_SECTION_LOOKBACK),pages:Page[]=[];
  let expected=source.page-1;
  for(const marker of markers){
   signal.throwIfAborted();if(Number(marker.page)!==expected--)return;
   let proof:Proof;
   try{proof=await this.host.receipt(String(marker.batch_id),Number(marker.ordinal));}
   catch(error){if(error instanceof Error&&['source_changed','source_incomplete','privacy_blocked'].includes(error.message))return;throw error;}
   const previous=proof.unit.pageSource;
   if(!previous||previous.resourceId!==source.resourceId||previous.version!==source.version||previous.generation!==source.generation||previous.page!==Number(marker.page)||(proof.unit.bookRole?.kind==='answers')!==answers||answers&&!sameMaterialBookIdentity(proof.unit.bookRole,current.unit.bookRole)||proof.first.pageIssues.length||proof.final.pageIssues.length)return;
   pages.push({batchId:String(marker.batch_id),ordinal:Number(marker.ordinal),source:structuredClone(previous),firstSha:proof.firstSha,finalSha:proof.finalSha,imageSha:proof.imageSha});
   const first=bookSectionAt(proof.first.pageText,undefined,this.mockTitles),final=bookSectionAt(proof.final.pageText,undefined,this.mockTitles);
   if(first===''||final===''||(first===undefined)!==(final===undefined))return;
   const previousNumbers=numbers(proof,final,this.mockTitles);
   if(!previousNumbers||previousNumbers.length&&previousNumbers.at(-1)!>=nextNumber)return;
   if(continuedKey||answers&&proof.unit.bookPagePolicy===MATERIAL_BOOK_PAGE_CONTINUED_TABLE_POLICY){
    const previousPage=bookAnswerPage(proof.first,proof.final,undefined,proof.unit.bookPagePolicy,this.mockTitles);
    if(continuedKey&&(!cleanContinuityPage(proof,previousPage,this.mockTitles)||previousNumbers.at(-1)!==nextNumber-1)||
      !continuedKey&&previousPage.leadingKeyContinuation)return;
   }
   if(previousNumbers.length)nextNumber=previousNumbers[0];
   if(first!==undefined&&final!==undefined){
    if(bookSectionKey(first)!==bookSectionKey(final))return;
    return{schemaVersion:answers?BOOK_ANSWER_SECTION_CONTEXT:BOOK_SECTION_CONTEXT,section:final,pages};
   }
  }
 }
 async validate(evidence:BookQuestionSectionEvidence,current:Proof,signal?:AbortSignal){
  const source=current.unit.pageSource;if(!source)throw Error('source_changed');
  if(await this.index.bookPending(source.resourceId,source.version))throw Error('source_incomplete');
  const actual=await this.resolve(current,signal);
  if(!actual||JSON.stringify(actual)!==JSON.stringify(evidence))throw Error('source_changed');
 }
 async validateAnswer(evidence:BookAnswerSectionEvidence,current:Proof,reference:{batchId:string;ordinal:number},signal?:AbortSignal){
  const source=current.unit.pageSource;if(!source)throw Error('source_changed');
  if(await this.index.bookPending(source.resourceId,source.version))throw Error('source_incomplete');
  const marker=await this.index.latestPage(source.resourceId,source.version,source.page);
  if(!marker?.proof_sha||marker.batch_id!==reference.batchId||Number(marker.ordinal)!==reference.ordinal)throw Error('source_changed');
  const actual=await this.resolveAnswer(current,signal);
  if(!actual||JSON.stringify(actual)!==JSON.stringify(evidence))throw Error('source_changed');
 }
}
