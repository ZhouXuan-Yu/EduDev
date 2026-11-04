/** Task validation is independent of the SDK/run execution status. */
export const VERIFICATION_SCHEMA = 'xiaozhi.verification.v1' as const;
export const REPAIRED_VERIFICATION_SCHEMA = 'xiaozhi.verification.v2' as const;
export type VerificationState = 'verified' | 'partial' | 'unknown' | 'needs_human' | 'blocked';
export type VerificationCheck = { id: string; state: 'passed' | 'failed' | 'unknown' | 'needs_human'; evidenceIds: string[] };
export type VerificationEvidence = { id: string; runId: string; callId: string; digest: string; observedAt: string;
  kind: 'execution' | 'readback' | 'image_delivery' };
export type VerificationRepair = {callId:string;repairedBy:string;failureEvidenceId:string;resultEvidenceId:string};
export type TaskVerification = { schema: typeof VERIFICATION_SCHEMA | typeof REPAIRED_VERIFICATION_SCHEMA; runId: string; state: VerificationState;
  scope: 'declared_criteria'; checkedAt: string; reason: 'no_criteria' | 'evidence_missing' | 'criteria_checked' | 'human_review' | 'execution_failed' | 'legacy';
  checks: VerificationCheck[]; evidence: VerificationEvidence[]; operations: { succeeded: number; failed: number }; repairedOperations?:VerificationRepair[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const string = (v: unknown, max = 128): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).sort().join(',') === names.sort().join(',');
/** Host metadata/IPC reader: invalid or foreign records never become verified. */
export function validTaskVerification(v: unknown, runId: string): v is TaskVerification {
  if (!object(v) || !keys(v, ['schema','runId','state','scope','checkedAt','reason','checks','evidence','operations',...(v.schema===REPAIRED_VERIFICATION_SCHEMA?['repairedOperations']:[])])
    || ![VERIFICATION_SCHEMA,REPAIRED_VERIFICATION_SCHEMA].includes(v.schema as typeof VERIFICATION_SCHEMA) || v.runId !== runId || !string(runId)
    || v.scope !== 'declared_criteria' || !date(v.checkedAt)
    || !['verified','partial','unknown','needs_human','blocked'].includes(String(v.state))
    || !['no_criteria','evidence_missing','criteria_checked','human_review','execution_failed','legacy'].includes(String(v.reason))
    || !Array.isArray(v.checks) || v.checks.length > 64 || !Array.isArray(v.evidence) || v.evidence.length > 512
    || !object(v.operations) || !keys(v.operations,['succeeded','failed'])
    || ![v.operations.succeeded,v.operations.failed].every(n => Number.isSafeInteger(n) && Number(n) >= 0)) return false;
  if (v.evidence.some(e => !object(e) || !keys(e,['id','runId','callId','digest','observedAt','kind']) || !string(e.id) || e.runId !== runId
    || !string(e.callId) || !/^[a-f0-9]{64}$/.test(String(e.digest)) || !date(e.observedAt)
    || !['execution','readback','image_delivery'].includes(String(e.kind)))) return false;
  const ids = new Set(v.evidence.map(e => e.id));
  if (ids.size !== v.evidence.length || new Set(v.checks.map(c => object(c) ? c.id : '')).size !== v.checks.length) return false;
  if (v.checks.some(c => !object(c) || !keys(c,['id','state','evidenceIds']) || !string(c.id)
    || !['passed','failed','unknown','needs_human'].includes(String(c.state)) || !Array.isArray(c.evidenceIds)
    || c.evidenceIds.length > 64 || new Set(c.evidenceIds).size !== c.evidenceIds.length || c.evidenceIds.some(id => !ids.has(id))
    || c.state === 'passed' && !c.evidenceIds.length)) return false;
  // No criteria, received images, model success or an empty array cannot certify a task.
  if(v.schema===REPAIRED_VERIFICATION_SCHEMA){
    if(!Array.isArray(v.repairedOperations)||!v.repairedOperations.length||v.repairedOperations.length>30||v.repairedOperations.length>Number(v.operations.failed))return false;
    const calls=new Set<string>();
    for(const repair of v.repairedOperations){
      if(!object(repair)||!keys(repair,['callId','repairedBy','failureEvidenceId','resultEvidenceId'])||!['callId','repairedBy','failureEvidenceId','resultEvidenceId'].every(k=>string(repair[k]))||repair.callId===repair.repairedBy||calls.has(String(repair.callId)))return false;
      const failed=v.evidence.find(e=>e.id===repair.failureEvidenceId),saved=v.evidence.find(e=>e.id===repair.resultEvidenceId);
      if(failed?.kind!=='execution'||failed.callId!==repair.callId||saved?.kind!=='readback'||saved.callId!==repair.repairedBy||!v.checks.some(c=>c.state==='passed'&&c.evidenceIds.includes(String(repair.resultEvidenceId))))return false;
      calls.add(String(repair.callId));
    }
    if(['verified','needs_human'].includes(String(v.state))&&Number(v.operations.failed)!==v.repairedOperations.length)return false;
  }
  if (v.state === 'verified' && (!v.checks.length || v.checks.some(c => c.state !== 'passed') || v.reason !== 'criteria_checked' || Number(v.operations.failed) !== (v.schema===REPAIRED_VERIFICATION_SCHEMA?(v.repairedOperations as unknown[]).length:0))) return false;
  const refs = v.evidence;
  if (v.checks.some(c => c.state === 'passed' && c.evidenceIds.some((id:string) => refs.find((e:VerificationEvidence) => e.id===id)?.kind !== 'readback'))) return false;
  return true;
}
export function legacyVerification(runId: string): TaskVerification {
  return { schema: VERIFICATION_SCHEMA, runId, state: 'unknown', scope:'declared_criteria', checkedAt: '1970-01-01T00:00:00.000Z',
    reason:'legacy', checks:[], evidence:[], operations:{succeeded:0,failed:0} };
}
export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  verified: '已按核验标准通过', partial: '部分操作未完成', unknown: '结果未核验', needs_human: '结果需要你核对', blocked: '任务未通过核验',
};
/** Historical failed count is retained; only host-bound repaired predecessors are resolved. */
export const verificationOutstandingFailures=(v:TaskVerification)=>v.operations.failed-(v.repairedOperations?.length||0);
export function verificationLabel(v:TaskVerification):string{
  if(v.state==='partial'&&v.reason==='evidence_missing'&&verificationOutstandingFailures(v)===0
    &&!v.checks.some(check=>check.state==='failed'))return '部分结果待核验';
  return v.state==='needs_human'&&v.repairedOperations?.length?'结果已保存，内容待核对':VERIFICATION_LABELS[v.state];
}
/** Fixed scope labels; private tool arguments and model text never become labels. */
export function verificationCheckLabel(id:string):string {
  if(id.startsWith('directory:'))return '授权目录快照与本轮记录一致（仅定位资料）';
  if(id.startsWith('file_metadata:'))return '授权文件元信息与本轮记录一致（未核正文）';
  if(id.startsWith('web:'))return '网页正文与本轮保存记录一致';
  if(id.startsWith('attachment:'))return '附件正文、本地版本与本轮记录一致';
  if(id.startsWith('file_before_edit:'))return '改写前原稿与本轮教师批准版本一致（历史输入）';
  if(id.startsWith('file:'))return '授权文件正文、当前版本与本轮记录一致';
  if(id.startsWith('image:'))return '公开图片本轮送达、附件版本与保存记录一致';
  if(id.startsWith('saved_text:'))return '教师确认文本、当前文件与保存账本一致';
  if(id.startsWith('saved_bundle:'))return '整包所有文件与教师确认版本、当前文件和保存账本一致';
  if(id.startsWith('saved_office:'))return '教师确认产物、当前文件与数据库发布记录一致';
  if(id.startsWith('saved_questions:'))return '题目当前版本与保存账本一致';
  if(id==='answer:human')return '回复内容与教学结论是否符合你的要求';
  if(id==='coverage:unknown')return '其余结果尚未完成核对';
  return '任务要求核对';
}
export function verificationDescription(v: TaskVerification): string {
  const repaired=v.repairedOperations?.length||0,failed=verificationOutstandingFailures(v);
  if (v.reason === 'legacy') return '这轮历史记录没有核验证据，保留原回复供你查看。';
  if (v.reason === 'evidence_missing') return '部分结果缺少当前核验证据，或文件与保存记录已变化。回复已保留，请查看下方核对范围。';
  if (v.state === 'partial' || v.state === 'blocked') return failed
    ? `已完成 ${v.operations.succeeded} 项操作，${failed} 项操作未完成。${repaired?`另有 ${repaired} 次失败已由关联修正解决，原记录保留。`:''}请检查上方操作结果；回复结束不代表任务已完成。`
    : '本轮已停止或未能完成，尚未得到完整结果。已完成的操作记录保留，请检查上方提示。';
  if(v.state==='needs_human'&&repaired)return `已核对当前保存结果；${repaired} 次失败已由关联修正解决，原失败记录保留。回复内容与教学结论仍需你核对。`;
  if (v.state === 'needs_human') return v.checks.some(c=>c.state==='passed')
    ? '已核对下列来源与保存记录；回复内容、图片识别或教学结论仍需你核对。'
    : '操作记录已保留；图片送达、文件读取或生成成功，仍需核对结果是否符合你的要求。';
  if (v.state === 'verified') return '本次仅对列出的标准进行了独立核对。';
  return '本轮回复已结束；尚无独立核验结论，请核对内容和来源。';
}
