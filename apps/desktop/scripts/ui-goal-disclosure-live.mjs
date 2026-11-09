/** PREPARED ONLY until parent signals build complete.
 * Run explicitly: node scripts/ui-goal-disclosure-live.mjs --run-after-build
 * Actual current out, fresh owned data/profile, no model keys or business fixtures.
 * Exported interaction helper can also reuse a real input in existing parent QA.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {captureStyleProbe} from './acceptance/ui-style-probe.mjs';
import {productEntry} from './product-navigation.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sizes=[[1366,768],[1920,1080],[800,768]], motions=['no-preference','reduce'];
const primary=[['ask','ai'],['materials','knowledge'],['teaching','teaching'],['students','student_workbench'],['settings','settings']];
const teaching=['artifacts','notebook','book','question_notebook','paper'];
const students=['students','search','intake','mistakes','mastery','review','analytics'];
const tabs=['models','permissions','interface','backup','archives','skills','tools','diagnostics'];
const safeError=error=>({
  name:/^[A-Za-z]+$/.test(error?.name||'')?error.name:'Error',
  ...(typeof error?.operator==='string'&&['strictEqual','deepStrictEqual','==','match'].includes(error.operator)?{operator:error.operator}:{}),
  frames:String(error?.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5).flatMap(frame=>{
    const at=frame.match(/:(\d+):(\d+)\)?$/);if(!at)return [];
    const name=frame.slice(0,at.index).replaceAll('\\','/').split('/').at(-1).replace(/^.*\(/,'').replace(/^\s*at /,'');
    return [{file:/^[A-Za-z0-9_.-]{1,120}\.(?:mjs|cjs|js)$/.test(name)?name:'[runtime]',line:Number(at[1]),column:Number(at[2])}];
  }),
});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});

/** No text, HTML, raw attributes, document frames or private content collected. */
export async function assertNoNativeDisclosure(root) {
  const details=await root.locator('details').count(),summary=await root.locator('summary').count();
  if(details+summary){const error=new Error('Formal application shell must have no native disclosure elements');error.nativeCounts={details,summary};throw error;}
  return {details,summary,scope:'Mounted main application shell; iframe document content excluded'};
}

/** Uses actual browser keyboard/mouse and official parts. Optional input stays in
 * browser memory only: report exports identity/value/focus booleans, never its value.
 * Collapsing via trigger correctly moves focus to trigger; hidden input must not retain focus.
 */
export async function exerciseDisclosureCard(page,{root,label,input,onSample=async()=>{},onScreen=async()=>{}}) {
  assert.equal(await root.count(),1);assert(await root.isVisible());
  const trigger=root.locator('[data-slot="disclosure-trigger"]'),panel=root.locator('[data-slot="disclosure-content"]');
  assert.equal(await trigger.count(),1);assert.equal(await panel.count(),1);
  const expanded=()=>trigger.getAttribute('aria-expanded');
  assert.equal(await expanded(),'false','Fresh disclosure starts collapsed');
  const card=root.locator('xpath=ancestor-or-self::*[@data-slot="card"][1]');
  assert.equal(await card.count(),1,'Disclosure uses official Card container');
  const geometry=await card.evaluate(element=>{
    const button=element.querySelector('[data-slot="disclosure-trigger"]'),indicator=button.querySelector('[data-slot="disclosure-indicator"]');
    const outer=element.getBoundingClientRect(),t=button.getBoundingClientRect(),i=indicator.getBoundingClientRect(),css=getComputedStyle(element);
    const innerWidth=outer.width-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-parseFloat(css.borderLeftWidth)-parseFloat(css.borderRightWidth);
    return {cardWidth:outer.width,innerWidth,triggerWidth:t.width,triggerDisplay:getComputedStyle(button).display,
      indicatorCenterDelta:Math.abs((t.top+t.height/2)-(i.top+i.height/2)),indicatorInside:i.left>=t.left&&i.right<=t.right+1};
  });
  assert(Math.abs(geometry.triggerWidth-geometry.innerWidth)<2,'Official trigger composition fills Card inner width');
  assert.equal(geometry.triggerDisplay,'flex','Application-owned trigger composition is a row');
  assert(geometry.indicatorInside&&geometry.indicatorCenterDelta<2,'Chevron stays aligned on the title row');
  let retained;
  if(input){assert.equal(await input.count(),1);retained=await input.evaluateHandle(element=>({element,value:element.value}));}
  try {
    await onSample(label+'-card',card);await onSample(label+'-default',trigger);await onScreen(label+'-default');
    await trigger.hover();await onSample(label+'-hover',trigger);
    // Tab back into trigger, so focus-visible is keyboard-driven, not a forced pseudo-state.
    await trigger.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
    assert(await trigger.evaluate(element=>document.activeElement===element),'Keyboard Tab must reach trigger');
    const focus=await trigger.evaluate(element=>({focus:element===document.activeElement,focusVisible:element.matches(':focus-visible')||element.hasAttribute('data-focus-visible')}));
    assert(focus.focusVisible,'Official trigger must expose keyboard focus');
    await onSample(label+'-focus',trigger);await onScreen(label+'-focus');
    await page.keyboard.press('Enter');await page.waitForFunction(element=>element.getAttribute('aria-expanded')==='true',await trigger.elementHandle());
    await settle(page);assert.equal(await panel.getAttribute('aria-hidden'),'false');
    await onSample(label+'-open',panel);await onSample(label+'-indicator',root.locator('[data-slot="disclosure-indicator"]'));await onScreen(label+'-open');
    await page.keyboard.press('Space');assert.equal(await expanded(),'false');
    await page.keyboard.press('Space');assert.equal(await expanded(),'true');
    let inputRetention=null;
    if(input){
      await input.focus();assert(await input.evaluate(element=>document.activeElement===element));
      await trigger.click();assert.equal(await expanded(),'false');
      await trigger.click();assert.equal(await expanded(),'true');await input.focus();
      inputRetention=await retained.evaluate(saved=>({mounted:document.contains(saved.element),sameValue:saved.element.value===saved.value,focusRestored:document.activeElement===saved.element}));
      assert(inputRetention.mounted&&inputRetention.sameValue&&inputRetention.focusRestored,'Disclosure toggles preserve original mounted input and unsaved value');
    }
    await trigger.click();assert.equal(await expanded(),'false');
    return {label,keyboard:['Tab','Enter','Space'],focus,inputRetention,geometry};
  } finally {await retained?.dispose();}
}

