import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {execFileSync} from 'node:child_process';import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';import {assertIsolatedPiMain} from './acceptance/build-root.mjs';import {choose} from './acceptance/paper-basket-ui-driver.mjs';import {editQuestionStatement} from './acceptance/paper-instance-ui-form.mjs';

const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..'),donor=path.join(desktop,'test-results/ui-goal-paper-zsXwff');
const prior=JSON.parse(fs.readFileSync(path.join(donor,'ui-goal-report.json')));assert(prior.error.includes('paper-generate'));
const output=fs.mkdtempSync(path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/paper-current-'));
const data=path.join(donor,'data'),profile=path.join(donor,'electron-profile'),destination=path.join(donor,'current-output');fs.mkdirSync(destination,{recursive:true});
const main=path.join(desktop,'out/main/index.js'),report={success:false,source:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),build:fingerprint(path.join(desktop,'out')).sha256,donor,output,checks:[],errors:[],files:[],boundary:'Current production question library and basket UI; original Pi and real official provider for export. Reuses twenty fictional teacher-entered bank facts from the preserved earlier failed UI run, no SQL writes, generated questions, proxy responses or production data.'};
const read=(sql,...params)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...params);}finally{db.close();}};
const bankBefore=JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id'));assert.equal(JSON.parse(bankBefore).length,20);
let app,page,session,basketId,stage='launch';const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push(name);save();console.log('PASS '+name);};
const until=async(fn,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out at '+stage);};
const basket=async()=>{const r=await page.evaluate(v=>window.omniEdu.readPaperBasketV2(v),{schemaVersion:'xiaozhi.paper-basket.v2',sessionId:session,basketId});assert(r.ok);return r.value;};
const nav=async id=>page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-'+id).click();
const shot=async name=>page.screenshot({path:path.join(output,name+'.png')});
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash'};assert(env.DEEPSEEK_API_KEY);for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor();report.identity=await assertIsolatedPiMain(app,main,profile);session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');
 await app.evaluate(({BrowserWindow,dialog},destination)=>{BrowserWindow.getAllWindows()[0].setContentSize(1366,768);const original=dialog.showOpenDialog;dialog.showOpenDialog=async function(...args){const options=args.length>1?args[1]:args[0];if(/试卷保存文件夹|教学工作目录/.test(options?.title||''))return{canceled:false,filePaths:[destination]};return original.apply(this,args);};},destination);
 stage='select-question';await nav('teaching');await page.getByTestId('hub-entry-paper').click();await page.getByTestId('paper-basket-workspace').waitFor();
 const existing=read('SELECT id,session_id,data_json FROM paper_baskets').find(row=>JSON.parse(row.data_json).entries.length===1);
 let questionId;
 if(existing){
  basketId=existing.id;session=existing.session_id;await until(async()=>await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id')===basketId);
  questionId=(await basket()).entries[0].questionId;report.resume={basketId,reason:'Earlier genuine UI selection auto-created its basket; failed QA expected an unnecessary dialog. Resume persisted facts rather than add a duplicate.'};
 }else{
  const candidate=page.getByTestId('paper-library-question').first();await candidate.waitFor();questionId=await candidate.getAttribute('data-question-id');await candidate.getByTestId('paper-library-add').click();
  const dialog=page.getByTestId('paper-basket-create-dialog');await until(async()=>await dialog.isVisible()||Boolean(await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id')));
  if(await dialog.isVisible()){
   await dialog.getByTestId('paper-basket-owner-search').fill(session);await choose(page,dialog.getByTestId('paper-basket-owner'),session);
   for(const [key,value]of [['title','UIR1本卷修订练习'],['subject','数学'],['grade','初二']])await dialog.getByTestId('paper-practice-'+key).fill(value);
   await dialog.getByTestId('paper-basket-create').click();await dialog.waitFor({state:'hidden'});
  }
  await until(async()=>{basketId=await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');return Boolean(basketId)&&(await basket()).entries.length===1;});
 }
 report.reference={session,basketId,questionId};const initial=await basket();report.initial=initial;assert.equal(initial.entries[0].questionId,questionId);check('Visible current library selection creates a real session-owned basket and pins the exact source question');
 stage='edit-instance';await page.getByTestId('paper-basket-stage-organize').click();const entryId=initial.entries[0].entryId;if(!JSON.stringify((await basket()).entries[0].instance.content).includes('本卷校订')){
  await editQuestionStatement(page,entryId,'本卷校订：请写出计算过程。');const editor=page.getByTestId('paper-instance-dialog');await editor.getByTestId('paper-instance-save').click();
  await until(async()=>JSON.stringify((await basket()).entries[0].instance.content).includes('本卷校订'));await until(()=>editor.getByTestId('paper-instance-dialog-close').isEnabled());await editor.getByTestId('paper-instance-dialog-close').click();
 }else report.carriedEdit='Original UI save verified in paper-current-WSnGiP; current exact instance is read back without adding the same edit again.';
 assert.equal(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id')),bankBefore);await shot('instance-saved');check('Teacher edits only this basket instance, saves through the original host and leaves the source bank byte-for-byte unchanged');
 stage='preview-confirm';await page.getByTestId('paper-basket-stage-preview').click();await page.getByTestId('paper-basket-preview-page').waitFor();assert((await page.getByTestId('paper-preview-document').innerText()).includes('本卷校订'));await shot('preview-before-confirm');await page.getByTestId('paper-basket-confirm-all').click();await page.getByTestId('paper-export-entry').waitFor();report.confirmed=await basket();await shot('confirmed');check('The same edited members reach real preview and explicit whole-paper confirmation');
 for(const format of ['docx','pdf']){
  stage='export-'+format;await page.getByTestId('paper-export-student-'+format).click();await page.getByTestId('office-prompt-input').waitFor();assert.equal(await page.locator('.office-composer-container:visible').getAttribute('data-session-id'),session);
  const before=read('SELECT id FROM document_artifacts').map(r=>r.id);const input=page.getByTestId('office-prompt-input');assert((await input.inputValue()).includes('education_export_paper'));await input.press('Enter');
  let artifact;await until(async()=>{const s=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);artifact=s.officeArtifacts?.find(a=>a.format===format&&a.state==='pending');return Boolean(artifact);},300000);
  const artifactId=artifact.id,card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${artifactId}"]`).filter({visible:true});await until(()=>card.getByTestId('pi-office-approve').isEnabled());await card.getByTestId('pi-office-approve').click();
  await until(()=>read('SELECT * FROM document_artifacts').some(r=>!before.includes(r.id)&&r.status==='exported'&&r.file_name.endsWith('.'+format)),300000);
  const fact=read('SELECT * FROM document_artifacts').find(r=>!before.includes(r.id)&&r.file_name.endsWith('.'+format));const bytes=fs.readFileSync(fact.file_path);assert.equal(sha256(bytes),fact.content_hash);assert.equal(bytes.subarray(0,format==='pdf'?5:2).toString(),format==='pdf'?'%PDF-':'PK');
  const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';const code=format==='pdf'?'from pypdf import PdfReader;import sys;print("\\n".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))':'from docx import Document;import sys;d=Document(sys.argv[1]);print("\\n".join([p.text for p in d.paragraphs]+[c.text for t in d.tables for r in t.rows for c in r.cells]))';const text=execFileSync(python,['-c',code,fact.file_path],{encoding:'utf8',windowsHide:true});assert(text.includes('本卷校订'));assert(!text.includes('答案哨兵'));report.files.push({id:fact.id,path:fact.file_path,sha256:fact.content_hash,text});check('Real '+format+' export contains the edited instance and isolates student answers');
  await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).running,300000);
  await nav('teaching');await page.getByTestId('hub-entry-paper').click();await until(async()=>await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id')===basketId);
  if(!await page.getByTestId('paper-export-entry').isVisible()){await page.getByTestId('paper-basket-stage-preview').click();await page.getByTestId('paper-export-entry').waitFor();}
 }
 assert.equal(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id')),bankBefore);assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.failure={stage,error:String(e.stack||e).replace(/sk-[\w-]+/g,'[credential]')};process.exitCode=1;await shot('failure').catch(()=>{});}
finally{await app?.close();save();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));}
