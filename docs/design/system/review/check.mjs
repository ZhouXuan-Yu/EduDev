import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../../apps/desktop/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=import.meta.dirname,out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const report={layer:'offline_layout_proposal_not_production',checks:[],errors:[],requests:[],screenshots:[],success:false};
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))report.requests.push(r.url());});
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const screenshot=async(name)=>{await page.locator('#notice').waitFor({state:'hidden',timeout:5000});await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});report.screenshots.push(name+'.png');};
const switchPage=async(key)=>page.locator(`[data-page="${key}"]`).click();
const fits=async(selector)=>{const box=await page.locator(selector).boundingBox();const vp=page.viewportSize();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=vp.width+1&&box.y+box.height<=vp.height+1,`${selector} outside ${JSON.stringify(vp)}: ${JSON.stringify(box)}`);};
try{
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
  await page.setViewportSize(size);
  for(const view of ['chat','students','settings'])await check(`${view} layout ${size.width}`,async()=>{await switchPage(view);assert(await page.locator('#context').isHidden());await fits('.page-header');await fits('footer');if(view==='chat'){await fits('#composer');await fits('.suggestions');assert.equal(await page.locator('.home').evaluate(el=>el.scrollHeight>el.clientHeight+1),false);}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(`${view}-${size.width}`);});
 }
 await check('Draft stays intact across pages and suggestions never overwrite',async()=>{await switchPage('chat');await page.locator('#prompt').fill('保留这个草稿');await switchPage('students');await switchPage('chat');await page.locator('[data-prompt]').first().click();assert.equal(await page.locator('#prompt').inputValue(),'保留这个草稿');});
 await check('File notification does not auto-open; explicit open and Escape return focus',async()=>{await page.locator('#file-demo').click();assert(await page.locator('#context').isHidden());await page.locator('#file-notice').click();assert(await page.locator('#context').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#context').isHidden());assert(await page.locator('#file-notice').evaluate(e=>e===document.activeElement));});
 await check('Student identity retained across tabs and replaced on student switch',async()=>{await switchPage('students');await page.locator('[data-student=A]').click();await page.locator('[data-tab="学习计划"]').click();assert.match(await page.locator('#student-state').innerText(),/A.*学习计划/);await page.locator('[data-student=B]').click();assert.match(await page.locator('#student-state').innerText(),/B.*学习计划/);await page.locator('#student-search').fill('不存在');assert(await page.locator('#no-students').isVisible());await page.locator('#student-search').fill('');await screenshot('students-selected');});
 await check('Advanced settings proposal opens by keyboard and remains marked pending',async()=>{await switchPage('settings');await page.locator('#advanced-link').focus();await page.keyboard.press('Enter');assert(await page.locator('#advanced').evaluate(e=>e.open));assert(await page.locator('.pending').isVisible());await screenshot('settings-advanced');});
 await check('Narrow 840 and 700 keep composer and footer reachable',async()=>{for(const width of [840,700]){await page.setViewportSize({width,height:768});await switchPage('chat');await fits('#composer');await fits('footer');await page.locator('#panel-toggle').click();await page.locator('#context').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));await fits('#context');await page.keyboard.press('Escape');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(`chat-${width}`);}});
 await check('150 percent equivalent CSS viewport and visible focus',async()=>{await page.setViewportSize({width:911,height:512});await switchPage('chat');await fits('#composer');await page.locator('#prompt').focus();await page.keyboard.press('Tab');assert(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'));await screenshot('chat-css911x512');});
 await check('Reduced motion and collapsed navigation',async()=>{await page.setViewportSize({width:1366,height:768});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#collapse').click();assert.equal(await page.locator('#collapse').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#collapse').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await fits('#composer');await screenshot('collapsed-reduced-motion');});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.success=true;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;await screenshot('failure');}finally{await browser.close();report.viewportScope='CSS viewports; 911x512 approximates reduced CSS area at 150% of 1366x768, not native OS scaling';report.artifactHashes=Object.fromEntries(['index.html','review.css','review.js','check.mjs'].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,out,error:report.error}));}
