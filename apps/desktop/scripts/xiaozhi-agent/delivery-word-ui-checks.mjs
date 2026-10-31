import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {wordPageFixture} from './word-page-fixture.mjs';
import {OFFICE_JOB_SOURCE} from '../../src/main/xiaozhi-agent/checks/native-office-job.ts';

/** Continue the owned PDF profile; exercise existing-file Word checks through the original composer and file panel. */
export async function checkWordPages(ctx){
 const {workspace,data,output,report,send,finished,until,check,latest,sha}=ctx;
 const recoveryOnly=process.argv.includes('--word-recovery-only'),name='三页Word实际检查.docx',filePath=path.join(workspace,name),source=recoveryOnly?fs.readFileSync(filePath):await wordPageFixture(),stageRoot=path.join(data,'cache/delivery-paged/v1');
 if(!recoveryOnly)fs.writeFileSync(filePath,source);
 const inspect=async rules=>{
  await ctx.app.evaluate((_,{name,rules})=>Object.assign(globalThis.pagedTest,{mode:'inspect',stage:0,files:[{path:name,...(rules?{rules}:{})}]}),{name,rules});
  await send(`只检查${name}的真实页面，不改写文件。`);await finished();const result=latest();
  assert.equal(result.runId,ctx.query('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].id,'Inspection must belong to this actual run');
  assert.equal(result.files[0]?.path,name);return result.files[0];
 };
 const start=Date.now(),file=recoveryOnly?ctx.query('SELECT report_json FROM xiaozhi_delivery_inspections ORDER BY created_at DESC').flatMap(r=>JSON.parse(r.report_json).files).find(f=>f.path===name&&f.sha256===sha(source)&&f.renderedPages.length===3):await inspect({pages:3,contains:[{text:'PAGE_TWO',page:2}],numbers:[{id:'depth',source:{kind:'label',label:'浸入高度',page:2},expected:6,unit:'cm'}]});
 assert.deepEqual(file.renderedPages,[1,2,3]);assert.equal(file.pageCount,3);assert.equal(file.visualEvidence.length,3);
 assert(file.checks.some(c=>c.code==='numeric_comparison'&&c.state==='passed'));assert(!file.checks.some(c=>c.state==='failed'));
 assert(file.checks.some(c=>c.code==='actual_paged_rendered'&&c.state==='unchecked'));assert.equal(sha(fs.readFileSync(filePath)),sha(source));
 for(const proof of file.visualEvidence){const png=fs.readFileSync(path.join(data,'cache/delivery-check-visual/v1',proof.sha256+'.png'));assert.equal(sha(png),proof.sha256);assert.equal(proof.kind,'office_page');assert.equal(png.readUInt32BE(16),proof.width);assert.equal(png.readUInt32BE(20),proof.height);}
 report.word={elapsedMs:Date.now()-start,file,recoveryOnly};if(!recoveryOnly)check('Original composer reads the actual three-page Word file, exports real Word PDF and persists all3 independently hashed PNGs; page2 text and6cm pass without modifying source bytes');

 const openDetails=async()=>{
  const page=ctx.page;if(!await page.getByTestId('pi-file-panel').isVisible())await page.getByTestId('pi-files-toggle').click();
  await page.getByTestId('pi-files-refresh').click();const toggle=page.getByTestId('pi-files-explorer-toggle');if(await toggle.getAttribute('aria-pressed')==='false')await toggle.click();
  await page.getByTestId('pi-file-entry-'+name).click();const pane=page.getByTestId('pi-file-panel'),details=pane.getByTestId('pi-delivery-check');
  await details.locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]').click();return{pane,details};
 };
 const openPage=async()=>{const{pane,details}=await openDetails();await details.getByTestId('pi-file-check-result').waitFor();const visual=details.getByTestId('pi-check-visual');
  await visual.getByTestId('pi-check-visual-select').selectOption('1');await visual.getByTestId('pi-check-visual-load').click();
  await until(async()=>await visual.getByTestId('pi-check-visual-image').evaluate(e=>e.complete&&e.naturalWidth>0));
  assert.equal(sha(Buffer.from((await visual.getByTestId('pi-check-visual-image').getAttribute('src')).split(',')[1],'base64')),file.visualEvidence[1].sha256);
  return{pane,details,visual};
 };
 let ui;if(!recoveryOnly){ui=await openPage();for(const[width,height]of[[1366,768],[1920,1080]]){
  await ctx.page.setViewportSize({width,height});await ui.visual.getByTestId('pi-check-visual-expand').click();const bounds=await ui.visual.getByTestId('pi-check-visual-close').boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);await ctx.page.screenshot({path:path.join(output,`word-${width}.png`)});
  await ctx.page.keyboard.press('Escape');assert(await ui.pane.isVisible());
 }
 check('Original Word file panel selects exact native page2 pixels and enlarges at1366/1920; Escape preserves the original file panel');
 await ctx.close();await ctx.boot();ui=await openPage();assert.equal((await ctx.app.evaluate(()=>globalThis.pagedTest)).requests.length,0);
 check('Cold original application retrieves the same persisted actual Word page2 without a model call or file/publication replay');
 }else{ui=await openDetails();check('Recovery continuation reuses the exact prior Word bytes and persisted3-page proof; positive render/view/restart are not replayed');}

 const owner=()=>{for(const entry of fs.readdirSync(stageRoot)){const dir=path.join(stageRoot,entry),registered=path.join(dir,'owned.json'),input=path.join(dir,'input.docx');if(fs.existsSync(registered)&&fs.existsSync(input)&&sha(fs.readFileSync(input))===sha(source))return{...JSON.parse(fs.readFileSync(registered,'utf8')),folder:dir};}};
 await ui.details.getByTestId('pi-file-check-run').click();let owned;await until(()=>{owned=owner();return owned;});const stopped=Date.now();
 await ui.details.getByTestId('pi-file-check-cancel').click();await until(()=>latest()?.state==='cancelled'&&!fs.existsSync(owned.folder));
 const exists=()=>{try{process.kill(owned.pid,0);return true;}catch{return false;}};await until(()=>!exists(),15000);assert.equal(sha(fs.readFileSync(filePath)),sha(source));
 report.word.stopMs=Date.now()-stopped;report.word.cancelledOwner=owned;check('Visible Word Check Current File can be stopped after real Office ownership; its process and staging exit, cancelled receipt persists and original bytes remain unchanged');

 const ready=path.join(output,'word-busy-ready.json'),done=path.join(output,'word-busy-done');
 const busyScript=String.raw`$ErrorActionPreference='Stop';$a=$null;$d=$null;$j=$null;$own=$false;$discard=[object]0
Add-Type -TypeDefinition @'
${OFFICE_JOB_SOURCE}
'@
try{if(Get-Process WINWORD -ErrorAction SilentlyContinue){throw 'busy'};$start=[DateTime]::UtcNow;$a=New-Object -ComObject Word.Application;if($a.Documents.Count -ne 0){throw 'busy'};$a.Visible=$false;$d=$a.Documents.Add();[uint32]$id=0;[void][XiaozhiRenderJob]::GetWindowThreadProcessId([IntPtr]([int64]$a.ActiveWindow.Hwnd),[ref]$id);$p=Get-Process -Id $id;if($p.ProcessName -ne 'WINWORD' -or $p.StartTime.ToUniversalTime() -lt $start.AddSeconds(-1) -or $a.Documents.Count -ne 1){throw 'busy'};$own=$true;$j=New-Object XiaozhiRenderJob($p.Handle);[IO.File]::WriteAllText($env:XIAOZHI_BUSY_READY,(@{pid=[int]$id;start=$p.StartTime.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress));$end=[DateTime]::UtcNow.AddSeconds(25);while(-not(Test-Path -LiteralPath $env:XIAOZHI_BUSY_DONE) -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 100}}finally{if($own){if($d){$d.Close([ref]$discard)};if($a){$a.Quit([ref]$discard)}};if($j){$j.Dispose()}}`;
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(busyScript,'utf16le').toString('base64')],{windowsHide:true,stdio:'ignore',env:{...process.env,XIAOZHI_BUSY_READY:ready,XIAOZHI_BUSY_DONE:done}}),exited=new Promise(resolve=>child.once('close',resolve)),timer=setTimeout(()=>child.kill(),35000);
 try{await until(()=>{if(child.exitCode!==null)throw Error('Owned busy fixture failed');return fs.existsSync(ready);},20000);const busy=JSON.parse(fs.readFileSync(ready,'utf8')),result=await inspect();assert.deepEqual(result.renderedPages,[]);assert(result.checks.some(c=>c.code==='office_busy'&&c.state==='unchecked'));process.kill(busy.pid,0);assert.equal(child.exitCode,null);assert.equal(sha(fs.readFileSync(filePath)),sha(source));report.word.busyOwner=busy;check('An independent already-open Word instance stays alive while original composer reports busy and unrendered; it is not adopted or closed');}
 finally{fs.writeFileSync(done,'done');await exited;clearTimeout(timer);}
 assert.equal(sha(fs.readFileSync(filePath)),sha(source));
}
