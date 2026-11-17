import type {Sql} from '../session-state';
import type {CurrentPermission} from '../permissions/current';
import type {PermissionDecision, PermissionRequest} from '../../../shared/xiaozhi-permissions';
import type {EffectRecord} from './types';
import {createEffectState} from './state';
import {protocolHash} from '../capabilities/validation';
import {createNetworkReceiptFiles, networkOutcomeMatches} from './network-receipts';

/** The original tool receipt also owns brokered HTTP. Response loss never becomes a retry. */
export function createNetworkEffects(sql: Sql, directory: string) {
  const effects = createEffectState(sql);
  const files = createNetworkReceiptFiles(directory);
  return {
    async start(parent: CurrentPermission, callId: string, request: PermissionRequest, decision: PermissionDecision, target: string, method: string, idempotencyKey?: string) {
      const original = await effects.byCall(parent.request.owner.runId, parent.request.callId);
      if (!original || original.owner.taskId !== request.owner.taskId) throw Error('tool_receipt_conflict');
      const prior = await effects.forTask(request.owner.sessionId, request.owner.taskId);
      const key = protocolHash(['network', request.owner.taskId, request.requirementsVersion, method, target,
        idempotencyKey || (method === 'POST' ? request.inputDigest : [original.id, callId])]);
      const recorded = prior.find(effect => effect.idempotencyKey === key);
      if (recorded) {
        if (recorded.contract.inputDigest !== request.inputDigest || recorded.target !== target) throw Error('effect_idempotency_conflict');
        let response;
        try {response = await files.read(recorded.id, recorded.execution?.leaseId || '');}
        catch {throw Error('side_effect_unknown');}
        const digest = protocolHash({status: response.status, bodyDigest: protocolHash(response.body)});
        if (!networkOutcomeMatches(recorded, digest)) throw Error('side_effect_unknown');
        if (['intent', 'executing', 'unknown'].includes(recorded.state)) {
          const run = (await sql.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=?', [recorded.owner.runId]))[0];
          const authority = run?.status === 'running' ? {kind: 'run' as const, owner: recorded.owner}
            : {kind: 'recovery' as const, sessionId: recorded.owner.sessionId, taskId: recorded.owner.taskId};
          let current = recorded;
          if (current.state !== 'unknown') current = await effects.transition(current.id, current.revision, 'unknown', authority);
          await effects.transition(current.id, current.revision, 'reconciled', authority, {outcome: {digest, references: ['http-status:' + response.status]},
            proofs: [{kind: 'remote_receipt', reference: 'http:' + current.id, digest}]});
        }
        await parent.recordAuthority?.('network-effect:' + recorded.id, decision.grantRefs);
        return {key: recorded.id, recorded: {status: response.status, body: response.body},
          complete: async () => {}, unknown: async () => {}};
      }
      await parent.recordAuthority?.('network-request:' + decision.requestDigest, decision.grantRefs);
      const intent = await effects.intent({owner: request.owner, callId, commandId: callId, tool: original.tool,
        operation: method === 'POST' ? 'network_post' : 'network_get',
        idempotencyKey: key, receipt: original.receipt,
        contract: {...original.contract, inputDigest: request.inputDigest, target, effect: 'external_effect',
          scopePolicy: 'network_broker_request', grantRefs: decision.grantRefs,
          authorityRefs: [...new Set([...original.contract.authorityRefs, 'network-request:' + decision.requestDigest])]},
        target, targetVersion: null}, {kind: 'run', owner: request.owner});
      if (!intent.created) throw Error(['committed', 'reconciled'].includes(intent.record.state) ? 'network_effect_recorded' : 'side_effect_unknown');
      let effect: EffectRecord = await effects.transition(intent.record.id, intent.record.revision, 'executing', {kind: 'run', owner: request.owner},
        {execution: {id: callId, leaseId: decision.requestDigest}});
      return {
        key: effect.id,
        recorded: undefined as {status:number;body:string}|undefined,
        async complete(response: {status: number; body: string}) {
          await files.write(effect.id, decision.requestDigest, response);
          const digest = protocolHash({status: response.status, bodyDigest: protocolHash(response.body)});
          effect = await effects.transition(effect.id, effect.revision, 'committed', {kind: 'run', owner: request.owner}, {
            outcome: {digest, references: ['http-status:' + response.status, 'request:' + decision.requestDigest]},
            proofs: [{kind: 'remote_receipt', reference: 'http:' + effect.id, digest}],
          });
        },
        async unknown() {
          const current = await effects.get(effect.id);
          if (!current || current.state !== 'executing') return;
          const row = (await sql.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=? AND session_id=? AND generation=?',
            [request.owner.runId, request.owner.sessionId, request.owner.generation]))[0];
          await effects.transition(current.id, current.revision, 'unknown', row?.status === 'running'
            ? {kind: 'run', owner: request.owner} : {kind: 'recovery', sessionId: request.owner.sessionId, taskId: request.owner.taskId});
        },
      };
    },
  };
}
