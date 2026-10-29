import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-thinking-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const wireFile=path.join(output,'wire.json'),controlFile=path.join(output,'control.json');
const bootstrap=path.join(output,'bootstrap.cjs');fs.writeFileSync(bootstrap,`globalThis.thinkingFixtureFs=require('node:fs');import(${JSON.stringify(pathToFileURL(path.join(desktop,'out/main/index.js')).href)});`);
const control=patch=>{const old=fs.existsSync(controlFile)?JSON.parse(fs.readFileSync(controlFile,'utf8')):{levels:['low','high','max'],unknown:false,auth:false,hold:false};fs.writeFileSync(controlFile,JSON.stringify({...old,...patch}));};control({});
const report={ok:false,checks:[],errors:[],boundary:'Real formal Electron UI/main/preload/Pi/native session and SQLite, synthetic official metadata/SSE only. No paid request, natural quality/cost claim, daily installation or complete E02 acceptance.'};
let application,page,idA,idB;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async(fn,ms=45000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out');};
const query=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const settings=async id=>page.evaluate(sessionId=>window.omniEdu.getXiaozhiSettings(sessionId?{sessionId}:undefined),id);
const requests=async()=>fs.existsSync(wireFile)?JSON.parse(fs.readFileSync(wireFile,'utf8')):[];
async function ready(){await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>await page.getByTestId('pi-thinking-session-trigger').count()&&!await page.getByTestId('office-prompt-input').isDisabled()&&!await page.getByTestId('pi-thinking-session-trigger').isDisabled());}
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 application=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 fs.writeFileSync(wireFile,'[]');
 await application.evaluate(async({net},{wireFile,controlFile})=>{
  const fs=globalThis.thinkingFixtureFs;
  const state=globalThis.thinkingFixture={requests:[],blocked:[]};
  net.fetch=async(input,init)=>{
   const current=()=>JSON.parse(fs.readFileSync(controlFile,'utf8')),config=current();
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return config.auth?new Response('{}',{status:401}):new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',name:'DeepSeek Flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],...(!config.unknown?{effort:{supported_levels:config.levels,...(config.levels.length?{default_level:config.levels.includes('high')?'high':config.levels[0]}:{})}}:{})}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network disabled');}
   const body=JSON.parse(init.body);state.requests.push({model:body.model,thinking:body.thinking,effort:body.reasoning_effort,tokens:body.max_tokens});
   fs.writeFileSync(wireFile,JSON.stringify(state.requests));
   while(current().hold){if(init.signal?.aborted)throw Error('Aborted');await new Promise(r=>setTimeout(r,60));}
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'thinking-local',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk({content:'合成教学回答，用于核对请求配置。'})+chunk({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{wireFile,controlFile});
 page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await ready();
}
async function choose(scope,choice){await page.getByTestId(`pi-thinking-${scope}-trigger`).click();await page.getByTestId(`pi-thinking-option-${choice}`).click();await until(async()=>!(await page.getByTestId(`pi-thinking-${scope}-trigger`).isDisabled()));}
async function send(text,expected){
 await ready();const before=(await requests()).length;
 await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(async()=>(await requests()).length>before);
 await until(()=>query("SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1")[0]?.status!=='running');
 await ready();const batch=(await requests()).slice(before);assert(batch.length);
 for(const wire of batch){assert.equal(wire.model,'deepseek-flash');assert.equal(wire.effort,expected);assert.equal(wire.thinking.type,expected==='none'?'disabled':'enabled');assert(wire.tokens<=32768);}
 return batch;
}
async function globalSettings(){await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByTestId('pi-settings-workspace').waitFor();await until(async()=>await page.getByTestId('pi-thinking-global-trigger').count()&&!await page.getByTestId('pi-thinking-global-trigger').isDisabled());}
async function back(){await page.locator('[data-testid="product-rail"]:visible').getByTestId('product-nav-ask').click();await ready();}
try{
 await launch();idA=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await globalSettings();await choose('global','high');await back();
 await until(async()=>(await settings(idA)).value.thinking.global.choice==='high');
 assert.equal((await requests()).length,0);assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,0);
 check('Global default through existing settings page; changing configuration creates no model request or task');
 for(const [choice,effort] of [['off','none'],['low','low'],['high','high'],['max','max']]){await choose('session',choice);await send('你好',effort);}
 check('Formal composer choices off/low/high/max reach native Pi wire with same model and bounded output');
 await choose('session','auto');await send('详细推导浮力公式并制作课件','high');await send('继续','high');await send('可以','high');await send('你好','none');
 check('Auto keeps depth through two unfinished short follow-ups and returns to light greeting');
 await choose('session','max');const observed=(await settings(idA)).value.thinking.session;
 const stale=await page.evaluate(({sessionId,version})=>window.omniEdu.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',sessionId,version:version-1,choice:'off'}),{sessionId:idA,version:observed.version});
 assert.equal(stale.error,'conflict');assert.equal((await settings(idA)).value.thinking.session.choice,'max');
 const invalid=await page.evaluate(sessionId=>window.omniEdu.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',sessionId,version:0,choice:'ultra'}),idA);assert.equal(invalid.error,'invalid_input');
 check('CAS conflicts preserve current choice and typed boundary rejects fabricated Ultra');
 await page.getByTestId('pi-new-session').click();await ready();idB=await page.locator('.office-composer-container').getAttribute('data-session-id');assert.notEqual(idA,idB);
 assert.equal((await settings(idB)).value.thinking.session.choice,null);await send('你好','high');
 await globalSettings();await choose('global','off');await back();await send('你好','none');
 assert.equal((await settings(idA)).value.thinking.session.choice,'max');
 check('New session follows global changes; previous session override remains isolated');
 await choose('session','high');control({hold:true});
 const before=(await requests()).length;await page.getByTestId('office-prompt-input').fill('本轮冻结设置');await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(async()=>(await requests()).length>before);
 const busy=await page.evaluate(async sessionId=>{const view=await window.omniEdu.getXiaozhiSettings({sessionId});return window.omniEdu.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',sessionId,version:view.value.thinking.session.version,choice:'off'});},idB);
 assert.equal(busy.error,'busy');assert(await page.getByTestId('pi-thinking-session-trigger').isDisabled());
 control({hold:false});await until(()=>query("SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1")[0].status!=='running');await ready();
 assert.equal((await requests()).at(-1).effort,'high');
 check('In-flight request freezes strategy and both UI and main reject mid-run modification');
 await choose('session','max');control({levels:['low']});
 await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSettings({sessionId,refresh:true}),idB);await page.reload();await ready();
 await send('普通教学问答','low');const fallback=(await settings(idB)).value.thinking.lastRun;assert.equal(fallback.requested,'max');assert.equal(fallback.reason,'unsupported_choice');
 assert.match(await page.getByTestId('pi-thinking-session-trigger').innerText(),/将自动/);
 check('Removed effort level keeps saved preference, shows fallback and sends supported low without switching model');
 const count=(await requests()).length,previous=JSON.stringify((await settings(idB)).value.thinking);
 control({auth:true});
 const auth=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSettings({sessionId,refresh:true}),idB);assert.equal(auth.value.catalogueError,'authentication');
 assert.equal(JSON.stringify(auth.value.thinking),previous);assert.equal((await requests()).length,count);
 check('Read-only catalogue authentication failure preserves configuration and does not generate a reply');
 control({auth:false,unknown:true});
 await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSettings({sessionId,refresh:true}),idB);await page.reload();await ready();
 await page.getByTestId('pi-thinking-session-trigger').click();assert.equal(await page.getByTestId('pi-thinking-option-max').getAttribute('aria-disabled'),'true');await page.keyboard.press('Escape');
 const unavailable=await page.evaluate(async sessionId=>{const v=await window.omniEdu.getXiaozhiSettings({sessionId});return window.omniEdu.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',sessionId,version:v.value.thinking.session.version,choice:'high'});},idB);assert.equal(unavailable.error,'thinking_unavailable');
 await send('你好',undefined);assert.equal((await settings(idB)).value.thinking.lastRun.reason,'capability_unknown');
 check('Old catalogue without effort metadata disables unsupported choices and omits fabricated wire effort');
 control({unknown:false,levels:[]});await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSettings({sessionId,refresh:true}),idB);await page.reload();await ready();
 await send('详细推导', 'none');assert.equal((await settings(idB)).value.thinking.lastRun.effective,'off');
 check('Explicit no-thinking metadata falls back to disabled/none rather than inventing reasoning support');
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows().find(w=>w.isVisible())?.setContentSize(...size),[width,height]);
  for(const testId of ['pi-thinking-session-trigger','office-prompt-input']){const bounds=await page.getByTestId(testId).boundingBox();const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1);}
  await page.screenshot({path:path.join(output,`thinking-${width}.png`)});
 }
 check('New controls are reachable at 1366×768 and 1920×1080');
 report.wires=await requests();assert.equal(await application.evaluate(()=>globalThis.thinkingFixture.blocked.length),0);
 const saved=(await settings(idB)).value.thinking;await application.close();application=undefined;await launch();
 assert.deepEqual((await settings(idA)).value.thinking.session.choice,'max');assert.deepEqual((await settings(idB)).value.thinking,saved);assert.equal((await requests()).length,0);
 check('Cold start preserves both sessions, inheritance and last-run configuration without replay');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=String(error.stack||error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{control({hold:false});if(application)await application.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
