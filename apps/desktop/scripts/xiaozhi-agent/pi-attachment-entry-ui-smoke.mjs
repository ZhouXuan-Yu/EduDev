import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
const desktop=process.cwd(),output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-attachment-entry-ui-'));
const sources=path.join(output,'selected-files'),data=path.join(output,'data'),profile=path.join(output,'profile'),marker=`ATTACH-${randomUUID()}`;
fs.mkdirSync(sources);
const python='C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const office=spawnSync(python,['scripts/xiaozhi-agent/make-office-fixtures.py',sources,marker],{encoding:'utf8',windowsHide:true});assert.equal(office.status,0,office.stderr);
const images=spawnSync(python,['-c',"from PIL import Image; import sys,os; p=sys.argv[1]; im=Image.new('RGB',(600,300),'#315efb'); [(im.save(os.path.join(p,'合成.'+ext),fmt)) for ext,fmt in [('png','PNG'),('jpg','JPEG'),('gif','GIF'),('webp','WEBP')]]",sources],{encoding:'utf8',windowsHide:true});assert.equal(images.status,0,images.stderr);
fs.writeFileSync(path.join(sources,'正文.txt'),marker);fs.writeFileSync(path.join(sources,'禁止.exe'),'UNSUPPORTED');
fs.writeFileSync(path.join(sources,'伪造.png'),fs.readFileSync(path.join(sources,'合成.png')).subarray(0,33));
for(let i=0;i<9;i++)fs.writeFileSync(path.join(sources,`补充${i}.txt`),`${marker}-${i}`);
const originals=Object.fromEntries(['合成.png','合成.jpg','合成.gif','合成.webp','备课.docx','正文.txt'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(sources,name))).digest('hex')]));
const report={success:false,checks:[],boundaries:['Formal UI/main-frame typed IPC/native SQLite/real Pi Photon utility; native dialog result controlled in owned main process','No key/provider/teacher upload/model-view receipt or attachment send claim','D2-C durable message/run binding and D3/D4 remain pending']};
let app,page,id;const errors=[];
const check=(name)=>{report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,75));}throw new Error('Attachment UI condition timed out');}
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.DEEPSEEK_API_KEY;
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${profile}`],env,timeout:60000});
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 id=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await app.evaluate(({utilityProcess})=>{globalThis.imageProcesses={starts:0,exits:0};const fork=utilityProcess.fork.bind(utilityProcess);
  utilityProcess.fork=(...args)=>{const child=fork(...args);if(String(args[0]).endsWith('image-worker.js')){globalThis.imageProcesses.starts++;child.once('exit',()=>globalThis.imageProcesses.exits++);if(globalThis.holdImageDispatch)child.postMessage=()=>{};}return child;};
  globalThis.fetch=()=>Promise.reject(new Error('LOCAL_ATTACHMENT_NETWORK_BLOCKED'));});
 await page.route(/^https?:\/\//,route=>route.abort());
}
const request=(selected)=>({schemaVersion:'xiaozhi.attachments.v1',sessionId:id,requestId:`xiattach_${randomUUID()}`,...(selected?{selection:{id:selected.id,revision:selected.revision}}:{})});
async function list(){const result=await page.evaluate(input=>window.omniEdu.listXiaozhiAttachments(input),request());assert(result.ok,JSON.stringify(result));return result.data;}
async function pick(names){await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},names.map(name=>path.join(sources,name)));
 await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!(await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled()));}
async function open(name){await page.getByRole('button',{name:`预览附件 ${name}`,exact:true}).click();await until(async()=>await page.getByTestId('pi-attachment-preview').locator('[aria-busy]').getAttribute('aria-busy')==='false');}
const close=()=>page.getByTestId('pi-attachment-preview-close').click();
try{
 await launch();await pick(['正文.txt','合成.png','合成.jpg','合成.gif','合成.webp']);
 assert.equal((await list()).length,5);await until(async()=>await page.locator('.pi-attachment-open img').count()===4);
 const dimensions=await page.locator('.pi-attachment-open img').evaluateAll(images=>images.map(image=>({loaded:image.complete&&image.naturalWidth>0,w:image.naturalWidth,h:image.naturalHeight})));
 assert(dimensions.every(v=>v.loaded&&v.w<=192&&v.h<=192));check('Native selected files register in actual ledger and all four formats display real decoded bounded thumbnails');
 const initial=await list();assert(!JSON.stringify(initial).includes(sources)&&!JSON.stringify(initial).includes('data:image')&&!JSON.stringify(initial).includes('relative_path'));check('Public metadata excludes private paths, image bytes and thumbnail data');
 await pick(['正文.txt']);assert.equal((await list()).length,5);assert.equal((await list()).find(x=>x.name==='正文.txt').id,initial.find(x=>x.name==='正文.txt').id);check('Selecting the same unchanged file retains its actual draft identity');
 await pick(['备课.docx','禁止.exe','伪造.png']);assert.equal((await list()).length,6);assert((await page.getByTestId('pi-attachment-error').innerText()).includes('禁止.exe'));assert((await page.getByTestId('pi-attachment-error').innerText()).includes('伪造.png'));check('Partial selection preserves the real Office success and rejects unsupported or signature-only corrupt image bytes');
 await open('正文.txt');assert((await page.getByTestId('pi-attachment-preview').innerText()).includes(marker));await close();
 await open('备课.docx');assert((await page.getByTestId('pi-attachment-preview').innerText()).includes(marker));await close();check('Actual text and Office bytes appear in local-only original HeroUI preview');
 await open('合成.webp');assert(await page.getByTestId('pi-attachment-image').evaluate(image=>image.complete&&image.naturalWidth===600));await close();check('Image preview reads the authorized managed copy and validates actual Pi decoding');
 await page.getByTestId('office-prompt-input').fill('保留的正文');assert(await page.getByRole('button',{name:'发送消息',exact:true}).isDisabled());assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'保留的正文');check('Before D2-C, pending attachments never silently vanish into a text-only send; draft text is retained');
 const blockedStart=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{sessionId:id,commandId:`xicmd_${randomUUID()}`,prompt:'SYNTHETIC TEXT WITH PENDING LOCAL FILES'});assert(!blockedStart.ok&&blockedStart.error==='busy');check('Host also refuses text-only start with pending drafts before D2-C; renderer cannot bypass the pending-file rule');
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  const attach=await page.getByRole('button',{name:'添加本地附件',exact:true}).boundingBox();assert(attach.y+attach.height<=height&&attach.x>=0);
  await open('合成.png');const closeBox=await page.getByTestId('pi-attachment-preview-close').boundingBox();assert(closeBox.y+closeBox.height<=height);
  await page.screenshot({path:path.join(output,`preview-${width}x${height}.png`)});await close();
  await page.screenshot({path:path.join(output,`cards-${width}x${height}.png`)});check(`Attachment cards and original preview close are reachable at native ${width}x${height}`);
 }
 const stale=initial.find(x=>x.name==='正文.txt');await page.getByRole('button',{name:'移除附件 正文.txt',exact:true}).click();await until(async()=>(await list()).length===5);
 const old=await page.evaluate(input=>window.omniEdu.previewXiaozhiAttachment(input),request(stale));assert(!old.ok&&old.error==='changed');check('Formal remove advances ledger revision; old preview selection is rejected');
 await pick(['补充0.txt','补充1.txt','补充2.txt','补充3.txt']);assert.equal((await list()).length,8);assert((await page.getByTestId('pi-attachment-error').innerText()).includes('8个'));check('Eight-draft maximum is enforced in SQLite and shown for partial native selection');
 const saved=await list();await page.getByTestId('ai-conversation-new').click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')!==id);
 const previous=id;id=await page.locator('.office-composer-container').getAttribute('data-session-id');assert.equal((await list()).length,0);check('New session clears local cards without removing the previous session ledger');
 const foreign=await page.evaluate(input=>window.omniEdu.previewXiaozhiAttachment(input),request(saved[0]));assert(!foreign.ok);check('A selection from another session cannot read a private attachment copy');
 await app.evaluate(({dialog},files)=>{globalThis.resolveAttachmentPicker=undefined;dialog.showOpenDialog=()=>new Promise(resolve=>globalThis.resolveAttachmentPicker=()=>resolve({canceled:false,filePaths:files}));},[path.join(sources,'正文.txt')]);
 await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await page.getByText('正在添加或更新附件…',{exact:false}).waitFor();
 await page.getByTestId('pi-attachments').getByRole('button',{name:'取消',exact:true}).click();await app.evaluate(()=>globalThis.resolveAttachmentPicker());
 await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());assert.equal((await list()).length,0);check('Cancelled native chooser has no late registration when its selected paths arrive');
 await pick(['合成.png']);const one=(await list())[0];const snap=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);assert.equal(snap.projection.turns.length,0);assert.equal(snap.workspace,undefined);check('Attachment grant does not change the teaching workspace or send a provider task');
 const bad=await page.evaluate(input=>window.omniEdu.listXiaozhiAttachments({...input,path:'C:/private'}),request());assert(!bad.ok&&bad.error==='invalid_input');check('Strict typed boundary rejects renderer-supplied paths');
 const denied=await app.evaluate(async({BrowserWindow},input)=>{const other=new BrowserWindow({show:false,webPreferences:{preload:undefined,nodeIntegration:true,contextIsolation:false}});try{await other.loadURL('about:blank');return await other.webContents.executeJavaScript(`require('electron').ipcRenderer.invoke('xiaozhi:attachment-list',${JSON.stringify(input)})`);}finally{other.destroy();}},request());assert(!denied.ok&&denied.error==='permission_denied');check('Secondary renderer cannot invoke attachment access');
 await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.srcdoc='<p>synthetic child</p>';iframe.id='attachment-test-frame';document.body.append(iframe);});
 await until(async()=>(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.mainFrame.frames.length))>0);
 const subframe=await app.evaluate(async({BrowserWindow},input)=>{const frame=BrowserWindow.getAllWindows()[0].webContents.mainFrame.frames[0];return frame.executeJavaScript(`window.omniEdu?window.omniEdu.listXiaozhiAttachments(${JSON.stringify(input)}):({ok:false,error:'no_preload'})`);},request());assert(!subframe.ok);await page.evaluate(()=>document.getElementById('attachment-test-frame')?.remove());check('Child frame has no usable main-frame attachment authority');
 await app.evaluate(()=>{globalThis.holdImageDispatch=true;});
 const startCount=await app.evaluate(()=>globalThis.imageProcesses.starts);
 const held=request(one);await page.evaluate(input=>{globalThis.heldAttachmentPreview=window.omniEdu.previewXiaozhiAttachment(input);},held);
 await until(async()=>(await app.evaluate(()=>globalThis.imageProcesses.starts))>startCount);
 const cancelInput={schemaVersion:held.schemaVersion,sessionId:held.sessionId,requestId:held.requestId};
 const badCancel=await page.evaluate(input=>window.omniEdu.cancelXiaozhiAttachment(input),held);assert(!badCancel.ok);
 await page.evaluate(input=>window.omniEdu.cancelXiaozhiAttachment(input),cancelInput);
 const stopped=await page.evaluate(()=>globalThis.heldAttachmentPreview);assert(!stopped.ok&&stopped.error==='cancelled');
 await until(async()=>{const v=await app.evaluate(()=>globalThis.imageProcesses);return v.starts===v.exits;});check('Cancelling preview kills an actually spawned image utility child with dispatch held by the test');
 const beforeClose=await app.evaluate(()=>globalThis.imageProcesses.starts);
 await page.getByRole('button',{name:'预览附件 合成.png',exact:true}).click();
 await until(async()=>(await app.evaluate(()=>globalThis.imageProcesses.starts))>beforeClose);
 await close();await until(async()=>{const v=await app.evaluate(()=>globalThis.imageProcesses);return v.starts===v.exits;},8000);
 check('Formal preview-close button sends only the strict cancellation envelope and terminates its actual held image utility promptly');
 const timeout=await page.evaluate(input=>window.omniEdu.previewXiaozhiAttachment(input),request(one));assert(!timeout.ok&&timeout.error==='timeout');
 await until(async()=>{const v=await app.evaluate(()=>globalThis.imageProcesses);return v.starts===v.exits;});await app.evaluate(()=>{globalThis.holdImageDispatch=false;});
 const resumed=await page.evaluate(input=>window.omniEdu.previewXiaozhiAttachment(input),request(one));assert(resumed.ok);check('Actual 15-second image deadline terminates its held child; ordinary preview succeeds afterwards');
 await until(async()=>{const v=await app.evaluate(()=>globalThis.imageProcesses);return v.starts===v.exits;});report.imageProcesses=await app.evaluate(()=>globalThis.imageProcesses);
 await app.close();app=undefined;await launch();id=await page.locator('.office-composer-container').getAttribute('data-session-id');await until(async()=>(await list()).some(v=>v.id===one.id));await until(async()=>await page.locator('.pi-attachment-open img').count()===1);check('Normal app restart restores persisted local draft identity and actual image thumbnail');
 for(const [name,hash]of Object.entries(originals))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(sources,name))).digest('hex'),hash);
 assert.deepEqual(errors,[]);check('All original selected bytes remain unchanged and renderer has no page errors');
 report.success=true;
}catch(error){report.error=String(error.stack||error);console.error(report.error);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`REPORT ${output}`);}
