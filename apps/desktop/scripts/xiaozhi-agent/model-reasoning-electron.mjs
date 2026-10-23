import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {createStyleAuditor} from './ui-style-evidence.mjs';
import {captureStyleMatrix} from './ui-style-matrix.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
// Resume a successfully captured real streaming baseline without making another provider request.
const resume=process.env.XIAOZHI_REASONING_RESUME?JSON.parse(fs.readFileSync(process.env.XIAOZHI_REASONING_RESUME,'utf8')):undefined;
const output=fs.mkdtempSync(path.join(desktop,'test-results/model-reasoning-'));
const temp=resume?.temp||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-model-reasoning-'));
const dataRoot=path.join(temp,'data'),profile=path.join(temp,'profile'),exports=path.join(temp,'exports');
for(const dir of [dataRoot,profile,exports])fs.mkdirSync(dir,{recursive:true});
const env={...process.env,OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),NODE_ENV:'development'};
for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'])delete env[key];
const config=fs.readFileSync(process.env.XIAOZHI_AUDIT_ENV||path.join(desktop,'.env.local'),'utf8');
for(const name of ['DEEPSEEK_API_KEY','DEEPSEEK_MODEL'])if(!env[name])env[name]=config.match(new RegExp('^'+name+'\\s*=\\s*(.*?)\\s*$','m'))?.[1]?.replace(/^['"]|['"]$/g,'');
assert(env.DEEPSEEK_API_KEY);
let app,page;const errors=[],checks=[];
const report={suite:'model-reasoning-real-electron',success:false,provider:'real DeepSeek',model:env.DEEPSEEK_MODEL,temp,output,checks,errors};
const check=(name,fn=()=>{})=>{fn();if(!checks.some(c=>c.name===name))checks.push({name,pass:true});console.log('PASS '+name);};
const hash=text=>createHash('sha256').update(text).digest('hex');
async function until(fn,ms=120000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for live reasoning condition');}
async function id(){return page.locator('.office-composer-container').getAttribute('data-session-id');}
async function snap(){return page.evaluate(s=>window.omniEdu.getXiaozhiSnapshot(s),await id());}
async function launch(){
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.getByTestId('office-prompt-input').waitFor();await until(()=>page.getByTestId('office-prompt-input').isEnabled(),30000);
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1366,768);w.show();});
 await page.evaluate(()=>{window.reasoningEvents=[];window.omniEdu.onXiaozhiEvent(e=>window.reasoningEvents.push(e));});
}
async function newChat(){const old=await id();await page.getByTestId('ai-conversation-new').click();await until(async()=>await id()!==old,30000);}
async function send(text){await page.getByTestId('office-prompt-input').fill(text);await page.getByTestId('office-prompt-input').press('Enter');await until(async()=>await page.getByTestId('office-prompt-input').inputValue()==='',30000);}
async function done(){await until(async()=>!(await snap()).running,180000);return (await snap()).projection.turns.at(-1);}
async function shot(name){const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));}
function rows(sql){const db=new DatabaseSync(path.join(dataRoot,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}}
function nativeFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?nativeFiles(path.join(dir,e.name)):e.name.endsWith('.jsonl')?[path.join(dir,e.name)]:[]);}
async function selectSession(sessionId){if(await id()!==sessionId){await page.getByTestId('ai-conversation-session-'+sessionId).click();await until(async()=>await id()===sessionId,30000);}}
function summary(t){return {id:t.id,status:t.status,blocks:t.modelReasoning?.map(b=>({id:b.id,status:b.status,chars:b.text.length,sha256:hash(b.text),durationMs:b.durationMs,source:b.source})),tools:t.items.filter(i=>i.kind==='tool').map(i=>({id:i.id,label:i.label,status:i.status})),bodyHash:hash(t.items.filter(i=>i.phase==='final_answer').map(i=>i.text).join(''))};}
try{
 await launch();check('formal current-worktree Electron renderer',()=>assert(page.url().includes('/out/renderer/index.html')));
 let ordinary;
 if(resume){
   await selectSession(resume.ordinarySession);
   ordinary=(await snap()).projection.turns.find(t=>t.id===resume.ordinary.id);assert.equal(ordinary?.status,'completed');
   report.streamingBaseline=resume.output;checks.push(...resume.checks.filter(c=>c.name!=='formal current-worktree Electron renderer'));
   for(const name of ['streaming-reasoning','streaming-answer','completed-collapsed']){const file=path.join(resume.output,name+'.png');if(fs.existsSync(file))fs.copyFileSync(file,path.join(output,name+'.png'));}
 }else{
 await send('我是初中数学教师，请直接设计一元一次方程3(2x-1)=15的简短讲解，比较两种解法，指出两种典型错误，并给3道迁移练习和答案。总正文约600字，只依据题目，不需要使用工具。');
 const visual=await page.waitForFunction(()=>{const b=document.querySelector('[data-testid="model-reasoning"][data-status="streaming"]');return b?{chars:b.textContent.length,rootClass:b.closest('[data-testid="agent-trace"]').className}:false;},{},{timeout:120000});
 report.streamObservation=await visual.jsonValue();
 check('actual provider reasoning is visible while streaming');
 check('original Pro shimmer follows actual thinking',()=>assert(report.streamObservation.rootClass.includes('chain-of-thought--streaming')));
 await shot('streaming-reasoning');
 const live=await snap();assert(live.projection.turns.at(-1).items.every(i=>!i.text?.includes(live.projection.turns.at(-1).modelReasoning[0].text)));
 await until(async()=>{const t=(await snap()).projection.turns.at(-1);return t.status==='running'&&t.items.some(i=>i.role==='assistant'&&i.text?.length>30)&&page.getByTestId('agent-reply-body').last().isVisible();});
 check('answer continues streaming independently');await shot('streaming-answer');
 ordinary=await done();assert.equal(ordinary.status,'completed',ordinary.error);
 check('nonempty provider reasoning with separate duration',()=>{assert(ordinary.modelReasoning?.some(b=>b.text.length>30&&b.source==='provider'));assert(ordinary.modelReasoning.every(b=>b.status==='completed'));assert(ordinary.modelReasoning.reduce((n,b)=>n+b.durationMs,0)<ordinary.traceElapsedMs);});
 await until(async()=>await page.getByTestId('agent-trace-toggle').last().getAttribute('aria-expanded')==='false');check('completion automatically folds reasoning');await shot('completed-collapsed');
 }
 report.ordinary=summary(ordinary);report.ordinarySession=await id();
 await page.getByTestId('reply-copy').last().click();const copied=await app.evaluate(({clipboard})=>clipboard.readText());
 const body=ordinary.items.filter(i=>i.phase==='final_answer').at(-1).text;check('clipboard copies only actual answer',()=>assert.equal(copied.replace(/\r\n/g,'\n'),body.replace(/\r\n/g,'\n')));
 await page.getByTestId('reply-save').last().click();await page.getByTestId('reply-save-title').fill('推理与正文隔离验收');
 await app.evaluate(({dialog},dir)=>{globalThis.__reasoningOriginalDialog=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},exports);
 await page.getByTestId('reply-save-confirm').click();await page.getByTestId('reply-dialog').waitFor({state:'hidden'});
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__reasoningOriginalDialog;delete globalThis.__reasoningOriginalDialog;});
 const artifact=rows('SELECT file_path FROM document_artifacts')[0];check('teacher-confirmed Markdown export contains only answer',()=>assert.equal(fs.readFileSync(artifact.file_path,'utf8'),body));
 const auditor=await createStyleAuditor(page,path.join(desktop,'src/renderer'));report.matrices=[];
 for(const size of [{width:1366,height:768},{width:1920,height:1080}])report.matrices.push(await captureStyleMatrix({app,page,auditor,rendererRoot:path.join(desktop,'src/renderer'),output,theme:'light',size}));
 check('official CSS parity and real hover focus active at both light sizes');
 const saved=rows('SELECT metadata_json FROM ai_conversation_messages WHERE role=\'assistant\'').map(r=>JSON.parse(r.metadata_json)).find(m=>m.agentRunId===ordinary.id);
 check('SQLite stores the exact sanitized reasoning projection',()=>assert.deepEqual(saved.modelReasoning.blocks,ordinary.modelReasoning));
 await app.close();await launch();const cold=(await snap()).projection.turns.find(t=>t.id===ordinary.id);check('restart preserves reasoning and timing exactly',()=>assert.deepEqual(cold.modelReasoning,ordinary.modelReasoning));
 let tools;
 if(resume?.tools){const m=rows('SELECT session_id,metadata_json FROM ai_conversation_messages').find(r=>JSON.parse(r.metadata_json).agentRunId===resume.tools.id);await selectSession(m.session_id);tools=(await snap()).projection.turns.find(t=>t.id===resume.tools.id);}
 else{
 await newChat();const fixture=path.join(temp,'教学核对.txt');fs.writeFileSync(fixture,'教研标记：REASONING-731。异分母分数相加先通分，再相加。例：1/2+1/3=5/6。');
 await app.evaluate(({dialog},file)=>{globalThis.__reasoningOriginalDialog=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},fixture);
 await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await page.getByTestId('pi-attachment-count').waitFor();
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__reasoningOriginalDialog;delete globalThis.__reasoningOriginalDialog;});
 await send('请先用附件清单工具列出已发送附件，再用附件读取工具实读这份教学核对资料，告诉我教研标记与算式答案。只依据附件，不查询其他来源。');
 tools=await done();}
 assert.equal(tools.status,'completed',tools.error);report.tools=summary(tools);
 check('real reasoning and tool replay completes without protocol errors',()=>{assert(tools.items.filter(i=>i.kind==='tool'&&i.status==='completed').length>=2);assert(tools.modelReasoning.length>=1);assert(tools.items.filter(i=>i.phase==='final_answer').some(i=>i.text.includes('REASONING-731')));});
 const native=nativeFiles(dataRoot).flatMap(file=>fs.readFileSync(file,'utf8').trim().split('\n').flatMap(line=>{const entry=JSON.parse(line);return entry.message?.role==='assistant'?entry.message.content.filter(b=>b.type==='thinking').map(b=>hash(b.thinking)):[];}));
 const publicHashes=[ordinary,tools].flatMap(t=>t.modelReasoning.map(b=>hash(b.text)));
 check('displayed reasoning matches actual native SDK blocks, without fabricating tool-round thoughts',()=>assert.deepEqual(native.sort(),publicHashes.sort()));report.nativeReasoningBlocks=native.length;
 if(await page.getByTestId('agent-trace-toggle').last().getAttribute('aria-expanded')==='false')await page.getByTestId('agent-trace-toggle').last().click();await shot('tool-reasoning-expanded');
 await newChat();await send('请设计完整的七年级一元一次方程单元教学，包含8课时逐字稿、差异化练习及答案，总正文不少于8000字，不使用工具。');
 await page.locator('[data-testid="model-reasoning"][data-status="streaming"]').waitFor({state:'visible',timeout:120000});
 await page.getByRole('button',{name:'停止本轮',exact:true}).click();const stopped=await done();report.stopped=summary(stopped);
 check('stop during genuine reasoning retains incomplete text',()=>{assert.equal(stopped.status,'interrupted');assert(stopped.modelReasoning.some(b=>b.status==='interrupted'&&b.text.length>0));});await shot('stopped-reasoning');
 await app.close();await launch();const stoppedCold=(await snap()).projection.turns.find(t=>t.id===stopped.id);check('restart preserves stopped reasoning',()=>assert.deepEqual(stoppedCold.modelReasoning,stopped.modelReasoning));
 await newChat();
 await app.evaluate(({net})=>{globalThis.__reasoningFetch=net.fetch;net.fetch=(input,init)=>{if(String(typeof input==='string'?input:input.url).includes('api.deepseek.com')&&String(typeof input==='string'?input:input.url).includes('chat/completions'))return Promise.reject(Error('reasoning-audit-controlled-transport'));return globalThis.__reasoningFetch(input,init);};});
 try{await send('请回答2+2。');const failed=await done();report.failureCase=summary(failed);check('controlled transport failure cannot fabricate reasoning',()=>{assert.equal(failed.status,'failed');assert(!failed.modelReasoning?.length);});await shot('failed-no-reasoning');}
 finally{await app.evaluate(({net})=>{net.fetch=globalThis.__reasoningFetch;delete globalThis.__reasoningFetch;});}
 check('renderer console has no uncaught errors',()=>assert.deepEqual(errors,[]));
 report.success=true;
}catch(e){report.failure=String(e.stack).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,3500);process.exitCode=1;await shot('failure').catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,failure:report.failure,output,temp}));}
