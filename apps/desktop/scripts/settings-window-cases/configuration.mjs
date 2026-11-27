import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {FIXTURE_KEY,REJECTED_KEY} from './provider-fixture.mjs';

const view=page=>page.evaluate(()=>window.omniEdu.getXiaozhiSettings());
const providerRow=data=>{
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{return db.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get()?.value_json??null;}
 finally{db.close();}
};
async function choose(page,id){await page.getByTestId('pi-settings-default-model').click();await page.getByRole('menuitemradio',{name:id,exact:true}).click();}
async function save(page){await page.getByTestId('pi-settings-save').click();await page.getByTestId('pi-settings-feedback').filter({hasText:'已保存'}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid="pi-settings-unsaved"]'));}

/** UI actions, original typed IPC/config journal, actual safeStorage and SQLite.
 * Only provider HTTP is a controlled transport; no provider-quality claim. */
export async function configuration({app,main,settings,check,report}){
 await settings.getByTestId('pi-settings-tab-models').click();
 await check('rejected credential stays editable and does not create saved configuration',async()=>{
  const initial=await view(settings);assert(initial.ok&&!initial.value.configured);
  const before=providerRow(report.data);
  await settings.getByTestId('pi-settings-key').fill(REJECTED_KEY);await settings.getByTestId('pi-settings-verify').click();
  await settings.getByTestId('pi-settings-feedback').filter({hasText:'API 密钥未通过验证'}).waitFor();
  assert.equal(await settings.getByTestId('pi-settings-key').inputValue(),REJECTED_KEY);
  assert.equal(providerRow(report.data),before);assert.equal((await view(main)).value.configured,false);
 });
 await check('visible credential save uses encrypted host storage and authoritative readback',async()=>{
  await settings.getByTestId('pi-settings-key').fill(FIXTURE_KEY);await save(settings);
  assert.equal(await settings.getByTestId('pi-settings-key').inputValue(),'');
  const current=await view(main);assert(current.ok&&current.value.configured);assert.equal(current.value.models.length,2);
  assert(!JSON.stringify(current).includes(FIXTURE_KEY));
  const raw=providerRow(report.data),stored=JSON.parse(raw);assert(stored.sealedKey&&!raw.includes(FIXTURE_KEY));
  assert(await app.evaluate(({safeStorage},{sealed,key})=>safeStorage.isEncryptionAvailable()&&safeStorage.decryptString(Buffer.from(sealed,'base64'))===key,{sealed:stored.sealedKey,key:FIXTURE_KEY}));
  report.credential={savedEncrypted:true,rendererMasked:true,version:current.value.version};
 });
 await check('default model save and field undo use real journal versions without undoing the credential',async()=>{
  const before=await view(main),sealed=JSON.parse(providerRow(report.data)).sealedKey;
  await choose(settings,'deepseek-v4-pro');await save(settings);
  const saved=await view(main);assert(saved.ok);assert.equal(saved.value.defaultModelOverride,'deepseek-v4-pro');assert(saved.value.version>before.value.version);
  await settings.getByTestId('pi-settings-config-history').getByRole('button',{name:'最近配置修改',exact:true}).click();
  await settings.getByTestId('pi-config-history-default_model').filter({hasText:'deepseek-v4-pro'}).waitFor();
  await settings.getByTestId('pi-config-undo-default_model').click();
  await settings.getByTestId('pi-config-feedback-default_model').filter({hasText:'已撤回'}).waitFor();
  const undone=await view(main);assert.equal(undone.value.defaultModelOverride,before.value.defaultModelOverride);assert(undone.value.version>saved.value.version);
  assert.equal(JSON.parse(providerRow(report.data)).sealedKey,sealed);
  report.configVersions={initial:before.value.version,saved:saved.value.version,undone:undone.value.version};
 });
 await check('a concurrent main-window writer preserves the settings draft and recovers through rebase',async()=>{
  await choose(settings,'deepseek-v4-pro');
  const concurrent=await main.evaluate(async()=>{
   const state=await window.omniEdu.getXiaozhiSettings();return window.omniEdu.commitXiaozhiConfig({field:'default_model',operationId:crypto.randomUUID(),expectedVersion:state.value.version,value:'deepseek-flash'});
  });assert(concurrent.ok);
  await settings.getByTestId('pi-settings-draft-conflict').waitFor({timeout:3000});assert((await settings.getByTestId('pi-settings-default-model').innerText()).includes('deepseek-v4-pro'));
  await settings.getByTestId('pi-settings-rebase').click();await save(settings);
  const saved=await view(main);assert.equal(saved.value.defaultModelOverride,'deepseek-v4-pro');assert(saved.value.version>concurrent.value.version);
  report.configVersions.rebased=saved.value.version;
 });
}
