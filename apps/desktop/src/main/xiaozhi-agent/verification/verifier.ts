import { VERIFICATION_SCHEMA, type TaskVerification, type VerificationEvidence, type VerificationCheck } from '../../../shared/xiaozhi-verification';
export type Criterion = { id: string; kind: 'readback' | 'human'; alternatives: string[]; expectedDigest?: string; version?: string };
export type RegisteredEvidence = VerificationEvidence & { version: string; succeeded: boolean };
export type Readback = { runId: string; callId: string; digest: string; version: string; succeeded: boolean };
/** Only main's independently owned reader is authority. A supplied/model receipt
 * is merely a lookup key; its call ID/hash never count without registry + readback. */
export async function verifyCriteria(input: { runId: string; criteria: Criterion[]; registry: ReadonlyMap<string, RegisteredEvidence>;
  read: (e: RegisteredEvidence) => Promise<Readback | undefined>; now?: number; maxAgeMs?: number }): Promise<TaskVerification> {
  const now = input.now ?? Date.now(), checkedAt = new Date(now).toISOString(), checks: VerificationCheck[] = [], evidence: VerificationEvidence[] = [];
  let succeeded = 0, failed = 0;
  if (input.criteria.length > 64 || new Set(input.criteria.map(c => c.id)).size !== input.criteria.length) throw Error('invalid_input');
  for (const criterion of input.criteria) {
    if (!criterion.id || criterion.id.length > 128 || !['readback','human'].includes(criterion.kind) || !Array.isArray(criterion.alternatives) || criterion.alternatives.length > 64) throw Error('invalid_input');
    const check: VerificationCheck = {id:criterion.id,state:criterion.kind === 'human' ? 'needs_human' : 'unknown',evidenceIds:[]};
    if (criterion.kind === 'readback') {
      for (const id of criterion.alternatives) {
        const e = input.registry.get(id), observed = e && Date.parse(e.observedAt);
        if (!e || e.id !== id || e.runId !== input.runId || e.kind !== 'readback' || !e.succeeded || !Number.isFinite(observed)
          || observed! > now || now - observed! > (input.maxAgeMs ?? 86400000) || !criterion.expectedDigest || !/^[a-f0-9]{64}$/.test(criterion.expectedDigest)
          || e.digest !== criterion.expectedDigest || !criterion.version || e.version !== criterion.version) continue;
        let actual: Readback | undefined;
        try { actual = await input.read(e); } catch { /* Reader failure is not a pass. */ }
        if (!actual?.succeeded || actual.runId !== input.runId || actual.callId !== e.callId || actual.digest !== e.digest || actual.version !== e.version) continue;
        check.state='passed'; check.evidenceIds=[e.id];
        if (!evidence.some(v => v.id === e.id)) { const {version:_version,succeeded:_success,...ref}=e; evidence.push(ref); }
        break; // A valid alternative source can meet the same criterion.
      }
    }
    if (check.state === 'passed') succeeded++; else if (check.state !== 'needs_human') failed++;
    checks.push(check);
  }
  const state = !checks.length ? 'unknown' : checks.every(c => c.state==='passed') ? 'verified'
    : checks.some(c=>c.state==='passed') ? 'partial' : checks.some(c=>c.state==='needs_human') ? 'needs_human' : 'unknown';
  return {schema:VERIFICATION_SCHEMA,runId:input.runId,state,scope:'declared_criteria',checkedAt,
    reason:!checks.length?'no_criteria':state==='verified'?'criteria_checked':state==='needs_human'?'human_review':'evidence_missing',
    checks,evidence,operations:{succeeded,failed}};
}
