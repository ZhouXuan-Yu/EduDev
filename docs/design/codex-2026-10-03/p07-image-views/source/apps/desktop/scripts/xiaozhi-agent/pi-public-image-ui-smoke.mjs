// Reuses the accepted attachment/OCR Electron UI harness; exercises the formal public image path.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {buildSync} from 'esbuild';
import {fileURLToPath} from 'node:url';
const contract=buildSync({entryPoints:['src/shared/xiaozhi-public-images.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {PUBLIC_IMAGE_APPROVE,PUBLIC_IMAGE_REJECT}=await import('data:text/javascript;base64,'+Buffer.from(contract.outputFiles[0].text).toString('base64'));
const views=process.argv.includes('--views');
const desktop=process.cwd(),buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||`test-results/xiaozhi-agent/${views?'pi-image-views-build':'pi-public-image-build'}`);
assert(buildRoot.startsWith(path.join(desktop,'test-results')+path.sep)&&fs.existsSync(path.join(buildRoot,'main/index.js')));
const output=fs.mkdtempSync(path.resolve(`test-results/xiaozhi-agent/${views?'pi-image-views-ui':'pi-public-image-ui'}-`)),data=path.join(output,'data'),profile=path.join(output,'profile');
let oldSource,oldHash;if(process.argv[2]){oldSource=fs.realpathSync(process.argv[2]);assert(oldSource.startsWith(fs.realpathSync('test-results/xiaozhi-agent')+path.sep)&&path.basename(oldSource)==='data');oldHash=createHash('sha256').update(fs.readFileSync(path.join(oldSource,'app.db'))).digest('hex');fs.cpSync(oldSource,data,{recursive:true,force:false,errorOnExist:true});}
const fixture='test-results/xiaozhi-agent/pi-public-image-preflight-LanGoJ',image=path.join(output,'公开图表.png');fs.copyFileSync(path.join(fixture,'prompt-public-synthetic.png'),image);
const code=JSON.parse(JSON.parse(fs.readFileSync(path.join(fixture,'report.json'))).promptAnswer).code;
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const report={success:false,checks:[],boundary:'Formal isolated Electron/real original Pi/official DeepSeek/image utility/unchanged Pro source; only self-created public synthetic image. One supplier-error case is a declared transport fixture. No real profile, student raw images, installer or no-VPN acceptance.'};
const buildFiles=[];function collect(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())collect(file);else buildFiles.push({file:path.relative(buildRoot,file).replaceAll('\\','/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}}collect(buildRoot);buildFiles.sort((a,b)=>a.file.localeCompare(b.file));
report.build={root:buildRoot,files:buildFiles.length,sha256:createHash('sha256').update(JSON.stringify(buildFiles)).digest('hex')};report.scriptSha256=createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');report.layer='C: isolated formal Electron';report.humanAccepted=false;
if(views)report.previousFailures=fs.readdirSync('test-results/xiaozhi-agent',{withFileTypes:true}).filter(v=>v.isDirectory()&&v.name.startsWith('pi-image-views-ui-')&&v.name!==path.basename(output)).flatMap(v=>{const file=path.join('test-results/xiaozhi-agent',v.name,'report.json');if(!fs.existsSync(file))return[];const r=JSON.parse(fs.readFileSync(file));return r.success?[]:[{directory:v.name,checks:r.checks?.length??0,error:r.error,buildSha256:r.build?.sha256??null,sameBuild:r.build?.sha256===report.build.sha256?true:null}];});
const errors=[];let app,page,id,mainPid;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,timeout=150000){const end=Date.now()+timeout;let transient=0;while(Date.now()<end){try{if(await fn())return;}catch(error){if(!/Resulting promise was garbage collected/.test(String(error))||!mainPid||++transient>3)throw error;process.kill(mainPid,0);}await new Promise(r=>setTimeout(r,100));}throw new Error('Actual public image UI condition timed out');}
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
function native(){const binding=query('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0],bytes=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file));return {binding,bytes,rows:bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse)};}
const requests=()=>app.evaluate(()=>globalThis.imageRequests);
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[path.join(buildRoot,'main/index.js'),`--user-data-dir=${profile}`],env,timeout:60000});mainPid=await app.evaluate(()=>process.pid);page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());const actual=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(actual,id);else id=actual;
 await app.evaluate(()=>{
  globalThis.imageRequests=[];globalThis.failImageRequest=false;const original=globalThis.fetch;
  globalThis.fetch=async function(input,init){
   const url=typeof input==='string'?input:input?.url;let record;
   if(typeof url==='string'&&url.startsWith('https://api.deepseek.com/')&&url.endsWith('/chat/completions')&&typeof init?.body==='string'){
    const raw=JSON.parse(init.body),hash=process.getBuiltinModule('node:crypto').createHash;
    const images=[];for(const message of raw.messages||[])for(const part of Array.isArray(message.content)?message.content:[])if(part.type==='image_url'){
      const match=/^data:([^;]+);base64,(.+)$/.exec(part.image_url.url);images.push({role:message.role,mime:match?.[1],sha256:match&&hash('sha256').update(Buffer.from(match[2],'base64')).digest('hex')});}
    record={images,status:null,fixture:false};globalThis.imageRequests.push(record);
    if(globalThis.failImageRequest&&images.length){record.fixture=true;record.status=503;return new Response(JSON.stringify({error:{message:'Synthetic supplier unavailable',type:'server_error'}}),{status:503,headers:{'content-type':'application/json'}});}
   }
   const response=await original.apply(this,arguments);if(record)record.status=response.status;return response;
  };
 });
}
async function begin(prompt){const count=(await snap()).projection.turns.length;await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(async()=>(await snap()).projection.turns.length>count);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');}
async function complete(expect='completed'){await until(async()=>{const s=await snap(),t=s.projection.turns.at(-1);if(!s.running&&t?.status!==expect)throw new Error('Actual run status '+t?.status+': '+t?.error);return !s.running&&t?.status===expect;});return(await snap()).projection.turns.at(-1);}
async function question(){await until(async()=>{const s=await snap();if(!s.running)throw new Error('Run ended before public image confirmation: '+JSON.stringify(s.projection.turns.at(-1)).slice(0,1200));return s.controls?.some(c=>c.state==='pending'&&c.options?.includes(PUBLIC_IMAGE_APPROVE));});return (await snap()).controls.find(c=>c.state==='pending'&&c.options?.includes(PUBLIC_IMAGE_APPROVE));}
async function answer(value){const index=value===PUBLIC_IMAGE_APPROVE?0:1;await page.getByTestId(`pi-question-option-${index}`).last().click();await page.getByTestId('pi-question-submit').last().click();}
const turnElement=turn=>page.locator(`.office-turn[data-turn-id="${turn.id}"]`);
async function inspectViews(turn,count,names){
 const summary=turnElement(turn).getByTestId('pi-image-views');assert.equal(await summary.count(),1);assert.equal(await summary.getAttribute('data-viewed-count'),String(count));
 await summary.locator('button').first().click();const attachments=summary.getByTestId('pi-viewed-image-attachments');
 await until(async()=>await attachments.locator('img').evaluateAll((nodes,expected)=>nodes.length===expected&&nodes.every(n=>n.complete&&n.naturalWidth>0),count));
 const before=(await requests()).length;for(const name of names){await attachments.getByRole('button',{name:`预览附件 ${name}`,exact:true}).click();await until(async()=>await page.getByTestId('pi-attachment-image').evaluate(n=>n.complete&&n.naturalWidth>0));await page.getByTestId('pi-attachment-preview-close').click();}
 assert.equal((await requests()).length,before);
 for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);await summary.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`viewed-${count}-${width}.png`)});}
}
const again='请这次实际重新查看之前的公开图表.png，需要重新获得本轮用途确认。不要复用上次答案或假称已查看。确认后报告图内核验码及图形数量。';
try{
 await launch();await begin('合成连接验收，只回复连接正常，不读取附件。');await complete();const old=native();
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},image);await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());
 const before=(await requests()).length;
 await begin('请先简短说明核对步骤，再实际查看刚发的公开图表.png。核验码必须按图中字母数字逐字准确抄录，检查到最末一位，不省略字符；报告红色方块数量、蓝色圆形数量和左右位置。不要从文件名或旧答案猜测。确认用途后，最后仅输出JSON对象，字段code、redSquares、blueCircles、redPosition和bluePosition（left/right）、source（资料标题）。');
 const pending=await question();assert(pending.text.includes('公开资料')&&pending.text.includes('不含学生信息')&&pending.text.includes('公开图表.png'));
 if(views)assert.equal(await turnElement((await snap()).projection.turns.at(-1)).getByTestId('pi-image-views').count(),0);
 assert((await requests()).slice(before).every(r=>r.images.length===0));assert(!native().rows.slice(old.rows.length).some(r=>r.message?.content?.some(v=>v.type==='image')));check('Natural teacher prompt selects real image tool and visible explicit public-purpose confirmation; no image is transmitted before the teacher answers');
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);const submit=page.getByTestId('pi-question-submit').last();await submit.scrollIntoViewIfNeeded();
  const bounds=await submit.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight};});assert(bounds.top>=0&&bounds.bottom<=bounds.height&&bounds.left>=0&&bounds.right<=bounds.width);
  await page.screenshot({path:path.join(output,`question-${width}.png`)});check(`Original HeroUI question and send-answer controls remain reachable at ${width}x${height}`);
 }
 await answer(PUBLIC_IMAGE_APPROVE);const turn=await complete();
 const received=turn.items.filter(v=>v.imageDelivery?.state==='received');assert.equal(received.length,1);assert.equal(received[0].sources[0].title,'公开图表.png');
 const content=turn.items.filter(v=>v.kind==='message'&&v.role==='assistant').at(-1).text;const match=content.slice(content.indexOf('{'),content.lastIndexOf('}')+1);const parsed=JSON.parse(match);report.visualAnswer=parsed;assert.equal(parsed.code,code);assert.equal(parsed.redSquares,3);assert.equal(parsed.blueCircles,2);assert.equal(parsed.redPosition,'left');assert.equal(parsed.bluePosition,'right');assert.equal(parsed.source,'公开图表.png');
 const sent=(await requests()).slice(before).filter(r=>r.images.length);assert(sent.length&&sent.every(r=>r.status===200&&r.images.every(v=>v.role==='user')));report.transports=sent;
 const actual=native();assert(actual.bytes.subarray(0,old.bytes.length).equals(old.bytes));assert.equal(actual.binding.session_file,old.binding.session_file);const imageResult=actual.rows.slice(old.rows.length).find(r=>r.message?.role==='toolResult'&&r.message.toolName==='office_view_public_image'&&!r.message.isError);assert(imageResult?.message.content.some(v=>v.type==='image'));
 assert(turn.items.filter(v=>v.kind==='message'&&v.role==='assistant').length>=2);check('Formal original Pi/official DeepSeek image request returns exact visual code/counts/positions, genuine received source and segmented public explanation while preserving original native prefix');
 if(views){assert.deepEqual(received[0].imageDelivery.attachment,{id:turn.items[0].attachments[0].id,revision:turn.items[0].attachments[0].revision,version:turn.items[0].attachments[0].version});await inspectViews(turn,1,['公开图表.png']);check('Exact received version yields one original Pro viewed-image disclosure, real local thumbnail/Modal and zero extra model requests at both native sizes');}
 const count=(await requests()).length;await begin(again);await question();assert((await requests()).slice(count).every(r=>r.images.length===0));await answer(PUBLIC_IMAGE_REJECT);const declined=await complete();assert(!declined.items.some(v=>v.imageDelivery?.state==='received'));assert((await requests()).slice(count).every(r=>r.images.length===0));check('New run strips prior raw image and visible teacher rejection makes zero image requests or received receipt');
 if(views){assert.equal(await turnElement(declined).getByTestId('pi-image-views').count(),0);check('Visible rejected run never inherits an earlier viewed-image count');}
 const saved=native(),savedTurn=(await snap()).projection.turns.find(v=>v.id===turn.id);await app.close();app=undefined;fs.unlinkSync(image);await launch();assert(native().bytes.equals(saved.bytes));assert.deepEqual((await snap()).projection.turns.find(v=>v.id===turn.id).items.filter(v=>v.imageDelivery),savedTurn.items.filter(v=>v.imageDelivery));
 if(views){await inspectViews(savedTurn,1,['公开图表.png']);assert((await requests()).every(r=>!r.images.length));check('Cold restored received-image count/thumbnail/local preview survive deleted original without another provider request');}
 await begin(again);await question();assert((await requests()).every(r=>r.images.length===0));await answer(PUBLIC_IMAGE_APPROVE);const restarted=await complete();assert(restarted.items.some(v=>v.imageDelivery?.state==='received'));assert((await requests()).some(r=>r.images.length&&r.status===200));check('Cold formal application preserves original image body/receipt without replay; deleted original uses captured copy and requires a new confirmation before genuine delivery');
 const stopBefore=(await requests()).length;await begin(again);const stopQuestion=await question();await page.getByRole('button',{name:'停止本轮',exact:true}).click();await complete('interrupted');assert((await requests()).slice(stopBefore).every(r=>r.images.length===0));assert(!(await snap()).controls.find(c=>c.id===stopQuestion.id)?.canResume);check('Stopping the actual question sends no image and cannot resume the stopped upload');
 await app.evaluate(()=>{
  const require=process.getBuiltinModule('node:module').createRequire(process.cwd()+'/package.json'),up=require('electron').utilityProcess,original=up.fork;
  globalThis.modelUtilityReady=0;globalThis.modelUtilityExited=0;
  up.fork=function(...args){const child=original.apply(this,args);if(args[2]?.serviceName==='小智公开图片准备'){
   const emit=child.emit;child.emit=function(event,...values){if(event==='message'){globalThis.modelUtilityReady++;return false;}return emit.call(this,event,...values);};child.on('exit',()=>globalThis.modelUtilityExited++);
  }return child;};
 });
 const utilityBefore=(await requests()).length;await begin(again);await question();await answer(PUBLIC_IMAGE_APPROVE);await until(async()=>await app.evaluate(()=>globalThis.modelUtilityReady>0));await page.getByRole('button',{name:'停止本轮',exact:true}).click();await complete('interrupted');await until(async()=>await app.evaluate(()=>globalThis.modelUtilityExited>0));assert((await requests()).slice(utilityBefore).every(r=>r.images.length===0));check('Stop while the real image utility has produced bytes exits the owned child and suppresses late preparation/transport');
 // Cold restart removes only test instrumentation; production capture and native remain.
 await app.close();app=undefined;await launch();await app.evaluate(()=>{globalThis.failImageRequest=true;});await begin(again);await question();await answer(PUBLIC_IMAGE_APPROVE);const failed=await complete('failed');assert(!failed.items.some(v=>v.imageDelivery?.state==='received'));assert(failed.items.some(v=>v.imageDelivery?.state==='failed'));assert((await requests()).some(r=>r.fixture&&r.status===503));check('Declared supplier-error transport fixture marks the formal delivery failed, with no false received receipt');
 if(views){assert.equal(await turnElement(failed).getByTestId('pi-image-views').count(),0);await app.evaluate(()=>{globalThis.failImageRequest=false;});
  const second=path.join(output,'公开二图.png');fs.copyFileSync(path.join(fixture,'tool-public-synthetic.png'),second);await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},second);await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());
  await begin('本轮请实际分别查看公开图表.png和刚发的公开二图.png，两份均为公开合成资料。按工具用途卡分别等待我的确认后再查看，不复用旧结论。请逐字复核图中完整验证码到末位，最后仅输出JSON数组，每项name为标题、code为图中文字、redSquares和blueCircles为图形整数数量、redPosition与bluePosition为left/right。');
  for(let i=0;i<2;i++){await question();await answer(PUBLIC_IMAGE_APPROVE);}const multiple=await complete();await inspectViews(multiple,2,['公开图表.png','公开二图.png']);
  const text=multiple.items.filter(v=>v.role==='assistant').at(-1).text,answers=JSON.parse(text.slice(text.indexOf('['),text.lastIndexOf(']')+1));assert.equal(answers.length,2);
  const secondCode=JSON.parse(JSON.parse(fs.readFileSync(path.join(fixture,'report.json'))).toolAnswer).code;for(const [name,expected]of [['公开图表.png',code],['公开二图.png',secondCode]]){const a=answers.find(v=>v.name===name);assert(a);assert.equal(a.code,expected);assert.equal(a.redSquares,3);assert.equal(a.blueCircles,2);assert.equal(a.redPosition,'left');assert.equal(a.bluePosition,'right');}
  check('Two independently confirmed genuine image inputs yield an exact count of two and separately openable original Pro thumbnails with strict visual answers');
 }
 for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);const group=page.getByTestId('office-tool-group').filter({has:page.getByTestId('pi-image-delivery')}).last();if(await group.count()){const trigger=group.locator('button').first();if(await trigger.getAttribute('aria-expanded')==='false')await trigger.click();}await page.screenshot({path:path.join(output,`receipt-${width}.png`)});check(`Actual ${width}x${height} original tool/source and truthful error receipt renders`);}
 assert.equal(errors.length,0);assert.equal(native().rows.filter(r=>r.type==='custom'&&r.customType==='xiaozhi.education.public-image.v1').length,1);check('No renderer errors or duplicate native image capability identity');
 if(oldSource){assert.equal(createHash('sha256').update(fs.readFileSync(path.join(oldSource,'app.db'))).digest('hex'),oldHash);check('Original old-Pi test database remains byte-identical');}report.success=true;
}catch(error){report.error=String(error.stack||error).replaceAll(key,'[REDACTED]').slice(0,2800);process.exitCode=1;report.transports=await requests().catch(()=>[]);await page?.screenshot({path:path.join(output,'failed.png')}).catch(()=>undefined);}
finally{report.rendererErrors=errors;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await app?.close();console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
