import {useEffect, useRef, useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import type {PermissionApproval, PermissionApprovalInput} from '../../../shared/xiaozhi-permissions';
import {useOfficeControlState} from './OfficeComposerState';
import {permissionAction, permissionClassification, permissionResource} from './permissionPresentation';
import {DisclosureCard} from '../ui/DisclosureCard';

const labels: Record<PermissionApproval['state'], string> = {pending: '需要你的授权', approved: '已批准，等待执行',
  executing: '正在执行', executed: '已执行', rejected: '已拒绝', invalidated: '申请已失效', uncertain: '执行结果待核验', failed: '执行未完成'};

export function PiPermissionApproval({approval, onRefresh, disabled = false}: {
  approval: PermissionApproval; onRefresh?: (current?: PermissionApproval) => Promise<void>; disabled?: boolean;
}) {
  const [resolved, setResolved] = useState<PermissionApproval>();
  const item = resolved?.id === approval.id && resolved.revision >= approval.revision ? resolved : approval;
  const {draft, update, lock} = useOfficeControlState('permission:' + item.id);
  const request = item.request;
  const identity = `${approval.request.owner.sessionId}:${approval.id}:${approval.revision}`;
  const live = useRef({identity, mounted:true});live.current.identity=identity;
  useEffect(()=>{live.current.mounted=true;return()=>{live.current.mounted=false;};},[]);
  const expired = !Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt)<=Date.now();
  const acquisitionRequest = request.action === 'capability_prepare' || request.action === 'mcp_stdio_start'
    || request.action === 'mcp_call' && request.callId.startsWith('acquisition_health_');
  async function decide(decision: PermissionApprovalInput['decision'], scope: 'operation' | 'task' = 'operation') {
    if (lock.current || disabled || expired) return;
    const own = identity, current = () => live.current.mounted && live.current.identity===own;
    lock.current = true; update({busy: true, error: ''});
    try {
      const result = await window.omniEdu?.decideXiaozhiPermission({sessionId: request.owner.sessionId,
        approvalId: item.id, revision: item.revision, decision, scope});
      if (!current()) return;
      if (result && !result.ok && (result.error === 'conflict' || result.error === 'permission_denied')) {
        const view = await window.omniEdu?.getXiaozhiPermissions(request.owner.sessionId);
        if (!current()) return;
        const latest = view?.ok ? view.value.approvals.find(row => row.id === item.id && row.revision > item.revision) : undefined;
        if (latest) {
          setResolved(latest);
          await onRefresh?.(latest);
          return;
        }
      }
      if (!result?.ok || result.value.id!==item.id || result.value.request.owner.sessionId!==request.owner.sessionId || result.value.revision<item.revision) throw Error('permission_decision_failed');
      setResolved(result.value);
      await onRefresh?.();
    } catch {if(current())update({error: '授权没有完成，请刷新当前申请后重试。'});}
    finally {lock.current = false; if(current())update({busy: false});}
  }
  const state = item.state === 'pending' ? 'requires-action' : ['approved', 'executing'].includes(item.state) ? 'input-available'
    : item.state === 'executed' ? 'output-available' : 'output-error';
  return <ChatTool state={state} defaultExpanded className="pi-copy-approval" data-testid="pi-permission-approval"
    data-approval-id={item.id} data-revision={item.revision} data-request-digest={item.requestDigest} data-state={item.state}>
    <ChatTool.Trigger><ShieldCheck size={16} aria-hidden="true"/><strong>{permissionAction(request.action)}</strong><span>{labels[item.state]}</span></ChatTool.Trigger>
    <ChatTool.Content>
      <div className="pi-copy-preview" style={{minWidth: 0, overflowWrap: 'anywhere'}}>
        <p>{request.purpose}</p>
        <ul>{request.scopes.map((scope, index) => <li key={index} style={{overflowWrap: 'anywhere', whiteSpace: 'normal'}}>{permissionResource(scope)}</li>)}</ul>
        <p>数据范围 {permissionClassification[request.classification]}</p>
        <p>有效至 {new Date(request.expiresAt).toLocaleString()}</p>
        {request.action === 'exec_command' && <p>脚本结束后按当前授权和原文件版本提交变动。</p>}
        {request.scopes.some(scope => scope.kind === 'egress' || scope.kind === 'mcp') && <p>本次调用可能产生外部状态变化，失败后需要核对执行结果。</p>}
        <DisclosureCard title="请求详情">
          {request.summary && <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{request.summary}</pre>}
          <p>申请版本 {item.revision}</p>
          <p>请求指纹 <code>{item.requestDigest}</code></p>
          <p>输入指纹 <code>{request.inputDigest}</code></p>
        </DisclosureCard>
        {acquisitionRequest && item.state === 'pending' && <p>授权当前任务后，小智可在有效期内按这里列出的范围继续准备工具。</p>}
        <p>拒绝后本次操作不会获准执行；小智仍可继续已有授权范围内的步骤。</p>
        {item.state==='invalidated' && <p role="status">授权条件已变化，请重新核对申请。</p>}
        {expired && item.state==='pending' && <p role="status">申请已过期，请重新读取并由当前任务重新申请。</p>}
      </div>
      {item.state === 'pending' && <ChatTool.Approval><ChatTool.ApprovalActions>
        <ChatTool.Approve isDisabled={draft.busy||disabled||expired} data-testid="pi-permission-approve" onPress={() => void decide('approve')}>批准本次操作</ChatTool.Approve>
        {acquisitionRequest && <ChatTool.Approve isDisabled={draft.busy||disabled||expired} data-testid="pi-permission-approve-task" onPress={() => void decide('approve', 'task')}>授权当前任务</ChatTool.Approve>}
        <ChatTool.Reject isDisabled={draft.busy||disabled||expired} data-testid="pi-permission-reject" onPress={() => void decide('reject')}>拒绝</ChatTool.Reject>
      </ChatTool.ApprovalActions></ChatTool.Approval>}
      {draft.busy && <p role="status">正在保存决定…</p>}
      {draft.error && <p role="alert">{draft.error}</p>}
    </ChatTool.Content>
  </ChatTool>;
}
