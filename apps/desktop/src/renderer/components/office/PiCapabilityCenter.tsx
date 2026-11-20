import {useState} from 'react';
import {Button} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {useWorkbenchSummary} from './workbench/useWorkbenchSummary';
import styles from '../../ui-system/xiaozhi-workbench.module.css';
import {xiaozhiToolLabel} from '../../../shared/xiaozhi-projection';
import type {WorkbenchCapabilityRow} from '../../../shared/xiaozhi-workbench';

const installLabels={bundled:'随应用提供',installed:'已安装',missing:'未安装',unknown:'未核对'};
const verifyLabels={verified:'已核验',pending:'待核验',expired:'核验已过期',failed:'核验失败',revoked:'已撤销',quarantined:'隔离待审核',unknown:'未核验'};
const authLabels={allowed:'当前任务已授权',required:'需要授权',revoked:'授权已撤销',task_check_required:'需任务核对'};
const availableLabels={full:'满足当前能力要求',partial:'部分能力可用',blocked:'当前不可用',task_check_required:'需任务核对'};
const sourceLabels={registry:'登记能力',acquisition:'安装与候选来源',mcp:'外部工具连接',extension:'本地扩展'};
const factLabels:Record<string,string>={external_tool:'外部工具',external_effect:'可能更改外部状态',external_extension:'外部扩展代码',local_import:'本地导入，来源需核对',provider_revoked:'提供方已撤销',capability_revoked:'能力已撤销',verification_expired:'核验已过期',candidate_expired:'候选记录已过期',candidate_requires_review:'候选来源需要审核',provider_missing:'缺少提供方',provider_version_missing:'提供方版本未核对',disabled:'尚未启用',source_unverified:'来源尚未核验',missing_dependency:'缺少运行依赖',platform_incompatible:'当前平台不兼容',unhealthy:'健康核验未通过',missing_required:'缺少必需能力',conditional_task_check:'需核对任务条件',unbound_provider:'尚未绑定能力',unverified:'尚未核验',needs_approval:'需要处理原审批',quarantined:'隔离待审核',preparing:'正在准备',failed:'准备失败'};
const scopeLabels: Record<string, string> = {
  registered_catalog: '读取工具目录', registry_snapshot: '核对登记能力', task_control: '管理当前任务',
  current_task: '读取当前任务', teacher_input: '请求教师确认', dependency_acquisition: '准备本地运行依赖',
  filesystem_request: '需核对文件范围', public_network_request: '访问公开网络', browser_domain_authority: '使用授权网页',
  teacher_domain_authority: '需核对教学资料范围', selected_provider_dispatch: '使用已选工具',
  selected_skill_bytes: '读取已选技能', selected_memory: '读取已选记忆', public_discovery: '查询公开工具来源',
  extension_install_request: '准备本地扩展', extension_run_request: '需核对扩展运行授权',
  task_job_read: '读取当前终端作业', task_job_lease: '需核对终端控制权限', task_effect_read: '读取已有操作结果',
  personal_skill_publication: '管理个人技能', managed_education_recipe: '准备教学工具', mcp_tool_request: '需核对外部工具授权',
};

