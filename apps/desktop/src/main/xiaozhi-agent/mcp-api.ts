import type { IpcMain } from 'electron';
import type { createXiaozhiProductionHost } from './production-host';
import { XIAOZHI_MCP_ERRORS, type XiaozhiMcpError, type XiaozhiMcpResult } from '../../shared/xiaozhi-mcp';

type Host = Pick<ReturnType<typeof createXiaozhiProductionHost>, 'mcpCatalog' | 'mcpAdd' | 'mcpInspect' | 'mcpTrust' | 'mcpRevoke' | 'mcpRemove'>;
export async function mcpResult<T>(work: () => Promise<T>): Promise<XiaozhiMcpResult<T>> {
  try { return { ok: true, value: await work() }; }
  catch (e) { const code = e instanceof Error ? e.message : ''; return { ok: false, error: Object.prototype.hasOwnProperty.call(XIAOZHI_MCP_ERRORS, code) ? code as XiaozhiMcpError : 'configuration' }; }
}
/** Never serialize raw protocol errors, process stderr or request parameters into IPC errors. */
export function registerMcpIpc({ ipcMain, allowed, host }: { ipcMain: IpcMain; allowed: (e: Electron.IpcMainInvokeEvent) => boolean; host: Host }) {
  const methods = { catalog: host.mcpCatalog, add: host.mcpAdd, inspect: host.mcpInspect, trust: host.mcpTrust, revoke: host.mcpRevoke, remove: host.mcpRemove };
  for (const [name, method] of Object.entries(methods)) ipcMain.handle(`xiaozhi:mcp-${name}`, (event, input) => allowed(event)
    ? mcpResult(() => method(input)) : { ok: false, error: 'permission_denied' });
}
