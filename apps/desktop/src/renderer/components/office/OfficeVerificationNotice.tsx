import { CircleHelp, FileCheck2 } from 'lucide-react';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import { legacyVerification, validTaskVerification, VERIFICATION_LABELS, verificationDescription,verificationCheckLabel } from '../../../shared/xiaozhi-verification';
const evidenceLabels={execution:'工具执行记录',readback:'核对时的本地产物回读',image_delivery:'图片送达记录'};
/** Uses host verification only. Text claims and tool-group counts never certify a task. */
export function OfficeVerificationNotice({turn}:{turn:OfficeProjectedTurn}) {
  if (!['completed','failed','interrupted'].includes(turn.status)) return null;
  const value=validTaskVerification(turn.verification,turn.id)?turn.verification:legacyVerification(turn.id);
  const Icon=value.state==='verified'?FileCheck2:CircleHelp;
  return <div className="office-verification-notice" data-testid="office-verification" data-state={value.state} role="status">
    <Icon size={16} aria-hidden="true"/>
    <div><strong>{VERIFICATION_LABELS[value.state]}</strong><p>{verificationDescription(value)}</p>
      <p data-testid="office-verification-scope">核对范围：仅本轮执行记录。同一任务的跨轮累计确认请查看任务核对卡。</p>
      {value.checks.length>0&&<p>核对项目：{value.checks.filter(c=>c.state==='passed').length} / {value.checks.length} 已通过</p>}
      {value.checks.length>0&&value.reason!=='legacy'&&<p data-testid="office-verification-time">核验于 <time dateTime={value.checkedAt}>{new Date(value.checkedAt).toLocaleString('zh-CN',{hour12:false})}</time>；来源或保存内容之后有变化时需重新核对。</p>}
      {value.checks.length>0&&<details data-testid="office-verification-checks"><summary>查看核对范围</summary>
        <ul>{value.checks.map(check=><li key={check.id} data-check-id={check.id} data-state={check.state}>
          {verificationCheckLabel(check.id)} · {check.state==='passed'?'已核对':check.state==='needs_human'?'需要你核对':check.state==='failed'?'未通过':'尚未核实'}
          {check.evidenceIds.length>0&&<details data-testid="office-verification-evidence"><summary>查看关联核对记录（{check.evidenceIds.length}）</summary><ul>
            {check.evidenceIds.map(id=>{
              const evidence=value.evidence.find(row=>row.id===id)!;
              const action=turn.items.find(item=>item.kind==='tool'&&item.id===evidence.callId);
              return <li key={id} data-evidence-id={id} data-evidence-kind={evidence.kind}>
                <p>{action?.label||'对应操作详情当前未载入'} · {evidenceLabels[evidence.kind]}</p>
                <p>记录于 <time dateTime={evidence.observedAt}>{new Date(evidence.observedAt).toLocaleString('zh-CN',{hour12:false})}</time>；仅反映该次核对，不会重新执行操作。</p>
                <details><summary>查看校验标识</summary><p>记录：{evidence.id}</p><p>SHA-256：{evidence.digest}</p></details>
              </li>;
            })}
          </ul></details>}
        </li>)}</ul></details>}
    </div>
  </div>;
}
