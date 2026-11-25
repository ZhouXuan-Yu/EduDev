import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import type {ConfigObservation, ConfigSource,ResolvedAgentConfig,ResolvedAgentConfigResult} from '../../../shared/xiaozhi-resolved-config';
import {THINKING_LABELS} from '../../../shared/xiaozhi-thinking';
import {DisclosureCard} from '../ui/DisclosureCard';
import './pi-resolved-agent-config.css';

const sources:Record<ConfigSource,string>={
  session_binding:'会话绑定',session_selection:'会话选择',global:'全局设置',legacy_compat:'历史设置',
  environment:'启动环境',default:'默认值',teacher_profile:'教学画像',teacher_preferences:'长期偏好',
  session_memory:'会话记忆授权',permission_profile:'会话权限配置',saved_run:'上次运行记录',
};
const statuses={valid:'已读取',invalid:'记录无法识别',unavailable:'暂不可用',not_applicable:'不适用'};
const permissions={request:'按需申请',acceptEdits:'允许本地编辑',approveForMe:'委托审批',fullAccess:'完整访问'};
const runStatuses={running:'进行中',succeeded:'已完成',failed:'失败',blocked:'已停止',waiting_confirmation:'待确认',waiting_input:'待输入'};
const list=(value:ResolvedAgentConfig)=>{
  const {teacher,preferences,memory,credential,lastRun}=value;
  return [
    ['模型',value.model,value.model.value],
    ['思考选项',value.thinking,value.thinking.value&&THINKING_LABELS[value.thinking.value]],
    ['教学画像',teacher,teacher.value&&([teacher.value.subject,teacher.value.grade,teacher.value.textbook].filter(Boolean).join(' · ')||'未填写')],
    ['长期偏好',preferences,preferences.value&&`相关时使用 ${preferences.value.scopeCounts.relevant} 项 · 匹配画像时使用 ${preferences.value.scopeCounts.profile} 项 · 停用 ${preferences.value.scopeCounts.off} 项`],
    ['会话记忆',memory,memory.value&&`${memory.value.enabled?'启用':'停用'} · 已选 ${memory.value.selectedCount} 项`],
    ['会话权限',value.permission,value.permission.value&&permissions[value.permission.value]],
    ['模型凭据',credential,credential.value===null?null:`${credential.value?'已配置':'未配置'} · 未验证`],
    ['上次运行',lastRun,lastRun.value&&`${lastRun.value.model} · 请求 ${THINKING_LABELS[lastRun.value.requested]} · 实际 ${THINKING_LABELS[lastRun.value.effective]}`],
  ] satisfies [string,ConfigObservation<unknown>,string|null][];
};
const errors={invalid_input:'请求已失效，请返回会话后重试。',permission_denied:'此会话已归档或不可用，请选择可用会话。',
  unavailable:'当前配置暂不可用，请刷新或重新启动应用。'};

export function PiResolvedAgentConfig({sessionId,onNavigate}:{sessionId?:string;onNavigate:(tab:string,focus?:string)=>void}){
  const [expanded,setExpanded]=useState(false),[refresh,setRefresh]=useState(0);
  const [result,setResult]=useState<ResolvedAgentConfigResult>();
  useEffect(()=>{
    if(!expanded)return;
    let active=true;
    setResult(undefined);
    const unavailable={ok:false,error:'unavailable'} as const;
    const timeout=setTimeout(()=>{if(active){active=false;setResult(unavailable);}},8000);
    const read=window.omniEdu?.getXiaozhiResolvedAgentConfig?.(sessionId?{sessionId}:undefined);
    void (read??Promise.resolve(unavailable)).then(value=>{
      if(active)setResult(value);
    },()=>{if(active)setResult(unavailable);}).finally(()=>clearTimeout(timeout));
    return ()=>{active=false;clearTimeout(timeout);};
  },[expanded,refresh,sessionId]);
  const value=result?.ok?result.value:undefined;
  const rows=value?list(value):[];
  return <DisclosureCard id="pi-resolved-config" title="当前配置来源" data-testid="pi-resolved-config"
    isExpanded={expanded} onExpandedChange={setExpanded} bodyClassName="pi-resolved-config">
    {expanded&&<>
      <div className="pi-resolved-config-actions">
        <Button size="sm" variant="secondary" onPress={()=>setRefresh(count=>count+1)} data-testid="pi-resolved-config-refresh">刷新配置</Button>
        <Button size="sm" variant="ghost" onPress={()=>onNavigate('models','pi-settings-default-model')}>模型设置</Button>
        <Button size="sm" variant="ghost" onPress={()=>onNavigate('teacher-memory','pi-teacher-memory')}>教师记忆设置</Button>
        {sessionId&&<Button size="sm" variant="ghost" onPress={()=>onNavigate('permissions','pi-memory-scope')}>资料与权限</Button>}
      </div>
      {!result&&<p role="status">正在读取本机配置…</p>}
      {result&&!result.ok&&<p role="alert" data-testid="pi-resolved-config-error">{errors[result.error]}</p>}
      {value&&<>
        <p data-testid="pi-resolved-config-session">{value.session?value.session.title:'全局视图 · 当前未选择会话'}</p>
        {value.consistency==='stale'&&<p role="status">读取期间启动环境状态发生变化，请刷新后核对。</p>}
        {rows.some(([,row])=>row.status==='invalid'||row.status==='unavailable')&&<p role="status">部分配置暂不可读。</p>}
        <table data-testid="pi-resolved-config-table">
          <thead><tr><th scope="col">项目</th><th scope="col">当前值</th><th scope="col">来源与版本</th><th scope="col">状态</th></tr></thead>
          <tbody>{rows.filter(([label])=>label!=='上次运行').map(([label,row,display])=><tr key={label}>
            <th scope="row">{label}</th><td>{display??'—'}</td>
            <td>{row.source?sources[row.source]:'—'}{typeof row.revision==='number'?` · 第 ${row.revision} 版`:
              row.revision?` · ${new Date(row.revision).toLocaleString()}`:''}</td><td>{statuses[row.status]}</td>
          </tr>)}</tbody>
        </table>
        <p>长期偏好按具体任务判断。教材用于参考，临时偏好随本次任务使用。</p>
        {value.session&&<section aria-label="上次运行时的思考设置" data-testid="pi-resolved-config-last-run">
          <h4>上次运行</h4><p>{rows.at(-1)?.[2]??(value.lastRun.status==='not_applicable'?'暂无运行记录':statuses[value.lastRun.status])}</p>
        </section>}
        {value.session&&value.prepared&&<section aria-label="本轮准备基线" data-testid="pi-resolved-config-prepared">
          <h4>本轮准备基线</h4>
          {value.prepared.runStatus&&<p>运行状态 {runStatuses[value.prepared.runStatus]}</p>}
          {value.prepared.receipt ? <>
            <p>{value.prepared.receipt.modelValue} · {value.prepared.receipt.model.source&&sources[value.prepared.receipt.model.source]} · 准备时思考档次 {THINKING_LABELS[value.prepared.receipt.thinking.effective]}</p>
            <p>教师偏好版本 {value.prepared.receipt.teacher.observedRevision} · {value.prepared.receipt.teacher.longTermApplied?'本轮采用长期偏好':'本轮未采用长期偏好'}</p>
            <p>思考档次按运行准备时记录，后续教学步骤可以调整。</p>
          </> : <p>{value.prepared.status==='not_recorded'?'未记录':value.prepared.status==='invalid'?'记录无法识别':'暂不可用'}</p>}
        </section>}
      </>}
    </>}
  </DisclosureCard>;
}
