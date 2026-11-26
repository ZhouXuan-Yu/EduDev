import {useState} from 'react';
import {Button} from '@heroui/react';
import type {PersonalMemoryQueue, PersonalMemoryReview} from '../../../shared/xiaozhi-personal-memory';
import {SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';
import {afterMemoryCommit, replyValue, scopeText, type PerformMemoryAction} from './personal-memory-view';

export function PiPersonalMemoryCandidates({queue,busy,perform}:{
  queue:PersonalMemoryQueue; busy:boolean; perform:PerformMemoryAction;
}) {
  const [review,setReview]=useState<{key:string;revision:number;source:PersonalMemoryReview}>();
  const api=window.omniEdu?.personalMemory;
  if (queue.candidates.length===0) return <p>暂无待核对的建议。</p>;
  return queue.candidates.map(item=><article key={item.key} data-testid={'personal-memory-candidate-'+item.key}>
    <h4>{item.state==='conflict'?'待处理的冲突':'待核对的建议'}</h4>
    <p>{item.value}</p><p>{scopeText(item.scope,item.term)}</p>
    <SettingsInline>
      {item.state==='pending'&&<Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void perform(async()=>{
        const {key,revision}=item;
        setReview({key,revision,source:replyValue(await api?.preview({key,revision}))});
        return undefined;
      })}>查看来源</Button>}
      <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void perform(async reload=>{
        replyValue(await api?.reject({key:item.key,revision:item.revision}));
        setReview(undefined);
        return afterMemoryCommit('已拒绝建议。',reload);
      })}>拒绝</Button>
    </SettingsInline>
    {review?.key===item.key&&review.revision===item.revision&&<SettingsStack gap="sm">
      <blockquote data-testid="personal-memory-reviewed-quote">{review.source.quote}</blockquote>
      {review.source.occurredAt&&<time dateTime={review.source.occurredAt}>{review.source.occurredAt}</time>}
      <SettingsInline>
        <Button size="sm" variant="secondary" isDisabled={busy || !queue.policy.enabled || queue.policy.pausedByUsePolicy}
          onPress={()=>void perform(async reload=>{
            replyValue(await api?.adopt({key:item.key,revision:item.revision,targetRevision:item.targetRevision,
              operationId:crypto.randomUUID(),reviewedQuoteSha256:review.source.quoteSha256}));
            setReview(undefined);
            return afterMemoryCommit('已保存为正式记忆。',reload);
          })}>确认采用</Button>
        <Button size="sm" variant="ghost" onPress={()=>setReview(undefined)}>收起来源</Button>
      </SettingsInline>
    </SettingsStack>}
  </article>);
}
