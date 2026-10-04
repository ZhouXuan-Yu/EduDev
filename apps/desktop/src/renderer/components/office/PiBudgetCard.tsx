import { useEffect,useRef,useState } from 'react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import type { XiaozhiBudget, XiaozhiBudgetSettings, XiaozhiUsage } from '../../../shared/xiaozhi-agent';

const fields: {key:keyof XiaozhiBudget;label:string;min:number;max:number;scale:number}[]=[
  {key:'maxModelCalls',label:'模型请求上限',min:1,max:64,scale:1},
  {key:'maxToolCalls',label:'工具调用上限',min:1,max:256,scale:1},
  {key:'maxTokens',label:'Token 观察阈值',min:1,max:1000000,scale:1},
  {key:'activeMs',label:'活动时间（秒）',min:1,max:120,scale:1000},
  {key:'waitMs',label:'单次回答 / 确认等待（秒）',min:1,max:300,scale:1000},
];
const reasons:Record<NonNullable<XiaozhiUsage['exhausted']>,string>={model_calls:'模型请求上限',tool_calls:'工具调用上限',tokens:'Token 观察阈值',active_time:'活动时间上限',wait_time:'教师等待上限'};
export function PiBudgetCard({sessionId,settings,usage,running,onSave}:{sessionId:string;settings:XiaozhiBudgetSettings;usage?:XiaozhiUsage;running:boolean;onSave:(version:number,budget:XiaozhiBudget)=>Promise<void>}) {
  const [draft,setDraft]=useState(settings.budget),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
  useEffect(()=>{setDraft(settings.budget);},[sessionId,settings.version]);
  async function save(){if(running||lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await onSave(settings.version,draft);setMessage('已保存，下轮生效。');}catch(error){setMessage(error instanceof Error?error.message:'预算未保存，请重试。');}finally{lock.current=false;setBusy(false);}}
  return <section className="pi-budget-card" data-testid="pi-budget-card">
    <h4>本轮用量</h4><div data-testid="pi-usage-receipt">
      {usage ? <>
        <p>模型请求 {usage.modelCalls} / {usage.budget.maxModelCalls} · 工具 {usage.toolCalls} / {usage.budget.maxToolCalls}</p>
        <p>Token：{usage.tokens?`${usage.tokens.total.toLocaleString()}${usage.completeness==='partial'?'（部分记录）':''}`:'未知'}</p>
        {usage.tokens && <p>输入 {usage.tokens.input} · 输出 {usage.tokens.output}<br/>缓存读取 {usage.tokens.cacheRead} · 缓存写入 {usage.tokens.cacheWrite}</p>}
        <p>活动 {(usage.activeMs/1000).toFixed(1)} 秒 · 等待 {(usage.waitingMs/1000).toFixed(1)} 秒</p>
        {usage.exhausted && <p role="status">已达到{reasons[usage.exhausted]}，后续调用已停止。</p>}
      </> : <p>发送后显示实际用量。</p>}
      <p>费用：未知</p><p className="pi-budget-help">Token 为供应商已报告用量；阈值限制下一次请求，单次请求可能超过。</p>
    </div>
    <ChatTool defaultExpanded={false} state="output-available" data-testid="pi-budget-settings">
      <ChatTool.Trigger data-testid="pi-budget-expand">运行预算</ChatTool.Trigger>
      <ChatTool.Content>
        <form onSubmit={event=>{event.preventDefault();void save();}}>
          {fields.map(field=><label key={field.key}>{field.label}<input aria-label={field.label} type="number" data-testid={`pi-budget-${field.key}`} min={field.min} max={field.max} required step="1" value={draft[field.key]/field.scale} disabled={running||busy}
            onChange={event=>setDraft(previous=>({...previous,[field.key]:Number(event.target.value)*field.scale}))}/></label>)}
          <button type="submit" data-testid="pi-budget-save" disabled={running||busy}>{busy?'正在保存…':'保存预算'}</button>
          {running && <p>当前轮预算已固定，结束后可修改。</p>}
          <p>等待教师回答或确认时暂停活动计时，仍受等待上限约束。</p>
          {message && <p role="status" data-testid="pi-budget-feedback">{message}</p>}
        </form>
      </ChatTool.Content>
    </ChatTool>
  </section>;
}
