import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
const desktop=process.cwd(),buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'test-results/xiaozhi-agent/pi-attachment-read-build');
assert(buildRoot.startsWith(path.join(desktop,'test-results')+path.sep));assert(fs.existsSync(path.join(buildRoot,'main/index.js')));
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-attachment-read-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile'),sources=path.join(output,'sources');
let oldSource,oldHash;
if(process.argv[2]){oldSource=fs.realpathSync(process.argv[2]);const base=fs.realpathSync('test-results/xiaozhi-agent');assert(oldSource.startsWith(base+path.sep)&&path.basename(oldSource)==='data');
 oldHash=createHash('sha256').update(fs.readFileSync(path.join(oldSource,'app.db'))).digest('hex');fs.cpSync(oldSource,data,{recursive:true,force:false,errorOnExist:true});}
const marker=`READ-${randomUUID()}`,student=`合成学生${randomUUID().slice(0,8)}`;
const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const generated=spawnSync(python,['scripts/xiaozhi-agent/make-office-fixtures.py',sources,marker,student],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
const text=path.join(sources,'必要摘要.txt');fs.writeFileSync(text,`只在本地附件中的核验码${marker}\n课堂37分钟\n练习8道\n学生${student} 电话18012345678 邮箱edu-fixture@example.invalid\n未请求尾行`);
const image=path.join(sources,'公开合成图.png');fs.copyFileSync('scripts/xiaozhi-agent/fixtures/attachment-rgb.png',image);
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const names=['必要摘要.txt','备课.docx','教研.xlsx','课件.pptx','讲义.pdf'];
const report={success:false,checks:[],boundaries:['Actual formal isolated Electron/DeepSeek/Pi/Hana AnyDoc utility and native SQLite; native picker output controlled only in owned main','Synthetic necessary excerpts redacted; no teacher or student original input','Text/Office read only; image and scanned PDF are not claimed viewed. Original user PID untouched.']};
const errors=[];let app,page,id,mainPid;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,timeout=150000){const end=Date.now()+timeout;let transient=0;while(Date.now()<end){
 try{if(await fn())return;}catch(error){
  // Re-poll this exact live main after an observation error; never restart on a timeout/GC reply.
  if(!/Resulting promise was garbage collected/.test(String(error))||!mainPid||++transient>3)throw error;
  process.kill(mainPid,0);
 }
 await new Promise(r=>setTimeout(r,100));}throw new Error('Attachment actual UI condition timed out');}
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
function native(){const binding=query('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0];const file=path.join(data,'xiaozhi-pi',binding.session_file),bytes=fs.readFileSync(file);return {bytes,rows:bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse),binding};}
const results=()=>native().rows.filter(row=>row.message?.role==='toolResult'&&row.message.toolName==='office_read_attachment');
const payload=row=>{try{return JSON.parse(row.message.content.filter(x=>x.type==='text').map(x=>x.text).join(''));}catch{return undefined;}};
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[path.join(buildRoot,'main/index.js'),`--user-data-dir=${profile}`],env,timeout:60000});mainPid=await app.evaluate(()=>process.pid);page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const actual=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(actual,id);else id=actual;
}
async function choose(files){await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},files);
 await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());}
