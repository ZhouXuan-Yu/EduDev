import { Button } from '@heroui/react';
import { FileCheck2 } from 'lucide-react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import type { XiaozhiApproval, XiaozhiApprovalState, XiaozhiDecisionInput } from '../../../shared/xiaozhi-agent';
import { useOfficeControlState } from './OfficeComposerState';
import './pi-control-surfaces.css';

const labels: Record<XiaozhiApprovalState, string> = { pending: '需要你的确认', approved: '已批准，等待执行', executing: '正在复制', executed: '已复制并核验',
  rejected: '已拒绝，未复制', interrupted: '确认已失效，未继续执行', uncertain: '上次执行已中断，需要核验现有文件', verified: '现有文件已核验一致，没有重复复制', failed: '未能完成或核验，请检查文件' };
export function PiCopyApproval({ approval, onDecision }: { approval: XiaozhiApproval; onDecision: (id: string, decision: XiaozhiDecisionInput['decision']) => Promise<void> }) {
  const {draft,update,lock:locked}=useOfficeControlState(`approval:${approval.id}`);
  const {busy,error:failed}=draft;
  async function decide(decision: XiaozhiDecisionInput['decision']) {
    if (locked.current) return; locked.current = true; update({busy:true,error:''});
    try { await onDecision(approval.id, decision); } catch { update({error:'确认没有完成，请刷新后重试。'}); }
    finally { locked.current = false; update({busy:false}); }
  }
  const pending = approval.state === 'pending';
  const state = pending || approval.state === 'uncertain' ? 'requires-action' : ['approved', 'executing'].includes(approval.state) ? 'input-available'
    : ['executed', 'verified'].includes(approval.state) ? 'output-available' : 'output-error';
  const expanded = !['executed','verified','rejected','interrupted'].includes(approval.state);
  return <ChatTool key={`${approval.id}:${expanded}`} state={state} defaultExpanded={expanded} className="pi-copy-approval" data-testid="pi-copy-approval" data-approval-id={approval.id} data-state={approval.state}>
    <ChatTool.Trigger><FileCheck2 size={16} aria-hidden="true"/><strong>复制教学资料</strong><span>{labels[approval.state]}</span></ChatTool.Trigger>
    <ChatTool.Content>
      <div className="pi-copy-preview"><p>来源：<strong>{approval.source}</strong></p><p>目标：<strong>{approval.target}</strong></p><p>仅执行本次复制；已有同名文件不会被覆盖。</p></div>
      <ChatTool.Approval><ChatTool.ApprovalActions>
        {pending && <><ChatTool.Approve isDisabled={busy} onPress={() => void decide('approve')} data-testid="pi-copy-approve">批准这一次</ChatTool.Approve><ChatTool.Reject isDisabled={busy} onPress={() => void decide('reject')} data-testid="pi-copy-reject">拒绝</ChatTool.Reject></>}
        {approval.state === 'uncertain' && <Button isDisabled={busy} onPress={() => void decide('verify')} data-testid="pi-copy-verify">核验现有文件</Button>}
      </ChatTool.ApprovalActions></ChatTool.Approval>
      {busy && <p role="status">正在提交…</p>}{failed && <p role="alert">确认没有完成，请刷新后重试。</p>}
    </ChatTool.Content>
  </ChatTool>;
}
