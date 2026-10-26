import { createHash } from 'node:crypto';
import { ABSTAIN, type DecisionMode, type CacheImpact, type LatencyClass } from '../vendor/mu-decisions/contract';
import { DECISION_OUTCOMES, type DecisionOutcome, type DecisionReason } from '../../../shared/xiaozhi-decisions';
export type DecisionState = { action: DecisionReason; preferenceRevision: number; hasPreferences: boolean; candidate: boolean; trial: boolean };
export type StoredDecisionState = DecisionState | Omit<DecisionState,'hasPreferences'>;
const reasons = ['none','existing','learned','trial','observed','rolled_back','rejected','no_previous'];
export function validDecisionState(v: unknown): v is DecisionState {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false; const s = v as DecisionState;
  return Object.keys(s).sort().join(',') === 'action,candidate,hasPreferences,preferenceRevision,trial' && reasons.includes(s.action) && Number.isSafeInteger(s.preferenceRevision) && s.preferenceRevision >= 0 && typeof s.hasPreferences === 'boolean' && (!s.hasPreferences || s.preferenceRevision > 0) && typeof s.candidate === 'boolean' && typeof s.trial === 'boolean';
}
export function validStoredState(v: unknown,version:1|2):v is StoredDecisionState {
  if(version===2)return validDecisionState(v);
  if(!v||typeof v!=='object'||Array.isArray(v))return false;const s=v as DecisionState;
  return Object.keys(s).sort().join(',')==='action,candidate,preferenceRevision,trial'&&validDecisionState({...s,hasPreferences:false});
}
export const decisionSpec = { id: 'presentation_strategy', version: 2 as const, mode: 'off' as DecisionMode, cacheImpact: 'none' as CacheImpact, latency: 'background' as LatencyClass };
export function decisionFallback(state: StoredDecisionState,version:1|2=2): DecisionOutcome {
  if (!validStoredState(state,version)) throw Error('configuration');
  const preferences=version===1?state.preferenceRevision>0:'hasPreferences'in state&&state.hasPreferences;
  return state.action === 'rejected' ? 'rejected' : state.action === 'rolled_back' ? 'rollback' : state.trial ? 'trial' : preferences ? 'preferences' : 'default';
}
export function decisionDigest(state: StoredDecisionState,version:1|2=2) {
  if (!validStoredState(state,version)) throw Error('configuration');
  const values=version===1?[decisionSpec.id,version,state.action,state.preferenceRevision,state.candidate,state.trial]:[decisionSpec.id,version,state.action,state.preferenceRevision,'hasPreferences'in state&&state.hasPreferences,state.candidate,state.trial];
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
export function parseShadow(text: string): DecisionOutcome | typeof ABSTAIN {
  // No prose, confidence, hidden reasoning, arbitrary options or permission fields.
  try { const v = JSON.parse(text); if (!v || typeof v !== 'object' || Object.keys(v).join(',') !== 'choice') return ABSTAIN; return DECISION_OUTCOMES.includes(v.choice) ? v.choice : ABSTAIN; } catch { return ABSTAIN; }
}
export { ABSTAIN };
