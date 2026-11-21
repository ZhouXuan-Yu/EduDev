import '../office-agent/register-source.mjs';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const {questionVersion,createQuestionContextProvider}=await import('../../src/main/education/question-context-provider.ts');
const {prepareQuestionAliases}=await import('../../src/main/education/question-aliases.ts');
const {basketQuestionAvailability}=await import('../../src/main/education/paper-basket-source.ts');
const publishConflict=process.argv.includes('--publish-conflict');
const compact=process.argv.includes('--compact-answer-key');
const printed=process.argv.includes('--printed-labels');
assert(!printed||!compact&&!publishConflict);
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-book-reference-ui-')),folder=path.join(output,'资料','子目录'),data=path.join(output,'data'),profile=path.join(output,'profile'),ledger=path.join(output,'requests.json');fs.mkdirSync(folder,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),section='第九章 素养基础测试卷';
const numbers=compact?['1','3']:['1','2'],answers=compact?['B','100℃']:['100℃','100℃'];
const stems=[compact?'按题意用字母表示状态，平静的水为 A，沸腾的水为 B。水沸腾时应该填什么字母？':'标准大气压下水的沸点是多少摄氏度？','在标准大气压下，纯水沸腾时的温度是多少摄氏度？'];
const details='答案：100℃\n解析：纯水在标准大气压下沸腾时温度为100℃。';
const analysis='标准大气压下水的沸点为100℃。';
const answerText=printed
 ?section+'\n1. '+stems[0]+'\n【答案】100℃\n【解析】'+analysis+'\n2. '+stems[1]+'\n【参考答案】100℃\n【详解】纯水在标准大气压下沸腾时温度为100℃。'
 :compact
 ?section+'\n答案速查\n1 2\nB C\n3. '+details+'\n第十章 素养提优测试卷\n参考答案\n1 2 3\nA D'
 :section+'\n1. 答案：100℃\n解析：标准大气压下水的沸点为100℃。\n2. '+details;
