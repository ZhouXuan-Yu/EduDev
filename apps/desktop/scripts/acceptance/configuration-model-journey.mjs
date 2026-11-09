import assert from 'node:assert/strict';

export async function modelConfigurationJourney(ctx){
 const {page,until,check,shot}=ctx.get(),view=()=>page.evaluate(()=>window.omniEdu.getXiaozhiSettings()),snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),ctx.sessionId);
 await ctx.tab('models');const initial=await view();assert(initial.ok);assert.equal(initial.value.configured,false);const old=(await snapshot()).projection.model;
 await page.getByTestId('pi-settings-key').fill('owned-config-invalid');await page.getByTestId('pi-settings-verify').click();await until(()=>page.getByTestId('pi-settings-feedback').innerText().then(t=>t==='API 密钥未通过验证，请检查后重试。'),'INVALID_CREDENTIAL');
 assert.equal((await view()).value.version,initial.value.version);assert.equal((await view()).value.configured,false);check('Rejected credential remains unconfigured with unchanged durable revision');
 await page.getByTestId('pi-settings-key').fill(ctx.modelKey);await page.getByTestId('pi-settings-verify').click();await until(()=>page.getByTestId('pi-settings-feedback').innerText().then(t=>t.includes('验证通过')),'VERIFY');
 assert.equal((await view()).value.configured,false);assert.equal((await view()).value.version,initial.value.version);check('Native credential verification exposes catalogue without silently saving credentials');
 await page.getByTestId('pi-settings-default-model').click();await page.getByRole('menuitemradio',{name:'deepseek-v4-pro',exact:true}).click();await page.getByTestId('pi-settings-save').click();
 await until(()=>view().then(v=>v.ok&&v.value.version===initial.value.version+1&&v.value.configured&&v.value.defaultModel==='deepseek-v4-pro'),'MODEL_SAVE');assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');assert.equal((await snapshot()).projection.model,old);
 assert(!(JSON.stringify(await view()).includes(ctx.modelKey)));await shot('model-saved');check('Original UI saves real protected credential; bound conversation keeps its original model');
 const saved=(await view()).value;await ctx.current().app.evaluate(()=>globalThis.__configurationProvider.failNext=true);
 await page.getByTestId('pi-settings-default-model').click();await page.getByRole('menuitemradio',{name:'deepseek-flash',exact:true}).click();await page.getByTestId('pi-settings-save').click();
 await until(()=>page.getByTestId('pi-settings-feedback').innerText().then(t=>!t.startsWith('已保存')&&t.length>0),'SAVE_FAILURE');
 const failed=(await view()).value;assert.equal(failed.version,saved.version);assert.equal(failed.defaultModel,saved.defaultModel);assert.equal(failed.configured,true);await shot('model-save-failed');check('Catalogue failure leaves saved model and credential version intact with visible error');
 await page.getByTestId('pi-thinking-global-trigger').click();await page.getByTestId('pi-thinking-option-auto').click();await until(()=>view().then(v=>v.ok&&v.value.thinking.global.choice==='auto'),'THINKING');
 const web=page.getByTestId('pi-web-enabled');if(await web.getAttribute('data-selected')==='true')await web.locator('[data-slot="switch-content"]').click();
 await page.getByTestId('pi-web-save').click();await until(()=>view().then(v=>v.ok&&v.value.web.enabled===false),'WEB_SAVE');
 ctx.expectedModel={defaultModel:saved.defaultModel,version:saved.version,oldModel:old};check('Thinking auto and web opt-out persist through their original separate versions');
}
