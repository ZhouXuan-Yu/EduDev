import { useRef, useState } from 'react';
import { Button, Input } from '@heroui/react';
import type { HistoryCandidate, HistoryDiscovery, HistoryPreview } from '../../../shared/xiaozhi-history-memory';
import type { XiaozhiMemoryScope } from '../../../shared/xiaozhi-memory';

export function PiHistoryLookup({sessionId,scope,query,onClose,onConfirmed}:{
  sessionId:string;scope:XiaozhiMemoryScope;query:string;onClose:()=>void;onConfirmed:()=>Promise<void>;
}) {
  const [input,setInput]=useState(query);
  const [result,setResult]=useState<{scopeVersion:number;reply:HistoryDiscovery}>();
  const [preview,setPreview]=useState<HistoryPreview & {candidate:HistoryCandidate}>();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const work=useRef(false);
  async function search() {
    if(work.current||!input.trim())return;
    work.current=true;setBusy(true);setMessage('');setPreview(undefined);setResult(undefined);
    const version=scope.version;
    try{
      const reply=await window.omniEdu?.discoverHistoryMemory(sessionId,input);
      if(!reply?.ok)throw Error('discover');
      setResult({scopeVersion:version,reply:reply.value});
    }catch{setMessage('无法查找，请核对许可或重试。');}
    finally{work.current=false;setBusy(false);}
  }
  async function show(source:HistoryCandidate,offset=0) {
    if(work.current)return;
    work.current=true;setBusy(true);setMessage('');
    try{
      const reply=await window.omniEdu?.previewHistoryMemory(source.ref,offset,true);
      if(!reply?.ok||source.generation!==reply.value.source.generation)throw Error('source_changed');
      setPreview({...reply.value,candidate:source});
    }catch{setPreview(undefined);setMessage('来源的内容或许可已变化，请重新查找。');}
    finally{work.current=false;setBusy(false);}
  }
  async function confirm() {
    if(!preview||work.current)return;
    if(result?.scopeVersion!==scope.version){setMessage('会话引用范围已变化，请重新查找。');return;}
    if(scope.selections.length>=12){setMessage('本会话已选择 12 项，请先取消一项。');return;}
    work.current=true;setBusy(true);setMessage('');
    try{
      const reply=await window.omniEdu?.confirmHistoryMemory(sessionId,scope.version,preview.candidate.ticket);
      if(!reply?.ok)throw Error(reply?.error||'save');
      await onConfirmed();
    }catch{setMessage('选择未保存。请核对当前范围，重新查找。');}
    finally{work.current=false;setBusy(false);}
  }
  return <section data-testid="history-lookup" data-mode={result?.reply.mode}>
    <label htmlFor="history-lookup-query">要查找的历史</label>
    <Input id="history-lookup-query" value={input} maxLength={1800}
      data-testid="history-lookup-query" onChange={event=>setInput(event.target.value)} />
    <Button size="sm" variant="secondary" isDisabled={busy||!input.trim()} data-testid="history-lookup-search"
      onPress={()=>void search()}>查找</Button>
    {busy&&<p role="status">正在处理…</p>}
    {message&&<p role="status" data-testid="history-lookup-message">{message}</p>}
    {result?.reply.reason==='empty_scope'&&<p>当前没有更多获准查找的来源。可在“设置 → 教师记忆”选择。</p>}
    {result?.reply.reason==='service_unavailable'&&<p>历史索引暂不可用，当前使用本机关键词查找。</p>}
    {result&&!result.reply.reason&&!result.reply.candidates.length&&<p>没有找到相符的历史。</p>}
    <ul>{result?.reply.candidates.map(source=><li key={source.sourceId}>
      <Button size="sm" variant="ghost" isDisabled={busy} data-testid={'history-candidate-'+source.ref.recordId}
        onPress={()=>void show(source)}>{source.sessionTitle} · {source.label}</Button>
    </li>)}</ul>
    {preview&&<section data-testid="history-lookup-preview" aria-label="来源预览">
      <p>{preview.source.sessionTitle} · {preview.source.label}</p>
      <p>{preview.text}</p>
      {preview.nextOffset!==null&&<Button size="sm" variant="ghost" isDisabled={busy}
        onPress={()=>void show(preview.candidate,preview.nextOffset??0)}>查阅下一段</Button>}
      <Button size="sm" variant="secondary" isDisabled={busy} data-testid="history-lookup-use" onPress={()=>void confirm()}>本次引用</Button>
    </section>}
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={onClose}>不再查找</Button>
  </section>;
}
