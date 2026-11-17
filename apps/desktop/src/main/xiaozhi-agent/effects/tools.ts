import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {Sql} from '../session-state';
import type {AcquisitionContext} from '../capabilities/acquisition/service';
import {createEffectState} from './state';
import {createNetworkReceiptFiles} from './network-receipts';
import {protocolHash} from '../capabilities/validation';
import {plain, exact} from '../permissions/validation';

/** Read an existing receipt for the exact current Task. It cannot confirm an effect or perform I/O again. */
export function createEffectReadTools(options: {sql: Sql; networkDirectory: string; current: (callId: string) => Promise<AcquisitionContext>}): ToolDefinition[] {
  const effects = createEffectState(options.sql);
  const files = createNetworkReceiptFiles(options.networkDirectory);
  return [{name: 'read_effect_receipt', label: '核对已有操作回执',
    description: '只读当前Task已有Effect、真实回执与网络响应缓存。指定effectId；不提供时列出有界摘要。unknown不代表未发生，不能据此重复执行。只在回执证明完成时复用既有结果，继续剩余步骤。',
    parameters: {type: 'object', additionalProperties: false, properties: {effectId: {type: 'string', pattern: '^xieffect_[a-f0-9]{64}$'},
      offset: {type:'integer',minimum:0,maximum:1048576},limit:{type:'integer',minimum:1,maximum:24000}}} as ToolDefinition['parameters'],
    async execute(callId, raw, signal) {
      signal?.throwIfAborted();
      const context = await options.current(callId);
      if(!plain(raw)||!exact(raw,Object.keys(raw).filter(key=>['effectId','offset','limit'].includes(key))))throw Error('invalid_input');
      const {effectId,offset=0,limit=24000} = raw as {effectId?: string;offset?:number;limit?:number};
      if(effectId!==undefined&&!/^xieffect_[a-f0-9]{64}$/u.test(effectId)||!Number.isSafeInteger(offset)||offset<0||offset>1048576
        ||!Number.isSafeInteger(limit)||limit<1||limit>24000||!effectId&&(raw.offset!==undefined||raw.limit!==undefined))throw Error('invalid_input');
      const record=effectId?await effects.get(effectId):null;
      if(record&&(record.owner.sessionId!==context.owner.sessionId||record.owner.taskId!==context.owner.taskId))throw Error('permission_denied');
      const selected = effectId ? record?[record]:[] : (await effects.forTask(context.owner.sessionId, context.owner.taskId)).slice(-128);
      if (effectId && selected.length !== 1) throw Error('permission_denied');
      const receipts = await Promise.all(selected.map(async record => {
        let response: {status: number; body: string; offset:number;nextOffset:number;totalCharacters:number;truncated:boolean} | undefined;
        if (effectId && record.operation.startsWith('network_') && record.execution?.leaseId && ['committed', 'reconciled'].includes(record.state)) {
          const saved = await files.read(record.id, record.execution.leaseId);
          if (record.outcome?.digest !== protocolHash({status: saved.status, bodyDigest: protocolHash(saved.body)})) throw Error('source_changed');
          const characters=Array.from(saved.body),nextOffset=Math.min(characters.length,offset+limit);
          response = {status: saved.status, body: characters.slice(offset,nextOffset).join(''),offset,nextOffset,
            totalCharacters:characters.length,truncated:nextOffset<characters.length};
        }
        return {id: record.id, revision: record.revision, operation: record.operation, state: record.state,
          callId: record.callId, commandId: record.commandId, execution: record.execution,
          ...(effectId?{outcome:record.outcome,proofs:record.proofs}:{outcome:record.outcome?{digest:record.outcome.digest,error:record.outcome.error?.slice(0,128)}:null,proofCount:record.proofs.length}),
          ...(response ? {response} : {})};
      }));
      if (!await context.current()) throw Error('permission_denied');
      return {content: [{type: 'text', text: JSON.stringify({receipts, automaticReplay: false})}], details: {success: true}};
    },
  }];
}
