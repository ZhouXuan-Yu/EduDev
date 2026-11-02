/** C2a real UI scenario. No app/model/build is run by importing this module.
 * Business writes: original materials import UI only. Extra extract/list calls are
 * explicitly read-only observations, never substituted IPC responses.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha256,fingerprint} from './evidence.mjs';
import {testMain,assertIsolatedPiMain} from './build-root.mjs';
import {ledger,disclosureTrigger} from './paper-basket-ui-driver.mjs';
import {visibleUnique} from './paper-basket-ui-locators.mjs';
import {readInstanceBasket,waitInstanceUi} from './paper-instance-ui-driver.mjs';
import {waitInstanceCondition} from './paper-instance-ui-wait.mjs';
import {readPort,until,jsonEqual} from './paper-export-intent-evidence.mjs';
import {openBasket} from './paper-export-intent-ui.mjs';
import {productEntry} from '../product-navigation.mjs';
import {makeReferenceFixtures,readReferenceTruth,writeReferenceFixtures,privateReferenceProbe} from './paper-reference-fixtures.mjs';
import {referenceSchema,candidateFields,assertReferenceCandidate} from './paper-reference-evidence.mjs';

function baselineInput(desktop,from) {
  const owned=fs.realpathSync(path.join(desktop,'test-results')),original=fs.realpathSync(path.resolve(desktop,from)),rel=path.relative(owned,original);
  assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel),'Only an OWN completed UI fixture is accepted');
  const report=JSON.parse(fs.readFileSync(path.join(original,'report.json'),'utf8'));assert.equal(report.success,true);
  assert(['U4-B-real-instance-UI','U4-C1-real-material-question-return','U4-D1-actual-bound-export-and-superseded-refusal'].includes(report.scenario),'Use a completed actual fixture, not a live D1 review directory');
  const owner=report.normal?.sessionId??report.references?.owner??report.owner,basketId=report.normal?.basketId??report.references?.basketId??report.basketId;
  const otherOwner=report.race?.sessionId??report.references?.witnessOwner;
  assert(owner&&basketId&&otherOwner&&otherOwner!==owner,'Actual baseline must contain the target and an independent existing owner');
  const sourceData=fs.realpathSync(path.join(original,'data'));assert.equal(path.dirname(sourceData),original);
  const sourceProfile=fs.realpathSync(path.join(original,'profile'));assert.equal(path.dirname(sourceProfile),original);
  return {original,sourceData,sourceProfile,owner,basketId,otherOwner};
}
/** Only seam: one actual native material chooser callback, restored in finally. */
async function pickMaterial(app,page,file,cancel,report) {
  await app.evaluate(({dialog},input)=>{
    if(globalThis.__c2aChooser)throw Error('C2a chooser already installed');
    const state={original:dialog.showOpenDialog,calls:[]};globalThis.__c2aChooser=state;
    dialog.showOpenDialog=async function(...args) {
      const options=args.at(-1);
      if(options?.title!=='选择教学资料'||!options.properties?.includes('openFile'))return state.original.apply(this,args);
      if(state.calls.length)throw Error('Unexpected repeated material chooser');
      state.calls.push({title:options.title,canceled:input.cancel,file:input.cancel?undefined:input.file});dialog.showOpenDialog=state.original;
      return {canceled:input.cancel,filePaths:input.cancel?[]:[input.file]};
    };
  },{file,cancel});
  try {
    await page.getByTestId('materials-import').click();
    await until(async()=>await app.evaluate(()=>globalThis.__c2aChooser.calls.length===1),'One actual material chooser callback');
    report.chooser.push(...await app.evaluate(()=>globalThis.__c2aChooser.calls));
    await page.getByTestId('materials-import').and(page.locator(':enabled')).waitFor();
  } finally {await app.evaluate(({dialog})=>{const state=globalThis.__c2aChooser;if(state){dialog.showOpenDialog=state.original;delete globalThis.__c2aChooser;}});}
}
export async function runReferenceUi({desktop,options,offline,budget,protectedFacts,assertCanceledUnchanged}) {
  const mainFile=testMain(desktop),buildRoot=path.dirname(path.dirname(mainFile)),buildBefore=fingerprint(buildRoot).sha256;
  assert.equal(buildBefore,options.expectedBuild,'Wrong pinned build; refused before data copy or app launch');
  const {original,sourceData,sourceProfile,owner,basketId,otherOwner}=baselineInput(desktop,options.from),sourceBefore=fingerprint(sourceData).sha256,profileBefore=fingerprint(sourceProfile).sha256,originalBefore=fingerprint(original).sha256;
  const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-goal-paper-reference-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(data).sha256,sourceBefore);
  fs.cpSync(sourceProfile,profile,{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(profile).sha256,profileBefore);
  assert.equal(fingerprint(sourceData).sha256,sourceBefore,'Source changed during copy; do not use live data');
  const fixtures=await makeReferenceFixtures(),truth=readReferenceTruth(fixtures),manifest=writeReferenceFixtures(path.join(output,'inputs'),fixtures,truth),privateProbe=privateReferenceProbe();
  const privateFile=path.join(output,'inputs',privateProbe.fileName);fs.writeFileSync(privateFile,privateProbe.bytes,{flag:'wx'});
  const read=readPort(path.join(data,'app.db'));
  const rows=(table,key='id')=>Object.fromEntries(read('SELECT * FROM '+table+' ORDER BY '+key).map(row=>[row[key],sha256(JSON.stringify(row))]));
  const basketDomains=()=>Object.fromEntries(read('SELECT * FROM paper_baskets ORDER BY id').map(row=>{
    const stored=JSON.parse(row.data_json);delete stored.uiState;
    return [row.id,sha256(JSON.stringify({...row,data_json:JSON.stringify(stored),updated_at:undefined}))];
  }));
  const originalBank=rows('question_bank_items'),originalBaskets=basketDomains();
  const invariantTables=['ai_conversation_messages','xiaozhi_pi_commands','xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs','xiaozhi_pi_office_drafts','ai_confirmation_items','document_artifacts','document_artifact_paper_sources','document_artifact_sources','paper_instance_events'];
  const immutable=()=>Object.fromEntries(invariantTables.map(table=>[table,sha256(JSON.stringify(read('SELECT * FROM '+table+' ORDER BY rowid')))]));
  const immutableBefore=immutable(),modelBefore=ledger(data);
  const qaFiles=['scripts/ui-goal-paper-reference.mjs','scripts/acceptance/paper-reference-fixtures.mjs','scripts/acceptance/paper-reference-evidence.mjs','scripts/acceptance/paper-reference-ui.mjs',
    'scripts/acceptance/paper-instance-ui-driver.mjs','scripts/acceptance/paper-instance-ui-wait.mjs','scripts/acceptance/build-root.mjs',
    'scripts/acceptance/evidence.mjs','scripts/acceptance/paper-basket-ui-driver.mjs','scripts/acceptance/paper-basket-ui-locators.mjs',
    'scripts/acceptance/paper-export-intent-evidence.mjs','scripts/acceptance/paper-export-intent-ui.mjs','scripts/product-navigation.mjs','scripts/education/paper-ui-disclosure.mjs'];
  const hashes=()=>Object.fromEntries(qaFiles.map(file=>[file,sha256(fs.readFileSync(path.join(desktop,file)))]));
  const report={success:false,productAcceptance:false,scenario:'U4-C2a-real-reference-candidate-UI',original,originalBefore,output,owner,basketId,buildRoot,buildBefore,sourceBefore,profileBefore,qaBefore:hashes(),
    productionBefore:fingerprint(path.join(desktop,'src')).sha256,offline,budget,checks:[],screens:[],chooser:[],errors:[],networkAttempts:[],launches:[],observations:[],readonlyExtractions:0,
    scope:'C2a ONLY: actual TXT/DOCX material import, deterministic source proposal, UI edits/evidence/cancel and source/privacy refusal. No template save/application or Office file acceptance.',
    seams:['One-shot native material chooser only; no business API/IPC or OCR response is mocked.',
      'Controlled source fault: append bytes ONLY to this copied data root imported TXT, recheck through real UI, restore exact bytes in finally. This is a filesystem CAS fault, not a teacher version-update UI.',
      'Additional typed extract/list calls observe real read-only host results; they do not create sessions, questions, baskets, confirmations or receipts.'],
    networkObservation:'HTTP is blocked, without simulated responses, after firstWindow. Earlier startup traffic is not observed; full durable model-ledger hashes/counts independently check no new run/request. No provider keys are inherited.',
    notCovered:['C2b immutable versions/applications and C2c layout snapshots/Office remain unimplemented here.',
      'No paid model, natural-scan quality, cross-student reuse or arbitrary template fidelity is accepted.',
      'Deterministically delayed successful replies belong to mounted tests; actual cancellation records whether UI was still busy, without claiming a late reply if it had already finished.',
      'Question archive teacher edits do not change the original material bytes/chunks and are not fabricated as a reference-source version change.',
      'UI archive/new-basket transitions and truly changed committed contentHash require separate UI-created cases; this runner preserves the original basket.']};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
  let app,page,phase='launch',baseline,cancelBaseline;
  const resources=[];
  async function launch() {
    assert.equal(fingerprint(buildRoot).sha256,buildBefore);const {_electron}=await import('playwright'),env={...process.env};
    for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    app=await _electron.launch({args:[mainFile,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    report.launches.push(await assertIsolatedPiMain(app,mainFile,profile));page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',()=>report.errors.push({phase,kind:'pageerror'}));page.on('console',message=>{if(message.type()==='error')report.errors.push({phase,kind:'console.error'});});
    await app.evaluate(()=>{globalThis.__c2aHttp=[];const previous=globalThis.fetch;globalThis.fetch=function(...args){const value=args[0],url=typeof value==='string'?value:value?.url||String(value);if(/^https?:/.test(url)){globalThis.__c2aHttp.push('blocked-http');return Promise.reject(Error('C2a zero-network QA'));}return previous.apply(this,args);};});
    await page.route('**/*',route=>{if(/^https?:/.test(route.request().url())){report.networkAttempts.push('blocked-renderer-http');return route.abort();}return route.continue();});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  }
  async function close(){if(app){const current=app;app=undefined;try{report.networkAttempts.push(...await current.evaluate(()=>globalThis.__c2aHttp));}finally{await current.close();}}}
  async function captures(name,root) {
    await visibleUnique(root,'C2a screenshot target');assert.equal(await root.locator('details,summary').count(),0);
    for(const [width,height]of [[1366,768],[1920,1080]]) {
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
      await waitInstanceCondition(page,size=>innerWidth===size.width&&innerHeight===size.height,{width,height},{description:'C2a exact viewport'});
      await root.locator(':scope > *').first().scrollIntoViewIfNeeded();
      const file=name+'-'+width+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push({file,width,height});
    }
  }
  const panel=()=>page.getByTestId('paper-reference-panel');
  const target=()=>({schemaVersion:referenceSchema,sessionId:owner,basketId,basketRevision:baseline.revision});
  async function inspect(resource,patch={}) {
    report.readonlyExtractions++;
    return page.evaluate(input=>window.omniEdu.extractPaperReference(input),{...target(),requestId:'qa_read_'+randomUUID(),resourceId:resource.id,version:resource.content_hash,...patch});
  }
  function noEffects() {
    const bank=rows('question_bank_items'),baskets=basketDomains();
    for(const [id,hash]of Object.entries(originalBank))assert.equal(bank[id],hash,'Pre-existing bank row changed');
    jsonEqual(baskets,originalBaskets,'C2a must not change any basket domain field; navigation prefs have a separate exact cancellation baseline');jsonEqual(immutable(),immutableBefore);jsonEqual(ledger(data),modelBefore);
    if(cancelBaseline)assertCanceledUnchanged(cancelBaseline,protectedFacts(read));
  }
  async function exactBasket() {
    await waitInstanceUi(page,owner,basketId,{stage:baseline.uiState?.stage??'select',revision:baseline.revision});
    const current=await readInstanceBasket(page,owner,basketId);
    for(const key of ['id','sessionId','revision','blueprint','entries'])jsonEqual(current[key],baseline[key],'C2a changed '+key);
  }
  async function openReference() {
    await exactBasket();await page.getByTestId('paper-basket-reference').and(page.locator(':enabled')).click();await visibleUnique(panel(),'Reference panel');
    await until(async()=>!await panel().getByTestId('paper-reference-search-submit').isDisabled(),'Actual source list ready');
  }
  async function findSource(resource) {
    const source=panel().getByTestId('paper-reference-source').and(page.locator(`[data-resource-id="${resource.id}"]`));
    await panel().getByTestId('paper-reference-search').fill(resource.original_file_name);
    await panel().getByTestId('paper-reference-search-submit').click();
    await until(async()=>!await panel().getByTestId('paper-reference-search-submit').isDisabled(),'Exact query source list ready');
    assert.equal(await source.count(),1,'Exact imported resource must be in its actual filtered page');return source;
  }
  async function extractUi(resource) {
    await (await findSource(resource)).getByTestId('paper-reference-extract-'+resource.id).click();
    await visibleUnique(panel().getByTestId('paper-reference-coverage'),'Actual candidate coverage');
    await until(async()=>!await panel().getByTestId('paper-reference-recheck').isDisabled(),'Actual extraction settled');
  }
  async function verifyVisible(candidate) {
    const coverage=await panel().getByTestId('paper-reference-coverage').innerText();
    assert(coverage.includes(`已读取${candidate.source.readChunks}/${candidate.source.totalChunks}段正文`));assert(coverage.includes('已读取全部已收录正文'));
    const context=panel().getByTestId('paper-reference-context'),contextTrigger=disclosureTrigger(context,'来源正文节选');
    await contextTrigger.click();jsonEqual(await context.locator('pre').allTextContents(),candidate.evidence.filter(item=>item.id.startsWith('context_')).map(item=>item.text));
    await contextTrigger.click();
    const layout=disclosureTrigger(panel().getByTestId('paper-reference-layout'),'卷面规则候选');
    if(await layout.getAttribute('aria-expanded')!=='true')await layout.click();
    for(const [fieldPath,field]of Object.entries(candidateFields(candidate))) {
      const input=panel().getByTestId('paper-reference-input-'+fieldPath);await visibleUnique(input,'Real candidate field '+fieldPath);
      assert.equal(await input.inputValue(),field.teacherValue??field.value??'');
      const group=panel().getByTestId('paper-reference-field-'+fieldPath);assert((await group.innerText()).includes('原文提取：'+(field.value??'未知')));
      if(field.evidenceIds.length) {
        const evidence=panel().getByTestId('paper-reference-evidence-'+fieldPath),button=evidence.locator('[data-slot="disclosure-trigger"]');
        if(await button.getAttribute('aria-expanded')!=='true')await button.click();
        const actual=await evidence.locator('pre').allTextContents();jsonEqual(actual,candidate.evidence.filter(e=>field.evidenceIds.includes(e.id)).map(e=>e.text));
      }
    }
    assert.equal(await panel().getByRole('button',{name:/保存模板|应用结构|应用版式|同时应用/}).count(),0,'C2a cannot show fake save/application');
  }
  async function cancelDirty(expected) {
    await panel().getByTestId('paper-reference-cancel').click();await visibleUnique(panel().getByTestId('paper-reference-discard-prompt'),'Explicit dirty discard prompt');
    assert.equal(await panel().getByTestId('paper-reference-input-title').inputValue(),expected);
    await panel().getByRole('button',{name:'继续核对',exact:true}).click();assert.equal(await panel().getByTestId('paper-reference-discard-prompt').count(),0);
    await panel().getByTestId('paper-reference-cancel').click();await panel().getByTestId('paper-reference-discard').click();
    await panel().waitFor({state:'hidden'});await exactBasket();noEffects();
  }
  persist();
  try {
    await launch();phase='original-material-import';baseline=await openBasket(page,owner,basketId);assert(baseline.state==='active'&&baseline.entries.length>0);
    await page.getByTestId('paper-basket-materials').click();await visibleUnique(page.getByTestId('materials-import'),'Original material importer');
    const beforeCancel=sha256(JSON.stringify(read('SELECT * FROM teacher_resources ORDER BY id')));await pickMaterial(app,page,undefined,true,report);
    assert.equal(sha256(JSON.stringify(read('SELECT * FROM teacher_resources ORDER BY id'))),beforeCancel);noEffects();
    for(const input of [...manifest.files,{key:'PRIVATE',path:privateFile,sha256:sha256(privateProbe.bytes)}]) {
      assert.equal(read('SELECT id FROM teacher_resources WHERE content_hash=?',[input.sha256]).length,0,'Fixture must be a genuinely new UI import in this copy');
      await pickMaterial(app,page,input.path,false,report);
      let resource;await until(()=>{[resource]=read('SELECT * FROM teacher_resources WHERE content_hash=?',[input.sha256]);return !!resource&&['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parse_status);},'Actual local material parser ready',90000);
      await until(()=>{const jobs=read('SELECT status,error FROM material_question_jobs WHERE resource_id=?',[resource.id]);
        if(input.key==='PRIVATE'&&jobs.length===1&&['complete','failed'].includes(jobs[0].status)){report.privateArchiveJob=jobs[0];return true;}
        return jobs.length===1&&jobs[0].status==='complete';},'Legitimate rule archive import settled',90000);resources.push(resource);
    }
    report.resources=resources.map(r=>({id:r.id,version:r.content_hash,parseEngine:r.parse_engine,localPath:r.local_path}));
    assert(read('SELECT id FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0',[resources[2].id]).length>0,'Private probe must be marked by the REAL parser, never SQL');
    baseline=await openBasket(page,owner,basketId);noEffects();cancelBaseline=protectedFacts(read);report.cancelBaseline=cancelBaseline;
    check('Original UI imports two distinct TXT/DOCX byte fixtures plus reserved-address privacy probe; chooser cancel has no material/basket/domain side effects');
    for(let index=0;index<2;index++) {
      phase='candidate-'+fixtures[index].key;const resource=resources[index];await openReference();await extractUi(resource);
      const observed=await inspect(resource);assert.equal(observed.ok,true);
      const chunks=read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]);
      report.observations.push(assertReferenceCandidate(observed.value,{fixture:fixtures[index],truth:truth[index],resource,chunks}));await verifyVisible(observed.value);
      await captures('candidate-'+fixtures[index].key,panel());
      const edited='教师修订'+fixtures[index].key+'-'+path.basename(output),input=panel().getByTestId('paper-reference-input-title');await input.fill(edited);
      const titleGroup=panel().getByTestId('paper-reference-field-title');await titleGroup.getByRole('checkbox').check();assert((await titleGroup.innerText()).includes('原文提取：'+truth[index].facts.title));
      await input.focus();await page.keyboard.press('Tab');assert.equal(await input.evaluate(node=>document.activeElement!==node),true);await page.keyboard.press('Shift+Tab');assert.equal(await input.evaluate(node=>document.activeElement===node),true);assert.equal(await input.inputValue(),edited);
      await (await visibleUnique(productEntry(page,'materials'),'Real materials navigation')).click();
      await visibleUnique(page.getByTestId('desktop-navigation-notice'),'Real navigation guard');assert.equal(await input.inputValue(),edited);await visibleUnique(panel(),'Dirty reference stays mounted');
      await panel().getByTestId('paper-reference-change-source').click();await visibleUnique(panel().getByTestId('paper-reference-discard-prompt'),'Dirty source switch guarded');
      await panel().getByRole('button',{name:'继续核对',exact:true}).click();assert.equal(await input.inputValue(),edited);
      if(index===0) {
        const owned=fs.realpathSync(path.join(data,'teacher_resources')),file=fs.realpathSync(resource.local_path);assert.equal(path.dirname(file),owned);
        const bytes=fs.readFileSync(file);assert.equal(sha256(bytes),resource.content_hash);
        try {
          fs.appendFileSync(file,'\n受控OWN副本来源变化探针\n');
          await panel().getByTestId('paper-reference-recheck').click();await panel().getByTestId('paper-reference-error').filter({hasText:'参考资料已变化'}).waitFor();
          await until(async()=>!await panel().getByTestId('paper-reference-recheck').isDisabled(),'Source CAS refusal settled');
          assert.equal(await input.inputValue(),edited);assert((await titleGroup.innerText()).includes('原文提取：'+truth[index].facts.title));await captures('source-changed-retains-edit',panel());
          report.sourceFault={scope:'Controlled original-bytes CAS in copied data only',resourceId:resource.id,draftRetained:true};
        } finally {fs.writeFileSync(file,bytes);assert.equal(sha256(fs.readFileSync(file)),resource.content_hash);}
        await panel().getByTestId('paper-reference-recheck').click();await panel().getByTestId('paper-reference-error').filter({hasText:'已重新核实来源'}).waitFor();assert.equal(await input.inputValue(),edited);
      }
      await captures('dirty-'+fixtures[index].key,panel());await cancelDirty(edited);
      check(fixtures[index].key+': real source-dependent fields/evidence/unknowns match independent bytes; keyboard, dirty navigation/source-switch guard and explicit discard preserve basket');
    }
    phase='read-only-guards';
    const privateList=await page.evaluate(input=>window.omniEdu.listPaperReferenceSources(input),{...target(),query:privateProbe.fileName,offset:0});
    assert.equal(privateList.ok,true);assert(!privateList.value.items.some(item=>item.resourceId===resources[2].id));
    assert.deepEqual(await inspect(resources[2]),{ok:false,error:'permission_denied'});
    assert.deepEqual(await inspect(resources[0],{basketRevision:baseline.revision+1}),{ok:false,error:'conflict'});
    assert.deepEqual(await inspect(resources[0],{version:'0'.repeat(64)}),{ok:false,error:'source_changed'});
    assert.deepEqual(await inspect(resources[0],{sessionId:otherOwner}),{ok:false,error:'permission_denied'});report.ownerGuard={otherOwner,scope:'Actual other owner; not a student-context reuse claim'};
    noEffects();check('Real private-marked source is hidden and denied; stale target revision/source version and existing other owner cannot read the candidate');
    phase='cancel-and-cold';await openReference();const source=await findSource(resources[0]);await source.getByTestId('paper-reference-extract-'+resources[0].id).click();
    report.cancelProbe={busyAtCancel:await panel().getByText('正在读取确切来源版本；可取消，迟到结果不会覆盖输入。',{exact:true}).count()===1};
    await panel().getByTestId('paper-reference-cancel').click();await panel().waitFor({state:'hidden'});
    await until(async()=>{const result=await inspect(resources[1]);if(!result.ok&&result.error==='busy')return false;assert.equal(result.ok,true);return true;},'Actual host extraction settled after UI cancel');
    assert.equal(await panel().count(),0,'Completed/cancelled old request must not reopen its UI');noEffects();
    report.cancelProbe.coverage=report.cancelProbe.busyAtCancel?'Actual in-flight cancel; no reopened candidate after host settled':'Request had already completed; no deterministic late-result coverage claimed';
    await close();await launch();await openBasket(page,owner,basketId);await exactBasket();assert.equal(await panel().count(),0,'Canceled C2a candidate is not a saved template');
    await captures('cold-original-basket',page.getByTestId('paper-basket-workspace'));noEffects();assert.deepEqual(report.errors,[]);
    check('Actual cancel closes candidate without writes; cold start preserves original nonempty basket/current source bytes without model replay');report.success=true;
  } catch(error) {
    report.error={phase,name:error.name,message:String(error.message).slice(0,2500)};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
  } finally {
    try{await close();}catch(error){report.success=false;report.closeError=String(error.message);}
    try {
      noEffects();assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkAttempts,[]);
      report.sourceAfter=fingerprint(sourceData).sha256;assert.equal(report.sourceAfter,sourceBefore);
      report.sourceProfileAfter=fingerprint(sourceProfile).sha256;assert.equal(report.sourceProfileAfter,profileBefore);
      report.originalAfter=fingerprint(original).sha256;assert.equal(report.originalAfter,originalBefore,'Completed D1 report, files, data and profile must remain byte-identical');
      report.buildAfter=fingerprint(buildRoot).sha256;assert.equal(report.buildAfter,buildBefore);
      report.productionAfter=fingerprint(path.join(desktop,'src')).sha256;assert.equal(report.productionAfter,report.productionBefore);
      report.qaAfter=hashes();jsonEqual(report.qaAfter,report.qaBefore);report.modelAfter=ledger(data);
      report.cancelAfter=protectedFacts(read);
    }catch(error){report.success=false;report.integrityError=String(error.message);}
    persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,modelCalls:report.success?0:null,productAcceptance:false}));
  }
  if(!report.success)process.exitCode=1;return report;
}
