import type {Sql} from '../../xiaozhi-agent/session-state';
import {sameCandidatePolicy, type CandidateAuthority} from './candidate-admission';
import {createPersonalMemoryCandidateState} from './candidate-state';
import type {createPersonalMemoryJobs,PersonalMemoryJobLease} from './background-jobs';
import type {createPersonalMemoryRecordState} from './record-state';
import type {createPersonalMemorySourceAuthority} from './source-authority';

type Records=ReturnType<typeof createPersonalMemoryRecordState>;
type SourceAuthority=ReturnType<typeof createPersonalMemorySourceAuthority>;

export function createPersonalMemoryOrganization(sql:Sql, sources:SourceAuthority, records:Records,
  jobs:ReturnType<typeof createPersonalMemoryJobs>, sanitize:(text:string)=>Promise<string>) {
  const candidates=createPersonalMemoryCandidateState(sql,sources.witnessCurrent);
  return {
    async plan(policy:CandidateAuthority) {
      if (!await jobs.organizationAvailable()) return null;
      const open=await candidates.list(12,true);
      const active=(await records.list(20)).filter(record=>record.state==='active'&&record.sourceCurrent&&record.operation==='accept');
      for (const {draft,state} of open) {
        if (state!=='pending' || draft.replaces || !sameCandidatePolicy(draft.authority,policy) ||
            draft.authority.cancelGeneration!==policy.cancelGeneration) continue;
        const targets=active.filter(record=>record.witness.sourceId!==draft.witness.sourceId && record.kind===draft.kind &&
          record.scope.kind===draft.scope.kind && record.scope.id===draft.scope.id && record.term===draft.term &&
          record.value!==draft.proposedValue).slice(0,4);
        if (!targets.length || !await sources.witnessCurrent(sql,draft)) continue;
        const result=await jobs.enqueue({kind:'organize',authority:policy,notBefore:Date.now(),
          sources:[{id:draft.witness.sourceId,version:draft.witness.sourceVersion,revision:draft.witness.generation}],
          targets:targets.map(record=>({id:record.id,revision:record.revision}))});
        if (result.created) return result;
      }
      return null;
    },
    async targets(pins:PersonalMemoryJobLease['job']['targets']) {
      const targets=[];
      for (const pin of pins) {
        const record=await records.read(pin.id);
        // Teacher edits remain authoritative, and the source grant does not authorize sending new edited text.
        if (!record || !record.sourceCurrent || record.state!=='active' || record.operation!=='accept' ||
            record.revision!==pin.revision) continue;
        const {quote}=await records.previewRecord(pin.id,pin.revision);
        const value=await sanitize(record.value);
        if (!value.trim() || value.length>300 || quote.length>300) continue;
        targets.push({witness:{...pin,kind:record.kind,scope:record.scope,term:record.term},
          proposal:{kind:record.kind,source_id:record.witness.sourceId,source_version:record.witness.generation,
            scope_id:record.scope.id,valid_term:record.term,supporting_quote:quote,value,supersedes:null}});
      }
      return targets;
    },
    async targetsCurrent(db:Sql,pins:PersonalMemoryJobLease['job']['targets']) {
      for (const pin of pins) if (!await records.organizationTargetCurrent(db,pin.id,pin.revision)) return false;
      return true;
    },
  };
}
