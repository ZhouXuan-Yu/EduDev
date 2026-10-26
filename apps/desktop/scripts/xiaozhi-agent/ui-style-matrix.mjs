import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {compareOfficialAppearance} from './ui-style-evidence.mjs';

/** Uses an already-launched formal Electron page and its real history, not a mock renderer. */
export async function captureStyleMatrix({app,page,auditor,rendererRoot,output,theme,size,compareAppearance=compareOfficialAppearance}){
  const windowHandle=await app.browserWindow(page);
  const ensureNativeSize=async()=>{
    await windowHandle.evaluate((w,s)=>{if(w.isMinimized())w.restore();if(w.isMaximized())w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(s.width,s.height);},size);
    await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
    const actual=await windowHandle.evaluate(w=>w.getContentSize());
    assert.deepEqual(actual,[size.width,size.height],'Native window must match the CSS viewport');
  };
  // Keep Playwright's viewport bookkeeping aligned with the native Electron bounds.
  await page.setViewportSize(size);
  await app.evaluate(({BrowserWindow},s)=>{const w=BrowserWindow.getAllWindows()[0];if(w.isMinimized())w.restore();if(w.isMaximized())w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(s.width,s.height);w.show();w.focus();},size);
  await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
  await page.emulateMedia({colorScheme:theme,reducedMotion:'no-preference'});
  await page.waitForFunction(theme=>document.querySelector('[data-testid="office-conversation"]').dataset.theme===theme,theme);
  const toggle=page.getByTestId('agent-trace-toggle').first(),samples=[],checks=[];
  const stem=`after-${theme}-${size.width}`;
  async function capture(name,selector='[data-testid="agent-trace-toggle"]'){
    await ensureNativeSize();
    assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),size,'Viewport changed before '+name);
    const sample=await auditor.sample(selector,stem+'-'+name);samples.push(sample);
    const image=await windowHandle.evaluate(async w=>{const bitmap=await w.webContents.capturePage();return {data:bitmap.toDataURL(),size:bitmap.getSize()};});
    assert.deepEqual(image.size,{width:size.width,height:size.height},'Native screenshot pixel dimensions');
    fs.writeFileSync(path.join(output,stem+'-'+name+'.png'),Buffer.from(image.data.split(',')[1],'base64'));
    return sample;
  }
  await toggle.scrollIntoViewIfNeeded();
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  await page.mouse.move(1,1);await toggle.blur();await capture('completed-collapsed');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await capture('completed-expanded');
  await toggle.hover();await page.waitForTimeout(180);const hovered=await capture('hover');
  assert(hovered.winners.color.selector.startsWith('.chain-of-thought__trigger'));
  await page.mouse.move(1,1);await toggle.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');const focused=await capture('keyboard-focus');
  assert.equal(focused.dom.attributes['data-focus-visible'],'true');assert.equal(focused.computed['outline-style'],'none');assert.notEqual(focused.computed['box-shadow'],'none');
  await page.bringToFront();await toggle.hover();await page.waitForTimeout(180);const b=await toggle.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('[data-testid="agent-trace-toggle"]')?.getAttribute('data-pressed')==='true',undefined,{timeout:5000});const active=await capture('active');await page.mouse.up();
  assert.equal(active.dom.attributes['data-pressed'],'true');
  // Compare real production targets against only the untouched installed official CSS.
  await page.mouse.move(1,1);await toggle.blur();await page.waitForTimeout(250);
  const parity={};
  for(const selector of ['[data-testid="agent-trace-toggle"]','[data-testid="office-prompt-input"]','[data-slot="prompt-input-send"]','[data-testid="reply-copy"]']){
    parity[selector]=await compareAppearance(page,selector,rendererRoot,theme);
    for(const [property,result]of Object.entries(parity[selector]))assert(result.equal,stem+' '+selector+' '+property+' differs from original CSS');
  }
  checks.push('official cosmetics match for trace, text area and send','one official keyboard focus indicator','actual pointer hover and press','completed disclosure toggles');
  const header=page.getByTestId('pi-new-session');
  await header.hover();await capture('header-hover','[data-testid="pi-new-session"]');
  await page.mouse.move(1,1);await header.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  const headerFocus=await capture('header-focus','[data-testid="pi-new-session"]');
  assert.equal(headerFocus.dom.attributes['data-focus-visible'],'true');
  assert.notEqual(headerFocus.computed['box-shadow'],'none');
  await ensureNativeSize();
  const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
  geometry.native=await windowHandle.evaluate(w=>({content:w.getContentBounds(),zoom:w.webContents.getZoomFactor()}));
  assert.equal(geometry.width,size.width);assert.equal(geometry.height,size.height);
  const result={theme,size,geometry,checks,samples,parity};fs.writeFileSync(path.join(output,stem+'-matrix.json'),JSON.stringify(result,null,2));return{theme,size,geometry,checks:checks.length,samples:samples.length};
}
