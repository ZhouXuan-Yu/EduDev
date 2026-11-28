import {historyAttributionLabel} from '../../../shared/xiaozhi-history-memory';
import { useRef, useState } from 'react';
import { Button, Input } from '@heroui/react';
import type { HistoryCandidate, HistoryDiscovery, HistoryPreview, PendingHistoryReference } from '../../../shared/xiaozhi-history-memory';
import type { XiaozhiMemoryScope } from '../../../shared/xiaozhi-memory';

export function PiHistoryLookup({sessionId,scope,query,pending,includeSelected=false,onClose,onConfirmed,onStaged}:{
  sessionId:string;scope:XiaozhiMemoryScope;query:string;includeSelected?:boolean;pending:readonly PendingHistoryReference[];
  onClose:()=>void;onConfirmed:()=>Promise<void>;onStaged:(intent:PendingHistoryReference)=>void;
}) {
  const [input,setInput]=useState(query);
  const [priorTerm,setPriorTerm]=useState(false);
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
      const reply=await window.omniEdu?.discoverHistoryMemory(sessionId,input,includeSelected,priorTerm);
      if(!reply?.ok)throw Error('discover');
      setResult({scopeVersion:version,reply:reply.value});
    }catch{setMessage('无法查找，请核对许可或重试。');}
    finally{work.current=false;setBusy(false);}
  }
  async function show(source:HistoryCandidate,offset=0) {
    if(work.current)return;
    work.current=true;setBusy(true);setMessage('');
    try{
      const reply=await window.omniEdu?.previewHistoryMemory(source.ref,offset,true,source.ticket);
      if(!reply?.ok||source.generation!==reply.value.source.generation)throw Error('source_changed');
      setPreview({...reply.value,candidate:source});
    }catch{setPreview(undefined);setMessage('来源的内容或许可已变化，请重新查找。');}
    finally{work.current=false;setBusy(false);}
  }
  async function confirm(scopeKind:'task'|'session') {
    if(!preview||work.current)return;
    if(result?.scopeVersion!==scope.version){setMessage('会话引用范围已变化，请重新查找。');return;}
    const selected=new Set([...scope.selections.map(item=>item.id),...pending.map(item=>item.sourceId),preview.source.sourceId]);
    if(selected.size>12){setMessage('任务与会话合计最多引用 12 项，请先取消一项。');return;}
    work.current=true;setBusy(true);setMessage('');
    try{
      if(scopeKind==='task'){
        const existing=pending.find(item=>item.sourceId===preview.source.sourceId&&item.scopeVersion===scope.version);
        if(existing){onStaged(existing);return;}
        const reply=await window.omniEdu?.stageHistoryMemory(sessionId,scope.version,preview.candidate.ticket);
        if(!reply?.ok)throw Error(reply?.error||'save');
        onStaged(reply.value);
      }else{
        const reply=await window.omniEdu?.confirmHistoryMemory(sessionId,scope.version,preview.candidate.ticket);
        if(!reply?.ok)throw Error(reply?.error||'save');
        await onConfirmed();
      }
    }catch{setMessage('选择未保存。请核对当前范围，重新查找。');}
    finally{work.current=false;setBusy(false);}
  }
  return <section aria-label="查找历史记录" data-testid="history-lookup" data-mode={result?.reply.mode}
    onKeyDown={event=>{
      if(event.key==='Escape'&&!event.nativeEvent.isComposing&&!work.current){
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }}>
    <label htmlFor="history-lookup-query">要查找的历史</label>
    <Input id="history-lookup-query" autoFocus value={input} maxLength={1800}
      data-testid="history-lookup-query" onChange={event=>setInput(event.target.value)}
      onKeyDown={event=>{
        if(event.key==='Enter'&&!event.nativeEvent.isComposing){
          event.preventDefault();
          event.stopPropagation();
          void search();
        }
      }} />
    {scope.teachingTarget&&<label><input type="checkbox" checked={priorTerm} disabled={busy}
      onChange={event=>{setPriorTerm(event.target.checked);setPreview(undefined);setResult(undefined);setMessage('');}} />
      查找本班上学期的资料（仅本次比较）</label>}
    <Button size="sm" variant="secondary" isDisabled={busy||!input.trim()} data-testid="history-lookup-search"
      onPress={()=>void search()}>查找</Button>
    {busy&&<p role="status">正在处理…</p>}
    {message&&<p role="status" data-testid="history-lookup-message">{message}</p>}
    {result?.reply.reason==='empty_scope'&&<p>当前没有更多获准查找的来源。可在“设置 → 教师记忆”选择。</p>}
    {result?.reply.reason==='service_unavailable'&&<p>历史索引暂不可用，当前使用本机关键词查找。</p>}
    {result&&result.reply.reason!=='empty_scope'&&!result.reply.candidates.length&&<p>没有找到相符的历史。</p>}
    <ul>{result?.reply.candidates.map(source=><li key={source.sourceId}>
      <Button size="sm" variant="ghost" isDisabled={busy} data-testid={'history-candidate-'+source.ref.recordId}
        onPress={()=>void show(source)}>{source.sessionTitle} · {source.label}</Button>
    </li>)}</ul>
    {preview&&<section data-testid="history-lookup-preview" aria-label="来源预览">
      <p>{preview.source.sessionTitle} · {preview.source.label}</p>
      {preview.origin?.attributedContent&&<p>{historyAttributionLabel(preview.origin.attributedContent)} · 原文未核实发生时间</p>}
          <p>{preview.text}</p>
      {preview.nextOffset!==null&&<Button size="sm" variant="ghost" isDisabled={busy}
        onPress={()=>void show(preview.candidate,preview.nextOffset??0)}>查阅下一段</Button>}
      <Button size="sm" variant="secondary" isDisabled={busy} data-testid="history-lookup-use" onPress={()=>void confirm('task')}>{preview.candidate.comparisonTerm?'仅用于本次比较':'随任务引用'}</Button>
      {!preview.candidate.comparisonTerm&&<Button size="sm" variant="ghost" isDisabled={busy} data-testid="history-lookup-use-session"
        onPress={()=>void confirm('session')}>本会话引用</Button>}
    </section>}
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={onClose}>不再查找</Button>
  </section>;
}
