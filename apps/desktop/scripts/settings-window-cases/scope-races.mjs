import assert from 'node:assert/strict';
import {FIXTURE_KEY} from './provider-fixture.mjs';
import {waitForAsyncUi} from '../acceptance/async-ui-wait.mjs';

export async function globalSaveDuringSelection({app,main,settings,check,report}){
 await check('an admitted global save survives a main-session switch and reports the committed result',async()=>{
  await settings.getByTestId('pi-settings-default-model').click();await settings.getByRole('menuitemradio',{name:'deepseek-flash',exact:true}).click();
  await settings.getByTestId('pi-settings-key').fill(FIXTURE_KEY);
  const before=await settings.evaluate(()=>window.settingsWindow.getScope());
  await app.evaluate(()=>{globalThis.__settingsProviderPauseNext=true;});
  try{
   await settings.getByTestId('pi-settings-save').click();
   await app.evaluate(()=>new Promise((resolve,reject)=>{
    const end=Date.now()+4000;const poll=()=>{if(globalThis.__settingsProviderHolding)resolve();else if(Date.now()>end)reject(Error('fixture_not_held'));else setTimeout(poll,20);};poll();
   }));
   await main.getByTestId('workbench-new-session').click({timeout:3000});
   const dialog=main.getByTestId('workbench-new-dialog');await dialog.getByLabel('对话标题（可选）').fill('全局保存期间切换');
   await dialog.getByRole('button',{name:'创建对话',exact:true}).click();
   await settings.waitForFunction(id=>{const scope=window.settingsWindow.getScope();return scope.sessionId&&scope.sessionId!==id;},before.sessionId);
   assert(await app.evaluate(()=>globalThis.__settingsProviderHolding),'Release while validation is held, not after its timeout');
   await app.evaluate(()=>globalThis.__settingsProviderRelease?.());
   await dialog.waitFor({state:'detached'});
   await waitForAsyncUi(main,async()=>{const state=await window.omniEdu.getXiaozhiSettings();return state.ok&&state.value.defaultModelOverride==='deepseek-flash';},undefined,{timeout:4000});
   const host=await main.evaluate(()=>window.omniEdu.getXiaozhiSettings());
   report.globalSaveSelectionRace={before,after:await settings.evaluate(()=>window.settingsWindow.getScope()),hostVersion:host.value.version,hostModel:host.value.defaultModelOverride};
   await settings.getByTestId('pi-settings-feedback').filter({hasText:'已保存'}).waitFor({timeout:4000});
   assert.equal(await settings.getByTestId('pi-settings-key').inputValue(),'');
  }finally{await app.evaluate(()=>globalThis.__settingsProviderRelease?.()).catch(()=>{});}
 });
}
