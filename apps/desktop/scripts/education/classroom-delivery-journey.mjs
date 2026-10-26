import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import JSZip from 'jszip';
/** Reuse the accepted, teacher-edited actual Pi classroom. One new export, no regeneration. */
export async function classroomDeliveryJourney(ctx){
 if(process.argv.includes('--classroom-documents'))return classroomDocumentsJourney(ctx);
 const {data,output,report,launch,navigate,until,check,restart}=ctx;
 const source=process.argv.find(a=>a.startsWith('--classroom-delivery='))?.split('=')[1];
 assert(/^education-journey-[a-zA-Z0-9]+$/.test(source||''));
 const prior=path.resolve('test-results',source),proof=JSON.parse(fs.readFileSync(path.join(prior,'report.json')));
 assert(proof.success&&proof.scenario==='MA-CLASSROOM'&&proof.classroom.saved.status==='confirmed');
 fs.cpSync(path.join(prior,'data'),data,{recursive:true});
 fs.mkdirSync(path.join(output,'electron-profile'),{recursive:true});
 const root=path.join(output,'teacher-workspace');fs.mkdirSync(root);
 report.provenance={from:prior,sha256:createHash('sha256').update(fs.readFileSync(path.join(prior,'report.json'))).digest('hex'),build:proof.build,profile:'fresh isolated profile, owned confirmed classroom only'};
 report.boundaries=['One real Pi/DeepSeek export request, confirmed revision 2, existing Office preview/approval/save and cold readback','PPTX only; PDF/DOCX/import, all-subject answer accuracy, Word/WPS layout and complete Golden E remain OPEN'];
 const page=()=>ctx.page(),app=()=>ctx.app();let session='';
 const snapshot=()=>page().evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
 const sql=(query)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all();}finally{db.close();}};
 const facts=()=>sql("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_candidate' ORDER BY created_at,id");
 const before=facts(),records=sql('SELECT * FROM learning_records');
 const card=id=>page().locator(`[data-testid=pi-office-artifact][data-office-id="${id}"]`);
 const capture=async(label,locator)=>{for(const[theme,width,height]of[['light',1366,768],['dark',1920,1080]]){await page().emulateMedia({colorScheme:theme});await app().evaluate(({BrowserWindow},v)=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(0,0);w.setContentSize(v.width,v.height);},{width,height});await page().waitForFunction(v=>innerWidth===v.width&&innerHeight===v.height,{width,height});await locator.scrollIntoViewIfNeeded();assert(await page().evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const png=`${label}-${theme}-${width}x${height}.png`;await page().screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height});}};
 await launch();await app().evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(0,0);w.setContentSize(1920,1080);});
 await navigate('teaching');await page().getByTestId('teaching-classrooms-tab').click();
 const listed=await page().evaluate(()=>window.omniEdu.listClassrooms());assert(listed.ok);const item=listed.data.find(x=>x.id===proof.classroom.saved.id);assert(item);assert.equal(item.revision,2);
 await page().getByTestId('classroom-'+item.id).click();
 await app().evaluate(({dialog},directory)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return{canceled:false,filePaths:[directory]};};},root);
 await page().getByTestId('classroom-export-pptx').click();
 await until(async()=>await page().locator('.office-composer-container').getAttribute('data-session-id')===item.sessionId);session=item.sessionId;
 const input=page().getByTestId('office-prompt-input');await until(async()=>!await input.isDisabled()&&(await input.inputValue()).includes(item.document.title));
 await app().evaluate(({dialog},directory)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return{canceled:false,filePaths:[directory]};};},root);
 await until(async()=>!!(await snapshot()).paperOutput);
 const old=(await snapshot()).projection.turns.at(-1)?.id;await input.press('Enter');assert.equal(await input.inputValue(),'');
 let row;await until(async()=>{const s=await snapshot();row=s.officeArtifacts?.find(x=>x.state==='pending');if(row)return true;if(!s.running&&s.projection.turns.at(-1)?.id!==old)throw Error('No classroom export approval: '+JSON.stringify(s.projection.turns.at(-1)));return false;},240000);
 const review=await page().evaluate(i=>window.omniEdu.reviewXiaozhiOffice(i),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id});assert(review.ok,JSON.stringify(review));assert.deepEqual(review.value.draft.classroomSource.document,item.document);
 await card(row.id).getByTestId('pi-classroom-export-preview').waitFor();assert(await card(row.id).getByTestId('pi-office-approve').isDisabled());
 const previews=card(row.id).getByTestId('classroom-slide-preview');assert.equal(await previews.count(),item.document.scenes.filter(s=>s.type==='slide').length);
 for(let i=0;i<await previews.count();i++){await previews.nth(i).scrollIntoViewIfNeeded();await previews.nth(i).contentFrame().locator('.classroom-canvas').waitFor();}
 await capture('classroom-delivery-preview',card(row.id).getByTestId('pi-classroom-export-preview').locator('h2'));
 check('Actual classroom export opens the existing Office approval with the exact confirmed document and requires teacher review');
 const acknowledged=card(row.id).getByTestId('pi-office-images-reviewed');await acknowledged.locator('[data-slot=checkbox-content]').click();assert(await acknowledged.getByRole('checkbox').isChecked());
 await card(row.id).getByTestId('pi-office-approve').click();await until(async()=>!(await snapshot()).running,240000);
 const saved=(await snapshot()).officeArtifacts.find(x=>x.id===row.id);assert.equal(saved.state,'saved',JSON.stringify(saved));assert.equal((await snapshot()).projection.turns.at(-1).status,'completed');
 const fact=sql('SELECT * FROM document_artifacts').find(x=>x.id===saved.artifactId);assert(fact);const bytes=fs.readFileSync(path.join(root,row.path));assert.equal(fact.content_hash,createHash('sha256').update(bytes).digest('hex'));
 const zip=await JSZip.loadAsync(bytes),names=Object.keys(zip.files),slides=names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));assert(slides.length>=4);
 const xml=(await Promise.all(slides.map(n=>zip.file(n).async('string')))).join('\n');assert(xml.includes('custGeom'));assert(xml.includes('教师修订'));assert(xml.includes('斜边长是多少'));assert(xml.includes('参考答案'));assert(xml.includes('教师提醒'));
 const images=names.filter(n=>/^ppt\/media\/.*\.png$/.test(n));assert(images.length>=2);for(const image of images){const b=await zip.file(image).async('nodebuffer');assert.equal(b.subarray(1,4).toString(),'PNG');fs.writeFileSync(path.join(output,path.basename(image)),b);}
 assert.deepEqual(facts(),before);assert.deepEqual(sql('SELECT * FROM learning_records'),records);
 check('Teacher approval saves real PPTX containing editable geometry/text, two local formula images and both full questions without rewriting classroom facts');
 report.classroom={saved:item};report.delivery={session,row:saved,artifact:fact,slides,images,bytes:bytes.length};
 const turns=(await snapshot()).projection.turns;await restart();await page().getByTestId('ai-conversation-session-'+session).click();await until(async()=>await page().locator('.office-composer-container').getAttribute('data-session-id')===session);assert.deepEqual((await snapshot()).projection.turns,turns);assert.equal((await snapshot()).officeArtifacts.find(x=>x.id===row.id).state,'saved');assert.deepEqual(facts(),before);assert.deepEqual(sql('SELECT * FROM learning_records'),records);
 await navigate('teaching');await page().getByTestId('teaching-artifacts-workspace').waitFor();await page().getByTestId('artifact-'+fact.id).waitFor();await capture('classroom-delivery-cold',page().getByTestId('artifact-'+fact.id));
 check('Cold Electron restores the exact saved PPTX in the current teaching files directory without generation replay');
 fs.writeFileSync(path.join(output,'classroom-delivery-readback.json'),JSON.stringify({delivery:report.delivery,source:item,ledger:before},null,2));
}

