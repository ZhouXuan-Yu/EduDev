import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PROTOTYPE_PLAYWRIGHT || 'playwright');
const root=import.meta.dirname,out=path.join(root,'evidence','studio-v3');
fs.mkdirSync(out,{recursive:true});
const report={layer:'offline HTML prototype, not production',checks:[],screenshots:[],errors:[],requests:[],success:false};
const browser=await chromium.launch({channel:process.env.PROTOTYPE_BROWSER || 'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('request',r=>{if(/^https?:/.test(r.url()))report.requests.push(r.url());});
const url=pathToFileURL(path.join(root,'index.html')).href;
const check=async(name,run)=>{await run();report.checks.push(name);console.log('PASS',name);};
const shot=async name=>{await page.locator('#toast').evaluate(el=>el.hidden=true);await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});report.screenshots.push(name+'.png');};
const count=async n=>assert.equal(await page.locator('#studio-count').innerText(),String(n));
const view=async name=>page.locator(`[data-studio-view="${name}"]`).first().click();
const close=async()=>page.getByRole('button',{name:'关闭对话框',exact:true}).click();
const fits=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const draft=()=>page.evaluate(()=>structuredClone(Design.studio.state.draft));
try{
  await page.goto(url);
  await check('Teaching entry has full questions, multi-source actions and empty basket',async()=>{
    await page.locator('[data-route="teaching"]').click();await page.locator('[data-teaching-tab="组卷"]').click();
    assert.equal(await page.locator('.qs-question').count(),8);await count(0);await shot('01-bank-1366');
  });
  await check('Filter, add and duplicate prevention',async()=>{
    await page.locator('[data-point="称重法"]').click();assert.equal(await page.locator('.qs-question').count(),3);
    await page.locator('[data-add="PHY-002"]').click();await count(1);assert(await page.locator('[data-add="PHY-002"]').isDisabled());
  });
  await check('Editor, continue selecting and parent return preserve draft and filter',async()=>{
    await view('edit');assert.equal(await page.locator('.qs-edit-question').count(),1);await view('bank');
    assert.equal(await page.locator('[data-point="称重法"]').getAttribute('aria-pressed'),'true');
    await page.locator('#studio-exit').click();assert(await page.locator('[data-teaching-tab="教学文件"]').isVisible());
    await page.locator('[data-teaching-tab="组卷"]').click();await count(1);
  });
  await check('Browser back and forward restore work surfaces',async()=>{
    await view('edit');await page.goBack();await page.locator('#studio-results').waitFor();await count(1);
    await page.goForward();await page.locator('#studio-title').waitFor();assert.equal(await page.locator('.qs-edit-question').count(),1);
  });
  await check('Reload restores draft, title and route',async()=>{
    await page.locator('#studio-title').fill('浮力随堂练习 · 三题');await page.locator('#studio-title').press('Tab');
    await page.reload();assert.equal(await page.locator('#studio-title').inputValue(),'浮力随堂练习 · 三题');
    assert.equal((await draft()).items.length,1);
  });
  await check('Three questions can form practice without exam configuration',async()=>{
    await view('bank');await page.locator('#studio-clear').click();await page.locator('[data-add="PHY-001"]').click();await page.locator('[data-add="PHY-003"]').click();await count(3);await shot('02-selected-1366');
    await view('edit');assert.equal(await page.locator('[data-score]').count(),0);await shot('03-editor-1366');
  });
  await check('Preview and downloaded student HTML use same order and omit answers',async()=>{
    await page.getByRole('button',{name:'预览与导出',exact:true}).click();
    const frame=page.frameLocator('#studio-paper-frame');assert.equal(await frame.locator('article').count(),3);assert.equal(await frame.locator('.answer').count(),0);
    const wait=page.waitForEvent('download');await page.locator('#studio-download').click();const download=await wait;
    await download.saveAs(path.join(out,'student-export.html'));const text=fs.readFileSync(path.join(out,'student-export.html'),'utf8');
    assert(text.includes('浮力随堂练习'));assert(!text.includes('<div class="answer">'));await shot('04-preview-student');
    await page.locator('[data-preview-kind="teacher"]').click();assert.equal(await frame.locator('.answer').count(),3);await shot('05-preview-teacher');
  });
  await check('Content edits invalidate review and block exports until teacher confirms',async()=>{
    await view('edit');await page.locator('[data-edit]').first().click();await page.locator('[name="text"]').fill('修改后的题干：测力计读数为何变小？');await page.getByRole('button',{name:'保存本题',exact:true}).click();
    await page.getByRole('button',{name:'预览与导出',exact:true}).click();assert(await page.locator('#studio-download').isDisabled());
    await view('edit');await page.locator('[data-edit]').first().click();await page.locator('[name="reviewed"]').check();await page.getByRole('button',{name:'保存本题',exact:true}).click();
    await page.getByRole('button',{name:'预览与导出',exact:true}).click();assert(await page.locator('#studio-download').isEnabled());
  });
  await check('Manual paste preserves text safely; canceled import has no side effects',async()=>{
    await view('bank');await page.locator('[data-studio-dialog="upload"]').click();await page.locator('#qs-paste').fill('第一道题 <script>alert(1)</script>\n---\n第二道题');await page.locator('#qs-parse').click();assert.equal(await page.locator('[data-import-check]').count(),2);await close();await count(3);
    await page.locator('[data-studio-dialog="upload"]').click();await page.locator('#qs-paste').fill('教师粘贴：浮力的方向是什么？');await page.locator('#qs-parse').click();await page.locator('#qs-import-accept').click();await count(4);
  });
  await check('Uploaded filename is not presented as real OCR; teacher selects sample',async()=>{
    await page.locator('[data-studio-dialog="upload"]').click();await page.locator('#qs-upload-file').setInputFiles({name:'reference.pdf',mimeType:'application/pdf',buffer:Buffer.from('prototype fixture only')});
    await page.locator('#qs-demo-upload').click();assert.equal(await page.locator('[data-import-check]').count(),2);await page.locator('[data-import-check="1"]').uncheck();await page.locator('#qs-import-accept').click();await count(5);
  });
  await check('Template layout-only retains question content and purpose',async()=>{
    const before=await draft();await page.locator('[data-studio-dialog="reference"]').click();await page.locator('#qs-reference-next').click();await page.locator('#qs-use-structure').uncheck();await shot('06-reference-review');await page.locator('#qs-template-apply').click();
    const after=await draft();assert.deepEqual(after.items,before.items);assert.equal(after.purpose,'practice');assert.equal(after.layout,'A4双栏测验');assert.deepEqual(after.blueprint,[]);
  });
  await check('Template structure-only preserves layout and items, exposes scores',async()=>{
    await page.locator('#studio-layout').selectOption('默认练习版式');const before=await draft();
    await page.locator('[data-studio-dialog="reference"]').click();await page.locator('#qs-reference-next').click();await page.locator('#qs-use-layout').uncheck();await page.locator('#qs-template-apply').click();
    const after=await draft();assert.equal(after.layout,'默认练习版式');assert.equal(after.purpose,'exam');assert.deepEqual(after.items,before.items);assert.equal(await page.locator('[data-score]').count(),5);
  });
  await check('Saved templates support another version without changing draft',async()=>{
    await view('templates');assert.equal(await page.locator('[data-template]').count(),2);await page.locator('[data-template]').first().click();await page.locator('#qs-template-name').fill('浮力测验 · 教研版本');await page.locator('#qs-template-save').click();assert.equal(await page.locator('[data-template]').count(),3);await shot('07-templates');
  });
  await check('Blueprint matching reports shortages and preserves manually selected items',async()=>{
    await view('bank');const before=await draft();await page.locator('[data-studio-dialog="generate"]').click();await page.locator('[data-plan-count="0"]').fill('10');await page.locator('#qs-match').click();assert((await page.locator('#qs-match-results').innerText()).includes('仍缺'));await shot('08-plan-shortage');await page.locator('#qs-plan-accept').click();const after=await draft();assert.deepEqual(after.items.slice(0,before.items.length),before.items);
  });
  await check('Adaptation comparison accepts only explicitly and keeps lineage',async()=>{
    await view('edit');const before=await draft();await page.locator('[data-adapt]').first().click();await page.locator('#qs-adapt-demand').fill('增加解释理由的小问');await page.locator('#qs-adapt-next').click();await shot('09-adapt-compare');assert.deepEqual((await draft()).items,before.items);await page.locator('#qs-adapt-replace').click();const after=await draft();assert.equal(after.items[0].id,before.items[0].id);assert(after.items[0].parent);assert.equal(after.items[0].reviewed,false);
  });
  await check('Ordering, scoring and purpose switch keep the same questions',async()=>{
    const before=await draft();await page.locator('[data-move="1"]').first().click();const after=await draft();assert.equal(after.items[1].id,before.items[0].id);
    await page.locator('[data-score]').first().fill('8');await page.locator('[data-score]').first().press('Tab');assert.equal((await draft()).items[0].points,8);
    await page.locator('#studio-purpose').selectOption('practice');assert.equal(await page.locator('[data-score]').count(),0);assert.equal((await draft()).items.length,before.items.length);
  });
  await check('New draft archives previous work and can reopen it',async()=>{
    const before=await draft();await view('saved');await page.locator('#studio-new').click();await count(0);await view('saved');await page.locator('[data-resume]').first().click();assert.deepEqual((await draft()).items,before.items);
  });
  await check('No-result filtering is recoverable and persists on reload',async()=>{
    await view('bank');await page.locator('#studio-query').fill('没有这个知识点123');await page.locator('#studio-query').press('Enter');assert.equal(await page.locator('.qs-question').count(),0);await page.reload();assert.equal(await page.locator('#studio-query').inputValue(),'没有这个知识点123');await page.locator('#studio-clear').click();assert.equal(await page.locator('.qs-question').count(),8);
  });
  await check('Keyboard opens source dialog and Escape closes it',async()=>{
    await page.locator('[data-studio-dialog="upload"]').focus();await page.keyboard.press('Enter');assert(await page.locator('#modal').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#modal').isHidden());
  });
  await check('Question-list scroll position survives editor round-trip',async()=>{
    await page.locator('#studio-results').evaluate(el=>el.scrollTop=300);const y=await page.locator('#studio-results').evaluate(el=>el.scrollTop);
    await view('edit');await view('bank');assert.equal(await page.locator('#studio-results').evaluate(el=>el.scrollTop),y);
  });
  await check('Reference apply action stays visible in a 768px-high window',async()=>{
    await page.locator('[data-studio-dialog="reference"]').click();await page.locator('#qs-reference-next').click();
    const box=await page.locator('#qs-template-apply').boundingBox();const modal=await page.locator('#modal').boundingBox();
    assert(box.y+box.height<=modal.y+modal.height&&box.y>=modal.y);await shot('12-reference-actions-visible');await close();
  });
  for(const [width,height] of [[1920,1080],[1366,768],[800,768]]){
    await check(`Layout ${width}x${height} shows results and reachable basket action`,async()=>{
      await page.setViewportSize({width,height});await view('bank');await fits();
      const box=await page.locator('.qs-basket-bottom .button').boundingBox();assert(box&&box.y+box.height<=height&&box.x+box.width<=width);
      await shot('10-bank-'+width);await view('edit');await fits();await shot('11-editor-'+width);
    });
  }
  await check('Other main destinations still open, including protected chat composer',async()=>{
    for(const route of ['chat','library','students','settings','teaching']){await page.locator(`[data-route="${route}"]`).click();assert(await page.locator('#content').innerText());}
    await page.locator('[data-route="chat"]').click();assert(await page.locator('#composer').isVisible());
  });
  await check('Blocked storage shows honest warning while preserving in-memory changes',async()=>{
    await page.goto(url+'#page=teaching&tab=组卷');
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError');};});
    await page.locator('#studio-clear').click();assert((await page.locator('.qs-status').innerText()).includes('无法保存'));assert((await draft()).items.length>0);
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.success=true;
}catch(e){report.failure=String(e.stack);await shot('FAILURE');process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