const report={output,buildSha256:sha(fs.readFileSync(entry)),checks:[],rendererErrors:[],cloudRequests:0,naturalQualityPassed:false,scope:'Actual two-page PDF question book plus independent answer PDF, recursive folder UI/role authorization/local OCR-layout-crops/typed source/SQLite/dual viewports/cold start. Eight controlled provider responses; not natural reasoning, held-out extraction, 40GiB, installation or migration acceptance.'};let app,page;
const sql=(s,p=[])=>{const d=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return d.prepare(s).all(...p);}finally{d.close();}};
const until=async(fn,ms=240000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,400));}throw Error('Inspect retained book-reference state before any rerun');};
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1',...(publishConflict?{OMNI_EDU_BOOK_ANSWER_WRITEBACK:'0'}:{})};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
 app=await _electron.launch({args:[entry,'--user-data-dir='+profile],env,cwd:output,timeout:60000});
 await app.evaluate(({net},{cold,ledger,section,stems,numbers,answers,answerText,publishConflict})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');for(const owner of [net,globalThis])owner.fetch=async(url,o)=>{
   if(/\/models$/.test(String(url)))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text','image'],context_window:1048576,max_output_tokens:65536}]}));
   if(cold||!String(url).includes('/chat/completions'))throw Error('No external network in controlled book-reference journey');
   try { const request=JSON.parse(o.body),p=JSON.parse(request.messages[1].content[0].text),rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(rows.length>=8)throw Error('Unexpected extra request');
   const answerBook=['answer-entry-uncertainty.v2','answer-entry-topology.v3','answer-entry-printed-labels.v4'].includes(p.answerContext?.policy),sourceOnly=p.phase==='仅转录原图来源，不解题',final=!!p.knownAnswers;
   let value;
   if(answerBook){if(p.knownAnswers)throw Error('Answer extraction cannot consume another answer context');value={schemaVersion:'xiaozhi.material-ai-book-page-response.v2',outcome:'no_questions',questions:[],pageText:answerText,pageIssues:[],answerIssues:[]};}
   else{
    if(p.pageContext?.sourceContentPolicy!=='source-content-roles.v1'||p.pageContext?.bookReferencePolicy!=='book-final-reference.v1')throw Error('Paired quality must freeze references and source partitions');
    const number=p.firstDraft?.questions[0]?.number||(/纯水/.test(p.material)?numbers[1]:numbers[0]),n=numbers.indexOf(number);
    if(!p.firstDraft&&p.knownAnswers||sourceOnly&&p.knownAnswers)throw Error('Known answer leaked to independent/source pass');
    if(final&&p.knownAnswers.entries.find(e=>e.number===number)?.state!=='available')throw Error('Expected authenticated unique answer: '+JSON.stringify(p.knownAnswers));
    const isolated=p.pageContext.literalReadingPolicy==='host-crop-body-isolated.v5',literal=isolated||p.pageContext.literalReadingPolicy==='host-crop-body.v4',readings=p.cropReview?p.cropReview.questions.map(q=>({number:q.number,crops:q.crops.map(c=>{const text=literal?number+'. '+stems[n]:c.text,marker=text.match(new RegExp('^'+number+'[.、．]\\s*')),parts=marker?[{role:'marker',text:marker[0]},{role:'body',text:text.slice(marker[0].length)}]:[{role:'body',text}];return{sha256:c.sha256,ocrSha256:c.ocrSha256,text,assessment:'exact',issues:[],parts};})})):[];
    const stem=readings.length?readings[0].crops.flatMap(c=>c.parts.filter(x=>x.role==='body').map(x=>x.text)).join('\n'):stems[n],projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?stem:''}]));
    const wrong=n===1&&(!p.firstDraft||publishConflict),q={number,stem,answer:sourceOnly?'':wrong?'90℃':answers[n],analysis:sourceOnly?'':wrong?'受控模型错误：90℃。':answers[n]==='B'?'原题以 B 表示沸腾。':'标准大气压下水的沸点为100℃。',subject:'物理',grade:'初二',knowledgePoint:'沸点',questionType:'填空题',difficulty:'easy',answerOrigin:sourceOnly?'missing':'ai_generated',analysisOrigin:sourceOnly?'missing':'ai_generated',requiresImage:false,issues:[],projection};
    const fragments=p.firstDraft?.fragments||[{number,complete:true,blockIds:p.pageContext.blocks.blocks.filter(b=>p.pageContext.blockTexts.find(t=>t.blockId===b.id)?.text.includes('水')).map(b=>b.id)}];if(!fragments[0].blockIds.length)throw Error('No owned question block');
    value={schemaVersion:'xiaozhi.material-ai-page-readings.v2',outcome:'questions',questions:[q],pageText:(n===0?section+'\n':'')+'第'+number+'题 '+stem,pageIssues:[],fragments,readings};
    if(literal&&p.firstDraft)value={schemaVersion:isolated?'xiaozhi.material-ai-literal.v5':'xiaozhi.material-ai-literal.v4',pageText:value.pageText,pageIssues:[],questions:[{number,crops:readings[0].crops.map((c,index)=>({index,text:c.text,issues:[]})),coverage:Object.fromEntries(['formulas','tables','choices','subquestions'].map(k=>[k,q.projection[k].state])),figure:q.projection.figures,requiresImage:false,issues:[],answer:{text:q.answer,origin:q.answerOrigin},analysis:{text:q.analysis,origin:q.analysisOrigin}}]};
   }
   const raw=JSON.stringify(value);rows.push({kind:answerBook?'answer':sourceOnly?'source':final?'informed_final':'independent_first',number:value.questions[0]?.number||'',knownAnswers:p.knownAnswers||null,responseSha256:crypto.createHash('sha256').update(raw).digest('hex')});fs.writeFileSync(ledger,JSON.stringify(rows,null,2));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}));
   }catch(error){fs.appendFileSync(ledger+'.errors',String(error.stack||error)+'\n');throw error;}
  };
 },{cold,ledger,section,stems,numbers,answers,answerText,publishConflict});
 page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));await productEntry(page,'materials').waitFor();
}
async function inspect(q,cold){
 await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();const card=page.getByTestId('question-notebook-card-'+q.id);await card.waitFor();await card.getByTestId('material-ai-page-open').click();const refs=card.getByTestId('material-final-book-references');await refs.waitFor();await openMaterialDisclosure(refs);const item=refs.getByTestId('material-final-book-reference').and(page.locator('[data-number="'+q.archive.number+'"]'));assert.equal(await item.getAttribute('data-state'),'available');assert((await item.innerText()).includes(answers[numbers.indexOf(q.archive.number)]));
 for(const [width,height]of [[1366,768],[1920,1080]]){const win=await app.browserWindow(page);await win.evaluate((w,s)=>{if(w.isMaximized())w.unmaximize();if(w.isFullScreen())w.setFullScreen(false);w.setContentSize(s.width,s.height);},{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await refs.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,(cold?'cold-':'warm-')+q.archive.number+'-'+width+'.png')});}
 const result=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});assert(result.ok,JSON.stringify(result));
}
async function readiness(entries){
 const store={getQuestionNotebookEntry:id=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),id),listStudents:query=>page.evaluate(query=>window.omniEdu.listStudents(query),query),sanitizeProblemText:text=>page.evaluate(text=>window.omniEdu.sanitizeProblemText(text),text),readArchivedQuestionContext:async q=>{const result=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});assert(result.ok);},readQuestionDocumentContext:async id=>{const q=await store.getQuestionNotebookEntry(id);await store.readArchivedQuestionContext(q);return q.document.context.projection;}};
 const aliases=new Map(),prepared=prepareQuestionAliases(aliases,entries.map(q=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)})));prepared.commit();const reads=[],reader=createQuestionContextProvider(store,()=>true,r=>reads.push(r),aliases).find(t=>t.name==='education_read_question');
 for(const [i,q]of entries.entries()){const r=await reader.execute('publish-read-'+i,{reference:prepared.references[i],version:questionVersion(q)},new AbortController().signal),value=JSON.parse(r.content.find(c=>c.type==='text').text);assert.equal(value.success,i===0,JSON.stringify(value));if(i===1)assert.equal(value.code,'document_context_unavailable');assert.deepEqual(await basketQuestionAvailability({validate:q=>store.readArchivedQuestionContext(q)},q,new Map()),i?{available:false,reason:'unsupported'}:{available:true});}assert.deepEqual(reads,[prepared.references[0]]);
}
try{
 console.log('OUTPUT '+output);await launch();assert((await page.evaluate(()=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:'deepseek-flash',apiKey:'controlled-book-reference-no-cloud'})))).ok);
 await app.evaluate(async({BrowserWindow},{folder,section,stems,numbers,answerText})=>{const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');for(const answer of [false,true]){const win=new BrowserWindow({show:false,webPreferences:{sandbox:true}});try{const content=answer?answerText.split('\n').map(line=>'<p>'+line+'</p>').join(''):stems.map((s,i)=>'<section style="'+(i?'break-before:page;':'')+'">'+(i?'':'<h2>'+section+'</h2>')+'<p style="margin-top:140px">'+numbers[i]+'. '+s+'</p></section>').join('');await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><meta charset="utf-8"><body style="font-family:Microsoft YaHei;font-size:24px;line-height:2">'+content+'</body></html>'));fs.writeFileSync(path.join(folder,answer?'答案.pdf':'试题.pdf'),await win.webContents.printToPDF({pageSize:'A4',printBackground:true}));}finally{win.destroy();}}},{folder,section,stems,numbers,answerText});
 const originals=Object.fromEntries(fs.readdirSync(folder).map(n=>[n,sha(fs.readFileSync(path.join(folder,n)))]));await productEntry(page,'materials').click();const rootFolder=path.dirname(folder);await app.evaluate(({dialog},p)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[p]});},rootFolder);await page.getByTestId('materials-import-folder').click();const batch=await until(()=>sql('SELECT id FROM material_import_batches WHERE root_path=?',[rootFolder])[0]?.id);await until(()=>{const state=sql('SELECT status,error FROM material_import_batches WHERE id=?',[batch])[0];if(state?.status==='failed')throw Error('Folder archive failed: '+state.error);return sql("SELECT COUNT(*) n FROM material_pdf_jobs WHERE state='complete'")[0].n===2;});
 const batches=page.getByTestId('materials-batches');if(!await batches.isVisible())await page.getByTestId('materials-queue-toggle').click();await openMaterialDisclosure(batches);const card=page.getByTestId('folder-ai-'+batch);await openMaterialDisclosure(card);await card.getByTestId('folder-ai-open-authorization').click();await card.getByTestId('folder-ai-budget').fill('9');await card.getByTestId('folder-ai-public').check();await card.getByTestId('folder-ai-consent').check();await card.getByTestId('folder-ai-has-answer-books').check();await card.getByTestId('folder-books-query').fill('试题');await card.getByTestId('folder-book').filter({hasText:'试题.pdf'}).getByTestId('folder-book-question').click();await until(async()=>!await card.getByTestId('folder-books-query').isDisabled());await card.getByTestId('folder-books-query').fill('答案');await card.getByTestId('folder-book').filter({hasText:'答案.pdf'}).getByTestId('folder-book-answer').click();await card.getByTestId('folder-books-save').click();await card.getByTestId('folder-books-linked').waitFor();await until(async()=>!await card.getByTestId('folder-ai-authorize').isDisabled());await card.getByTestId('folder-ai-authorize').click();
 await until(()=>{const u=sql('SELECT status,error FROM material_ai_units');fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(u));const stop=sql('SELECT status,error FROM material_folder_ai')[0];if(stop&&['attention','budget_exhausted','configuration_changed'].includes(stop.status)&&u.some(r=>['failed','outcome_unknown'].includes(r.status)))throw Error('Terminal failure '+JSON.stringify({u,stop}));return u.length===3&&u.every(r=>['complete','review','no_questions'].includes(r.status));});
 const calls=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(calls.length,8);assert.deepEqual(calls.slice(0,2).map(x=>x.kind),['answer','answer']);assert.equal(calls.filter(x=>x.knownAnswers).length,2);assert(calls.every(x=>x.knownAnswers?x.kind==='informed_final':true));assert.equal(sql('SELECT COUNT(*) n FROM material_ai_book_references WHERE final_sha<>\'\'')[0].n,2);report.checks.push('Actual recursive PDF pair is authorized through role UI; answers finish first, and only the two informed final requests receive the unique authenticated references');
 if(!publishConflict)await until(()=>sql("SELECT COUNT(*) n FROM question_bank_items WHERE json_extract(archive_json,'$.state')='book_enriched'")[0].n===1);const qs=sql('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id ORDER BY CAST(json_extract(q.archive_json,\'$.number\') AS INTEGER)');assert.equal(qs.length,2);const entries=await Promise.all(qs.map(q=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),q.id)));report.published=entries.map(q=>({state:q.archive.state,issues:q.archive.issues,answer:q.answer,document:!!q.document}));assert.equal(entries[0].archive.state,publishConflict?'ai_final':'book_enriched');assert(entries[0].document&&entries[0].answer===answers[0]);assert.equal(entries[1].archive.state,'ai_needs_review');assert(entries[1].archive.issues.includes('answer_conflict'));assert.equal(entries[1].answer,publishConflict?'90℃':'100℃');report.checks.push(publishConflict?'With asynchronous answer writeback disabled, an unchanged wrong independent/final answer is quarantined in the initial publication while the correct sibling stays ready':'Matching positive question becomes a complete book-attributed document; changed independent answer remains quarantined even when final output agrees with the book');
 for(const q of entries)await inspect(q,false);if(publishConflict){await readiness(entries);report.checks.push('Production Pi reader and paper basket immediately refuse the complete-but-conflicting candidate while the correct sibling stays usable');}report.checks.push('Teacher notebook displays actually used answers at both viewport sizes and can read the original source for ready and conflicted questions');
 async function checkCompact(){
  const unit=sql("SELECT batch_id,ordinal,status,json_extract(input_json,'$.bookPagePolicy') policy FROM material_ai_units WHERE json_extract(input_json,'$.bookRole.kind')='answers'")[0];
  assert.equal(unit.policy,'answer-entry-printed-labels.v4');
  assert.equal(unit.status,'review');
  const view=await page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),
   {schemaVersion:'xiaozhi.material-ai-page.v1',batchId:unit.batch_id,ordinal:unit.ordinal,includeImage:true});
  assert.equal(view.source.page,1);
  assert(view.bookAnswers);
  assert.equal(view.bookAnswers.unresolvedTables,1);
  assert.deepEqual(view.bookAnswers.entries.map(e=>[e.number,e.answer]),[['1','B'],['2','C'],['3','100℃']]);
  assert.equal(view.bookAnswers.entries[0].analysis,'');
  const rows=sql('SELECT number FROM material_book_answer_index_v1 WHERE batch_id=? AND ordinal=? AND start>=0 ORDER BY start',[unit.batch_id,unit.ordinal]);
  assert.deepEqual(rows.map(r=>r.number),['1','2','3']);
  for(const e of view.bookAnswers.entries)assert.equal(view.text.slice(e.start,e.end).trim(),e.quote);
 }
 if(compact){
  await checkCompact();
  assert.equal(entries[0].archive.book.roles.answer.number,'1');
  assert(!entries[0].archive.book.roles.analysis);
  assert.equal(entries[0].analysis,'原题以 B 表示沸腾。');
  report.checks.push('Compact key indexes exact answer cells and writes back its authenticated answer once without substituting an analysis; a short second table stays held');
 }
 async function checkPrinted(){
  const unit=sql("SELECT * FROM material_ai_units WHERE json_extract(input_json,'$.bookRole.kind')='answers'")[0];
  assert.equal(JSON.parse(unit.input_json).bookPagePolicy,'answer-entry-printed-labels.v4');
  for(const receipt of [unit.first_json,unit.final_json])assert.equal(JSON.parse(receipt).pageText,answerText);
  const view=await page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),
   {schemaVersion:'xiaozhi.material-ai-page.v1',batchId:unit.batch_id,ordinal:unit.ordinal,includeImage:true});
  assert.deepEqual(view.bookAnswers.entries.map(e=>[e.number,e.answer,e.issues]),[['1','100℃',[]],['2','100℃',[]]]);
  assert.equal(view.bookAnswers.entries[0].analysis,analysis);
  assert(view.bookAnswers.entries[0].quote.includes(stems[0]));
  for(const e of view.bookAnswers.entries)assert.equal(view.text.slice(e.start,e.end).trim(),e.quote);
  const saved=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),entries[0].id);
  assert.equal(saved.archive.book.roles.answer.number,'1');
  assert.equal(saved.archive.book.roles.analysis.number,'1');
  assert.equal(saved.analysis,analysis);
 }
 if(printed){await checkPrinted();report.checks.push('Print role markers and reprinted stems remain in both receipts; only matched literal answer and analysis enter the notebook');}
 const frozen=sha(JSON.stringify({units:sql('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal'),refs:sql('SELECT * FROM material_ai_book_references ORDER BY batch_id,ordinal'),questions:sql('SELECT * FROM question_bank_items ORDER BY id')}));await app.close();app=undefined;await launch(true);if(compact)await checkCompact();if(printed)await checkPrinted();for(const q of entries)await inspect(q,true);if(publishConflict)await readiness(entries);assert.equal(sha(JSON.stringify({units:sql('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal'),refs:sql('SELECT * FROM material_ai_book_references ORDER BY batch_id,ordinal'),questions:sql('SELECT * FROM question_bank_items ORDER BY id')})),frozen);assert.deepEqual(Object.fromEntries(fs.readdirSync(folder).map(n=>[n,sha(fs.readFileSync(path.join(folder,n)))])),originals);assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).length,8);assert.equal(report.rendererErrors.length,0);report.checks.push('Cold launch revalidates saved reference and question receipts, preserves conflict/source/book attribution and performs no additional model requests');report.success=true;
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{if(app)await app.close();report.requests=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(fs.existsSync(path.join(data,'app.db')))report.units=sql('SELECT status,error FROM material_ai_units');fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
