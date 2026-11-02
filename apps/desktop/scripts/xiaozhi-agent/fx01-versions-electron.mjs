import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {presentationFixture} from './presentation-fixture.mjs';
import {fx01Html,fx01Input,fx01Revision,fx01Cases} from './fx01-fixture.mjs';
import {productEntry} from '../product-navigation.mjs';

const {readWordPackage}=await import('../../src/main/assets/word-package.ts');
const {readPresentationNotes}=await import('./presentation-readback.ts');
const desktop=path.resolve(import.meta.dirname,'../..');
const resume=process.argv.find(a=>a.startsWith('--resume-root='))?.slice(14);
const output=resume?path.resolve(resume):fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-fx01-versions-'));
if(resume){assert.equal(path.dirname(output).toLowerCase(),os.tmpdir().replace(/[\\/]$/,'').toLowerCase());assert(path.basename(output).startsWith('xiaozhi-fx01-versions-'));}
const data=path.join(output,'data'),profile=path.join(output,'profile');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={ok:false,batch:'W3-FX01-E08-04-05-20261102',output,startedAt:new Date().toISOString(),checks:[],errors:[],
 sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),bundleHash:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),
 runtime:path.join(desktop,'out'),executor:'Codex',os:{platform:process.platform,release:os.release(),arch:os.arch()},
 fixture:{revision:fx01Revision,inputHash:sha(fx01Input),htmlHash:sha(fx01Html),pptDraftHash:sha(JSON.stringify(presentationFixture)),cases:fx01Cases},
 transport:{provider:'intercepted local synthetic SSE',model:'deepseek-flash',paidRequests:0,fees:0},
 boundary:'AT-E08-04/05 original UI/DB/DISK only; full three-parameter FX01 content frozen and independently exercised. No claim of natural model quality, all FX01 subsequent instructions, native Office/WPS layout/edit, physical drag/IME or other AT acceptance.'};
let app,page,sessionId,totalRequests=0;
if(resume&&fs.existsSync(path.join(output,'report.json'))){const previous=JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8'));const archive='prior-'+Date.now()+'.json';fs.copyFileSync(path.join(output,'report.json'),path.join(output,archive));if(fs.existsSync(path.join(output,'failure.png')))fs.copyFileSync(path.join(output,'failure.png'),path.join(output,archive+'.png'));report.priorAttempt={report:archive,error:previous.error,wire:previous.failedWire};totalRequests=previous.syntheticRequests||previous.failedWire?.requests.length||0;}
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const until=async(fn,timeout=90000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const v=await fn();if(v)return v;await new Promise(resolve=>setTimeout(resolve,80));}throw Error('FX01 journey timed out');};
const saved=()=>query("SELECT id,artifact_id,relative_path,parent_artifact_id,output_hash FROM xiaozhi_pi_office_drafts WHERE state='saved' ORDER BY rowid");
const fileRecord=file=>({path:file,sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size,mtime:fs.statSync(file).mtimeMs});
const sameFile=record=>assert.deepEqual(fileRecord(record.path),record);

