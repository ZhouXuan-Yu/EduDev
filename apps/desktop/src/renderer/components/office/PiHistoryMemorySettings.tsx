import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { HistoryAccessAction, HistoryIndexStatus, HistoryPreview, HistorySource } from '../../../shared/xiaozhi-history-memory';
import { AppNativeSelect } from '../ui/AppNativeSelect';
import { PiPersonalMemorySourcePermission } from './PiPersonalMemorySourcePermission';
import { SettingsInline, SettingsStack } from './hana-settings/SettingsPrimitives';
import { SettingsSection } from './hana-settings/SettingsSection';

export function PiHistoryMemorySettings() {
  const [sessions,setSessions]=useState<Array<{id:string;title:string}>>();
  const [session,setSession]=useState('');
  const [entries,setEntries]=useState<HistorySource[]>([]);
  const [next,setNext]=useState<number|null>(null);
  const [preview,setPreview]=useState<HistoryPreview>();
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [index,setIndex]=useState<HistoryIndexStatus>();
  const request = useRef(0);
  const operation = useRef(false);
  useEffect(()=>{
    let mounted=true;
    const api=window.omniEdu;
    if (!api) {setSessions([]);return;}
    void api.listHistoryMemorySessions().then(result=>{
      if (mounted) {
        setSessions(result.ok?result.value:[]);
        if (!result.ok)setNotice('暂时无法读取历史对话。');
      }
    }).catch(()=>{if(mounted){setSessions([]);setNotice('暂时无法读取历史对话。');}});
    const poll=()=>void api.getHistoryMemoryIndex().then(result=>{if(mounted&&result.ok)setIndex(result.value);}).catch(()=>undefined);
    poll();
    const timer=setInterval(poll,3500);
    return ()=>{mounted=false;request.current++;clearInterval(timer);};
  },[]);
  async function load(id:string,offset=0) {
    const api=window.omniEdu;
    if(!api)return;
    const token=++request.current;
    setBusy(true);
    try {
      const reply=await api.listHistoryMemory(id,offset);
      if(token!==request.current)return;
      if(!reply.ok)throw Error(reply.error);
      setEntries(old=>offset?[...old,...reply.value.items]:reply.value.items);
      setNext(reply.value.nextOffset);
    } catch {
      if(token===request.current)setNotice('无法读取该对话的来源。');
    } finally {
      if(token===request.current)setBusy(false);
    }
  }
  async function read(source:HistorySource,offset=0) {
    const token=++request.current;
    setBusy(true);setNotice('');
    try {
      const reply=await window.omniEdu?.previewHistoryMemory(source.ref,offset,false);
      if(token!==request.current)return;
      if(!reply?.ok)throw Error('preview');
      setPreview(reply.value);
    } catch {
      if(token===request.current)setNotice('来源已变化或不可读，请刷新后再核对。');
    } finally {if(token===request.current)setBusy(false);}
  }
  async function change(source:HistorySource,action:HistoryAccessAction) {
    if(operation.current)return;
    operation.current=true;setBusy(true);setNotice('');
    try {
      const reply=await window.omniEdu?.changeHistoryMemory(source.ref,source.accessRevision,action);
      if(!reply?.ok)throw Error('change');
      setEntries(old=>old.map(item=>item.sourceId===source.sourceId?
        {...item,...reply.value,label:item.label,sessionTitle:item.sessionTitle}:item));
      setPreview(undefined);setConfirm('');
      setNotice(action==='allow'||action==='restore'?'已允许查找。用于对话时还需选择该来源。':
        reply.value.cleanup==='pending'?'已停止参考，派生索引清理中。':'已停止参考。');
    } catch {setNotice('操作未能完成，请刷新查看最新状态。');}
    finally {operation.current=false;setBusy(false);}
  }
  return <SettingsSection title="可参考的历史" description="选择允许小智查找的记录。候选只供本机预览，聊天中需要另选本次引用。" data-testid="pi-history-memory-settings">
    <SettingsStack gap="md">
      {index&&<SettingsInline>
        <p role="status" data-testid="history-index-status">{!index.configured?'使用本机关键词查找':index.rebuilding!==null?'正在重建历史索引':
          index.failed?'部分索引任务失败':index.ready?'历史索引可用':index.pending?'正在准备历史索引':'还没有已建立索引的历史'}</p>
        {index.configured&&<Button size="sm" variant="ghost" isDisabled={busy||index.rebuilding!==null||!index.ready}
          data-testid="history-index-rebuild" onPress={()=>void window.omniEdu?.rebuildHistoryMemoryIndex().then(result=>{
            if(result.ok)setIndex(result.value);else setNotice('重建未开始，请刷新后重试。');
          }).catch(()=>setNotice('重建未开始，请刷新后重试。'))}>重建历史索引</Button>}
      </SettingsInline>}
      <label>选择历史对话<AppNativeSelect value={session} disabled={!sessions||busy} data-testid="history-settings-session"
        onChange={event=>{const id=event.target.value;setSession(id);setEntries([]);setPreview(undefined);setConfirm('');setNotice('');
          if(id)void load(id);}}>
        <option value="">请选择</option>
        {sessions?.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
      </AppNativeSelect></label>
      {busy&&<p role="status">正在处理…</p>}
      {notice&&<p role="status" data-testid="history-settings-notice">{notice}</p>}
      {session&&!busy&&!entries.length&&<p>此对话没有可参考的教师记录。</p>}
      {session&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load(session)}>刷新记录</Button>}
      {entries.map(item=><article key={item.sourceId} data-testid={'history-settings-source-'+item.ref.recordId}>
        <h3>{item.label}</h3>
        <p>{item.state==='forgotten'?'已遗忘':item.state==='disabled'?'已暂停':item.allowed?'允许查找':'未授权'}
          {item.cleanup==='pending'?' · 索引清理中':item.cleanup==='done'?' · 索引已清理':''}</p>
        <SettingsInline>
          <Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void read(item)}>查看来源</Button>
          {item.allowed&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void change(item,'disable')}>暂停参考</Button>}
          {!item.allowed&&item.state==='active'&&preview?.source.sourceId===item.sourceId&&
            <Button size="sm" variant="secondary" data-testid="history-settings-allow" isDisabled={busy}
              onPress={()=>void change(item,'allow')}>允许查找</Button>}
          {item.state==='disabled'&&preview?.source.sourceId===item.sourceId&&
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void change(item,'restore')}>恢复参考</Button>}
          {item.accessRevision>0&&item.state!=='forgotten'&&<Button size="sm" variant="ghost" isDisabled={busy}
            onPress={()=>setConfirm(item.sourceId)}>不再记住</Button>}
        </SettingsInline>
        {confirm===item.sourceId&&<><p>之后不会再引用此记录。原对话仍可查看。</p><SettingsInline>
          <Button size="sm" variant="secondary" isDisabled={busy} data-testid="history-settings-forget"
            onPress={()=>void change(item,'forget')}>确认遗忘</Button>
          <Button size="sm" variant="ghost" onPress={()=>setConfirm('')}>取消</Button>
        </SettingsInline></>}
        {preview?.source.sourceId===item.sourceId&&<section aria-label="脱敏原文" data-testid="history-settings-preview">
          <p>{preview.text}</p>
          {preview.nextOffset!==null&&<Button size="sm" variant="ghost" isDisabled={busy}
            onPress={()=>void read(item,preview.nextOffset??0)}>阅读后续原文</Button>}
          {item.state==='active'&&<PiPersonalMemorySourcePermission key={item.ref.sourceVersion} source={item.ref} disabled={busy}/>}
        </section>}
      </article>)}
      {next!==null&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load(session,next)}>加载更多</Button>}
    </SettingsStack>
  </SettingsSection>;
}
