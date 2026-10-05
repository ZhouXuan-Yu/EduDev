import type { IpcMain } from 'electron';
import type {XiaozhiProviderBalance} from '../../shared/xiaozhi-settings';
import type { createXiaozhiProductionHost } from './production-host';
import { validSessionModelInput, validSettingsInput, validSettingsQuery, validCredentialInput } from './model-settings';
import { XIAOZHI_SETTINGS_ERRORS, type XiaozhiSettingsError, type XiaozhiSettingsResult, type XiaozhiSettingsView, type XiaozhiSessionModel, type XiaozhiCredentialView } from '../../shared/xiaozhi-settings';
type Host = Pick<ReturnType<typeof createXiaozhiProductionHost>, 'modelSettingsView' | 'saveModelSettings' | 'selectSessionModel' | 'verifyModelCredential' | 'queryProviderBalance'>;
export function settingsError(error: unknown): XiaozhiSettingsError {
  const code = error instanceof Error ? error.message : '';
  return Object.prototype.hasOwnProperty.call(XIAOZHI_SETTINGS_ERRORS, code) ? code as XiaozhiSettingsError : 'configuration';
}
export function createModelSettingsApi(host: Host) {
  async function result<T>(action: () => Promise<T>): Promise<XiaozhiSettingsResult<T>> {
    try { return { ok: true, value: await action() }; } catch (error) { return { ok: false, error: settingsError(error) }; }
  }
  return {
    balance(input?:unknown):Promise<XiaozhiSettingsResult<XiaozhiProviderBalance>>{return input===undefined?result(()=>host.queryProviderBalance()):Promise.resolve({ok:false,error:'invalid_input'});},
    verify(input:unknown):Promise<XiaozhiSettingsResult<XiaozhiCredentialView>> {
      return validCredentialInput(input)?result(()=>host.verifyModelCredential(input)):Promise.resolve({ok:false,error:'invalid_input'});
    },
    get(input?: unknown): Promise<XiaozhiSettingsResult<XiaozhiSettingsView>> {
      return validSettingsQuery(input) ? result(() => host.modelSettingsView(input)) : Promise.resolve({ ok: false, error: 'invalid_input' });
    },
    save(input: unknown): Promise<XiaozhiSettingsResult<XiaozhiSettingsView>> {
      return validSettingsInput(input) ? result(() => host.saveModelSettings(input)) : Promise.resolve({ ok: false, error: 'invalid_input' });
    },
    select(input: unknown): Promise<XiaozhiSettingsResult<XiaozhiSessionModel>> {
      return validSessionModelInput(input) ? result(() => host.selectSessionModel(input)) : Promise.resolve({ ok: false, error: 'invalid_input' });
    },
  };
}
export function registerModelSettingsIpc(options: { ipcMain: IpcMain; allowed: (event: Electron.IpcMainInvokeEvent) => boolean; host: Host }) {
  const api = createModelSettingsApi(options.host);
  for (const [channel, method] of [['xiaozhi:settings-get', api.get], ['xiaozhi:settings-save', api.save], ['xiaozhi:model-select', api.select], ['xiaozhi:settings-verify',api.verify],['xiaozhi:provider-balance',api.balance]] as const)
    options.ipcMain.handle(channel, (event, input) => options.allowed(event) ? method(input) : { ok: false, error: 'permission_denied' });
}
