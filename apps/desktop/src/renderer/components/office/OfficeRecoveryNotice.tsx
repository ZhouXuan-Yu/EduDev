import { DisclosureCard } from '../ui/DisclosureCard';
import {CircleHelp,FileCheck2} from 'lucide-react';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {validRecovery} from '../../../shared/xiaozhi-recovery';
import {validTaskVerification} from '../../../shared/xiaozhi-verification';
const description={not_delivered:'尚未交付执行',recorded:'结果记录已保存',needs_check:'结果需要核对',failed:'操作未完成'};
/** Recovery records describe persisted operations; they never certify the whole task. */
export function OfficeRecoveryNotice({turn}:{turn:OfficeProjectedTurn}){
 const value=turn.recovery;if(!validRecovery(value)||value.runId!==turn.id||!value.receipts.length)return null;
 const repaired=new Map(validTaskVerification(turn.verification,turn.id)?turn.verification.repairedOperations?.map(row=>[row.callId,row.repairedBy])||[]:[]);
 const pending=value.receipts.filter(r=>r.disposition==='needs_check'&&!repaired.has(r.callId)).length,Icon=pending?CircleHelp:FileCheck2;
 return <div className="office-verification-notice" data-testid="office-recovery" data-run-id={turn.id} role="status"><Icon size={16} aria-hidden="true"/><div>
  <strong>{turn.status==='interrupted'?'已恢复操作记录':'操作记录已保存'}</strong>
  <p>保留了 {value.receipts.length} 项操作记录{repaired.size?`，${repaired.size} 项已由关联修正解决`:''}{pending?`，其中 ${pending} 项结果需要核对`:''}。恢复记录不会再次执行操作。</p>
  <DisclosureCard title={<>查看操作结果</>}><ul>{value.receipts.map(row=><li key={row.id} data-receipt-id={row.id} data-disposition={repaired.has(row.callId)?'repaired':row.disposition} data-original-disposition={row.disposition} data-repaired-by={repaired.get(row.callId)}>
   {turn.items.find(item=>item.id===row.callId)?.label||'授权操作'} · {repaired.has(row.callId)?'原候选检查未通过，后续修正已确认保存；原失败记录保留':description[row.disposition]}
   {repaired.has(row.callId)?'':row.effect==='matched'?'；核对时本地产物与确认保存记录一致':row.native==='matched'||row.native==='recorded'?'；已找到保存的工具结果，实际效果仍需按任务核对':''}
  </li>)}</ul></DisclosureCard>
 </div></div>;
}
