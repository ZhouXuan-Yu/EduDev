import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
export async function materialStudyJourney(ctx){
 const {data,output,report,launch,navigate,until,check,page,app,snapshot,restart}=ctx;
 report.boundaries=['Real authorized physics scan through actual local OCR and teacher UI; resumed scan facts are reused, never seeded','Version-bound append-only reading state, notes, source/revision denial, cold restoration','Existing Pi/DeepSeek editable question; one sanitized paragraph only, not independent answer correctness or full DeepTutor'];
 const sample='D:/WorkProject/EduProject/test/2026奉贤三模(3).pdf';assert(fs.existsSync(sample));
 const read=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
 await launch();page().on('dialog',dialog=>void dialog.accept().catch(()=>{}));await navigate('materials');
 const initialCount=read('SELECT COUNT(*) n FROM material_reading_entries')[0].n;
 if(!ctx.readingResume){await app().evaluate(({dialog},file)=>{const original=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return {canceled:false,filePaths:[file]};};},sample);
 await page().getByTestId('materials-import').click();await until(async()=>read('SELECT * FROM teacher_resources WHERE parse_status=?',['ready']).length===1,180000);}
 report.restoredScanFrom=ctx.readingResume||null;
 const resource=read('SELECT * FROM teacher_resources')[0];const chunks=read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]);assert(chunks.length>=2);
 await page().getByTestId('material-'+resource.id).click();await page().getByTestId('materials-study-toggle').click();
 await until(async()=>await page().getByTestId('material-study-note').isEnabled());
 await page().getByTestId('material-study-note').fill(`教师阅读笔记：先核对题图和单位，再让学生说出所用的物理条件。本次补充第${initialCount+1}次：检查参照物选择。`);
 await page().locator('[data-testid=product-rail]:visible').getByTestId('nav-ai-workspace').click();assert(await page().getByTestId('material-study-error').innerText().then(t=>t.includes('尚未保存')));
 await page().getByTestId('material-study-save').click();await until(async()=>await page().getByTestId('material-study-next').isEnabled());
 const first=read('SELECT * FROM material_reading_entries ORDER BY sequence DESC LIMIT 1')[0];assert(first.note.includes('题图和单位'));
 await page().getByTestId('material-study-next').click();await until(async()=>await page().getByTestId('material-study-note').isEnabled());
 await page().getByTestId('material-study-note').fill('第二段笔记：讲解应先给提示；OCR公式尚未核对，不作为标准答案。');await page().getByTestId('material-study-complete').click();
 await until(async()=>read('SELECT * FROM material_reading_entries').length===initialCount+2);
 const second=read('SELECT * FROM material_reading_entries ORDER BY sequence DESC LIMIT 1')[0],source=JSON.parse(second.source_json);assert.equal(source.offset,1);assert.equal(second.completed,1);
 check('Real physics scan is imported/OCR locally; teacher reads two actual paragraphs, unsaved navigation is guarded, and explicit notes/position/completion append without altering source facts');
 for(const [theme,width,height] of [['light',1366,768],['dark',1920,1080]]){await page().emulateMedia({colorScheme:theme});await app().evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page().getByTestId('material-study-note').scrollIntoViewIfNeeded();const png=`reading-${theme}-${width}x${height}.png`;await page().screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height});}
 await restart();await navigate('materials');await page().getByTestId('material-'+resource.id).click();await page().getByTestId('materials-study-toggle').click();
 await until(async()=>await page().getByTestId('material-study-note').inputValue().then(v=>v===second.note));assert((await page().getByTestId('material-study-location').innerText()).includes('第 2 /'));assert((await page().getByTestId('material-study-location').innerText()).includes('已标记读完'));
 await page().getByTestId('material-study-previous').click();await until(async()=>await page().getByTestId('material-study-note').inputValue().then(v=>v===first.note));await page().getByTestId('material-study-save').click();await until(async()=>read('SELECT * FROM material_reading_entries').length===initialCount+3);
 check('Cold current Electron restores the exact second-paragraph note and status; returning to the first paragraph restores its own note, with both historical entries retained');
 const oldRevision=await page().evaluate(async s=>{try{await window.omniEdu.saveMaterialReading({schemaVersion:'xiaozhi.material-study.v1',source:s,expectedRevision:null,note:'不能覆盖旧笔记',completed:false});return false;}catch(e){return String(e).includes('revision_conflict');}},source);assert(oldRevision);
 const original=chunks[1].content_md;const db=new DatabaseSync(path.join(data,'app.db'));db.prepare('UPDATE resource_chunks SET content_md=? WHERE id=?').run(original+'\n隔离测试源变化',source.chunkId);db.close();
 try{const denied=await page().evaluate(async s=>{try{await window.omniEdu.prepareMaterialReadingQuestion({schemaVersion:'xiaozhi.material-study.v1',source:s,question:'解释这一段'});return false;}catch(e){return String(e).includes('source_changed');}},source);assert(denied);}
 finally{const restore=new DatabaseSync(path.join(data,'app.db'));restore.prepare('UPDATE resource_chunks SET content_md=? WHERE id=?').run(original,source.chunkId);restore.close();}
 assert.equal(read('SELECT * FROM material_reading_entries').length,initialCount+3);check('Old revision cannot overwrite a newer reading record; changed derivative cannot be sent as an unchanged source, and exact restoration retains all notes');
 await page().getByTestId('material-study-question').fill('请用高中物理教师的语气，解释这一段需要先核对哪些条件与图示。不要猜测OCR有歧义的公式，不直接解题。');await page().getByTestId('material-study-ask').click();
 await until(async()=>await page().getByTestId('office-prompt-input').inputValue().then(v=>v.includes('资料片段开始')));const prompt=await page().getByTestId('office-prompt-input').inputValue();assert(!prompt.includes('resource_'));assert(!prompt.includes('第二段笔记'));assert(prompt.includes('资料位置：已收录正文第 1 段'));
 await page().getByTestId('office-prompt-input').press('Enter');await until(async()=>{const s=await snapshot();return s.projection.turns.length>0&&!s.running;},240000);const final=await snapshot();assert.equal(final.projection.turns.at(-1).status,'completed');assert.equal(final.limitsEnforced,false);
 const response=await page().locator('[data-slot="chat-message-assistant"]').last().innerText();assert(response.length>50);assert(/条件|图|公式/.test(response));
 check('Current Pi/DeepSeek receives an explicit editable reading question with one current sanitized paragraph and provides an actual answer; no private note, raw image, path or technical source ID is included');
 assert.deepEqual(read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index,id',[resource.id]),chunks);assert.equal(read('SELECT * FROM material_reading_entries').length,initialCount+3);
 report.result={resourceId:resource.id,sourceVersion:resource.content_hash,paragraphs:chunks.length,readingEntries:initialCount+3,newReadingEntries:3,source,answer:response,modelAnswerCorrectness:'not independently verified',sample,sourceFactsUnchanged:true};
}
