import type { OfficeStartTurnInput, OfficeInterruptInput, OfficeResolveApprovalInput } from '../../shared/office-host';
import { snapshotToolInvocationInput } from '../ai-harness/vendor/openhanako-tool-input-snapshot';

type Validated<T> = { ok: true; value: T } | { ok: false; code: 'invalid_input' };
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function record(input: unknown, allowed: string[]): Record<string, unknown> | null {
  const result = snapshotToolInvocationInput(input);
  if (!result.ok || !result.value || typeof result.value !== 'object' || Array.isArray(result.value)) return null;
  const value = result.value as Record<string, unknown>;
  if (Object.keys(value).length !== allowed.length || Object.keys(value).some(key => !allowed.includes(key))) return null;
  return value;
}
export function validateOfficeStartTurn(input: unknown): Validated<OfficeStartTurnInput> {
  const value = record(input, ['commandId', 'sessionId', 'prompt', 'attachmentIds']);
  if (!value || !id(value.commandId) || !id(value.sessionId) || typeof value.prompt !== 'string'
    || !value.prompt.trim() || value.prompt.length > 32768 || value.prompt.includes('\0')
    || !Array.isArray(value.attachmentIds) || value.attachmentIds.length > 50
    || !value.attachmentIds.every(id) || new Set(value.attachmentIds).size !== value.attachmentIds.length) return { ok: false, code: 'invalid_input' };
  return { ok: true, value: value as unknown as OfficeStartTurnInput };
}
export function validateOfficeInterrupt(input: unknown): Validated<OfficeInterruptInput> {
  const value = record(input, ['commandId', 'sessionId', 'runId']);
  if (!value || !id(value.commandId) || !id(value.sessionId) || !id(value.runId)) return { ok: false, code: 'invalid_input' };
  return { ok: true, value: value as unknown as OfficeInterruptInput };
}
export function validateOfficeResolveApproval(input: unknown): Validated<OfficeResolveApprovalInput> {
  const value = record(input, ['commandId', 'sessionId', 'runId', 'approvalId', 'decision']);
  if (!value || !id(value.commandId) || !id(value.sessionId) || !id(value.runId) || !id(value.approvalId)
    || (value.decision !== 'accept' && value.decision !== 'decline')) return { ok: false, code: 'invalid_input' };
  return { ok: true, value: value as unknown as OfficeResolveApprovalInput };
}
