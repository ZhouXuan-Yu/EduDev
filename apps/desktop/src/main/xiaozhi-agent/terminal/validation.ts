import {TERMINAL_ERRORS, TERMINAL_INPUT_FRAME_BYTES, type TerminalError, type TerminalJobRef, type TerminalReadInput, type TerminalWrite, type TerminalResize} from '../../../shared/xiaozhi-terminal-jobs';

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const session = (value: unknown) => typeof value === 'string' && /^aisession_[a-f0-9-]{36}$/iu.test(value);
const job = (value: unknown) => typeof value === 'string' && /^term_[a-f0-9-]{36}$/iu.test(value);
const command = (value: unknown) => typeof value === 'string' && /^xicmd_[a-f0-9-]{36}$/iu.test(value);
const natural = (value: unknown, minimum: number) => Number.isSafeInteger(value) && Number(value) >= minimum;
const refKeys = ['sessionId', 'jobId', 'expectedRevision', 'expectedControllerRevision', 'expectedLeaseRevision', 'commandId'];

export function validTerminalRef(value: unknown, extra: string[] = []): value is TerminalJobRef {
  return plain(value) && exact(value, [...refKeys, ...extra]) && session(value.sessionId) && job(value.jobId) && command(value.commandId)
    && [value.expectedRevision, value.expectedControllerRevision, value.expectedLeaseRevision].every(item => natural(item, 1));
}
export function validTerminalRead(value: unknown): value is TerminalReadInput {
  return plain(value) && exact(value, ['sessionId', 'jobId', 'sinceSequence', ...(value.commandId === undefined ? [] : ['commandId'])])
    && session(value.sessionId) && job(value.jobId) && natural(value.sinceSequence, 0) && (value.commandId === undefined || command(value.commandId));
}
export function validTerminalWrite(value: unknown): value is TerminalWrite {
  return plain(value) && typeof value.chars === 'string' && value.chars.length > 0
    && Buffer.byteLength(value.chars, 'utf8') <= TERMINAL_INPUT_FRAME_BYTES && validTerminalRef(value, ['chars']);
}
export function validTerminalResize(value: unknown): value is TerminalResize {
  return plain(value) && [value.cols, value.rows].every(item => natural(item, 1) && Number(item) <= 1000)
    && validTerminalRef(value, ['cols', 'rows']);
}
export function terminalError(error: unknown): TerminalError {
  const code = error instanceof Error ? error.message : '';
  if (Object.hasOwn(TERMINAL_ERRORS, code)) return code as TerminalError;
  if (/revision_conflict|owner_stale|controller/.test(code)) return 'changed';
  if (code === 'permission_pending') return 'needs_approval';
  if (code === 'input_closed') return 'closed';
  return 'unavailable';
}

export const validTerminalSession = session;
