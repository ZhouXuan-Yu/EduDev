import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import {validReferenceCancel, validReferenceExtract, type PaperReferenceError, type PaperReferenceResult} from '../../shared/paper-reference';
import {createPaperReferenceService, type PaperReferenceHost} from './paper-reference-service';

export function registerPaperReferenceIpc(ipc: Pick<IpcMain, 'handle'>, allowed: (event: IpcMainInvokeEvent) => boolean, host: PaperReferenceHost) {
  const service = createPaperReferenceService(host);
  const active = new Map<number, {input: {sessionId: string; basketId: string; requestId: string}; controller: AbortController}>();
  async function result<T>(event: IpcMainInvokeEvent, action: () => Promise<T>): Promise<PaperReferenceResult<T>> {
    if (!allowed(event)) return {ok: false, error: 'permission_denied'};
    try {const value = await action(); if (!allowed(event)) throw Error('permission_denied'); return {ok: true, value};}
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      const known: PaperReferenceError[] = ['invalid_input', 'permission_denied', 'source_changed', 'conflict', 'unavailable', 'too_large', 'cancelled', 'parse_failed', 'busy'];
      return {ok: false, error: error instanceof Error && error.name === 'AbortError' ? 'cancelled' : known.includes(code as PaperReferenceError) ? code as PaperReferenceError : 'unavailable'};
    }
  }
  ipc.handle('education:paper-reference-list', (event, input) => result(event, () => service.list(input)));
  ipc.handle('education:paper-reference-extract', (event, input) => result(event, async () => {
    if (!validReferenceExtract(input)) throw Error('invalid_input');
    if (active.has(event.sender.id)) throw Error('busy');
    const job = {input, controller: new AbortController()}; active.set(event.sender.id, job);
    const stop = () => job.controller.abort(); event.sender.once('destroyed', stop);
    try {return await service.extract(input, job.controller.signal);}
    finally {event.sender.removeListener('destroyed', stop); if (active.get(event.sender.id) === job) active.delete(event.sender.id);}
  }));
  ipc.handle('education:paper-reference-cancel', (event, input) => result(event, async () => {
    if (!validReferenceCancel(input)) throw Error('invalid_input');
    const job = active.get(event.sender.id);
    if (!job || job.input.requestId !== input.requestId || job.input.basketId !== input.basketId || job.input.sessionId !== input.sessionId) return false;
    job.controller.abort(); return true;
  }));
}
