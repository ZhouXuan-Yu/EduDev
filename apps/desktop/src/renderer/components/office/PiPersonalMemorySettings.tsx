import {useState} from 'react';
import {Button, TextArea} from '@heroui/react';
import type {PersonalMemoryEditInput, PersonalMemoryJob, PersonalMemoryReview} from '../../../shared/xiaozhi-personal-memory';
import {DisclosureCard} from '../ui/DisclosureCard';
import {SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';
import {PiPersonalMemoryCandidates} from './PiPersonalMemoryCandidates';
import {afterMemoryCommit, replyValue, scopeText, usePersonalMemoryView} from './personal-memory-view';
const jobStates:Record<PersonalMemoryJob['state'],string> = {
  pending:'等待空闲',running:'处理中',waiting_budget:'等待模型预算',succeeded:'已完成',partial:'部分完成',
  failed:'未完成',cancelled:'已取消',
};

export function PiPersonalMemorySettings() {
  const [expanded,setExpanded]=useState(false);
  const [recordSource,setRecordSource]=useState<{id:string;revision:number;source:PersonalMemoryReview}>();
  const [draft,setDraft]=useState<{id:string;revision:number;text:string}>();
  const [forget,setForget]=useState<{id:string;revision:number}>();
  const api=window.omniEdu?.personalMemory;
  const {view,busy,feedback,perform,refresh}=usePersonalMemoryView(api?.view);
  const open=(next:boolean)=>{
    setExpanded(next);
    if (next && !view) void refresh();
  };
  const change=(input:PersonalMemoryEditInput)=>perform(async reload=>{
    replyValue(await api?.edit(input));
    setDraft(undefined);
    setForget(undefined);
    return afterMemoryCommit(input.action==='forget'?'已停止使用这条记忆。':input.action==='disable'?'已停用。':
      input.action==='restore'?'已恢复。':'已保存修订。',reload);
  });

  return <DisclosureCard isExpanded={expanded} onExpandedChange={open} title="自动记忆" data-testid="pi-personal-memory-settings">
    <SettingsStack gap="md">
      <SettingsInline>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void refresh()}>刷新记忆</Button>
        {view&&<Button size="sm" variant="secondary" isDisabled={busy} data-testid="personal-memory-auto"
          onPress={()=>void perform(async reload=>{
            const enabled=!view.policy.enabled;
            replyValue(await api?.setEnabled({enabled,revision:view.policy.policyRevision}));
            return afterMemoryCommit(enabled?'已开启自动处理。':'已关闭自动处理。',reload);
          })}>{view.policy.enabled?'关闭自动处理':'开启自动处理'}</Button>}
      </SettingsInline>
      {view?.policy.enabled&&view.policy.pausedByUsePolicy&&<p role="status">当前记忆使用策略暂停了自动处理。</p>}
      {busy&&<p role="status">正在处理…</p>}
      {feedback&&<p role={feedback.error?'alert':'status'} data-testid="personal-memory-feedback">{feedback.message}</p>}
      {!!view?.jobs.length&&<DisclosureCard title="后台任务">
        <SettingsStack gap="sm">
          {view.jobs.map(job=><SettingsInline key={job.id}>
            <span>{job.kind==='extract'?'提取建议':'整理记忆'} · {jobStates[job.state]}
              {job.saved!==null?` · 已生成 ${job.saved} 条建议`:''}
              {job.notSaved?` · ${job.notSaved} 项待处理`:''}</span>
            {job.error==='provider_effect_unknown'&&<span>未收到模型回执，未自动重发。</span>}
            {['pending','running','waiting_budget'].includes(job.state)&&<Button size="sm" variant="ghost" isDisabled={busy}
              data-testid={'personal-memory-cancel-'+job.id} onPress={()=>void perform(async reload=>{
                const result=replyValue(await api?.cancelJob({id:job.id,revision:job.revision}));
                const message=result.cancelled
                  ? result.outbound?'已取消此任务。模型请求已发出，后续结果不会保存。':'已取消此任务。'
                  : '任务在取消前已结束，已保存的结果保留。';
                return afterMemoryCommit(message,reload);
              })}>取消此任务</Button>}
          </SettingsInline>)}
        </SettingsStack>
      </DisclosureCard>}
      {view&&<PiPersonalMemoryCandidates queue={view} busy={busy} perform={perform}/>}
      {view?.records.length===0&&<p>暂无正式记忆。</p>}
      {view?.records.map(item=>{
        const editing=draft?.id===item.id ? draft : undefined;
        return <article key={item.id} data-testid={'personal-memory-record-'+item.id}>
          <h4>{item.kind==='preference'?'教学偏好':'任教背景'}</h4>
          <p>{scopeText(item.scope,item.term)} · 第 {item.revision} 版</p>
          <p>{item.state==='forgotten'?'已遗忘':item.state==='disabled'?'已停用':item.sourceCurrent?'有效':'来源已失效'}
            {item.cleanupPending?' · 清理待完成':''}</p>
          {item.value&&<p>{item.value}</p>}
          {editing&&<SettingsStack gap="sm">
            <label htmlFor={'personal-memory-edit-'+item.id}>修订内容</label>
            <TextArea id={'personal-memory-edit-'+item.id} fullWidth rows={2} maxLength={320} value={editing.text} disabled={busy}
              onChange={event=>setDraft({...editing,text:event.target.value})}/>
            <SettingsInline>
              <Button size="sm" variant="secondary" isDisabled={busy || !editing.text.trim() || editing.revision!==item.revision}
                onPress={()=>void change({action:'edit',id:item.id,revision:editing.revision,value:editing.text,
                  operationId:crypto.randomUUID()})}>保存修订</Button>
              {editing.revision!==item.revision&&<Button size="sm" variant="ghost" isDisabled={busy}
                onPress={()=>setDraft({...editing,revision:item.revision})}>在当前版本上修订</Button>}
              <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>setDraft(undefined)}>取消修订</Button>
            </SettingsInline>
          </SettingsStack>}
          {item.state!=='forgotten'&&!editing&&<SettingsInline>
            {item.sourceCurrent&&<Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void perform(async()=>{
              const source=replyValue(await api?.previewRecord({id:item.id,revision:item.revision}));
              setRecordSource({id:item.id,revision:item.revision,source});
              return undefined;
            })}>查看来源</Button>}
            {item.state==='active'&&item.sourceCurrent&&<Button size="sm" variant="ghost" isDisabled={busy}
              onPress={()=>setDraft({id:item.id,revision:item.revision,text:item.value})}>修订</Button>}
            {(item.state==='active'||item.sourceCurrent)&&<Button size="sm" variant="ghost" isDisabled={busy}
              onPress={()=>void change({action:item.state==='active'?'disable':'restore',id:item.id,revision:item.revision,
                operationId:crypto.randomUUID()})}>{item.state==='active'?'停用':'恢复'}</Button>}
            <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>setForget({id:item.id,revision:item.revision})}>遗忘</Button>
          </SettingsInline>}
          {item.sourceCurrent&&recordSource?.id===item.id&&recordSource.revision===item.revision&&<SettingsStack gap="sm">
            <p>{recordSource.source.quote}</p>
            {recordSource.source.occurredAt&&<time dateTime={recordSource.source.occurredAt}>{recordSource.source.occurredAt}</time>}
            <Button size="sm" variant="ghost" onPress={()=>setRecordSource(undefined)}>收起来源</Button>
          </SettingsStack>}
          {forget?.id===item.id&&<SettingsInline>
            <p>这条记忆和对应的提取授权将失效。原对话仍可查看。</p>
            <Button size="sm" variant="danger" isDisabled={busy||forget.revision!==item.revision}
              onPress={()=>void change({action:'forget',id:item.id,revision:forget.revision,operationId:crypto.randomUUID()})}>确认遗忘</Button>
            <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>setForget(undefined)}>取消</Button>
          </SettingsInline>}
        </article>;
      })}
    </SettingsStack>
  </DisclosureCard>;
}
