/** Actual Electron runner. No business write API invocation and no SQL writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fingerprint,sha256} from './evidence.mjs';
import {testMain,assertIsolatedPiMain} from './build-root.mjs';
import {readPort,until,jsonEqual} from './paper-export-intent-evidence.mjs';
import {ledger} from './paper-basket-ui-driver.mjs';
import {openBasket,captureUi} from './paper-export-intent-ui.mjs';
import {readInstanceBasket,waitInstanceUi} from './paper-instance-ui-driver.mjs';
import {makeReferenceFixtures,readReferenceTruth,writeReferenceFixtures} from './paper-reference-fixtures.mjs';
import {assertReferenceCandidate} from './paper-reference-evidence.mjs';
import {budget,matrix,notCovered} from './paper-template-contract.mjs';
import {verifyPaperPreviewViewport} from './paper-preview-viewport.mjs';
import {templatePanel,readTemplates,readTemplateList,confirmCandidate,closeCandidate,extractCandidate,loadVersion,mapSections,assertMembers,assertDerivedStates,assertDisplayedRole,expand} from './paper-template-ui.mjs';

export const contractFiles=['src/shared/paper-template.ts','src/shared/paper-basket-c2.ts','src/renderer/components/paper-ui/PaperTemplatePanel.tsx','src/renderer/components/paper-ui/PaperTemplateRetained.tsx','src/renderer/components/paper-ui/PaperReferenceFields.tsx','src/renderer/components/paper-ui/usePaperTemplates.ts'];
export const contractHash=desktop=>sha256(JSON.stringify(contractFiles.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}))));
const qaFiles=['scripts/ui-final-paper-template.mjs','scripts/acceptance/paper-template-contract.mjs','scripts/acceptance/paper-template-ui.mjs','scripts/acceptance/paper-template-run.mjs',
  'scripts/acceptance/paper-reference-ui.mjs','scripts/acceptance/paper-reference-fixtures.mjs','scripts/acceptance/paper-reference-evidence.mjs',
  'scripts/acceptance/paper-instance-ui-driver.mjs','scripts/acceptance/paper-instance-ui-wait.mjs','scripts/acceptance/paper-export-intent-ui.mjs',
  'scripts/acceptance/paper-export-intent-evidence.mjs','scripts/acceptance/paper-basket-ui-driver.mjs','scripts/acceptance/paper-basket-ui-locators.mjs',
  'scripts/acceptance/build-root.mjs','scripts/acceptance/evidence.mjs','scripts/product-navigation.mjs','scripts/education/paper-ui-disclosure.mjs',
  'scripts/acceptance/paper-preview-viewport.mjs'];
const qaHashes=desktop=>Object.fromEntries(qaFiles.map(f=>[f,sha256(fs.readFileSync(path.join(desktop,f)))]));
const domain=b=>{const v=structuredClone(b);delete v.uiState;return v;};

export async function runTemplates(desktop,options){
  const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main)),sourceRoot=path.join(desktop,'src');
  assert.equal(fingerprint(buildRoot).sha256,options.build,'Pinned full build');assert.equal(fingerprint(sourceRoot).sha256,options.source,'Pinned production source');assert.equal(contractHash(desktop),options.contract,'Pinned typed/selectors');
  const owned=fs.realpathSync(path.join(desktop,'test-results')),original=fs.realpathSync(path.resolve(desktop,options.from));
  assert.equal(path.dirname(original),owned);const originalBefore=fingerprint(original).sha256;
  const baseline=JSON.parse(fs.readFileSync(path.join(original,'report.json')));assert.equal(baseline.success,true);assert.equal(baseline.scenario,'U4-D1-actual-bound-export-and-superseded-refusal');
  const owner=baseline.normal?.sessionId,basketId=baseline.normal?.basketId;assert(owner&&basketId,'Real baseline identity');
  for(const name of ['data','profile'])assert.equal(path.dirname(fs.realpathSync(path.join(original,name))),original);
  const output=fs.mkdtempSync(path.join(owned,'ui-final-paper-template-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  for(const name of ['data','profile']){fs.cpSync(path.join(original,name),path.join(output,name),{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(path.join(output,name)).sha256,fingerprint(path.join(original,name)).sha256);}
  const read=readPort(path.join(data,'app.db')),target={sessionId:owner,basketId},fixtures=await makeReferenceFixtures(),truth=readReferenceTruth(fixtures),manifest=writeReferenceFixtures(path.join(output,'inputs'),fixtures,truth);
  const report={success:false,productAcceptance:false,scenario:'A28-C2b-real-template-UI',scope:'Real imports/save immutable versions/independent applications/retained display/cold only',output,original,originalBefore,budget,matrix,notCovered,checks:[],screens:[],errors:[],networkAttempts:[],launches:[],chooser:[],operations:[],qaBefore:qaHashes(desktop),pins:options};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const check=name=>{report.checks.push({name,pass:true});persist();};
  const tables=['question_bank_items','paper_instance_events','ai_conversation_messages','xiaozhi_pi_commands','xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs','xiaozhi_pi_office_drafts','ai_confirmation_items','document_artifacts','document_artifact_paper_sources','document_artifact_sources'];
  const immutable=()=>Object.fromEntries(tables.map(t=>[t,sha256(JSON.stringify(read('SELECT * FROM '+t+' ORDER BY rowid')))]));
  const beforeImmutable=immutable(),beforeModel=ledger(data),bankBefore=read('SELECT * FROM question_bank_items ORDER BY id');
  const witnessBefore=read('SELECT * FROM paper_baskets WHERE id<>? ORDER BY id',[basketId]);
  // Imports legitimately add bank rows; pre-existing rows remain byte-identical.
  delete beforeImmutable.question_bank_items;
  const noUnexpected=()=>{const now=immutable();delete now.question_bank_items;jsonEqual(now,beforeImmutable,'No model/Office/instance/history writes');for(const row of bankBefore)jsonEqual(read('SELECT * FROM question_bank_items WHERE id=?',[row.id]),[row]);jsonEqual(ledger(data),beforeModel);jsonEqual(read('SELECT * FROM paper_baskets WHERE id<>? ORDER BY id',[basketId]),witnessBefore,'Independent witness baskets unchanged');};
  const versions=()=>read('SELECT * FROM paper_template_versions ORDER BY template_id,version');
  const receipts=()=>read('SELECT * FROM paper_template_receipts ORDER BY session_id,request_id');
  const storedBasket=()=>JSON.parse(read('SELECT data_json FROM paper_baskets WHERE id=? AND session_id=?',[basketId,owner])[0].data_json);
  // The authorized baseline predates C2. Only production startup may migrate its copy.
  const observedReceipts=new Set();
  const observeReceipts=()=>{for(const row of receipts()){const key=row.session_id+':'+row.request_id;if(!observedReceipts.has(key)){observedReceipts.add(key);(report.observedReceipts??=[]).push({phase,receipt:JSON.parse(row.result_json),inputDigest:row.input_digest});}}persist();};
  let app,page,phase='launch',originalBasket,finalBasket,finalVersions;
  const resources=[];
  async function launch(){
    assert.equal(report.launches.length<budget.electronLaunches,true,'Fixed launch budget');assert.equal(fingerprint(buildRoot).sha256,options.build);assert.equal(fingerprint(sourceRoot).sha256,options.source);
    const {_electron}=await import('playwright'),env={...process.env};
    for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',OMNI_EDU_E2E_TEMPLATE_TRACE:'1'});
    app=await _electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    let traceBuffer='';
    app.process().stdout?.on('data',chunk=>{
      traceBuffer+=String(chunk);const lines=traceBuffer.split(/\r?\n/);traceBuffer=lines.pop();
      for(const line of lines){const marker=line.indexOf('[paper-template-read] ');if(marker<0)continue;
        try{const v=JSON.parse(line.slice(marker+22));
          if(typeof v.stage==='string'&&typeof v.elapsedMs==='number'&&typeof v.requestId==='string')
            (report.templateReadTimings??=[]).push({requestId:v.requestId,stage:v.stage,elapsedMs:v.elapsedMs});
        }catch{report.errors.push({phase,kind:'invalid-template-trace'});}
      }
    });
    report.launches.push(await assertIsolatedPiMain(app,main,profile));page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',()=>report.errors.push({phase,kind:'pageerror'}));page.on('console',m=>{if(m.type()==='error')report.errors.push({phase,kind:'console.error'});});
    await app.evaluate(()=>{globalThis.__templateHttp=[];const fetch=globalThis.fetch;globalThis.fetch=function(...args){const v=args[0],url=typeof v==='string'?v:v?.url||String(v);if(/^https?:/.test(url)){globalThis.__templateHttp.push('blocked-http');return Promise.reject(Error('Template QA zero network'));}return fetch.apply(this,args);};});
    await page.route('**/*',r=>{if(/^https?:/.test(r.request().url())){report.networkAttempts.push('blocked-renderer-http');return r.abort();}return r.continue();});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  }
  async function close(){if(app){const a=app;app=undefined;try{report.networkAttempts.push(...await a.evaluate(()=>globalThis.__templateHttp));}finally{await a.close();}}}
  async function importFile(file){
    // Sole seam: actual native file chooser, restored even on failure.
    await app.evaluate(({dialog},file)=>{if(globalThis.__templateChooser)throw Error('Chooser occupied');globalThis.__templateChooser={original:dialog.showOpenDialog,calls:0};dialog.showOpenDialog=async function(...args){const s=globalThis.__templateChooser,o=args.at(-1);if(o?.title!=='选择教学资料'||!o.properties?.includes('openFile'))return s.original.apply(this,args);if(s.calls++)throw Error('Repeated chooser');dialog.showOpenDialog=s.original;return {canceled:false,filePaths:[file]};};},file);
    try{await page.getByTestId('materials-import').click();await until(async()=>await app.evaluate(()=>globalThis.__templateChooser.calls===1),'One real import chooser');report.chooser.push({file});await until(async()=>!await page.getByTestId('materials-import').isDisabled(),'Import UI settled');}
    finally{await app.evaluate(({dialog})=>{if(globalThis.__templateChooser){dialog.showOpenDialog=globalThis.__templateChooser.original;delete globalThis.__templateChooser;}});}
  }
  async function save(kind,mode,name,prior){
    const panel=await templatePanel(page),old=versions(),oldReceipts=receipts(),b=domain(await readInstanceBasket(page,owner,basketId));
    await panel.getByTestId('paper-template-name').fill(name);
    const id=mode==='new'?'paper-template-save-':mode==='version'?'paper-template-new-version-':'paper-template-copy-';
    await panel.getByTestId(id+kind).click();
    await until(()=>versions().length===old.length+1,'Exactly one immutable version saved');
    await until(async()=>!await panel.getByTestId('paper-template-refresh').isDisabled(),'Save plus actual readback settled');
    assert.match(await panel.getByTestId('paper-template-status').innerText(),/已.*保存|已保存/);
    const current=versions();for(const row of old)jsonEqual(current.find(r=>r.template_id===row.template_id&&r.version===row.version),row,'Old immutable version unchanged');
    assert.equal(receipts().length,oldReceipts.length+1,'Exactly one save receipt');
    const added=current.find(r=>!old.some(o=>o.template_id===r.template_id&&o.version===r.version)),v=JSON.parse(added.data_json);
    assert.equal(v.name,name);assert.equal(v.kind,kind);assert.equal(v.digest,added.digest);
    if(mode==='version'){assert.equal(v.templateId,prior.templateId);assert.equal(v.version,prior.version+1);}else{assert.equal(v.version,1);if(prior){assert.notEqual(v.templateId,prior.templateId);jsonEqual(v.derivedFrom,{templateId:prior.templateId,version:prior.version,digest:prior.digest});}}
    jsonEqual(domain(await readInstanceBasket(page,owner,basketId)),b,'Saving must not apply or mutate basket');
    assert((await readTemplates(page,target)).some(x=>x.templateId===v.templateId&&x.version===v.version&&x.digest===v.digest));
    report.operations.push({kind:'save',mode,templateId:v.templateId,version:v.version,digest:v.digest});check(kind+' '+mode+' immutable save and exact readback');return v;
  }
  async function apply(kind,structure,layout,mappingMode){
    await closeCandidate(page);const p=await templatePanel(page),before=await readInstanceBasket(page,owner,basketId),oldReceipts=receipts(),oldVersions=versions(),storedBefore=storedBasket();
    let mapping=[];if(kind!=='layout')mapping=await mapSections(page,structure,before,mappingMode);
    if(kind!=='structure'){const {choose}=await import('./paper-basket-ui-driver.mjs');await choose(page,p.getByTestId('paper-template-layout'),layout.templateId+':'+layout.version);}
    const button=p.getByTestId('paper-template-apply-'+kind);if(kind==='both')await button.dblclick();else await button.click();
    await until(async()=>{const b=await readInstanceBasket(page,owner,basketId);return b.revision===before.revision+1;},'One atomic basket revision');
    await until(async()=>!await p.getByTestId('paper-template-refresh').isDisabled(),'Apply reload settled');
    observeReceipts();const after=await readInstanceBasket(page,owner,basketId);jsonEqual(storedBasket().entries,storedBefore.entries,'SQL original data_json.entries must remain fully identical');assertMembers(before,after);await assertDerivedStates(before,after);assert.equal(after.revision,before.revision+1);assert.equal(receipts().length,oldReceipts.length+1);jsonEqual(versions(),oldVersions);
    const ref=v=>({templateId:v.templateId,version:v.version,digest:v.digest});
    if(kind==='layout'){jsonEqual(after.blueprint,before.blueprint);jsonEqual(after.c2.structureTemplate,before.c2?.structureTemplate);}
    else{jsonEqual(after.c2.structureTemplate,ref(structure));jsonEqual(after.blueprint.sections.map(s=>s.id),mapping.map(m=>m.target.sectionId));}
    if(kind==='structure'){jsonEqual(after.c2.layout,before.c2?.layout);jsonEqual(after.c2.layoutTemplate,before.c2?.layoutTemplate);}else{jsonEqual(after.c2.layoutTemplate,ref(layout));jsonEqual(after.c2.layout,layout.layout);}
    const receipt=receipts().find(r=>!oldReceipts.some(o=>o.session_id===r.session_id&&o.request_id===r.request_id));assert.equal(JSON.parse(receipt.result_json).basketRevision,after.revision);
    report.operations.push({kind:'apply',mode:kind,beforeRevision:before.revision,afterRevision:after.revision,mapping});check(kind+' UI apply: one revision/receipt, exact bindings, all members and points preserved');return after;
  }
  persist();
  try{
    await launch();phase='post-startup-receipt-baseline';for(const row of receipts())observedReceipts.add(row.session_id+':'+row.request_id);
    originalBasket=await openBasket(page,owner,basketId);assert(originalBasket.entries.length>0&&originalBasket.state==='active');assert.equal(originalBasket.blueprint.mode,'source_only','Authorized fixed baseline; hybrid is a separate case');
    phase='imports';await page.getByTestId('paper-basket-materials').click();
    for(const input of manifest.files){assert.equal(read('SELECT id FROM teacher_resources WHERE content_hash=?',[input.sha256]).length,0,'Genuinely new import');await importFile(input.path);let resource;
      await until(()=>{[resource]=read('SELECT * FROM teacher_resources WHERE content_hash=?',[input.sha256]);return !!resource&&['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parse_status);},'Actual parser ready',90000);
      await until(()=>{const jobs=read('SELECT status FROM material_question_jobs WHERE resource_id=?',[resource.id]);return jobs.length===1&&jobs[0].status==='complete';},'Actual archive settled',90000);resources.push(resource);}
    await openBasket(page,owner,basketId);noUnexpected();check('Two actual TXT/DOCX UI imports; no pre-existing facts modified');
    const saved={};
    for(const [index,kind]of [[0,'structure'],[1,'layout']]){
      phase=kind+'-versions';const b=await readInstanceBasket(page,owner,basketId),candidate=await extractCandidate(page,resources[index],target,b.revision);
      assertReferenceCandidate(candidate,{fixture:fixtures[index],truth:truth[index],resource:resources[index],chunks:read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resources[index].id])});
      await confirmCandidate(page,candidate,kind);const name='QA '+kind+' '+path.basename(output);
      const v1=await save(kind,'new',name);await closeCandidate(page);await loadVersion(page,v1);
      const title=page.getByTestId('paper-reference-input-title'),teacherTitle='教师修订 '+kind+' '+path.basename(output);await title.fill(teacherTitle);
      const edited=structuredClone(v1.candidate);edited.title.teacherValue=teacherTitle;edited.title.confirmed=false;await confirmCandidate(page,edited,kind);
      const v2=await save(kind,'version',name+' v2',v1);assert.equal(v2.candidate.title.teacherValue,teacherTitle);jsonEqual(v2.candidate.evidence,v1.candidate.evidence,'Teacher edit preserves original evidence');
      await closeCandidate(page);await loadVersion(page,v2);const copy=await save(kind,'copy',name+' copy',v2);saved[kind]={v1,v2,copy};await closeCandidate(page);
    }
    phase='cancel-draft';await loadVersion(page,saved.structure.v2);const draftBefore=versions(),receiptBefore=receipts(),basketBefore=domain(await readInstanceBasket(page,owner,basketId));
    const title=page.getByTestId('paper-reference-input-title');await title.fill('取消草稿 '+path.basename(output));await page.getByTestId('paper-reference-cancel').click();await page.getByTestId('paper-reference-discard-prompt').waitFor();await page.getByTestId('paper-reference-panel').getByRole('button',{name:'继续核对',exact:true}).click();assert.equal(await title.inputValue(),'取消草稿 '+path.basename(output));await closeCandidate(page);
    jsonEqual(versions(),draftBefore);jsonEqual(receipts(),receiptBefore);jsonEqual(domain(await readInstanceBasket(page,owner,basketId)),basketBefore);check('Dirty cancel/keep/discard preserves versions/receipts/basket');
    phase='applications';await apply('structure',saved.structure.v1,undefined,'new');await apply('layout',undefined,saved.layout.v1);
    finalBasket=await apply('both',saved.structure.v2,saved.layout.v2,'retained-existing');
    assert(finalBasket.c2.retainedSections.some(r=>!r.entryIds.length&&!r.released),'Actual empty retained section must exist');
    const conflicts=finalBasket.entries.filter(e=>finalBasket.c2.entryPoints[e.entryId]!==finalBasket.blueprint.sections.find(s=>s.id===e.sectionId)?.points&&finalBasket.blueprint.sections.some(s=>s.id===e.sectionId));
    assert(conflicts.length>0,'Actual original/target point conflict must exist');
    for(const e of conflicts){const card=page.getByTestId('paper-template-points-conflict').filter({hasText:e.entryId});assert.equal(await card.count(),1);assert((await card.innerText()).includes('保留原分值 '+finalBasket.c2.entryPoints[e.entryId]));}
    phase='retained-display';
    for(const r of finalBasket.c2.retainedSections){const card=page.getByTestId('paper-template-retained-section').filter({hasText:r.section.label});assert.equal(await card.count(),1,'Unique retained definition');const text=await card.innerText();assert(text.includes(String(r.section.count)+'题'));assert(text.includes(String(r.section.points)+'分'));assert(text.includes('当前 '+r.entryIds.length+'题'));if(r.entryIds.length&&!r.released)assert.equal(await card.getByTestId('paper-template-release-empty').isDisabled(),true);}
    for(const [stage,testId]of [['organize','paper-basket-entry'],['preview','paper-basket-preview-entry']]){
      await page.getByTestId('paper-basket-stage-'+stage).click();
      await waitInstanceUi(page,owner,basketId,{stage,revision:finalBasket.revision});
      const cards=page.getByTestId(testId);assert.equal(await cards.count(),finalBasket.entries.length,'Every original member must render after the exact saved stage is ready');
      for(const e of finalBasket.entries){const card=cards.and(page.locator(`[data-entry-id="${e.entryId}"]`));assert.equal(await card.count(),1);assert.equal(await card.isVisible(),true);await assertDisplayedRole(card.getByTestId('paper-basket-question-stem'),e,'question');}
      if(stage==='preview'){const teacher=page.getByTestId('paper-basket-teacher');await teacher.click();await until(async()=>await teacher.getAttribute('aria-selected')==='true','Teacher preview selected');for(const e of finalBasket.entries){const card=cards.and(page.locator(`[data-entry-id="${e.entryId}"]`));await expand(card.getByTestId('paper-basket-answer'),'本卷参考答案与解析');await assertDisplayedRole(card.getByTestId('paper-instance-answer-view'),e,'answer');await assertDisplayedRole(card.getByTestId('paper-instance-analysis-view'),e,'analysis');}}
      await captureUi({app,page,output,report},'retained-'+stage,page.getByTestId('paper-basket-workspace'));
    }
    check('Retained definitions including empty and all original members remain visibly complete');
    phase='responsive-preview';await verifyPaperPreviewViewport({app,page,output,report});
    check('Actual paper preview fixed geometry, local scroll, keyboard focus and no page overflow at 800/1366/1920');
    phase='explicit-arrange';
    for(const action of ['release-empty','accept-points']){
      const before=await readInstanceBasket(page,owner,basketId),oldReceipts=receipts(),oldVersions=versions(),expected=structuredClone(before.c2),storedBefore=storedBasket();let button;
      if(action==='release-empty'){const r=expected.retainedSections.find(r=>!r.entryIds.length&&!r.released);assert(r,'Real empty retained definition');r.released=true;button=page.getByTestId('paper-template-retained-section').filter({hasText:r.section.label}).getByTestId('paper-template-release-empty');}
      else{const e=before.entries.find(e=>before.blueprint.sections.some(s=>s.id===e.sectionId&&s.points!==before.c2.entryPoints[e.entryId]));assert(e,'Real points conflict');expected.entryPoints[e.entryId]=before.blueprint.sections.find(s=>s.id===e.sectionId).points;button=page.getByTestId('paper-template-points-conflict').filter({hasText:e.entryId}).getByTestId('paper-template-accept-points');}
      await button.click();await until(async()=>{const b=await readInstanceBasket(page,owner,basketId);return b.revision===before.revision+1;},'Explicit '+action+' committed');
      await until(async()=>!await (await templatePanel(page)).getByTestId('paper-template-refresh').isDisabled(),'Arrange reload settled');
      observeReceipts();const after=await readInstanceBasket(page,owner,basketId);jsonEqual(storedBasket().entries,storedBefore.entries);jsonEqual(after.entries,before.entries);await assertDerivedStates(before,after);jsonEqual(after.blueprint,before.blueprint);jsonEqual(after.c2,expected,'Only explicit arrangement decision changes');assert.equal(receipts().length,oldReceipts.length+1);jsonEqual(versions(),oldVersions);report.operations.push({kind:'arrange',action,beforeRevision:before.revision,afterRevision:after.revision});check('Explicit '+action+' changes only intended retained/points fact');
    }
    finalBasket=await readInstanceBasket(page,owner,basketId);finalVersions=versions();noUnexpected();
    phase='cold';await close();await launch();const cold=await openBasket(page,owner,basketId);jsonEqual(domain(cold),domain(finalBasket));jsonEqual(versions(),finalVersions);assertMembers(finalBasket,cold);await assertDerivedStates(finalBasket,cold);const coldPanel=await templatePanel(page);await coldPanel.getByTestId('paper-template-refresh').click();await until(async()=>!await coldPanel.getByTestId('paper-template-refresh').isDisabled(),'Cold version list settled');const healthy=await readTemplateList(page,target);assert.equal(healthy.unavailable.length,0);for(const v of Object.values(saved).flatMap(s=>[s.v1,s.v2,s.copy]))assert(healthy.versions.some(x=>x.templateId===v.templateId&&x.version===v.version&&x.digest===v.digest));check('Cold startup restores exact template versions/basket/entries/points without model replay');
    // Last case: prepare real selections while all sources are healthy; only then fault OWN TXT bytes.
    await mapSections(page,saved.structure.v2,cold,'existing');const {choose}=await import('./paper-basket-ui-driver.mjs');await choose(page,coldPanel.getByTestId('paper-template-layout'),saved.layout.v2.templateId+':'+saved.layout.v2.version);
    phase='source-changed';const materialRoot=fs.realpathSync(path.join(data,'teacher_resources')),sourceFile=fs.realpathSync(resources[0].local_path);assert.equal(path.dirname(sourceFile),materialRoot);const sourceBytes=fs.readFileSync(sourceFile);assert.equal(sha256(sourceBytes),resources[0].content_hash);
    const refusalBasket=domain(await readInstanceBasket(page,owner,basketId)),refusalVersions=versions(),refusalReceipts=receipts();
    try{fs.appendFileSync(sourceFile,'\nOWN copied source CAS probe\n');const p=await templatePanel(page);await p.getByTestId('paper-template-apply-both').click();await until(async()=>/source_changed/.test(await p.getByTestId('paper-template-status').innerText()),'Actual source_changed refusal');await until(async()=>!await p.getByTestId('paper-template-refresh').isDisabled(),'Refusal settled');jsonEqual(domain(await readInstanceBasket(page,owner,basketId)),{...refusalBasket,templateSourceCurrent:false});jsonEqual(versions(),refusalVersions);jsonEqual(receipts(),refusalReceipts);
      const list=await readTemplateList(page,target);for(const v of [saved.structure.v1,saved.structure.v2,saved.structure.copy])assert(list.unavailable.some(x=>x.template.templateId===v.templateId&&x.template.version===v.version&&x.template.digest===v.digest&&x.reason==='source_changed'));for(const v of [saved.layout.v1,saved.layout.v2,saved.layout.copy])assert(list.versions.some(x=>x.templateId===v.templateId&&x.version===v.version&&x.digest===v.digest),'Healthy DOCX versions must survive unavailable TXT');
      await p.getByTestId('paper-template-refresh').click();await until(async()=>!await p.getByTestId('paper-template-refresh').isDisabled(),'Mixed healthy/unavailable UI list settled');assert.equal(await p.getByTestId('paper-template-unavailable').count(),list.unavailable.length);assert.equal(await p.getByTestId('paper-template-version').count(),list.versions.length);
    }
    finally{fs.writeFileSync(sourceFile,sourceBytes);assert.equal(sha256(fs.readFileSync(sourceFile)),resources[0].content_hash);}
    check('Actual C2b apply refuses OWN copied source-byte change without a commit; source bytes restored');
    const restored=await readTemplateList(page,target);assert.equal(restored.unavailable.length,0);jsonEqual(versions(),finalVersions);noUnexpected();
    assert.equal(report.operations.filter(o=>o.kind==='save').length,budget.templateSaves);assert.equal(report.operations.filter(o=>o.kind==='apply').length,budget.templateApplications);assert.equal(report.operations.filter(o=>o.kind==='arrange').length,budget.arrangements);report.success=true;
  }catch(error){report.error={phase,name:error.name,message:String(error.message).slice(0,2500)};try{observeReceipts();}catch(e){report.receiptObservationError=String(e.message);}if(page&&!page.isClosed())try{await page.screenshot({path:path.join(output,'failure.png')});report.screens.push({file:'failure.png',phase,kind:'failure'});}catch(e){report.failureScreenshotError=String(e.message);}}
  finally{
    try{await close();noUnexpected();assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkAttempts,[]);assert.equal(fingerprint(original).sha256,originalBefore);assert.equal(fingerprint(buildRoot).sha256,options.build);assert.equal(fingerprint(sourceRoot).sha256,options.source);assert.equal(contractHash(desktop),options.contract);jsonEqual(qaHashes(desktop),report.qaBefore);report.integrityVerified=true;}catch(e){report.success=false;report.integrityError=String(e.message);}
    report.networkObservation='Blocking starts after firstWindow; early startup network unobserved. Durable model ledger unchanged is checked independently.';persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,productAcceptance:false,budget}));
  }
  if(!report.success)process.exitCode=1;return report;
}