async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},fixture)=>{
  const state=globalThis.fx01VersionFixture={phase:fixture.cold?'cold':'create',steps:{},requests:[],receipts:[],blocked:[],parent:null};
  net.fetch=async(url,init)=>{
   url=typeof url==='string'?url:url.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||state.phase==='cold'){state.blocked.push(url);throw Error('External requests and cold model replay forbidden');}
   const phase=state.phase,n=state.steps[phase]||0;state.steps[phase]=n+1;if(n>4)throw Error('Bounded local fixture exceeded');
   const body=JSON.parse(init.body),system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
   const requirementsVersion=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);
   let receipt,call;const last=body.messages.filter(m=>m.role==='tool').at(-1)?.content;
   if(last){const text=typeof last==='string'?last:last.filter(p=>p.type==='text').map(p=>p.text).join('\n');for(const line of text.split('\n'))try{const v=JSON.parse(line);if(v&&'success'in v){receipt=v;state.receipts.push({phase,n,value:v});break;}}catch{}}
   const target=phase==='create'?'current':phase==='edit'?'浮力讲解-第2版.pptx':'无需新建.pptx';
   if(n===0)call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion,expectedRevision:0,reason:'交付并保留明确指定的教学文件',steps:[{id:'deliver',text:phase==='create'?'交付浮力PPT与离线HTML':'处理第4页局部标题',dependsOn:[],reported:'pending',kind:phase==='create'?'saved_bundle':'saved_office',target},{id:'review',text:'教师检查教学内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};
   else if(phase==='create'&&n===1)call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'浮力演示.html',content:fixture.html},{fileId:'ppt',kind:'office',path:'浮力讲解.pptx',format:'pptx',sources:[],draft:fixture.draft}],taskStepId:'deliver'})};
   else if(phase!=='create'&&n===1)call={name:'office_file_stat',arguments:JSON.stringify({path:phase==='edit'?'浮力讲解.pptx':'浮力讲解-第2版.pptx'})};
   else if(phase!=='create'&&n===2){
    if(!receipt?.data?.version)throw Error('Missing original stat version');
    call={name:'office_create_document',arguments:JSON.stringify({path:target,format:'pptx',sources:[],parentArtifactId:state.parent,presentationEdit:{schemaVersion:'xiaozhi.presentation-edit.v1',version:receipt.data.version,pages:[{page:4,heading:'排液体积'}]},taskStepId:'deliver'})};
   }else{if(!receipt?.success)throw Error('Original operation failed '+JSON.stringify(receipt));if(phase==='same'&&receipt.outcome!=='unchanged')throw Error('Same content produced a version');}
   state.requests.push({phase,n,tool:call?.name||null,params:{model:body.model,reasoning_effort:body.reasoning_effort,thinking:body.thinking,max_tokens:body.max_tokens},receiptOutcome:receipt?.outcome});
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'fx01-local',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'fx01-'+phase+'-'+n,type:'function',function:call}]}:{content:'请核对已保存的实际文件；教学质量仍需教师判断。'})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,html:fx01Html,draft:presentationFixture});
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
 report.display=await app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({id:d.id,scaleFactor:d.scaleFactor,bounds:d.bounds})));
}
async function send(phase,text,parent){
 await app.evaluate((_,v)=>Object.assign(globalThis.fx01VersionFixture,{phase:v.phase,parent:v.parent}),{phase,parent});
 const count=query('SELECT count(*) n FROM ai_agent_runs')[0].n;
 await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(()=>query('SELECT count(*) n FROM ai_agent_runs')[0].n>count);
 return query('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].id;
}
async function finish(id){await until(()=>query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0]?.status!=='running');await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());assert.equal(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0].status,'succeeded');}
async function approveOffice(){const card=page.locator('[data-testid="pi-office-artifact"][data-state="pending"]').last();await card.waitFor({timeout:90000});await until(async()=>!await card.getByTestId('pi-office-approve').isDisabled());await card.getByTestId('pi-office-approve').click();}
async function versionControl(id){const control=page.locator(`[data-testid="pi-office-versions"][data-artifact-id="${id}"]`).first();await control.getByTestId('office-versions-toggle').click();await control.getByTestId('office-version-select').waitFor();return control;}
async function integrity(control){await until(async()=>await control.getByTestId('office-version-integrity').getAttribute('data-integrity')==='same');}
async function preview(control){await control.getByTestId('office-version-preview').click();const preview=page.getByTestId('pi-file-preview').last();await preview.waitFor({timeout:60000});await until(async()=>await preview.getAttribute('aria-busy')==='false'&&(await preview.textContent()).includes('浮力'));return preview;}
async function screenshot(name){await page.screenshot({path:path.join(output,name+'.png')});}

