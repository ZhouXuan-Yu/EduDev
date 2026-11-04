import {randomUUID} from 'node:crypto';
import type {QuestionContextQuery,QuestionContextSource} from '../../shared/question-context';
import type {SemanticCoverage} from '../../shared/retrieval';

export type QuestionSearchWindow={scope:string;sources:readonly (QuestionContextSource|undefined)[];semantic?:SemanticCoverage;excludedRecords?:number;candidateLimitReached?:boolean;incomplete?:boolean};
type Page={window:QuestionSearchWindow;offset:number};
export function questionSearchScope(query:QuestionContextQuery){
 return JSON.stringify(['query','subject','grade','knowledgePoint','questionType','difficulty','sourceKind'].map(key=>{
  const value=query[key as keyof QuestionContextQuery];return typeof value==='string'?value.trim():null;
 }));
}

/** Per-run discovery only: at most 32 cursors, each referring to an existing <=50-candidate window.
 * No question text, original images or successful-read authority is retained here. */
export function createQuestionSearchContinuation(){
 const pages=new Map<string,Page>();
 return {
  resolve(cursor:string,query:QuestionContextQuery){
   const page=pages.get(cursor);if(!page)throw Error('search_cursor_expired');
   if(page.window.scope!==questionSearchScope(query))throw Error('search_cursor_scope');
   return page;
  },
  prepare(window:QuestionSearchWindow,offset:number){
   if(window.sources.length>50||!Number.isSafeInteger(offset)||offset<1||offset>=window.sources.length)throw Error('invalid_input');
   const prior=[...pages].find(([,page])=>page.window===window&&page.offset===offset)?.[0];
   const cursor=prior??`qsearch_${randomUUID()}`;
   // The caller commits only after sanitization, final source checks and response-size validation.
   return {cursor,commit:()=>{
    if(prior)return;
    pages.set(cursor,{window,offset});
    if(pages.size>32)pages.delete(pages.keys().next().value!);
   }};
  }
 };
}
