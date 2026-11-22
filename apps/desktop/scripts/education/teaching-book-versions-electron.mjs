import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT, fixture=process.env.OMNI_EDU_HANDOUT_FIXTURE;
assert(root&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(baseline.ok&&baseline.bookId&&baseline.sessionId);
const output=fs.mkdtempSync(path.join(root,'teaching-book-versions-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),oldData=path.join(fixture,'data');
const journal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(journal)||fs.statSync(journal).size===0);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const {bookId,sessionId}=baseline;
const report={ok:false,output,bookId,sessionId,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),paidRequests:0,checks:[],errors:[]};
let app,page;

function sql(statement,args=[],write=false) {
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write});
  try{
    database.exec('PRAGMA busy_timeout=5000');
    return write?database.prepare(statement).run(...args):database.prepare(statement).all(...args);
  }
  finally{database.close();}
}
function check(name,details={}){report.checks.push({name,...details});console.log('PASS '+name);}
async function until(read,timeout=30000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const result=await read();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw Error('Teaching book history scenario timed out');
}
async function launch(){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-book-versions',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
  await app.evaluate(({net})=>{
    globalThis.versionModelDispatches=0;
    net.fetch=async raw=>{
      const url=new URL(typeof raw==='string'?raw:raw.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')
        return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576}]}),
          {headers:{'content-type':'application/json'}});
      globalThis.versionModelDispatches++;
      throw Error('No model or external request belongs to version review');
    };
  });
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}
const item=id=>page.getByTestId(id);
const opened=()=>item('teaching-book-version-dialog');
const body=()=>item('teaching-book-version-preview');
const current=()=>page.evaluate(id=>window.omniEdu.getTeachingBook(id),bookId);
const versions=()=>sql('SELECT * FROM teaching_book_versions WHERE book_id=? ORDER BY revision',[bookId]);
async function openBook(){
  await item('pi-teaching-handout').getByTestId('pi-teaching-handout-open').click();
  await item('teaching-book-version-status').waitFor();
}
async function openCurrent(){
  await item('teaching-book-review-current').click();
  await opened().waitFor();
}
async function history(){
  const first=item('teaching-book-version-open-1');
  if(!await first.isVisible()){
    const disclosure=item('teaching-book-version-disclosure');
    await disclosure.getByRole('button',{name:'历史版本'}).click();
  }
  await first.waitFor();
}
async function openVersion(revision){
  await item('teaching-book-version-open-'+revision).click();
  await opened().waitFor();
}
async function closePreview(){
  await opened().getByRole('button',{name:'关闭',exact:true}).click();
  await opened().waitFor({state:'hidden'});
}
async function confirm(){
  await item('teaching-book-version-confirm').click();
  await opened().waitFor({state:'hidden'});
}
const explanation=detail=>detail.blocks.find(block=>block.metadata.handoutRole==='explanation');

