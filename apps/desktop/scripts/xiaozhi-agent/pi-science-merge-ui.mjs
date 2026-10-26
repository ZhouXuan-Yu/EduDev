import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';
const {readScienceTeaching}=await import('../../src/main/xiaozhi-agent/science-teaching.ts');

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-science-merge-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),workspace=path.join(output,'workspace');
fs.mkdirSync(workspace);
const sourceName='散热片教学版.html',sourcePath=path.join(workspace,sourceName);
fs.copyFileSync(path.resolve('../../docs/integrations/examples/anatomy',sourceName),sourcePath);
const sourceBytes=fs.readFileSync(sourcePath),sourceHtml=sourceBytes.toString('utf8');
const svgSource=sourceHtml.match(/<script id="science-data" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/)?.[1];
assert(svgSource);
const teaching=readScienceTeaching(Buffer.from(svgSource,'base64').toString('utf8'));
assert(teaching);
const targetName='老师已有课件.pptx',targetPath=path.join(workspace,targetName);
const targetDeck=new pptxgen(),targetSlide=targetDeck.addSlide();
targetSlide.addText('老师已有课件（测试副本）',{x:1,y:1,w:8,h:1,fontSize:28});
targetSlide.addText('原有课堂内容保留',{x:1,y:2.2,w:8,h:.8,fontSize:20});
await targetDeck.writeFile({fileName:targetPath});
const targetBytes=fs.readFileSync(targetPath);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={success:false,checks:[],errors:[],launches:[],boundary:'Actual isolated Electron typed merge, installed PowerPoint COM and owned workspace. No model call, WPS, slideshow, daily profile or teacher acceptance claim.'};
let app,page,session;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=120000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('science merge condition timed out');}
async function launch(){
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.DEEPSEEK_API_KEY;
 app=await electron.launch({args:[testMain(process.cwd()),`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
 report.launches.push(await assertIsolatedPiMain(app,testMain(process.cwd()),profile));
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 assert.equal(await page.evaluate(()=>devicePixelRatio),1);
 await until(async()=>/^aisession_[0-9a-f-]{36}$/i.test(await page.locator('.office-composer-container').getAttribute('data-session-id')||''));
 session=await page.locator('.office-composer-container').getAttribute('data-session-id');
 assert.match(session,/^aisession_[0-9a-f-]{36}$/i);
 await app.evaluate(({dialog},paths)=>{globalThis.scienceMergeDialog='choose';dialog.showOpenDialog=async options=>{
  if(String(options?.title||'').includes('已有课堂课件'))return globalThis.scienceMergeDialog==='cancel'?{canceled:true,filePaths:[]}:{canceled:false,filePaths:[paths.target]};
  return {canceled:false,filePaths:[paths.workspace]};
 };},{workspace,target:targetPath});
}
async function openSource(){
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
 await until(async()=>Boolean((await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).workspace));
 if(!await page.getByTestId('pi-file-panel').isVisible())await page.getByTestId('pi-files-toggle').click();
 await page.getByTestId('pi-files-refresh').click();
 await page.getByTestId('pi-file-entry-'+sourceName).click();
 await page.getByTestId('science-export-merge').waitFor();
}
try{
 await launch();await openSource();
 await page.getByTestId('science-export-merge').click();
 await page.getByTestId('science-export-success').waitFor({timeout:120000});
 const success=await page.getByTestId('science-export-success').innerText();
 assert(/原 1 页＋新增/.test(success));assert(/原课件未修改/.test(success));
 const mergedName=fs.readdirSync(workspace).find(name=>name!==targetName&&name.endsWith('.pptx'));
 assert(mergedName);
 const mergedPath=path.join(workspace,mergedName),mergedBytes=fs.readFileSync(mergedPath);
 assert.deepEqual(fs.readFileSync(sourcePath),sourceBytes);assert.deepEqual(fs.readFileSync(targetPath),targetBytes);
 const zip=await JSZip.loadAsync(mergedBytes);
 const slideNames=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
 const studentXml=(await Promise.all(slideNames.map(name=>zip.file(name).async('string')))).join('\n');
 const noteNames=Object.keys(zip.files).filter(name=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
 const noteXml=(await Promise.all(noteNames.map(name=>zip.file(name).async('string')))).join('\n');
 assert.equal(slideNames.length,teaching.steps.length+4);
 assert(studentXml.includes('老师已有课件（测试副本）'));
 for(const text of[teaching.objective,teaching.observation,teaching.check.question,...teaching.steps.flatMap(step=>[step.question,step.explanation])])assert(studentXml.includes(text),'missing student text '+text);
 for(const text of[teaching.check.answer,...teaching.steps.map(step=>step.notes)]){assert(!studentXml.includes(text),'answer leaked '+text);assert(noteXml.includes(text),'missing note '+text);}
 assert(Object.keys(zip.files).some(name=>/^ppt\/media\/.*\.gif$/i.test(name)));
 assert(!Object.keys(zip.files).some(name=>/vbaProject|webextension|activeX/i.test(name)));
 report.merge={path:mergedPath,sha256:sha(mergedBytes),slides:slideNames.length,targetSha256:sha(targetBytes),sourceSha256:sha(sourceBytes)};
 check('Teacher click invokes real PowerPoint merge and preserves exact source and existing deck while appending reviewed teaching pages');

 let revealed='';await app.evaluate(({shell})=>{globalThis.scienceMergeRevealed='';shell.showItemInFolder=file=>{globalThis.scienceMergeRevealed=file;};});
 await page.getByTestId('science-export-reveal').click();await until(async()=>Boolean(await app.evaluate(()=>globalThis.scienceMergeRevealed)));
 revealed=await app.evaluate(()=>globalThis.scienceMergeRevealed);assert.equal(revealed,mergedPath);
 check('Merged copy reveal resolves the host-owned new file');

 const before=fs.readdirSync(workspace).sort();await app.evaluate(()=>{globalThis.scienceMergeDialog='cancel';});
 await page.getByTestId('science-export-merge').click();
 await until(async()=>await page.getByTestId('science-export-error').isVisible());
  assert.equal(await page.getByTestId('science-export-error').innerText(),'已取消合并，原课件未修改。');
 assert.deepEqual(fs.readdirSync(workspace).sort(),before);
  check('Cancel after the native existing-deck chooser says the merge was cancelled, keeps the original deck and leaves zero new copy');

 for(const [width,height] of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  await until(()=>page.evaluate(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]));
  await page.getByTestId('science-export-merge').scrollIntoViewIfNeeded();
  const box=await page.getByTestId('science-export-merge').boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
  await page.screenshot({path:path.join(output,`merge-${width}x${height}.png`)});
 }
 check('Teacher merge control remains reachable at both desktop sizes');

 const runs=(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).projection.turns.length;
 const durableHash=sha(fs.readFileSync(mergedPath));await app.close();app=undefined;await launch();await openSource();
 assert.equal(sha(fs.readFileSync(mergedPath)),durableHash);assert.deepEqual(fs.readFileSync(targetPath),targetBytes);
 assert.equal((await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).projection.turns.length,runs);
 check('Cold restart retains the merged copy and performs no model or merge replay');

 assert.deepEqual(report.errors,[]);report.build=fingerprint(path.dirname(path.dirname(testMain(process.cwd())))).sha256;report.success=true;
}catch(error){
 report.error=String(error.stack||error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
 await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}
