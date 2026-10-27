import type {QuestionContextSource,QuestionContextPurpose} from '../../shared/question-context';
/** Main-owned, per-run discovery. Search discovery never grants successful-read authority. */
export type QuestionAliases=Map<string,{id:string;version:string;purpose?:QuestionContextPurpose}>;
export function prepareQuestionAliases(discovered:QuestionAliases,sources:readonly QuestionContextSource[],purpose?:QuestionContextPurpose){
 const next=new Map(discovered);
 const references=sources.map(source=>{
  const found=[...next].find(([,entry])=>entry.id===source.questionId&&entry.version===source.version&&entry.purpose===purpose)?.[0];
  if(found)return found;
  if(next.size>=64)throw Error('too_large');
  const reference=`题目${next.size+1}`;if(next.has(reference))throw Error('unavailable');
  next.set(reference,{id:source.questionId,version:source.version,...(purpose?{purpose}:{})});return reference;
 });
 // Call without an intervening await, only after size/schema/current-source checks.
 return{references,commit:()=>{for(const [reference,value]of next)discovered.set(reference,value);}};
}
