import type { IpcMain } from 'electron';
import type { createXiaozhiProductionHost } from '../production-host';
import type { DecisionResult } from '../../../shared/xiaozhi-decisions';
const errors = new Set(['invalid_input','permission_denied','configuration','conflict','busy','authentication']);
export async function decisionResult<T>(action: () => Promise<T>): Promise<DecisionResult<T>> { try { return {ok:true,value:await action()}; } catch (e) { const code=e instanceof Error?e.message:''; return {ok:false,error:errors.has(code)?code as Exclude<DecisionResult<T>,{ok:true}>['error']:'configuration'}; } }
export function registerDecisionIpc({ipcMain,allowed,host}:{ipcMain:IpcMain;allowed:(e:Electron.IpcMainInvokeEvent)=>boolean;host:Pick<ReturnType<typeof createXiaozhiProductionHost>,'decisionHistory'|'decisionReplay'|'decisionShadow'|'decisionRouteShadow'>}) {
  for (const [name,method] of Object.entries({history:host.decisionHistory,replay:host.decisionReplay,shadow:host.decisionShadow,'route-shadow':host.decisionRouteShadow})) ipcMain.handle('xiaozhi:decision-'+name,(event,input)=>allowed(event)?decisionResult<unknown>(()=>method(input)):{ok:false,error:'permission_denied'});
}
