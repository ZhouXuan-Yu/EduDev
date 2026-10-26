import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';

/** Plain teacher workflow on a copy of accepted natural source facts, using the existing runner. */
export async function naturalLanguagePaperJourney(c){
 const fixture=fs.realpathSync(process.env.OMNI_EDU_NATURAL_FIXTURE||path.join(c.desktop,'test-results/education-journey-0KsDlx'));
 assert(fixture.startsWith(fs.realpathSync(path.join(c.desktop,'test-results'))+path.sep));
 const deliveryOnly=process.env.OMNI_EDU_NATURAL_DELIVERY==='1';const continuing=deliveryOnly||process.env.OMNI_EDU_NATURAL_CONTINUE==='1';assert(JSON.parse(fs.readFileSync(path.join(fixture,'report.json'))).success||continuing&&fs.existsSync(path.join(fixture,'live.json')));
 fs.cpSync(path.join(fixture,'data'),c.data,{recursive:true});fs.cpSync(path.join(fixture,'electron-profile'),c.profile,{recursive:true});
 const sha=value=>createHash('sha256').update(value).digest('hex');
 {const db=new DatabaseSync(path.join(c.data,'app.db'));try{for(const row of db.prepare('SELECT id,local_path,content_hash FROM teacher_resources').all()){
  assert(path.resolve(row.local_path).startsWith(fs.realpathSync(path.join(c.desktop,'test-results'))+path.sep));
  const next=path.join(c.data,'teacher_resources',path.basename(row.local_path));assert.equal(sha(fs.readFileSync(next)),row.content_hash);
  db.prepare('UPDATE teacher_resources SET local_path=? WHERE id=? AND content_hash=?').run(next,row.id,row.content_hash);
 }}finally{db.close();}}
 const sql=(q,args=[])=>{const db=new DatabaseSync(path.join(c.data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}};
 const facts=()=>sql('SELECT * FROM question_bank_items ORDER BY id'),originals=facts().filter(q=>q.source_kind==='teacher_resource');assert.equal(originals.length,5);
 const page=()=>c.page();await c.launch();if(!continuing){await page().getByTestId('ai-conversation-new').click();
 await c.until(async()=>(await page().locator('.office-composer-container').getAttribute('data-session-id'))!==c.session());}
 const owner=await page().locator('.office-composer-container').getAttribute('data-session-id');
 const snapshot=()=>page().evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),owner);
 const rows=kind=>sql('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at,id',[owner,kind]);
 const send=async text=>{const input=page().getByTestId('office-prompt-input');await c.until(async()=>!await input.isDisabled());await input.fill(text);await input.press('Enter');assert.equal(await input.inputValue(),'');};
 const prompt='帮我做一份初三物理90分钟100分混合测试卷。题本里已经核对的地球与微观粒子、排球、杠杆与定滑轮、熔化、汽油机能量五道原题保留，本卷分别5、8、10、8、9分，共40分；再补6道新的每题10分综合计算题，共60分，每题至少三问，覆盖电路两状态、浮力与液面变化、机械功和效率、加热热损失、多段运动功率、实验数据与误差这六类，每题包含相互联系的多条件推导，不能只用一道公式直接代数。条件单位完整，符合初三课程，适合学生直接打印。原题图片保留，新题明确标AI原创，公式用常见可读符号。先让我集中核对新题和整卷，再给学生卷和教师卷的Word和PDF，共四份文件。';
 c.report.request=prompt;c.report.fixture={path:fixture,originalIds:originals.map(q=>q.id)};
 c.report.boundaries=['Plain teacher request, actual sole Pi/DeepSeek, accepted five natural source questions plus six new questions, centralized simulated teacher review, new mixed 100-point blueprint and four real Office files','Source scan is a 135-point combined paper, not an original 100-point test; teacher-supplied source answers and model candidates are not independent gold; all-subject, Word/WPS rendering and large-library acceptance remain open'];
 fs.writeFileSync(path.join(c.output,'live.json'),JSON.stringify({owner,prompt},null,2));console.log('LIVE '+c.output);let paper,selection,collection;
 if(!deliveryOnly){await send(continuing?'继续上次未完成的100分混合测试卷，复用已经起草的六道新题，请让我集中核对，再继续完整组卷和四份文件。':prompt);
 await c.until(async()=>{
  collection=rows('pi_question_collection').find(r=>r.status==='pending'&&JSON.parse(r.result_json||'{}').phase==='review');
  if(collection)return true;const s=await snapshot();if(s.projection.turns.length&&!s.running)throw Error('Plain request ended without centralized question review: '+JSON.stringify(s.projection.turns.at(-1)));return false;
 },300000);
 const card=page().locator(`[data-testid=pi-question-collection][data-review-id="${collection.id}"]`).last();await card.getByTestId('question-collection-reviewed').waitFor();
 const input={schemaVersion:'xiaozhi.education.question-collection.v1',sessionId:owner,id:collection.id};
 let review;await c.until(async()=>{review=await page().evaluate(v=>window.omniEdu.reviewQuestionCollection(v),input);if(!review.ok){fs.writeFileSync(path.join(c.output,'collection-read-error.json'),JSON.stringify(review));if(review.error==='invalid_input')throw Error(JSON.stringify(review));}return review.ok;},30000);assert.equal(review.value.groups.reduce((n,g)=>n+g.review.count,0),6);
 const drafts=[];for(const group of review.value.groups){
  const batch=card.locator(`[data-testid=pi-question-review][data-review-id="${group.review.id}"]`);
  if(await batch.locator('[data-slot=chat-tool-trigger]').first().getAttribute('aria-expanded')==='false')await batch.locator('[data-slot=chat-tool-trigger]').first().click();
  fs.writeFileSync(path.join(c.output,'panel-debug.json'),JSON.stringify(await batch.evaluate(el=>({text:el.textContent,html:el.outerHTML.slice(0,3500),parents:Array.from((function*(n){while(n){yield n;n=n.parentElement;}})(el)).slice(0,12).map(n=>({tag:n.tagName,slot:n.getAttribute('data-slot'),test:n.getAttribute('data-testid'),display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility,hidden:n.hidden}))})),null,2));
  await batch.getByTestId('question-review-stem').first().waitFor();
  for(const [index,item] of (await batch.getByTestId('question-review-item').all()).entries()){
   const fields=Object.fromEntries(await Promise.all(['stem','answer','analysis'].map(async key=>[key,await item.getByTestId('question-review-'+key).inputValue()])));
   drafts.push({groupId:group.review.id,index,...fields});
  }
 }
 assert.equal(drafts.length,6);
 fs.writeFileSync(path.join(c.output,'pending-review.json'),JSON.stringify({collectionId:collection.id,draftHash:sha(JSON.stringify(drafts)),drafts,view:review.value},null,2));
 console.log('TEACHER_REVIEW '+path.join(c.output,'pending-review.json'));
 await c.until(()=>fs.existsSync(path.join(c.output,'teacher-review.json')),900000);
 const teacher=JSON.parse(fs.readFileSync(path.join(c.output,'teacher-review.json')));assert.equal(teacher.draftHash,sha(JSON.stringify(drafts)));assert.equal(teacher.items.length,6);assert(teacher.reviewed&&teacher.notes);
 for(const [i,draft] of drafts.entries()){
  const batch=card.locator(`[data-testid=pi-question-review][data-review-id="${draft.groupId}"]`);
  if(await batch.locator('[data-slot=chat-tool-trigger]').first().getAttribute('aria-expanded')==='false')await batch.locator('[data-slot=chat-tool-trigger]').first().click();await batch.getByTestId('question-review-stem').first().waitFor();
  const item=batch.getByTestId('question-review-item').nth(draft.index);for(const key of ['stem','answer','analysis'])if(teacher.items[i][key]!==undefined)await item.getByTestId('question-review-'+key).fill(teacher.items[i][key]);
 }
 if(await card.getByTestId('question-collection-check-changes').count())await card.getByTestId('question-collection-check-changes').click();
 await c.until(async()=>!await card.getByTestId('question-collection-reviewed').getByRole('checkbox').isDisabled(),60000);
 await card.getByTestId('question-collection-reviewed').locator('[data-slot=checkbox-content]').click();await card.getByTestId('question-collection-confirm').click();
 await c.until(()=>rows('pi_question_collection').find(r=>r.id===collection.id)?.status==='confirmed');assert.deepEqual(facts().filter(q=>q.source_kind==='teacher_resource'),originals);
 c.report.teacherReview=teacher;c.check('Plain teacher request creates six new multi-part candidates and one actual centralized approval without changing the five scanned originals');
 await c.until(async()=>{paper=rows('pi_paper_candidate').find(r=>r.status==='pending'&&JSON.parse(r.payload_json).selection?.items.length===11);if(paper)return true;const s=await snapshot();if(!s.running)throw Error('After generated approval no full paper preview: '+JSON.stringify(s.projection.turns.at(-1)));return false;},180000);
 selection=JSON.parse(paper.payload_json).selection;assert.equal(selection.shortages.length,0);assert.equal(selection.items.reduce((n,i)=>n+i.points,0),100);assert.equal(selection.items.filter(i=>i.generation).length,6);assert.deepEqual(selection.items.filter(i=>!i.generation).map(i=>i.question.id).sort(),originals.map(q=>q.id).sort());
 const paperCard=page().getByTestId('pi-paper-review').last();if(!await paperCard.getByTestId('pi-paper-preview').isVisible())await paperCard.locator('[data-slot=chat-tool-trigger]').click();
 await paperCard.getByTestId('pi-paper-preview').click();await page().getByTestId('paper-confirm').click();await page().getByTestId('paper-confirmed').waitFor();
 await page().getByTestId('pi-paper-dialog').getByRole('button',{name:'关闭',exact:true}).click();await c.until(async()=>!(await snapshot()).running,180000);
 c.check('Actual whole-paper preview confirms eleven questions and the exact five-source/six-original 40+60-point allocation');
 }else{
 paper=rows('pi_paper_candidate').filter(r=>r.status==='confirmed'&&JSON.parse(r.payload_json).selection?.items.length===11).at(-1);assert(paper);selection=JSON.parse(paper.payload_json).selection;assert.equal(selection.items.reduce((n,i)=>n+i.points,0),100);assert.deepEqual(selection.items.filter(i=>!i.generation).map(i=>i.question.id).sort(),originals.map(q=>q.id).sort());
 c.check('Recovery opens the previously confirmed eleven-question paper without regenerating or approving questions again');
 }
 const paperCard=page().getByTestId('pi-paper-review').last();if(!await paperCard.getByTestId('pi-paper-preview').isVisible())await paperCard.locator('[data-slot=chat-tool-trigger]').click();
 const root=path.join(c.output,'deliveries');fs.mkdirSync(root);await paperCard.getByTestId('pi-paper-preview').click();
 await c.app().evaluate(({dialog},selected)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return{canceled:false,filePaths:[selected]};};},root);
 await page().getByTestId('paper-output-choose').click();await c.until(async()=>(await snapshot()).paperOutput?.label==='deliveries');await page().getByTestId('pi-paper-dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await send('已选择本次新的保存文件夹。请按已确认的试卷重新生成学生卷、教师卷的 Word 和 PDF，共四份新文件，分别交我核对，保留上次版本。');
 const deliveries=[],expected=[];
 for(let n=0;n<4;n++){
  let row;await c.until(async()=>{const s=await snapshot();row=s.officeArtifacts?.find(r=>r.state==='pending');if(row)return true;if(!s.running&&s.projection.turns.at(-1)?.status!=='running')throw Error('Four-file delivery ended early: '+JSON.stringify(s.projection.turns.at(-1)));return false;},180000);
  const result=await page().evaluate(v=>window.omniEdu.reviewXiaozhiOffice(v),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:owner,draftId:row.id});assert(result.ok);const draft=result.value.draft,audience=draft.paperSource.audience,artifact=page().locator(`[data-testid=pi-office-artifact][data-office-id="${row.id}"]`);
  assert.equal(draft.paperSource.paperId,paper.id);assert(!deliveries.some(d=>d.audience===audience&&d.format===row.format));assert(!fs.existsSync(path.join(root,row.path)));
  await artifact.getByTestId('pi-office-review').waitFor();await c.until(async()=>await artifact.getByTestId('pi-office-source-image').locator('img').evaluateAll(images=>images.length>=5&&images.every(i=>i.complete&&i.naturalWidth>0)),60000);
  const figures=draft.sections.flatMap(s=>s.figures||[]),imagePaths=[];
  const findAssets=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?findAssets(path.join(dir,e.name)):[path.join(dir,e.name)]),assets=findAssets(path.join(c.data,'question-assets'));
  for(const [i,f] of figures.entries()){
   const source=assets.find(p=>path.basename(p)===f.assetId+'.png');assert(source);assert.equal(sha(fs.readFileSync(source)),f.sha256);const sourceQuestion=selection.items.find(q=>q.question.id===f.questionId);assert(sourceQuestion.question.document.blocks.some(b=>b.id===f.blockId&&b.sha256===f.sha256));
   const name=`${n}-source-${i}.png`;fs.copyFileSync(source,path.join(c.output,name));imagePaths.push(name);
  }
  assert(figures.length>=5);await artifact.getByTestId('pi-office-images-reviewed').locator('[data-slot=checkbox-content]').click();await c.until(async()=>!await artifact.getByTestId('pi-office-approve').isDisabled());
  if(n===0||n===3){const size=n===0?{width:1366,height:768}:{width:1920,height:1080};await page().emulateMedia({colorScheme:n===0?'light':'dark'});await c.app().evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),size);await page().waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);await artifact.getByTestId('pi-office-source-image').first().scrollIntoViewIfNeeded();c.report.visuals.push({...size,theme:n===0?'light':'dark',label:'Office original image approval'});}
  const png=`office-${audience}-${row.format}.png`;await page().screenshot({path:path.join(c.output,png),animations:'disabled'});c.report.visuals.push({png,audience,format:row.format});
  fs.writeFileSync(path.join(c.output,`draft-${audience}-${row.format}.json`),JSON.stringify(draft,null,2));
  await artifact.getByTestId('pi-office-approve').click();await c.until(async()=>(await snapshot()).officeArtifacts.find(a=>a.id===row.id)?.state==='saved',180000);
  const saved=(await snapshot()).officeArtifacts.find(a=>a.id===row.id),bytes=fs.readFileSync(path.join(root,row.path)),fact=sql('SELECT * FROM document_artifacts WHERE id=?',[saved.artifactId])[0];assert.equal(sha(bytes),fact.content_hash);
  const generated=selection.items.filter(i=>i.generation).map(i=>i.question),markers=['满分 100 分','完整题面（原图，按顺序阅读）：',...generated.map(q=>q.stem),...(audience==='teacher'?selection.items.flatMap(i=>[i.question.answer,i.question.analysis]):[])];
  expected.push({path:row.path,audience,markers,forbiddenMarkers:audience==='student'?['参考答案：','解析：']:[],imagePaths,renderAll:true});deliveries.push({id:row.id,path:row.path,audience,format:row.format,sha256:fact.content_hash});
  c.check(`Ordinary chat requests ${audience}/${row.format}; actual Office image and file approval saves a versioned complete document`);
 }
 await c.until(async()=>!(await snapshot()).running,180000);fs.writeFileSync(path.join(c.output,'office-expected.json'),JSON.stringify(expected));
 const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 c.report.fileReadback=JSON.parse(execFileSync(python,[path.join(c.desktop,'scripts/education/verify-paper-export.py'),root,path.join(c.output,'office-expected.json'),c.output],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));assert(c.report.fileReadback.success);
 const saved=facts();assert.deepEqual(saved.filter(q=>q.source_kind==='teacher_resource'),originals);c.check('Independent A4 Word/PDF readback preserves complete new questions, all source pixels, teacher answers and student answer isolation');
 await c.restart();await c.until(async()=>(await page().locator('.office-composer-container').getAttribute('data-session-id'))===owner);assert.deepEqual(facts(),saved);for(const d of deliveries){assert.equal((await snapshot()).officeArtifacts.find(a=>a.id===d.id).state,'saved');assert.equal(sha(fs.readFileSync(path.join(root,d.path))),d.sha256);}
 c.report.result={owner,paperId:paper.id,collectionId:collection?.id,deliveries,totalPoints:100,sourceQuestions:5,generatedQuestions:6};c.check('Cold formal Electron restores the same confirmed paper and all four delivered files');
}
