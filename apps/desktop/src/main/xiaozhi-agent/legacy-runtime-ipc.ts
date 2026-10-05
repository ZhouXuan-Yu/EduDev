import type { IpcMain, BrowserWindow } from 'electron';
import { requireLegacyRuntime, type RuntimeAuthority } from './runtime-authority';
import type { AiConsoleRunInput, AiConsoleRunResult } from '../../shared/contracts';

export const retiredRuntimeChannels = Object.freeze([
  'ai:deepTutorHandshake', 'ai:deepTutorStartTurn', 'ai:deepTutorContinueTurn',
  'ai:deepTutorApproveBudget', 'ai:deepTutorMutateRun', 'aiGraph:resumeTriplet',
  'ai:deepTutorSubmitUserInput', 'ai:deepTutorCancelTurn', 'ai:deepTutorStop',
] as const);
export const piConsoleAliasChannels = Object.freeze(['ai:deepTutorRunConsole', 'ai:runDeepSeek'] as const);

/** Registers compatibility names without importing or closing over an old orchestrator. */
export function registerPiConsoleEndpoints(options: {
  ipcMain: IpcMain; authority: RuntimeAuthority; window: () => BrowserWindow | undefined;
  run: (input: AiConsoleRunInput) => Promise<AiConsoleRunResult>;
}) {
  if (options.authority.mode !== 'pi') throw new Error('invalid_runtime_authority');
  const register = createLegacyRuntimeRegistrar({ ...options,
    production: channel => piConsoleAliasChannels.some(alias => alias === channel)
      ? (_event, input) => options.run(input) : undefined });
  for (const channel of [...retiredRuntimeChannels, ...piConsoleAliasChannels]) {
    register(channel, () => { throw new Error('legacy_runtime_retired'); });
  }
}

/** Production aliases use one Pi facade; untouched legacy runs stay test-only. */
export function createLegacyRuntimeRegistrar(options: {
  ipcMain: IpcMain; authority: RuntimeAuthority; window: () => BrowserWindow | undefined;
  production?: (channel: string) => Parameters<IpcMain['handle']>[1] | undefined;
}) {
  return (channel: string, listener: Parameters<IpcMain['handle']>[1]) => {
    options.ipcMain.handle(channel, (event, ...args) => {
      const window = options.window();
      if (!window || window.isDestroyed() || event.sender !== window.webContents
        || event.senderFrame !== event.sender.mainFrame) throw new Error('permission_denied');
      if (options.authority.mode === 'pi') {
        const adapted = options.production?.(channel);
        if (adapted) return adapted(event, ...args);
      }
      requireLegacyRuntime(options.authority);
      return listener(event, ...args);
    });
  };
}
