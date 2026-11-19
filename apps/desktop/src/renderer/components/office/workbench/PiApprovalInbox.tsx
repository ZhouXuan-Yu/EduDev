import {useEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import type {WorkbenchApprovalDetail, WorkbenchApprovalRef, WorkbenchApprovalRow, WorkbenchApprovalState} from '../../../../shared/xiaozhi-workbench';
import {PiPermissionApproval} from '../PiPermissionApproval';
import {PiCopyApproval} from '../PiCopyApproval';
import {permissionClassification} from '../permissionPresentation';
import {readWorkbenchSummary, useWorkbenchSummary} from './useWorkbenchSummary';
import styles from '../../../ui-system/xiaozhi-workbench.module.css';

const labels: Record<string,string> = {pending:'待处理',approved:'已批准',executing:'执行中',executed:'已执行',rejected:'已拒绝',invalidated:'申请已失效',interrupted:'执行已中断',uncertain:'结果待核验',verified:'已核验',failed:'执行失败'};
export function sameApprovalRef(a: WorkbenchApprovalRef, b: WorkbenchApprovalRef) {
  return a.kind===b.kind && a.sessionId===b.sessionId && a.id===b.id && (a.kind==='permission_v2'&&b.kind==='permission_v2'?a.revision===b.revision:a.kind==='legacy_copy'&&b.kind==='legacy_copy'&&a.etag===b.etag);
}
export function PiApprovalInbox({activeSessionId,onOpenSession,onChanged}: {
  activeSessionId:string;onOpenSession:(id:string)=>Promise<boolean>;onChanged:(id:string)=>Promise<void>;
}) {
  const [filter,setFilter]=useState<WorkbenchApprovalState|'all'>('pending'),[currentOnly,setCurrentOnly]=useState(false),[cursors,setCursors]=useState<string[]>([]);
  const [selection,setSelection]=useState<{row:WorkbenchApprovalRow;detail:WorkbenchApprovalDetail}>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const epoch=useRef(0),lock=useRef(false),alive=useRef(true);
  const state=useWorkbenchSummary({schemaVersion:1,kind:'approvals',state:filter,...(currentOnly?{sessionId:activeSessionId}:{}),limit:20,...(cursors.length?{cursor:cursors.at(-1)}:{})});
  const page=state.value?.kind==='approvals'?state.value:undefined;
  const scope=JSON.stringify([filter,currentOnly,currentOnly?activeSessionId:null,cursors]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
  useEffect(()=>{epoch.current++;lock.current=false;setBusy(false);setSelection(undefined);setNotice('');},[scope]);
  const current=(ticket:number)=>alive.current&&ticket===epoch.current;
  async function detail(ref:WorkbenchApprovalRef) {
    const result=await readWorkbenchSummary({schemaVersion:1,kind:'approval_detail',ref});
    if(!result?.ok||result.value.kind!=='approval_detail'||!sameApprovalRef(ref,result.value.detail.ref))throw Error('changed');
    return result.value.detail;
  }
  async function select(row:WorkbenchApprovalRow) {
    if(lock.current)return; const ticket=++epoch.current;lock.current=true;setBusy(true);setNotice('');setSelection(undefined);
    try {const value=await detail(row.ref);if(current(ticket))setSelection({row,detail:value});}
    catch {if(current(ticket))setNotice('申请已变化或暂不可读，请刷新收件箱后重新选择。');}
    finally {if(current(ticket)){lock.current=false;setBusy(false);}}
  }
  async function changed(sessionId:string) {
    if(!alive.current)return;setSelection(undefined);state.reload();await onChanged(sessionId);
  }
  async function legacy(decision:'approve'|'reject'|'verify'|'resume') {
    if(lock.current||!selection||selection.detail.kind!=='legacy_copy')return;
    const own=selection,ticket=++epoch.current;
    if(!own.row.canDecide)throw Error('permission_denied');
    lock.current=true;setBusy(true);setNotice('');
    try {
      await detail(own.detail.ref); // Original legacy API has no etag input: reread exact detail immediately before the original action.
      if(!current(ticket))return;
      const api=window.omniEdu;if(!api)throw Error('unavailable');
      const result=decision==='resume'?await api.resumeXiaozhiLegacyApproval({sessionId:own.row.sessionId,approvalId:own.row.id})
        :await api.decideXiaozhi({sessionId:own.row.sessionId,approvalId:own.row.id,decision});
      if(!current(ticket))return;
      if(!result.ok)throw Error(result.error);
      setNotice(decision==='reject'?'已拒绝本次复制，已有授权内的任务仍可继续。':'已保存操作结果，请核对原会话记录。');
      await changed(own.row.sessionId);
    } catch(error) {if(current(ticket))setNotice(String(error).includes('changed')?'申请已变化，请刷新后核对。':'操作未完成或结果尚未确认，请刷新记录后核对。');throw error;}
    finally {if(current(ticket)){lock.current=false;setBusy(false);}}
  }
  return <div className={styles.detail} data-testid="pi-approval-inbox">
    <h2>持久审批收件箱</h2><p className={styles.meta}>这里只读取申请；批准、拒绝或核验均由你明确操作。拒绝不会替换模型或扩大授权。</p>
    <div className={styles.actions}><label className={styles.field}>审批状态<select data-testid="pi-approval-filter" value={filter} onChange={e=>{setFilter(e.target.value as typeof filter);setCursors([]);}}><option value="all">全部状态</option>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className={styles.field}>会话范围<select data-testid="pi-approval-session-filter" value={currentOnly?'current':'all'} onChange={e=>{setCurrentOnly(e.target.value==='current');setCursors([]);}}><option value="all">全部会话</option><option value="current" disabled={!activeSessionId}>当前会话</option></select></label><Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>{epoch.current++;setSelection(undefined);setCursors([]);setNotice('');state.reload();}} data-testid="pi-approval-inbox-refresh">刷新收件箱</Button></div>
    {state.loading&&<p role="status">正在读取审批索引…</p>}{state.error&&<p role="alert">{state.error}</p>}{busy&&<p role="status">正在核对申请…</p>}{notice&&<p role="status" data-testid="pi-approval-inbox-notice">{notice}</p>}
    {page&&<><p className={styles.meta} data-testid="pi-approval-counts">申请总数 {page.total??'未完整核对'} · 当前筛选 {page.matched??'未完整核对'} · 待处理 {page.counts?.pending??'未完整核对'}</p>{page.partial&&<p role="status" className={styles.notice}>部分审批来源未读取，数量未完整核对。不可读 {page.unavailableCount}；{page.sourceFailures.map(item=>`${item.source}: ${item.code}`).join('；')}</p>}{!page.items.length&&<p data-testid="pi-approval-inbox-empty">当前筛选没有申请。</p>}
      {page.items.map(row => <article className={styles.card} key={`${row.kind}:${row.sessionId}:${row.id}`} data-testid="pi-approval-inbox-row">
        <h3>{row.sessionTitle || '未命名会话'} · {labels[row.state]}</h3>
        <p>{row.purpose}</p>
        <p className={styles.meta}>
          {row.classification === 'unknown' ? '历史复制申请' : `数据范围 ${permissionClassification[row.classification]}`}
          {row.expiresAt ? ` · 有效至 ${new Date(row.expiresAt).toLocaleString()}` : ''}
        </p>
        <ul className={styles.resources}>{row.resources.map((resource, index) => <li key={index}>{resource}</li>)}</ul>
        {!row.canDecide && <p className={styles.meta}>当前记录不可直接决定，请查看详情或原会话核对。</p>}
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" isDisabled={busy} data-testid="pi-approval-inbox-detail" onPress={() => void select(row)}>查看申请</Button>
          <Button size="sm" variant="ghost" isDisabled={busy} data-testid="pi-approval-open-session" onPress={() => void onOpenSession(row.sessionId).catch(() => setNotice('会话未打开，请重试。'))}>查看会话</Button>
        </div>
      </article>)}
      <div className={styles.actions}><Button size="sm" variant="ghost" isDisabled={busy||!cursors.length} onPress={()=>setCursors(value=>value.slice(0,-1))}>上一页</Button><Button size="sm" variant="ghost" isDisabled={busy||!page.nextCursor} onPress={()=>setCursors(value=>[...value,page.nextCursor!])}>下一页</Button></div></>}
    {selection&&<section className={styles.card} data-testid="pi-approval-inbox-selected" key={JSON.stringify(selection.detail.ref)}><h3>当前申请 · {selection.row.sessionTitle}</h3>{selection.detail.kind==='permission_v2'?<PiPermissionApproval approval={selection.detail.approval} disabled={!selection.row.canDecide||busy} onRefresh={()=>changed(selection.row.sessionId)}/>:<>
      {selection.row.canDecide?<PiCopyApproval approval={selection.detail.approval} onDecision={(_id,decision)=>legacy(decision)}/>:<p>历史申请状态：{labels[selection.detail.approval.state]}。该记录当前不可操作。</p>}
      {selection.detail.approval.state==='approved'&&selection.row.canDecide&&<Button size="sm" isDisabled={busy} data-testid="pi-approval-legacy-resume" onPress={()=>void legacy('resume').catch(()=>{})}>执行已批准的复制</Button>}
    </>}</section>}
  </div>;
}
