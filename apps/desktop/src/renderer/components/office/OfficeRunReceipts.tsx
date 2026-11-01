import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import { validTaskVerification, VERIFICATION_LABELS } from '../../../shared/xiaozhi-verification';
import { validRecovery } from '../../../shared/xiaozhi-recovery';
import { DisclosureCard } from '../ui/DisclosureCard';
import { OfficeVerificationNotice } from './OfficeVerificationNotice';
import { OfficeRecoveryNotice } from './OfficeRecoveryNotice';

/** A compact read-only entry to host receipts, independent of process disclosure. */
export function OfficeRunReceipts({ turn }: { turn: OfficeProjectedTurn }) {
  const verification = turn.verification;
  const terminal = ['completed', 'failed', 'interrupted'].includes(turn.status);
  const hasVerification = terminal && validTaskVerification(verification, turn.id)
    && verification.reason !== 'legacy'
    && (verification.checks.length > 0 || verification.evidence.length > 0
      || verification.state === 'partial' || verification.state === 'blocked');
  const recovery = turn.recovery;
  const hasRecovery = validRecovery(recovery) && recovery.runId === turn.id && recovery.receipts.length > 0;
  if (!hasVerification && !hasRecovery) return null;
  const pending = hasRecovery ? recovery.receipts.filter(row => row.disposition === 'needs_check').length : 0;
  const failed = hasRecovery ? recovery.receipts.filter(row => row.disposition === 'failed').length : 0;
  const title = hasVerification ? VERIFICATION_LABELS[verification.state]
    : pending ? '操作结果待核对' : failed ? '部分操作未完成' : '操作记录已保存';
  return <div data-edu-domain="" data-testid="office-run-receipts" data-run-id={turn.id}>
    <DisclosureCard data-testid="office-run-receipts-details" title={<>{title} · 本轮记录{pending > 0 ? `，${pending} 项结果待核对` : ''}{failed > 0 ? `，${failed} 项操作未完成` : ''}</>}>
      <div data-edu-domain="">
        {hasVerification && <OfficeVerificationNotice turn={turn} />}
        {hasRecovery && <OfficeRecoveryNotice turn={turn} />}
      </div>
    </DisclosureCard>
  </div>;
}