async function begin(prompt){const before=(await snap()).projection.turns.length;await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(async()=>{const s=await snap();return s.projection.turns.length>before;});assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');}
async function complete(){await until(async()=>{const s=await snap(),last=s.projection.turns.at(-1);if(!s.running&&last?.status==='failed')throw new Error('Actual provider run failed: '+last.error);return !s.running&&last?.status==='completed';});return (await snap()).projection.turns.at(-1);}
async function send(prompt){await begin(prompt);return complete();}
try{
 await launch();await send('合成连接验收：只回复连接正常，不读取附件。');const old=native();
 await page.evaluate(name=>window.omniEdu.createStudent({displayName:'合成测试别名',realName:name}),student);
 await choose(names.map(name=>path.join(sources,name)));assert.equal(query("SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=? AND state='draft'",[id]).length,5);
 check('Teacher selects five real directory-external text/Office files from the visible attachment button with original workspace binding unchanged');
 const turn=await send('请先简短说明要核对的资料，再实际逐份读取我刚发送的必要摘要.txt、备课.docx、教研.xlsx、课件.pptx、讲义.pdf。分别报告附件中课堂时长、练习数量和原文核验码，引用真实标题及提取行范围。不要猜内容，也不要读取或复述学生姓名、电话、邮箱；不修改文件。');
 const successful=results().map(payload).filter(x=>x?.success);for(const format of ['text','docx','xlsx','pptx','pdf'])assert(successful.some(x=>x.format===format&&x.text.includes(marker)),`Actual ${format} body absent`);
 const first=native();assert(first.bytes.subarray(0,old.bytes.length).equals(old.bytes));assert.equal(first.binding.session_file,old.binding.session_file);
 check('Natural official DeepSeek task actually reads all five captured formats through Pi tools and the existing Hana local parser, preserving old native prefix');
 for(const x of successful){assert(x.text.length<=16000);assert(/^[a-f0-9]{64}$/.test(x.source.version));assert(x.citation.includes('行'));assert(!x.text.includes(student)&&!x.text.includes('18012345678')&&!x.text.includes('edu-fixture@example.invalid'));}
 assert(successful.some(x=>x.text.includes('[学生姓名]')));check('Actual native model tool results contain bounded necessary body/source version and redaction, never known student/phone/email');
 const final=turn.items.filter(x=>x.kind==='message'&&x.role==='assistant').at(-1).text;assert(final.includes(marker)&&final.includes('37')&&final.includes('8'));
 for(const name of names)assert(final.includes(name));assert(!JSON.stringify(turn).includes(student)&&!JSON.stringify(turn).includes(data));
 check('Actual final answer uses the file-only random verification code, factual numbers and titles; public process exposes no captured path or student identity');
 const actualReadIds=new Set(results().map(row=>row.message.toolCallId));
 const readTools=turn.items.filter(x=>x.kind==='tool'&&actualReadIds.has(x.id));assert(readTools.length>=5);assert(readTools.every(x=>x.label==='读取已发送附件'&&x.status==='completed'&&x.sources?.length));
 const firstTool=turn.items.findIndex(x=>x.kind==='tool'),lastTool=turn.items.findLastIndex(x=>x.kind==='tool');assert(turn.items.slice(0,firstTool).some(x=>x.role==='assistant'));assert(turn.items.slice(lastTool+1).some(x=>x.role==='assistant'));
 assert(!turn.items.filter(x=>x.role==='assistant').some(x=>/\b(?:revision|attachmentId|schemaVersion)\b|按\s*ID[\/、]/i.test(x.text)));
 check('Original Pro process rows carry actual Chinese read labels, real source receipts and public segments before/after tools');
 for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  await page.getByRole('button',{name:'预览附件 必要摘要.txt',exact:true}).click();await page.getByTestId('pi-attachment-preview').waitFor();await until(async()=>!await page.getByTestId('pi-attachment-preview').locator('[role="status"]').count());assert((await page.getByTestId('pi-attachment-preview').innerText()).includes(marker));
  await page.waitForFunction(()=>{const modal=document.querySelector('[data-testid="pi-attachment-preview"]');if(!modal)return false;
    for(let node=modal;node;node=node.parentElement){if(Number(getComputedStyle(node).opacity)<.99||node.getAnimations().some(a=>a.playState==='running'))return false;}return true;});
  await page.screenshot({path:path.join(output,`read-${width}.png`)});await page.getByTestId('pi-attachment-preview-close').click();const box=await page.getByTestId('office-prompt-input').boundingBox();assert(box.y+box.height<=height);
  check(`Actual ${width}x${height} original attachment history, local preview and composer remain reachable`);
 }
 const beforeRange=results().length;await send('现在只实际读取已发送的必要摘要.txt文本第2至3行，按这一范围引用，不重读全文，也不要读取其他附件。');
 const range=results().slice(beforeRange).map(payload).find(x=>x?.success);assert.equal(range.source.locator.start,2);assert.equal(range.source.locator.end,3);assert(range.text.includes('37')&&range.text.includes('8')&&!range.text.includes(marker));check('Same native conversation supports actual bounded follow-up lines 2–3');
 const saved=native();await app.close();app=undefined;for(const name of names)fs.unlinkSync(path.join(sources,name));await launch();assert(native().bytes.equals(saved.bytes));
 const beforeResume=results().length;await send('继续核对之前已发送的备课.docx，实际重新读取正文，报告核验码与课堂时长，并引用来源。');
 assert(results().slice(beforeResume).map(payload).some(x=>x?.success&&x.text.includes(marker)));check('Actual cold restart preserves native bytes and successfully rereads the captured old attachment after original files are deleted');
 await choose([image,path.join(sources,'扫描.pdf')]);const beforeUnsupported=results().length;
 await send('分别实际尝试读取我刚发送的公开合成图.png和扫描.pdf，只根据读取回执解释能否取得正文；如需OCR请如实说明，不要猜颜色或文字。');
 const unsupported=results().slice(beforeUnsupported);assert(unsupported.length>=2&&unsupported.every(x=>x.message.isError));assert(unsupported.every(x=>!JSON.stringify(x.message.content).includes('base64')));check('Image/scanned PDF yield actual failed read/OCR guidance without image upload or fake viewed receipt');
 await app.evaluate(({utilityProcess})=>{globalThis.readWorkerStarts=0;globalThis.readWorkerExits=0;const original=utilityProcess.fork.bind(utilityProcess);utilityProcess.fork=(...args)=>{const child=original(...args);if(String(args[0]).endsWith('document-worker.js')){globalThis.readWorkerStarts++;child.on('exit',()=>globalThis.readWorkerExits++);child.postMessage=()=>{};}return child;};});
 const beforeStop=results().length;await begin('请再次实际读取此前发送的教研.xlsx，核对课堂时长。');await until(async()=>await app.evaluate(()=>globalThis.readWorkerStarts>0));
 await page.getByRole('button',{name:'停止本轮',exact:true}).click();await until(async()=>!(await snap()).running);await until(async()=>await app.evaluate(()=>globalThis.readWorkerExits===globalThis.readWorkerStarts));
 assert(results().slice(beforeStop).every(row=>row.message.isError));assert.equal((await snap()).projection.turns.at(-1).status,'interrupted');check('Stop during actual native document worker exits the owned parser and produces no late successful body');
 assert.equal(errors.length,0);assert.equal(native().rows.filter(row=>row.type==='custom'&&row.customType==='xiaozhi.education.attachment-read.v1').length,1);check('No renderer errors or duplicate additive native attachment capability identity');
 if(oldSource){assert.equal(createHash('sha256').update(fs.readFileSync(path.join(oldSource,'app.db'))).digest('hex'),oldHash);check('Original completed Pi0.80.3 fixture DB is unchanged while its isolated native conversation runs the new attachment tools');}
 report.success=true;
}catch(error){report.error=String(error.stack||error).slice(0,2400);throw error;}
finally{if(app)await app.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,success:report.success,checks:report.checks.length}));}