async function exerciseHtml(file){
 // The saved standalone file is independent of the host's generation and checks.
 const newWindow=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{const window=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});return window.loadURL(url);},pathToFileURL(file).href);
 const htmlPage=await newWindow;const htmlErrors=[];htmlPage.on('pageerror',e=>htmlErrors.push(String(e)));const results=[];
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await htmlPage.setViewportSize({width,height});const positions=[];
  for(const sample of fx01Cases){
   await htmlPage.locator('#reset').click();
   for(const [id,value]of [['wood-number',sample.wood],['load-number',sample.load]]){await htmlPage.locator('#'+id).fill(String(value));await htmlPage.locator('#'+id).press('Tab');}
   await htmlPage.locator('#liquid').selectOption(String(sample.liquid));
   const actual=await htmlPage.evaluate(()=>({values:Object.fromEntries(['mass','weight','total','buoyancy','max','volume','depth','exposed','net'].map(id=>[id,Number(document.getElementById(id).textContent)])),status:document.getElementById('status').textContent,position:document.getElementById('block').getAttribute('transform'),description:document.getElementById('scene-desc').textContent,explanation:document.getElementById('explanation').textContent,overflow:document.documentElement.scrollWidth>innerWidth+1}));
   for(const [key,value]of Object.entries(actual.values))assert(Math.abs(value-sample[key])<=0.05,`${sample.id} ${key}: ${value}`);
   assert.equal(actual.status,sample.status);assert.equal(actual.overflow,false);assert(actual.description.includes(sample.status));
   if(sample.id==='neutral')assert.match(actual.explanation,/不能.*确定.*深度/);
   if(sample.id==='overload')assert.match(actual.explanation,/尚未触底.*1\.0N/);
   positions.push(actual.position);results.push({width,height,id:sample.id,...actual});
   if(sample.id==='overload')await htmlPage.screenshot({path:path.join(output,'html-overload-'+width+'.png')});
  }
  assert(new Set(positions).size>=4,'Diagram must change with physical state');
  await htmlPage.locator('#reset').click();await htmlPage.locator('#load').focus();await htmlPage.keyboard.press('ArrowRight');assert.equal(await htmlPage.locator('#load-number').inputValue(),'0.1');
  await htmlPage.locator('#wood-number').fill('0');await htmlPage.locator('#wood-number').press('Tab');assert.equal(await htmlPage.locator('#wood-number').inputValue(),'600');assert.match(await htmlPage.locator('#limit-message').textContent(),/输入无效/);
  await htmlPage.locator('#load-number').fill('7');await htmlPage.locator('#load-number').press('Tab');assert.equal(await htmlPage.locator('#load-number').inputValue(),'0.1');assert.match(await htmlPage.locator('#limit-message').textContent(),/输入无效/);
  await htmlPage.locator('#reset').click();assert.equal(await htmlPage.locator('#load-number').inputValue(),'0');assert.equal(await htmlPage.locator('#wood-number').inputValue(),'600');assert.equal(await htmlPage.locator('#liquid').inputValue(),'1000');assert.equal(await htmlPage.locator('#depth').textContent(),'6.0');
  await htmlPage.screenshot({path:path.join(output,'html-default-'+width+'.png')});
 }
 assert.deepEqual(htmlErrors,[]);assert(!/https?:\/\/|<script[^>]+src=|<link[^>]+href=/i.test(fs.readFileSync(file,'utf8')));report.htmlResults=results;await htmlPage.close();
 check('Full saved offline FX01: all five independent physical states, diagram linkage, reset, keyboard and invalid-value feedback at both sizes');
}

