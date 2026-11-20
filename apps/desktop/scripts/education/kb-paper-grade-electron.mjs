import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

const previous=JSON.parse(fs.readFileSync('test-results/kb-grade-search-after-electron.log','utf8').trim().split(/\r?\n/).at(-1));
assert(previous.ok && previous.baseline===false);
const pdfBaseline=process.argv.includes('--pdf-stamp-baseline');
const pdfRestored=pdfBaseline||process.argv.includes('--pdf-relocation');
const grade=pdfRestored?'初中':'高中三年级';
const topics=pdfRestored?['电功率','欧姆定律与电功率']:previous.results.map(({term})=>term);
const source=path.join(fs.realpathSync(previous.root),'data');
assert(path.relative(fs.realpathSync(os.tmpdir()), source).startsWith('edudev-grade-search-'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-paper-grade-'));
const data=path.join(root,'data');
fs.cpSync(source,data,{recursive:true,filter:file=>!/(^app\.db(?:-wal|-shm)?$|\.lock$)/.test(path.basename(file))});
const file=path.join(data,'app.db');
const original=new DatabaseSync(path.join(source,'app.db'),{readOnly:true});
try {original.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");} finally {original.close();}
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(file,source,data,path.join(previous.root,'outputs'),path.join(root,'outputs'));
const writer=new DatabaseSync(file,{readOnly:true});
const questionRows=[];
try {
  for(const {local_path} of writer.prepare('SELECT local_path FROM teacher_resources').all()){
    const relative=path.relative(data,local_path);
    assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  }
  for(const term of topics){
    const rows=writer.prepare('SELECT * FROM question_bank_items WHERE subject=? AND grade=? AND knowledge_point=?').all('物理',pdfRestored?'初中':'高三',term);
    assert.equal(rows.length,1);
    questionRows.push(rows[0]);
  }
} finally {writer.close();}

const read=(query,...args)=>{
  const db=new DatabaseSync(file,{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
const paid=()=>read('SELECT COALESCE(SUM(calls),0) total FROM material_ai_batches')[0].total;
const beforeCalls=paid();
const build=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const baseline=process.argv.includes('--baseline');
const stampBaseline=process.argv.includes('--stamp-baseline');
const nativeRelocated=!baseline&&!stampBaseline;
const gradeControl=baseline||process.argv.includes('--grade-control');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:''};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[key];
const title=(pdfRestored?'PDF 裁题迁移验证 ':'年级别名原题验证 ')+randomUUID().slice(0,8);
let app,page;
async function launch(){
  app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],env,timeout:90000});
  page=await app.firstWindow();
  page.setDefaultTimeout(30000);
}
async function automatic(){
  await productEntry(page,'teaching').click();
  await page.getByTestId('hub-entry-paper').click();
  const entry=page.getByTestId('paper-entry-automatic');
  await page.getByTestId('paper-basket-workspace').waitFor();
  if(!await entry.isVisible()){
    await page.getByTestId('paper-basket-new').click();
    const dialog=page.getByTestId('paper-basket-create-dialog');
    await dialog.getByTestId('paper-practice-subject').fill('物理');
    await dialog.getByTestId('paper-practice-grade').fill(grade);
    await dialog.getByTestId('paper-basket-create').click();
    await dialog.waitFor({state:'hidden'});
  }
  if(!await entry.isVisible())await page.getByRole('button',{name:'更多筛选',exact:true}).click();
  await entry.click();
  await page.getByTestId('paper-title').waitFor();
}
async function draft(grade,questions){
  const rows=page.getByTestId('paper-section');
  while(await rows.count()>questions.length)await rows.last().getByRole('button',{name:'移除此部分'}).click();
  for(const [key,value] of Object.entries({title,subject:'物理',grade,duration:'20',total:'10'}))await page.getByTestId('paper-'+key).fill(value);
  for(const [index,q] of questions.entries()){
    const row=rows.nth(index);
    for(const [key,value] of Object.entries({label:'原题 '+(index+1),type:q.question_type,count:'1',points:'5',kp:q.knowledge_point})){
      await row.getByTestId('paper-section-'+key).fill(value);
    }
    await row.getByTestId('paper-section-difficulty').selectOption(q.difficulty);
  }
  const count=read('SELECT id FROM ai_confirmation_items WHERE title=?',title).length;
  const started=performance.now();
  await page.getByTestId('paper-generate').click();
  await page.getByTestId('paper-review').waitFor();
  const records=read('SELECT * FROM ai_confirmation_items WHERE title=? ORDER BY rowid',title);
  assert.equal(records.length,count+1);
  const record=records.at(-1),payload=JSON.parse(record.payload_json);
  return {record,payload,milliseconds:Math.round(performance.now()-started)};
}
function assertOriginals(items,questions){
  assert.deepEqual(items.map(item=>item.question.id),questions.map(q=>q.id));
  assert(items.every(item=>item.question.grade==='高三'&&item.question.sourceKind==='local_bank'&&item.points===5));
}

async function verifyRelocatedPaper(natural){
  const items=natural.payload.selection.items;
  assert.deepEqual(items.map(item=>item.question.id),questionRows.map(q=>q.id));
  assert(items.every(item=>item.question.grade==='高三'&&item.question.sourceKind==='teacher_resource'));
  assert.equal(items.reduce((sum,item)=>sum+item.points,0),10);
  const paper={schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:natural.record.session_id,id:natural.record.id};
  const unit=receipt=>read('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=?',receipt.batchId,receipt.ordinal)[0];
  const evidence=items.map(item=>unit(item.question.archive.ai));
  async function readOriginals(){
    let images=0;
    for(const item of items){
      const input={schemaVersion:'xiaozhi.native-question-image.v1',questionId:item.question.id,version:item.source.version};
      const original=await page.evaluate(input=>window.omniEdu.getNativeQuestionOriginal(input),input);
      assert.equal(original.stem,item.question.stem);
      for(const [index,figure] of item.question.archive.native.roles.question.figures.entries()){
        const image=await page.evaluate(input=>window.omniEdu.getNativeQuestionImage(input),{...input,role:'question',index});
        const bytes=Buffer.from(image.dataUrl.split(',')[1],'base64');
        assert.equal(createHash('sha256').update(bytes).digest('hex'),figure.sha256);
        images++;
      }
    }
    assert(images>=2);
    return images;
  }
  const imagesBefore=await readOriginals();
  const q=items[0].question,version=items[0].source.version;
  const local=read('SELECT local_path FROM teacher_resources WHERE id=?',q.archive.native.source.resourceId)[0].local_path;
  assert.equal(path.dirname(path.resolve(local)),path.join(data,'teacher_resources'));
  const bytes=fs.readFileSync(local),altered=Buffer.from(bytes);
  altered[altered.length-1]^=1;
  try{
    fs.writeFileSync(local,altered);
    const blocked=await page.evaluate(p=>window.omniEdu.reviewPaper(p),paper);
    assert(blocked.ok&&!blocked.value.sourceCurrent);
    const attempted=await page.evaluate(p=>window.omniEdu.decidePaper({...p,revision:1,action:'confirm'}),paper);
    assert(!attempted.ok&&attempted.error==='source_changed');
    await assert.rejects(page.evaluate(request=>window.omniEdu.getNativeQuestionImage(request),
      {schemaVersion:'xiaozhi.native-question-image.v1',questionId:q.id,version,role:'question',index:0}),/source_changed/);
  }finally{fs.writeFileSync(local,bytes);}
  const edit={questionId:q.id,version,sourceChecked:true,fields:Object.fromEntries(
    ['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'].map(field=>[field,q[field]]))};
  await assert.rejects(page.evaluate(request=>window.omniEdu.editArchivedQuestion(request),edit),/source_changed/);
  await page.getByTestId('paper-confirm').click();
  await page.getByTestId('paper-confirmed').waitFor();
  const approval=read('SELECT status,result_json FROM ai_confirmation_items WHERE id=?',paper.id)[0];
  assert.equal(approval.status,'confirmed');
  await app.close();
  app=undefined;
  await launch();
  const cold=await page.evaluate(request=>window.omniEdu.reviewPaper(request),paper);
  assert(cold.ok&&cold.value.state==='confirmed'&&cold.value.sourceCurrent&&cold.value.exportCurrent);
  assert.deepEqual(cold.value.selection.items.map(i=>i.source),items.map(i=>i.source));
  assert.equal(await readOriginals(),imagesBefore);
  assert.deepEqual(read('SELECT status,result_json FROM ai_confirmation_items WHERE id=?',paper.id)[0],approval);
  assert.deepEqual(items.map(item=>unit(item.question.archive.ai)),evidence);
  return {confirmed:true,images:imagesBefore,tamperBlocked:true,editBlocked:true,coldReadback:true};
}

async function verifyGradeControl(natural){
  await page.getByRole('button',{name:'返回修改蓝图',exact:true}).click();
  const controlled=await page.evaluate(async title=>{
    const records=[];
    for(const [index,stem,answer,analysis] of [[1,'两个大小各 5 N 的同向力的合力是多少？','10 N','同向力的大小相加。'],[2,'物体静止时的速度是多少？','0 m/s','静止时位置不随时间变化。']]){
      const saved=await window.omniEdu.createQuestionBankItem({subject:'物理',grade:'高三',knowledgePoint:title+' '+index,
        questionType:'简答题',difficulty:'easy',stem,answer,analysis,sourceTitle:'教师录入测试题',sourceKind:'local_bank',tags:[]});
      records.push({id:saved.id,question_type:saved.questionType,knowledge_point:saved.knowledgePoint,difficulty:saved.difficulty});
    }
    return records;
  },title);
  const precise=await draft(baseline?'高三':'高二',controlled);
  assert.equal(precise.payload.selection.items.length,baseline?2:0);
  assert.equal(await page.getByTestId('paper-confirm').isDisabled(),!baseline);
  await page.getByRole('button',{name:'返回修改蓝图',exact:true}).click();
  const alias=await draft('高中三年级',controlled);
  assert.equal(alias.payload.input.blueprint.grade,'高中三年级');
  assert.equal(alias.payload.selection.items.length,baseline?0:2);
  assert.equal(await page.getByTestId('paper-confirm').isDisabled(),baseline);
  const report={baseline,root,originals:alias.payload.selection.items.length,composeMs:alias.milliseconds,
    naturalScanned:natural.payload.selection.scanned,naturalSourceUnavailable:natural.payload.selection.excluded.source_unavailable,paidCalls:0};
  if(!baseline){
    assertOriginals(alias.payload.selection.items,controlled);
    assert.equal(alias.record.status,'pending');
    await page.getByTestId('paper-confirm').click();
    await page.getByTestId('paper-confirmed').waitFor();
    const actual=read('SELECT status,result_json FROM ai_confirmation_items WHERE id=?',alias.record.id)[0];
    assert.equal(actual.status,'confirmed');
    const basket=await page.evaluate(async ({sessionId,blueprint,questionIds})=>{
      const api=window.omniEdu,base={schemaVersion:'xiaozhi.paper-basket.v2',sessionId};
      const result=await api.createPaperBasketV2({...base,requestId:crypto.randomUUID(),blueprint});
      if(!result.ok)throw Error(result.error);
      let view=result.value;
      const identity={...base,basketId:view.id};
      const sections=[];
      for(const [index,questionId] of questionIds.entries()){
        const candidate=await api.readPaperBasketCandidateV2({...identity,questionId});
        if(!candidate.ok)throw Error(candidate.error);
        const sectionId=blueprint.sections[index].id;
        sections.push({expected:sectionId,options:candidate.value.matchingSectionIds});
        const added=await api.mutatePaperBasketV2({...identity,requestId:crypto.randomUUID(),expectedRevision:view.revision,
          operation:{type:'add',questionId,sectionId,expectedSourceVersion:candidate.value.contentVersion}});
        if(!added.ok)throw Error(added.error);
        view=added.value;
      }
      return {id:view.id,sections,entries:view.entries.length};
    },{sessionId:alias.record.session_id,blueprint:alias.payload.input.blueprint,questionIds:controlled.map(q=>q.id)});
    assert.equal(basket.entries,2);
    for(const section of basket.sections)assert.deepEqual(section.options,[section.expected]);
    await app.close();
    app=undefined;
    await launch();
    const cold=await page.evaluate(({sessionId,id})=>window.omniEdu.reviewPaper({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,id}),
      {sessionId:alias.record.session_id,id:alias.record.id});
    assert(cold.ok && cold.value.state==='confirmed' && cold.value.sourceCurrent);
    assertOriginals(cold.value.selection.items,controlled);
    assert.deepEqual(read('SELECT status,result_json FROM ai_confirmation_items WHERE id=?',alias.record.id)[0],actual);
    report.basketEntries=basket.entries;
    report.coldReadback=true;
  }
  return report;
}

async function withTamperedFile(file,action){
  const original=fs.readFileSync(file),changed=Buffer.from(original);
  changed[changed.length-1]^=1;
  fs.writeFileSync(file,changed);
  try{await action();}finally{fs.writeFileSync(file,original);}
}

async function verifyPdfRelocation(){
  const archive=JSON.parse(questionRows[1].archive_json);
  const {batchId,ordinal}=archive.ai;
  assert.equal(archive.ai.policy,'page-crop-complete.v1');
  const query={schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal};
  const view=()=>page.evaluate(request=>window.omniEdu.getMaterialAiPage(request),query);
  if(pdfBaseline)await assert.rejects(view(),/source_changed/);
  else{
    const result=await view();
    assert.deepEqual(result.source,archive.pageSource);
    assert(result.ocrText&&result.text);
  }
  await automatic();
  const natural=await draft(grade,questionRows),items=natural.payload.selection.items;
  assert.equal(items.length,pdfBaseline?0:2);
  assert.equal(natural.payload.selection.excluded.source_unavailable,pdfBaseline?2:0);
  const report={pdfBaseline,root,selected:items.length,sourceUnavailable:natural.payload.selection.excluded.source_unavailable,composeMs:natural.milliseconds};
  if(pdfBaseline)return report;
  assert.deepEqual(items.map(i=>i.question.id),questionRows.map(q=>q.id));
  const {question,source}=items[1],paper={schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:natural.record.session_id,id:natural.record.id};
  const unit=()=>read('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=?',batchId,ordinal)[0];
  const frozenUnit=unit();
  const preview=()=>page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),{...query,cropPreview:{number:archive.number,index:0}});
  const gallery=item=>page.evaluate(input=>window.omniEdu.getOriginalQuestionGallery(input),
    {schemaVersion:'xiaozhi.education.original-review.v2',questionId:item.question.id,version:item.source.version});
  const sha=dataUrl=>createHash('sha256').update(Buffer.from(dataUrl.split(',')[1],'base64')).digest('hex');
  async function checkCrops(){
    let count=0;
    for(const item of items){
      const images=await gallery(item),expected=item.question.document.blocks.filter(b=>b.kind==='image');
      assert(images.ok&&expected.length>0);
      assert.deepEqual(images.value.map(i=>[i.assetId,i.page,sha(i.dataUrl)]),expected.map(b=>[b.assetId,b.anchors[0].page,b.sha256]));
      count+=expected.length;
    }
    const {cropPreview}=await preview();
    const first=question.document.blocks.find(b=>b.kind==='image');
    assert.equal(sha(cropPreview.dataUrl),first.sha256);
    return count;
  }
  const crops=await checkCrops();
  const local=read('SELECT local_path FROM teacher_resources WHERE id=?',archive.pageSource.resourceId)[0].local_path;
  assert.equal(path.dirname(path.resolve(local)),path.join(data,'teacher_resources'));
  await withTamperedFile(local,async()=>{
    await assert.rejects(view(),/source_changed/);
    assert.deepEqual(await gallery(items[1]),{ok:false,error:'source_changed'});
    const attempted=await page.evaluate(p=>window.omniEdu.decidePaper({...p,revision:1,action:'confirm'}),paper);
    assert(!attempted.ok&&attempted.error==='source_changed');
  });
  const firstImage=question.document.blocks.find(b=>b.kind==='image');
  assert.match(firstImage.assetId,/^asset_[a-f0-9-]{36}$/);
  await withTamperedFile(path.join(data,'question-assets','v1',firstImage.assetId+'.png'),async()=>{
    await assert.rejects(preview(),/unavailable|source_changed/);
    assert.equal((await gallery(items[1])).ok,false);
    const attempted=await page.evaluate(p=>window.omniEdu.decidePaper({...p,revision:1,action:'confirm'}),paper);
    assert(!attempted.ok&&attempted.error==='source_changed');
  });
  const edit={questionId:question.id,version:source.version,sourceChecked:true,fields:Object.fromEntries(
    ['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'].map(field=>[field,question[field]]))};
  await assert.rejects(page.evaluate(request=>window.omniEdu.editArchivedQuestion(request),edit),/source_changed/);
  await page.getByTestId('paper-confirm').click();
  await page.getByTestId('paper-confirmed').waitFor();
  await app.close();
  app=undefined;
  await launch();
  const cold=await page.evaluate(request=>window.omniEdu.reviewPaper(request),paper);
  assert(cold.ok&&cold.value.state==='confirmed'&&cold.value.sourceCurrent&&cold.value.exportCurrent);
  assert.deepEqual(cold.value.selection.items.map(i=>i.source),items.map(i=>i.source));
  assert.equal(await checkCrops(),crops);
  assert.deepEqual(unit(),frozenUnit);
  return {...report,confirmed:true,crops,coldReadback:true,pdfTamperBlocked:true,cropTamperBlocked:true,editBlocked:true};
}

try{
  await launch();
  let report;
  if(pdfRestored){
    report=await verifyPdfRelocation();
  }else{
    await automatic();
    const natural=await draft(grade,questionRows);
    assert.equal(natural.payload.selection.items.length,nativeRelocated?2:0);
    assert.equal(natural.payload.selection.excluded.source_unavailable,nativeRelocated||baseline?0:2);
    assert.equal(await page.getByTestId('paper-confirm').isDisabled(),!nativeRelocated);
    if(gradeControl)report=await verifyGradeControl(natural);
    else{
      const result=nativeRelocated?await verifyRelocatedPaper(natural):{};
      report={root,stampBaseline,selected:natural.payload.selection.items.length,
        sourceUnavailable:natural.payload.selection.excluded.source_unavailable,composeMs:natural.milliseconds,paidCalls:0,...result};
    }
  }
  assert.equal(paid(),beforeCalls);
  for(const q of questionRows)assert.deepEqual(read('SELECT * FROM question_bank_items WHERE id=?',q.id)[0],q);
  console.log(JSON.stringify({ok:true,...report}));
} catch(error){
  console.error(JSON.stringify({ok:false,baseline,root,error:String(error)}));
  await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  throw error;
} finally {await app?.close();}
