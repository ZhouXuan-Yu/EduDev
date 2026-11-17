import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import {snapshotToolInvocationInput} from '../../../ai-harness/vendor/openhanako-tool-input-snapshot';
import {ACQUISITION_ERRORS, type AcquisitionSearch, type AcquisitionMutation, type AcquisitionView, type AcquisitionApiResult} from '../../../../shared/xiaozhi-acquisition';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
export const validAcquisitionSession = (value: unknown): value is string => typeof value === 'string' && /^aisession_[a-f0-9-]{36}$/iu.test(value);
export function acquisitionSearchInput(raw: unknown): AcquisitionSearch | null {
  const frozen = snapshotToolInvocationInput(raw); const value = frozen.ok ? frozen.value : null;
  if (!object(value) || !exact(value, ['sessionId', 'query'], ['sources']) || !validAcquisitionSession(value.sessionId)
      || typeof value.query !== 'string' || !value.query.trim() || value.query.length > 160
      || value.sources !== undefined && (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 4
        || new Set(value.sources).size !== value.sources.length || value.sources.some(source => !['reviewed', 'official_mcp', 'github', 'community'].includes(String(source))))) return null;
  return value as AcquisitionSearch;
}
export function acquisitionMutationInput(raw: unknown): AcquisitionMutation | null {
  const frozen = snapshotToolInvocationInput(raw); const value = frozen.ok ? frozen.value : null;
  if (!object(value) || !validAcquisitionSession(value.sessionId)) return null;
  if (value.action === 'extension_import') return exact(value, ['action', 'sessionId']) ? value as AcquisitionMutation : null;
  if (value.action === 'extension_prepare' || value.action === 'extension_cancel') return exact(value, ['action', 'sessionId', 'artifactId', 'revision'])
    && /^[a-f0-9]{64}$/u.test(String(value.artifactId)) && Number.isSafeInteger(value.revision) && Number(value.revision) >= 1 ? value as AcquisitionMutation : null;
  if (['extension_select', 'extension_disable', 'extension_revoke'].includes(String(value.action))) return exact(value, ['action', 'sessionId', 'extensionId', 'version', 'revision'])
    && /^[a-z][a-z0-9_.-]{0,79}$/u.test(String(value.extensionId)) && /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,79}$/u.test(String(value.version))
    && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 ? value as AcquisitionMutation : null;
  if (value.action === 'prepare') return exact(value, ['action', 'sessionId', 'candidateId'])
    && /^xicandidate_[a-f0-9]{64}$/u.test(String(value.candidateId)) ? value as AcquisitionMutation : null;
  const field = value.action === 'cancel' ? 'operationId' : value.action === 'revoke' ? 'artifactId' : null;
  if (!field || !exact(value, ['action', 'sessionId', field, 'revision']) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1) return null;
  return new RegExp('^' + (field === 'operationId' ? 'xiacquisition_' : 'xiartifact_') + '[a-f0-9]{64}$', 'u').test(String(value[field])) ? value as AcquisitionMutation : null;
}
async function result<T>(action: () => Promise<T>): Promise<AcquisitionApiResult<T>> {
  try {return {ok: true, value: await action()};}
  catch (error) {const code = error instanceof Error ? error.message : ''; return {ok: false, error: Object.hasOwn(ACQUISITION_ERRORS, code) ? code : 'acquisition_failed'};}
}
export function registerAcquisitionIpc(options: {ipcMain: IpcMain; allowed: (event: IpcMainInvokeEvent) => boolean;
  view: (sessionId: string) => Promise<AcquisitionView>; search: (input: AcquisitionSearch) => Promise<AcquisitionView>;
  mutate: (input: AcquisitionMutation) => Promise<AcquisitionView>;
  importExtension?: (sessionId: string) => Promise<AcquisitionView>}) {
  options.ipcMain.handle('xiaozhi:acquisition', (event, id) => options.allowed(event) && validAcquisitionSession(id)
    ? result(() => options.view(id)) : {ok: false, error: 'permission_denied'});
  options.ipcMain.handle('xiaozhi:acquisition-search', (event, input) => {
    if (!options.allowed(event)) return {ok: false, error: 'permission_denied'};
    const frozen = acquisitionSearchInput(input); return frozen ? result(() => options.search(frozen)) : {ok: false, error: 'invalid_input'};
  });
  options.ipcMain.handle('xiaozhi:acquisition-mutate', (event, input) => {
    if (!options.allowed(event)) return {ok: false, error: 'permission_denied'};
    const frozen = acquisitionMutationInput(input);
    if (frozen?.action === 'extension_import') return result(() => {
      if (!options.importExtension) throw Error('unavailable');
      return options.importExtension(frozen.sessionId);
    });
    return frozen ? result(() => options.mutate(frozen)) : {ok: false, error: 'invalid_input'};
  });
}