try {
  assert(!sql("SELECT name FROM sqlite_master WHERE name='teaching_book_versions'").length);
  const [sourceRecord]=sql('SELECT id,local_path FROM teacher_resources');
  const location=path.relative(oldData,sourceRecord.local_path);
  assert(location&&!location.startsWith('..')&&!path.isAbsolute(location));
  const clonedSourcePath=path.join(data,location);
  assert(fs.existsSync(clonedSourcePath));
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[clonedSourcePath,sourceRecord.id],true);
  await launch();
  await openBook();
  assert.equal(versions().length,0);
  await openCurrent();
  assert.match(await body().innerText(),/教师补充/);
  assert(await body().locator('math').count()>0);
  await page.setViewportSize({width:1366,height:768});
  assert.equal(await body().locator('ol').first().evaluate(list=>getComputedStyle(list).listStyleType),'decimal');
  await page.screenshot({path:path.join(output,'version-review-1366.png'),animations:'disabled'});
  await page.keyboard.press('Escape');
  await opened().waitFor({state:'hidden'});
  assert.equal(versions().length,0);
  await openCurrent();
  await confirm();
  const [first]=versions();
  assert.equal(first.kind,'confirmed');
  const repeated=await page.evaluate(input=>window.omniEdu.confirmTeachingBookVersion(input),{bookId,digest:first.digest});
  assert(repeated.ok&&repeated.value.id===first.id);
  assert.equal(versions().length,1);
  await until(async()=>/第 1 版已确认/.test(await item('teaching-book-version-status').innerText()));
  check('Prior app data opens as a draft, Escape saves nothing, and exact teacher confirmation is idempotent');

  const initial=await current(), initialBlock=explanation(initial);
  const edit='第二版增加独立的代入验算提示。';
  await item('teaching-book-block-edit-'+initialBlock.id).click();
  await item('teaching-book-block-text').fill(edit);
  assert(await item('teaching-book-discard-drafts').count());
  await item('teaching-book-block-save').click();
  await until(async()=>explanation(await current()).payload.text===edit);
  await item('teaching-book-chapter-title').fill('第二版新增章节');
  await item('teaching-book-chapter-create').click();
  await until(async()=> (await current()).chapters.some(chapter=>chapter.title==='第二版新增章节'));
  await until(async()=>/待确认/.test(await item('teaching-book-version-status').innerText()));
  await history();
  await openVersion(1);
  assert.match(await body().innerText(),/教师补充/);
  assert.doesNotMatch(await body().innerText(),/第二版增加/);
  await closePreview();
  await openCurrent();
  assert.match(await body().innerText(),new RegExp(edit));
  await confirm();
  assert.equal(versions()[1].kind,'confirmed');
  const forged=await page.evaluate(input=>window.omniEdu.confirmTeachingBookVersion(input),{bookId,digest:first.digest});
  assert(!forged.ok&&forged.error==='version_conflict');
  check('A chapter and block edit invalidate current confirmation while the old read-only version retains its original body');

  await openVersion(1);
  const competing='恢复前另一个编辑已提交的内容。';
  const active=explanation(await current());
  await page.evaluate(({active,competing})=>window.omniEdu.upsertTeachingBookBlock({
    pageId:active.pageId,type:active.type,title:active.title,status:active.status,payload:{text:competing},
    params:active.params,metadata:active.metadata,sourceAnchors:active.sourceAnchors,order:active.order,
  },active.id,active.version),{active,competing});
  await item('teaching-book-version-restore').click();
  await item('teaching-book-version-error').waitFor();
  assert.match(await item('teaching-book-version-error').innerText(),/发生了变化/);
  assert.equal(versions().length,2);
  await closePreview();
  await item('desktop-back').click();
  await openBook();
  const contentBefore=await current(), savedBlock=explanation(contentBefore);
  await item('teaching-book-block-edit-'+savedBlock.id).click();
  await item('teaching-book-patch-text').fill('恢复前的一个独立候选局部修改。');
  await item('teaching-book-patch-propose').click();
  await until(()=>sql('SELECT id FROM teaching_book_patches WHERE book_id=?',[bookId]).length===1);
  await item('teaching-book-block-cancel').click();
  await history();
  await openVersion(1);
  await item('teaching-book-version-restore').click();
  await opened().waitFor({state:'hidden'});
  await until(()=>versions().length===4);
  const [,second,beforeRestore,restored]=versions();
  assert.equal(beforeRestore.kind,'before_restore');
  assert.equal(restored.kind,'restored_draft');
  assert.equal(restored.restored_from,first.id);
  assert(JSON.parse(beforeRestore.image_json).patches.length===1);
  assert.match(JSON.parse(beforeRestore.image_json).content.blocks.find(block=>block.id===savedBlock.id).payload.text,new RegExp(competing));
  const restoredBook=await current();
  assert(!restoredBook.chapters.some(chapter=>chapter.title==='第二版新增章节'));
  assert.notEqual(explanation(restoredBook).id,savedBlock.id);
  assert.equal(explanation(restoredBook).payload.text,initialBlock.payload.text);
  assert.equal(restoredBook.book.status,'draft');
  const staleBlock=await page.evaluate(block=>window.omniEdu.upsertTeachingBookBlock({
    pageId:block.pageId,type:block.type,payload:{text:'不应写入旧块'}
  },block.id,block.version).then(()=>false,()=>true),savedBlock);
  assert(staleBlock);
  assert.equal(versions()[1].id,second.id);
  await until(async()=>/待确认/.test(await item('teaching-book-version-status').innerText()));
  check('Restore refuses a stale preview, preserves the superseded draft and its patches, and allocates fresh editable nodes');

  await openCurrent();
  const material=restoredBook.materialSources[0], [source]=sql('SELECT content_md FROM resource_chunks WHERE id=?',[material.chunkId]);
  sql('UPDATE resource_chunks SET content_md=? WHERE id=?',[source.content_md+'\n原段落发生了修订。',material.chunkId],true);
  await item('teaching-book-version-confirm').click();
  await item('teaching-book-version-error').waitFor();
  assert.match(await item('teaching-book-version-error').innerText(),/引用的资料已变化/);
  assert.equal(versions().length,4);
  await closePreview();
  sql('UPDATE resource_chunks SET content_md=? WHERE id=?',[source.content_md,material.chunkId],true);
  await openCurrent();
  await confirm();
  await until(async()=>/第 5 版已确认/.test(await item('teaching-book-version-status').innerText()));
  assert.equal(versions()[4].kind,'confirmed');
  await page.setViewportSize({width:1920,height:1080});
  await openVersion(3);
  assert.match(await body().innerText(),new RegExp(competing));
  await page.screenshot({path:path.join(output,'history-preview-1920.png'),animations:'disabled'});
  await closePreview();
  check('Changed source blocks confirmation and the restored draft becomes confirmed only after a new teacher action');

  assert.equal(await app.evaluate(()=>globalThis.versionModelDispatches),0);
  const saved=versions();
  await app.close();app=undefined;
  await launch();
  await openBook();
  await until(async()=>/第 5 版已确认/.test(await item('teaching-book-version-status').innerText()));
  await history();
  await openVersion(1);
  assert.match(await body().innerText(),/教师补充/);
  assert.deepEqual(versions(),saved);
  assert.equal(await app.evaluate(()=>globalThis.versionModelDispatches),0);
  assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
  assert.deepEqual(report.errors,[]);
  check('Cold restart retains all immutable revisions and the same conversation link with zero model dispatches');
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  console.error(report.error);
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));
}
