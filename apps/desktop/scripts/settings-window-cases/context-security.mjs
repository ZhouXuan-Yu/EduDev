import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';

function storedProfile(data,id){
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{return db.prepare('SELECT document_json FROM xiaozhi_permission_profiles_v1 WHERE session_id=?').get(id)?.document_json??null;}
 finally{db.close();}
}

/** User navigation and original permission services. No direct database writes,
 * fabricated profile, or runtime authorization override is used. */
export async function contextSecurity({main,settings,check,report}){
 const a=await settings.evaluate(()=>window.settingsWindow.getScope());
 const before=await settings.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),a.sessionId);
 const storedA=storedProfile(report.data,a.sessionId);
 assert(before.ok);assert.equal(before.value.profile.mode,'request');
 let b;
 await check('real A to B selection rejects an old A permission write without side effects',async()=>{
  await main.getByTestId('workbench-new-session').click();
  const dialog=main.getByTestId('workbench-new-dialog');
  await dialog.getByLabel('对话标题（可选）').fill('设置作用域B');
  await dialog.getByRole('button',{name:'创建对话',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  await settings.waitForFunction(id=>{const scope=window.settingsWindow.getScope();return scope.sessionId&&scope.sessionId!==id;},a.sessionId);
  await settings.getByTestId('settings-window-scope').filter({hasText:'设置作用域B'}).waitFor();
  b=await settings.evaluate(()=>window.settingsWindow.getScope());assert(b.epoch>a.epoch);
  const rejected=await settings.evaluate(async profile=>{
   try{await window.omniEdu.setXiaozhiPermissionMode({sessionId:profile.sessionId,revision:profile.revision,mode:'acceptEdits'});return false;}
   catch(error){return String(error).includes('scope_changed');}
  },before.value.profile);
  assert(rejected,'Old A write must fail at the host scope boundary');
  const after=await main.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),a.sessionId);
  assert.deepEqual(after,before);report.contexts={a,b,oldWriteRejected:true,oldProfileUnchanged:true,storedA};
 });
 await check('permission saved in settings reads back from host and appears in the main composer',async()=>{
  await settings.getByTestId('pi-settings-tab-permissions').click();
  await settings.getByTestId('pi-settings-permission-acceptEdits').click();
  await settings.waitForFunction(()=>document.querySelector('[data-testid="pi-settings-permission-acceptEdits"]')?.getAttribute('aria-pressed')==='true');
  const host=await main.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),b.sessionId);
  assert(host.ok);assert.equal(host.value.profile.mode,'acceptEdits');assert(host.value.profile.revision>0);
  report.permissionReadback={sessionId:b.sessionId,profile:host.value.profile};
  await main.getByTestId('pi-permission-picker').filter({hasText:'接受编辑'}).waitFor({timeout:4000});
 });
 await check('returning to A restores its original authority and unsent draft',async()=>{
  await main.getByTestId('workbench-session-'+a.sessionId).click();
  await settings.waitForFunction(id=>window.settingsWindow.getScope()?.sessionId===id,a.sessionId);
  await main.waitForFunction(()=>document.querySelector('[data-testid="office-prompt-input"]')?.value==='设置窗口验收：这段草稿必须保留');
  await main.getByTestId('pi-permission-picker').filter({hasText:'请求批准'}).waitFor();
  const after=await settings.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),a.sessionId);assert.deepEqual(after,before);
  const rejected=await settings.evaluate(async id=>{try{await window.omniEdu.getXiaozhiPermissions(id);return false;}catch(error){return String(error).includes('scope_changed');}},b.sessionId);
  assert(rejected);report.contexts.returned=await settings.evaluate(()=>window.settingsWindow.getScope());
 });
}

export function permissionPersistence(report){
 if(!report.contexts||!report.permissionReadback)return;
 const saved=storedProfile(report.data,report.contexts.b.sessionId);
 assert(saved);assert.deepEqual(JSON.parse(saved),report.permissionReadback.profile);
 assert.equal(storedProfile(report.data,report.contexts.a.sessionId),report.contexts.storedA);
 report.permissionSqlite={bMatchesHost:true,aUnchanged:true};
}

export async function frameSurface({settings,check,report}){
 await check('opaque sandboxed child frame receives no settings preload or parent API access',async()=>{
  const attached=settings.waitForEvent('frameattached');
  await settings.evaluate(()=>{const frame=document.createElement('iframe');frame.name='settings-frame-boundary';frame.setAttribute('sandbox','allow-scripts');frame.srcdoc='<p>Owned frame boundary probe</p>';document.body.append(frame);});
  const frame=await attached;await frame.waitForFunction(()=>document.readyState==='complete');
  const result=await frame.evaluate(()=>{
   let parentBlocked=false;try{void parent.omniEdu;}catch{parentBlocked=true;}
   return {omni:typeof window.omniEdu,settings:typeof window.settingsWindow,node:typeof window.require,parentBlocked};
  });
  assert.deepEqual(result,{omni:'undefined',settings:'undefined',node:'undefined',parentBlocked:true});
  report.frameSurface={url:frame.url(),...result,boundary:'No preload in an opaque sandboxed frame. This does not claim a raw IPC request was sent by a frame without that capability.'};
  await settings.evaluate(()=>document.querySelector('iframe[name="settings-frame-boundary"]')?.remove());
 });
}

export async function navigationSecurity({app,main,getSettings,setSettings,check,report}){
 await check('programmatic document replacement revokes the settings window and reopening uses a fresh instance',async()=>{
  const previous=getSettings(),closed=previous.waitForEvent('close');
  const oldId=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/settings.html')).id);
  await app.evaluate(async({BrowserWindow})=>{const window=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/settings.html'));try{await window.loadURL('about:blank');}catch{/* Controller destroys the revoked document. */}});
  await closed;assert.equal((await app.windows()).length,1);
  const opened=app.waitForEvent('window');await main.getByTestId('nav-settings').click();const current=await opened;setSettings(current);
  await current.getByTestId('pi-settings-workspace').waitFor();
  const newId=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/settings.html')).id);
  assert.notEqual(newId,oldId);report.navigationRevocation={oldId,newId,mainPreserved:true};
 });
}
