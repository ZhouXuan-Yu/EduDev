import '../office-agent/register-source.mjs';
import {presentationFixture} from './presentation-fixture.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-request-continuity-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const controlFile=path.join(output,'control.json'),wireFile=path.join(output,'wire.json'),bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`globalThis.continuityFs=require('node:fs');import(${JSON.stringify(pathToFileURL(path.join(desktop,'out/main/index.js')).href)});`);
const control=patch=>{const value=fs.existsSync(controlFile)?JSON.parse(fs.readFileSync(controlFile,'utf8')):{};fs.writeFileSync(controlFile+'.tmp',JSON.stringify({...value,...patch}));fs.renameSync(controlFile+'.tmp',controlFile);};control({phase:'intent'});
const html='<!doctype html><html lang="zh-CN"><title>浮力演示</title><body><h1>原始演示</h1><label>载荷<input id="load" type="range" min="0" max="5" value="0"></label><output id="force">6 N</output><script>load.oninput=()=>force.textContent=(6+Number(load.value))+" N";</script></body></html>';
const report={ok:false,checks:[],errors:[],boundary:'Actual formal Electron UI/Pi/task journal/approvals and real HTML/PPT revisions, synthetic SSE only. No natural reasoning-quality, Office/WPS rendering, daily runtime or full E03 AT acceptance.'};
let application,page,id;
const check=name=>{report.checks.push(name);console.log('PASS '+name);},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const query=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const until=async(fn,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,80));}throw Error('Continuity operation timed out');};
const wires=()=>JSON.parse(fs.readFileSync(wireFile,'utf8'));
async function ready(){await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled()&&!await page.getByTestId('pi-thinking-session-trigger').isDisabled());}
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 application=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});fs.writeFileSync(wireFile,'[]');
 await application.evaluate(({net},fixture)=>{
  const {wireFile,controlFile,html,draft}=fixture,fs=globalThis.continuityFs,state=globalThis.continuityFixture={steps:{},requests:[],blocked:[]};
  const text=body=>body.messages.map(m=>typeof m.content==='string'?m.content:(m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')).join('\n');
  const lastTool=body=>{const m=body.messages.filter(m=>m.role==='tool').at(-1),raw=typeof m.content==='string'?m.content:m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');for(const line of raw.split('\n')){try{const value=JSON.parse(line);if(value&&typeof value==='object'&&'success'in value)return value;}catch{}}throw Error('Synthetic reader did not recognize actual tool result');};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('External network disabled');}
   const settings=JSON.parse(fs.readFileSync(controlFile,'utf8')),phase=settings.phase,stage=state.steps[phase]||0;state.steps[phase]=stage+1;if(stage>8)throw Error('Synthetic phase exhausted');
   const body=JSON.parse(init.body),context=text(body),version=Number([...context.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);let call;
   const plan=(kind,target)=>({name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'根据教师当前要求完成真实文件操作',steps:[{id:'deliver',text:'完成当前文件修改',dependsOn:[],reported:'pending',kind,target},{id:'review',text:'教师核对内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})});
   if(phase==='long'||phase==='longAgain'){
    const sources=[...context.matchAll(/教师要求：(\{[^\n]*\})/g)].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}}).filter(Boolean);
    if(stage===0){state.readParts='';const source=phase==='longAgain'?{sourceId:settings.longSourceId}:sources.find(s=>s.kind==='request'&&s.text.includes('长请求校验'));if(!source)throw Error('Long source index missing');call={name:'read_teacher_request',arguments:JSON.stringify({sourceId:source.sourceId,limit:3000})};}
    else{const result=lastTool(body);if(!result.success)throw Error('Request read failed');state.readParts=(state.readParts||'')+result.data.text;if(result.data.nextOffset!==null)call={name:'read_teacher_request',arguments:JSON.stringify({sourceId:result.data.sourceId,sourceVersion:result.data.sourceVersion,offset:result.data.nextOffset,limit:3000})};}
   }else if(phase==='queue'){
    if(stage===0)call={name:'ask_teacher',arguments:JSON.stringify({question:'这份说明是用于课堂演示还是课后练习？',options:['课堂演示','课后练习']})};
   }else if(phase==='independent'){
    if(stage===0)call=plan('saved_office','force.pptx');
    else if(stage===1)call={name:'office_create_document',arguments:JSON.stringify({path:'force.pptx',format:'pptx',sources:[],draft:{...draft,title:'压力探究'}})};
   }else if(phase==='choice'){
    if(stage===0)call={name:'ask_teacher',arguments:JSON.stringify({question:'请选择要改第4页的课件',options:['第一份 lesson.pptx','第二份 force.pptx']})};
    else if(stage===1){if(!context.includes('第二份 force.pptx'))throw Error('Teacher choice missing');call=plan('saved_office','force-v2.pptx');}
    else if(stage===2)call={name:'office_file_stat',arguments:JSON.stringify({path:'force.pptx'})};
    else if(stage===3){const result=lastTool(body);call={name:'office_create_document',arguments:JSON.stringify({path:'force-v2.pptx',format:'pptx',parentArtifactId:settings.choiceArtifactId,sources:[],presentationEdit:{schemaVersion:'xiaozhi.presentation-edit.v1',version:result.data.version,pages:[{page:4,heading:'压力与接触面积'}]}})};}
   }else
   if(phase==='deliver'){
    if(stage===0)call=plan('saved_bundle','current');
    else if(stage===1)call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'lesson.html',content:html},{fileId:'ppt',kind:'office',path:'lesson.pptx',format:'pptx',sources:[],draft}]})};
   }else if(phase==='patch'){
    if(stage===0)call=plan('saved_office','lesson-v2.pptx');
    else if(stage===1)call={name:'office_file_stat',arguments:JSON.stringify({path:'lesson.pptx'})};
    else if(stage===2){const result=lastTool(body);if(!context.includes(settings.parentArtifactId))throw Error('Saved parent missing from protected/native context');call={name:'office_create_document',arguments:JSON.stringify({path:'lesson-v2.pptx',format:'pptx',parentArtifactId:settings.parentArtifactId,sources:[],presentationEdit:{schemaVersion:'xiaozhi.presentation-edit.v1',version:result.data.version,pages:[{page:4,heading:'排液体积'}]}})};}
   }else if(phase==='html'){
    if(stage===0)call=plan('saved_text','lesson.html');
    else if(stage===1)call={name:'office_read_text',arguments:JSON.stringify({path:'lesson.html'})};
    else if(stage===2){const result=lastTool(body);if(!result.success||!result.data.text.includes('原始演示'))throw Error('HTML was not actually read');call={name:'office_edit_text',arguments:JSON.stringify({path:'lesson.html',edits:[{oldText:'原始演示',newText:'修改后演示'}]})};}
   }
   const record={phase,stage,hasTail:state.readParts?.endsWith('尾部要求：必须保留排液体积')||false,hasApplied:context.includes('\"kind\":\"instruction\"')&&context.includes('讲解改为八年级'),hasChoice:context.includes('\"kind\":\"answer\"')&&context.includes('第二份 force.pptx'),tool:call?.name||null,model:body.model,hasOriginal:context.includes('10页'),hasLatest:context.includes('改成8页'),hasPriority:context.includes('最新明确修订替代冲突'),hasNoReplay:context.includes('旧写入不可自动重放')};state.requests.push(record);fs.writeFileSync(wireFile,JSON.stringify(state.requests));
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'continuity-local',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   const delta=call?{tool_calls:[{index:0,id:`continuity-${phase}-${stage}`,type:'function',function:call}]}:{content:phase==='intent'?'将按这些要求制作课堂材料。':phase==='amend'?'按最新要求采用8页浮力主题。':'已按当前任务处理，请核对实际文件。'};
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{wireFile,controlFile,html,draft:presentationFixture});
 page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await ready();id=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
async function send(phase,text){await ready();control({phase});const count=query('SELECT count(*) n FROM ai_agent_runs')[0].n;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();await until(()=>query('SELECT count(*) n FROM ai_agent_runs')[0].n>count);}
async function settled(){await until(()=>query('SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.status!=='running');await ready();return page.evaluate(sessionId=>window.omniEdu.getXiaozhiSnapshot(sessionId),id);}
try{
 await launch();await send('intent','为八年级制作10页浮力PPT和离线HTML，每页有教师备注，确认后给实际文件。');const first=await settled();
 await send('amend','改成8页，只保留浮力主题，其他约定照旧。');const amended=await settled();assert.notEqual(first.task.id,amended.task.id);assert(amended.task.criteria.some(c=>c.text.includes('8页')));
 check('Explicit correction becomes the current task; old ten-page request remains history');
 await send('deliver','可以');const bundle=page.getByTestId('pi-delivery-bundle').last();await bundle.waitFor({timeout:60000});await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());await bundle.getByTestId('pi-delivery-approve').click();const delivered=await settled();
 assert.equal(delivered.task.id,amended.task.id);assert(delivered.task.sources.length>=2);assert(wires().some(w=>w.phase==='deliver'&&w.hasOriginal&&w.hasLatest&&w.hasPriority));
 const original=query('SELECT id,file_path FROM document_artifacts ORDER BY created_at')[0];assert(original&&fs.existsSync(original.file_path));const htmlPath=path.join(path.dirname(original.file_path),'lesson.html'),oldHtml=fs.readFileSync(htmlPath),oldPpt=fs.readFileSync(original.file_path),hashes=[sha(oldHtml),sha(oldPpt)];
 check('Short confirmation reuses unfinished task and produces one reviewed HTML/PPT bundle through actual tools');
 await send('continue','继续');const continued=await settled();assert.equal(continued.task.id,delivered.task.id);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,1);assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_text_changes')[0].n,1);assert.deepEqual([sha(fs.readFileSync(htmlPath)),sha(fs.readFileSync(original.file_path))],hashes);assert(wires().filter(w=>w.phase==='continue').every(w=>!w.tool&&w.hasNoReplay));
 check('Another continuation retains saved effects without rewriting files or repeating approval');
 control({parentArtifactId:original.id});await send('patch','只修改lesson.pptx第4页标题为排液体积，其他内容和讲解备注不变，另存lesson-v2.pptx。');
 const card=page.locator('[data-testid="pi-office-artifact"][data-state="pending"]').last();await card.waitFor({timeout:60000});await until(async()=>!await card.getByTestId('pi-office-approve').isDisabled());await card.getByTestId('pi-office-approve').click();await settled();
 const rows=query('SELECT id,file_path FROM document_artifacts ORDER BY created_at');assert.equal(rows.length,2);const newer=rows.find(r=>r.id!==original.id),newBytes=fs.readFileSync(newer.file_path);
 const {readWordPackage}=await import('../../src/main/assets/word-package.ts');const oldParts=await readWordPackage(oldPpt),newParts=await readWordPackage(newBytes);
 for(let i=1;i<=8;i++){const part=`ppt/slides/slide${i}.xml`;if(i===4){assert.notDeepEqual(newParts.get(part),oldParts.get(part));assert(newParts.get(part).toString().includes('排液体积'));}else assert.deepEqual(newParts.get(part),oldParts.get(part));}
 const {readPresentationNotes}=await import('./presentation-readback.ts');assert.deepEqual(await readPresentationNotes(newBytes),await readPresentationNotes(oldPpt));assert.equal(sha(fs.readFileSync(original.file_path)),hashes[1]);
 const lineage=query('SELECT parent_artifact_id FROM xiaozhi_pi_office_drafts WHERE state=\'saved\' ORDER BY created_at DESC LIMIT 1')[0];assert.equal(lineage.parent_artifact_id,original.id);
 check('Formal page edit changes only slide four XML; seven slides and all notes stay identical, old artifact retained');
 await send('html','只把lesson.html中的原始演示改为修改后演示，其他交互保持。');const edit=page.locator('[data-testid="pi-text-change"][data-state="pending"]').last();await edit.waitFor({timeout:60000});await until(async()=>!await edit.getByTestId('pi-text-approve').isDisabled());await edit.getByTestId('pi-text-approve').click();await settled();
 const htmlAfter=fs.readFileSync(htmlPath,'utf8');assert(htmlAfter.includes('修改后演示'));assert(!htmlAfter.includes('原始演示'));assert(htmlAfter.includes('load.oninput'));assert(wires().some(w=>w.phase==='html'&&w.tool==='office_read_text'));assert.equal(sha(fs.readFileSync(newer.file_path)),sha(newBytes));
 check('Actual HTML source is read and edited through the existing diff review while PPT stays unchanged');
 const longRequest='长请求校验：'+('浮力条件。'.repeat(1300))+'尾部要求：必须保留排液体积';
 await send('long',longRequest);await settled();assert(wires().some(w=>w.phase==='long'&&w.hasTail));assert.equal(wires().filter(w=>w.phase==='long'&&w.tool==='read_teacher_request').length,3);check('Real Pi reads all three request segments including constraints after character 6500');
 await send('queue','请先问我说明用于课堂还是课后，再给一句建议。');const question=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').last();await question.waitFor({timeout:60000});
 await page.getByTestId('office-prompt-input').fill('讲解改为八年级');await page.getByTestId('pi-queue-mode').selectOption('steer');await page.getByTestId('pi-queue-submit').click();await page.locator('[data-testid="pi-queued-instruction"][data-state="queued"]').waitFor({timeout:30000});
 await question.getByTestId('pi-question-option-0').click();await question.getByTestId('pi-question-submit').click();await settled();const applied=query("SELECT payload_json FROM xiaozhi_pi_controls WHERE kind='instruction' AND state='applied'").map(r=>JSON.parse(r.payload_json));assert.equal(applied.length,1);assert.equal(applied[0].appliedOrder,1);check('Composer supplement is actually delivered by Pi at a turn seam and persists application order');
 await send('inspect','继续');await settled();assert(wires().some(w=>w.phase==='inspect'&&w.hasApplied));check('Next actual request rebuilds applied teacher instructions from SQLite');
 await send('independent','另建第二份独立压力探究课件 force.pptx，8页，每页有备注。');const independentCard=page.locator('[data-testid="pi-office-artifact"][data-state="pending"]').last();await independentCard.waitFor({timeout:60000});await until(async()=>!await independentCard.getByTestId('pi-office-approve').isDisabled());await independentCard.getByTestId('pi-office-approve').click();await settled();
 const independent=query('SELECT id,file_path FROM document_artifacts').find(r=>r.file_path.endsWith('force.pptx'));assert(independent);const forceBytes=fs.readFileSync(independent.file_path);control({choiceArtifactId:independent.id});
 await send('choice','改第4页标题为压力与接触面积，其他不变，另存新版本。');const choice=page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').last();await choice.waitFor({timeout:60000});await choice.getByTestId('pi-question-option-1').click();await choice.getByTestId('pi-question-submit').click();const chosenCard=page.locator('[data-testid="pi-office-artifact"][data-state="pending"]').last();await chosenCard.waitFor({timeout:60000});await until(async()=>!await chosenCard.getByTestId('pi-office-approve').isDisabled());await chosenCard.getByTestId('pi-office-approve').click();await settled();
 assert.equal(wires().filter(w=>w.phase==='choice'&&w.tool==='ask_teacher').length,1);assert.equal(sha(fs.readFileSync(original.file_path)),hashes[1]);assert.equal(sha(fs.readFileSync(independent.file_path)),sha(forceBytes));const forceNew=query('SELECT id,file_path FROM document_artifacts').find(r=>r.file_path.endsWith('force-v2.pptx'));assert(forceNew);const forceParts=await readWordPackage(forceBytes),forceNewParts=await readWordPackage(fs.readFileSync(forceNew.file_path));for(let i=1;i<=8;i++)if(i!==4)assert.deepEqual(forceParts.get(`ppt/slides/slide${i}.xml`),forceNewParts.get(`ppt/slides/slide${i}.xml`));assert(forceNewParts.get('ppt/slides/slide4.xml').toString().includes('压力与接触面积'));assert.deepEqual(await readPresentationNotes(forceBytes),await readPresentationNotes(fs.readFileSync(forceNew.file_path)));check('One teacher choice edits second independent PPT; first deck, other pages and speaker notes remain unchanged');
 await send('choiceInspect','继续');await settled();assert(wires().some(w=>w.phase==='choiceInspect'&&w.hasChoice));check('Answered artifact selection survives the native tool turn in protected request context');
 const longSource=query("SELECT id FROM ai_conversation_messages WHERE role='user' AND content LIKE '长请求校验：%' LIMIT 1")[0];assert(longSource);control({longSourceId:longSource.id});
 await send('compact','/compact');await settled();const bindingBefore=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file;const nativeText=fs.readFileSync(path.join(data,'xiaozhi-pi',bindingBefore),'utf8');assert(nativeText.includes('"type":"compaction"'));
 await send('longAgain','请重读本会话先前长请求，核对末尾约束。');await settled();assert(wires().some(w=>w.phase==='longAgain'&&w.hasTail));assert(wires().some(w=>w.phase==='longAgain'&&w.hasChoice));check('Actual native compaction keeps applied commands and chosen target; original long source rereads completely from SQLite');
 await until(async()=>!(await page.locator('body').textContent()).includes('过程记录暂时无法核对'));await page.screenshot({path:path.join(output,'continuity-result.png')});
 report.wire=wires();const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file;await application.close();application=undefined;await launch();assert.equal(query('SELECT session_file FROM xiaozhi_pi_session_bindings')[0].session_file,binding);assert.equal(wires().length,0);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,4);assert.equal(sha(fs.readFileSync(newer.file_path)),sha(newBytes));
 check('Cold start keeps original native identity and both PPT versions without replay');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=String(error.stack);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.wire=wires();}
finally{await application?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
