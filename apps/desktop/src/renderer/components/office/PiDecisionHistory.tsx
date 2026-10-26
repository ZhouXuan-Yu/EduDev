import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { DECISION_LABELS, type DecisionSummary, type DecisionInput } from '../../../shared/xiaozhi-decisions';
import { SettingsSection } from './hana-settings/SettingsSection';
import { SettingsStack } from './hana-settings/SettingsPrimitives';
import {ROUTE_LABELS,type RouteChoice} from '../../../shared/xiaozhi-routes';
const messages = {invalid_input:'记录参数无效，请刷新。',permission_denied:'记录来源不可用或不属于当前会话。',configuration:'暂时无法核对策略记录，请刷新重试。',conflict:'记录或来源版本已变化，请刷新。',busy:'任务正在执行，请结束后再复核。',authentication:'请先配置可用的 DeepSeek 连接。'};
export function PiDecisionHistory({sessionId,running,onBusyChange}:{sessionId:string;running:boolean;onBusyChange?:(busy:boolean)=>void}) {
  const [records,setRecords]=useState<DecisionSummary[]>(),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const generation=useRef(0),live=useRef(true),lock=useRef(false);
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
  async function refresh() {
    const own=++generation.current;setLoading(true);setNotice('');
    try {const result=await window.omniEdu?.getXiaozhiDecisions(sessionId);if(!live.current||own!==generation.current)return;if(result?.ok)setRecords(result.value);else setNotice(result?messages[result.error]:'连接暂时不可用。');}
    catch {if(live.current&&own===generation.current)setNotice(messages.configuration);}
    finally {if(live.current&&own===generation.current)setLoading(false);}
  }
  useEffect(()=>{live.current=true;setRecords(undefined);setNotice('');void refresh();return()=>{live.current=false;generation.current++;};},[sessionId]);
  async function act(record:DecisionSummary,kind:'replay'|'shadow'|'route') {
    if(lock.current||running)return;lock.current=true;setBusy(true);setNotice('');const own=++generation.current;
    const input:DecisionInput={sessionId,id:record.id,revision:record.revision};
    try {
      if(kind==='replay') {const result=await window.omniEdu?.replayXiaozhiDecision(input);if(!live.current||own!==generation.current)return;setNotice(result?.ok?(result.value.sourceCurrent?'原版本选择可离线复现，来源版本仍有效。':'原版本选择可离线复现；当前来源已变化，不作为新的采用依据。'):result?messages[result.error]:'连接暂时不可用。');}
      else {const result=await(kind==='route'?window.omniEdu?.reviewXiaozhiRoute(input):window.omniEdu?.reviewXiaozhiDecision(input));if(!live.current||own!==generation.current)return;if(result?.ok){setRecords(values=>values?.map(v=>v.id===record.id?result.value:v));const receipt=kind==='route'?result.value.route?.shadow:result.value.shadow;setNotice(receipt?.state==='failed'?'复核未取得有效结果，实际选择保留。':receipt?.state==='stale'?'来源已变化，本次复核已弃用。':'复核已记录，仅供对照，实际偏好与教学事实保持原版本。');}else setNotice(result?messages[result.error]:'连接暂时不可用。');}
    }catch{if(live.current&&own===generation.current)setNotice(messages.configuration);}
    finally{lock.current=false;if(live.current)setBusy(false);}
  }
  return <SettingsSection title="策略选择记录（高级）" description="查看本会话准备采用的呈现策略与来源版本。记录不包含教师原话、学生事实或模型私有推理。">
    <SettingsStack gap="sm"><Button size="sm" variant="ghost" data-testid="pi-decisions-refresh" isDisabled={busy||running} onPress={()=>void refresh()}>刷新选择记录</Button>
      {loading?<p role="status">正在读取策略记录…</p>:!records?<p>策略记录尚未读取，请刷新重试。</p>:!records.length?<p data-testid="pi-decisions-empty">还没有选择记录。新任务会记录实际选择，旧历史不补造记录。</p>:<><p>显示最近 {records.length} 条记录，最多 50 条。</p>{records.map(record=><section key={record.id} data-testid={`pi-decision-${record.id}`}>
        <strong>{DECISION_LABELS[record.outcome]}</strong><p>偏好版本 {record.preferenceRevision} · 规则版本 {record.specVersion} · {new Date(record.at).toLocaleString()} · {record.sourceCurrent?'来源版本有效':'来源或规则版本已变化'}{record.candidate?' · 关联偏好候选':''}</p>
        {record.shadow&&<p data-testid={`pi-decision-shadow-${record.id}`}>{record.shadow.state==='failed'?'复核未完成':record.shadow.state==='stale'?'复核已过期':record.shadow.result==='abstain'?'复核未给出选择':`对照建议：${DECISION_LABELS[record.shadow.result]}`} · {record.shadow.elapsedMs} ms · 仅作对照</p>}
        {record.route&&<div data-testid={`pi-decision-route-${record.id}`}><p>本机路径建议：{ROUTE_LABELS[record.route.suggested]} · 仅作对照，不授权或调度工具</p>{record.route.observed?<><p>实际工具类别：{Object.entries(record.route.observed.counts).map(([key,count])=>`${ROUTE_LABELS[key as RouteChoice]} ${count}`).join('、')||'未调用工具'}</p><p>回执成功 {record.route.observed.succeeded} · 失败 {record.route.observed.failed} · 未确认 {record.route.observed.unknown} · {record.route.observed.sourceCurrent?'回执仍可核对':'回执已变化或不可核对'}{record.route.observed.state==='unavailable'?' · 超出回执范围':''}。这不是产物或教学正确性验证。</p></>:<p>工具路径尚未核对，不能视为没有工具。</p>}{record.route.shadow&&<p>{record.route.shadow.state==='failed'?'路径复核未完成':record.route.shadow.state==='stale'?'路径复核已过期':record.route.shadow.result==='abstain'?'路径复核未给出选择':`路径对照：${ROUTE_LABELS[record.route.shadow.result]}`} · 仅供对照</p>}</div>}
        <div className="pi-settings-actions"><Button size="sm" variant="secondary" data-testid={`pi-decision-replay-${record.id}`} isDisabled={busy||running} onPress={()=>void act(record,'replay')}>离线回放</Button><Button size="sm" variant="ghost" data-testid={`pi-decision-review-${record.id}`} isDisabled={busy||running||!record.sourceCurrent} onPress={()=>void act(record,'shadow')}>用当前模型复核选择</Button>{record.route&&<Button size="sm" variant="ghost" data-testid={`pi-decision-route-review-${record.id}`} isDisabled={busy||running||!record.sourceCurrent} onPress={()=>void act(record,'route')}>复核路径建议</Button>}</div>
      </section>)}</>}{busy&&<p role="status" data-testid="pi-decisions-busy">正在核对策略记录…</p>}{notice&&<p role="status" data-testid="pi-decisions-notice">{notice}</p>}
    </SettingsStack>
  </SettingsSection>;
}
