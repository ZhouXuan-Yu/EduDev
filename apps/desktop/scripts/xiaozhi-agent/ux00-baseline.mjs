import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {settleWorkspaceTransitions} from './capture-workspace-metrics.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/ux00-'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-ux00-'));
const data=path.join(temp,'data'),profile=path.join(temp,'profile');
fs.mkdirSync(data);fs.mkdirSync(profile);
const env={...process.env,NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..')};
for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
// Reuse configured provider only for normal app bootstrap; this suite never submits a model request.
const configPath=process.env.XIAOZHI_AUDIT_ENV||'D:/WorkProject/EduProject/apps/desktop/.env.local';
const config=fs.existsSync(configPath)?fs.readFileSync(configPath,'utf8'):'';
for(const name of ['DEEPSEEK_API_KEY','DEEPSEEK_MODEL'])if(!env[name])env[name]=config.match(new RegExp('^'+name+'\\s*=\\s*(.*?)\\s*$','m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const report={version:1,suite:'ux00-current-formal-baseline',success:false,output,temp,checks:[],findings:[],journeys:[],visuals:[],performance:[],rendererErrors:[],boundaries:['Formal main/preload/UI/SQLite; native dialogs use explicit owned fixture or cancel','History stress fixtures are synthetic persisted records, not accepted teacher or model output','Application zoom is not a change to Windows system DPI; timings exclude provider']};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const themes=process.env.XIAOZHI_AUDIT_LIGHT_ONLY==='1'?['light']:['light','dark'];
report.build={mainSha256:hash(fs.readFileSync(path.join(desktop,'out/main/index.js'))),scriptSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url)))};
let app,page,journey;
function flush(){fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
function check(name){report.checks.push({name,pass:true});console.log('PASS '+name);flush();}
function sql(query,params=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all(...params);}finally{db.close();}}
async function until(fn,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,60));}throw Error('Timeout waiting for actual UI');}
async function ready(){await page.getByTestId('office-prompt-input').waitFor();await until(()=>page.getByTestId('office-prompt-input').isEnabled());}
const tid=id=>page.getByTestId(id);
async function step(label,action,type='click'){const t=performance.now();await action();journey?.steps.push({label,type,ms:performance.now()-t});}
const click=id=>step(id,()=>tid(id).click());
const fill=(id,value)=>step(id,()=>tid(id).fill(value),'field');
const rail=()=>page.locator('[data-testid=product-rail]:visible');
const navigate=id=>step('navigate '+id,()=>rail().getByTestId('product-nav-'+id).click());
function begin(name){journey={name,steps:[],started:Date.now(),scope:'actual visible UI'};report.journeys.push(journey);}
function end(result,unverified=[]){Object.assign(journey,{result,unverified,elapsedMs:Date.now()-journey.started,clicks:journey.steps.filter(s=>s.type==='click').length,fieldEdits:journey.steps.filter(s=>s.type==='field').length});journey=undefined;flush();}
async function launch(){app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.rendererErrors.push(String(e)));await ready();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));}
async function capture(label,controls=[]){
 for(const theme of themes)for(const size of [{width:1366,height:768},{width:1920,height:1080}])for(const zoom of [1,1.25,1.5]){
  await page.emulateMedia({colorScheme:theme});await app.evaluate(({BrowserWindow},{size,zoom})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(size.width,size.height);w.webContents.setZoomFactor(zoom);},{size,zoom});
  await page.waitForFunction(({size,zoom})=>Math.abs(innerWidth-size.width/zoom)<=2&&Math.abs(innerHeight-size.height/zoom)<=2,{size,zoom});
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await settleWorkspaceTransitions(page);
  await page.evaluate(ids=>{for(const id of ids){const e=document.querySelector(`[data-testid="${id}"]`);for(let p=e?.parentElement;p;p=p.parentElement)if(p.scrollHeight>p.clientHeight)p.scrollTop=0;}},controls);
  const geometry=await page.evaluate(ids=>({cssWidth:innerWidth,cssHeight:innerHeight,dpr:devicePixelRatio,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,controls:ids.map(id=>{const e=document.querySelector(`[data-testid="${id}"]`);if(!e)return{id,missing:true};const r=e.getBoundingClientRect();return{id,visible:!!e.getClientRects().length,disabled:e.disabled,rect:{x:r.x,y:r.y,width:r.width,height:r.height},inViewport:r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};})}),controls);
  // Native compositor capture avoids CDP viewport clipping at non-1 Electron zoom/DPI.
  const png=`${label}-${theme}-${size.width}-zoom${zoom}.png`;
  const native=await app.evaluate(async({BrowserWindow})=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage();return{data:image.toDataURL(),size:image.getSize()};});
  fs.writeFileSync(path.join(output,png),Buffer.from(native.data.split(',')[1],'base64'));
  const afterScroll=[];
  for(const id of controls){const control=tid(id);if(await control.isVisible()){await control.scrollIntoViewIfNeeded();afterScroll.push(await control.evaluate((e,id)=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id,inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!top&&(e.contains(top)||top.contains(e))};},id));}}
  report.visuals.push({label,theme,size,zoom,geometry,png,nativeImageSize:native.size,afterScroll});
  for(const c of afterScroll)if(!c.inViewport||!c.hit)report.findings.push({kind:'control-unreachable-after-scroll',label,theme,size,zoom,id:c.id});
  if(geometry.horizontalOverflow)report.findings.push({kind:'horizontal-overflow',label,theme,size,zoom});
  for(const c of geometry.controls)if(c.visible&&!c.inViewport)report.findings.push({kind:'control-outside-initial-viewport',label,theme,size,zoom,id:c.id,note:'May be reachable by intentional internal scroll; not automatically a clipped control'});
 }
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setZoomFactor(1);w.setContentSize(1366,768);});await page.emulateMedia({colorScheme:'light'});flush();
 await page.waitForFunction(()=>innerWidth===1366&&innerHeight===768);
}
function seedHistories(){
 const db=new DatabaseSync(path.join(data,'app.db'));const ids={};
 try{
  db.exec('BEGIN');
  for(const count of [100,1000]){
   const id='aisession_'+randomUUID(),start=Date.now()-count*1000;ids[count]=id;
   const at=new Date(start).toISOString();
   db.prepare('INSERT INTO ai_conversation_sessions(id,title,message_count,created_at,updated_at,title_source) VALUES(?,?,?,?,?,?)').run(id,`UX00合成历史 ${count}条`,count,at,at,'manual');
   for(let i=0;i<count/2;i++){
    const run='run_'+randomUUID(),user='aimsg_'+randomUUID(),assistant='aimsg_'+randomUUID(),created=new Date(start+i*2000).toISOString();
    db.prepare('INSERT INTO ai_agent_runs(id,session_id,prompt,route,sub_intent,status,model,created_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(run,id,'合成压力数据，非真实教师请求','education','pi_education','succeeded','deepseek-flash',created,created,created);
    const text=`合成测量第${i+1}回合：只用于界面压力测量，不能作为教学证据。\n\n基础题：$x+2=5$，解为$x=3$。\n\n请教师核对实际任务来源，本夹具不含学生信息。`;
    const metadata={piVersion:'xiaozhi.pi.education.v1',agentRunId:run,ok:true,status:'completed',publicItems:[{id:run+':segment:1',kind:'message',role:'assistant',phase:'final_answer',text}]};
    const insert=db.prepare('INSERT INTO ai_conversation_messages(id,session_id,role,content,metadata_json,created_at) VALUES(?,?,?,?,?,?)');
    insert.run(user,id,'user',`合成历史第${i+1}回合`,JSON.stringify({piVersion:metadata.piVersion,agentRunId:run}),created);
    insert.run(assistant,id,'assistant',text,JSON.stringify(metadata),new Date(start+i*2000+1).toISOString());
   }
  }
  db.exec('COMMIT');return ids;
 }catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
}
const stats=values=>{const v=[...values].sort((a,b)=>a-b);return{samples:v.length,min:v[0],p50:v[Math.ceil(v.length*.5)-1],p95:v[Math.ceil(v.length*.95)-1],max:v.at(-1)};};
async function perf(ids,empty){
 for(const count of [100,1000]){
  const result={messages:count,session:ids[count],fixture:'synthetic persisted Pi public-history; no native model execution'};
  console.log('PERF start '+count);const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const base=await cdp.send('Performance.getMetrics');result.before=Object.fromEntries(base.metrics.map(x=>[x.name,x.value]));
  const opens=[];
  for(let i=0;i<30;i++){
   await tid('ai-conversation-session-'+empty).click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===empty);await ready();
   const t=performance.now();await tid('ai-conversation-session-'+ids[count]).click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===ids[count]);await ready();
   await until(async()=>await page.locator('.office-turn').count()===count/2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));opens.push(performance.now()-t);
   if(i%10===9)console.log(`PERF ${count} opened ${i+1}/30`);
  }
  result.openMs=stats(opens);result.openSamples=opens;
  result.snapshot=await page.evaluate(async id=>{const samples=[],bytes=[];for(let i=0;i<30;i++){const t=performance.now();const value=await window.omniEdu.getXiaozhiSnapshot(id);samples.push(performance.now()-t);bytes.push(new TextEncoder().encode(JSON.stringify(value)).length);}return{samples,bytes,turns:document.querySelectorAll('.office-turn').length,domNodes:document.querySelectorAll('*').length};},ids[count]);result.snapshot.ms=stats(result.snapshot.samples);
  const typing=[];for(let i=0;i<30;i++){const t=performance.now();await tid('office-prompt-input').fill('本机输入测量 '+i);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));typing.push(performance.now()-t);}result.inputMs=stats(typing);result.inputSamples=typing;await tid('office-prompt-input').fill('');
  result.scroll=await page.evaluate(async()=>{const el=document.querySelector('[data-testid=office-conversation]');const intervals=[];let last=performance.now();for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now;el.scrollTop=(i%2?1:0)*el.scrollHeight;}return{intervals,over50ms:intervals.filter(t=>t>50).length,max:Math.max(...intervals)};});
  result.mainMemory=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,memory:p.memory,cpu:p.cpu.percentCPUUsage})));
  result.after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));await cdp.detach();report.performance.push(result);flush();console.log('PERF complete '+count+' '+JSON.stringify({open:result.openMs,input:result.inputMs,ipc:result.snapshot.ms,nodes:result.snapshot.domNodes}));
 }
}
try{
 await launch();report.environment=await app.evaluate(({app,screen,BrowserWindow})=>({versions:process.versions,displays:screen.getAllDisplays().map(d=>({scaleFactor:d.scaleFactor,size:d.size,workArea:d.workArea})),zoom:BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),data:app.getPath('userData')}));
 assert(page.url().endsWith('/out/renderer/index.html'));check('formal checkout main and owned profile');
 begin('普通问答与备课启动');await capture('empty-chat',['office-prompt-input']);await click('chat-suggestion-0');assert((await tid('office-prompt-input').inputValue()).includes('备一节课'));await fill('office-prompt-input','阶段一草稿');await tid('office-prompt-input').press('Shift+Enter');assert((await tid('office-prompt-input').inputValue()).includes('\n'));await tid('office-prompt-input').dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229});assert.equal(sql('SELECT id FROM ai_agent_runs').length,0);check('suggestion draft Shift+Enter and composing Enter never auto-send');end('入口/草稿/键盘已测；本片不发模型请求，模型完成证据须查对应构建的真实provider专项报告',['本片不重复发付费模型请求','原生Windows输入法硬件交互未测']);await fill('office-prompt-input','');
 begin('题库组卷到审核');await navigate('teaching');await click('nav-paper');await tid('paper-workspace').waitFor();await capture('paper-blueprint',['paper-generate']);await click('paper-generate');await tid('paper-shortages').waitFor();assert(await tid('paper-confirm').isDisabled());check('empty bank shortage prevents confirmation');await click('paper-reject');
 await click('nav-question_notebook');for(const [key,value]of Object.entries({subject:'数学',grade:'初二','knowledge-point':'UX00合成加法',type:'选择题',stem:'【UX00合成题】1+1等于多少？A.1 B.2 C.3 D.4',answer:'B',analysis:'合成测量题：1+1=2。'}))await fill('question-notebook-new-'+key,value);await click('question-notebook-create-question');await until(()=>sql('SELECT id FROM question_bank_items').length===1);
 await click('nav-paper');await tid('paper-workspace').waitFor();await step('移除第三部分',()=>tid('paper-section').last().getByRole('button',{name:'移除此部分',exact:true}).click());await step('移除第二部分',()=>tid('paper-section').last().getByRole('button',{name:'移除此部分',exact:true}).click());await fill('paper-title','UX00一题合成练习');await fill('paper-total','10');await fill('paper-section-count','1');await fill('paper-section-points','10');await click('paper-generate');await until(()=>tid('paper-confirm').isEnabled());await click('paper-confirm');await tid('paper-confirmed').waitFor();await capture('paper-confirmed',[]);end('真实UI创建一题→本地组卷→缺题保护/拒绝→完整一题审核保存',['非100分复杂卷','Word/PDF正式交付未执行','参考答案未独立核验']);check('owned question and confirmed paper saved through actual UI');
 begin('学生错题入口');await navigate('students');await click('student-create');await fill('student-form-display-name','UX00合成学生');await fill('student-form-grade','初二');await click('student-form-save');await tid('student-profile-readback').waitFor();await click('nav-mistakes');await tid('mistake-image-empty').waitFor();await capture('mistake-empty',['mistake-send-ai']);await click('nav-intake');await tid('learning-record-form').waitFor();await step('record-form-type=mistake',()=>tid('record-form-type').selectOption('mistake'),'field');await fill('record-form-subject','数学');await fill('record-form-title','UX00合成错题');await fill('record-form-content','合成课堂记录：学生把1+1误写为3；此记录只用于UI基线，未经诊断。');await click('record-form-save');await until(()=>sql('SELECT id FROM learning_records').length>0);await click('nav-mistakes');const importButton=page.locator('[data-testid^="mistake-import-"]').first();await importButton.waitFor();await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});await step('选择附件后取消',()=>importButton.click());await tid('mistake-attachment-import-canceled').waitFor();assert.equal(sql('SELECT id FROM attachments').length,0);end('实际学生/错题记录创建、跨页入口及取消附件零写入',['原图/OCR识别与校正未执行','相似/变式题生成审核与练习未执行']);check('mistake entry friction and cancellation captured without fake OCR');
 begin('基于学生记录的本地复盘');await click('nav-review');await tid('review-report-workspace').waitFor();await click('review-report-generate');await tid('review-report-content').waitFor();await capture('review-draft',['review-report-save']);const source=await tid('review-report-content').inputValue();await fill('review-report-content',source+'\n\n教师补充：此为UX00合成基线，非真实学生诊断。');await click('review-report-save');await tid('review-report-saved').waitFor();assert(sql('SELECT id FROM review_reports').length>0);end('实际本地草稿→内容修改→SQLite保存；有真实UI录入的合成记录作为来源',['非模型复盘质量验收','最终文件导出未执行']);check('actual local review save and source records');
 const before=sql('SELECT id,content_md FROM review_reports');await app.close();await launch();await navigate('students');await click('nav-review');await tid('review-report-workspace').waitFor();const history=page.locator('[data-testid^="review-report-history-"]').filter({hasText:'复盘'}).first();if(await history.count())await history.click();assert.deepEqual(sql('SELECT id,content_md FROM review_reports'),before);check('cold SQLite report readback unchanged');await app.close();
 const ids=seedHistories();report.syntheticHistoryIds=ids;await launch();await tid('ai-conversation-new').click();await ready();const empty=await page.locator('.office-composer-container').getAttribute('data-session-id');await perf(ids,empty);check('30-sample local history input IPC and memory measurements recorded');
 assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.failure=String(error.stack).slice(0,5000);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();flush();console.log(JSON.stringify({success:report.success,passed:report.checks.length,findings:report.findings.length,output,temp,failure:report.failure}));}
