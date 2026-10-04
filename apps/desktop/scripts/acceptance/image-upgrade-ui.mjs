import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {createSamples} from './create-samples.mjs';import {fingerprint} from './evidence.mjs';
const desktop=process.cwd(),build=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'test-results/acceptance/image-fix-build-20261004');
assert(build.startsWith(path.resolve('test-results')+path.sep));
const baseline=path.resolve(process.env.OMNI_EDU_TEST_OLD_BUILD_ROOT||'out');assert(baseline===path.resolve('out')||baseline.startsWith(path.resolve('test-results')+path.sep));
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-image-upgrade-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const samples=await createSamples(path.join(output,'samples')),image=path.join(samples,'02-公开视觉.png'),answer=JSON.parse(fs.readFileSync(path.join(samples,'答案.json'),'utf8')).vision;
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const report={success:false,checks:[],buildSha256:fingerprint(build).sha256,boundaries:['Actual old everyday out → same owned conversation → new fixed build','Only synthetic public image, explicit teacher confirmation; no user profile or student image','Natural user wording and inherited earlier inability reply; not model forced tool-name prompt']};let app,page,id;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn){const end=Date.now()+150000;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,100));}throw new Error('Image upgrade UI condition timed out');}
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
function native(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const row=db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(id);return fs.readFileSync(path.join(data,'xiaozhi-pi',row.session_file));}finally{db.close();}}
async function launch(root){const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[path.join(root,'main/index.js'),`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());const actual=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(actual,id);else id=actual;
 await app.evaluate(()=>{globalThis.sentImages=[];const original=globalThis.fetch;globalThis.fetch=async function(input,init){let record;const url=typeof input==='string'?input:input?.url;if(url?.startsWith('https://api.deepseek.com/')&&url.endsWith('/chat/completions')&&typeof init?.body==='string'){const raw=JSON.parse(init.body),count=(raw.messages||[]).flatMap(m=>Array.isArray(m.content)?m.content:[]).filter(p=>p.type==='image_url').length;record={count,status:null};globalThis.sentImages.push(record);}const response=await original.apply(this,arguments);if(record)record.status=response.status;return response;};});
}
async function send(text){const n=(await snap()).projection.turns.length;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');await until(async()=>(await snap()).projection.turns.length>n);}
async function terminalOrQuestion(){return until(async()=>{const s=await snap();if(s.controls?.some(c=>c.kind==='question'&&c.state==='pending')||!s.running)return s;});}
async function stopIfNeeded(){if((await snap()).running){await page.getByRole('button',{name:'停止本轮',exact:true}).click();await until(async()=>!(await snap()).running);}}
try{
 assert(!fs.readFileSync(path.join(baseline,'main/index.js'),'utf8').includes('office_view_public_image'),'Baseline must be the old everyday build, do not invent old failure on new out');
 await launch(baseline);await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},image);await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());
 await send('识别这张图片，告诉我图形的颜色、数量和位置。');await terminalOrQuestion();await stopIfNeeded();
 await send('你这个模型不是可以直接识别吗');await terminalOrQuestion();await stopIfNeeded();
 assert((await app.evaluate(()=>globalThis.sentImages)).every(r=>r.count===0));const old=native();assert(!old.toString().includes('xiaozhi.education.public-image.v1'));await page.screenshot({path:path.join(output,'old-chain.png')});check('Actual older everyday build has no image tool and sends no image for original user wording; old conversation retained');
 await app.close();app=undefined;await launch(build);
 await send('你这个模型不是可以直接识别吗？请实际看刚才图片，准确识别颜色、数量、左右位置和图内核验码。最终用JSON字段code、redSquares、blueCircles、redPosition、bluePosition回答，位置用left/right。');
 const pendingState=await terminalOrQuestion(),pending=pendingState.controls?.find(c=>c.kind==='question'&&c.state==='pending'&&c.options?.includes('公开图片，无学生信息，同意本轮分析'));
 assert(pending,'New image-capable chain must open actual public-purpose confirmation for natural user wording instead of denying ability or only asking in chat');
 assert((await app.evaluate(()=>globalThis.sentImages)).every(r=>r.count===0));await page.screenshot({path:path.join(output,'natural-confirmation.png')});
 await page.getByTestId(`pi-question-option-${pending.options.indexOf('公开图片，无学生信息，同意本轮分析')}`).last().click();await page.getByTestId('pi-question-submit').last().click();await until(async()=>!(await snap()).running);
 const turn=(await snap()).projection.turns.at(-1);assert.equal(turn.status,'completed',turn.error);assert(turn.items.some(v=>v.imageDelivery?.state==='received'));
 const text=turn.items.filter(v=>v.kind==='message'&&v.role==='assistant').at(-1).text,parsed=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));assert.deepEqual({code:parsed.code,redSquares:parsed.redSquares,blueCircles:parsed.blueCircles,redPosition:parsed.redPosition,bluePosition:parsed.bluePosition},answer);
 assert((await app.evaluate(()=>globalThis.sentImages)).some(r=>r.count>0&&r.status===200));const updated=native();assert(updated.subarray(0,old.length).equals(old));assert(updated.toString().includes('xiaozhi.education.public-image.v1'));check('Same old conversation now confirms once, genuinely sends image to DeepSeek and returns exact random code/colors/counts/positions without deleting old replies');
 await page.screenshot({path:path.join(output,'upgraded-answer.png')});report.success=true;
}catch(error){report.error=String(error.stack||error).replaceAll(key,'[credential]');process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
