import { validTeachingTarget, XIAOZHI_MEMORY_SLOTS, XIAOZHI_MEMORY_SURFACES } from '../../shared/xiaozhi-memory';
import type { XiaozhiMemorySelection, XiaozhiMemorySource, XiaozhiMemoryScopeInput, XiaozhiMemoryUseSelection } from '../../shared/xiaozhi-memory';

export const validMemorySession = (id: unknown): id is string => typeof id === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(id);
export function validMemorySource(value: unknown): value is XiaozhiMemorySource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.layer === 'L2' ? XIAOZHI_MEMORY_SURFACES.includes(item.source as never)
    : item.layer === 'L3' && XIAOZHI_MEMORY_SLOTS.includes(item.source as never);
}
export function validMemorySelection(value: unknown, privateFields = false): value is XiaozhiMemorySelection {
  if (!validMemorySource(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  const keys = ['layer', 'source', 'id', 'version', ...(privateFields ? ['fingerprint'] : [])];
  return Object.keys(item).length === keys.length && Object.keys(item).every(key => keys.includes(key))
    && typeof item.id === 'string' && /^memory_(?:l3_)?entry_[a-f0-9-]{36}$/i.test(item.id)
    && Number.isSafeInteger(item.version) && Number(item.version) >= 1
    && (!privateFields || typeof item.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(item.fingerprint));
}
export function validMemoryUseSelection(value: unknown, privateFields = false): value is XiaozhiMemoryUseSelection {
  if (!value || typeof value!=='object'||Array.isArray(value)) return false;
  const row = value as Record<string,unknown>;
  if (row.layer!=='history' && row.layer!=='personal') return validMemorySelection(value,privateFields);
  const keys=['layer','source','id','version','sourceVersion',...(privateFields?['fingerprint']:[])];
  return Object.keys(row).length===keys.length && Object.keys(row).every(key=>keys.includes(key)) &&
    row.source===row.layer && typeof row.id==='string' && /^[a-f0-9]{64}$/.test(row.id) &&
    typeof row.sourceVersion==='string' && /^[a-f0-9]{64}$/.test(row.sourceVersion) &&
    Number.isSafeInteger(row.version) && Number(row.version)>0 &&
    (!privateFields || typeof row.fingerprint==='string' && /^[a-f0-9]{64}$/.test(row.fingerprint));
}
export const memorySelectionKey = (item: XiaozhiMemoryUseSelection) => `${item.layer}:${item.source}:${item.id}`;
export function validMemoryScopeInput(value: unknown): value is XiaozhiMemoryScopeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as XiaozhiMemoryScopeInput;
  return Object.keys(input).every(key => ['sessionId', 'version', 'enabled', 'selections','teachingTarget'].includes(key))
    && (!('teachingTarget' in input) || (input.teachingTarget === null || validTeachingTarget(input.teachingTarget)) && input.enabled === false)
    && validMemorySession(input.sessionId) && Number.isSafeInteger(input.version) && input.version >= 0 && typeof input.enabled === 'boolean'
    && Array.isArray(input.selections) && input.selections.length <= 12 && (!('teachingTarget' in input) || input.selections.length === 0) && input.selections.every(item => validMemoryUseSelection(item))
    && new Set(input.selections.map(memorySelectionKey)).size === input.selections.length;
}
