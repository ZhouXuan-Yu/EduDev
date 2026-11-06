/** C1 actual desktop QA. Parent serial execution only; no build or model work.
 * Default/--check runs only a pure extraction preflight. --run-ui additionally
 * requires the parent's frozen full-out fingerprint. Every domain write uses UI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {choose,disclosureTrigger,enterPaper,ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {visibleUnique,selectTrigger} from './acceptance/paper-basket-ui-locators.mjs';
import {readInstanceBasket,waitInstanceUi} from './acceptance/paper-instance-ui-driver.mjs';
import {waitInstanceCondition} from './acceptance/paper-instance-ui-wait.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const command='node scripts/ui-goal-paper-material-return.mjs --run-ui --expect-build=<frozen-full-out-sha256>';
const original=path.join(desktop,'test-results/ui-goal-paper-instance-boqzvQ');
export const sampleText=marker=>`学科：数学\n年级：初二\n知识点：有理数\n题型：选择题\n难度：easy\n1. C1资料回接${marker}：计算 2+3，选择正确答案。\nA. 4\nB. 5\n答案：B\n解析：将两个正整数相加，2+3=5，所以选B。\n`;
export async function extractionPreflight(marker='离线格式校验') {
  await import('./office-agent/register-source.mjs');
  const {extractMaterialQuestions}=await import('../src/main/assets/material-question-extract.ts');
  const {archiveEligible}=await import('../src/shared/question-archive.ts');
  const text=sampleText(marker),version=sha256(text);
  // Pure parser input only. These synthetic identifiers are NEVER persisted or
  // passed to the UI/host to create any question, source or review receipt.
  const unit={resourceId:'resource_'+randomUUID(),version,title:'C1受控文字原件',offset:0,
    chunk:{id:'chunk_'+randomUUID(),chunkIndex:0,contentMd:text,containsPersonalData:false}};
  const extracted=extractMaterialQuestions([unit],'local-text-v1');
  assert.equal(extracted.length,1);const q=extracted[0];
  assert.equal(q.archive.state,'rule_extracted');assert.deepEqual(q.archive.issues,[]);
  assert.equal(q.fields.answer,'B');assert(q.fields.stem.includes(marker));
  assert.equal(archiveEligible({...q.fields,archive:q.archive}),false,'Import must not fabricate verification');
  return {scope:'pure-sample-parser-only-no-persistence',fields:q.fields,textSha256:version,issues:q.archive.issues};
}
export async function waitMaterialCondition(predicate,label,timeout=30000) {
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const result=await predicate();
    if(result===true)return;
    assert.equal(result,false,'C1 predicate must resolve to a boolean: '+label);
    await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(1,end-Date.now()))));
  }
  throw Error('C1 timeout: '+label);
}
const until=waitMaterialCondition;
export function materialCandidateQuery(marker,question) {
  assert.match(marker,/^[a-z0-9]{6}$/i,'Use this actual owned run marker');
  const query='C1资料回接'+marker;
  assert(question.stem.includes(query),'Search marker must come from the actual imported question');
  return query;
}
export async function candidateQueryRegression() {
  const {fields}=await extractionPreflight('C1TEST');
  assert(fields.stem.slice(0,36).includes('\n'),'Regression must exercise the real multi-line extracted stem');
  const query=materialCandidateQuery('C1TEST',fields);
  assert.equal(query,'C1资料回接C1TEST');assert(!/[\r\n]/.test(query));
  for(const stem of [fields.stem.replace(/\n/g,'\r\n'),fields.stem.replace(/\n/g,' '),fields.stem+'\n教师补正'])
    assert.equal(materialCandidateQuery('C1TEST',{...fields,stem}),query);
  assert.throws(()=>materialCandidateQuery('C1TEST',{...fields,stem:'另一道题'}),/actual imported question/);
  return {scope:'pure-multiline-marker-query-regression-no-persistence',success:true,query};
}
export async function findMaterialCandidate({page,report,owner,basketId,question,marker,revision}) {
  const query=materialCandidateQuery(marker,question);
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await choose(page,page.getByTestId('paper-basket-type'),question.questionType);
  await page.getByTestId('paper-basket-search').fill(query);
  let offset=0;
  for(;;) {
    const expected={stage:'select',revision,query,questionType:question.questionType,offset,scrollTop:0};
    await waitInstanceUi(page,owner,basketId,expected);
    const filters={query,questionType:question.questionType,subject:question.subject,grade:question.grade,offset,limit:12};
    const result=await page.evaluate(input=>window.omniEdu.listQuestionNotebook(input),filters);
    await waitInstanceUi(page,owner,basketId,expected);
    const itemIds=result.items.map(item=>item.id);
    (report.candidateQueries ||= []).push({filters,total:result.total,itemIds,targetId:question.id,expectedRevision:revision});
    if(itemIds.includes(question.id))return visibleUnique(page.getByTestId('paper-basket-candidate')
      .and(page.locator(`[data-question-id="${question.id}"]`)),'Exact source-marker candidate ID on this actual page');
    assert(offset+12<result.total,'Exact imported question must exist in the real paged query; no substitute or API add');
    await (await visibleUnique(page.getByTestId('paper-basket-next'),'Actual next candidate page')).click();
    offset+=12;
  }
}
export async function main(argv=process.argv.slice(2)) {
  assert(argv.every(x=>['--check','--run-ui'].includes(x)||x.startsWith('--expect-build=')),'Unknown argument');
  assert(!(argv.includes('--check')&&argv.includes('--run-ui')),'Choose --check or --run-ui');
  const preflight=await extractionPreflight();
  preflight.candidateQueryRegression=await candidateQueryRegression();
  if(!argv.includes('--run-ui')) {
    console.log(JSON.stringify({preparedOnly:true,execution:false,command,modelCalls:0,preflight,
      scope:'Real local TXT rule extraction -> SAME archived question UI correction/review/save -> exact original basket return -> explicit Add; no manual-new-question substitute.',
      limitations:['Not natural scan/OCR, native figure restoration or mathematical quality acceptance.','Saving/failure/late-return injection belongs to the mounted consumer tests.']}));return;
  }
  const expectedBuild=argv.find(x=>x.startsWith('--expect-build='))?.slice(15);
  assert.match(expectedBuild||'',/^[a-f0-9]{64}$/i,'Parent must pin its final C1 full-out fingerprint');
  const owned=fs.realpathSync(path.join(desktop,'test-results'));
  assert.equal(path.dirname(fs.realpathSync(original)),owned);
  const sourceReport=JSON.parse(fs.readFileSync(path.join(original,'report.json'),'utf8'));
  assert(sourceReport.success && sourceReport.scenario==='U4-B-real-instance-UI');
  const {owner,basketId,witnessBasketId}=sourceReport.references;assert(owner&&basketId&&witnessBasketId);
  const sourceData=path.join(original,'data'),sourceBefore=fingerprint(sourceData).sha256;
  const mainFile=testMain(desktop),buildRoot=path.dirname(path.dirname(mainFile)),buildBefore=fingerprint(buildRoot).sha256;
  assert.equal(buildBefore,expectedBuild.toLowerCase(),'Wrong formal build; no app has started');
  const output=fs.mkdtempSync(path.join(owned,'ui-goal-paper-material-return-'));
  const data=path.join(output,'data'),profile=path.join(output,'profile'),marker=path.basename(output).slice(-6);
  fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(data).sha256,sourceBefore);
  const text=sampleText(marker),file=path.join(output,'C1资料回接-'+marker+'.txt');fs.writeFileSync(file,text);
  const read=(sql,args=[])=>{assert(/^SELECT\b/i.test(sql));const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
  const tableHashes=(table,key='id')=>Object.fromEntries(read('SELECT * FROM '+table+' ORDER BY '+key).map(r=>[r[key],sha256(JSON.stringify(r))]));
  const bankBefore=tableHashes('question_bank_items'),basketBefore=tableHashes('paper_baskets');
  const history=()=>sha256(JSON.stringify(read("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' ORDER BY id")));
  const grants=()=>sha256(JSON.stringify(['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs'].map(t=>read('SELECT * FROM '+t+' ORDER BY conversation_id'))));
  const immutable={history:history(),grants:grants(),ledger:ledger(data)};
  const scriptPaths=['ui-goal-paper-material-return.mjs','acceptance/build-root.mjs','acceptance/evidence.mjs','acceptance/paper-instance-ui-driver.mjs','acceptance/paper-instance-ui-wait.mjs','acceptance/paper-basket-ui-driver.mjs','acceptance/paper-basket-ui-locators.mjs','product-navigation.mjs'];
  const sourcePaths=['src/renderer/App.tsx','src/renderer/components/desktop/DesktopFrame.tsx','src/renderer/components/product/MaterialsWorkspace.tsx','src/renderer/components/QuestionNotebookWorkspace.tsx','src/renderer/components/QuestionArchiveEditor.tsx','src/renderer/components/QuestionContextEditor.tsx','src/renderer/components/paper-ui/PaperBasketWorkspace.tsx','src/renderer/components/paper-ui/usePaperBasketWorkspace.ts','src/renderer/components/paper-ui/paper-material-handoff.ts','src/renderer/components/paper-ui/QuestionEditGuard.tsx','src/main/assets/material-question-extract.ts','src/main/assets/material-question-archive.ts'];
  const hashes=()=>Object.fromEntries([...scriptPaths.map(p=>'scripts/'+p),...sourcePaths].map(p=>[p,sha256(fs.readFileSync(path.join(desktop,p)))]));
  const report={success:false,productAcceptance:false,scenario:'U4-C1-real-material-question-return',original,output,owner,basketId,witnessBasketId,
    sourceBefore,buildBefore,hashesBefore:hashes(),preflight,checks:[],screens:[],errors:[],networkAttempts:[],launches:[],chooser:[],immutable,
    boundaries:['Byte-copy completed owned BUI data; fresh profile. No SQL/API domain writes or authorization rewrite.',
      'Controlled TXT, real local parser and rule archive; SAME host-created question is corrected and saved through original archive UI. No manual-new substitute.',
      'Not a natural OCR/native image, source-mutation injection, saving/failure injection or answer correctness acceptance.',
      'Network observation begins after firstWindow; zero added durable model facts checked independently.']};
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const bankUnchanged=()=>{const after=tableHashes('question_bank_items');for(const [id,h]of Object.entries(bankBefore))assert.equal(after[id],h,'Pre-existing bank row changed');};
  const otherBasketsUnchanged=()=>{const after=tableHashes('paper_baskets');for(const [id,h]of Object.entries(basketBefore))if(id!==basketId)assert.equal(after[id],h,'Other basket changed');};
  let app,page,baseline,saved,newQuestionId,phase='launch';
  async function launch() {
    const {_electron}=await import('playwright');
    const env={...process.env};
    for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    app=await _electron.launch({args:[mainFile,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',()=>report.errors.push({phase,kind:'pageerror'}));
    page.on('console',m=>{if(m.type()==='error')report.errors.push({phase,kind:'console.error'});});
    await app.evaluate(()=>{globalThis.__c1Http=[];const original=globalThis.fetch;globalThis.fetch=function(input){const url=typeof input==='string'?input:input?.url||String(input);if(/^https?:/.test(url)){globalThis.__c1Http.push('blocked-main-http');throw Error('C1 QA forbids network/model work');}return original.apply(this,arguments);};});
    await page.route('**/*',async route=>{if(/^https?:/.test(route.request().url())){report.networkAttempts.push('blocked-renderer-http');await route.abort();}else await route.continue();});
    report.launches.push(await assertIsolatedPiMain(app,mainFile,profile));
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
    assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  }
  async function close() {if(app){const handle=app;app=undefined;try{report.networkAttempts.push(...await handle.evaluate(()=>globalThis.__c1Http));}finally{await handle.close();}}}
  async function captures(label,rootId) {
    const win=await app.browserWindow(page);
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]) {
      await win.evaluate((w,size)=>w.setContentSize(size.width,size.height),size);
      await waitInstanceCondition(page,size=>innerWidth===size.width&&innerHeight===size.height,size,{description:'Actual native content size'});
      const root=await visibleUnique(page.getByTestId(rootId),'Current '+rootId);
      assert.equal(await root.locator('details,summary').count(),0,'No native disclosure triangles on this surface');
      const name=label+'-'+size.width+'.png';await page.screenshot({path:path.join(output,name),animations:'disabled'});
      report.screens.push({file:name,phase,...size});
    }
  }
  async function exactBaseline() {
    await waitInstanceUi(page,owner,basketId,{stage:baseline.uiState.stage,revision:baseline.revision});
    const current=await readInstanceBasket(page,owner,basketId);
    for(const key of ['id','sessionId','revision','blueprint','entries','uiState'])assert.deepEqual(current[key],baseline[key],'Return changed basket '+key);
    bankUnchanged();otherBasketsUnchanged();return current;
  }
  async function pick(cancel) {
    await app.evaluate(({dialog},{cancel,file})=>{
      const original=dialog.showOpenDialog;globalThis.__c1Picker=[];
      dialog.showOpenDialog=async function(...args){
        const options=args.at(-1);
        if(options?.title!=='选择教学资料'||!options.properties?.includes('openFile'))return original.apply(this,args);
        dialog.showOpenDialog=original;globalThis.__c1Picker.push({title:options.title,cancel,file:cancel?undefined:file});
        return {canceled:cancel,filePaths:cancel?[]:[file]};
      };
    },{cancel,file});
    await page.getByTestId('materials-import').click();
    await until(async()=>await app.evaluate(()=>globalThis.__c1Picker.length===1),'one actual file-picker callback');
    report.chooser.push(...await app.evaluate(()=>globalThis.__c1Picker));
    await page.getByTestId('materials-import').and(page.locator(':enabled')).waitFor();
  }
  try {
    await launch();
    const sidebar=page.locator('[data-testid="edu-navigation"]:visible');
    if(await sidebar.getAttribute('data-collapsed')==='true')await sidebar.getByTestId('workbench-sidebar-toggle').click();
    const session=await visibleUnique(sidebar.locator('.wb-conversations > [data-testid="workbench-session-'+owner+'"]'),'Exact source owner in recent conversations');
    await session.click();await session.and(page.locator(':enabled[aria-current="page"]')).waitFor();
    await enterPaper(page);await page.getByTestId('paper-basket-owner-search').fill(owner);
    await choose(page,page.getByTestId('paper-basket-owner'),owner);
    await choose(page,page.getByTestId('paper-basket-saved'),basketId);
    await waitInstanceUi(page,owner,basketId,{stage:'organize'});
    phase='prepare-existing-nonempty-basket';
    const initial=await readInstanceBasket(page,owner,basketId);assert.equal(initial.entries.length,1);
    const fold=disclosureTrigger(page.getByTestId('paper-basket-blueprint-fold'),'蓝图与来源策略');
    if(await fold.getAttribute('aria-expanded')!=='true')await fold.click();
    const blueprint=page.getByTestId('paper-basket-blueprint-fold').getByTestId('paper-basket-blueprint');
    assert.equal(await blueprint.getByTestId('paper-basket-section-editor').count(),1);
    await blueprint.getByTestId('paper-basket-section-count').fill('2');
    await blueprint.getByTestId('paper-basket-section-points').fill('50');
    await blueprint.getByTestId('paper-basket-save-blueprint').click();
    await waitInstanceUi(page,owner,basketId,{stage:'organize',revision:initial.revision+1});
    await page.getByTestId('paper-basket-stage-select').click();
    await waitInstanceUi(page,owner,basketId,{stage:'select'});
    const query='C1返篮偏好'+marker;
    await page.getByTestId('paper-basket-search').fill(query);
    await waitInstanceUi(page,owner,basketId,{stage:'select',query,offset:0});
    await page.getByTestId('paper-basket-stage-organize').click();
    await waitInstanceUi(page,owner,basketId,{stage:'organize',query,offset:0});
    baseline=await readInstanceBasket(page,owner,basketId);report.baseline=baseline;
    await captures('nonempty-original-basket','paper-basket-workspace');
    phase='cancel-import';const bankAtCancel=sha256(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id'))),materialsAtCancel=sha256(JSON.stringify(read('SELECT * FROM teacher_resources ORDER BY id')));
    await page.getByTestId('paper-basket-materials').click();await visibleUnique(page.getByTestId('materials-paper-handoff'),'Material return context');
    await pick(true);await page.getByTestId('materials-notice').filter({hasText:'取消'}).waitFor();
    assert.equal(sha256(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id'))),bankAtCancel);
    assert.equal(sha256(JSON.stringify(read('SELECT * FROM teacher_resources ORDER BY id'))),materialsAtCancel);
    await page.getByTestId('desktop-back').click();await exactBaseline();
    await page.getByTestId('desktop-forward').click();await visibleUnique(page.getByTestId('materials-paper-handoff'),'Forward restores material return context');
    check('Real nonempty basket -> materials; canceled native chooser writes no material/question/member; actual desktop Back/Forward preserves exact basket and preferences');
    phase='real-txt-import';await pick(false);
    let resource;
    await until(()=>{[resource]=read('SELECT * FROM teacher_resources WHERE original_file_name=?',[path.basename(file)]);return resource?.parse_status==='ready';},'actual TXT parser ready',60000);
    assert.equal(resource.parse_engine,'local-text-v1');assert.equal(resource.content_hash,sha256(text));
    const copied=fs.realpathSync(resource.local_path);assert(copied.startsWith(fs.realpathSync(data)+path.sep));assert.equal(sha256(fs.readFileSync(copied)),sha256(text));
    let raw;
    await until(()=>{const found=read('SELECT q.* FROM question_bank_items q JOIN material_question_members m ON m.question_id=q.id WHERE m.resource_id=?',[resource.id]);assert(found.length<=1);[raw]=found;return !!raw;},'actual rule-created archived question',60000);
    newQuestionId=raw.id;assert(!Object.hasOwn(bankBefore,newQuestionId));
    const archive=JSON.parse(raw.archive_json);assert.equal(archive.state,'rule_extracted');assert.equal(archive.sourceChecked,false);assert.equal(archive.extractor,'numbered-text.v1');
    assert.equal(archive.sources.length,1);assert.equal(archive.sources[0].resourceId,resource.id);assert.equal(archive.sources[0].version,resource.content_hash);
    const parsed=await extractionPreflight(marker);for(const [field,key]of [['stem','stem'],['answer','answer'],['analysis','analysis']])assert.equal(raw[field],parsed.fields[key]);
    report.material={id:resource.id,version:resource.content_hash,parseEngine:resource.parse_engine,localPath:copied};report.ruleQuestion={id:newQuestionId,archive};
    await waitInstanceCondition(page,reference=>{
      const root=document.querySelector('[data-testid="materials-detail"]');
      return !!root && root.dataset.resourceId===reference.id && root.dataset.resourceVersion===reference.version;
    },{id:resource.id,version:resource.content_hash},{description:'Same actual imported material detail/version'});
    await page.getByTestId('materials-section-content').click();
    const excerpt=await visibleUnique(page.getByTestId('materials-chunk-'+archive.sources[0].chunkId).and(page.locator(':visible')),'Actual source excerpt for this archived question');
    const sourceText=(await excerpt.innerText()).replace(/\s/g,'');
    assert(sourceText.includes(marker));assert(sourceText.includes('答案：'+raw.answer));assert(sourceText.includes(raw.analysis.replace(/\s/g,'')));
    report.sourceUi={resourceId:resource.id,chunkId:archive.sources[0].chunkId,version:resource.content_hash,textSha256:sha256(await excerpt.innerText())};
    await captures('actual-import-and-rule-archive','materials-workspace');
    check('Actual owned TXT import/local parser creates exactly one source-bound rule archive in the real bank; no fabricated question/API receipt');
    phase='same-question-correction';await page.getByTestId('materials-paper-notebook').click();
    await visibleUnique(page.getByTestId('question-notebook-paper-handoff'),'Notebook return context');
    await page.getByTestId('question-notebook-source-candidates').check();
    await page.getByTestId('question-notebook-search').fill(marker);
    const card=await visibleUnique(page.getByTestId('question-notebook-card-'+newQuestionId),'Exact imported archive question');
    await card.getByTestId('question-archive-edit-'+newQuestionId).click();
    const form=card.getByTestId('question-archive-form'),editedStem=raw.stem+'\n教师已对照本次文字原件核对。';
    await form.getByTestId('question-archive-stem').fill(editedStem);
    const rowBeforeDirty=sha256(JSON.stringify(read('SELECT * FROM question_bank_items WHERE id=?',[newQuestionId])[0]));
    await page.getByTestId('question-notebook-return-paper').click();
    await page.getByTestId('question-edit-guard-notice').waitFor();assert.equal(await form.getByTestId('question-archive-stem').inputValue(),editedStem);
    assert.equal(await page.getByTestId('paper-basket-workspace').count(),0);
    await page.getByTestId('desktop-back').click();await page.getByTestId('desktop-navigation-notice').waitFor();
    assert.equal(await form.getByTestId('question-archive-stem').inputValue(),editedStem);
    const draftValues=()=>form.locator('input,select,textarea').evaluateAll(nodes=>nodes.map(node=>[node.getAttribute('data-testid'),node.value,'checked' in node?node.checked:null]));
    const beforeTab=await draftValues(),focusId=()=>page.evaluate(()=>document.activeElement?.getAttribute('data-testid'));
    await form.getByTestId('question-archive-stem').click();assert.equal(await focusId(),'question-archive-stem');
    await page.keyboard.press('Tab');assert.equal(await focusId(),'question-archive-answer');
    await page.keyboard.press('Shift+Tab');assert.equal(await focusId(),'question-archive-stem');
    assert.deepEqual(await draftValues(),beforeTab,'Real keyboard focus traversal must preserve every dirty form value');
    report.keyboard={forward:'question-archive-answer',backward:'question-archive-stem',draftUnchanged:true};
    assert.equal(sha256(JSON.stringify(read('SELECT * FROM question_bank_items WHERE id=?',[newQuestionId])[0])),rowBeforeDirty);
    await captures('same-archive-dirty-return-blocked','question-notebook-workspace');
    for(const [field,value]of [['subject',baseline.blueprint.subject],['grade',baseline.blueprint.grade],['knowledgePoint','有理数'],['questionType',baseline.blueprint.sections[0].questionType]])await form.getByTestId('question-archive-'+field).fill(value);
    const difficulty=await visibleUnique(form.locator('select'),'Exact archive form difficulty select');
    await difficulty.selectOption('easy');assert.equal(await difficulty.inputValue(),'easy');
    await form.getByTestId('question-archive-source-checked').check();
    await form.getByTestId('question-archive-save').click();await form.waitFor({state:'hidden'});
    let corrected;
    await until(()=>{[corrected]=read('SELECT * FROM question_bank_items WHERE id=?',[newQuestionId]);const a=JSON.parse(corrected.archive_json);return corrected.stem===editedStem&&a.state==='teacher_edited'&&a.sourceChecked&&a.issues.length===0;},'real archive correction saved');
    assert.equal(corrected.answer,raw.answer);assert.equal(corrected.analysis,raw.analysis);
    assert.deepEqual(JSON.parse(corrected.archive_json).sources,archive.sources);
    const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),newQuestionId);assert.equal(question.id,newQuestionId);report.correctedQuestion={id:question.id,archive:question.archive};
    await captures('same-archive-correction-saved','question-notebook-workspace');
    await page.getByTestId('desktop-back').click();await visibleUnique(page.getByTestId('materials-paper-handoff'),'Saved correction permits desktop Back');
    await page.getByTestId('desktop-forward').click();await visibleUnique(page.getByTestId('question-notebook-paper-handoff'),'Desktop Forward restores same handoff');
    await page.getByTestId('question-notebook-return-paper').click();await exactBaseline();
    check('Same rule-created question ID: dirty return/history blocked; original archive save preserves material source; Back/Forward and explicit return restore owner/basket/stage/preferences with unchanged domain revision');
    phase='explicit-add';await captures('returned-original-basket','paper-basket-workspace');
    await page.getByTestId('paper-basket-stage-select').click();await waitInstanceUi(page,owner,basketId,{stage:'select',revision:baseline.revision});
    const row=await findMaterialCandidate({page,report,owner,basketId,question,marker,revision:baseline.revision});
    const candidate=await page.evaluate(input=>window.omniEdu.readPaperBasketCandidateV2(input),{schemaVersion:'xiaozhi.paper-basket.v2',sessionId:owner,basketId,questionId:newQuestionId});
    assert(candidate.ok&&candidate.value.eligibility.available);
    await choose(page,selectTrigger(row,'加入分节'),baseline.blueprint.sections[0].id);
    const beforeAdd=await readInstanceBasket(page,owner,basketId);assert.equal(beforeAdd.revision,baseline.revision);
    await row.getByTestId('paper-basket-add').click();
    await waitInstanceUi(page,owner,basketId,{stage:'select',revision:baseline.revision+1});
    saved=await readInstanceBasket(page,owner,basketId);assert.equal(saved.entries.length,baseline.entries.length+1);
    assert.deepEqual(saved.entries.slice(0,baseline.entries.length),baseline.entries);
    const added=saved.entries.at(-1);assert.equal(added.questionId,newQuestionId);assert.equal(added.contentVersion,candidate.value.contentVersion);assert.deepEqual(added.question,candidate.value.question);
    report.added={entryId:added.entryId,questionId:added.questionId,expectedSourceVersion:candidate.value.contentVersion,revisionBefore:beforeAdd.revision,revisionAfter:saved.revision};
    check('Only explicit candidate selection/Add changes the original basket once (+1), pinning this exact corrected question/source version; previous member remains identical');
    phase='cold-restart';await close();await launch();await enterPaper(page);
    await waitInstanceUi(page,owner,basketId,{stage:saved.uiState.stage,revision:saved.revision});
    const cold=await readInstanceBasket(page,owner,basketId);
    for(const key of ['id','sessionId','revision','blueprint','entries','uiState'])assert.deepEqual(cold[key],saved[key],'Cold basket changed '+key);
    assert.deepEqual(read('SELECT * FROM question_bank_items WHERE id=?',[newQuestionId])[0],corrected);
    await captures('cold-saved-basket','paper-basket-workspace');
    check('Fresh-profile cold restart restores the exact saved basket, preferences and corrected archive without replay or model work');
    bankUnchanged();otherBasketsUnchanged();assert.equal(read('SELECT count(*) n FROM question_bank_items')[0].n,Object.keys(bankBefore).length+1);
    assert.equal(history(),immutable.history);assert.equal(grants(),immutable.grants);assert.deepEqual(ledger(data),immutable.ledger);
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkAttempts,[]);report.success=true;
    check('All original bank rows, other baskets, historical papers and grants remain unchanged; exactly one imported question; zero added paid/model facts and console errors');
  } catch(error) {report.error={phase,name:error.name,message:String(error.message).slice(0,1800)};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});}
  finally {
    try{await close();bankUnchanged();otherBasketsUnchanged();assert.equal(history(),immutable.history);assert.equal(grants(),immutable.grants);assert.deepEqual(ledger(data),immutable.ledger);assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkAttempts,[]);}catch(error){report.success=false;report.finalError=String(error.message).slice(0,1800);}
    report.sourceAfter=fingerprint(sourceData).sha256;report.buildAfter=fingerprint(buildRoot).sha256;report.hashesAfter=hashes();
    if(report.sourceAfter!==sourceBefore||report.buildAfter!==buildBefore||JSON.stringify(report.hashesAfter)!==JSON.stringify(report.hashesBefore)){report.success=false;report.integrityFailed=true;}
    persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,productAcceptance:false}));
  }
  if(!report.success)process.exitCode=1;return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
