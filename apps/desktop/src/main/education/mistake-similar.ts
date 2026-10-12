import {createHash} from 'node:crypto';
import type {MistakeFactsReceipt} from '../../shared/mistake-facts';
import {MISTAKE_SIMILAR_SCHEMA,validMistakeSimilarInput,type MistakeSimilarInput,type MistakeSimilarView} from '../../shared/mistake-similar';
import {QUESTION_CONTEXT_SCHEMA} from '../../shared/question-context';
import {questionContentIdentity} from '../../shared/question-identity';
import {questionFacts,questionVersion} from './question-context-provider';
import type {PaperSelectionHost} from './paper-selection';

type Host=Pick<PaperSelectionHost,'read'|'validate'>&{page:(subject:string,grade:string,after:string)=>ReturnType<PaperSelectionHost['page']>;facts:(studentId:string,recordId:string,signal:AbortSignal)=>Promise<MistakeFactsReceipt|undefined>};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
// Literal Chinese bigrams / Latin words only. These are inspectable lexical cues, not embeddings or mathematical equivalence.
const tokens=(text:string)=>{const out=new Set<string>();for(const part of text.match(/[\p{Script=Han}]+|[a-zA-Z]{2,}/gu)||[]){if(/^[a-zA-Z]+$/.test(part))out.add(part.toLowerCase());else for(let n=0;n<part.length-1;n++)out.add(part.slice(n,n+2));}return out;};
export async function findMistakeSimilar(host:Host,input:MistakeSimilarInput,signal:AbortSignal,current:()=>boolean=()=>true):Promise<MistakeSimilarView>{
 if(!validMistakeSimilarInput(input))throw new Error('invalid_input');
 const lease=()=>{signal.throwIfAborted();if(!current())throw new Error('cancelled');};
 const rootReceipt=async()=>{lease();const r=await host.facts(input.studentId,input.recordId,signal);lease();if(!r)throw new Error('permission_denied');if(r.digest!==input.receiptVersion)throw new Error('source_changed');return r;};
 const receipt=await rootReceipt(),root=await host.read(receipt.question.questionId);lease();
 if(!root||questionVersion(root)!==receipt.question.version)throw new Error('source_changed');await host.validate(root);lease();
 const identity=questionContentIdentity(root);if(identity.status!=='available')throw new Error('source_changed');
 const rootKey=hash(identity.key),rootTokens=tokens(root.stem),excluded={unsupported:0,missingAnswer:0,sourceUnavailable:0,rootOrDuplicate:0};
 type Candidate={key:string;id:string;version:string;knowledge:number;overlap:number;sameDifficulty:number;reasons:string[]};
 const seen=new Set<string>(),best:Candidate[]=[];
 const compare=(a:Candidate,b:Candidate)=>b.knowledge-a.knowledge||b.overlap-a.overlap||b.sameDifficulty-a.sameDifficulty||(a.id<b.id?-1:a.id>b.id?1:0);
 let after='',scanned=0;
 for(;;){lease();const page=await host.page(root.subject,root.grade,after);lease();if(!page.length)break;
  for(const row of page){lease();if(typeof row.id!=='string'||row.id<=after)throw new Error('unavailable');after=row.id;scanned++;
   const q=row.question;if(!q||q.subject!==root.subject||q.grade!==root.grade||!['local_bank','teacher_resource'].includes(q.sourceKind)){excluded.unsupported++;continue;}
   const content=questionContentIdentity(q);if(content.status!=='available'){excluded.unsupported++;continue;}const key=hash(content.key);
   if(q.id===root.id||key===rootKey){excluded.rootOrDuplicate++;continue;}
   if(!q.answer.trim()||!q.analysis.trim()||q.document?.answer.origin==='missing'||q.document?.analysis.origin==='missing'){excluded.missingAnswer++;continue;}
   const knowledge=!!root.knowledgePoint.trim()&&q.knowledgePoint.trim()===root.knowledgePoint.trim()?1:0;
   const overlap=[...tokens(q.stem)].filter(t=>rootTokens.has(t)).length;if(!knowledge&&overlap<2)continue;
   try{await host.validate(q);}catch(error){lease();if((error as Error)?.message==='cancelled')throw error;excluded.sourceUnavailable++;continue;}lease();
   if(seen.has(key))excluded.rootOrDuplicate++;seen.add(key);
   const candidate:Candidate={key,id:q.id,version:questionVersion(q),knowledge,overlap,sameDifficulty:q.difficulty===root.difficulty?1:0,reasons:[...(knowledge?['同一知识点']:[]),...(overlap>=2?[`题干共有${overlap}项文字线索`]:[])]};
   const duplicate=best.findIndex(c=>c.key===key);if(duplicate>=0){if(compare(candidate,best[duplicate])>=0)continue;best.splice(duplicate,1);}
   best.push(candidate);best.sort(compare);if(best.length>10)best.pop();
  }
  await new Promise<void>(resolve=>setImmediate(resolve));
 }
 const items:MistakeSimilarView['items']=[];
 for(const entry of best){lease();const q=await host.read(entry.id);lease();if(!q||questionVersion(q)!==entry.version)throw new Error('source_changed');await host.validate(q);lease();items.push({source:{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:entry.version},question:questionFacts(q),reasons:entry.reasons});}
 await rootReceipt();lease();return{schemaVersion:MISTAKE_SIMILAR_SCHEMA,receiptVersion:input.receiptVersion,method:'local_knowledge_keyword_v1',items,requested:10,scanned,scanComplete:true,excluded,answerVerified:false};
}
