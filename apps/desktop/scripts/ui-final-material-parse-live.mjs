/** A13 finite actual-UI preparation. Parent alone launches the frozen build.
 * Real local file.v3 page ACKs, original UI stop/continue, no paid AI-page flow.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {ownedExact,continuationBootstrap,continuationGuardRead,
  readContinuationBootstrapFile,waitContinuationBootstrap,closeContinuationRuntime}
  from './acceptance/paper-adaptation-continuation.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
assert(args.length===2&&args.includes('--run-ui')&&
  args.filter(a=>a.startsWith('--pins=')).length===1,'Use --run-ui --pins=<owned pins.json>');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const own=file=>ownedExact(path.resolve(desktop,file),owned);
const pinsFile=own(args.find(a=>a.startsWith('--pins=')).slice(7));
const pins=JSON.parse(fs.readFileSync(pinsFile));
for(const key of ['source','build'])assert.match(pins[key]??'',/^[a-f0-9]{64}$/);
const build=own(pins.buildRoot),main=own(path.join(build,'main/index.js'));
const output=fs.mkdtempSync(path.join(owned,'ui-final-material-parse-live-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),fixtures=path.join(output,'fixtures');
for(const dir of [data,profile,fixtures]){fs.mkdirSync(dir);assert.deepEqual(fs.readdirSync(dir),[]);}
const codes=['TXT_REAL_PARSER_COMPLETED_CONTROL','PDF_NATIVE_PAGE_ACK_AND_UI_STOP',
  'STOP_PRESERVES_SUCCESS_PAGE_AND_OLDER_BODY','UI_CONTINUE_PRE_WORKER_FAILURE',
  'FAILURE_PRESERVES_PAGE_SOURCE_AND_CONTROL','UI_RETRY_REAL_THREE_PAGE_COMPLETION',
  'SUCCESS_PAGE_SKIP_AND_EXACT_RETENTION','LATE_ORIGINAL_BODY_RESPONSE_SELECTION_GUARD',
  'FINAL_ZERO_HTTP_MODEL_AND_INTEGRITY'];
const report={suite:'A13-local-file-parser-finite-actual-subset',status:'RUNNING',success:false,
  output,data,profile,phase:'PREFLIGHT',pins:{file:pinsFile,...pins},
  budget:{launches:1,totalSeconds:180,models:0,http:0,parserAttempts:3},
  checks:codes.map(code=>({code,status:'NOT_RUN'})),errors:[],guards:[],
  seams:[
    'Original app-owned file picker returns only this run synthetic TXT/PDF; one-shot per explicit UI import.',
    'Native parser stdin request held before first delivery, then forwarded unchanged; second request terminates its real child before delivery; third uses the actual worker.',
    'Successful native page ACKs and page rows are observed only; no worker output, page result, task row or source bytes are substituted.',
    'One original materials:body response is held after its real handler returns, then released unchanged after selecting the TXT through original UI.',
    'Main zero-HTTP/model guard precedes formal main import; formal frame restrictions remain composed.'
  ],limits:[
    'One local three-page PDF with native text pages 1/3 and synthetic raster page 2, plus one TXT control. No paid AI-page processing.',
    'If the real page-1-saved/page-2-processing stop window is missed, FAIL; no force, relaunch, fabricated checkpoint or skipped PASS.',
    'One launch only: no cold-start, crash recovery, other formats, arbitrary page-error or full A13 acceptance claim.'
  ]};
const dependencies=new Set();
function dependency(file){
  const real=fs.realpathSync(file);assert(real.startsWith(desktop+path.sep));
  if(dependencies.has(real))return;dependencies.add(real);
  for(const m of fs.readFileSync(real,'utf8').matchAll(/from\s*['"](\.[^'"]+\.mjs)['"]/g)){
    dependency(path.resolve(path.dirname(real),m[1]));
  }
}
dependency(fileURLToPath(import.meta.url));
const qaHashes=()=>[...dependencies].sort().map(file=>({file:path.relative(desktop,file),
  sha256:sha256(fs.readFileSync(file))}));
report.qaBefore=qaHashes();
const pinsHash=sha256(fs.readFileSync(pinsFile));
const txt={file:path.join(fixtures,'QA-A13-completed-control.txt'),marker:'QACONTROLRETAINED'};
const pdf={file:path.join(fixtures,'QA-A13-three-real-pages.pdf'),marker:'QAPAGEALPHARETAINED'};
let app,page,child,deadlineAt,hardTimer,timedOut=false,killRequested=false;
let baseline,controlBaseline,pageBaseline,pageChunkBaseline,generation;
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
function phase(name){report.phase=name;report.phaseHistory??=[];
  report.phaseHistory.push({phase:name,at:Date.now()});persist();}
function diagnostic(error){
  const stack=String(error?.stack||error),message=String(error?.message||'');
  const known=['GLOBAL_DEADLINE','WAIT_DEADLINE','BOOTSTRAP_FAILED','BOOTSTRAP_CHILD_EXITED',
    'BOOTSTRAP_STATE_INVALID','BOOTSTRAP_STATE_REDIRECTED','BOOTSTRAP_READY_DEADLINE'];
  return {code:known.includes(message)?message:error?.code==='ERR_ASSERTION'?'QA_ASSERTION':
    error?.name==='TimeoutError'?'QA_TIMEOUT':'QA_UNKNOWN',phase:report.phase,hash:sha256(stack),
    qaFrames:[...stack.matchAll(/ui-final-material-parse-live\.mjs:(\d+):(\d+)/g)].slice(0,8)
      .map(m=>({file:'scripts/ui-final-material-parse-live.mjs',line:+m[1],column:+m[2]}))};
}
function remaining(cap=10000){
  if(timedOut||Date.now()>=deadlineAt-12000)throw Error('GLOBAL_DEADLINE');
  return Math.min(cap,deadlineAt-Date.now()-12000);
}
function verify(){
  assert.equal(own(pins.buildRoot),build);assert.equal(sha256(fs.readFileSync(pinsFile)),pinsHash);
  assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
  assert.deepEqual(qaHashes(),report.qaBefore);
  for(const fixture of report.fixtures||[]){assert.equal(own(fixture.file),fixture.file);
    assert.equal(sha256(fs.readFileSync(fixture.file)),fixture.sha256);}
}
function read(sql,params=[]){
  assert(/^SELECT\s/i.test(sql));const file=own(path.join(data,'app.db'));
  const db=new DatabaseSync(file,{readOnly:true});
  try{return JSON.parse(JSON.stringify(db.prepare(sql).all(...params)));}finally{db.close();}
}
const resource=spec=>read('SELECT * FROM teacher_resources WHERE original_file_name=?',[path.basename(spec.file)])[0];
const chunks=id=>read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index',[id]);
const task=id=>read("SELECT * FROM ai_tasks WHERE task_type='resource_parse' AND input_hash=?",[sha256(id)])[0];
const pages=()=>read('SELECT * FROM material_pdf_pages WHERE generation=? ORDER BY page',[generation]);
function ledger(){return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions',
  'ai_agent_events','xiaozhi_event_journal','xiaozhi_pi_commands','xiaozhi_pi_usage',
  'ai_confirmation_items','question_bank_items'].map(table=>{
    const rows=read('SELECT * FROM '+table+' ORDER BY rowid');return [table,{count:rows.length,sha256:sha256(JSON.stringify(rows))}];
  }));}
function auditLedger(){const value=ledger();if(baseline)assert.deepEqual(value,baseline);
  for(const table of ['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage']){
    assert.equal(value[table].count,0);
  }report.lastLedger=value;}
function originals(){for(const spec of [txt,pdf].filter(s=>s.id)){
  const row=resource(spec);assert.equal(row.id,spec.id);assert.equal(row.content_hash,spec.sha256);
  const local=own(row.local_path);assert(local.startsWith(data+path.sep));
  assert.equal(sha256(fs.readFileSync(local)),spec.sha256);
  assert.equal(sha256(fs.readFileSync(spec.file)),spec.sha256);
}}
function retained(){
  originals();assert.deepEqual({row:resource(txt),chunks:chunks(txt.id)},controlBaseline);
  assert.deepEqual(pages().find(p=>p.page===1),pageBaseline);
  assert.deepEqual(read('SELECT * FROM material_pdf_chunks WHERE generation=? AND page=1 ORDER BY local_index',
    [generation]),pageChunkBaseline);
}
async function guard(){remaining();const state=await app.evaluate(continuationGuardRead);
  report.guards.push(state);if(report.guards.length>32)report.guards.splice(0,1);
  assert.equal(state.networkAttempts,0);assert.equal(state.modelAttempts,0);
  assert.equal(state.rendererErrors,0);assert.deepEqual(report.errors,[]);}
async function wait(predicate,cap=20000){const end=Date.now()+remaining(cap);
  while(Date.now()<end){await guard();if(await predicate())return;await new Promise(r=>setTimeout(r,80));}
  throw Error('WAIT_DEADLINE');}
const tid=id=>page.getByTestId(id);
async function unique(locator){const target=locator.filter({visible:true});
  await target.waitFor({state:'visible',timeout:remaining()});assert.equal(await target.count(),1);
  assert(await target.isVisible());await wait(()=>target.isEnabled());assert(await target.isEnabled());return target;}
async function click(locator){await guard();await (await unique(locator)).click({timeout:remaining()});}
async function select(spec){await click(page.locator(`[data-testid="material-${spec.id}"] button`));
  await wait(async()=>await tid('materials-detail').getAttribute('data-resource-id')===spec.id);}
async function queueStatus(status){
  const trigger=await unique(tid('materials-queue').locator('button[aria-expanded]'));
  if(await trigger.getAttribute('aria-expanded')!=='true')await click(trigger);
  await wait(async()=>await tid('materials-task').isVisible()&&
    await tid('materials-task').getAttribute('data-status')===status);
}
async function step(code,action){phase(code);const item=report.checks.find(c=>c.code===code);
  try{await action();await guard();auditLedger();item.status='PASS';persist();}
  catch(error){item.status='FAIL';item.failure=diagnostic(error);persist();throw error;}}

/** GDI draws a genuine raster fixture; PDF objects/xref contain its real RGB bytes. */
function makeFixtures(){
  fs.writeFileSync(txt.file,`Explicit synthetic QA fixture, no teacher or student data.\n${txt.marker}\nLocal control body must survive unrelated parsing stop and retry.\n`,{flag:'wx'});
  const bmp=path.join(fixtures,'QA-A13-raster.bmp');
  const ps=`Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(1600,2200,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$font = [System.Drawing.Font]::new('Arial',28,[System.Drawing.FontStyle]::Regular,[System.Drawing.GraphicsUnit]::Pixel)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  for ($line=0; $line -lt 40; $line++) {
    $text = 'QA RASTER PAGE BETA. Local physics reading. Water volume and force.'
    $graphics.DrawString($text,$font,[System.Drawing.Brushes]::Black,45,(60+$line*49))
  }
  $bitmap.Save('${bmp.replaceAll("'","''")}',[System.Drawing.Imaging.ImageFormat]::Bmp)
} finally { $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
`;
  assert.equal(process.platform,'win32','This fixture generator requires the parent Windows host');
  const draw=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',
    Buffer.from(ps,'utf16le').toString('base64')],{windowsHide:true,timeout:remaining(12000),encoding:'utf8'});
  report.fixtureGeneration={exit:draw.status,stdoutHash:sha256(draw.stdout||''),stderrHash:sha256(draw.stderr||'')};
  assert.equal(draw.status,0,'Native raster fixture generation failed');
  const image=fs.readFileSync(bmp);assert.equal(image.toString('ascii',0,2),'BM');
  const start=image.readUInt32LE(10),width=image.readInt32LE(18),height=image.readInt32LE(22);
  assert.equal(width,1600);assert.equal(height,2200);assert.equal(image.readUInt16LE(28),24);
  assert.equal(image.readUInt32LE(30),0);
  const stride=Math.ceil(width*3/4)*4,rgb=Buffer.alloc(width*height*3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const src=start+(height-y-1)*stride+x*3,dest=(y*width+x)*3;
    rgb[dest]=image[src+2];rgb[dest+1]=image[src+1];rgb[dest+2]=image[src];
  }
  const objects=[];
  const put=value=>objects.push(Buffer.isBuffer(value)?value:Buffer.from(value));
  const stream=(header,bytes)=>Buffer.concat([Buffer.from(`<< ${header} /Length ${bytes.length} >>\nstream\n`),bytes,Buffer.from('\nendstream')]);
  put('<< /Type /Catalog /Pages 2 0 R >>');
  put('<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>');
  put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>');
  put(stream('',Buffer.from(`BT /F1 14 Tf 48 780 Td (${pdf.marker}) Tj 0 -30 Td (Explicit synthetic QA local document. Page one native text.) Tj 0 -30 Td (This successful page must remain unchanged after stop and retry.) Tj 0 -30 Td (Water volume and spring force are local reading examples.) Tj ET`)));
  put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Raster 10 0 R >> >> /Contents 7 0 R >>');
  put(stream('',Buffer.from('q 595 0 0 842 0 0 cm /Raster Do Q')));
  put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 9 0 R >>');
  put(stream('',Buffer.from('BT /F1 14 Tf 48 780 Td (QAPAGEGAMMAFINAL) Tj 0 -30 Td (Explicit synthetic QA final native page.) Tj 0 -30 Td (The actual local parser must preserve all three page numbers.) Tj ET')));
  put(stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,deflateSync(rgb)));
  const parts=[Buffer.from('%PDF-1.4\n% genuine synthetic QA fixture\n')],offsets=[0];let length=parts[0].length;
  for(const [i,object] of objects.entries()){
    offsets.push(length);const bytes=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);
    parts.push(bytes);length+=bytes.length;
  }
  parts.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`+
    offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  fs.writeFileSync(pdf.file,Buffer.concat(parts),{flag:'wx'});
  for(const spec of [txt,pdf])spec.sha256=sha256(fs.readFileSync(spec.file));
  report.fixtures=[txt,pdf,{file:bmp,sha256:sha256(image)}];
}
async function importOriginal(spec){
  await app.evaluate(({dialog,BrowserWindow},file)=>{
    const fs=process.getBuiltinModule('fs');if(fs.realpathSync(file)!==file||!fs.statSync(file).isFile())throw Error('QA_CHOOSER_PATH');
    const window=BrowserWindow.getAllWindows()[0],original=dialog.showOpenDialog;
    dialog.showOpenDialog=async(owner,options)=>{
      dialog.showOpenDialog=original;
      if(owner!==window||options?.title!=='选择教学资料'||
        JSON.stringify(options.properties)!==JSON.stringify(['openFile','multiSelections']))throw Error('QA_CHOOSER_OWNER');
      globalThis.__qaA13Choosers=(globalThis.__qaA13Choosers||0)+1;
      return {canceled:false,filePaths:[file]};
    };
  },spec.file);
  await click(tid('materials-import'));await wait(()=>!!resource(spec));spec.id=resource(spec).id;
  await wait(()=>tid('materials-import').isEnabled());await select(spec);
}
async function installParserSeam(){
  await app.evaluate((_electron,input)=>{
    const cp=process.getBuiltinModule('child_process'),mod=process.getBuiltinModule('module');
    const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');
    const original=cp.spawn,state={attempts:[],release:null,restore:null};
    globalThis.__qaA13Parser=state;
    const wrapped=function(...args){
      const worker=original.apply(this,args);
      if(path.basename(String(args[0])).toLowerCase()!=='omni-edu-ocr.exe')return worker;
      const write=worker.stdin?.write;if(!write)throw Error('QA_NATIVE_STDIN_MISSING');let record;
      worker.stdin.write=function(...values){
        let message;try{message=JSON.parse(String(values[0]).trim());}catch{return write.apply(this,values);}
        if(record&&message.ack===true){record.acked.push(message.page);return write.apply(this,values);}
        if(record||message.schemaVersion!=='xiaozhi.local-pdf-file.v3'||message.operation!=='parse')return write.apply(this,values);
        const real=fs.realpathSync(message.file);
        if(real!==message.file||!real.startsWith(input.data+path.sep)||
          fs.realpathSync(message.root)!==path.dirname(real)||
          fs.readFileSync(real).length!==input.bytes)throw Error('QA_PARSER_PATH');
        const hash=process.getBuiltinModule('crypto').createHash('sha256').update(fs.readFileSync(real)).digest('hex');
        if(hash!==input.sha256||message.inputSha256!==input.sha256)throw Error('QA_PARSER_SOURCE');
        const index=state.attempts.length+1;if(index>3)throw Error('QA_PARSER_ATTEMPT_BUDGET');
        record={index,pid:worker.pid,skipPages:[...message.skipPages],acked:[],closed:false,forwarded:false};
        state.attempts.push(record);worker.once('close',()=>{record.closed=true;});
        if(index===1){state.release=()=>{if(record.forwarded||worker.stdin.destroyed)throw Error('QA_HELD_WORKER_UNAVAILABLE');
          record.forwarded=true;return write.apply(worker.stdin,values);};return true;}
        if(index===2){record.failureSeam='REAL_CHILD_TERMINATED_BEFORE_REQUEST';worker.kill();return true;}
        record.forwarded=true;return write.apply(this,values);
      };
      return worker;
    };
    cp.spawn=wrapped;mod.syncBuiltinESMExports();
    state.restore=()=>{if(cp.spawn!==wrapped)throw Error('QA_PARSER_OWNER_CHANGED');cp.spawn=original;mod.syncBuiltinESMExports();};
  },{data,name:path.basename(pdf.file),sha256:pdf.sha256,bytes:fs.statSync(pdf.file).size});
}
const parserState=()=>app.evaluate(()=>{
  const state=globalThis.__qaA13Parser;
  return {attempts:state.attempts,held:typeof state.release==='function'};
});
async function lateBody(){
  await select(txt);
  await app.evaluate(({ipcMain,BrowserWindow},resourceId)=>{
    const handlers=ipcMain._invokeHandlers,channel='materials:body',original=handlers?.get(channel);
    if(typeof original!=='function')throw Error('QA_READ_TRANSPORT_UNAVAILABLE');
    const main=BrowserWindow.getAllWindows()[0],hash=value=>process.getBuiltinModule('crypto')
      .createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const state={captured:false,released:false,delivered:false,restore:null};globalThis.__qaA13Late=state;
    const wrapped=async(event,input)=>{
      if(input?.resourceId!==resourceId)return original(event,input);
      if(event.sender!==main.webContents||event.senderFrame!==main.webContents.mainFrame||
        input.schemaVersion!=='xiaozhi.materials.v1'||input.offset!==0)throw Error('QA_READ_BINDING');
      handlers.set(channel,original);
      const value=await original(event,input);state.beforeHash=hash(value);state.captured=true;
      await new Promise(resolve=>{state.release=()=>{state.released=true;resolve();};});
      state.afterHash=hash(value);if(state.afterHash!==state.beforeHash)throw Error('QA_READ_MUTATED');
      state.delivered=true;return value;
    };
    handlers.set(channel,wrapped);state.restore=()=>{
      if(handlers.get(channel)===wrapped)handlers.set(channel,original);state.release?.();
    };
  },pdf.id);
  await select(pdf);await wait(()=>app.evaluate(()=>globalThis.__qaA13Late.captured));
  await select(txt);await click(tid('materials-section-content'));
  await wait(async()=>(await tid('materials-detail').innerText()).includes(txt.marker));
  await app.evaluate(()=>globalThis.__qaA13Late.release());
  await wait(()=>app.evaluate(()=>globalThis.__qaA13Late.delivered));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await tid('materials-detail').getAttribute('data-resource-id'),txt.id);
  const content=await tid('materials-detail').innerText();assert(content.includes(txt.marker));assert(!content.includes(pdf.marker));
  report.lateBody=await app.evaluate(()=>{const s=globalThis.__qaA13Late;
    return {captured:s.captured,released:s.released,delivered:s.delivered,beforeHash:s.beforeHash,afterHash:s.afterHash};});
  assert.equal(report.lateBody.beforeHash,report.lateBody.afterHash);
  await page.screenshot({path:path.join(output,'late-original-body-still-selected-control.png')});
}
function terminateOwned(){
  if(killRequested||!child||child.exitCode!==null||child.signalCode!==null)return;
  const pid=child.pid;assert(Number.isInteger(pid)&&pid>0&&pid!==process.pid);killRequested=true;
  report.ownedTermination={pid};const killer=spawn('taskkill.exe',['/PID',String(pid),'/T','/F'],
    {windowsHide:true,stdio:'ignore'});killer.on('error',e=>report.errors.push(diagnostic(e)));killer.unref();
}
function observeBootstrapWindow(value){
  page=value;page.setDefaultTimeout(8000);
  page.on('pageerror',e=>report.errors.push({code:'PAGE_ERROR',phase:report.phase,hash:sha256(String(e))}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({code:'CONSOLE_ERROR',phase:report.phase,hash:sha256(m.text())});});
  page.on('dialog',dialog=>{report.errors.push({code:'UNEXPECTED_JS_DIALOG',phase:report.phase,hash:sha256(dialog.message())});void dialog.dismiss();});
}
async function launch(){
  verify();assert(!report.launch);phase('LAUNCH');const bootstrap=path.join(output,'owned-bootstrap.cjs');
  const stateFile=path.join(output,'bootstrap-state.json');
  fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:stateFile}),{flag:'wx'});
  const env={...process.env};for(const name of Object.keys(env)){
    if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name))delete env[name];
  }
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  report.launch={stateFile};persist();
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],
    cwd:output,env,timeout:remaining(45000)});child=app.process();report.launch.pid=child.pid;
  for(const stream of [child.stdout,child.stderr])stream?.on('data',bytes=>{
    if(/uncaught|unhandledrejection|unhandled rejection/i.test(String(bytes)))report.errors.push({
      code:'MAIN_RUNTIME_FATAL',phase:report.phase,hash:sha256(bytes)});
  });
  phase('BOOTSTRAP');await waitContinuationBootstrap(app,{timeout:remaining(20000),
    observeWindow:true,onWindow:observeBootstrapWindow,
    readState:()=>readContinuationBootstrapFile(stateFile,child),onObservation:state=>{report.launch.bootstrap=state;}});
  report.launch.identity=await assertIsolatedPiMain(app,main,profile);
  assert.equal(await app.evaluate(({session})=>session.defaultSession.storagePath),profile);
  assert(page&&!page.isClosed(),'Owned bootstrap window observed');
  const state=await app.evaluate(continuationGuardRead,true);assert.equal(state.policyProbe,'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  await tid('xiaozhi-pi-workspace').waitFor({timeout:remaining(20000)});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  const window=await app.browserWindow(page);await window.evaluate(w=>w.setContentSize(1366,900));
  await click(page.locator('[data-testid="edu-navigation"]:visible [data-testid="nav-knowledge"]:visible'));
  await tid('materials-workspace').waitFor({timeout:remaining()});baseline=ledger();auditLedger();
  assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,0);
}

persist();
try{
  deadlineAt=Date.now()+180000;hardTimer=setTimeout(()=>{timedOut=true;report.success=false;
    report.failure??=diagnostic(Error('GLOBAL_DEADLINE'));persist();terminateOwned();},180000);
  phase('FIXTURES');makeFixtures();await launch();
  await step('TXT_REAL_PARSER_COMPLETED_CONTROL',async()=>{
    await importOriginal(txt);await wait(()=>task(txt.id)?.status==='succeeded'&&chunks(txt.id).length>0,20000);
    await wait(()=>page.evaluate(async()=>{const s=await window.omniEdu.getMaterialIndexStatus();return s.available&&s.pending===0;}));
    assert(chunks(txt.id).some(c=>c.content_md.includes(txt.marker)));
    controlBaseline={row:resource(txt),chunks:chunks(txt.id)};originals();
  });
  await step('PDF_NATIVE_PAGE_ACK_AND_UI_STOP',async()=>{
    await installParserSeam();await importOriginal(pdf);
    await click(tid('materials-section-advanced'));await unique(tid('material-pdf-action'));
    await wait(async()=>{const s=await parserState();return s.attempts.length===1&&s.held;});
    generation=read('SELECT generation FROM material_pdf_jobs WHERE resource_id=?',[pdf.id])[0].generation;
    assert.equal(pages().length,0);
    await app.evaluate(()=>globalThis.__qaA13Parser.release());
    await wait(()=>pages().some(p=>p.page===1&&p.status==='complete')&&
      pages().some(p=>p.page===2&&p.status==='processing')&&task(pdf.id)?.status==='running',60000);
    pageBaseline=pages().find(p=>p.page===1);assert.equal(pageBaseline.attempts,1);
    assert(JSON.parse(pageBaseline.result_json).nativeText.includes(pdf.marker));
    pageChunkBaseline=read('SELECT * FROM material_pdf_chunks WHERE generation=? AND page=1 ORDER BY local_index',[generation]);
    assert(pageChunkBaseline.length>0);
    assert.match(await tid('material-pdf-action').innerText(),/停止页处理/);
    await click(tid('material-pdf-action'));
    await wait(async()=>task(pdf.id)?.status==='cancelled'&&(await parserState()).attempts[0].closed);
    await wait(()=>read('SELECT owner_pid FROM material_pdf_jobs WHERE resource_id=?',[pdf.id])[0].owner_pid===0);
    await queueStatus('cancelled');assert.match(await tid('materials-task').innerText(),/已停止/);
    await page.screenshot({path:path.join(output,'actual-page-one-retained-after-ui-stop.png')});
  });
  await step('STOP_PRESERVES_SUCCESS_PAGE_AND_OLDER_BODY',async()=>{
    retained();assert.equal(chunks(pdf.id).length,0);assert.equal(pages().filter(p=>p.status==='complete').length,1);
    await wait(async()=>/继续未完成页/.test(await tid('material-pdf-action').innerText()));
    assert.match(await tid('material-pdf-counts').innerText(),/已处理 1 页/);
  });
  await step('UI_CONTINUE_PRE_WORKER_FAILURE',async()=>{
    await click(tid('material-pdf-action'));
    await wait(async()=>task(pdf.id)?.status==='failed'&&(await parserState()).attempts[1]?.closed);
    const state=await parserState();assert.equal(state.attempts.length,2);
    assert.deepEqual(state.attempts[1].skipPages,[1]);assert.equal(state.attempts[1].forwarded,false);
    await queueStatus('failed');assert.match(await tid('materials-task').innerText(),/收录未完成/);
    await page.screenshot({path:path.join(output,'actual-pre-worker-failure.png')});
  });
  await step('FAILURE_PRESERVES_PAGE_SOURCE_AND_CONTROL',async()=>{
    retained();assert.equal(chunks(pdf.id).length,0);assert.equal(pages().filter(p=>p.status==='complete').length,1);
    await wait(()=>read('SELECT owner_pid FROM material_pdf_jobs WHERE resource_id=?',[pdf.id])[0].owner_pid===0);
    await wait(async()=>/继续未完成页/.test(await tid('material-pdf-action').innerText()));
  });
  await step('UI_RETRY_REAL_THREE_PAGE_COMPLETION',async()=>{
    await click(tid('material-pdf-action'));await wait(()=>task(pdf.id)?.status==='succeeded',65000);
    const job=read('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[pdf.id])[0];
    assert.equal(job.generation,generation);assert.equal(job.state,'complete');assert.equal(job.total,3);
    assert.deepEqual(pages().map(p=>[p.page,p.status]),[[1,'complete'],[2,'complete'],[3,'complete']]);
    assert.deepEqual([...new Set(chunks(pdf.id).map(c=>c.page_number))],[1,2,3]);
    assert.equal(resource(pdf).parse_engine,'pdfium-5.14.0-rapidocr-3.9.2-file.v3');
    retained();await wait(async()=>/已处理 3 页/.test(await tid('material-pdf-counts').innerText()));
    await queueStatus('succeeded');assert.match(await tid('materials-task').innerText(),/正文已收录/);
  });
  await step('SUCCESS_PAGE_SKIP_AND_EXACT_RETENTION',async()=>{
    const state=await parserState();assert.equal(state.attempts.length,3);
    assert.deepEqual(state.attempts.map(a=>a.skipPages),[[],[1],[1]]);
    assert.deepEqual(state.attempts[0].acked,[1]);assert.deepEqual(state.attempts[2].acked,[2,3]);
    assert(state.attempts[2].forwarded);await wait(async()=>(await parserState()).attempts.every(a=>a.closed));
    retained();assert.equal(pages().find(p=>p.page===1).attempts,1);
    report.parser=await parserState();report.pages=pages();report.pageOne=pageBaseline;
    await click(tid('materials-section-content'));await wait(()=>tid('materials-body-location').isVisible());
    assert((await tid('materials-detail').innerText()).includes(pdf.marker));
    await page.screenshot({path:path.join(output,'actual-three-pages-complete.png')});
  });
  await step('LATE_ORIGINAL_BODY_RESPONSE_SELECTION_GUARD',lateBody);
  await step('FINAL_ZERO_HTTP_MODEL_AND_INTEGRITY',async()=>{
    retained();verify();assert.equal(await app.evaluate(()=>globalThis.__qaA13Choosers),2);
    assert.equal(read('SELECT COUNT(*) n FROM teacher_resources')[0].n,2);
    report.finalPages=pages();assert.deepEqual(report.finalPages,report.pages);
    assert.deepEqual((await parserState()).attempts,report.parser.attempts);
  });report.success=true;
}catch(error){report.failure=diagnostic(error);report.success=false;
  if(page&&!page.isClosed()){
    await page.screenshot({path:path.join(output,'failure.png'),timeout:3000}).catch(()=>{});
    await page.locator('[data-testid="materials-detail"], [data-testid="material-pdf-counts"], [data-testid="material-pdf-action"]')
      .evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {
        testId:el.getAttribute('data-testid'),resourceId:el.getAttribute('data-resource-id'),
        x:r.x,y:r.y,width:r.width,height:r.height,hidden:el.hidden};}))
      .then(value=>fs.writeFileSync(path.join(output,'failure-dom.json'),JSON.stringify(value,null,2))).catch(()=>{});
  }
}finally{
  if(app){
    await app.evaluate(()=>{globalThis.__qaA13Late?.restore?.();globalThis.__qaA13Parser?.restore?.();})
      .catch(error=>{report.restoreFailure=diagnostic(error);report.success=false;});
    report.cleanup=await closeContinuationRuntime({observeGuard:async()=>{
      const state=await app.evaluate(continuationGuardRead);report.finalGuard=state;
      assert.equal(state.networkAttempts,0);assert.equal(state.modelAttempts,0);assert.equal(state.rendererErrors,0);return state;
    },close:()=>app.close(),forceClose:terminateOwned,deadlineAt,cap:4000});
    if(!report.cleanup.closed||report.cleanup.guardError||report.cleanup.closeError)report.success=false;
  }
  clearTimeout(hardTimer);
  try{verify();if(baseline)auditLedger();if(txt.id)originals();
    assert(!timedOut);assert.deepEqual(report.errors,[]);assert(report.cleanup?.closed&&!report.cleanup.guardError);
    report.integrityVerified=true;
  }catch(error){report.integrityFailure=diagnostic(error);report.success=false;}
  report.status=report.success?'PASS':'FAIL';report.modelCalls=report.finalGuard?.modelAttempts===0?0:null;
  report.elapsedMs=Date.now()-(deadlineAt-180000);persist();
  console.log(JSON.stringify({code:'A13_LOCAL_PARSE_'+report.status,output,modelCalls:report.modelCalls,
    counts:report.checks.reduce((r,c)=>(r[c.status]=(r[c.status]||0)+1,r),{}),integrityVerified:report.integrityVerified===true}));
  if(!report.success)process.exitCode=1;
}
