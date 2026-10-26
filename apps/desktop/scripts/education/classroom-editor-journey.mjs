import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
/** One existing real Pi-generated classroom; UI editing requires no repeated model call. */
export async function classroomEditorJourney(ctx){
 const {data,output,report,launch,navigate,until,check,restart,neutralCapture}=ctx;
 const source=process.argv.find(a=>a.startsWith('--classroom-editor='))?.slice(19);
 assert(/^education-journey-[a-zA-Z0-9]+$/.test(source||''));
 const prior=path.resolve('test-results',source),proof=JSON.parse(fs.readFileSync(path.join(prior,'report.json')));
 assert(proof.scenario==='MA-CLASSROOM'&&proof.success&&proof.classroom.saved.status==='confirmed');
 fs.cpSync(path.join(prior,'data'),data,{recursive:true});
 fs.mkdirSync(path.join(output,'electron-profile'),{recursive:true});
 report.provenance={from:prior,sha256:createHash('sha256').update(fs.readFileSync(path.join(prior,'report.json'))).digest('hex'),build:proof.build,modelRequestsThisRun:0,profile:'fresh isolated Chromium profile; classroom truth reused from owned SQLite/files'};
 report.boundaries=['Actual pinned OpenMAIC editor 0.0.9/core/UI in opaque sandbox; existing classroom ledger','Previous actual Pi-generated lesson reused; no new model call, daily profile, export, all-subject accuracy or installer acceptance'];
 const facts=()=>{const db=new DatabaseSync(path.join(data,'app.db'));try{return{rows:db.prepare("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_candidate' ORDER BY created_at,id").all(),records:db.prepare('SELECT count(*) n FROM learning_records').get().n};}finally{db.close();}};
 const original=facts();
 const capture=async label=>{for(const[theme,width,height]of [['light',1366,768],['dark',1920,1080]]){const p=ctx.page();await p.emulateMedia({colorScheme:theme});await ctx.app().evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await p.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});await neutralCapture();await p.getByTestId('classroom-slide-preview').scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const png=`${label}-${theme}-${width}x${height}.png`;await p.screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height});}};
 await launch();let page=ctx.page();await ctx.app().evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setPosition(0,0);window.setContentSize(1920,1080);});await page.waitForFunction(()=>innerWidth===1920&&innerHeight===1080);await navigate('teaching');await page.getByTestId('teaching-classrooms-tab').click();
 const list=await page.evaluate(()=>window.omniEdu.listClassrooms());assert(list.ok);const item=list.data[0];assert.equal(item.revision,1);
 await page.getByTestId('classroom-'+item.id).click();await page.getByTestId('classroom-edit').click();
 let frame=page.frameLocator('[data-testid="classroom-slide-preview"]');await frame.getByTestId('classroom-editor-surface').waitFor();
 const clickText=async()=>{await page.getByTestId('classroom-slide-preview').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const outer=await page.getByTestId('classroom-slide-preview').evaluate(el=>el.getBoundingClientRect().toJSON()),inner=await frame.locator(`[data-select-element-id="${text.id}"]`).evaluate(el=>el.getBoundingClientRect().toJSON());assert(outer&&inner.width>0);const x=outer.x+inner.x+inner.width/2+1,y=outer.y+inner.y+inner.height/2+1;report.clickPoint={x,y,outer,inner,hostHit:await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-testid'),{x,y})};await page.mouse.click(x,y);};
 assert.equal(await frame.locator('body').evaluate(()=>typeof window.omniEdu),'undefined');assert.equal(await frame.locator('body').evaluate(()=>typeof window.require),'undefined');
 const scene=item.document.scenes[0],text=scene.content.canvas.elements.find(e=>e.type==='text');assert(text);
 report.editorGeometry=await frame.locator(`[data-select-element-id="${text.id}"]`).evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),style:el.getAttribute('style')}));
 await frame.locator('body').evaluate(()=>{window.__classroomEvents=[];for(const type of ['pointerdown','pointerup','click','dblclick'])document.addEventListener(type,e=>{window.__classroomEvents.push({type,target:e.target.outerHTML?.slice(0,200),pointerId:e.pointerId});},true);});
 await clickText();const editor=frame.locator('[contenteditable="true"]').first();
 await page.waitForTimeout(400);fs.writeFileSync(path.join(output,'editor-debug.json'),JSON.stringify(await frame.locator('body').evaluate(()=>({events:window.__classroomEvents,editables:[...document.querySelectorAll('[contenteditable]')].map(el=>({html:el.outerHTML.slice(0,1500),rect:el.getBoundingClientRect().toJSON()})),textEditors:[...document.querySelectorAll('[data-editor]')].map(el=>el.outerHTML.slice(0,1500)),body:document.body.innerText.slice(0,2500)})),null,2));await editor.waitFor({timeout:5000});
 const revised='教师修订：直角三角形的三边关系';await editor.fill(revised);await frame.getByTestId('classroom-undo').click();
 await until(async()=>!await frame.getByTestId('classroom-redo').isDisabled());await frame.getByTestId('classroom-redo').click();
 await until(async()=>!await page.getByTestId('classroom-save').isDisabled());
 assert((await frame.locator('#slide-element-'+text.id).innerText()).includes(revised));
 await capture('classroom-editor');check('Teacher uses actual upstream rich text editor and undo/redo in isolated classroom');
 // Cancelling discards the live sandbox draft and does not write a revision.
 await page.getByRole('button',{name:'取消编辑',exact:true}).click();assert.deepEqual(facts(),original);
 frame=page.frameLocator('[data-testid="classroom-slide-preview"]');await frame.locator('.classroom-canvas').waitFor();assert(!(await frame.locator('body').innerText()).includes(revised));
 check('Cancel restores the original confirmed slide and writes no classroom or student fact');
 await page.getByTestId('classroom-edit').click();frame=page.frameLocator('[data-testid="classroom-slide-preview"]');await frame.getByTestId('classroom-editor-surface').waitFor();await clickText();await frame.locator('[contenteditable="true"]').first().fill(revised);await frame.locator('header').click();await until(async()=>!await page.getByTestId('classroom-save').isDisabled());
 // The actual generated orange diagonal is reversed relative to the filled triangle.
 // Repair it with upstream endpoint gestures, never by writing fixture JSON into main.
 const diagonal=scene.content.canvas.elements.find(e=>e.type==='line'&&e.start[0]!==e.end[0]&&e.start[1]!==e.end[1]);assert(diagonal);
 const point=async selector=>{const outer=await page.getByTestId('classroom-slide-preview').evaluate(el=>el.getBoundingClientRect().toJSON()),inner=await frame.locator(selector).evaluate(el=>el.getBoundingClientRect().toJSON());assert(outer);return{x:outer.x+inner.x+inner.width/2+1,y:outer.y+inner.y+inner.height/2+1};};
 await page.getByTestId('classroom-slide-preview').scrollIntoViewIfNeeded();await frame.getByTestId('classroom-element-select').selectOption(diagonal.id);await frame.locator('[data-line-handle=start]').waitFor();const start=await point('[data-line-handle=start]'),end=await point('[data-line-handle=end]');
 const drag=async(selector,destination)=>{const from=await point(selector);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:20});await page.mouse.up();};
 await drag('[data-line-handle=start]',{x:start.x,y:end.y});await drag('[data-line-handle=end]',{x:end.x,y:start.y});
 check('Teacher selects an occluded line and repairs it with actual upstream endpoint gestures');
 await page.getByTestId('classroom-save').click();await page.getByTestId('classroom-notice').waitFor();
 const saved=await page.evaluate(()=>window.omniEdu.listClassrooms());assert(saved.ok);const next=saved.data[0];assert.equal(next.revision,2);assert.notEqual(next.id,item.id);assert(next.document.scenes[0].content.canvas.elements.find(e=>e.id===text.id).content.includes(revised));const repaired=next.document.scenes[0].content.canvas.elements.find(e=>e.id===diagonal.id);assert(repaired.type==='line');assert(repaired.start[1]<repaired.end[1]);report.diagram={before:diagonal,after:repaired,quality:'teacher correction, not autonomous mathematical verification'};
 const stale=await page.evaluate(input=>window.omniEdu.decideClassroom(input),{id:item.id,version:item.version,decision:'confirm',document:item.document});assert(!stale.ok&&stale.error==='conflict');const historical=await page.evaluate(id=>window.omniEdu.readClassroom(id),item.id);assert(historical.ok);assert.deepEqual(historical.data,item);
 const after=facts();assert.equal(after.rows.length,original.rows.length+1);assert.equal(after.records,original.records);check('Edited slide appends revision 2, preserves revision 1 and rejects stale confirmation');
 report.classroom={initial:item,saved:next};await restart();page=ctx.page();await navigate('teaching');await page.getByTestId('teaching-classrooms-tab').click();await page.getByTestId('classroom-'+next.id).click();frame=page.frameLocator('[data-testid="classroom-slide-preview"]');await frame.locator('.classroom-canvas').waitFor();assert((await frame.locator('body').innerText()).includes(revised));const recovered=await page.evaluate(()=>window.omniEdu.listClassrooms());assert.deepEqual(recovered,saved);assert.deepEqual(facts(),after);await capture('classroom-editor-cold');check('Cold Electron restores the revised slide with no model replay or fact writes');
 fs.writeFileSync(path.join(output,'classroom-editor-readback.json'),JSON.stringify({item,next,recovered,ledger:after},null,2));
}
