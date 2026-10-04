import type { IpcMain } from 'electron';
import type { createXiaozhiProductionHost } from './production-host';
import { validSessionId } from './model-settings';
import { settingsError } from './model-settings-api';
import { XIAOZHI_WEB_SCHEMA, type XiaozhiWebInput } from '../../shared/xiaozhi-web';
import { officeWebUrl, resolveOfficePublicAddresses } from '../office-agent/office-network';
type Host = Pick<ReturnType<typeof createXiaozhiProductionHost>, 'saveWebSettings' | 'snapshot'>;
const exact = (raw: unknown, keys: string[]): raw is Record<string, unknown> => !!raw && typeof raw === 'object' && !Array.isArray(raw)
  && Object.keys(raw).sort().join(',') === keys.sort().join(',');
export function validWebSettings(raw: unknown): raw is XiaozhiWebInput {
  return exact(raw, ['schemaVersion', 'version', 'enabled', 'dnsMode']) && raw.schemaVersion === XIAOZHI_WEB_SCHEMA
    && Number.isSafeInteger(raw.version) && Number(raw.version) >= 0 && Number(raw.version) < Number.MAX_SAFE_INTEGER
    && typeof raw.enabled === 'boolean' && ['auto', 'system', 'alidns'].includes(String(raw.dnsMode));
}
export function createWebApi(options: { host: Host; preferences: () => Promise<{ dnsMode: 'auto' | 'system' | 'alidns' }>; open: (url: string) => Promise<void> }) {
  return {
    async save(raw: unknown) {
      if (!validWebSettings(raw)) return { ok: false as const, error: 'invalid_input' as const };
      try { return { ok: true as const, value: await options.host.saveWebSettings(raw) }; }
      catch (error) { return { ok: false as const, error: settingsError(error) }; }
    },
    async open(raw: unknown) {
      if (!exact(raw, ['sessionId', 'url']) || !validSessionId(raw.sessionId) || typeof raw.url !== 'string') return { ok: false as const, error: 'invalid_input' as const };
      try {
        const url = officeWebUrl(raw.url);
        const snapshot = await options.host.snapshot(raw.sessionId);
        if (!snapshot.projection.turns.some(turn => turn.items.some(item => item.sources?.some(source => source.url === url.href)))) throw new Error('permission_denied');
        await resolveOfficePublicAddresses(url.hostname.replace(/^\[|\]$/g, ''), AbortSignal.timeout(10000), (await options.preferences()).dnsMode);
        await options.open(url.href);
        return { ok: true as const, value: undefined };
      } catch (error) { return { ok: false as const, error: error instanceof Error && error.message === 'permission_denied' ? 'permission_denied' as const : 'transport' as const }; }
    },
  };
}
export function registerWebIpc(options: Parameters<typeof createWebApi>[0] & { ipcMain: IpcMain; allowed: (event: Electron.IpcMainInvokeEvent) => boolean }) {
  const api = createWebApi(options);
  for (const [channel, method] of [['xiaozhi:web-settings', api.save], ['xiaozhi:web-source-open', api.open]] as const)
    options.ipcMain.handle(channel, (event, input) => options.allowed(event) ? method(input) : { ok: false, error: 'permission_denied' });
}
