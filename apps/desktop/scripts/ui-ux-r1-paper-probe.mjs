import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'..'),owned=path.join(desktop,'test-results/ui-goal-paper-zsXwff');
assert(fs.existsSync(path.join(owned,'ui-goal-report.json')));
let app,page;const report={};
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(owned,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(owned,'electron-profile')],env,cwd:desktop});page=await app.firstWindow();page.setDefaultTimeout(20000);
 await page.getByTestId('office-prompt-input').waitFor();await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-teaching').click();await page.getByTestId('hub-entry-paper').click();
 await page.getByTestId('paper-entry-automatic').waitFor();report.before=await page.getByTestId('paper-entry-automatic').evaluate(el=>({disabled:el.disabled,text:el.textContent}));
 await page.getByTestId('paper-entry-automatic').click();await page.waitForTimeout(1000);report.testIds=await page.locator('.edu-shell:visible [data-testid]').evaluateAll(els=>els.map(el=>el.dataset.testid));report.text=await page.locator('.edu-shell:visible').innerText();
 await page.screenshot({path:path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence/paper-entry-probe.png')});
}catch(e){report.error=String(e);}finally{await app?.close();fs.writeFileSync(path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence/paper-entry-probe.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
