import {bookAnswerPage,bookSectionAt,bookSectionKey} from './material-book-answer-content';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import type {MaterialBookAnswerIndex} from './material-book-answer-index';

type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;
export const BOOK_SECTION_CONTEXT='xiaozhi.book-section-context.v1' as const;
export const BOOK_SECTION_LOOKBACK=32;
type Page={batchId:string;ordinal:number;source:NonNullable<Proof['unit']['pageSource']>;firstSha:string;finalSha:string;imageSha:string};
export type BookQuestionSectionEvidence={schemaVersion:typeof BOOK_SECTION_CONTEXT;section:string;pages:Page[]};
type Host={receipt:(batch:string,ordinal:number)=>Promise<Proof>};
function numbers(proof:Proof,section:string|undefined){
 const read=(response:Proof['first'])=>bookAnswerPage(response,response).entries.filter(e=>section===undefined?!e.section:e.sectionKey===bookSectionKey(section)).map(e=>Number(e.number));
 const a=read(proof.first),b=read(proof.final);
 return JSON.stringify(a)===JSON.stringify(b)&&b.every((n,i)=>n>0&&(!i||n>b[i-1]))?b:undefined;
}
/** Derived context only. Original paid transcripts and canonical question text are untouched. */
export class MaterialBookQuestionSection{
 constructor(private host:Host,private index:MaterialBookAnswerIndex){}
 async resolve(current:Proof,signal=new AbortController().signal):Promise<BookQuestionSectionEvidence|undefined>{
  const source=current.unit.pageSource;if(!source||source.page<=1||current.unit.bookRole?.kind==='answers')return;
  const leading=numbers(current,undefined);if(!leading?.length)return;let nextNumber=leading[0];
  const markers=await this.index.sectionPages(source.resourceId,source.version,source.page,BOOK_SECTION_LOOKBACK),pages:Page[]=[];
  let expected=source.page-1;
  for(const marker of markers){
   signal.throwIfAborted();if(Number(marker.page)!==expected--)return;
   let proof:Proof;
   try{proof=await this.host.receipt(String(marker.batch_id),Number(marker.ordinal));}
   catch(error){if(error instanceof Error&&['source_changed','source_incomplete','privacy_blocked'].includes(error.message))return;throw error;}
   const previous=proof.unit.pageSource;
   if(!previous||previous.resourceId!==source.resourceId||previous.version!==source.version||previous.generation!==source.generation||previous.page!==Number(marker.page)||proof.unit.bookRole?.kind==='answers'||proof.first.pageIssues.length||proof.final.pageIssues.length)return;
   pages.push({batchId:String(marker.batch_id),ordinal:Number(marker.ordinal),source:structuredClone(previous),firstSha:proof.firstSha,finalSha:proof.finalSha,imageSha:proof.imageSha});
   const first=bookSectionAt(proof.first.pageText),final=bookSectionAt(proof.final.pageText);
   if(first===''||final===''||(first===undefined)!==(final===undefined))return;
   const previousNumbers=numbers(proof,final);
   if(!previousNumbers||previousNumbers.length&&previousNumbers.at(-1)!>=nextNumber)return;
   if(previousNumbers.length)nextNumber=previousNumbers[0];
   if(first!==undefined&&final!==undefined){
    if(bookSectionKey(first)!==bookSectionKey(final))return;
    return{schemaVersion:BOOK_SECTION_CONTEXT,section:final,pages};
   }
  }
 }
 async validate(evidence:BookQuestionSectionEvidence,current:Proof,signal?:AbortSignal){
  // Dirty or newly published pages must not let a stale title authorize a write/read.
  if(await this.index.pending())throw Error('source_incomplete');
  const actual=await this.resolve(current,signal);
  if(!actual||JSON.stringify(actual)!==JSON.stringify(evidence))throw Error('source_changed');
 }
}
