import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);
/** Reuse the exact native WPS fixture bytes and the previous isolated Pi profile, never regenerate prior deliverables. */
export async function checkWpsPages(ctx){
 const {workspace,data,output,report,send,finished,until,check,latest,sha,query}=ctx;
 const pptxStopOnly=process.argv.includes('--wps-pptx-stop-only');
 const index=process.argv.indexOf('--wps-native-root'),native=path.resolve(process.argv[index+1]||'');assert(index>=0);assert.equal(path.dirname(native).toLowerCase(),os.tmpdir().replace(/[\\/]$/,'').toLowerCase());assert(path.basename(native).startsWith('omni-edu-wps-native-'));
 const fixtures=[{name:'WPS实际三页.docx',format:'docx',stage:'delivery-paged',code:'actual_paged_rendered',engine:'WPS Writer',rules:{pages:3,contains:[{text:'PAGE_TWO',page:2}],numbers:[{id:'depth',source:{kind:'label',label:'浸入高度',page:2},expected:6,unit:'cm'}]}},{name:'WPS实际三页.pptx',format:'pptx',stage:'delivery-office',code:'actual_office_rendered',engine:'WPS Presentation',rules:{pages:3,notes:true,contains:[{text:'PAGE_2',page:2}]}}];
 const snapshot=async()=>{const script="[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);ConvertTo-Json -InputObject @(Get-Process wps,wpp,et -ErrorAction SilentlyContinue | ForEach-Object {@{pid=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');hwnd=$_.MainWindowHandle.ToInt64()}}) -Compress";const{stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true});return JSON.parse(stdout.trim());};
 report.wps={before:await snapshot(),files:[],stops:[]};
 for(const f of fixtures){f.bytes=fs.readFileSync(path.join(native,f.format,'input.'+f.format));const target=path.join(workspace,f.name);if(fs.existsSync(target))assert.equal(sha(fs.readFileSync(target)),sha(f.bytes));else fs.writeFileSync(target,f.bytes,{flag:'wx'});}
 if(!pptxStopOnly){
 await ctx.app.evaluate((_,files)=>Object.assign(globalThis.pagedTest,{mode:'inspect',stage:0,files}),fixtures.map(f=>({path:f.name,rules:{...f.rules,officeEngine:'wps'}})));
 const started=Date.now();await send('使用WPS检查WPS实际三页.docx和WPS实际三页.pptx的真实页面，核对第二页标记与浸入高度6cm，只检查现有文件。');await finished();const first=latest();assert.equal(first.runId,query('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].id);
 for(const f of fixtures){const file=first.files.find(x=>x.path===f.name);assert(file);assert.equal(file.sha256,sha(f.bytes));assert.equal(file.pageCount,3);assert.deepEqual(file.renderedPages,[1,2,3]);assert.equal(file.visualEvidence.length,3);assert(!file.checks.some(c=>c.state==='failed'));assert(file.checks.some(c=>c.code===f.code&&c.message.includes(f.engine)));report.wps.files.push(file);}
 report.wps.composerMs=Date.now()-started;check('Original Pi composer explicitly selects WPS for the exact DOCX/PPTX fixtures; both persist3 actual pages with physical-page content checks and distinct engine findings');
 const open=async f=>{
  const page=ctx.page;if(!await page.getByTestId('pi-file-panel').isVisible())await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-files-refresh').click();const toggle=page.getByTestId('pi-files-explorer-toggle');if(await toggle.getAttribute('aria-pressed')==='false')await toggle.click();await page.getByTestId('pi-file-entry-'+f.name).click();
  const pane=page.getByTestId('pi-file-panel'),details=pane.getByTestId('pi-delivery-check');await details.locator('summary').first().click();await details.getByTestId('pi-file-check-result').waitFor();return{pane,details};
 };
 const view=async(f,file)=>{const ui=await open(f),visual=ui.details.getByTestId('pi-check-visual');await visual.getByTestId('pi-check-visual-select').selectOption('1');await visual.getByTestId('pi-check-visual-load').click();await until(async()=>await visual.getByTestId('pi-check-visual-image').evaluate(e=>e.complete&&e.naturalWidth>0));assert.equal(sha(Buffer.from((await visual.getByTestId('pi-check-visual-image').getAttribute('src')).split(',')[1],'base64')),file.visualEvidence[1].sha256);return{...ui,visual};};
 for(const f of fixtures){
  let ui=await open(f);const prior=latest().id;await ui.details.getByTestId('pi-file-check-engine').selectOption('wps');await ui.details.getByTestId('pi-file-check-run').click();await until(async()=>latest()?.id!==prior&&!await ui.details.getByTestId('pi-file-check-run').isDisabled());
  const file=latest().files.find(x=>x.path===f.name);assert(file?.checks.some(c=>c.code===f.code&&c.message.includes(f.engine)));assert.equal(file.visualEvidence.length,3);assert.equal(file.sha256,sha(f.bytes));f.current=file;
  // Stay on the existing panel instead of toggling its already-open details again.
  const visual=ui.details.getByTestId('pi-check-visual');await visual.getByTestId('pi-check-visual-select').selectOption('1');await visual.getByTestId('pi-check-visual-load').click();await until(async()=>await visual.getByTestId('pi-check-visual-image').evaluate(e=>e.complete&&e.naturalWidth>0));assert.equal(sha(Buffer.from((await visual.getByTestId('pi-check-visual-image').getAttribute('src')).split(',')[1],'base64')),file.visualEvidence[1].sha256);
  for(const[width,height]of[[1366,768],[1920,1080]]){await ctx.page.setViewportSize({width,height});const engineBox=await ui.details.getByTestId('pi-file-check-engine').boundingBox();assert(engineBox&&engineBox.x>=0&&engineBox.x+engineBox.width<=width);await visual.getByTestId('pi-check-visual-expand').click();const bounds=await visual.getByTestId('pi-check-visual-close').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);await ctx.page.screenshot({path:path.join(output,`wps-${f.format}-${width}.png`)});await ctx.page.keyboard.press('Escape');assert(await ui.pane.isVisible());}
  check(`Original ${f.format} file panel selects WPS and rechecks actual current bytes; exact page2 opens/enlarges at1366/1920 without closing the pane`);
 }
 await ctx.close();await ctx.boot();for(const f of fixtures)await view(f,f.current);assert.equal((await ctx.app.evaluate(()=>globalThis.pagedTest)).requests.length,0);check('Cold original app retrieves both persisted WPS page2 PNGs without model/publication/render replay');
 }else{
  const saved=query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at DESC').flatMap(r=>JSON.parse(r.report_json).files);
  for(const f of fixtures){const prior=saved.find(row=>row.path===f.name&&row.sha256===sha(f.bytes)&&row.visualEvidence?.length===3&&row.checks.some(c=>c.code===f.code&&c.message.includes(f.engine)));assert(prior);report.wps.files.push(prior);}
  check('Focused recovery reuses both exact previously inspected WPS files and their persisted3-page proofs without replaying passed composer/view/cold/Word cancellation paths');
 }
 const openStop=async f=>{
  const page=ctx.page;if(!await page.getByTestId('pi-file-panel').isVisible())await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-files-refresh').click();const toggle=page.getByTestId('pi-files-explorer-toggle');if(await toggle.getAttribute('aria-pressed')==='false')await toggle.click();await page.getByTestId('pi-file-entry-'+f.name).click();const pane=page.getByTestId('pi-file-panel'),details=pane.getByTestId('pi-delivery-check');await details.locator('summary').first().click();return{pane,details};
 };
 for(const original of fixtures.filter(f=>!pptxStopOnly||f.format==='pptx')){
  let f=original;
  if(f.format==='pptx'){
   const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';for(let page=1;page<=64;page++)ppt.addSlide().addText('WPS在途停止 PAGE_'+page,{x:1,y:1,w:10,h:1,fontSize:24,fontFace:'Microsoft YaHei'});
   f={...f,name:'WPS在途64页.pptx',bytes:await ppt.write({outputType:'nodebuffer'})};const target=path.join(workspace,f.name);assert(!fs.existsSync(target),'Cancellation fixture must be new');fs.writeFileSync(target,f.bytes,{flag:'wx'});
  }
  const ui=await openStop(f);await ui.details.getByTestId('pi-file-check-engine').selectOption('wps');const stageRoot=path.join(data,'cache',f.stage,'v1'),previous=latest().id;await ui.details.getByTestId('pi-file-check-run').click();let owner;
  await until(()=>{for(const entry of fs.readdirSync(stageRoot)){const folder=path.join(stageRoot,entry),registered=path.join(folder,'owned.json');if(fs.existsSync(registered)&&fs.existsSync(path.join(folder,'input.'+f.format))&&sha(fs.readFileSync(path.join(folder,'input.'+f.format)))===sha(f.bytes)){owner={...JSON.parse(fs.readFileSync(registered,'utf8')),folder};return true;}}return false;});
  assert(owner.engine?.startsWith('KW'));assert(!report.wps.before.some(p=>p.pid===owner.pid));const start=Date.now();await ui.details.getByTestId('pi-file-check-cancel').click();await until(()=>latest()?.id!==previous&&latest()?.state==='cancelled'&&!fs.existsSync(owner.folder));await until(()=>{try{process.kill(owner.pid,0);return false;}catch{return true;}},15000);assert.equal(sha(fs.readFileSync(path.join(workspace,f.name))),sha(f.bytes));report.wps.stops.push({format:f.format,elapsedMs:Date.now()-start,owner});check(`Visible ${f.format} WPS check stops its independently owned Automation server and removes staging; cancellation receipt and original bytes retained`);
 }
 report.wps.after=await snapshot();for(const before of report.wps.before){const after=report.wps.after.find(p=>p.pid===before.pid);assert(after);assert.equal(after.start,before.start);assert.equal(after.hwnd,before.hwnd);}check(pptxStopOnly?'All pre-existing WPS processes and window identities survive the focused64-page PPT cancellation; earlier positive/Word paths are not replayed':'All pre-existing WPS processes and window identities survive original composer, manual checks, cold reads and both in-flight cancellations');
}
