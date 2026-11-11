import '../office-agent/register-source.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron} from 'playwright';
import { testMain, assertIsolatedPiMain } from '../acceptance/build-root.mjs';
import { zeroNetworkBootstrap } from '../acceptance/zero-network-bootstrap.mjs';
import {productEntry} from '../product-navigation.mjs';import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const {questionVersion,createQuestionContextProvider}=await import('../../src/main/education/question-context-provider.ts');
const {prepareQuestionAliases}=await import('../../src/main/education/question-aliases.ts');
const {basketQuestionAvailability}=await import('../../src/main/education/paper-basket-source.ts');
const isolation = process.argv.includes('--isolate-final') ? 'final'
  : process.argv.includes('--isolate-source') ? 'source' : '';
const disableIsolation = process.argv.includes('--disable-new-isolation');
const whitespace=process.argv.includes('--partition-whitespace'),literal=!!isolation||process.argv.includes('--literal'),partial=!!isolation||process.argv.includes('--partial'),retained=process.argv[2]&&!process.argv[2].startsWith('--')?fs.realpathSync(process.argv[2]):undefined;if(retained)assert(path.dirname(retained).toLowerCase()===fs.realpathSync(os.tmpdir()).toLowerCase()&&path.basename(retained).startsWith('omni-source-content-ui-'));
const desktop=process.cwd(),output=retained||fs.mkdtempSync(path.join(os.tmpdir(),'omni-source-content-ui-')),folder=path.join(output,'资料','子目录'),data=path.join(output,'data'),profile=path.join(output,'profile'),ledger=path.join(output,'calls.json');fs.mkdirSync(folder,{recursive:true});
const main=testMain(desktop);
const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const file=path.join(folder,'闭合出处与页脚.png');
if(!retained)execFileSync(python,['-c',`from PIL import Image,ImageDraw,ImageFont
import sys
im=Image.new('RGB',(1400,1000),'white');d=ImageDraw.Draw(im);f=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',48)
d.text((100,120),'1. [2025某省中考] 计算 7 + 8 的结果。',font=f,fill='black')
if sys.argv[2]=='1': d.text((100,420),'2. 学习提示 计算 9 + 9 的结果。',font=f,fill='black')
d.text((100,910),'印刷资料页脚',font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',28),fill='black')
im.save(sys.argv[1])`,file,partial?'1':'0'],{windowsHide:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),originalSha=sha(fs.readFileSync(file)),report={output,buildSha256:sha(fs.readFileSync(main)),isolation,checks:[],rendererErrors:[],cloudCalls:0,qualityPassed:false,scope:'Actual recursive PNG import, production OCR/layout/SQLite/typed IPC/Electron UI/cold read. Controlled provider intentionally changes publication year; not natural extraction, math, held-out quality, 40GiB or installation acceptance.'};let app,page;
const sql=(s,p=[])=>{const d=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return d.prepare(s).all(...p);}finally{d.close();}};
const until=async(fn,ms=240000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,350));}throw Error('Inspect preserved source-content run before any retry');};
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_AI_LITERAL_READING:literal?'1':'0',OMNI_EDU_AI_QUESTION_ISOLATION:disableIsolation?'0':isolation?'1':process.env.OMNI_EDU_AI_QUESTION_ISOLATION,...(partial?{OMNI_EDU_AI_HOST_PARTITIONS:'1'}:{})};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
 const bootstrap=zeroNetworkBootstrap({output,main,profile,counter:'__isolationStartupHttp'});
 app=await _electron.launch({args:[bootstrap],cwd:output,env,timeout:60000});
 page=await app.firstWindow();
 report.runtimeIsolation??=[];
 report.runtimeIsolation.push(await assertIsolatedPiMain(app,main,profile));
 await app.evaluate(({net},{cold,ledger,whitespace,literal,partial,isolation})=>{
  const fs=process.getBuiltinModule('fs'),assert=process.getBuiltinModule('assert').strict;for(const owner of [net,globalThis])owner.fetch=async(url,o)=>{
   if(/\/models$/.test(String(url)))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text','image'],context_window:1048576,max_output_tokens:65536}]}));
   if(cold||!String(url).includes('/chat/completions'))throw Error('No external network permitted in controlled source-content journey');
   const request=JSON.parse(o.body),p=JSON.parse(request.messages[1].content[0].text),rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(rows.length>=3)throw Error('Unexpected retry');
   if(p.pageContext?.sourceContentPolicy!=='source-content-roles.v1')throw Error('Quality default must freeze content roles');
   const sourceOnly=p.phase==='仅转录原图来源，不解题',final=!!p.firstDraft&&!sourceOnly;
   const isolated=p.pageContext.literalReadingPolicy==='host-crop-body-isolated.v5',bodyOnly=isolated||p.pageContext.literalReadingPolicy==='host-crop-body.v4',flat=bodyOnly||p.pageContext.literalReadingPolicy==='host-crop-partition.v3',independent=flat||p.pageContext.literalReadingPolicy==='host-independent-literal.v2';
   if(independent&&p.firstDraft){assert(!Object.hasOwn(p,'material'));assert(!Object.hasOwn(p.pageContext,'blockTexts'));assert(!Object.hasOwn(p.cropReview.questions[0],'sourceFound'));if(sourceOnly)assert.deepEqual(Object.keys(p.firstDraft.questions[0]),['number']);}
   const partition=(text,number)=>{
    const parts=[];let remaining=text;const marker=remaining.match(new RegExp('^'+number+'[.、．]\\s*'));
    if(marker){parts.push({role:'marker',text:marker[0]});remaining=remaining.slice(marker[0].length);}
    const pub=remaining.match(/^[「【[(（](?:19|20)\d{2}[^\r\n]{1,60}?[」】\])）]\s*/u);
    if(pub){parts.push({role:'publication',text:final?pub[0].replace('2025','2024'):pub[0]});remaining=remaining.slice(pub[0].length);}
    parts.push({role:'body',text:remaining});return parts;
   };
   const fixtureText=number=>number==='1'?'1. [2025某省中考] 计算 7 + 8 的结果。':'2. 学习提示 计算 9 + 9 的结果。';
   const readings=p.cropReview?p.cropReview.questions.map(q=>({number:q.number,crops:q.crops.map(c=>{
    const parts=partition(independent?fixtureText(q.number):c.text,q.number),text=parts.map(part=>part.text).join('');
    if(q.number==='1'&&!parts.some(part=>part.role==='publication'))throw Error('Expected closed citation in the controlled image');
    if(whitespace)for(const part of parts)if(part.role==='marker')part.text=part.text.trimEnd();
    return{sha256:c.sha256,ocrSha256:c.ocrSha256,text,assessment:final?'corrected':'exact',issues:[],parts};
   })})):[];
   const numbers=partial?['1','2']:['1'];
   const questions=numbers.map(number=>{
    const stem=readings.length?readings.find(row=>row.number===number).crops.flatMap(crop=>crop.parts.filter(part=>part.role==='body').map(part=>part.text)).join('\n'):number==='1'?'计算 7 + 8 的结果。':'学习提示 计算 9 + 9 的结果。';
    const projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(key=>[key,{state:key==='statement'?'provided':'not_applicable',text:key==='statement'?stem:''}]));
    return{number,stem,answer:sourceOnly?'':number==='1'?'15':'18',analysis:sourceOnly?'':number==='1'?'7与8相加得到15。':'9与9相加得到18。',subject:'数学',grade:'初二',knowledgePoint:'算术',questionType:'解答题',difficulty:'easy',answerOrigin:sourceOnly?'missing':'ai_generated',analysisOrigin:sourceOnly?'missing':'ai_generated',requiresImage:false,issues:[],projection};
   });
   const fragments=p.firstDraft?p.firstDraft.fragments:numbers.map(number=>({number,blockIds:p.pageContext.blocks.blocks.filter(block=>!['footer','header','number','footer_image','header_image'].includes(block.kind)&&p.pageContext.blockTexts.find(hint=>hint.blockId===block.id)?.text.includes(number==='1'?'7':'9')).map(block=>block.id),complete:true}));
   if(fragments.some(fragment=>!fragment.blockIds.length))throw Error('Expected owned question layout');
   const canonical={schemaVersion:'xiaozhi.material-ai-page-readings.v2',outcome:'questions',questions,pageText:questions.map(q=>'第'+q.number+'题 '+(q.number==='1'?'[2025某省中考] ':'')+q.stem).join('\n')+'\n印刷资料页脚',pageIssues:[],fragments,readings};
   const wire=literal&&p.firstDraft?{schemaVersion:isolated?'xiaozhi.material-ai-literal.v5':bodyOnly?'xiaozhi.material-ai-literal.v4':flat?'xiaozhi.material-ai-literal.v3':independent?'xiaozhi.material-ai-literal.v2':'xiaozhi.material-ai-literal.v1',pageText:canonical.pageText,pageIssues:[],questions:questions.map(q=>({number:q.number,crops:readings.find(row=>row.number===q.number).crops.map((crop,index)=>flat?{index,text:crop.text,...(!bodyOnly?{publication:!isolation&&partial&&q.number==='2'&&final||crop.parts.some(part=>part.role==='publication')}:{}),issues:!isolation&&bodyOnly&&partial&&q.number==='2'&&final?['uncertain_ocr']:crop.issues}:{index,parts:crop.parts,...(!independent?{assessment:crop.assessment}:{}),issues:crop.issues}),coverage:Object.fromEntries(['formulas','tables','choices','subquestions'].map(key=>[key,q.projection[key].state])),figure:q.projection.figures,requiresImage:q.requiresImage,issues:q.issues,answer:{text:q.answer,origin:q.answerOrigin},analysis:{text:q.analysis,origin:q.analysisOrigin}}))}:canonical;
   if(isolation&&p.firstDraft&&(isolation==='source'?sourceOnly:final))wire.questions.find(q=>q.number==='2').crops[0].index=7;
   if(literal&&!['host-derived-literal.v1','host-independent-literal.v2','host-crop-partition.v3','host-crop-body.v4','host-crop-body-isolated.v5'].includes(p.pageContext.literalReadingPolicy))throw Error('Literal policy must be frozen for this new batch');
   const raw=JSON.stringify(wire);
   rows.push({phase:p.phase,hostPartitioned:flat&&!!p.firstDraft,parts:flat?[]:readings.flatMap(q=>q.crops.flatMap(c=>c.parts.map(p=>p.role))),responseSha256:process.getBuiltinModule('crypto').createHash('sha256').update(raw).digest('hex')});fs.writeFileSync(ledger,JSON.stringify(rows,null,2));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}));
  };
 },{cold,ledger,whitespace,literal,partial,isolation});
 page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));await productEntry(page,'materials').waitFor();
}
async function inspect(questionId,cold){
 await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();const card=page.getByTestId('question-notebook-card-'+questionId);await card.waitFor();const panel=card.getByTestId('material-ai-page-panel');await panel.getByTestId('material-ai-page-open').click();const view=panel.getByTestId('material-source-readings');await view.waitFor();await openMaterialDisclosure(view);await view.getByTestId('material-source-publication-review').waitFor();assert((await view.innerText()).includes('2025'));assert((await view.innerText()).includes('2024'));assert.equal(await view.getByTestId('material-source-part').and(page.locator('[data-role="publication"]')).count(),1);
 for(const [width,height] of [[1366,768],[1920,1080]]){const win=await app.browserWindow(page);report.resizeAttempts??=[];report.resizeAttempts.push({target:{width,height},before:await win.evaluate(w=>({maximized:w.isMaximized(),fullscreen:w.isFullScreen(),content:w.getContentBounds()}))});await win.evaluate((w,s)=>{if(w.isMaximized())w.unmaximize();if(w.isFullScreen())w.setFullScreen(false);w.setContentSize(s.width,s.height);},{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await view.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,(retained?'final-cold-':cold?'cold-':'warm-')+width+'.png')});}
 const q=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId),context=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId,version:questionVersion(q)});assert(context.ok,JSON.stringify(context));return q;
}
try{
 console.log('OUTPUT '+output);
 if(retained){
  const before=sha(Buffer.from(JSON.stringify(sql('SELECT * FROM material_ai_units')))),q=sql("SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.number='1'")[0];assert(q&&JSON.parse(q.archive_json).state==='ai_final');const prior=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(prior.length,3);
  await launch(true);const cold=await inspect(q.id,true);assert.equal(JSON.stringify(cold.document),q.document_json);assert.equal(sha(Buffer.from(JSON.stringify(sql('SELECT * FROM material_ai_units')))),before);assert.equal(sha(fs.readFileSync(file)),originalSha);assert.deepEqual(JSON.parse(fs.readFileSync(ledger,'utf8')),prior);assert.equal(report.rendererErrors.length,0);report.newControlledRequests=0;report.checks.push('Final build cold-opens the existing image archive and typed source with both publication readings at both viewport sizes','Original file, document, immutable paid/model receipts and controlled request ledger stay unchanged; no OCR or provider replay');report.success=true;
 }else{
 await launch();const configured=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:'deepseek-flash',apiKey:'controlled-source-content-no-cloud'})));assert(configured.ok);
 await productEntry(page,'materials').click();const rootFolder=path.dirname(folder);await app.evaluate(({dialog},p)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[p]});},rootFolder);await page.getByTestId('materials-import-folder').click();const id=await until(()=>sql('SELECT id FROM material_import_batches WHERE root_path=?',[rootFolder])[0]?.id);await openMaterialDisclosure(page.getByTestId('materials-batches'));const card=page.getByTestId('folder-ai-'+id);await openMaterialDisclosure(card);await card.getByTestId('folder-ai-open-authorization').click();await card.getByTestId('folder-ai-budget').fill('3');await card.getByTestId('folder-ai-public').check();await card.getByTestId('folder-ai-consent').check();await until(async()=>!await card.getByTestId('folder-ai-authorize').isDisabled());await card.getByTestId('folder-ai-authorize').click();
 await until(()=>{const u=sql('SELECT status FROM material_ai_units');if(!u.length&&['budget_exhausted','attention','configuration_changed'].includes(sql('SELECT status FROM material_folder_ai')[0]?.status))throw Error('Folder stopped before any unit: '+JSON.stringify(sql('SELECT status,error FROM material_folder_ai')));fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(u));return u.length&&u.every(r=>['complete','review','no_questions','failed','outcome_unknown'].includes(r.status));});
 const rows=sql('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id');assert.equal(rows.length,partial?2:1,JSON.stringify(sql('SELECT status,error FROM material_ai_units')));const q=rows.find(row=>JSON.parse(row.archive_json).number==='1');assert.equal(JSON.parse(q.archive_json).state,'ai_final',q.archive_json);assert(!q.stem.includes('2025')&&!q.stem.includes('页脚'));report.questionId=q.id;if(whitespace){const raw=sql('SELECT final_json FROM material_ai_units')[0].final_json,crop=JSON.parse(raw).readings[0].crops[0];assert.notEqual(crop.parts.map(p=>p.text).join(''),crop.text);const saved=JSON.parse(q.document_json).context.sourceContent.crops[0].readings[1];assert.equal(saved.text,crop.text);assert.equal(saved.parts.map(p=>p.text).join(''),crop.text);report.whitespaceRawPreserved=true;}assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).length,3);report.checks.push('Actual recursive folder import freezes quality v2, performs real local OCR/layout, archives only owned body and preserves source partitions in SQLite');
 await inspect(q.id,false);report.checks.push('Actual notebook opens retained v2 partitions and both conflicting publication years at 1366x768/1920x1080; typed source read accepts the body');const before=sha(Buffer.from(JSON.stringify(sql('SELECT * FROM material_ai_units')))),document=q.document_json;await app.close();app=undefined;await launch(true);const cold=await inspect(q.id,true);assert.equal(JSON.stringify(cold.document),document);assert.equal(sha(Buffer.from(JSON.stringify(sql('SELECT * FROM material_ai_units')))),before);assert.equal(sha(fs.readFileSync(file)),originalSha);assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).length,3);assert.equal(report.rendererErrors.length,0);report.checks.push('Cold launch preserves original image, both model receipts, document roles and teacher comparison with no network or extra model request');report.success=true;
 }
 if(partial){
  const held=sql('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.number=?',['2'])[0];
  assert(held);assert.equal(JSON.parse(held.archive_json).state,'ai_needs_review');assert.equal(held.document_json,'');
  assert.equal(sql('SELECT status FROM material_ai_units')[0].status,'review');
  const card=page.getByTestId('question-notebook-card-'+held.id);await card.scrollIntoViewIfNeeded();
  assert((await card.getByTestId('question-archive-eligibility').innerText()).includes('AI整理待补全'));
  assert((await card.getByTestId('question-notebook-stem').innerText()).includes('学习提示'));
  report.heldIssues=JSON.parse(held.archive_json).issues;const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),held.id);
  const context=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:held.id,version:questionVersion(question)});
  // This IPC is the teacher's authenticated local inspection, not Pi read authority.
  assert(context.ok,JSON.stringify(context));assert.equal(context.value.question.archive.state,'ai_needs_review');
  assert(!context.value.question.document);report.heldQuestionId=held.id;
  const store={
   getQuestionNotebookEntry:id=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),id),
   listStudents:query=>page.evaluate(query=>window.omniEdu.listStudents(query),query),
   sanitizeProblemText:text=>page.evaluate(text=>window.omniEdu.sanitizeProblemText(text),text),
   readArchivedQuestionContext:async q=>{const result=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});assert(result.ok,JSON.stringify(result));},
   readQuestionDocumentContext:async id=>{const q=await store.getQuestionNotebookEntry(id);await store.readArchivedQuestionContext(q);return q.document.context.projection;},
  };
  const ready=await store.getQuestionNotebookEntry(sql("SELECT question_id FROM material_ai_members WHERE number='1'")[0].question_id),aliases=new Map(),reads=[];
  const prepared=prepareQuestionAliases(aliases,[ready,question].map(q=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)})));prepared.commit();
  const reader=createQuestionContextProvider(store,()=>true,reference=>reads.push(reference),aliases).find(tool=>tool.name==='education_read_question');
  for(const [index,q]of [ready,question].entries()){
   const result=await reader.execute('controlled-read-'+index,{reference:prepared.references[index],version:questionVersion(q)},new AbortController().signal);
   const value=JSON.parse(result.content.find(part=>part.type==='text').text);
   assert.equal(value.success,index===0,JSON.stringify(value));if(index===1)assert.equal(value.code,'document_context_unavailable');
  }
  assert.deepEqual(reads,[prepared.references[0]]);
  assert.deepEqual(await basketQuestionAvailability({validate:async()=>{throw Error('Held question must be rejected before source validation');}},question,new Map()),{available:false,reason:'unsupported'});
  report.checks.push('Actual teacher notebook preserves and permits local inspection of the held body; production Pi reader and paper basket reject it while its complete sibling remains readable');
 }
 if(literal){
  const unit=sql('SELECT input_json,final_json FROM material_ai_units')[0];const policy=JSON.parse(unit.input_json).pagePrompt.literalReadingPolicy,isolated=policy==='host-crop-body-isolated.v5',bodyOnly=isolated||policy==='host-crop-body.v4',flat=bodyOnly||policy==='host-crop-partition.v3',independent=flat||policy==='host-independent-literal.v2';assert(['host-derived-literal.v1','host-independent-literal.v2','host-crop-partition.v3','host-crop-body.v4','host-crop-body-isolated.v5'].includes(policy));
  const receipts=sql('SELECT phase,body_base64,body_sha FROM material_ai_response_receipts ORDER BY rowid');assert.equal(receipts.length,3);
  const rawContents=receipts.map(r=>{const bytes=Buffer.from(r.body_base64,'base64');assert.equal(sha(bytes),r.body_sha);return JSON.parse(JSON.parse(bytes.toString()).choices[0].message.content);});report.literalResponseSchemas=rawContents.map(r=>r.schemaVersion);
  if (isolation) {
   assert(isolated);
   const raw = rawContents[isolation === 'source' ? 1 : 2];
   assert.equal(raw.questions.find(q => q.number === '2').crops[0].index, 7);
   report.isolatedBadRawPreserved = true;
   report.checks.push('Malformed per-question crop index stays in its exact original provider receipt while the complete sibling is archived and the affected question stays held');
  }
  assert.deepEqual(report.literalResponseSchemas,['xiaozhi.material-ai-page-readings.v2',...Array(2).fill(isolated?'xiaozhi.material-ai-literal.v5':bodyOnly?'xiaozhi.material-ai-literal.v4':flat?'xiaozhi.material-ai-literal.v3':independent?'xiaozhi.material-ai-literal.v2':'xiaozhi.material-ai-literal.v1')]);
  const canonical=JSON.parse(unit.final_json);assert.equal(canonical.schemaVersion,'xiaozhi.material-ai-page-readings.v2');assert(canonical.readings.every(r=>r.crops.every(c=>c.parts.map(p=>p.text).join('')===c.text)));
  report.checks.push('Frozen literal policy retains three exact raw provider envelopes while canonical body and source parts remain cold-readable without another model request');
 }
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{if(app)await app.close();report.requests=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];fs.writeFileSync(path.join(output,retained?'final-cold-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
