import type { IpcMain, BrowserWindow } from 'electron';
import { app, dialog, safeStorage, shell } from 'electron';
import {registerWebIpc} from './web-api';
import {registerAttachmentIpc} from './attachment-api';
import fs from 'node:fs';
import path from 'node:path';
import type { OmniEduStore } from '../db';
import { createXiaozhiProductionHost } from './production-host';
import { registerSkillManagementIpc } from './skill-management-api';
import { registerWorkspaceFileIpc } from './workspace-file-api';
import { registerModelSettingsIpc } from './model-settings-api';
import { registerTextChangeIpc } from './text-change-api';
import {registerOfficeArtifactIpc} from './office-artifact-api';
import type { RuntimeAuthority } from './runtime-authority';

export function registerXiaozhiIpc(options: { ipcMain: IpcMain; store: OmniEduStore; dataRoot: string; window: () => BrowserWindow | undefined; authority: RuntimeAuthority }) {
  const commitDelay = !app.isPackaged && process.env.OMNI_EDU_E2E_DIALOG_MODE === '1'
    ? Math.min(30000, Math.max(0, Number(process.env.OMNI_EDU_E2E_PI_COMPACT_COMMIT_DELAY_MS) || 0)) : 0;
  const testing = !app.isPackaged && process.env.OMNI_EDU_E2E_DIALOG_MODE === '1';
  const textCut = testing ? process.env.OMNI_EDU_E2E_PI_TEXT_CUT_STAGE : undefined;
  const officeCut=testing?process.env.OMNI_EDU_E2E_PI_OFFICE_CUT_STAGE:undefined;
  const testWindow = testing ? Number(process.env.OMNI_EDU_E2E_PI_CONTEXT_WINDOW) : 0;
  const autoDelay = testing ? Math.min(30000, Math.max(0, Number(process.env.OMNI_EDU_E2E_PI_AUTO_COMMIT_DELAY_MS) || 0)) : 0;
  const queueDelay = testing ? Math.min(30000, Math.max(0, Number(process.env.OMNI_EDU_E2E_PI_QUEUE_DISPATCH_DELAY_MS) || 0)) : 0;
  const autoCompaction = testing && process.env.OMNI_EDU_E2E_PI_AUTO_COMPACTION !== undefined
    ? process.env.OMNI_EDU_E2E_PI_AUTO_COMPACTION === '1' : process.env.OMNI_EDU_PI_AUTO_COMPACTION !== '0';
  const host = createXiaozhiProductionHost({ ...options, enabled: options.authority.mode === 'pi', autoCompaction,
    ...(['prepared','intent','file','fact'].includes(officeCut||'')?{afterOfficeArtifactStage:async(stage:'prepared'|'intent'|'file'|'fact')=>{
      if(stage!==officeCut)return;fs.writeFileSync(path.join(options.dataRoot,`.e2e-pi-office-${stage}`),'durable-stage-reached');await new Promise(resolve=>setTimeout(resolve,30000));
    }}:{}),
    ...(['intent','file','undo-intent','undo-file'].includes(textCut || '') ? { afterTextChangeStage: async (stage: 'intent' | 'file' | 'undo-intent' | 'undo-file') => {
      if (stage !== textCut) return;
      fs.writeFileSync(path.join(options.dataRoot, `.e2e-pi-text-${stage}`), 'durable-stage-reached');
      await new Promise(resolve => setTimeout(resolve, 30000));
    } } : {}),
    settingsCodec: { available: () => safeStorage.isEncryptionAvailable(), seal: key => safeStorage.encryptString(key).toString('base64'),
      open: sealed => safeStorage.decryptString(Buffer.from(sealed, 'base64')) },
    ...(queueDelay ? {afterInstructionDispatch:async (signal:AbortSignal)=>{
      fs.writeFileSync(path.join(options.dataRoot,'.e2e-pi-queue-dispatching'),'durable-dispatching');
      await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,queueDelay);signal.addEventListener('abort',done,{once:true});if(signal.aborted)done();});
    }} : {}),
    ...(testing && process.env.OMNI_EDU_E2E_PI_AUTO_COMPACT_REJECT === '1' ? { beforeAutoCompactCommit: async () => { throw new Error('compaction_failed'); } } : {}),
    ...(Number.isSafeInteger(testWindow) && testWindow >= 32768 && testWindow <= 1048576 ? { testContextWindow: testWindow } : {}),
    ...(autoDelay ? { afterAutoCompactCommit: async () => { fs.writeFileSync(path.join(options.dataRoot, '.e2e-pi-auto-compaction-committed'), 'native-summary-committed'); await new Promise(resolve => setTimeout(resolve, autoDelay)); } } : {}),
    ...(commitDelay ? { afterCompactCommit: async () => {
    fs.writeFileSync(path.join(options.dataRoot, '.e2e-pi-compaction-committed'), 'native-summary-committed');
    await new Promise(resolve => setTimeout(resolve, commitDelay));
  } } : {}), emit: event => {
    const window = options.window(); if (window && !window.isDestroyed()) window.webContents.send('xiaozhi:event', event);
  } });
  const fromMain = (event: Electron.IpcMainInvokeEvent) => event.sender === options.window()?.webContents && event.senderFrame === event.sender.mainFrame;
  registerAttachmentIpc({ipcMain:options.ipcMain,allowed:fromMain,attachments:host.attachments,choose:async()=>{
    const current=options.window();if(!current||current.isDestroyed())return;
    const result=await dialog.showOpenDialog(current,{title:'添加本地附件',properties:['openFile','multiSelections'],
      filters:[{name:'教学资料',extensions:['png','jpg','jpeg','gif','webp','txt','md','docx','pdf','xlsx','pptx']},{name:'所有文件',extensions:['*']}]});
    return result.canceled?undefined:result.filePaths;
  }});
  registerWebIpc({ipcMain:options.ipcMain,allowed:fromMain,host,preferences:()=>options.store.xiaozhiState.modelSettings.web(),open:url=>shell.openExternal(url)});
  registerModelSettingsIpc({ ipcMain: options.ipcMain, allowed: fromMain, host });
  registerTextChangeIpc({ ipcMain: options.ipcMain, allowed: fromMain, host });
  registerOfficeArtifactIpc({ipcMain:options.ipcMain,allowed:fromMain,host});
  registerWorkspaceFileIpc({ipcMain:options.ipcMain,allowed:fromMain,resolve:host.resolveFileWorkspace});
  registerSkillManagementIpc({ ipcMain: options.ipcMain, allowed: fromMain, host, choose: async () => {
    const current = options.window(); if (!current || current.isDestroyed()) return;
    const result = await dialog.showOpenDialog(current, { title: '导入本地教育技能（选择包含 SKILL.md 的目录）', properties: ['openDirectory'] });
    return result.canceled ? undefined : result.filePaths[0];
  } });
  options.ipcMain.handle('xiaozhi:enabled', event => { if (!fromMain(event)) throw new Error('permission_denied'); return host.enabled; });
  options.ipcMain.handle('xiaozhi:snapshot', (event, id) => { if (!fromMain(event)) throw new Error('permission_denied'); return host.snapshot(id); });
  options.ipcMain.handle('xiaozhi:goal-mutate',(event,input)=>fromMain(event)?host.mutateGoal(input):{ok:false,error:'permission_denied'});
  options.ipcMain.handle('xiaozhi:browser-show',(event,id)=>fromMain(event)?host.showBrowser(id):{ok:false,error:'permission_denied'});
  options.ipcMain.handle('xiaozhi:browser-capture-preview',(event,input)=>fromMain(event)?host.previewBrowserCapture(input):{ok:false,error:'permission_denied'});
  options.ipcMain.handle('xiaozhi:start', (event, input) => { if (!fromMain(event)) return { ok: false, error: 'configuration' }; return host.start(input); });
  options.ipcMain.handle('xiaozhi:stop', (event, id) => { if (!fromMain(event)) return { ok: false }; return host.stop(id); });
  options.ipcMain.handle('xiaozhi:decide', (event, input) => { if (!fromMain(event)) return { ok: false, error: 'permission_denied' }; return host.decide(input); });
  options.ipcMain.handle('xiaozhi:answer', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.answer(input); });
  options.ipcMain.handle('xiaozhi:queue', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.queue(input); });
  options.ipcMain.handle('xiaozhi:queue-mutate', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.mutateQueue(input); });
  options.ipcMain.handle('xiaozhi:budget', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.setBudget(input); });
  options.ipcMain.handle('xiaozhi:memory-catalog', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.memoryCatalog(input); });
  options.ipcMain.handle('xiaozhi:memory-scope', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.setMemoryScope(input); });
  options.ipcMain.handle('xiaozhi:memory-trace', (event,id) => { if (!fromMain(event)) throw new Error('permission_denied'); return host.memoryTrace(id); });
  options.ipcMain.handle('xiaozhi:compact', (event,input) => { if (!fromMain(event)) return {ok:false,error:'permission_denied'}; return host.compact(input); });
  options.ipcMain.handle('xiaozhi:workspace', (event, id) => {
    if (!fromMain(event)) return { ok: false, error: 'permission_denied' };
    return host.selectWorkspace(id, async () => {
      const current = options.window(); if (!current) return;
      const result = await dialog.showOpenDialog(current, { title: '选择本会话的教学工作目录', properties: ['openDirectory'] });
      return result.canceled ? undefined : result.filePaths[0];
    });
  });
  return host;
}