try{
 await launch();let run;
 if(resume){assert.equal(saved().length,1,'Focused resume only before local edit, retaining original bundle');run=query('SELECT id FROM ai_agent_runs ORDER BY rowid LIMIT 1')[0].id;}
 else{run=await send('create',fx01Input);const bundle=page.getByTestId('pi-delivery-bundle').last();await bundle.waitFor({timeout:90000});await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());await screenshot('bundle-review');await bundle.getByTestId('pi-delivery-approve').click();await finish(run);}
 assert.equal(saved().length,1);const first=saved()[0],firstFile=query('SELECT file_path FROM document_artifacts WHERE id=?',[first.artifact_id])[0].file_path;
 const root=path.dirname(firstFile),htmlFile=path.join(root,'浮力演示.html'),firstRecord=fileRecord(firstFile),htmlRecord=fileRecord(htmlFile),oldBytes=fs.readFileSync(firstFile);
 const htmlSaved=fs.readFileSync(htmlFile,'utf8');assert(htmlSaved.endsWith(fx01Html));assert.match(htmlSaved.slice(0,htmlSaved.length-fx01Html.length),/^<!-- xiaozhi\.html-artifact\.v1 -->[\s\S]*connect-src 'none'/);const oldParts=await readWordPackage(oldBytes),notes=await readPresentationNotes(oldBytes);
 assert.equal([...oldParts.keys()].filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,8);assert.equal(notes.length,8);assert(notes.every(n=>n.text.length>15));assert.match(notes[6].text,/参考答案6N.*参考答案1N/);assert(!oldParts.get('ppt/slides/slide7.xml').toString().includes('参考答案'));
 report.original={run,artifact:first,html:htmlRecord,ppt:firstRecord,notes};await screenshot('bundle-saved');check('Full formal FX01 composer input produces one reviewed real HTML/PPT bundle, exact eight editable pages and eight meaningful notes');
 await exerciseHtml(htmlFile);sameFile(htmlRecord);sameFile(firstRecord);

 const editRun=await send('edit','只把第4页标题改为排液体积，保留其他页和HTML；另存PPT新版本。',first.artifact_id);await approveOffice();await finish(editRun);
 assert.equal(saved().length,2);const second=saved()[1],secondFile=query('SELECT file_path FROM document_artifacts WHERE id=?',[second.artifact_id])[0].file_path,secondRecord=fileRecord(secondFile);
 assert.equal(second.parent_artifact_id,first.artifact_id);const newParts=await readWordPackage(fs.readFileSync(secondFile));assert.deepEqual([...newParts.keys()].sort(),[...oldParts.keys()].sort());
 for(const [part,bytes]of oldParts){if(part==='ppt/slides/slide4.xml'){assert.notDeepEqual(newParts.get(part),bytes);assert(newParts.get(part).toString().includes('排液体积'));}else if(!part.startsWith('docProps/'))assert.deepEqual(newParts.get(part),bytes,part);}
 assert.deepEqual(await readPresentationNotes(fs.readFileSync(secondFile)),notes);sameFile(firstRecord);sameFile(htmlRecord);
 let control=await versionControl(second.artifact_id);assert.equal(await control.getByTestId('office-version-select').locator('option').count(),2);assert.match(await control.getByTestId('office-versions-current').textContent(),/第 2 版/);assert.match(await control.getByTestId('office-version-change').textContent(),/第 4 页/);report.changeSummary=await control.getByTestId('office-version-change').textContent();
 await control.getByTestId('office-version-select').selectOption(first.artifact_id);await integrity(control);await preview(control);await screenshot('old-preview-after-edit');await page.getByTestId('pi-files-close').click();
 report.edit={run:editRun,artifact:second,ppt:secondRecord};check('AT-E08-04: exact page-four edit, old preview, current version and truthful scope; all other package content/notes and independent HTML unchanged');

 const beforeNoop=query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n;
 const noopRun=await send('same','第4页标题仍设为排液体积；若内容相同则保持原文件，不重复保存。',second.artifact_id);await finish(noopRun);
 assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,beforeNoop);assert.equal(saved().length,2);assert.equal(await page.locator('[data-testid="pi-office-artifact"][data-state="pending"]').count(),0);assert(!fs.existsSync(path.join(root,'无需新建.pptx')));sameFile(firstRecord);sameFile(secondRecord);sameFile(htmlRecord);
 report.noop={run:noopRun,receipts:query('SELECT tool,success,native_state,effect_state FROM xiaozhi_tool_receipts WHERE run_id=?',[noopRun])};assert(report.noop.receipts.some(r=>r.tool==='office_create_document'&&r.success===1&&r.effect_state==='matched'));check('AT-E08-04: same-value edit adds zero draft/file/version/approval; unchanged receipt independently matches original saved bytes');

 // Reopen the existing card after the no-op turn, through its visible history control.
 control=page.locator(`[data-testid="pi-office-versions"][data-artifact-id="${second.artifact_id}"]`).first();if(await control.getByTestId('office-versions-toggle').getAttribute('aria-expanded')!=='true')await control.getByTestId('office-versions-toggle').click();
 await control.getByTestId('office-version-select').selectOption(first.artifact_id);await integrity(control);await control.getByTestId('office-version-restore').click();await screenshot('restore-review');await control.getByTestId('office-version-confirm').click();await until(()=>saved().length===3);await until(async()=>!await control.getByTestId('office-versions-refresh').isDisabled());
 const third=saved()[2],thirdFile=query('SELECT file_path FROM document_artifacts WHERE id=?',[third.artifact_id])[0].file_path,thirdRecord=fileRecord(thirdFile);assert.deepEqual(fs.readFileSync(thirdFile),oldBytes);sameFile(firstRecord);sameFile(secondRecord);sameFile(htmlRecord);assert.match(await control.getByTestId('office-versions-current').textContent(),/第 3 版/);
 await control.getByTestId('office-version-select').selectOption(third.artifact_id);await integrity(control);assert.match(await control.getByTestId('office-version-change').textContent(),/恢复旧版文件/);await preview(control);await screenshot('restored-current-preview');await page.getByTestId('pi-files-close').click();report.restored={artifact:third,ppt:thirdRecord};
 check('AT-E08-05: original restore confirmation creates byte-identical new current version; later PPT, original PPT and independent HTML remain intact');

 await productEntry(page,'teaching').click();await page.getByTestId('artifact-'+third.artifact_id).getByRole('button').click();control=await versionControl(third.artifact_id);
 assert.equal(await control.getByTestId('office-version-select').locator('option').count(),3);assert.match(await control.getByTestId('office-versions-current').textContent(),/第 3 版/);await control.getByTestId('office-version-select').selectOption(second.artifact_id);await integrity(control);await preview(control);
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await control.getByTestId('office-version-select').scrollIntoViewIfNeeded();assert(await control.getByTestId('office-version-select').isVisible());assert(await control.getByTestId('office-version-restore').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await screenshot('history-'+width);}
 report.warmWire=await app.evaluate(()=>globalThis.fx01VersionFixture);totalRequests+=report.warmWire.requests.length;assert.equal(report.warmWire.blocked.length,0);const ledger=saved();await app.close();app=null;
 await launch(true);await productEntry(page,'teaching').click();await page.getByTestId('artifact-'+third.artifact_id).getByRole('button').click();control=await versionControl(third.artifact_id);assert.equal(await control.getByTestId('office-version-select').locator('option').count(),3);assert.match(await control.getByTestId('office-versions-current').textContent(),/第 3 版/);await preview(control);await screenshot('cold-current');
 assert.deepEqual(saved(),ledger);for(const record of [firstRecord,secondRecord,thirdRecord,htmlRecord])sameFile(record);
 report.coldWire=await app.evaluate(()=>globalThis.fx01VersionFixture);assert.equal(report.coldWire.requests.length,0);assert.equal(report.coldWire.blocked.length,0);assert.deepEqual(report.errors,[]);
 report.ledger=ledger;report.effects={office:query('SELECT id,artifact_id,state,parent_artifact_id,relative_path,draft_hash,output_hash FROM xiaozhi_pi_office_drafts ORDER BY rowid'),text:query('SELECT * FROM xiaozhi_pi_text_changes'),artifacts:query('SELECT * FROM document_artifacts')};
 report.syntheticRequests=totalRequests;report.atResults={'AT-E08-04':{status:'passed',note:'已实现；完整本例UI/DB/DISK标准'},'AT-E08-05':{status:'passed',note:'已实现；完整本例UI/DB/DISK标准'}};
 check('Both original Teaching Files and cold restart retain all three versions and current preview with zero model replay; exact original and later files retained');report.ok=true;
}catch(error){report.error=String(error.stack);report.failedWire=await app?.evaluate(()=>globalThis.fx01VersionFixture).catch(()=>null);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;
}finally{await app?.close().catch(()=>{});report.finishedAt=new Date().toISOString();report.durationMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:report.checks.length,syntheticRequests:report.syntheticRequests,error:report.error}));}
