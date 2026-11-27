import { BrowserWindow, session, type IpcMain, type IpcMainInvokeEvent } from 'electron';
import { pathToFileURL } from 'node:url';
import { validOrdinaryCommit, validOrdinaryQuery, validOrdinaryUndo } from '../../shared/xiaozhi-ordinary-config';
import type { ConfigChange, ConfigWindowChange, ConfigWindowOpenOutcome } from '../../shared/xiaozhi-config-window';
import type { XiaozhiSettingsResult } from '../../shared/xiaozhi-settings';
import { settingsError } from './model-settings-api';
import type { createXiaozhiProductionHost } from './production-host';

type Host = Pick<ReturnType<typeof createXiaozhiProductionHost>,
  'ordinaryConfigWindowView' | 'assertConfigWindowSession' | 'ordinaryConfigHistory' | 'writeConfigWindow'>;
type WindowScope = { window: BrowserWindow; sessionId?: string };

export function registerConfigWindow({
  ipcMain, host, primaryWindow, primaryURL, settingsPath, developmentURL, preload, settingsOpenAllowed,
}: {
  ipcMain: IpcMain;
  host: Host;
  primaryWindow: () => BrowserWindow | undefined;
  primaryURL: string;
  settingsPath: string;
  developmentURL?: string;
  preload: string;
  /** Only the request-local reviewed settings bridge can delegate this opener. */
  settingsOpenAllowed?: (event: IpcMainInvokeEvent) => boolean;
}) {
  const settingsURL = developmentURL ? new URL('/config-window.html', developmentURL).href : pathToFileURL(settingsPath).href;
  let scope: WindowScope | undefined;
  const denied = { ok: false, error: 'permission_denied' } as const;
  const invalid = { ok: false, error: 'invalid_input' } as const;
  const allowed = (event: IpcMainInvokeEvent, window: BrowserWindow | undefined, url: string) =>
    Boolean(window && !window.isDestroyed() && event.sender === window.webContents
      && event.senderFrame && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === url);

  function open(parent: BrowserWindow, sessionId?: string): ConfigWindowOpenOutcome {
    if (scope && !scope.window.isDestroyed()) {
      if (scope.window.isMinimized()) scope.window.restore();
      scope.window.focus();
      return scope.sessionId === sessionId ? 'focused_existing' : 'focused_other_scope';
    }
    const isolated = session.fromPartition('xiaozhi-ordinary-settings');
    isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    isolated.setPermissionCheckHandler(() => false);
    const window = new BrowserWindow({
      parent, modal: false, show: false, width: 760, height: 690, minWidth: 560, minHeight: 480,
      title: '小智普通设置',
      webPreferences: { preload, session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const current = { window, sessionId };
    scope = current;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => {
      if (event.url !== settingsURL) event.preventDefault();
    });
    window.webContents.on('will-frame-navigate', event => {
      if (!event.isMainFrame || event.url !== settingsURL) event.preventDefault();
    });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.once('render-process-gone', () => { if (!window.isDestroyed()) window.destroy(); });
    window.once('closed', () => { if (scope === current) scope = undefined; });
    window.once('ready-to-show', () => { if (!window.isDestroyed()) window.show(); });
    void (developmentURL ? window.loadURL(settingsURL) : window.loadFile(settingsPath)).catch(() => {
      if (!window.isDestroyed()) window.destroy();
    });
    return 'opened';
  }

  ipcMain.handle('xiaozhi:config-window-open', async (event, sessionId: unknown): Promise<XiaozhiSettingsResult<ConfigWindowOpenOutcome>> => {
    const parent = primaryWindow();
    const trustedOpener = () => allowed(event, parent, primaryURL) || Boolean(settingsOpenAllowed?.(event));
    if (!parent || !trustedOpener()) return denied;
    if (sessionId !== undefined && !validOrdinaryQuery({ field: 'session_thinking', sessionId })) return invalid;
    try {
      const selected = typeof sessionId === 'string' ? sessionId : undefined;
      if (selected) await host.assertConfigWindowSession(selected);
      if (!trustedOpener()) return denied;
      return { ok: true, value: open(parent, selected) };
    } catch (error) {
      return { ok: false, error: settingsError(error) };
    }
  });

  async function fromConfigWindow<T>(
    event: IpcMainInvokeEvent, action: (current: WindowScope) => Promise<XiaozhiSettingsResult<T>>,
  ): Promise<XiaozhiSettingsResult<T>> {
    const current = scope;
    if (!current || !allowed(event, current.window, settingsURL)) return denied;
    try {
      if (current.sessionId) await host.assertConfigWindowSession(current.sessionId);
      if (scope !== current || !allowed(event, current.window, settingsURL)) return denied;
      const result = await action(current);
      return scope === current && allowed(event, current.window, settingsURL) ? result : denied;
    } catch (error) {
      return { ok: false, error: settingsError(error) };
    }
  }

  for (const [channel, refresh] of [['xiaozhi:config-window-read', false], ['xiaozhi:config-window-refresh', true]] as const) {
    ipcMain.handle(channel, event => fromConfigWindow(event, async ({ sessionId }) =>
      ({ ok: true, value: await host.ordinaryConfigWindowView(sessionId, refresh) })));
  }
  ipcMain.handle('xiaozhi:config-window-history', (event, input: { field?: unknown; cursor?: unknown } | undefined) =>
    fromConfigWindow(event, async ({ sessionId }) => {
      const field = input?.field;
      if (field === 'session_thinking' && !sessionId) return denied;
      const query = { field, cursor: input?.cursor, sessionId: field === 'session_thinking' ? sessionId : undefined };
      if (!validOrdinaryQuery(query)) return invalid;
      return { ok: true, value: await host.ordinaryConfigHistory(query) };
    }));

  for (const [channel, validate] of [['xiaozhi:config-window-commit', validOrdinaryCommit], ['xiaozhi:config-window-undo', validOrdinaryUndo]] as const) {
    ipcMain.handle(channel, (event, input: unknown) => fromConfigWindow(event, async current => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid;
      if ('sessionId' in input || 'credentialId' in input) return denied;
      const field = 'field' in input ? input.field : undefined;
      if (field === 'session_thinking' && !current.sessionId) return denied;
      const request = { ...input, sessionId: field === 'session_thinking' ? current.sessionId : undefined };
      if (!validate(request)) return invalid;
      const receipt = await host.writeConfigWindow(request, () => {
        if (scope !== current || !allowed(event, current.window, settingsURL)) throw Error('permission_denied');
      });
      return { ok: true, value: receipt };
    }));
  }

  return function publish(change: ConfigChange) {
    const parent = primaryWindow();
    try {
      if (parent && !parent.isDestroyed() && parent.webContents.getURL() === primaryURL) {
        parent.webContents.mainFrame.send('xiaozhi:config-changed', change);
      }
    } catch { /* A primary frame can close independently of the committed change. */ }
    const current = scope;
    if (!current || change.sessionId && current.sessionId !== change.sessionId) return;
    const projected: ConfigWindowChange = { field: change.field, version: change.version, scope: change.sessionId ? 'session' : 'global' };
    void (async () => {
      if (current.sessionId) await host.assertConfigWindowSession(current.sessionId);
      if (scope !== current || current.window.isDestroyed() || current.window.webContents.getURL() !== settingsURL) return;
      current.window.webContents.mainFrame.send('xiaozhi:config-window-changed', projected);
    })().catch(() => { /* A revoked session or closing frame no longer receives updates. */ });
  };
}
