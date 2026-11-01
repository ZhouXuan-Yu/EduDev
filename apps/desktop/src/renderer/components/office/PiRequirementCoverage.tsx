import { DisclosureCard } from '../ui/DisclosureCard';
import type {DeliveryCheckReport} from '../../../shared/xiaozhi-delivery-checks';
const labels={checks_passed:'关联检查通过',checks_failed:'关联检查发现问题',unchecked:'关联检查未完成',unmapped:'尚未关联检查'};
/** Existing task source and exact rule evidence, never a second requirement editor or approval. */
export function PiRequirementCoverage({report}:{report:DeliveryCheckReport}){
 if(!report.requirements)return <p data-testid="pi-check-requirements-legacy">本条记录未绑定具体教师要求，不能证明要求已全部核验。</p>;
 return <DisclosureCard data-testid="pi-check-requirements" title={<>教师要求与检查依据 · {report.requirements.criteria.length}项</>}>
  <p>以下为任务中的要求预览。关联规则通过不代表完整语义已满足；未关联和未检查项仍需核对。{report.state==='stale'?'这些是旧要求或旧文件的记录，请重新检查当前版本。':''}</p>
  <ul>{report.requirements.criteria.map(c=>{const coverage=report.requirementCoverage?.find(r=>r.criterionId===c.id&&r.criterionVersion===c.version);return <li key={c.id} data-testid="pi-check-requirement" data-coverage-state={coverage?.state||'unchecked'}>
   <strong>{coverage?labels[coverage.state]:'未检查'}</strong>：{c.text}<ul>{coverage?.evidence.map((e,i)=><li key={i}>{e.path} · {e.checkId} · {e.state==='passed'?'通过':e.state==='failed'?'发现问题':'未检查'}{e.messages.map((m,j)=><p key={j}>{m}</p>)}</li>)}</ul>
   <small className="pi-file-check-hash">要求{c.id} · 版本{c.version} · 来源{c.sourceId} · {c.sourceVersion}</small>
  </li>;})}</ul>
 </DisclosureCard>;
}
