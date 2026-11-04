/** B03 production Pi, original preload, actual QuickJS/SymPy and file review. */
import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';import {_electron} from 'playwright';import ExcelJS from 'exceljs';
import {conversationOutput} from '../../src/main/xiaozhi-agent/conversation-output.ts';
import {parseComputationCsv} from '../../src/main/managed-tools/typed-table.ts';
import {JAVASCRIPT_COMPONENT as current,JAVASCRIPT_PREVIOUS as previous} from '../../src/main/managed-tools/manifest.ts';
const fixture=process.argv[2];assert(fixture,'Pass the successful foundation-tools-smoke report path');const sourceFixture=JSON.parse(fs.readFileSync(fixture));assert(sourceFixture.ok);
const resume=process.env.FOUNDATION_B03_RESUME_SAVED;
const desktop=path.resolve(import.meta.dirname,'../..'),root=resume?fs.realpathSync(resume):fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-foundation-b03-pi-')),data=path.join(root,'data'),profile=path.join(root,'profile');if(!resume){fs.mkdirSync(data);fs.mkdirSync(profile);}
const sha=b=>createHash('sha256').update(b).digest('hex'),checks=[];
const report={ok:false,root,checks,source:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),mainSha256:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),scriptSha256:sha(fs.readFileSync(import.meta.filename)),paidRequests:0,errors:[],boundary:'Actual production Pi/typed preload/native/SQLite/QuickJS/SymPy/file review and real CSV/XLSX. Local SSE and local HTTP packages only; no natural pedagogy/provider-quality or new UI acceptance.'};
const packages=new Map();for(const r of [previous,current]){const bytes=fs.readFileSync(path.join(sourceFixture.root,r.version+'.tgz'));assert.equal(sha(bytes),r.archiveSha256);packages.set(r.version,bytes);}
let app,page,server;const downloads=[];
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const check=(id,detail)=>{checks.push({id,detail});console.log('PASS '+detail);};
async function until(fn,ms=60000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('Owned B03 production observation deadline');}
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const settings=()=>page.evaluate(()=>window.omniEdu.listManagedTools());
const configure=(mode,extra={})=>app.evaluate((_,value)=>Object.assign(globalThis.b03,{...value,stage:0,lastReceipt:null,waiting:false}),{mode,...extra});
const state=()=>app.evaluate(()=>({calls:b03.calls,receipts:b03.receipts,computation:b03.computation,equation:b03.equation,readiness:b03.readiness,blocked:b03.blocked}));
const receiptAt=(wire,mode,stage)=>wire.receipts.findLast(r=>r.mode===mode&&r.stage===stage)?.receipt;
async function session(title){const v=await page.evaluate(title=>window.omniEdu.createAiConversationSession({title}),title);const id=v.session.id;const out=conversationOutput(data,id).path;fs.writeFileSync(path.join(out,'资料.txt'),'合成教师资料：三个观测值为10、30、50。');return id;}
async function start(id,prompt){const value=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{sessionId:id,prompt,commandId:'xicmd_'+randomUUID()});assert(value.ok,JSON.stringify(value));return value.runId;}
async function idle(id){return until(async()=>{const s=await snapshot(id);return !s.running&&s.projection.turns.length?s:undefined;});}
async function activate(version){const v=await page.evaluate(input=>window.omniEdu.activateManagedTool(input),{id:'javascript',version,commandId:'mtcmd_'+randomUUID()});assert(v.ok,JSON.stringify(v));return v.value;}
async function launch(cold=false){
 const bootstrap=path.join(root,'bootstrap.cjs'),base='http://127.0.0.1:'+server.address().port;
 const approved=Object.fromEntries([previous,current].map(r=>[r.sourceUrl,r.version]));
 fs.writeFileSync(bootstrap,`const originalFetch=globalThis.fetch;const approved=${JSON.stringify(approved)};globalThis.b03Fetches=[];globalThis.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;const version=approved[url];if(!version)throw Error('Synthetic unavailable external service');globalThis.b03Fetches.push(url);return originalFetch(${JSON.stringify(base)}+'/'+version,init);};import(${JSON.stringify(pathToFileURL(path.join(desktop,'out/main/index.js')).href)});`);
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_MANAGED_TOOLS_NO_BUILTIN:'1',DEEPSEEK_API_KEY:'synthetic-only',DEEPSEEK_MODEL:'deepseek-flash'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[k];
 app=await _electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(root,'main.log'),b));
 await app.evaluate(({net},{cold})=>{
  const w=globalThis.b03={mode:cold?'cold':'ready',stage:0,calls:[],receipts:[],blocked:[]};
  net.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});if(!url.endsWith('/chat/completions')||w.mode==='cold'){w.blocked.push(url);throw Error('No unconfigured provider call');}
   const body=JSON.parse(init.body),stage=w.stage++,mode=w.mode,names=body.tools?.map(t=>t.function.name)||[];let receipt;
   const last=body.messages.filter(m=>m.role==='tool').at(-1)?.content,text=typeof last==='string'?last:last?.filter(c=>c.type==='text').map(c=>c.text).join('\n');if(text){receipt=text.split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(v=>v&&('success'in v));w.receipts.push({mode,stage,receipt,text:text.slice(0,900)});}
   const call=(name,args)=>{if(!names.includes(name))throw Error('Tool not assembled: '+name);return{name,arguments:JSON.stringify(args)};};let tool;
   const n=v=>({op:'number',numerator:String(v),denominator:'1'}),x={op:'variable'},e=(op,...args)=>({op,args});
   const reportArgs=id=>({resultId:id,title:'实际计算记录',columns:[{key:'label',label:'项目',type:'text'},{key:'value',label:'实际结果',type:'number'}],outputs:[{format:'csv',path:'实际计算.csv'},{format:'xlsx',path:'实际计算.xlsx'}],taskStepId:'deliver'});
   const plan=()=>{const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),version=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);return call('update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'实际计算结果的原文件服务交付核对',steps:[{id:'deliver',text:'交付实际计算CSV及可编辑XLSX',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对计算内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]});};
   if(mode==='ready'){
    if(stage===0)tool=call('find_education_tools',{query:'office_read_text education_compute office_web_fetch'});
    else if(stage===1)tool=call('office_read_text',{path:'资料.txt'});
    else if(stage===2){if(!receipt?.success||!JSON.stringify(receipt).includes('10、30、50'))throw Error('Actual teacher material read missing');w.readiness={read:receipt};tool=call('office_web_fetch',{url:'https://example.com/xiaozhi-unavailable'});}
    else if(stage===3){if(!text||receipt?.success===true)throw Error('Unavailable external service must not succeed');w.readiness.external={text};}
    else throw Error('Readiness overrun');
   }else if(mode==='deliver'){
    if(stage===0)tool=call('find_education_tools',{query:'education_verify_equation'});
    else if(stage===1)tool=call('education_verify_equation',{kind:'equation',left:e('add',e('multiply',n(2),x),n(5)),right:n(27),roots:[n(11)],domain:'real'});
    else if(stage===2){if(receipt?.engine!=='sympy-1.14.0'||receipt?.state!=='matched'||receipt.solutions.join(',')!=='11'||!receipt.candidates[0].satisfies)throw Error('Actual SymPy solution missing');w.equation=receipt;tool=call('education_compute',{input:{schemaVersion:'xiaozhi.table-input.v1',csv:'观测值\r\n10\r\n30\r\n50\r\n',delimiter:',',columns:[{key:'value',label:'观测值',type:'number'}]},code:`const mean=input.rows.reduce((sum,row)=>sum+row.value,0)/input.rows.length;const x=${Number(receipt.solutions[0])};return {rows:[{label:"CSV均值",value:mean},{label:"方程解",value:x},{label:"代回原式",value:2*x+5}],summary:[{label:"均值",value:mean}]};`});}
    else if(stage===3){if(!receipt?.success||receipt.data?.value?.rows?.map(r=>r.value).join(',')!=='30,11,27')throw Error('Actual mean/substitution missing');w.computation=receipt.data;tool=plan();}
    else if(stage===4){if(!receipt?.success)throw Error('Original task plan not admitted');tool=call('education_create_report',reportArgs('xicompute_'+'0'.repeat(64)));}
    else if(stage===5){if(receipt?.error!=='result_unavailable')throw Error('Forged reference unexpectedly accepted');tool=call('education_create_report',reportArgs(w.computation.resultId));}
    else if(stage===6){if(!receipt?.success||receipt.outcome!=='saved')throw Error('Original file service save receipt missing');w.saved=receipt;}
    else throw Error('Delivery overrun');
   }else if(mode==='reference'){
    if(stage===0)tool=plan();else if(stage===1){if(!receipt?.success)throw Error('Reference plan not admitted');tool=call('education_create_report',reportArgs(w.reference));}else if(stage===2){if(receipt?.error!=='result_unavailable')throw Error('Foreign/old reference accepted');}else throw Error('Reference overrun');
   }else if(mode==='pin'||mode==='short'||mode==='long'){
    if(stage===0){if(mode==='pin'){w.waiting=true;await new Promise(resolve=>w.release=resolve);}tool=call('education_compute',{input:null,code:mode==='long'?'while(true){}':'return 30;'});}
    else if(stage===1){if(!receipt?.success||receipt.data?.value!==30||receipt.data.runtime!==(mode==='pin'?'3.6.1':'3.6.2'))throw Error('Actual runtime lock mismatch');}else throw Error('Compute overrun');
   }else throw Error('Unconfigured B03 mode');
   w.calls.push({mode,stage,tool:tool?.name||null});const c=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'b03',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';return new Response(c({role:'assistant'})+c(tool?{tool_calls:[{index:0,id:'b03-'+mode+'-'+stage,type:'function',function:tool}]}:{content:mode==='ready'?'已读取本地资料，外部服务当前不可用。':mode==='deliver'?'已实际计算均值30、方程解11、代回27，两个文件已保存，请核对。':'本次核对结束。'})+c({},tool?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.waitForFunction(()=>Boolean(window.omniEdu?.startXiaozhi),{timeout:60000});await page.getByTestId('office-prompt-input').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 await page.evaluate(()=>{globalThis.b03Events=[];window.omniEdu.onXiaozhiEvent(e=>b03Events.push(e));});
}
try{
 server=http.createServer((req,res)=>{const version=req.url.slice(1),bytes=packages.get(version);assert(bytes);downloads.push(version);res.writeHead(200,{'content-length':bytes.length});res.end(bytes);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let prior;if(resume){assert(path.basename(root).startsWith('omni-edu-foundation-b03-pi-'));prior=JSON.parse(fs.readFileSync(path.join(root,'report.json')));assert.equal(prior.mainSha256,report.mainSha256);assert(prior.delivery?.computation);const history='failure-before-resume-'+Date.now()+'.json';fs.copyFileSync(path.join(root,'report.json'),path.join(root,history));report.resumedFrom=history;checks.push(...prior.checks);report.readiness=prior.readiness;report.delivery=prior.delivery;report.savedTurn=prior.savedTurn;}
 await launch();const id=resume?prior.sessionId:await session('B03固定旅程'),out=conversationOutput(data,id).path;report.sessionId=id;const retained=sha(fs.readFileSync(path.join(out,'资料.txt')));
 if(!resume){
 const missing=await settings();assert(missing.ok);assert.equal(missing.value[0].status,'missing_dependency');assert.equal(downloads.length,0);await configure('ready');await start(id,'读取资料.txt中的三个数，并检查公开网页服务是否可用；只读，不保存。');await idle(id);report.readiness=await state();assert.equal(downloads.length,0);
 check('FAT-B03-01','Original catalog/direct call reads actual material without selected workspace; missing compute status is honest; controlled unavailable external service returns actual failure');
 await configure('deliver');await start(id,'新任务：实际计算CSV观测值10、30、50的均值，用SymPy解2*x+5=27并代回，输出CSV和XLSX。');
 const bundle=await until(async()=>{const s=await snapshot(id);if(!s.running&&s.projection.turns.at(-1)?.status==='failed')throw Error('Delivery failed; inspect preserved actual wire receipts');return page.evaluate(id=>b03Events.findLast(e=>e.sessionId===id&&e.kind==='delivery_bundle'&&e.delivery.state==='pending')?.delivery,id);});assert.equal(bundle.files.length,2);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);assert.equal(fs.readdirSync(out).length,1);
 const approval=await page.evaluate(input=>window.omniEdu.decideXiaozhiDelivery(input),{schemaVersion:'xiaozhi.delivery.v1',sessionId:id,bundleId:bundle.id,revision:bundle.revision,fingerprint:bundle.fingerprint,action:'approve'});assert(approval.ok,JSON.stringify(approval));const complete=await idle(id);report.delivery=await state();report.savedTurn=complete.projection.turns.at(-1);
 }else{assert.equal((await state()).calls.length,0);assert.equal(downloads.length,0);}
 const actual=report.delivery.computation;assert.equal(sha(JSON.stringify(actual.value)),actual.resultSha256);assert.deepEqual(actual.value.rows.map(r=>r.value),[30,11,27]);
 const csvFile=path.join(out,'实际计算.csv'),xlsxFile=path.join(out,'实际计算.xlsx'),parsed=parseComputationCsv(fs.readFileSync(csvFile,'utf8'));assert.deepEqual(parsed.slice(1).map(r=>Number(r[1])),[30,11,27]);const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(xlsxFile);const rows=[];for(const sheet of wb.worksheets)sheet.eachRow(row=>rows.push(row.values));assert(rows.some(r=>r[1]==='CSV均值'&&r[2]===30));assert(rows.some(r=>r[1]==='方程解'&&r[2]===11));assert(rows.some(r=>r[1]==='代回原式'&&r[2]===27));assert(rows.some(r=>JSON.stringify(r).includes(actual.resultSha256)));report.files=[csvFile,xlsxFile].map(file=>({file,sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size}));assert.equal(downloads.filter(v=>v===current.version).length,resume?0:1);
 check('FAT-B03-03','Actual SymPy11 and QuickJS CSVmean30/substitution27 reach real CSV/XLSX through one original approval; actual result hash retained; forged reference creates no file');
 const originalFiles=fs.readdirSync(out).map(file=>({file,sha256:sha(fs.readFileSync(path.join(out,file)))})),artifactCount=query('SELECT count(*) n FROM document_artifacts')[0].n,oldReference=actual.resultId;
 for(const target of [id,await session('B03另一会话')]){await configure('reference',{reference:oldReference});await start(target,'取消旧任务。新的独立核对任务：核对这个旧的计算结果引用，失效时说明原因，不重新计算或保存。');await idle(target);assert.equal(receiptAt(await state(),'reference',2)?.error,'result_unavailable');assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,artifactCount);assert.deepEqual(fs.readdirSync(out).map(file=>({file,sha256:sha(fs.readFileSync(path.join(out,file)))})),originalFiles);}
 await activate(previous.version);await configure('pin');await start(id,'新计算：请实际计算并返回30。');await until(()=>app.evaluate(()=>b03.waiting));await activate(current.version);await app.evaluate(()=>b03.release());await idle(id);assert.equal(receiptAt(await state(),'pin',1)?.data?.runtime,'3.6.1');await configure('short');await start(id,'新的独立计算，请实际返回30。');await idle(id);assert.equal(receiptAt(await state(),'short',1)?.data?.runtime,'3.6.2');
 await configure('long');await start(id,'新计算，请运行长计算直到我停止。');await until(async()=>{const s=await settings();return s.ok&&s.value[0].running===1;});const at=performance.now();await page.evaluate(id=>window.omniEdu.stopXiaozhi(id),id);await idle(id);await until(async()=>{const s=await settings();return s.ok&&!s.value[0].running&&!s.value[0].queued&&!s.value[0].inUse;});report.stopMs=performance.now()-at;await configure('short');await start(id,'新的短计算，请实际返回30。');await idle(id);report.finalWire=await state();assert.equal(receiptAt(report.finalWire,'short',1)?.data?.value,30);
 check('FAT-B03-04','Actual production old-run/cross-session refs rejected without writes; old run freezes3.6.1 across IPC upgrade, new run uses3.6.2; stop drains resources and next run succeeds');
 assert.equal(sha(fs.readFileSync(path.join(out,'资料.txt'))),retained);report.receipts=query('SELECT run_id,tool,success,native_state,effect_state FROM xiaozhi_tool_receipts ORDER BY rowid');const beforeCold=report.files;await app.close();app=undefined;await launch(true);assert.equal((await state()).calls.length,0);for(const f of beforeCold)assert.equal(sha(fs.readFileSync(f.file)),f.sha256);const cold=await snapshot(id);assert.equal(cold.running,false);assert.equal(downloads.length,resume?1:2);report.downloads=downloads;assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;if(app)report.failureWire=await state().catch(()=>null);}
finally{await app?.close();if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:checks.length,error:report.error}));}
