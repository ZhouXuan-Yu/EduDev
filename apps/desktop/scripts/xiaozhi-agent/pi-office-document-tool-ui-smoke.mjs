import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-office-tool-ui-'));
const workspace=path.join(output,'教研目录'),data=path.join(output,'data'),marker=`DOC-${randomUUID()}`,studentName=`合成学生${randomUUID().slice(0,8)}`;
const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const generator=spawnSync(python,[path.join(desktop,'scripts/xiaozhi-agent/make-office-fixtures.py'),workspace,marker,studentName],{encoding:'utf8'});assert.equal(generator.status,0,generator.stderr);
const facts=JSON.parse(fs.readFileSync(path.join(workspace,'fixture-facts.json'),'utf8'));
const bulk=path.join(workspace,'批量资料');fs.mkdirSync(bulk);for(let i=0;i<300;i++)fs.writeFileSync(path.join(bulk,`a-${String(i).padStart(3,'0')}.txt`),'synthetic');fs.copyFileSync(path.join(workspace,'备课.docx'),path.join(bulk,'目标.docx'));facts.hashes['批量资料/目标.docx']=facts.hashes['备课.docx'];
fs.closeSync(fs.openSync(path.join(workspace,'超大.docx'),'w'));fs.truncateSync(path.join(workspace,'超大.docx'),50*1024*1024+1);
const cfg=fs.readFileSync(path.join(desktop,'.env.local'),'utf8'),pick=name=>cfg.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`,'m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const key=process.env.DEEPSEEK_API_KEY||pick('DEEPSEEK_API_KEY'),model=process.env.DEEPSEEK_MODEL||pick('DEEPSEEK_MODEL');assert(key&&model);
const checks=[],report={success:false,checks,boundaries:['Actual Electron/natural teacher tasks/DeepSeek/Pi native Office tool/utility/file provenance','Synthetic known student name, phone and email only; no original teacher or student data','No export or original page position claim; marker and private JSONL asserted locally but never archived']};let app,page,session;
const errors=[];const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(name,fn=()=>{})=>{fn();checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,timeout=150000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Office tool instance timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
function native(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const binding=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);const file=path.join(data,'xiaozhi-pi',binding.session_file),bytes=fs.readFileSync(file);return {file,bytes,rows:bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse)};}finally{db.close();}}
const results=n=>n.rows.filter(row=>row.message?.role==='toolResult'&&row.message.toolName==='office_read_document');
function payload(row){try{return JSON.parse(row.message.content.filter(x=>x.type==='text').map(x=>x.text).join(''));}catch{return undefined;}}
async function send(prompt){const input=page.getByTestId('office-prompt-input');await input.fill(prompt);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();assert.equal(await input.inputValue(),'');}
async function completed(){await until(async()=>{const s=await snapshot();if(!s.running&&s.projection.turns.at(-1)?.status==='failed')throw new Error(`Provider run failed: ${s.projection.turns.at(-1).error}`);return !s.running&&s.projection.turns.at(-1)?.status==='completed';});return (await snapshot()).projection.turns.at(-1);}
try{
  await launch();await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-error').waitFor();await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},workspace);
  await page.getByTestId('pi-files-choose').click();await page.getByTestId('pi-file-entry-备课.docx').waitFor();
  await page.evaluate(name=>window.omniEdu.createStudent({displayName:'合成测试别名',realName:name}),studentName);
  check('Teacher grants owned synthetic directory and known student fixture through typed application APIs');
  await send('请先简短说明准备核对哪些资料，再实际分别读取备课.docx、教研.xlsx、课件.pptx、讲义.pdf，逐份核对课堂时长和练习数量，最后按文件列出数字并汇总。引用各文件真实标题和提取正文行范围。只需教学内容，不需要学生姓名、电话或邮箱；不要修改文件。');
  const turn=await completed(),first=native(),read=results(first).map(payload).filter(x=>x?.success);
  for(const format of ['docx','xlsx','pptx','pdf'])assert(read.some(x=>x.format===format&&x.text.includes(marker)),`Missing real ${format} tool receipt`);
  check('Natural real DeepSeek task uses native Office tools for all four actual formats');
  const doc=read.find(x=>x.format==='docx');assert(doc.text.includes('[学生姓名]')&&doc.text.includes('[手机号]')&&doc.text.includes('[邮箱]'));
  for(const row of results(first)){const content=JSON.stringify(row.message.content);assert(!content.includes(studentName)&&!content.includes('18012345678')&&!content.includes('edu-fixture@example.invalid'));}
  check('Actual model tool-result history contains the necessary redacted body, never synthetic known name/phone/email');
  for(const x of read){assert.equal(x.source.originalPageLocated,false);assert.equal(x.source.locator.kind,'extracted_lines');assert(/^[a-f0-9]{64}$/.test(x.source.version));assert(x.citation.includes('原页码未定位'));assert(x.text.length<=16000);}
  check('Actual source identities and extracted-line ranges are explicit; no fabricated original page index');
  const titles=turn.items.flatMap(item=>item.sources||[]).map(x=>x.title);assert(titles.some(x=>x.includes('备课.docx')&&x.includes('提取正文')));
  check('Public original tool source rows are populated from actual safe receipts');
  const firstTool=turn.items.findIndex(x=>x.kind==='tool'),lastTool=turn.items.findLastIndex(x=>x.kind==='tool');
  assert(turn.items.slice(0,firstTool).some(x=>x.kind==='message'&&x.role==='assistant'));assert(turn.items.slice(lastTool+1).some(x=>x.kind==='message'&&x.role==='assistant'));
  check('Public explanation, real tools and subsequent response remain separate actual segments');
  const final=turn.items.filter(x=>x.kind==='message'&&x.role==='assistant').at(-1).text;assert(final.includes('37')&&final.includes('8')&&final.includes('备课.docx'));
  check('Teacher sees factual numeric summary and actual document titles');
  for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    await page.getByTestId('pi-file-entry-备课.docx').click();await until(async()=>await page.getByTestId('pi-file-preview').getAttribute('aria-busy')==='false');assert((await page.getByTestId('pi-file-preview').innerText()).includes(marker));
    const input=await page.getByTestId('office-prompt-input').boundingBox();assert(input.y+input.height<=height);await page.screenshot({path:path.join(output,`tool-${width}x${height}.png`)});check(`Actual ${width}x${height} public sources and local document comparison are reachable`);
  }
  const identities=first.rows.filter(row=>row.type==='custom'&&/^xiaozhi\.education\.(snapshot|office-document)/.test(row.customType));assert.equal(identities.filter(row=>row.customType==='xiaozhi.education.office-document.v1').length,1);
  await send('继续用同一个会话，实际只读取备课.docx的提取正文第2至3行，用这一范围的真实来源引用回答，不要整份重读。');await completed();const second=native();assert(second.bytes.subarray(0,first.bytes.length).equals(first.bytes));assert.deepEqual(second.rows.filter(row=>row.type==='custom'&&/^xiaozhi\.education\.(snapshot|office-document)/.test(row.customType)),identities);
  const range=results(second).slice(results(first).length).map(payload).find(x=>x?.success);assert.equal(range.source.locator.start,2);assert.equal(range.source.locator.end,3);
  check('Same native history is appended without changing original identities; real bounded follow-up reads lines 2–3');
  const bulkBefore=results(native()).length;
  await send('我明确指定文件批量资料/目标.docx，请直接实际读取并告诉我课堂时长和练习数量，不需要列出这个目录的其他文件。引用该文件真实相对路径和提取正文行范围。');await completed();const bulkRead=results(native()).slice(bulkBefore).map(payload).find(x=>x?.success);assert(bulkRead&&bulkRead.text.includes(marker));assert.equal(bulkRead.source.title,'批量资料/目标.docx');
  check('Actual natural task reads explicit Office path in a 300-file directory and cites its unambiguous safe relative source');
  await send('实际读取扫描.pdf，严格根据工具回执说明能否读到正文；如果需要OCR请如实说明，不能猜内容。');const scan=await completed();assert(results(native()).at(-1).message.isError);assert(scan.items.some(x=>x.kind==='tool'&&x.status==='failed'));assert(scan.items.filter(x=>x.role==='assistant').at(-1).text.includes('OCR'));
  check('Natural scanned-PDF task produces real failed tool and truthful local OCR guidance');
  const failureBefore=results(native()).length;
  await send('请分别实际尝试读取损坏.docx、缺文字映射.pdf、超大.docx，逐份报告工具是否读到有效正文，只根据真实回执回答，不要猜内容或改文件。');const failures=await completed();const failedReads=results(native()).slice(failureBefore);assert.equal(failedReads.length,3);assert(failedReads.every(row=>row.message.isError));
  assert(failures.items.filter(item=>item.kind==='tool'&&item.status==='failed').length>=3);check('Natural real provider tasks expose damaged, undecodable and oversize document failures without fake body');
  await app.evaluate(({utilityProcess})=>{globalThis.heldDocumentStarts=0;globalThis.heldDocumentExits=0;const fork=utilityProcess.fork.bind(utilityProcess);utilityProcess.fork=(...args)=>{const child=fork(...args);if(String(args[0]).endsWith('document-worker.js')){if(Object.keys(args[2].env).some(key=>/KEY|TOKEN|SECRET/i.test(key)))throw new Error('Worker credential propagation');globalThis.heldDocumentStarts++;child.on('exit',()=>globalThis.heldDocumentExits++);child.postMessage=()=>{};}return child;};});
  await send('请重新实际读取教研.xlsx并核对课时，按工具结果回答。');await until(async()=>await app.evaluate(()=>globalThis.heldDocumentStarts>0));
  const sources=await page.evaluate(async id=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${crypto.randomUUID()}`,path:'.'}),session);assert(sources.ok);const inputDoc=sources.data.entries.find(x=>x.name==='备课.docx');
  const previewRequests=Array.from({length:8},()=>({schemaVersion:'xiaozhi.files.v1',sessionId:session,requestId:`xifile_${randomUUID()}`,path:inputDoc.path,version:inputDoc.version,workspaceVersion:sources.workspaceVersion}));
  await page.evaluate(inputs=>{globalThis.previewResults=[];globalThis.previews=inputs.map(input=>window.omniEdu.previewXiaozhiFile(input).then(value=>{globalThis.previewResults.push(value);return value;}));},previewRequests);
  await until(async()=>await page.evaluate(()=>globalThis.previewResults.some(value=>!value.ok&&value.error==='busy')));assert.equal(await app.evaluate(()=>globalThis.heldDocumentStarts),8);
  check('Actual model read plus previews share the 8-native-worker cap; excess preview reports busy and no API credential reaches worker');
  await page.locator('.office-composer [data-slot="prompt-input-send"]').click();await until(async()=>!(await snapshot()).running);
  await page.evaluate(async inputs=>{await Promise.all(inputs.map(input=>window.omniEdu.cancelXiaozhiFile({sessionId:input.sessionId,requestId:input.requestId})));await Promise.all(globalThis.previews);},previewRequests);
  await until(async()=>await app.evaluate(()=>globalThis.heldDocumentExits===globalThis.heldDocumentStarts));
  assert.equal((await snapshot()).projection.turns.at(-1).status,'interrupted');check('Composer stop cancels an actual read utility and prevents late model continuation (dispatch held by test)');
  for(const [name,expected]of Object.entries(facts.hashes))assert.equal(hash(fs.readFileSync(path.join(workspace,name))),expected);check('All actual source bytes remain unchanged across successful and stopped agent tasks');
  assert.deepEqual(errors,[]);await app.close();app=undefined;await launch();assert.equal((await snapshot()).projection.turns.at(-1).status,'interrupted');
  await send('继续核对教研.xlsx，请实际读取并告诉我课时和练习数量，不要修改文件。');await completed();assert(results(native()).at(-1).message.isError!==true);
  check('App restart restores native history and next actual Office read; no interrupted task replay');
  report.success=true;
}catch(error){report.error=String(error.stack||error);console.error(report.error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`REPORT ${output}`);}
