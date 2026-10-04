import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-office-documents-ui-'));
const workspace=path.join(output,'教研目录'),data=path.join(output,'data'),marker=`OFFICE-${randomUUID()}`;
const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const generator=spawnSync(python,[path.join(desktop,'scripts/xiaozhi-agent/make-office-fixtures.py'),workspace,marker],{encoding:'utf8'});
assert.equal(generator.status,0,generator.stderr);
const facts=JSON.parse(fs.readFileSync(path.join(workspace,'fixture-facts.json'),'utf8'));
fs.copyFileSync(path.join(workspace,'备课.docx'),path.join(output,'original.docx'));
fs.closeSync(fs.openSync(path.join(workspace,'超大.docx'),'w'));fs.truncateSync(path.join(workspace,'超大.docx'),50*1024*1024+1);
const report={success:false,checks:[],boundaries:['Actual Electron utilityProcess/native AnyDoc 0.1.2/typed preview/UI with generated real Office/PDF files','No provider or export functionality claim; main fetch disabled during previews, no OS VPN setting changed','Controlled native chooser result; Office/WPS opening and packaged dependency gate remain pending']};
let app,page,session;const errors=[],remote=[];
const check=(name,fn=()=>{})=>{fn();report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,60));}throw new Error('Office preview condition timed out');}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'electron-profile')}`],env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(/example\.invalid/.test(request.url()))remote.push(request.url());});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
async function open(name){await page.getByTestId(`pi-file-entry-${name}`).click();await until(async()=>await page.getByTestId('pi-file-preview').getAttribute('aria-busy')==='false');}
const content=()=>page.getByTestId('pi-file-preview').innerText();
try{
  await launch();await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-error').waitFor();
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
  await page.getByTestId('pi-files-choose').click();await page.getByTestId('pi-file-entry-备课.docx').waitFor();
  check('Teacher grants actual local directory through formal UI; credential file remains excluded',()=>assert.equal(fs.readFileSync(path.join(workspace,'.env.local'),'utf8'),'SYNTHETIC_SECRET'));
  assert.equal(await page.getByTestId('pi-file-entry-.env.local').count(),0);
  await app.evaluate(({utilityProcess})=>{
    globalThis.documentProcesses={starts:0,exits:0};const nativeFork=utilityProcess.fork.bind(utilityProcess);
    utilityProcess.fork=(...args)=>{const child=nativeFork(...args);if(String(args[0]).endsWith('document-worker.js')){globalThis.documentProcesses.starts++;child.on('exit',()=>globalThis.documentProcesses.exits++);if(globalThis.holdDocumentDispatch)child.postMessage=()=>{};}return child;};
    globalThis.fetch=()=>Promise.reject(new Error('LOCAL_PREVIEW_NETWORK_BLOCKED'));
  });
  await page.route(/^https?:\/\//,route=>route.abort());
  for(const [name,format]of [['备课.docx','DOCX'],['教研.xlsx','XLSX'],['课件.pptx','PPTX'],['讲义.pdf','PDF']]){
    await open(name);assert((await content()).includes(marker),await content());
    assert((await page.getByTestId('pi-file-document-info').innerText()).includes(format));
    if(format==='DOCX')assert((await content()).includes('分数')&&(await content()).includes('37')&&(await content()).includes('8'));
    if(format==='XLSX')assert((await content()).includes('37')&&(await content()).includes('8'));
    if(format==='PPTX')assert((await content()).includes('第二课时')&&(await content()).includes('37'));
    if(format==='PDF')assert((await content()).includes('分数课堂讲义')&&(await content()).includes('Second page'));
    check(`${format} actual native bytes parse and appear in current local-only file panel`);
  }
  check('Office source table/text facts are preserved; no remote document image or script is rendered',()=>{assert.deepEqual(remote,[]);});
  await open('扫描.pdf');assert((await content()).includes('本地 OCR'),await content());check('Real image-only PDF returns explicit local OCR requirement');
  await open('缺文字映射.pdf');assert((await content()).includes('无法正确解码'),await content());check('Real unmapped Chinese PDF fails explicitly instead of treating replacement characters as reliable body');
  await open('超大.docx');assert((await content()).includes('超过本地预览大小限制'));check('Real 50MiB-plus file is rejected before native extraction');
  await open('损坏.docx');assert(/无法解析|不支持/.test(await content()),await content());check('Malformed real bytes fail safely without exposing native error detail');
  await open('备注.txt');assert((await content()).includes(marker));check('Existing actual UTF8 preview remains compatible');
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});await open('备课.docx');
    const panel=await page.getByTestId('pi-file-panel').boundingBox(),input=await page.getByTestId('office-prompt-input').boundingBox();
    assert(panel.width>=359&&panel.x+panel.width<=width+1);assert(input.y+input.height<=height);
    await page.screenshot({path:path.join(output,`office-${width}x${height}.png`)});check(`Real Office preview and chat input are reachable at ${width}x${height}`);
  }
  const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
  const list=await page.evaluate(async id=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${crypto.randomUUID()}`,path:'.'}),session);
  assert(list.ok);const file=list.data.entries.find(x=>x.name==='备课.docx');
  const request={schemaVersion:'xiaozhi.files.v1',sessionId:session,requestId:`xifile_${randomUUID()}`,path:file.path,version:file.version,workspaceVersion:list.workspaceVersion};
  const result=await page.evaluate(async input=>{
    const pending=window.omniEdu.previewXiaozhiFile(input);
    await window.omniEdu.cancelXiaozhiFile({sessionId:input.sessionId,requestId:input.requestId});return pending;
  },request);
  assert(!result.ok&&result.error==='cancelled',JSON.stringify(result));check('Typed cancellation returns a real terminal cancelled receipt with no late preview');
  fs.appendFileSync(path.join(workspace,'备课.docx'),Buffer.from('external-change'));
  const stale=await page.evaluate(input=>window.omniEdu.previewXiaozhiFile({...input,requestId:`xifile_${crypto.randomUUID()}`}),request);
  assert(!stale.ok&&stale.error==='changed');check('Version changed on disk cannot be parsed as the expected source');
  fs.writeFileSync(path.join(workspace,'备课.docx'),fs.readFileSync(path.join(output,'original.docx')));
  check('No preview input is sent as an agent task or public message',()=>assert.equal(snapshot.projection.turns.length,0));
  await until(async()=>{const counts=await app.evaluate(()=>globalThis.documentProcesses);return counts.starts>0&&counts.starts===counts.exits;});
  report.processes=await app.evaluate(()=>globalThis.documentProcesses);check('Actual native utility children terminate after every extraction; none remain active');
  const currentList=await page.evaluate(async id=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${crypto.randomUUID()}`,path:'.'}),session);
  assert(currentList.ok);const latest=currentList.data.entries.find(x=>x.name==='备课.docx');
  const heldRequest={...request,version:latest.version,workspaceVersion:currentList.workspaceVersion,requestId:`xifile_${randomUUID()}`};
  const starts=await app.evaluate(()=>{globalThis.holdDocumentDispatch=true;return globalThis.documentProcesses.starts;});
  await page.evaluate(input=>{globalThis.heldPreview=window.omniEdu.previewXiaozhiFile(input);},heldRequest);
  await until(async()=>(await app.evaluate(()=>globalThis.documentProcesses.starts))>starts);
  await page.evaluate(input=>window.omniEdu.cancelXiaozhiFile({sessionId:input.sessionId,requestId:input.requestId}),heldRequest);
  const heldResult=await page.evaluate(()=>globalThis.heldPreview);assert(!heldResult.ok&&heldResult.error==='cancelled');
  await until(async()=>{const c=await app.evaluate(()=>globalThis.documentProcesses);return c.starts===c.exits;});
  check('Cancellation terminates an actually spawned isolated utility child (dispatch deliberately held by test)');
  await page.getByTestId('pi-files-refresh').click();await page.getByTestId('pi-file-entry-备课.docx').waitFor();
  await open('备课.docx');assert((await content()).includes('读取超时'),await content());
  await until(async()=>{const c=await app.evaluate(()=>globalThis.documentProcesses);return c.starts===c.exits;});
  await app.evaluate(()=>{globalThis.holdDocumentDispatch=false;});
  check('Real 15-second host deadline kills held utility and UI reports timeout; no native stall claim');
  await open('教研.xlsx');assert((await content()).includes(marker));check('After timeout, ordinary extraction succeeds without stale worker receipt');
  for(const [name,expected]of Object.entries(facts.hashes))assert.equal(hash(fs.readFileSync(path.join(workspace,name))),expected);
  check('All actual input document bytes remain unchanged by preview');
  assert.deepEqual(errors,[]);check('Actual renderer has no page errors');
  await app.close();app=undefined;await launch();if(!await page.getByTestId('pi-file-panel').isVisible())await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-entry-课件.pptx').waitFor();await open('课件.pptx');assert((await content()).includes(marker));
  check('Normal app restart preserves teacher grant and extracts the actual file again');
  report.success=true;
}catch(error){report.error=String(error?.stack||error);console.error(report.error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`REPORT ${output}`);}
