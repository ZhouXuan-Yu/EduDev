import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {TeacherCandidateSummary} from '../../../shared/teacher-candidates';
import {SettingsSection} from './hana-settings/SettingsSection';
import {SettingsStack} from './hana-settings/SettingsPrimitives';
const errors={invalid_input:'记录参数无效，请刷新。',permission_denied:'当前会话已不可用。',configuration:'候选记录暂时无法核对，请刷新重试。',conflict:'候选已变化，请刷新后重试。',busy:'任务正在运行，请稍后再核对。'};
const phases={collecting:'收集表达反馈',trial:'独立任务试用',accepted:'已采用',failed:'未通过表达检查',superseded:'已停用'};
const reasons={source_changed:'原消息、回答或关联来源已变化',legacy_source:'旧候选缺少可靠来源记录',baseline_changed:'原偏好版本已变化',teacher_rejected:'教师已拒绝继续学习',quality_failed:'原表达检查未通过',metric_changed:'表达检查规则已变化，旧候选不再采用'};
const labels:Record<string,string>={concise:'简洁',detailed:'详细',step_by_step:'分步',continuous:'连贯叙述',table:'表格',paragraph:'段落'};
export function PiCandidateHistory({sessionId,running,onBusyChange}:{sessionId:string;running:boolean;onBusyChange?:(busy:boolean)=>void}){
 const[items,setItems]=useState<TeacherCandidateSummary[]>(),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);const live=useRef(true),generation=useRef(0),lock=useRef(false);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 async function refresh(){const own=++generation.current;setLoading(true);setNotice('');try{const api=window.omniEdu;if(!api)throw Error();const r=await api.getTeacherCandidates(sessionId);if(!live.current||own!==generation.current)return;if(r.ok)setItems(r.value);else setNotice(errors[r.error]);}catch{if(live.current&&own===generation.current)setNotice(errors.configuration);}finally{if(live.current&&own===generation.current)setLoading(false);}}
 useEffect(()=>{live.current=true;setItems(undefined);void refresh();return()=>{live.current=false;generation.current++;};},[sessionId]);
 async function act(item:TeacherCandidateSummary,reject:boolean){if(lock.current||running)return;lock.current=true;setBusy(true);setNotice('');const own=++generation.current;try{const api=window.omniEdu;if(!api)throw Error();const input={sessionId,id:item.id,revision:item.revision},r=await(reject?api.rejectTeacherCandidate(input):api.evaluateTeacherCandidate(input));if(!live.current||own!==generation.current)return;if(r.ok){setItems(v=>v?.map(x=>x.id===item.id?r.value:x));setNotice(reject?'已停止学习这条候选；已采用版本请通过对话撤销。':r.value.sourceCurrent?'已从本机原始来源重新核对表达指标；这不代表教学答案正确，也不会自动采用。':'原来源已失效，这条记录不能作为新的采用依据。');}else setNotice(errors[r.error]);}catch{if(live.current&&own===generation.current)setNotice(errors.configuration);}finally{lock.current=false;if(live.current)setBusy(false);}}
 return <SettingsSection title="表达偏好候选（高级）" description="只学习表达方式；学生成绩、答案和教学事实不由这些候选修改。复核在本机完成。"><SettingsStack gap="sm">
  <Button size="sm" variant="ghost" data-testid="pi-candidates-refresh" isDisabled={busy||running} onPress={()=>void refresh()}>刷新候选</Button>
  {loading?<p role="status">正在读取候选…</p>:!items?<p>候选尚未读取，请重试。</p>:!items.length?<p data-testid="pi-candidates-empty">尚无表达候选。明确偏好可在对话中提出；隐式反馈需要独立样本与试用。</p>:<><p>最近 {items.length} 条候选，最多20条。复核反映当前表达检查结果，历史候选保持原状态，不会自动重新启用。已采用版本可在对话中说“撤销上次偏好”。</p>{items.map(item=><section key={item.id} data-testid={'pi-candidate-'+item.id}>
   <strong>{phases[item.status]} · {Object.values(item.patch).map(v=>labels[v]||v).join('、')}</strong><p>原偏好版本 {item.baselineRevision} · 来源{item.sourceCurrent?'有效':'已失效'}{item.activeVersion?` · 当前采用版本 ${item.activeVersion}`:!item.baselineCurrent?' · 原偏好版本已变化':''}</p>
   <p>训练样本 {item.training.passed}/{item.training.total} 通过表达检查（已评估 {item.training.evaluated}）；独立试用{({not_started:'尚未开始',waiting:'等待完整回答',passed:'表达检查通过',failed:'表达检查未通过'})[item.holdout]}。</p>{item.reason&&<p>{reasons[item.reason]}</p>}
   <div className="pi-settings-actions"><Button size="sm" variant="secondary" data-testid={'pi-candidate-evaluate-'+item.id} isDisabled={busy||running} onPress={()=>void act(item,false)}>复核来源与指标</Button><Button size="sm" variant="ghost" data-testid={'pi-candidate-reject-'+item.id} isDisabled={busy||running||!['collecting','trial'].includes(item.status)} onPress={()=>void act(item,true)}>不再学习这条</Button></div>
  </section>)}</>}{busy&&<p role="status">正在核对候选…</p>}{notice&&<p role="status" data-testid="pi-candidates-notice">{notice}</p>}
 </SettingsStack></SettingsSection>;
}
