import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {MistakeFactsReceipt} from '../../../shared/mistake-facts';
import {MISTAKE_SIMILAR_SCHEMA,MISTAKE_SIMILAR_ERRORS,type MistakeSimilarInput,type MistakeSimilarView} from '../../../shared/mistake-similar';
import {QuestionAnswerEvidence} from '../QuestionAnswerEvidence';
import {QuestionOriginalPicture} from '../QuestionOriginalPicture';
import {QuestionSourceLink} from '../office/PiQuestionSource';

export function MistakeSimilarResults({value}:{value:MistakeSimilarView}){
 return <div data-testid="mistake-similar-results"><p role="status" data-testid="mistake-similar-count">找到 {value.items.length} / 10 道本地关联题{value.items.length<10?'，题库不足，未自动补题。':'。'}</p>
  <p className="muted">按同学科、同年级、同知识点和题干文字线索匹配；仅作关联候选，语义与答案正确性需要教师核对。</p>
  {!value.items.length&&<p data-testid="mistake-similar-empty">暂无可用关联题，请先在题本补充对应学科与年级的题目。</p>}
  {value.items.map((item,index)=><details className="work-panel" key={item.source.questionId} data-testid={'mistake-similar-item-'+index}><summary>{index+1}. {item.question.knowledgePoint||'本地题目'} · {item.question.stem.slice(0,100)}</summary><p>{item.reasons.join('；')} · {item.question.grade} · {item.question.subject}</p><p style={{whiteSpace:'pre-wrap'}}>{item.question.stem}</p><ul><QuestionSourceLink source={{title:item.question.sourceTitle||'本地题库',question:item.source}}/></ul>{item.question.document&&<QuestionOriginalPicture question={item.question}/>}<QuestionAnswerEvidence question={item.question}/></details>)}
  <p className="muted">已查看 {value.scanned} 条当前范围的题目，保守排除原题及同题副本；不改变已保存的题目和学生事实。</p>
 </div>;
}
export function MistakeSimilarQuestions({studentId,receipt}:{studentId:string;receipt:MistakeFactsReceipt}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[value,setValue]=useState<MistakeSimilarView>();
 const pending=useRef<MistakeSimilarInput|undefined>(undefined),epoch=useRef(0);
 useEffect(()=>{setValue(undefined);setError('');setBusy(false);return()=>{epoch.current++;if(pending.current)void window.omniEdu?.cancelMistakeSimilar(pending.current);pending.current=undefined;};},[studentId,receipt.recordId,receipt.digest]);
 async function find(){if(pending.current)return;const owner=epoch.current,input:MistakeSimilarInput={schemaVersion:MISTAKE_SIMILAR_SCHEMA,studentId,recordId:receipt.recordId,receiptVersion:receipt.digest,requestId:crypto.randomUUID()};pending.current=input;setBusy(true);setError('');setValue(undefined);
  try{const result=await window.omniEdu?.findMistakeSimilar(input);if(owner!==epoch.current)return;if(result?.ok)setValue(result.value);else setError(result?MISTAKE_SIMILAR_ERRORS[result.error]:'本地查询没有完成，请重试。');}catch{if(owner===epoch.current)setError('本地查询没有完成，请重试。');}finally{if(owner===epoch.current){pending.current=undefined;setBusy(false);}}
 }
 function cancel(){const input=pending.current;epoch.current++;pending.current=undefined;setBusy(false);setValue(undefined);setError(MISTAKE_SIMILAR_ERRORS.cancelled);if(input)void window.omniEdu?.cancelMistakeSimilar(input);}
 return <section data-testid="mistake-similar"><h3>本地关联题</h3><div className="toolbar-row"><Button data-testid="mistake-similar-find" isDisabled={busy} onPress={()=>void find()}>{busy?'查询中…':'查找最多10道关联题'}</Button>{busy&&<Button data-testid="mistake-similar-cancel" variant="secondary" onPress={cancel}>停止查询</Button>}</div>{error&&<p role="alert" data-testid="mistake-similar-error">{error}</p>}{value&&<MistakeSimilarResults value={value}/>}</section>;
}
