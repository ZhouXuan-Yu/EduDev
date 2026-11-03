import {useEffect,useRef,useState} from 'react';
import {PAPER_ADAPTATION_SCHEMA,type PaperBasketAdaptationApi,type PaperAdaptationView,type PaperAdaptationPrepare,type PaperAdaptationAccept,type PaperAdaptationCancel} from '../../../shared/paper-basket-adaptation';
import type {PaperBasketV2View} from '../../../shared/paper-basket-v2';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';
type Pending={kind:'prepare';input:PaperAdaptationPrepare}|{kind:'accept';input:PaperAdaptationAccept}|{kind:'cancel';input:PaperAdaptationCancel};
export function usePaperEntryAdaptation(basket:PaperBasketV2View,studentId:string,entryId:string,api:PaperBasketAdaptationApi,onChanged:()=>void){
 const [restoring,setRestoring]=useState(true);
 const [view,setView]=useState<PaperAdaptationView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retryable,setRetryable]=useState(false);
 const pending=useRef<Pending|undefined>(undefined),lock=useRef(false),epoch=useRef(0),[sent,setSent]=useState(false);
 useDesktopNavigationGuard(busy||retryable,'指定题改编提交结果待核实，请先重试原请求。');
 const scope={schemaVersion:PAPER_ADAPTATION_SCHEMA,sessionId:basket.sessionId,studentId,basketId:basket.id};
 useEffect(()=>{const stamp=++epoch.current;setRestoring(true);setView(undefined);setSent(false);setError('');pending.current=undefined;setRetryable(false);
  void api.listPaperBasketAdaptations({...scope,entryId}).then(r=>{if(stamp!==epoch.current)return;if(r.ok)setView(r.value[0]);else setError(r.error);}).catch(()=>{if(stamp===epoch.current)setError('读取改编意图失败，请刷新。');}).finally(()=>{if(stamp===epoch.current)setRestoring(false);});
  return()=>{epoch.current++;};
 },[basket.sessionId,basket.id,studentId,entryId]);
 async function refresh(){const stamp=epoch.current;if(!view)return;try{const r=await api.readPaperBasketAdaptation({...scope,intentId:view.intentId});if(stamp===epoch.current){if(r.ok)setView(r.value);else setError(r.error);}}catch{if(stamp===epoch.current)setError('读取失败；已保存候选保留，请重试读取。');}}
 async function execute(p:Pending){if(lock.current)return;lock.current=true;setBusy(true);setError('');setRetryable(false);pending.current=p;const stamp=++epoch.current;
  try{const r=p.kind==='prepare'?await api.preparePaperBasketAdaptation(p.input):p.kind==='accept'?await api.acceptPaperBasketAdaptation(p.input):await api.cancelPaperBasketAdaptation(p.input);
   if(stamp!==epoch.current)return;
   if(!r.ok){setError(r.error);if(r.error==='unavailable'||r.error==='busy')setRetryable(true);else pending.current=undefined;return;}
   pending.current=undefined;
   if(p.kind==='accept'){setView(v=>v?{...v,status:'accepted',current:false,receipt:r.value as import('../../../shared/paper-basket-adaptation').PaperAdaptationReceipt}:v);onChanged();}
   else {setView(r.value as PaperAdaptationView);setSent(false);}
  }catch{if(stamp===epoch.current){setError('结果待核实，请重试原请求；不会重新生成或重复入篮。');setRetryable(true);}}
  finally{lock.current=false;if(stamp===epoch.current)setBusy(false);}
 }
 function prepare(requirements:string,intent:'replace'|'add'){const e=basket.entries.find(e=>e.entryId===entryId);if(!e||retryable)return;void execute({kind:'prepare',input:{...scope,requestId:'adapt_'+crypto.randomUUID(),expectedBasketRevision:basket.revision,entryId,instanceRevision:e.instance.instanceRevision,parentQuestionId:e.questionId,parentSourceVersion:e.contentVersion,requirements:requirements.trim(),intent}});}
 function accept(candidateId:string,candidateDigest:string){if(view&&!retryable)void execute({kind:'accept',input:{...scope,intentId:view.intentId,requestId:'accept_'+crypto.randomUUID(),candidateId,candidateDigest}});}
 function cancel(){if(view&&!retryable)void execute({kind:'cancel',input:{...scope,intentId:view.intentId,requestId:'cancel_'+crypto.randomUUID()}});}
 return {view,busy,restoring,error,retryable,sent,refresh,prepare,accept,cancel,retry:()=>{if(pending.current)void execute(pending.current);},markSent:()=>setSent(true)};
}
