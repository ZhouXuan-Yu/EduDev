import '../office-agent/register-source.mjs';
const {expandScienceParts}=await import('../../src/shared/science-figure.ts');
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-science-natural-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),workspace=path.join(output,'workspace');
fs.mkdirSync(workspace);
const envText=fs.readFileSync('.env.local','utf8'),pick=name=>envText.match(new RegExp('^'+name+'\\s*=\\s*(.*?)\\s*$','m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const key=process.env.DEEPSEEK_API_KEY||pick('DEEPSEEK_API_KEY');
assert(key,'Local test credential required');
const buildRoot=path.dirname(path.dirname(testMain(process.cwd()))),build=fingerprint(buildRoot);
const report={success:false,checks:[],errors:[],launches:[],requests:[],build:{root:buildRoot,sha256:build.sha256,files:build.files.length},boundary:'Actual isolated Electron/Pi/DeepSeek without a manually selected skill. Synthetic teacher request and owned workspace only. No claim of PowerPoint/WPS classroom playback, all-subject scientific correctness or daily-profile use.'};
let app,page,session;

const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=300000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('natural science classroom condition timed out');}

async function launch(){
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:pick('DEEPSEEK_MODEL')||'deepseek-chat'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[testMain(process.cwd()),`--user-data-dir=${profile}`],env,timeout:60000});
 report.launches.push(await assertIsolatedPiMain(app,testMain(process.cwd()),profile));
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error).replaceAll(key,'[credential]')));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 session=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await app.evaluate(({net},credential)=>{const original=net.fetch.bind(net);globalThis.scienceNaturalRequests=[];net.fetch=async(input,init)=>{const url=typeof input==='string'?input:String(input);let record;if(url.includes('/chat/completions')&&typeof init?.body==='string'){const body=JSON.parse(init.body);record={model:body.model,toolAvailable:body.tools?.some(tool=>tool.function?.name==='office_create_science_figure'),credentialMatches:new Headers(init.headers).get('authorization')===`Bearer ${credential}`,status:null};globalThis.scienceNaturalRequests.push(record);}const response=await original(input,init);if(record)record.status=response.status;return response;};},key);
}

async function close(){if(app){report.requests.push(...await app.evaluate(()=>globalThis.scienceNaturalRequests));await app.close();app=undefined;}}
function nativeCalls(){const row=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session])[0];assert(row);const file=path.join(data,'xiaozhi-pi',row.session_file);return fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)).flatMap(entry=>Array.isArray(entry.message?.content)?entry.message.content:[]).filter(item=>item.name==='office_create_science_figure');}

try{
 await launch();
 assert.equal(await page.getByTestId('pi-skill-badge').count(),0,'Teacher request must begin without a selected skill');
 await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
 await until(async()=>Boolean((await snapshot()).workspace));
 check('Natural classroom request starts without selecting a technical skill');

 const prompt='给八年级学生准备一节约3分钟的课堂演示，讲清楚“散热片为什么有很多肋片”。我想直接看能观察结构的课堂演示，确认后再导出成课堂PPT；演示里要有学习目标、观察问题、逐步讲解和一个理解检查，参考答案只给我看。请现在开始，不要先问格式。';
 await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(async()=>{
  const state=await snapshot();
  if(state.changes?.some(change=>/\.html$/i.test(change.path)&&change.state==='pending'))return true;
  if(!state.running){fs.writeFileSync(path.join(output,'unexpected-turn.json'),JSON.stringify(state.projection.turns.at(-1),null,2));throw Error('natural classroom request ended without a science preview');}
  return false;
 },360000);
 const row=(await snapshot()).changes.find(change=>/\.html$/i.test(change.path)&&change.state==='pending');
 const card=page.locator(`[data-testid="pi-text-change"][data-change-id="${row.id}"]`);
 await card.getByTestId('pi-science-demo').waitFor();
 await until(()=>card.frameLocator('iframe').locator('#scene').evaluate(image=>image.complete&&image.naturalWidth>0));
 assert.equal(await card.getByTestId('pi-text-diff').isVisible(),false);
 const call=nativeCalls().at(-1),input=call.arguments;
 const expanded={...input,parts:expandScienceParts(input.parts)};
 assert(expanded.parts.length>=40&&expanded.parts.length<=80);
 assert.equal(expanded.path,row.path);
 assert.match(expanded.path,/\.html$/i);
 assert(input.teaching);
 assert.match(input.teaching.audience,/八年级/);
 assert(input.teaching.objective&&input.teaching.observation);
 assert(input.teaching.steps.length>=1&&input.teaching.steps.length<=4);
 assert(input.teaching.check.question&&input.teaching.check.answer);
 fs.writeFileSync(path.join(output,'model-classroom.json'),JSON.stringify({callId:call.id,input:expanded},null,2));
 report.model={path:row.path,parts:expanded.parts.length,teaching:input.teaching};
 check('Real DeepSeek auto-selects the classroom drawing tool, supplies bounded teaching fields and hides technical source by default');

 for(const [width,height] of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  await until(()=>page.evaluate(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]));
  await card.getByTestId('pi-science-demo').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`pending-${width}x${height}.png`)});
  await card.getByTestId('pi-text-approve').scrollIntoViewIfNeeded();
  const approve=await card.getByTestId('pi-text-approve').boundingBox();assert(approve&&approve.x>=0&&approve.y>=0&&approve.x+approve.width<=width&&approve.y+approve.height<=height);
 }
 check('Teacher can reach the natural classroom preview and approval at both desktop sizes');

 assert(!fs.existsSync(path.join(workspace,row.path)));
 await card.getByTestId('pi-text-approve').click();
 await until(async()=>!(await snapshot()).running);
 const saved=fs.readFileSync(path.join(workspace,row.path),'utf8'),change=(await snapshot()).changes.find(item=>item.id===row.id);
 assert.equal(change.state,'applied');assert.match(saved,/science-teaching/);
 check('Teacher approval saves the exact natural-language classroom artifact and teaching metadata');

 await card.getByTestId('pi-text-open').click();await page.getByTestId('pi-file-panel').waitFor();
 await page.getByTestId('science-export-pptx').click();
 await page.getByTestId('science-export-success').waitFor({timeout:120000});
 const exportText=await page.getByTestId('science-export-success').innerText();
 assert(/\.pptx/.test(exportText));assert(/含动图和逐步讲解|页/.test(exportText));
 report.export=exportText;
 check('The saved classroom preview exports a real PPTX from the file panel without another model request or technical selection');

 const runs=query('SELECT COUNT(*) AS n FROM ai_agent_runs')[0].n;await close();await launch();
 assert.equal(await page.getByTestId('office-prompt-input').isDisabled(),false);
 const restored=await snapshot();
 assert.equal(query('SELECT COUNT(*) AS n FROM ai_agent_runs')[0].n,runs);
 assert(restored.changes.some(item=>item.id===row.id&&item.state==='applied'));
 assert(fs.existsSync(path.join(workspace,row.path)));
 check('Cold restart preserves the approved classroom artifact and performs zero model replay');

 await close();assert(report.requests.length>0&&report.requests.every(item=>item.credentialMatches&&item.status===200&&item.toolAvailable));assert.deepEqual(report.errors,[]);assert.equal(fingerprint(buildRoot).sha256,build.sha256);
 report.success=true;
}catch(error){
 report.error=String(error.stack||error).replaceAll(key,'[credential]');process.exitCode=1;
 await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
 await close().catch(()=>{});
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}
