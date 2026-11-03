import {useState,useRef,useEffect} from 'react';
import {Button,TextField,TextArea,Label} from '@heroui/react';
import type {PaperBasketV2View} from '../../../shared/paper-basket-v2';
import type {PaperBasketAdaptationApi} from '../../../shared/paper-basket-adaptation';
import {QuestionVariationComparison} from '../office/QuestionVariationComparison';
import {PiQuestionReview} from '../office/PiQuestionReview';
import {DisclosureCard} from '../ui/DisclosureCard';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';
import {PaperSelect} from './PaperSelect';
import {usePaperEntryAdaptation} from './usePaperEntryAdaptation';
export function PaperEntryAdaptation({basket,studentId,entryId,api,onRequestPi,onChanged,onDirtyChange}:{basket:PaperBasketV2View;studentId:string;entryId:string;api:PaperBasketAdaptationApi;onRequestPi:(prompt:string,sessionId:string)=>Promise<boolean>;onChanged:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
 const state=usePaperEntryAdaptation(basket,studentId,entryId,api,onChanged),[requirements,setRequirements]=useState(''),[intent,setIntent]=useState<'replace'|'add'>('replace');const v=state.view;const [loading,setLoading]=useState(false),[loadError,setLoadError]=useState('');const current=useRef(v);current.current=v;useEffect(()=>{setLoading(false);setLoadError('');},[v?.intentId]);
 useEffect(()=>{if(v){setRequirements(v.input.requirements);setIntent(v.input.intent);}},[v?.intentId]);
 const dirty=requirements.trim()!==(v?.input.requirements??'')||intent!==(v?.input.intent??'replace');
 useDesktopNavigationGuard(dirty,'改编要求或接受方式尚未冻结，请先冻结或还原输入。');
 const dirtyCallback=useRef(onDirtyChange);dirtyCallback.current=onDirtyChange;
 useEffect(()=>{dirtyCallback.current?.(dirty||state.busy||state.retryable||state.restoring);},[dirty,state.busy,state.retryable,state.restoring]);
 useEffect(()=>()=>dirtyCallback.current?.(false),[]);
 async function loadPi(){if(!v||loading)return;const intentId=v.intentId;setLoading(true);setLoadError('');try{const ok=await onRequestPi(v.prompt,v.input.sessionId);if(current.current?.intentId!==intentId)return;if(ok)state.markSent();else setLoadError('未载入会话；请处理原草稿或导航提示后重试载入。');}catch{if(current.current?.intentId===intentId)setLoadError('载入失败，可重试载入；尚未确认模型运行。');}finally{if(current.current?.intentId===intentId)setLoading(false);}}
 return <DisclosureCard title="指定此题改编" data-testid="paper-entry-adaptation">
  <p>先生成并对照原题与答案，在原核对卡保存候选后，仍须在这里显式接受才会回接题篮。替换保留位置和分值；生成配额须先在题篮明确设置。</p>
  <TextField isDisabled={state.busy||state.retryable||state.restoring}><Label>改编要求</Label><TextArea aria-label="改编要求" data-testid="paper-adaptation-requirements" value={requirements} maxLength={4000} onChange={e=>setRequirements(e.target.value)}/></TextField>
  <PaperSelect label="接受方式" value={intent} disabled={state.busy||state.retryable||state.restoring} testId="paper-adaptation-intent" options={[{id:'replace',label:'替换此题'},{id:'add',label:'新增一道'}]} onChange={value=>setIntent(value as 'replace'|'add')}/>
  <Button data-testid="paper-adaptation-prepare" isDisabled={!requirements.trim()||state.busy||state.retryable||state.restoring||v?.status==='prepared'&&v.current} onPress={()=>state.prepare(requirements,intent)}>冻结改编要求</Button>
  {v&&<><p>要求：{v.input.requirements}；方式：{v.input.intent==='replace'?'替换':'新增'}；状态：{v.status}</p>
   {v.status==='prepared'&&!v.current&&<p role="alert">题篮、原题或来源已经变化；此意图不可接受。请重新冻结要求。</p>}
   <Button data-testid="paper-adaptation-send" isDisabled={state.busy||state.retryable||state.restoring||!v.current||v.generationStarted||state.sent||loading||dirty} onPress={()=>void loadPi()}>载入真实 Pi 会话</Button>{state.sent&&<p role="status">已载入会话，请在原输入框确认发送；模型是否运行以读取状态为准。</p>}{loadError&&<p role="alert">{loadError}</p>}
   <Button data-testid="paper-adaptation-read" isDisabled={state.busy||state.retryable||state.restoring} onPress={()=>void state.refresh()}>读取原候选与回接状态</Button>
   {v.candidates.map(c=><section key={c.id} data-testid="paper-adaptation-candidate" data-candidate-id={c.id}><QuestionVariationComparison variation={c.variation} draft={c.draft}/><PiQuestionReview sessionId={v.input.sessionId} review={c} onRefresh={state.refresh}/>
    <Button data-testid="paper-adaptation-accept" isDisabled={state.busy||state.retryable||state.restoring||!v.current||dirty||!c.sourceCurrent||c.state!=='confirmed'||!!c.supersededBy||!c.effectDigest} onPress={()=>{if(c.effectDigest)state.accept(c.id,c.effectDigest);}}>显式接受并{v.input.intent==='replace'?'替换此题':'新增入篮'}</Button></section>)}
   {v.status==='prepared'&&<Button data-testid="paper-adaptation-cancel" isDisabled={state.busy||state.retryable||state.restoring} onPress={state.cancel}>取消此意图</Button>}
   {v.receipt&&<p role="status">已回接题篮修订 {v.receipt.basketRevision}；题目 {v.receipt.questionId}。不再重复生成或入篮。</p>}
  </>}
  {dirty&&<Button data-testid="paper-adaptation-revert" isDisabled={state.busy||state.retryable||state.restoring} onPress={()=>{setRequirements(v?.input.requirements??'');setIntent(v?.input.intent??'replace');}}>还原未冻结输入</Button>}
  {state.error&&<p role="alert">{state.error}</p>}{state.retryable&&<Button isDisabled={state.busy} onPress={state.retry}>重试原请求</Button>}
 </DisclosureCard>;
}
