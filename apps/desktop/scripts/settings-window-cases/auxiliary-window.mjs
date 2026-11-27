import assert from 'node:assert/strict';

// Keep the R4 window reachable after model settings moved out of the main page.
export async function auxiliaryWindow({app,settings,check}) {
  await check('real settings opens the existing R4 window through its scoped adapter',async()=>{
    await settings.getByTestId('pi-settings-tab-models').click();
    const opened=app.waitForEvent('window');
    await settings.getByTestId('pi-settings-open-config-window').click();
    const auxiliary=await opened;
    await auxiliary.getByTestId('pi-config-window-default_model').waitFor();
    const methods=await auxiliary.evaluate(()=>({api:typeof window.xiaozhiConfigWindow?.read,full:typeof window.omniEdu}));
    assert.deepEqual(methods,{api:'function',full:'undefined'});
    const native=await app.browserWindow(auxiliary);
    const id=await native.evaluate(window=>window.id);
    await settings.getByTestId('pi-settings-open-config-window').click();
    assert.equal(await native.evaluate(window=>window.id),id);
    assert.equal(app.windows().filter(window=>window.url().endsWith('/config-window.html')).length,1);
    const closed=auxiliary.waitForEvent('close');
    await native.evaluate(window=>window.close());
    await closed;
  });
}
