import type {OmniEduStore} from '../db';
import {validMaterialPaste} from '../../shared/material-paste';
import {previewPastedMaterial, importPastedMaterial} from './material-paste';

type Check = (event: Electron.IpcMainInvokeEvent) => void;
type Job = <T>(event: Electron.IpcMainInvokeEvent, action: (signal: AbortSignal) => Promise<T>) => Promise<T>;
export function registerMaterialPasteIpc(store: OmniEduStore, ipc: Pick<Electron.IpcMain, 'handle'>,
  check: Check, job: Job) {
  ipc.handle('materials:paste-preview', (event, input: unknown) => {
    check(event);
    if (!validMaterialPaste(input)) throw Error('invalid_input');
    return previewPastedMaterial(structuredClone(input));
  });
  ipc.handle('materials:paste-import', (event, input: unknown) => job(event, async signal => {
    if (!validMaterialPaste(input, true)) throw Error('invalid_input');
    return importPastedMaterial(store, structuredClone(input), signal, async () => check(event));
  }));
}