/** Same accepted classroom and real Office user route; no classroom regeneration. */
async function classroomDocumentsJourney(ctx){
 const {data,output,report,launch,navigate,until,check,restart}=ctx;
 const source=process.argv.find(a=>a.startsWith('--classroom-delivery='))?.split('=')[1];assert(/^education-journey-[a-zA-Z0-9]+$/.test(source||''));
 const prior=path.resolve('test-results',source),proof=JSON.parse(fs.readFileSync(path.join(prior,'report.json')));assert(proof.success&&proof.scenario==='MA-CLASSROOM'&&proof.classroom.saved.status==='confirmed');
 fs.cpSync(path.join(prior,'data'),data,{recursive:true});const root=path.join(output,'teacher-workspace');fs.mkdirSync(root);
 report.provenance={from:prior,sha256:createHash('sha256').update(fs.readFileSync(path.join(prior,'report.json'))).digest('hex'),build:proof.build};
 report.boundaries=['Actual teacher-confirmed classroom → real Pi export → existing Office teacher approval → DOCX student handout/PDF teacher notes → cold readback','Full slide images, editable quiz text; teacher notes are existing references, not narration; full subjects, classroom import and full Golden E remain OPEN'];
 const page=()=>ctx.page(),app=()=>ctx.app(),item=proof.classroom.saved,session=item.sessionId;
 const snapshot=()=>page().evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
 const sql=query=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all();}finally{db.close();}};
 const facts=()=>sql("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_candidate' ORDER BY created_at,id");const before=facts(),records=sql('SELECT * FROM learning_records');
 const capture=async(label,target)=>{for(const [theme,width,height]of[['light',1366,768],['dark',1920,1080]]){await page().emulateMedia({colorScheme:theme});await app().evaluate(({BrowserWindow},v)=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(0,0);w.setContentSize(v.width,v.height);},{width,height});await page().waitForFunction(v=>innerWidth===v.width&&innerHeight===v.height,{width,height});await target.scrollIntoViewIfNeeded();assert(await page().evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const png=`${label}-${theme}-${width}x${height}.png`;await page().screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height});}};
 await launch();const deliveries=[];
 for(const [purpose,format]of[['handout','docx'],['teacher_notes','pdf'],['handout','pdf'],['teacher_notes','docx']]){
  await navigate('teaching');await page().getByTestId('teaching-classrooms-tab').click();await page().getByTestId('classroom-'+item.id).click();
  await capture('classroom-document-actions',page().getByTestId(`classroom-export-${purpose}-${format}`));
  await app().evaluate(({dialog},directory)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return{canceled:false,filePaths:[directory]};};},root);
  await page().getByTestId(`classroom-export-${purpose}-${format}`).click();await until(async()=>await page().locator('.office-composer-container').getAttribute('data-session-id')===session);
  const input=page().getByTestId('office-prompt-input');await until(async()=>!await input.isDisabled()&&(await input.inputValue()).includes(item.document.title));await until(async()=>!!(await snapshot()).paperOutput);
  const old=(await snapshot()).projection.turns.at(-1)?.id;await input.press('Enter');assert.equal(await input.inputValue(),'');
  let row;await until(async()=>{const s=await snapshot();row=s.officeArtifacts?.find(x=>x.state==='pending');if(row)return true;if(!s.running&&s.projection.turns.at(-1)?.id!==old)throw Error('No classroom document approval: '+JSON.stringify(s.projection.turns.at(-1)));return false;},240000);
  const review=await page().evaluate(i=>window.omniEdu.reviewXiaozhiOffice(i),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id});assert(review.ok,JSON.stringify(review));assert.equal(row.format,format);assert.equal(review.value.draft.classroomSource.purpose,purpose);assert.equal(review.value.draft.classroomSource.includeAnswers,purpose==='teacher_notes');assert.deepEqual(review.value.draft.classroomSource.document,item.document);
  const card=page().locator(`[data-testid=pi-office-artifact][data-office-id="${row.id}"]`);await card.getByTestId('pi-classroom-export-preview').waitFor();assert(await card.getByTestId('pi-office-approve').isDisabled());
  const generic={schemaVersion:'xiaozhi.office-draft.v1',title:review.value.draft.title,sections:review.value.draft.sections};
  const substituted=await page().evaluate(i=>window.omniEdu.reviseXiaozhiOffice(i),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id,revision:row.revision,draft:generic});assert.equal(substituted.ok,false,'Confirmed classroom cannot be downgraded to a source-free document');
  const frames=card.getByTestId('classroom-slide-preview');for(let i=0;i<await frames.count();i++){await frames.nth(i).scrollIntoViewIfNeeded();await frames.nth(i).contentFrame().locator('.classroom-canvas').waitFor();}
  await capture('classroom-'+purpose+'-review',card.getByTestId('pi-classroom-export-preview').locator('h2'));
  const acknowledged=card.getByTestId('pi-office-images-reviewed');await acknowledged.locator('[data-slot=checkbox-content]').click();await card.getByTestId('pi-office-approve').click();await until(async()=>!(await snapshot()).running,240000);
  const saved=(await snapshot()).officeArtifacts.find(x=>x.id===row.id);assert.equal(saved.state,'saved',JSON.stringify(saved));assert.equal((await snapshot()).projection.turns.at(-1).status,'completed');
  const artifact=sql('SELECT * FROM document_artifacts').find(x=>x.id===saved.artifactId);assert(artifact);const file=path.join(root,row.path),bytes=fs.readFileSync(file);assert.equal(artifact.content_hash,createHash('sha256').update(bytes).digest('hex'));
  if(format==='docx'){
   const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string'),images=Object.keys(zip.files).filter(n=>/^word\/media\/.*\.png$/.test(n));assert.equal(images.length,item.document.scenes.filter(s=>s.type==='slide').length);assert(xml.includes('斜边长是多少'));assert.equal(xml.includes('参考答案：'),purpose==='teacher_notes');assert.equal(xml.includes('教师提醒'),purpose==='teacher_notes');assert(xml.includes('不可编辑'));for(const name of images)fs.writeFileSync(path.join(output,path.basename(name)),await zip.file(name).async('nodebuffer'));
  }else assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  deliveries.push({purpose,format,row:saved,artifact,file,bytes:bytes.length});assert.deepEqual(facts(),before);assert.deepEqual(sql('SELECT * FROM learning_records'),records);
  check(`Actual ${format}/${purpose} preview and teacher approval save exact confirmed classroom without rewriting facts`);
 }
 report.classroom={saved:item};report.deliveries=deliveries;const turns=(await snapshot()).projection.turns;
 await restart();await page().getByTestId('ai-conversation-session-'+session).click();await until(async()=>await page().locator('.office-composer-container').getAttribute('data-session-id')===session);assert.deepEqual((await snapshot()).projection.turns,turns);
 for(const d of deliveries)assert.equal((await snapshot()).officeArtifacts.find(x=>x.id===d.row.id).state,'saved');assert.deepEqual(facts(),before);assert.deepEqual(sql('SELECT * FROM learning_records'),records);
 await navigate('teaching');for(const d of deliveries)await page().getByTestId('artifact-'+d.artifact.id).waitFor();await capture('classroom-documents-cold',page().getByTestId('artifact-'+deliveries[0].artifact.id));check('Cold native Electron restores all four versioned documents in current teaching files without model replay');
 fs.writeFileSync(path.join(output,'classroom-documents-readback.json'),JSON.stringify({deliveries,source:item,ledger:before},null,2));
}
