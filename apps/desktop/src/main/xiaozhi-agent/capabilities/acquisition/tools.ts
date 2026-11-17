import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {CapabilityAcquisition, AcquisitionContext} from './service';
import {MANAGED_READ_CAPABILITY} from './managed-mcp';
import type {DiscoverySource} from '../../../../shared/xiaozhi-acquisition';

export const ACQUISITION_TOOL_NAMES = ['capability_search', 'capability_prepare'] as const;
export function createCapabilityAcquisitionTools(acquisition: CapabilityAcquisition, current: (callId?: string) => Promise<AcquisitionContext>,
  privateQuery: (query: string) => boolean = () => false): ToolDefinition[] {
  return [{name: 'capability_search', label: '查找可用能力', description: '按当前任务的公开通用需求搜索能力候选。目录结果需要宿主验证、授权与隔离准备后才能执行。查询中不要包含教师原文、学生信息或凭据。',
    parameters: {type: 'object', additionalProperties: false, required: ['query'], properties: {query: {type: 'string', minLength: 1, maxLength: 160},
      sources: {type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: {type: 'string', enum: ['reviewed', 'official_mcp', 'github', 'community']}}}} as ToolDefinition['parameters'],
    execute: async (callId, raw, signal) => {
      const context = await current(callId);
      const input = raw as {query: string; sources?: DiscoverySource[]};
      if (privateQuery(input.query)) throw Error('permission_denied');
      const value = await acquisition.search(input.query, input.sources, AbortSignal.any([context.signal, ...(signal ? [signal] : [])]));
      return {content: [{type: 'text', text: JSON.stringify(value)}], details: {success: true}};
    }},
  {name: 'capability_prepare', label: '准备已选能力', description: '在同一Task内验证并准备capability_search返回的精确候选。复用已有授权，缺少授权时保存原审批。准备成功后在安全点capability_resolve并用capability_execute执行。待审批或拒绝时继续可完成步骤，依据明确授权处理。',
    parameters: {type: 'object', additionalProperties: false, required: ['candidateId'], properties: {
      candidateId: {type: 'string', pattern: '^xicandidate_[a-f0-9]{64}$'}}} as ToolDefinition['parameters'],
    execute: async (callId, raw, signal) => {
      const context = await current(callId);
      const operation = await acquisition.prepare({...context, signal: AbortSignal.any([context.signal, ...(signal ? [signal] : [])])}, (raw as {candidateId: string}).candidateId);
      const {id, candidateId, revision, phase, error, artifactId, updatedAt} = operation;
      const value = {operation: {id, candidateId, revision, phase, error, artifactId, updatedAt}, ready: operation.phase === 'ready', ...(operation.phase === 'ready' ? {
        requirement: {capabilityId: MANAGED_READ_CAPABILITY.id, contractVersion: MANAGED_READ_CAPABILITY.contractVersion,
          required: ['read_text'], optional: [], conditions: []}} : {}),
      nextAction: operation.phase === 'needs_approval' ? '在现有审批入口处理请求，继续已有授权可完成的工作。'
        : operation.phase === 'ready' ? '在当前任务安全点解析并使用已验证能力。' : '保留当前结果，按明确原因选择已有能力或重试。'};
      return {content: [{type: 'text', text: JSON.stringify(value)}], details: {success: operation.phase === 'ready', phase: operation.phase},
        isError: ['failed', 'cancelled', 'revoked'].includes(operation.phase)};
    }}];
}
