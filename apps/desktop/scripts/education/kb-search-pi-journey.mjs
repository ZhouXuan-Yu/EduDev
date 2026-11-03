import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';

// Explicit retained synthetic book-document fixture only; never open the everyday data root.
const source=fs.realpathSync(process.argv[2]),relative=path.relative(os.tmpdir(),source);
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(source).startsWith('omni-book-document-'));
const prior=JSON.parse(fs.readFileSync(path.join(source,'report.json'),'utf8'));assert(prior.success&&prior.questionId);
assert.equal(process.env.KB_SEARCH_REAL_MODEL,'1','Explicit real-provider test opt-in required');
const key=process.env.DEEPSEEK_API_KEY;assert(key,'Existing DeepSeek key must be supplied through the environment');
const desktop=process.cwd(),resumeArg=process.argv.find(a=>a.startsWith('--resume='));
const resumed=resumeArg?fs.realpathSync(resumeArg.slice('--resume='.length)):undefined;
if(resumed)assert(path.dirname(resumed)===fs.realpathSync(os.tmpdir())&&/^kb-search-pi-[a-z0-9]+$/i.test(path.basename(resumed)));
const initial=resumed?JSON.parse(fs.readFileSync(path.join(resumed,'report.json'),'utf8')):undefined;
if(initial)assert(!initial.success&&initial.sessionId&&initial.checks.length===2&&initial.selectionTurn,'Resume only the retained completed twenty-question run; do not repeat paid work');
const output=resumed||fs.mkdtempSync(path.join(os.tmpdir(),'kb-search-pi-'));
let data=path.join(output,'data'),profile=path.join(output,'profile');
const selectionData=data,sourceDb=path.join(source,'data/app.db');
if(!resumed){
 fs.cpSync(path.join(source,'data'),data,{recursive:true,filter:s=>s!==sourceDb&&!s.startsWith(sourceDb+'-')});fs.mkdirSync(profile);
 const oldState=path.join(source,'profile/Local State');if(fs.existsSync(oldState)){const state=JSON.parse(fs.readFileSync(oldState,'utf8'));fs.writeFileSync(path.join(profile,'Local State'),JSON.stringify({os_crypt:state.os_crypt}));}
}
const digest=b=>createHash('sha256').update(b).digest('hex');
if(!resumed){const original=new DatabaseSync(sourceDb,{readOnly:true});try{await backup(original,path.join(data,'app.db'));}finally{original.close();}}
const sql=(text,values=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(text).all(...values);}finally{db.close();}};
const point='接续平衡力'+Date.now().toString(36),report={success:false,output,checks:[],rendererErrors:[],requests:[],searchResults:[],readResults:[],scope:'Formal Electron UI with real DeepSeek, synthetic teacher-created questions, one retained synthetic imported figure/answer-book question, actual SQL mapper corruption injection and cold restart. Not natural-book accuracy, recall/P95 or 40GB acceptance.'};
report.buildMainSha256=digest(fs.readFileSync(path.join(desktop,'out/main/index.js')));
if(resumed)report.resumed={initialReportSha256:digest(fs.readFileSync(path.join(output,'report.json'))),priorPaidRequests:initial.requests.length,checks:initial.checks};
const attempt=fs.readdirSync(output).filter(name=>/^resume-report-\d+\.json$/.test(name)).length+1;
// Test-copy setup only: copied resources must point into this owned fixture root.
// This does not implement or qualify production backup/restore or change source receipts.
const setup=new DatabaseSync(path.join(data,'app.db'));try{
 let relocated=0;for(const row of setup.prepare('SELECT id,local_path,content_hash FROM teacher_resources').all()){
  const old=path.resolve(row.local_path),rel=path.relative(path.join(source,'data'),old);
  if(path.dirname(old)===path.join(data,'teacher_resources'))continue;
  assert(!rel.startsWith('..')&&!path.isAbsolute(rel)&&path.dirname(rel)==='teacher_resources','Fixture original outside the declared synthetic source root');
  const target=path.join(data,rel);assert.equal(fs.realpathSync(target),target);assert.equal(digest(fs.readFileSync(target)),row.content_hash);
  setup.prepare('UPDATE teacher_resources SET local_path=? WHERE id=? AND local_path=?').run(target,row.id,row.local_path);relocated++;
 }report.fixtureOriginalPathsRebased=relocated;
}finally{setup.close();}
let app,page,sessionId=initial?.sessionId;
const until=async(fn,ms=240000)=>{const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,150));}throw Error('Formal search/read condition timed out');};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1'};
 for(const name of Object.keys(env))if(name.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY','DEEPSEEK_MODEL','KB_SEARCH_REAL_MODEL'].includes(name))delete env[name];
 Object.assign(env,{OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_E2E_DIALOG_MODE:'1'});
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net},{cold})=>{
  globalThis.kbSearchWire={requests:[],searches:[],reads:[],seen:[]};
  const parse=content=>{try{const value=typeof content==='string'?content:content?.map(b=>b.text||'').join('\n');return JSON.parse(value.split('\n')[0]);}catch{return;}};
  for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(input,options)=>{
   const address=new URL(typeof input==='string'?input:input.url||input.href);
   if(!/chat\/completions/.test(address.pathname))return ordinary(input,options);
   if(cold)throw Error('Cold restore must not replay model work');
   if(address.origin!=='https://api.deepseek.com')throw Error('Unexpected model endpoint');
   const body=JSON.parse(typeof options?.body==='string'?options.body:await input.clone().text()),wire=globalThis.kbSearchWire;
   if(wire.requests.length>=20)throw Error('Search/read test request ceiling reached');
   for(const message of body.messages||[]){if(message.role!=='tool'||wire.seen.includes(message.tool_call_id))continue;wire.seen.push(message.tool_call_id);const result=parse(message.content);
    if(result?.schemaVersion==='xiaozhi.education.question-context.v1'&&result.success){
     if(Array.isArray(result.questions))wire.searches.push(result);
     if(result.question)wire.reads.push(result);
    }
   }
   const row={number:wire.requests.length+1,model:body.model,status:null};wire.requests.push(row);
   const response=await ordinary(input,options);row.status=response.status;return response;
  };}
 },{cold});
 page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',error=>report.rendererErrors.push(error.message.replaceAll(key,'[redacted]')));
}
async function wire(){if(!app)return;const w=await app.evaluate(()=>globalThis.kbSearchWire);report.requests.push(...w.requests);report.searchResults.push(...w.searches);report.readResults.push(...w.reads);return w;}
async function close(){if(app){await wire();await app.close();app=undefined;}}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function ask(prompt){
 const before=(await snapshot()).projection.turns.at(-1)?.id,input=page.getByTestId('office-prompt-input');await until(async()=>!await input.isDisabled());await input.fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 return until(async()=>{const value=await snapshot(),last=value.projection.turns.at(-1);return last&&last.id!==before&&!value.running?value:undefined;});
}
async function showFigure(prefix){
 const sources=page.getByTestId('reply-sources').last(),trigger=sources.getByRole('button',{name:/本轮读取的资料/});await trigger.waitFor();
 if((await trigger.getAttribute('aria-expanded'))!=='true')await trigger.click();
 await sources.getByTestId('pi-question-source-open').filter({hasText:'沸点'}).last().click();
 const dialog=page.getByTestId('pi-question-source-dialog');await dialog.waitFor();await dialog.getByTestId('question-original-open').click();
 const images=dialog.getByTestId('question-original-image');await images.first().waitFor();assert(await images.count()>=2);
 for(const[width,height]of[[1366,768],[1920,1080]]){const win=await app.browserWindow(page);await win.evaluate((w,size)=>w.setContentSize(...size),[width,height]);await page.waitForFunction(size=>innerWidth===size[0]&&innerHeight===size[1],[width,height]);
  await images.first().scrollIntoViewIfNeeded();assert(await images.first().evaluate(img=>img.complete&&img.naturalWidth>0));assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:path.join(output,`${prefix}-${width}.png`)});
 }
 await dialog.getByTestId('pi-question-source-close').click();
}
try{
 await launch();const configured=await page.evaluate(key=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:s.value.defaultModel,apiKey:key})),key);assert(configured.ok);
 const events=()=>sql('SELECT j.event_json FROM xiaozhi_event_journal j JOIN xiaozhi_event_runs r ON r.run_id=j.run_id WHERE r.session_id=? ORDER BY j.sequence',[sessionId]).map(r=>JSON.parse(r.event_json));
 let factsBefore;
 if(!resumed){
 await productEntry(page,'teaching').click();await page.getByTestId('hub-entry-question_notebook').click();
 for(let i=0;i<22;i++){
  for(const[name,value]of Object.entries({stem:`${point} 样题${i+1}：静止物体受到向左${i+2}N和向右拉力F，求F。`,answer:`${i+2}N`,analysis:'物体静止，两个相反方向的力大小相等。',subject:'物理',grade:'初三','knowledge-point':point,type:'计算题'}))await page.getByTestId('question-notebook-new-'+name).fill(value);
  await page.getByTestId('question-notebook-create-question').click();await until(async()=>await page.getByTestId('question-notebook-new-stem').inputValue()==='');
 }
 const created=sql('SELECT id FROM question_bank_items WHERE knowledge_point=? ORDER BY rowid',[point]);assert.equal(created.length,22);report.questionIds=created.map(q=>q.id);
 const bad=created.at(-1).id,db=new DatabaseSync(path.join(data,'app.db'));try{db.exec('PRAGMA busy_timeout=5000');db.prepare('UPDATE question_bank_items SET document_json=? WHERE id=?').run('{broken',bad);}finally{db.close();}
 factsBefore=sql('SELECT * FROM question_bank_items ORDER BY id');check('Original teacher notebook creates 22 owned questions; one explicitly corrupted test record exercises the actual SQL mapping boundary');
 await productEntry(page,'ask').click();const old=await page.locator('.office-composer-container').getAttribute('data-session-id');await page.getByTestId('pi-new-session').click();sessionId=await until(async()=>{const id=await page.locator('.office-composer-container').getAttribute('data-session-id');return id&&id!==old?id:undefined;});report.sessionId=sessionId;
 const selected=await ask(`请从我的本地题库查找知识点“${point}”的20道不同题目。先读取每道的完整题面，再只列出序号和每题一句题面摘要，并附本地来源。不解答，不新增、不修改题目。`);
 const readIds=new Set(events().filter(e=>e.kind==='tool_end'&&e.tool==='education_read_question'&&e.success).flatMap(e=>(e.sources||[]).flatMap(s=>s.question?[s.question.questionId]:[])));
 assert(readIds.size>=20,`Actual successful complete reads: ${readIds.size}`);assert(!readIds.has(bad));const warm=await app.evaluate(()=>globalThis.kbSearchWire);assert(warm.searches.some(s=>s.nextCursor));assert(warm.searches.some(s=>s.candidateWindow?.scannedThrough>10));assert(warm.searches.some(s=>s.candidateWindow?.excludedRecords===1));
 report.selectionTurn=selected.projection.turns.at(-1);check('Real DeepSeek independently uses search continuation and successful original full-read tools for at least 20 distinct healthy questions');
 }else{
  factsBefore=sql('SELECT * FROM question_bank_items ORDER BY id');report.sessionId=sessionId;
  const completed=new Set(events().filter(e=>e.kind==='tool_end'&&e.tool==='education_read_question'&&e.success).flatMap(e=>(e.sources||[]).flatMap(s=>s.question?[s.question.questionId]:[])));
  assert(completed.size>=20);await productEntry(page,'ask').click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
  assert(!(await snapshot()).running);check('Resumed original completed twenty-question conversation without re-creating questions or repeating prior paid requests');
 }
 // Imported AI receipts bind the original inode/ctime, so a raw file copy is not
 // a valid migrated fixture. Keep that failure and test the reading capability
 // in the original explicitly-owned synthetic root, without rewriting receipts.
 report.selectionSessionId=sessionId;await close();
 data=path.join(source,'data');profile=path.join(output,'figure-profile');
 if(!fs.existsSync(profile)){
  fs.mkdirSync(profile);const state=JSON.parse(fs.readFileSync(path.join(source,'profile/Local State'),'utf8'));
  fs.writeFileSync(path.join(profile,'Local State'),JSON.stringify({os_crypt:state.os_crypt}));
 }
 const importedFacts=sql('SELECT * FROM question_bank_items ORDER BY id'),importedCalls=sql('SELECT id,calls FROM material_ai_batches ORDER BY id');
 const originalAssets=sql('SELECT local_path,content_hash FROM teacher_resources').map(r=>({path:r.local_path,sha256:r.content_hash}));
 await launch();const figureSettings=await page.evaluate(key=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:s.value.defaultModel,apiKey:key})),key);assert(figureSettings.ok);
 await productEntry(page,'ask').click();const previousSession=await page.locator('.office-composer-container').getAttribute('data-session-id');await page.getByTestId('pi-new-session').click();sessionId=await until(async()=>{const id=await page.locator('.office-composer-container').getAttribute('data-session-id');return id&&id!==previousSession?id:undefined;});report.sessionId=sessionId;
 const imported=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),prior.questionId);
 const sourceView=await page.evaluate(v=>window.omniEdu.getQuestionContextSource(v),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:imported.id,version:questionVersion(imported)});
 assert(sourceView.ok,JSON.stringify(sourceView));
 const figure=await ask('再从我的本地题库读取“标准大气压下水的沸点”这道题，说明题面、图义转写以及答案与解析的出处，并附本地来源。不要修改题库。');
 const reads=(await app.evaluate(()=>globalThis.kbSearchWire)).reads;assert(reads.some(r=>r.question.context?.figures.text==='原图为盛水的烧杯。'&&r.question.bookSources?.answer));
 assert(events().some(e=>e.kind==='tool_end'&&e.tool==='education_read_question'&&e.success&&e.sources?.some(s=>s.question?.questionId===prior.questionId)));
 await showFigure('warm-source');assert.deepEqual(sql('SELECT * FROM question_bank_items ORDER BY id'),importedFacts);report.figureTurn=figure.projection.turns.at(-1);check('Real Pi reads imported figure transcription and independent answer-book provenance; original source dialog loads both actual local image crops at both sizes');
 const durable=JSON.stringify((await snapshot()).projection.turns);await close();const calls=report.requests.length;await launch(true);await productEntry(page,'ask').click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);assert.equal(JSON.stringify((await snapshot()).projection.turns),durable);await showFigure('cold-source');
 assert.deepEqual(sql('SELECT * FROM question_bank_items ORDER BY id'),importedFacts);assert.deepEqual(sql('SELECT id,calls FROM material_ai_batches ORDER BY id'),importedCalls);
 for(const asset of originalAssets)assert.equal(digest(fs.readFileSync(asset.path)),asset.sha256);
 const selectedDb=new DatabaseSync(path.join(selectionData,'app.db'),{readOnly:true});try{assert.deepEqual(selectedDb.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),factsBefore);}finally{selectedDb.close();}
 assert.equal((await app.evaluate(()=>globalThis.kbSearchWire)).requests.length,0);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');assert.deepEqual(report.rendererErrors,[]);report.realPaidRequests=calls;check('Native cold restart preserves exact source-bearing conversation and all canonical records in both owned fixtures; originals/ingestion paid ledgers unchanged and zero model replay');report.success=true;
}catch(error){report.error=String(error.stack||error).replaceAll(key,'[redacted]');process.exitCode=1;if(app){await page?.screenshot({path:path.join(output,`failure-${resumed?attempt:'initial'}.png`)}).catch(()=>{});report.failureSnapshot=await snapshot().catch(()=>undefined);}}
finally{await close().catch(()=>{});fs.writeFileSync(path.join(output,resumed?`resume-report-${attempt}.json`:'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,realPaidRequests:report.requests.length,error:report.error}));}
