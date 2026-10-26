import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';

// Reopen a previously accepted, owned real-provider session. No model or tool request is submitted.
const input=path.resolve(process.argv[2]||'');
assert(input.startsWith(path.resolve('test-results/xiaozhi-agent/pi-web-alternative-ui-'))&&path.basename(input)==='report.json');
const prior=JSON.parse(fs.readFileSync(input,'utf8'));assert(prior.success);
const owned=path.dirname(input),profile=path.join(owned,'profile'),data=path.join(owned,'data');
const output=fs.mkdtempSync('test-results/xiaozhi-agent/boardui-keyboard-ui-');
const root=prior.build.root,fixed=fingerprint(root);assert.equal(fixed.sha256,prior.build.sha256);
process.env.OMNI_EDU_TEST_BUILD_ROOT=root;const main=testMain(process.cwd());
const report={success:false,checks:[],build:prior.build,sourceReport:input,scope:'Formal Electron keyboard/reduced-motion recovery view of prior actual receipts only; no new model/tools, network or stop acceptance.'};
let app,page;const errors=[];
try {
 const env={...process.env,DEEPSEEK_API_KEY:'',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});
 report.launch=await assertIsolatedPiMain(app,main,profile);page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewportSize({width:1366,height:768});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 const tree=page.locator(`.office-turn[data-turn-id="${prior.turn.id}"]`).getByTestId('pi-web-search-process').filter({has:page.locator('.bui-ws-sources-button')});
 const button=tree.getByRole('button',{name:'引用来源',exact:true});await button.scrollIntoViewIfNeeded();await button.focus();
 assert.equal(await button.getAttribute('aria-expanded'),'false');await button.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.bui-ws-source-link')?.tabIndex===0);
 assert.equal(await button.getAttribute('aria-expanded'),'true');await button.press('Tab');
 assert(await tree.locator('.bui-ws-source-link').evaluate(el=>el===document.activeElement));
 report.checks.push({name:'Keyboard Enter expands actual receipt sources; Tab reaches the source link under reduced motion',pass:true});
 await button.focus();await button.press('Enter');await page.waitForFunction(()=>document.querySelector('.bui-ws-source-link')?.tabIndex===-1);
 assert.equal(await button.getAttribute('aria-expanded'),'false');assert(await tree.locator('.bui-ws-source-row').evaluate(el=>el.inert));
 assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
 assert.equal(await tree.locator('.bui-ws-working').count(),0);await page.screenshot({path:path.join(output,'keyboard-dark-1366.png'),animations:'disabled'});
 report.checks.push({name:'Collapse makes actual source rows inert and removes links from Tab order; restored completed receipt does not show Working',pass:true});
 assert.deepEqual(errors,[]);assert.equal(fingerprint(root).sha256,fixed.sha256);report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
