import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {questionContentIdentity} from '../../shared/question-identity';
import {validPaperBlueprint,generatedPaperCount,type PaperBlueprint,type PaperSelection,type PaperSection,type PaperGeneration} from '../../shared/paper-blueprint';
import {QUESTION_CONTEXT_SCHEMA} from '../../shared/question-context';
import {questionFacts,questionVersion} from './question-context-provider';
export type PaperCandidate={id:string;question?:QuestionBankItem};
export type PaperSelectionHost={page:(blueprint:PaperBlueprint,after:string)=>Promise<PaperCandidate[]>;read:(id:string)=>Promise<QuestionBankItem|undefined>;validate:(q:QuestionBankItem)=>Promise<void>};
const types:Record<string,string>={选择题:'choice',填空题:'fill_in_blank',简答题:'short_answer',解答题:'written',判断题:'concept',编程题:'coding'};
export function paperSectionMatches(q:QuestionBankItem,b:PaperBlueprint,s:PaperSection){return q.subject===b.subject&&q.grade===b.grade&&(q.sourceKind==='local_bank'||q.sourceKind==='teacher_resource'||b.mode!=='source_only'&&q.sourceKind==='generated')&&(types[q.questionType]||q.questionType)===(types[s.questionType]||s.questionType)&&(!s.difficulty||q.difficulty===s.difficulty)&&(!s.knowledgePoint||q.knowledgePoint.includes(s.knowledgePoint));}
export function paperShortages(b:PaperBlueprint,items:PaperSelection['items']):PaperSelection['shortages']{
 return b.sections.flatMap(s=>{if(b.mode==='source_only'){const selected=items.filter(q=>q.sectionId===s.id).length;return[{sectionId:s.id,label:s.label,required:s.count,selected,missing:s.count-selected}];}
 const generated=generatedPaperCount(b,s);return(['original','generated'] as const).map(sourceKind=>{const required=sourceKind==='generated'?generated:s.count-generated,selected=items.filter(q=>q.sectionId===s.id&&(q.question.sourceKind==='generated')===(sourceKind==='generated')).length;return{sectionId:s.id,label:s.label,required,selected,missing:required-selected,sourceKind};});}).filter(s=>s.missing>0);
}
/** Deterministic bipartite matching. Source facts remain in the existing bank; no model or Agent loop. */
export async function selectPaper(host:PaperSelectionHost,blueprint:PaperBlueprint,current:()=>boolean,generations:ReadonlyMap<string,PaperGeneration>=new Map()):Promise<PaperSelection>{
 if(!validPaperBlueprint(blueprint))throw new Error('invalid_input');
 const lease=()=>{if(!current())throw new Error('cancelled');};
 const slots=blueprint.sections.flatMap((s,section)=>Array.from({length:s.count},(_,i)=>section*2+(i>=s.count-generatedPaperCount(blueprint,s)?1:0))); 
 type Edge={id:string;version:string};type Group={key:string;edges:Map<number,Edge>};
 const groups:Group[]=[],byKey=new Map<string,number>(),perSection=blueprint.sections.flatMap(()=>[[] as number[],[] as number[]]),owners=new Map<number,number>(),assigned=new Map<number,number>();
 const augment=(slot:number,seen:Set<number>):boolean=>{for(const group of perSection[slots[slot]]){if(seen.has(group))continue;seen.add(group);const previous=owners.get(group);if(previous===undefined||augment(previous,seen)){owners.set(group,slot);assigned.set(slot,group);return true;}}return false;};
 let after='',scanned=0,scanComplete=false,duplicateRecords=0;const excluded={unsupported:0,missing_answer:0,source_unavailable:0};
 outer:while(true){lease();const page=await host.page(blueprint,after);lease();if(!page.length){scanComplete=true;break;}
  for(const row of page){lease();if(typeof row.id!=='string'||row.id<=after)throw new Error('unavailable');after=row.id;scanned++;const q=row.question;if(!q){excluded.unsupported++;continue;}
   const generated=q.sourceKind==='generated',generation=generations.get(q.id);if(generated&&(!generation||blueprint.mode==='ai_original'&&generation.generationKind!=='ai_original'))continue;
   const sections=blueprint.sections.map((s,i)=>paperSectionMatches(q,blueprint,s)?i*2+(generated?1:0):-1).filter(i=>i>=0);if(!sections.length)continue;
   const identity=questionContentIdentity(q);if(identity.status!=='available'){excluded.unsupported++;continue;}
   if(!q.answer.trim()||!q.analysis.trim()||q.document?.answer.origin==='missing'||q.document?.analysis.origin==='missing'){excluded.missing_answer++;continue;}
   try{await host.validate(q);}catch(e){lease();if((e as Error)?.message==='cancelled')throw e;excluded.source_unavailable++;continue;}lease();
   const key=createHash('sha256').update(identity.key).digest('hex');let group=byKey.get(key);
   if(group===undefined){group=groups.length;byKey.set(key,group);groups.push({key,edges:new Map()});}else duplicateRecords++;
   for(const section of sections)if(!groups[group].edges.has(section)){groups[group].edges.set(section,{id:q.id,version:questionVersion(q)});perSection[section].push(group);}
   for(let slot=0;slot<slots.length;slot++)if(!assigned.has(slot))augment(slot,new Set());
   if(assigned.size===slots.length)break outer;
  }
  // Yield between batches so the main process can receive cancellation and navigation.
  await new Promise<void>(resolve=>setImmediate(resolve));
 }
 const items:PaperSelection['items']=[];
 for(let slot=0;slot<slots.length;slot++){lease();const group=assigned.get(slot);if(group===undefined)continue;const bucket=slots[slot],section=Math.floor(bucket/2),edge=groups[group].edges.get(bucket)!;
  const q=await host.read(edge.id);lease();if(!q||questionVersion(q)!==edge.version||!paperSectionMatches(q,blueprint,blueprint.sections[section]))throw new Error('source_changed');await host.validate(q);lease();
  items.push({sectionId:blueprint.sections[section].id,number:items.length+1,points:blueprint.sections[section].points,question:questionFacts(q),source:{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:edge.version},...(q.sourceKind==='generated'?{generation:generations.get(q.id)!}:{})});
 }
 const shortages=paperShortages(blueprint,items);
 return{items,shortages,scanned,scanComplete,excluded,duplicateRecords};
}
