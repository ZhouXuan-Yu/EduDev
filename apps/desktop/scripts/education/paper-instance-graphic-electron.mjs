import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {enterPaper, choose, disclosureTrigger} from '../acceptance/paper-basket-ui-driver.mjs';
import {instanceStage, readInstanceBasket, waitInstanceUi} from '../acceptance/paper-instance-ui-driver.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {compilePaperOffice,assertPaperOffice} from '../../src/main/education/paper-export.ts';
import {generateOfficeDocument} from '../../src/main/xiaozhi-agent/office-generator.ts';
import {relocateBackupDatabase} from '../../src/main/backup/restore-database.ts';

const original=fs.realpathSync(process.argv[2]),independent=process.argv.includes('--independent');
assert(path.basename(original).startsWith('native-printed-body-ui-'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-graphic-natural-'));
const data=path.join(out,'data'), profile=path.join(out,'profile'), sourceRoot=path.join(original,'data');
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const errors=[], attempts=[];
let app, page, owner, basket;
fs.cpSync(sourceRoot,data,{recursive:true,errorOnExist:true,force:false});
await relocateBackupDatabase(path.join(data,'app.db'),sourceRoot,data,path.join(original,'XiaozhiOutputs'),path.join(out,'XiaozhiOutputs'));
const sql=(query,...params)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...params);}finally{db.close();}
};
const [row]=sql("SELECT id,stem FROM question_bank_items WHERE source_title='图形选项跨页练习.pdf' AND json_extract(archive_json,'$.number')='13'");
assert(row && row.stem.includes('玻璃管'));
const raw=()=>JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',row.id));
async function launch(){
 const env={...process.env};
 for(const name of Object.keys(env))if(/KEY|TOKEN|SECRET|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name))delete env[name];
 Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'});
 app=await electron.launch({args:[main,'--user-data-dir='+profile,'--host-resolver-rules=MAP * ~NOTFOUND'],env,cwd:out,timeout:90000});
 await app.evaluate(({net})=>{
   globalThis.probeAttempts=0;
   net.fetch=globalThis.fetch=async()=>{globalThis.probeAttempts++;throw Error('Offline graphic option journey');};
 });
 page=await app.firstWindow();page.setDefaultTimeout(35000);
 page.on('pageerror',e=>errors.push(e.message));
}
async function close(){
 if(!app)return;
 attempts.push(await app.evaluate(()=>globalThis.probeAttempts));
 await app.close();app=undefined;
}
async function visibleQuestion(){
 await productEntry(page,'teaching').click();
 await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
 await page.getByTestId('question-notebook-search').fill(row.stem.slice(0,18));
 const card=page.getByTestId('question-notebook-card-'+row.id);
 await card.waitFor();
 return card;
}
const labels=['A','B','C','D'];
const figureLabel='本卷题面插图 2';
const question=()=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),row.id);
async function addFactsFromVisibleOriginal(){
 const card=await visibleQuestion();
 await card.getByTestId('question-archive-edit-'+row.id).click();
 const updates={subject:'物理',grade:'高二',knowledgePoint:'气体等温变化',questionType:'单选题',answer:'A',
  analysis:'缓慢下压时，管内液面加深，封闭气体压强升高。温度不变时，压强与体积成反比，因此体积减小，状态沿反比例曲线向左上方移动。'};
 for(const [key,value] of Object.entries(updates))await card.getByTestId('question-archive-'+key).fill(value);
 await card.getByTestId('question-archive-difficulty').selectOption('medium');
 await card.getByTestId('question-archive-source-checked').check();
 await card.getByTestId('question-archive-save').click();
 await card.getByTestId('question-archive-form').waitFor({state:'hidden'});
 await card.getByTestId('question-original-open').click();
 await card.getByTestId('question-original-image').first().evaluate(img=>img.decode());
 await card.getByTestId('question-context-open').click();
 const presence={
  statement:row.stem,figures:'开口向下的玻璃管插在水银槽中的装置图。装置图独立于四张选项图。',
  choices:'A. 反比例曲线向左上。 B. 反比例曲线向右下。 C. 正比例直线向右上。 D. 正比例直线向左下。'};
 for(const key of ['statement','formulas','tables','figures','choices','subquestions']){
  if(presence[key])await card.getByTestId('projection-'+key+'-text').fill(presence[key]);
  await card.getByTestId('projection-'+key+'-state').selectOption(presence[key]?'provided':'not_applicable');
 }
 await card.getByTestId('question-context-complete').locator('[data-slot=checkbox-content]').click();
 await card.getByTestId('question-context-save').click();
 await card.getByTestId('question-context-save').waitFor({state:'hidden'});
 const item=await question();
 assert.equal(item.document.schemaVersion,'xiaozhi.question-document.v2');
 assert.equal(item.document.context.projection.figures.state,'provided');
 assert.deepEqual(item.document.blocks.find(block=>block.kind==='choices').options.map(item=>item.label),labels);
 return item;
}
async function verifiedPictures(card){
 const pictures=card.getByTestId('paper-instance-figure-image');
 await pictures.first().waitFor();
 const expected=labels.map(label=>'选项 '+label+' 原图');
 if(independent)expected.unshift(figureLabel);
 assert.equal(await pictures.count(),expected.length);
 assert.deepEqual(await pictures.evaluateAll(images=>images.map(img=>img.alt)),expected);
 await pictures.evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 return pictures.evaluateAll(images=>images.map(img=>img.src));
}
try{
 await launch();
 const item=await addFactsFromVisibleOriginal(), version=questionVersion(item);
 owner=(await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'图形选项编辑隔离验证'}))).session.id;
 await enterPaper(page);
 // A fresh library has a dedicated first-basket dialog.
 await page.getByTestId('paper-basket-new').click();
 const initial=page.getByTestId('paper-basket-create-dialog');
 await initial.getByTestId('paper-basket-owner-search').fill(owner);
 await choose(page,initial.getByTestId('paper-basket-owner'),owner);
 await initial.getByTestId('paper-practice-title').fill('图形选项练习');
 await initial.getByTestId('paper-practice-subject').fill(item.subject);
 await initial.getByTestId('paper-practice-grade').fill(item.grade);
 await initial.getByTestId('paper-basket-create').click();
 await initial.waitFor({state:'hidden'});
 const basketId=await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
 await waitInstanceUi(page,owner,basketId,{stage:'select'});
 await page.getByTestId('paper-basket-configuration-toggle').click();
 const fold=page.getByTestId('paper-basket-blueprint-fold');
 await disclosureTrigger(fold,'蓝图与来源策略').click();
 const setup=fold.getByTestId('paper-basket-blueprint');
 const sections=setup.getByTestId('paper-basket-section-editor');
 if(independent){
   const purpose=await readInstanceBasket(page,owner,basketId);
   await choose(page,page.getByTestId('paper-basket-purpose'),'paper');
   await waitInstanceUi(page,owner,basketId,{stage:'select',revision:purpose.revision+1});
   await setup.getByTestId('paper-basket-total').fill('100');
 }
 while(await sections.count()>1)await sections.last().getByRole('button',{name:'移除此分节',exact:true}).click();
 await setup.getByTestId('paper-basket-section-type').fill(item.questionType);
 await setup.getByTestId('paper-basket-section-count').fill('1');
 await setup.getByTestId('paper-basket-section-points').fill('100');
 await choose(page,setup.getByTestId('paper-basket-mode'),'source_only');
 const setupRevision=(await readInstanceBasket(page,owner,basketId)).revision;
 await setup.getByTestId('paper-basket-save-blueprint').click();
 await waitInstanceUi(page,owner,basketId,{stage:'select',revision:setupRevision+1});
 await page.getByTestId('paper-basket-configuration-toggle').click();
 await page.getByTestId('paper-basket-search').fill(item.stem.slice(0,26));
 await page.getByTestId('paper-basket-search-submit').click();
 const candidate=page.locator('[data-testid="paper-basket-candidate"][data-question-id="'+item.id+'"]');
 await candidate.getByTestId('paper-basket-add').click();
 await waitInstanceUi(page,owner,basketId,{stage:'select',revision:setupRevision+2});
 basket=await readInstanceBasket(page,owner,basketId);
 assert.equal(basket.entries[0].questionId,item.id);
 await instanceStage({page},owner,basket.id,'organize');
 const entry=page.getByTestId('paper-basket-entry').filter({has:page.getByTestId('paper-instance-editor')});
 await entry.getByTestId('paper-instance-open').click();
 const editor=page.getByTestId('paper-instance-dialog');
 await editor.getByTestId('paper-instance-edit-question').click();
 const form=editor.getByTestId('paper-instance-role-question');
 assert.equal(await form.getByTestId('paper-instance-choice-images').count(),4);
 assert(await form.getByTestId('paper-instance-item-label').evaluateAll(fields=>fields.every(f=>f.disabled)));
 await form.getByTestId('paper-instance-text').first().fill(row.stem+'（忽略温度波动。）');
 const beforeEdit=raw();
 const revision=(await readInstanceBasket(page,owner,basket.id)).revision;
 await editor.getByTestId('paper-instance-save').click();
 await waitInstanceUi(page,owner,basket.id,{stage:'organize',revision:revision+1});
 const saved=(await readInstanceBasket(page,owner,basket.id)).entries[0];
 assert.equal(saved.deliveryBlock,independent?'needs_review':'image_dependency');
 if(!independent)assert(await editor.getByTestId('paper-instance-confirm').isDisabled());
 const snapshots=await verifiedPictures(entry);
 const gallery=await page.evaluate(input=>window.omniEdu.getOriginalQuestionGallery(input),
   {schemaVersion:'xiaozhi.education.original-review.v2',questionId:item.id,version});
 assert(gallery.ok);
 const expectedGallery=labels.map(label=>gallery.value.find(image=>image.choiceLabel===label));
 const rawBody=gallery.value.find(image=>image.kind!=='diagram');
 let docx;
 if(independent){
   const separate=gallery.value.find(image=>image.kind==='diagram'&&!image.choiceLabel);
   assert(separate&&separate.assetId!==rawBody.assetId);
   expectedGallery.unshift(separate);
   assert.equal(item.document.context.illustrations.schemaVersion,'xiaozhi.question-illustrations.structure.v1');
   const block=item.document.blocks.find(b=>b.id===item.document.context.illustrations.blockIds[0]);
   assert(block&&block.assetId===separate.assetId&&block.anchors[0].page===2);
   const ref=item.archive.structure;
   const candidate=sql('SELECT body_json FROM material_structure_questions WHERE generation=? AND id=?',ref.generation,ref.candidateId)[0];
   const asset=JSON.parse(candidate.body_json).assets.filter(a=>a.page===2&&!a.choiceLabel&&a.kind==='image')[0];
   assert.deepEqual(block.anchors,[{page:2,box:asset.box}]);
   const pageRow=sql('SELECT image_json FROM material_structure_pages WHERE generation=? AND page=2',ref.generation)[0];
   const parent=JSON.parse(pageRow.image_json);
   const originalPng=path.join(data,'question-assets','v1',parent.assetId+'.png');
   const childPng=path.join(data,'question-assets','v1',block.assetId+'.png');
   // Decode immutable original and saved crop independently, comparing every pixel.
   const result=await app.evaluate(({nativeImage},p)=>{
     const fs=process.getBuiltinModule('node:fs');
     const parent=nativeImage.createFromBuffer(fs.readFileSync(p.originalPng));
     const child=nativeImage.createFromBuffer(fs.readFileSync(p.childPng));
     const x=Math.floor(p.box[0]*p.width),y=Math.floor(p.box[1]*p.height);
     return parent.crop({x,y,width:child.getSize().width,height:child.getSize().height})
       .toBitmap({scaleFactor:1}).equals(child.toBitmap({scaleFactor:1}));
   },{originalPng,childPng,box:asset.box,width:parent.width,height:parent.height});
   assert(result,'Saved diagram pixels must be exactly the registered original region');
 }
 assert.deepEqual(snapshots,expectedGallery.map(image=>image.dataUrl));
 assert.equal(raw(),beforeEdit);
 let approvedId;
 if(independent){
   const confirm=editor.getByTestId('paper-instance-confirm');
   await confirm.and(page.locator(':enabled')).waitFor();
   await confirm.click();
   await page.waitForFunction(()=>document.querySelector('[data-testid="paper-instance-review-state"]')?.textContent.includes('当前修订已核对'));
   await instanceStage({page},owner,basket.id,'preview');
   const preview=page.getByTestId('paper-basket-preview-entry');
   assert.deepEqual(await verifiedPictures(preview),snapshots);
   assert.equal(await preview.getByTestId('paper-basket-answer').count(),0);
   const approve=page.getByTestId('paper-basket-confirm-all');
   await approve.and(page.locator(':enabled')).waitFor();
   await approve.click();
   await page.getByTestId('paper-export-entry').waitFor();
   const [record]=sql("SELECT id FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND session_id=? AND status='confirmed' ORDER BY created_at DESC LIMIT 1",owner);
   assert(record);
   approvedId=record.id;
   const reviewed=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner,id:approvedId});
   assert(reviewed.ok&&reviewed.value.exportCurrent&&reviewed.value.purpose==='paper');
   const images=new Map(expectedGallery.map(image=>[image.assetId,Buffer.from(image.dataUrl.split(',')[1],'base64')]));
   docx=[];
   for(const audience of ['student','teacher']){
     const draft=compilePaperOffice(reviewed.value,audience);
     assertPaperOffice(reviewed.value,draft);
     assert.deepEqual(draft.sections.flatMap(section=>section.figures??[]).map(f=>f.sha256),expectedGallery.map(image=>image.sha256));
     const bytes=await generateOfficeDocument('docx',draft,{dataRoot:data,images});
     const file=path.join(out,audience+'.docx');
     fs.writeFileSync(file,bytes);
     const read=JSON.parse(execFileSync('python',['-c',"import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'text':z.read('word/document.xml').decode(),'media':[hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/') and not n.endswith('/')]}))",file],{encoding:'utf8',windowsHide:true}));
     assert.deepEqual(read.media.sort(),expectedGallery.map(i=>i.sha256).sort());
     assert.equal(read.text.includes(item.analysis),audience==='teacher');
     docx.push({audience,sha256:sha(bytes),images:read.media.length});
   }
 }
 const finalInstance=(await readInstanceBasket(page,owner,basket.id)).entries[0].instance;
 await close();await launch();await enterPaper(page);
 await page.getByTestId('paper-basket-stage-saved').click();
 await page.getByTestId('paper-basket-owner-search').fill(owner);
 await choose(page,page.getByTestId('paper-basket-owner'),owner);
 const cold=await readInstanceBasket(page,owner,basket.id);
 assert.deepEqual(cold.entries[0].instance,finalInstance);
 assert.equal(cold.entries[0].deliveryBlock,independent?undefined:'image_dependency');
 if(independent){
   const reviewed=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner,id:approvedId});
   assert(reviewed.ok&&reviewed.value.exportCurrent);
 }
 assert.equal(raw(),beforeEdit);
 await close();assert.deepEqual(errors,[]);assert(attempts.every(n=>n===0));
 console.log(JSON.stringify({ok:true,out,buildSha:sha(fs.readFileSync(main)),optionImages:4,cold:true,independentDiagramHeld:!independent,formalPaperId:approvedId,docx,cloudRequests:0}));
} catch(error){
 console.error(JSON.stringify({out,owner,basketId:basket?.id,rendererErrors:errors}));
 throw error;
} finally {await close();}