async function run() {
  const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main)),fixed=fingerprint(buildRoot),sourceBefore=fingerprint(path.join(desktop,'src')).sha256;
  assert(fs.existsSync(main),'Parent must complete current out build before running');
  const base=path.join(desktop,'test-results/ui-goal-20261101/disclosure-live');fs.mkdirSync(base,{recursive:true});
  const output=fs.mkdtempSync(path.join(base,'run-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  const report={success:false,preparedOnly:false,suite:'Formal application disclosure regression',build:{files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),checks:[],pages:[],samples:[],screens:[],errors:[],consoleErrors:[],interactions:[],humanAccepted:false,
    boundaries:['Actual current out or explicitly selected owned frozen build; independent empty profile/data; no business fixtures, credential files or model tasks',
      'CSSOM matched candidates and layers; no winning-selector claim, private text or DOM dump',
      'Empty pages only: student question/OCR/practice bodies require existing real UI QA; no generated teacher facts',
      'Standalone input retention uses existing blank settings field outside Card; helper supports actual in-Card drafts for parent QA',
      'Screenshots are device-pixel originals; no image resizing or CSS animation suppression']};
  report.sourceBefore=sourceBefore;
  let app,page,stage='launch';
  const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const shell=()=>page.locator('[data-edu-ui]:visible');
  async function screen(name){
    const metadata=await page.evaluate(()=>({cssWidth:innerWidth,cssHeight:innerHeight,dpr:devicePixelRatio,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));
    const native=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {boundsDIP:w.getContentBounds(),zoomFactor:w.webContents.getZoomFactor()};});
    const file=String(report.screens.length+1).padStart(3,'0')+'-'+name+'.png';
    const png=await page.screenshot({path:path.join(output,file),scale:'device',fullPage:false});
    report.screens.push({file,...metadata,native,pngWidth:png.readUInt32BE(16),pngHeight:png.readUInt32BE(20),resized:false});
  }
  const sample=async(name,locator)=>{report.samples.push(await captureStyleProbe(page,locator,name));};
  const step=async(name,fn)=>{stage=name;try{await fn();report.checks.push({name,pass:true});}catch(error){report.checks.push({name,pass:false});report.errors.push({stage,...safeError(error),...(error.nativeCounts?{nativeCounts:error.nativeCounts}:{})});await screen('failure-'+name).catch(()=>{});}write();};
  async function inspect(name){
    await settle(page);assert.equal(await shell().count(),1);
    const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth}));
    assert(layout.documentWidth<=layout.width+1&&layout.bodyWidth<=layout.width+1,'Page must not overflow horizontally: '+name);
    const native=await assertNoNativeDisclosure(shell());report.pages.push({name,...native});
    report.pages.at(-1).layout=layout;
    await sample(name+'-header',shell().locator('.edu-header'));
    await sample(name+'-workspace',shell().locator('.edu-workspace'));await screen(name);
  }
  try {
    const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:''});
    const bootstrap=zeroNetworkBootstrap({output,main,profile,counter:'__disclosureHttp'});
    app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],env,timeout:60000});
    page=await app.firstWindow();page.setDefaultTimeout(15000);await assertIsolatedPiMain(app,main,profile);
    page.on('pageerror',error=>report.errors.push({stage,...safeError(error)}));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({stage,type:'error'});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});
    assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),path.resolve(data),'Must use owned empty data root');
    for(const [width,height] of sizes)for(const motion of motions){
      const suffix=width+'-'+motion;
      await page.emulateMedia({colorScheme:'light',reducedMotion:motion});
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
      for(const [space,view] of primary)await step(view+'-'+suffix,async()=>{await productEntry(page,space).click();await page.locator(`[data-edu-ui][data-view="${view}"]:visible`).waitFor();await inspect(view+'-'+suffix);});
      for(const [space,routes] of [['teaching',teaching],['students',students]]){
        await productEntry(page,space).click();
        for(const route of routes)await step(route+'-'+suffix,async()=>{await page.locator(`[data-testid="hub-entry-${route}"]:visible`).click();await page.locator(`[data-edu-ui][data-view="${route}"]:visible`).waitFor();await inspect(route+'-'+suffix);});
      }
      await productEntry(page,'settings').click();
      for(const tab of tabs)await step('settings-'+tab+'-'+suffix,async()=>{
        const target=page.getByTestId('pi-settings-tab-'+tab);if(!await target.isVisible())await page.getByTestId('pi-settings-advanced-toggle').click();await target.click();
        await page.locator(`[data-testid="pi-settings-workspace"][data-tab="${tab}"]:visible`).waitFor();await inspect('settings-'+tab+'-'+suffix);
        if(tab==='models'){
          const result=await exerciseDisclosureCard(page,{root:page.getByTestId('pi-package-capabilities'),label:'capabilities-'+suffix,input:page.getByTestId('pi-settings-key'),onSample:sample,onScreen:screen});
          report.interactions.push({...result,inputScope:'Existing untouched blank settings input outside Card'});
          if(motion==='reduce'){
            const indicator=report.samples.findLast(item=>item.name==='capabilities-'+suffix+'-indicator');
            assert(indicator.environment.reducedMotion);assert(indicator.computed['transition-property']==='none'||indicator.computed['transition-duration'].split(',').every(value=>Number.parseFloat(value)===0),'Official indicator has no effective transition under reduced motion');
            const panel=report.samples.findLast(item=>item.name==='capabilities-'+suffix+'-open');
            assert(panel.computed['transition-property']==='none'||panel.computed['transition-duration'].split(',').every(value=>Number.parseFloat(value)===0),'Official content has no effective transition under reduced motion');
          }
        }
      });
    }
    assert.equal(fingerprint(buildRoot).sha256,fixed.sha256,'Parent out must remain unchanged during evidence capture');
    assert.equal(fingerprint(path.join(desktop,'src')).sha256,sourceBefore);
    report.networkAttempts=await app.evaluate(()=>globalThis.__disclosureHttp);
    assert.deepEqual(report.networkAttempts,[]);
    report.success=report.checks.every(check=>check.pass)&&report.errors.length===0&&report.consoleErrors.length===0;
  }catch(error){report.errors.push({stage,...safeError(error)});await screen('failure').catch(()=>{});}
  finally{await app?.close().catch(()=>{});write();if(!report.success)process.exitCode=1;console.log(JSON.stringify({success:report.success,checks:report.checks.length,failedChecks:report.checks.filter(item=>!item.pass).map(item=>item.name),errors:report.errors.length,consoleErrors:report.consoleErrors.length,output}));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--run-after-build')){try{await run();}catch(error){process.exitCode=1;console.log(JSON.stringify({success:false,stage:'preflight',...safeError(error)}));}}
  else console.log(JSON.stringify({preparedOnly:true,electronStarted:false,command:'node scripts/ui-goal-disclosure-live.mjs --run-after-build',parentBuildSignalRequired:true}));
}
