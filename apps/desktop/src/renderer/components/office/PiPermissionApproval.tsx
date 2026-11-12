import {useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import type {PermissionApproval} from '../../../shared/xiaozhi-permissions';
import {useOfficeControlState} from './OfficeComposerState';
import {permissionAction, permissionClassification, permissionResource} from './permissionPresentation';

const labels: Record<PermissionApproval['state'], string> = {pending: '需要你的授权', approved: '已批准，等待执行',
  executing: '正在执行', executed: '已执行', rejected: '已拒绝', invalidated: '申请已失效', uncertain: '执行结果待核验', failed: '执行未完成'};

export function PiPermissionApproval({approval, onRefresh}: {approval: PermissionApproval; onRefresh?: () => Promise<void>}) {
  const [resolved, setResolved] = useState<PermissionApproval>();
  const item = resolved?.id === approval.id && resolved.revision >= approval.revision ? resolved : approval;
  const {draft, update, lock} = useOfficeControlState('permission:' + item.id);
  const request = item.request;
  async function decide(decision: 'approve' | 'reject') {
    if (lock.current) return;
    lock.current = true; update({busy: true, error: ''});
    try {
      const result = await window.omniEdu?.decideXiaozhiPermission({sessionId: request.owner.sessionId,
        approvalId: item.id, revision: item.revision, decision, scope: 'operation'});
      if (!result?.ok) throw Error('permission_decision_failed');
      setResolved(result.value);
      await onRefresh?.();
    } catch {update({error: '授权没有完成，请刷新当前申请后重试。'});}
    finally {lock.current = false; update({busy: false});}
  }
  const state = item.state === 'pending' ? 'requires-action' : ['approved', 'executing'].includes(item.state) ? 'input-available'
    : item.state === 'executed' ? 'output-available' : 'output-error';
  return <ChatTool state={state} defaultExpanded className="pi-copy-approval" data-testid="pi-permission-approval"
    data-approval-id={item.id} data-revision={item.revision} data-request-digest={item.requestDigest} data-state={item.state}>
    <ChatTool.Trigger><ShieldCheck size={16} aria-hidden="true"/><strong>{permissionAction(request.action)}</strong><span>{labels[item.state]}</span></ChatTool.Trigger>
    <ChatTool.Content>
      <div className="pi-copy-preview">
        <p>{request.purpose}</p>
        <ul>{request.scopes.map((scope, index) => <li key={index}>{permissionResource(scope)}</li>)}</ul>
        <p>调用参数分类 {permissionClassification[request.classification]}</p>
        <p>有效至 {new Date(request.expiresAt).toLocaleString()}</p>
        <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{request.summary || '历史冻结输入摘要 ' + request.inputDigest}</pre>
        {request.action === 'exec_command' && <p>脚本结束后按当前授权和原文件版本提交变动。</p>}
        {request.scopes.some(scope => scope.kind === 'egress' || scope.kind === 'mcp') && <p>本次调用可能产生外部状态变化，失败后需要核对执行结果。</p>}
        <details><summary>冻结请求标识</summary><code>{item.requestDigest}</code><p>输入摘要 {request.inputDigest}</p></details>
      </div>
      {item.state === 'pending' && <ChatTool.Approval><ChatTool.ApprovalActions>
        <ChatTool.Approve isDisabled={draft.busy} data-testid="pi-permission-approve" onPress={() => void decide('approve')}>批准本次操作</ChatTool.Approve>
        <ChatTool.Reject isDisabled={draft.busy} data-testid="pi-permission-reject" onPress={() => void decide('reject')}>拒绝</ChatTool.Reject>
      </ChatTool.ApprovalActions></ChatTool.Approval>}
      {draft.busy && <p role="status">正在保存决定…</p>}
      {draft.error && <p role="alert">{draft.error}</p>}
    </ChatTool.Content>
  </ChatTool>;
}