function CapabilityCard({row}: {row: WorkbenchCapabilityRow}) {
  const coreTool = row.capabilityId?.startsWith('edu.core.tool.');
  const name = coreTool ? xiaozhiToolLabel(row.name) : row.name;
  const source = coreTool ? '小智内置工具' : row.source;
  const version = coreTool ? row.version.split('+', 1)[0] : row.version;
  const permissions = row.risk.map(item => factLabels[item] || scopeLabels[item]);
  const reasons = row.reasons.map(item => factLabels[item]);
  const conditionalMissing = row.conditionalMissing ?? [];
  return <article className={styles.card} data-testid="pi-capability-row" data-verification={row.verification}>
    <h3>{name} <span className={styles.meta}>{version}</span></h3>
    <p className={styles.meta}>来源 {source} · {sourceLabels[row.sourceKind]}{!coreTool && ` · 许可证 ${row.license || '未知，需核对'}`}</p>
    <dl className={styles.axes}>
      <div><dt>安装</dt><dd>{installLabels[row.installed]}</dd></div>
      <div><dt>核验</dt><dd>{verifyLabels[row.verification]}</dd></div>
      <div><dt>任务授权</dt><dd>{authLabels[row.authorization]}</dd></div>
      <div><dt>可用性</dt><dd>{availableLabels[row.availability]}</dd></div>
    </dl>
    {row.requiredMissing.length > 0 && <p>缺少 {row.requiredMissing.length} 项必需能力</p>}
    {row.optionalMissing.length > 0 && <p className={styles.meta}>缺少 {row.optionalMissing.length} 项可选能力</p>}
    {conditionalMissing.length > 0 && <p className={styles.meta} data-testid="pi-capability-conditional">按任务核对 {conditionalMissing.length} 项条件要求</p>}
    {permissions.length > 0 && <p>调用范围 {permissions.map(label => label || '需核对权限详情').join('；')}</p>}
    {reasons.length > 0 && <p className={styles.meta}>{reasons.map(label => label || '请查看核验详情').join('；')}</p>}
    <DisclosureCard title="来源与核验详情">
      {coreTool && <p>工具标识 <code>{row.name}</code> · 完整版本 {row.version}</p>}
      <p>能力 {row.capabilityId || '未登记'} · 提供方 {row.providerId || '未登记'}</p>
      {coreTool && <p>来源标识 <code>{row.source}</code></p>}
      <p>来源指纹 <code>{row.sourceHash || '未提供'}</code></p>
      <p>接口指纹 <code>{row.schemaHash || '未提供'}</code></p>
      {row.requiredMissing.length > 0 && <p>必需项 {row.requiredMissing.join('、')}</p>}
      {row.optionalMissing.length > 0 && <p>可选项 {row.optionalMissing.join('、')}</p>}
      {conditionalMissing.length > 0 && <p data-testid="pi-capability-conditional-detail">按任务核对的条件项 {conditionalMissing.join('、')}</p>}
      {row.risk.length > 0 && <p>权限记录 <code>{row.risk.join('、')}</code></p>}
      {row.reasons.length > 0 && <p>核验记录 <code>{row.reasons.join('、')}</code></p>}
      <p>核验时间 {row.verifiedAt ? new Date(row.verifiedAt).toLocaleString() : '未核验'} · 有效至 {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : '未提供'}</p>
    </DisclosureCard>
  </article>;
}
export function PiCapabilityCenter({sessionId,task,onNavigate}:{sessionId?:string;task?:{id:string;requirementsVersion:number};onNavigate:(tab:'tools'|'permissions'|'skills')=>void}) {
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[cursors,setCursors]=useState<string[]>([]);
  const state=useWorkbenchSummary({schemaVersion:1,kind:'capabilities',...(sessionId?{sessionId}:{}),...(sessionId&&task?{taskId:task.id,requirementsVersion:task.requirementsVersion}:{}),...(query?{query}:{}),limit:20,...(cursors.length?{cursor:cursors.at(-1)}:{})});
  const page=state.value?.kind==='capabilities'?state.value:undefined;
  return <section className={styles.root} data-testid="pi-capability-center"><h2>能力中心</h2><p className={styles.meta}>安装、核验、任务授权与可用性分别核对。读取本页不会连接工具、运行探测或安装组件。</p>
    <form className={styles.actions} onSubmit={event=>{event.preventDefault();setQuery(search.trim());setCursors([]);}}><label className={styles.field}>搜索能力<input data-testid="pi-capability-search" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><Button type="submit" size="sm" variant="secondary" data-testid="pi-capability-search-submit">搜索</Button><Button size="sm" variant="ghost" onPress={()=>{setCursors([]);state.reload();}} data-testid="pi-capability-refresh">刷新记录</Button></form>
    <div className={styles.actions}><Button size="sm" variant="ghost" onPress={()=>onNavigate('tools')} data-testid="pi-capability-manage-tools">管理工具与安装</Button><Button size="sm" variant="ghost" onPress={()=>onNavigate('skills')} data-testid="pi-capability-manage-skills">管理教育技能</Button><Button size="sm" variant="ghost" onPress={()=>onNavigate('permissions')} data-testid="pi-capability-manage-permissions">查看资料与权限</Button></div>
    {state.loading&&<p role="status">正在读取能力记录…</p>}{state.error&&<p role="alert">{state.error}</p>}
    {page&&<>
      <p className={styles.notice} data-testid="pi-capability-context">{page.context.state==='current'
        ? '已选中当前任务。小智会在调用时核对操作和授权范围。'
        : page.context.state==='stale' ? '所选任务已变化，请刷新记录。' : '选择任务后可核对授权与可用性。'}</p>
      {page.context.state==='current' && <DisclosureCard title="当前任务详情">
        <p>任务标识 <code>{page.context.taskId}</code></p>
        <p>要求版本 {page.context.requirementsVersion}</p>
      </DisclosureCard>}
      <p className={styles.meta} data-testid="pi-capability-counts">中心记录 {page.total??'未完整核对'} · 当前筛选 {page.matched??'未完整核对'} · 同一能力的不同提供方分别列出。</p>
      {page.partial&&<p role="status" className={styles.notice} data-testid="pi-capability-partial">部分来源未读取，不能据此判断全部能力。不可读 {page.unavailableCount}；{page.sourceFailures.map(item=>`${item.source}: ${item.code}`).join('；')}{!page.items.length&&' 当前筛选没有可显示的记录，请点击“刷新记录”重试。'}</p>}
      {!page.partial&&!page.items.length&&<p data-testid="pi-capability-empty">当前筛选没有能力记录。</p>}
      {page.items.map(row => <CapabilityCard key={row.id} row={row}/>)}
      <div className={styles.actions}><Button size="sm" variant="ghost" isDisabled={!cursors.length} onPress={()=>setCursors(value=>value.slice(0,-1))} data-testid="pi-capability-page-prev">上一页</Button><Button size="sm" variant="ghost" isDisabled={!page.nextCursor} onPress={()=>setCursors(value=>[...value,page.nextCursor!])} data-testid="pi-capability-page-next">下一页</Button></div></>}
  </section>;
}
