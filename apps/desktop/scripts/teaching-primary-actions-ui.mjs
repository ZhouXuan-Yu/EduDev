import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop=path.resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
assert.equal(args.length,2);
assert(args.includes('--run-ui'));
const argument=args.find(value=>value.startsWith('--pins='));
assert(argument);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const pinsFile=fs.realpathSync(path.resolve(desktop,argument.slice(7)));
assert(pinsFile.startsWith(owned+path.sep));
const pins=JSON.parse(fs.readFileSync(pinsFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned+path.sep));
const output=fs.mkdtempSync(path.join(owned,'teaching-primary-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
fs.mkdirSync(data);
fs.mkdirSync(profile);
const bootstrap=path.join(output,'bootstrap.cjs');
const main=path.join(pins.buildRoot,'main/index.js');
fs.writeFileSync(bootstrap,continuationBootstrap({main,profile}));
const env={...process.env};
for (const name of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
}
Object.assign(env,{NODE_ENV:'development',OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
const report={success:false,pins,output,samples:[],errors:[],budget:{launches:1,models:0,http:0,totalMs:120000}};
report.runnerSha256=sha256(fs.readFileSync(new URL(import.meta.url)));
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
let app,page;
const started=Date.now();
const deadline=setTimeout(()=>{
  report.budgetExceeded=true;
  save();
  if(app)spawn('taskkill.exe',['/PID',String(app.process().pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
},120000);
const verify=()=>{
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
};
try {
  verify();
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});
  page=await app.firstWindow({timeout:30000});
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.errors.push({kind:'page',hash:sha256(String(error))}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({kind:'console',hash:sha256(message.text())});});
  await page.getByTestId('workbench-home').waitFor();
  report.identity=await assertIsolatedPiMain(app,main,profile);
  for (const [width,height] of [[1366,768],[1920,1080],[800,768]]) {
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    for (const [route,field] of [
      ['notebook','teacher-notebook-name'],['book','teaching-book-title'],
      ['question_notebook','question-notebook-new-grade'],['artifacts','workbench-home'],
    ]) {
      await productEntry(page,'teaching').click();
      await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-'+route).click();
      const heading=page.getByTestId('teaching-page-heading');
      const action=page.getByTestId('teaching-page-actions').getByRole('button');
      await heading.waitFor();
      assert.equal(await action.count(),1);
      await action.click({trial:true});
      const box=await action.boundingBox();
      assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
      const readStyle=()=>action.evaluate(element=>{
        const css=getComputedStyle(element);
        return {background:css.backgroundColor,color:css.color,outline:css.outline,
          focusVisible:element.matches(':focus-visible'),active:element.matches(':active'),
          pressed:element.hasAttribute('data-pressed')};
      });
      await page.mouse.move(1,1);
      await page.waitForTimeout(180);
      const normal=await readStyle();
      await action.hover();
      await page.waitForTimeout(180);
      const hover=await readStyle();
      await action.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await action.evaluate(element=>document.activeElement===element),true);
      const focus=await readStyle();
      assert.equal(focus.focusVisible,true);
      await page.keyboard.down('Space');
      const pressed=await readStyle();
      assert(pressed.active||pressed.pressed);
      await page.keyboard.up('Space');
      await page.getByTestId(field).waitFor();
      const file=path.join(output,route+'-'+width+'.png');
      await page.screenshot({path:file});
      report.samples.push({route,width,height,box,normal,hover,focus,pressed,file,sha256:sha256(fs.readFileSync(file))});
      save();
    }
  }
  report.guard=await app.evaluate(continuationGuardRead,true);
  for(const name of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(report.guard[name],0);
  assert.deepEqual(report.errors,[]);
  verify();
  report.success=true;
} catch(error) {
  report.failure={message:error.message,stack:String(error.stack)};
  process.exitCode=1;
} finally {
  clearTimeout(deadline);
  try {await app?.close();report.closed=true;}
  catch(error){report.success=false;report.closeFailure=String(error);process.exitCode=1;}
  report.elapsedMs=Date.now()-started;
  report.runnerUnchanged=sha256(fs.readFileSync(new URL(import.meta.url)))===report.runnerSha256;
  if(!report.runnerUnchanged){report.success=false;process.exitCode=1;}
  if(report.elapsedMs>120000){report.success=false;report.budgetExceeded=true;process.exitCode=1;}
  save();
  console.log(JSON.stringify({success:report.success,output,samples:report.samples.length,failure:report.failure}));
}
