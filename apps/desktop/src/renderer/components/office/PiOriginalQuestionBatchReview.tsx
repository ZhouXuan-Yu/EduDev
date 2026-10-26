import {useCallback,useState} from 'react';
import {Button} from '@heroui/react';
import {ChatToolGroup} from '../../heroui-pro/components/chat-tool';
import type {QuestionReviewSummary} from '../../../shared/question-review';
import {PiOriginalMultiQuestionReview} from './PiOriginalMultiQuestionReview';

/** One source-backed review at a time. Session-owned drafts survive switching. */
export function PiOriginalQuestionBatchReview({sessionId,reviews,onRefresh}:{sessionId:string;reviews:QuestionReviewSummary[];onRefresh:()=>Promise<void>}){
 const firstStage=(id:string)=>reviews.filter(r=>r.originalBatch!.id===id).map(r=>r.originalBatch!.stagedAt??'').sort()[0];
 const batches=[...new Set(reviews.map(r=>r.originalBatch!.id))].sort((a,b)=>firstStage(a).localeCompare(firstStage(b))||a.localeCompare(b)),ordered=[...reviews].sort((a,b)=>batches.indexOf(a.originalBatch!.id)-batches.indexOf(b.originalBatch!.id)||a.originalBatch!.index-b.originalBatch!.index),total=batches.reduce((n,id)=>n+reviews.find(r=>r.originalBatch!.id===id)!.originalBatch!.total,0),[selected,setSelected]=useState(''),[navigationLocked,setNavigationLocked]=useState(false);
 const navigationLock=useCallback((locked:boolean)=>setNavigationLocked(locked),[]);
 const current=ordered.find(r=>r.id===selected)??ordered.find(r=>r.state==='pending')??ordered[0];
 if(!current)return null;
 const index=ordered.findIndex(r=>r.id===current.id),confirmed=ordered.filter(r=>r.state==='confirmed').length,rejected=ordered.filter(r=>r.state==='rejected').length,pending=ordered.length-confirmed-rejected;
 return <ChatToolGroup defaultExpanded data-testid="pi-original-batch" data-batch-id={current.originalBatch!.collectionId??current.originalBatch!.id}>
  <ChatToolGroup.Trigger>原题集中核对 · 已整理 {ordered.length} / {total} 道 · 待核对 {pending} 道</ChatToolGroup.Trigger>
  <ChatToolGroup.Content>
   <p role="status" data-testid="original-batch-progress">已保存 {confirmed} 道，已拒绝 {rejected} 道。未逐题确认的候选不会进入题库。</p>
   <div className="toolbar-row" aria-label="选择要核对的原题" data-testid="original-batch-navigation">
    {ordered.map((r,i)=><Button key={r.id} size="sm" variant={r.id===current.id?'primary':'secondary'} isDisabled={navigationLocked} aria-pressed={r.id===current.id} aria-label={`第${i+1}题，${r.state==='pending'?'待核对':r.state==='confirmed'?'已保存':'已拒绝'}`} data-testid={`original-batch-item-${i}`} onPress={()=>setSelected(r.id)}>{i+1} · {r.state==='pending'?'待核对':r.state==='confirmed'?'已保存':'已拒绝'}</Button>)}
   </div>
   <div className="toolbar-row"><Button variant="ghost" data-testid="original-batch-previous" isDisabled={navigationLocked||index===0} onPress={()=>setSelected(ordered[index-1].id)}>上一题</Button><span>第 {index+1} / {total} 题</span><Button variant="ghost" data-testid="original-batch-next" isDisabled={navigationLocked||index===ordered.length-1} onPress={()=>setSelected(ordered[index+1].id)}>下一题</Button></div>
   {navigationLocked&&<p role="status">请先完成当前题目的范围修改或保存，再切换题目。</p>}
   <PiOriginalMultiQuestionReview key={current.id} sessionId={sessionId} review={current} onRefresh={onRefresh} onNavigationLock={navigationLock}/>
  </ChatToolGroup.Content>
 </ChatToolGroup>;
}

export function originalReviewGroups(reviews:QuestionReviewSummary[]){
 const groups=new Map<string,QuestionReviewSummary[]>();
 for(const review of reviews){if(!review.originalBatch)continue;const id=review.originalBatch.collectionId??review.originalBatch.id;groups.set(id,[...(groups.get(id)??[]),review]);}
 return [...groups.entries()];
}
