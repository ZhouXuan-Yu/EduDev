import { createHash } from 'node:crypto';
import type { Sql } from '../session-state';
import { DECISION_SCHEMA, type DecisionInput, type DecisionSummary, type DecisionOutcome, type DecisionReplay } from '../../../shared/xiaozhi-decisions';
import { decisionDigest, decisionFallback, decisionSpec, parseShadow, validDecisionState, validStoredState, ABSTAIN, type DecisionState, type StoredDecisionState } from './spec';
import type {RouteState,RouteSummary} from '../../../shared/xiaozhi-routes';
import {routeDigest,routeFallback,validStoredRoute,validRouteState,parseRouteShadow,type StoredRoute} from './route-spec';
import {readRouteObservation} from './route-observation';
import {boundedShadow} from './shadow-bound';

const prefix = 'xiaozhi.decisions.v1:';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const sid = (v: unknown): v is string => typeof v === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(v);
const rid = (v: unknown): v is string => typeof v === 'string' && /^run_[a-f0-9-]{36}$/i.test(v);
type RecordValue = { schema: typeof DECISION_SCHEMA; sourceVersion?:1|2;route?:StoredRoute;specVersion?: 1 | 2; sessionId: string; id: string; runId: string; goalId: string; at: string; revision: number; state: StoredDecisionState; stateDigest: string; sourceDigest: string; outcome: DecisionOutcome; mode: 'off' | 'shadow'; shadow?: DecisionSummary['shadow'] };
export type DecisionJudge = (state: Readonly<DecisionState>, signal: AbortSignal) => Promise<string>;
export function createDecisionLedger(options: { sql: Sql; preferenceRevision: () => Promise<number>;authority?:(sessionId:string,runId:string,goalId:string)=>Promise<{digest:string;route?:RouteState;eligible?:boolean}>;routeJudge?:(sessionId:string,state:Readonly<RouteState>,signal:AbortSignal)=>Promise<string>; judge?: (sessionId: string, state: Readonly<DecisionState>, signal: AbortSignal) => Promise<string>; assertIdle?: () => void; shadowTimeoutMs?: number }) {
  const sql = options.sql, unavailable = new Set<string>();
  function key(sessionId: string, id: string) { if (!sid(sessionId) || !/^decision_[a-f0-9]{32}$/.test(id)) throw Error('invalid_input'); return prefix + sessionId + ':' + id; }
  async function setting(k: string) { const row = (await sql.all('SELECT value_json FROM app_settings WHERE key=?', [k]))[0]; return row ? String(row.value_json) : ''; }
  async function source(sessionId: string, runId: string, goalId: string,version:1|2=2) {
    if (!sid(sessionId) || !rid(runId)) throw Error('invalid_input');
    const row = (await sql.all(`SELECT r.id,r.status FROM ai_agent_runs r JOIN ai_conversation_sessions s ON s.id=r.session_id WHERE r.id=? AND r.session_id=? AND r.sub_intent='pi_education' AND s.archived_at IS NULL`, [runId, sessionId]))[0];
    if (!row) throw Error('permission_denied');
    const raw = await setting('xiaozhi.teacher-preference.v1:event:' + runId);
    const authority=version===2?await options.authority?.(sessionId,runId,goalId):undefined;if(version===2&&(!authority||!/^[a-f0-9]{64}$/.test(authority.digest)||authority.route&&!validRouteState(authority.route)||authority.eligible!==undefined&&typeof authority.eligible!=='boolean'))throw Error('configuration');
    return { digest: sha(JSON.stringify(version===1?[sessionId,runId,goalId,raw]:[2,sessionId,runId,goalId,raw,authority!.digest])),route:authority?.route,eligible:authority?.eligible!==false, receipt: raw ? JSON.parse(raw) as { sessionId: string; runId: string; action: string; appliedRevision: number; trial?: unknown; candidateId?: string } : undefined, status: row.status };
  }
  function validate(v: unknown): RecordValue {
    const r = v as RecordValue;
    if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some(k => !['schema','sourceVersion','route','specVersion','sessionId','id','runId','goalId','at','revision','state','stateDigest','sourceDigest','outcome','mode','shadow'].includes(k))
      || r.schema !== DECISION_SCHEMA || ![1,2].includes(r.sourceVersion??1)||r.route&&!validStoredRoute(r.route)||!sid(r.sessionId) || !rid(r.runId) || typeof r.goalId !== 'string' || r.goalId.length > 120 || !/^decision_[a-f0-9]{32}$/.test(r.id)
      || !Number.isSafeInteger(r.revision) || r.revision < 1 || !Number.isFinite(Date.parse(r.at)) || ![1,2].includes(r.specVersion??1) || !validStoredState(r.state,r.specVersion??1) || r.stateDigest !== decisionDigest(r.state,r.specVersion??1)
      || !/^[a-f0-9]{64}$/.test(r.sourceDigest) || r.outcome !== decisionFallback(r.state,r.specVersion??1) || !['off','shadow'].includes(r.mode)
      || r.shadow && (Object.keys(r.shadow).sort().join(',') !== 'elapsedMs,result,state' || !['recorded','failed','stale'].includes(r.shadow.state) || !['default','preferences','trial','rollback','rejected','abstain'].includes(r.shadow.result) || !Number.isFinite(r.shadow.elapsedMs) || r.shadow.elapsedMs < 0 || r.shadow.elapsedMs > 60000)) throw Error('configuration');
    return r;
  }
  async function load(input: DecisionInput) {
    if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'id,revision,sessionId' || !Number.isSafeInteger(input.revision) || input.revision < 1) throw Error('invalid_input');
    const raw = await setting(key(input.sessionId,input.id)); if (!raw) throw Error('permission_denied');
    const record = validate(JSON.parse(raw)); if (record.sessionId !== input.sessionId || record.id !== input.id) throw Error('permission_denied');
    if (record.revision !== input.revision) throw Error('conflict'); return { raw, record };
  }
  async function current(r: RecordValue) {if((r.sourceVersion??1)!==2)return false;try{const actual=await source(r.sessionId,r.runId,r.goalId);return Boolean(actual.eligible&&(r.specVersion??1)===decisionSpec.version&&actual.digest === r.sourceDigest&&(!r.route||actual.route&&routeDigest(actual.route)===r.route.digest)&&await options.preferenceRevision() === r.state.preferenceRevision);}catch{return false;}}
  async function routeSummary(r:RecordValue):Promise<RouteSummary|undefined>{if(!r.route)return;let sourceCurrent=false;if(r.route.observed){try{sourceCurrent=(await readRouteObservation(sql,r.sessionId,r.runId)).digest===r.route.observed.digest;}catch{/* Incomplete receipts remain explicitly unavailable. */}}return{version:1,suggested:r.route.suggested,...(r.route.observed?{observed:{state:r.route.observed.state,counts:{...r.route.observed.counts},succeeded:r.route.observed.succeeded,failed:r.route.observed.failed,unknown:r.route.observed.unknown,sourceCurrent}}:{}),...(r.route.shadow?{shadow:{...r.route.shadow}}:{})};}
  async function summary(r: RecordValue): Promise<DecisionSummary> {
    const route=await routeSummary(r);return { id:r.id,runId:r.runId,at:r.at,revision:r.revision,specVersion:r.specVersion??1,outcome:r.outcome,reason:r.state.action,preferenceRevision:r.state.preferenceRevision,candidate:r.state.candidate,mode:r.mode,...(r.shadow?{shadow:{...r.shadow}}:{}),sourceCurrent:await current(r),...(route?{route}:{}) };
  }
  async function commit(raw:string,next:RecordValue){const encoded=JSON.stringify(next);if(Buffer.byteLength(encoded)>1024*1024)throw Error('configuration');if(!sql.change||await sql.change('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND value_json=?',[encoded,new Date().toISOString(),key(next.sessionId,next.id),raw])!==1)throw Error('conflict');return summary(next);}
  return {
    unavailable: (sessionId: string) => unavailable.add(sessionId),
    async capture(input: { sessionId: string; runId: string; goalId?: string; preferenceRevision: number; hasPreferences: boolean; action: string; trial: boolean }) {
      const origin = await source(input.sessionId,input.runId,input.goalId || ''); if (origin.status !== 'running'||!origin.eligible) throw Error('conflict');
      const receipt = origin.receipt;
      if (receipt && (receipt.sessionId !== input.sessionId || receipt.runId !== input.runId || receipt.appliedRevision !== input.preferenceRevision || receipt.action !== input.action)
        || !receipt && (input.preferenceRevision !== 0 || input.action !== 'none' || input.trial)) throw Error('configuration');
      const state: DecisionState = { action: (input.action === 'none' && input.hasPreferences ? 'existing' : input.action) as DecisionState['action'], preferenceRevision:input.preferenceRevision,hasPreferences:input.hasPreferences,candidate:Boolean(receipt?.candidateId),trial:input.trial };
      if (Boolean(receipt?.trial) !== state.trial) throw Error('configuration');
      const record: RecordValue = {schema:DECISION_SCHEMA,sourceVersion:2,specVersion:decisionSpec.version,sessionId:input.sessionId,id:'decision_'+sha(input.sessionId+input.runId).slice(0,32),runId:input.runId,goalId:input.goalId||'',at:new Date().toISOString(),revision:1,state,stateDigest:decisionDigest(state),sourceDigest:origin.digest,outcome:decisionFallback(state),mode:'off',...(origin.route?{route:{version:1,state:origin.route,digest:routeDigest(origin.route),suggested:routeFallback(origin.route)}}:{})};
      const k = key(record.sessionId,record.id), old = await setting(k);
      if (old) { const existing = validate(JSON.parse(old)); if (existing.stateDigest !== record.stateDigest || existing.sourceDigest !== record.sourceDigest) throw Error('conflict'); return summary(existing); }
      await sql.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[k,JSON.stringify(record),record.at]); unavailable.delete(input.sessionId); return summary(record);
    },
    async list(sessionId: string): Promise<DecisionSummary[]> {
      if (!sid(sessionId)) throw Error('invalid_input'); if (unavailable.has(sessionId)) throw Error('configuration');
      // Session authorization applies even to an empty ledger.
      if (!(await sql.all('SELECT id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[sessionId])).length) throw Error('permission_denied');
      const rows = await sql.all('SELECT value_json FROM app_settings WHERE key LIKE ? ORDER BY updated_at DESC,key DESC LIMIT 50',[prefix+sessionId+':%']);
      return Promise.all(rows.map(row => { const r = validate(JSON.parse(String(row.value_json))); if (r.sessionId !== sessionId) throw Error('permission_denied'); return summary(r); }));
    },
    async replay(input: DecisionInput): Promise<DecisionReplay> { const {record} = await load(input),route=await routeSummary(record); return {reproducible:true,sourceCurrent:await current(record),specVersion:record.specVersion??1,outcome:decisionFallback(record.state,record.specVersion??1),...(route?{route}:{})}; },
    async sealRoute(sessionId:string,runId:string){const id='decision_'+sha(sessionId+runId).slice(0,32),raw=await setting(key(sessionId,id));if(!raw)return;const record=validate(JSON.parse(raw));if(!record.route)return;const observed=await readRouteObservation(sql,sessionId,runId);if(record.route.observed){if(record.route.observed.digest!==observed.digest)throw Error('conflict');return;}await commit(raw,{...record,revision:record.revision+1,route:{...record.route,observed}});},
    async shadowRoute(input:DecisionInput):Promise<DecisionSummary>{options.assertIdle?.();const{raw,record}=await load(input);if(!record.route||!await current(record))throw Error('conflict');const judge=options.routeJudge;if(!judge)throw Error('authentication');const route=record.route;
      const checked=await boundedShadow(signal=>judge(record.sessionId,Object.freeze({...route.state}),signal),options.shadowTimeoutMs);const result:NonNullable<StoredRoute['shadow']>={result:checked.text===undefined?'abstain':parseRouteShadow(checked.text,route.state),state:checked.text===undefined?'failed':'recorded',elapsedMs:checked.elapsedMs};
      options.assertIdle?.();if(!await current(record)){result.state='stale';result.result='abstain';}return commit(raw,{...record,revision:record.revision+1,route:{...route,shadow:result}});
    },
    async shadow(input: DecisionInput): Promise<DecisionSummary> {
      options.assertIdle?.(); const {raw,record} = await load(input); if (!await current(record) || !validDecisionState(record.state)) throw Error('conflict');
      if (!options.judge) throw Error('authentication');
      const judge=options.judge,state=record.state;const checked=await boundedShadow(signal=>judge(record.sessionId,Object.freeze({...state}),signal),options.shadowTimeoutMs);
      const choice=checked.text===undefined?ABSTAIN:parseShadow(checked.text);const result:NonNullable<DecisionSummary['shadow']>={result:choice===ABSTAIN?'abstain':choice,state:checked.text===undefined?'failed':'recorded',elapsedMs:checked.elapsedMs};
      options.assertIdle?.();
      if (!await current(record)) { result.state='stale'; result.result='abstain'; }
      const next = {...record,revision:record.revision+1,mode:'shadow' as const,shadow:result};
      return commit(raw,next);
    },
  };
}
