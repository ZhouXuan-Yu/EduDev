import {useEffect, useRef, useState} from 'react';
import {Button, Label, ListBox, Select, TextArea} from '@heroui/react';
import type {AiMemoryEntry, AiMemorySurface} from '../../../shared/contracts';
import {DisclosureCard} from '../ui/DisclosureCard';
import {SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';

const surfaces: Array<{id:AiMemorySurface; name:string}> = [
  {id:'chat',name:'对话'}, {id:'notebook',name:'备课本'}, {id:'quiz',name:'练习'},
  {id:'kb',name:'知识库'}, {id:'book',name:'讲义'}, {id:'partner',name:'学习伙伴'}, {id:'cowriter',name:'共创'},
];

function EntryEditor({entry, onSaved, refresh}: {
  entry:AiMemoryEntry;
  onSaved:(entry:AiMemoryEntry)=>void;
  refresh:()=>Promise<void>;
}) {
  const [draft,setDraft]=useState<{text:string;version:number}>();
  const [pending,setPending]=useState<string>();
  const [message,setMessage]=useState<{error:boolean;text:string}>();
  const text=draft?.text ?? entry.text;

  async function save() {
    const api=window.omniEdu;
    if (!api || !draft || pending) return;
    const requestId=crypto.randomUUID();
    setPending(requestId);
    setMessage(undefined);
    try {
      const saved=await api.updateAiMemoryEntry(entry.id,{version:draft.version,text:draft.text},requestId);
      onSaved(saved);
      setDraft(undefined);
      setMessage({error:false,text:'已保存修订。'});
    } catch(error) {
      const cause=error instanceof Error ? error.message : '';
      if (/version conflict/i.test(cause)) {
        await refresh();
        setDraft(current=>current && {...current,version:-1});
        setMessage({error:true,text:'版本冲突。已保留草稿。请核对最新版本，再应用草稿。'});
      } else if (/\bcancelled\b/i.test(cause)) {
        setMessage({error:false,text:'已取消保存，草稿已保留。'});
      } else {
        setMessage({error:true,text:/\bbusy\b/i.test(cause) ? '数据库正忙，请稍后重试。' : '保存失败，请稍后重试。'});
      }
    } finally {
      setPending(undefined);
    }
  }

  return <SettingsStack gap="sm">
    <label htmlFor={'memory-l2-'+entry.id}>{entry.section} · 版本 {entry.version}</label>
    {draft?.version === -1 && <p>当前已保存内容：{entry.text}</p>}
    <TextArea id={'memory-l2-'+entry.id} data-testid={'memory-l2-text-'+entry.id}
      rows={3} fullWidth value={text} disabled={Boolean(pending)} onChange={event=>
        setDraft({version:draft?.version ?? entry.version,text:event.target.value})}/>
    <SettingsInline>
      <Button variant="secondary" size="sm" data-testid={'memory-save-l2-'+entry.id}
        isDisabled={Boolean(pending) || !draft || draft.version < 0 || !text.trim() || text.trim()===entry.text}
        onPress={()=>void save()}>保存修订</Button>
      {pending && <Button variant="ghost" size="sm" data-testid={'memory-cancel-l2-'+entry.id}
        onPress={()=>void window.omniEdu?.cancelAiMemoryEntryUpdate(pending).catch(()=>undefined)}>取消保存</Button>}
      {draft?.version === -1 && <Button variant="ghost" size="sm" data-testid={'memory-reapply-l2-'+entry.id}
        onPress={()=>{setDraft({...draft,version:entry.version});setMessage(undefined);}}>应用草稿到当前版本</Button>}
    </SettingsInline>
    {message && <p role={message.error?'alert':'status'}
      data-testid={message.error?'memory-error':message.text.startsWith('已取消')?'memory-cancelled':'memory-success'}>{message.text}</p>}
  </SettingsStack>;
}

function L2Entries() {
  const [surface,setSurface]=useState<AiMemorySurface>('chat');
  const [entries,setEntries]=useState<AiMemoryEntry[]>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const request=useRef(0);
  const target=useRef(surface);
  async function load(next:AiMemorySurface) {
    const own=++request.current;
    setLoading(true);
    setError(false);
    try {
      const api=window.omniEdu;
      if (!api) throw new Error('unavailable');
      const result=await api.getAiMemoryDocument(next);
      if (request.current===own) setEntries((result?.entries ?? []).filter(entry=>entry.status!=='deleted'));
    } catch {
      if (request.current===own) setError(true);
    } finally {
      if (request.current===own) setLoading(false);
    }
  }
  useEffect(()=>{
    void load(surface);
    return ()=>{request.current++;};
  },[surface]);

  return <SettingsStack gap="md">
    <SettingsInline>
      <Select selectedKey={surface} onSelectionChange={key=>{
        const next=surfaces.find(item=>item.id===key);
        if (!next || next.id===surface) return;
        target.current=next.id;
        setEntries(undefined);
        setSurface(next.id);
      }}>
        <Label>记忆来源</Label>
        <Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger>
        <Select.Popover><ListBox>{surfaces.map(item=>
          <ListBox.Item id={item.id} key={item.id} textValue={item.name}>{item.name}</ListBox.Item>
        )}</ListBox></Select.Popover>
      </Select>
      <Button variant="ghost" size="sm" data-testid="memory-refresh" isDisabled={loading}
        onPress={()=>void load(surface)}>刷新记忆</Button>
    </SettingsInline>
    {loading && <p role="status">正在读取记忆…</p>}
    {error && <p role="alert">暂时无法读取记忆，请刷新重试。</p>}
    {entries?.length===0 && !loading && !error && <p>这里还没有已保存的记忆。</p>}
    {entries?.map(entry=><EntryEditor key={entry.id} entry={entry}
      refresh={()=>target.current===surface ? load(surface) : Promise.resolve()}
      onSaved={saved=>{
        if(target.current!==surface) return;
        setEntries(current=>current?.map(row=>row.id===saved.id && row.version<saved.version ? saved : row));
        void load(surface);
      }}/>)}
  </SettingsStack>;
}

export function PiL2MemorySettings() {
  const [expanded,setExpanded]=useState(false);
  const [opened,setOpened]=useState(false);
  return <DisclosureCard title="可修订的记忆条目" data-testid="pi-settings-l2-memory"
    isExpanded={expanded} onExpandedChange={value=>{setExpanded(value);if(value)setOpened(true);}}>
    {opened && <L2Entries/>}
  </DisclosureCard>;
}
