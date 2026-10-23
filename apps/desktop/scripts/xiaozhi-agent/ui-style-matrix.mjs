import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {compareOfficialAppearance} from './ui-style-evidence.mjs';

/** Uses an already-launched formal Electron page and its real history, not a mock renderer. */
export async function captureStyleMatrix({app,page,auditor,rendererRoot,output,theme,size,compareAppearance=compareOfficialAppearance}){
  await app.evaluate(({BrowserWindow},s)=>{const w=BrowserWindow.getAllWindows()[0];if(w.isMinimized())w.restore();if(w.isMaximized())w.unmaximize();w.setContentSize(s.width,s.height);w.show();w.focus();},size);
  await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
  await page.emulateMedia({colorScheme:theme,reducedMotion:'no-preference'});
  await page.waitForFunction(theme=>document.querySelector('[data-testid="office-conversation"]').dataset.theme===theme,theme);
  const toggle=page.getByTestId('agent-trace-toggle').first(),samples=[],checks=[];
  const stem=`after-${theme}-${size.width}`;
  async function capture(name,selector='[data-testid="agent-trace-toggle"]'){
    const sample=await auditor.sample(selector,stem+'-'+name);samples.push(sample);
    const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());
    fs.writeFileSync(path.join(output,stem+'-'+name+'.png'),Buffer.from(image.split(',')[1],'base64'));
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
  const b=await toggle.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();const active=await capture('active');await page.mouse.up();
  assert.equal(active.dom.attributes['data-pressed'],'true');
  // Compare real production targets against only the untouched installed official CSS.
  await page.mouse.move(1,1);await toggle.blur();await page.waitForTimeout(250);
  const parity={};
  for(const selector of ['[data-testid="agent-trace-toggle"]','[data-testid="office-prompt-input"]','[data-slot="prompt-input-send"]']){
    parity[selector]=await compareAppearance(page,selector,rendererRoot,theme);
    for(const [property,result]of Object.entries(parity[selector]))assert(result.equal,stem+' '+selector+' '+property+' differs from original CSS');
  }
  checks.push('official cosmetics match for trace, text area and send','one official keyboard focus indicator','actual pointer hover and press','completed disclosure toggles');
  const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
  const result={theme,size,geometry,checks,samples,parity};fs.writeFileSync(path.join(output,stem+'-matrix.json'),JSON.stringify(result,null,2));return{theme,size,geometry,checks:checks.length,samples:samples.length};
}
