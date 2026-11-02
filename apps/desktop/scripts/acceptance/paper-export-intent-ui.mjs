/** D1 actual UI operations. Domain writes happen only through visible controls. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {choose,disclosureTrigger,enterPaper} from './paper-basket-ui-driver.mjs';
import {entryCard,visibleUnique} from './paper-basket-ui-locators.mjs';
import {instanceStage,readInstanceBasket,waitInstanceUi} from './paper-instance-ui-driver.mjs';
import {waitInstanceCondition} from './paper-instance-ui-wait.mjs';
import {productEntry} from '../product-navigation.mjs';
import {openPaperHistory} from '../education/paper-ui-disclosure.mjs';
import {assertIntentIdentity,assertOwnOutput,observeDraft,readOutputGrants,until} from './paper-export-intent-evidence.mjs';

export async function readPaper(page,sessionId,paperId) {
  const result=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId,id:paperId});
  assert(result.ok,'Actual authorized paper review must succeed');
  assert.equal(result.value.id,paperId);assert.equal(result.value.sessionId,sessionId);return result.value;
}
export async function openBasket(page,owner,basketId) {
  await enterPaper(page);
  await page.getByTestId('paper-basket-owner-search').fill(owner);
  await choose(page,page.getByTestId('paper-basket-owner'),owner);
  await choose(page,page.getByTestId('paper-basket-saved'),basketId);
  const basket=await readInstanceBasket(page,owner,basketId);
  await waitInstanceUi(page,owner,basketId,{stage:basket.uiState?.stage??'select',revision:basket.revision});return basket;
}
export async function showComposer(page,sessionId) {
  await (await visibleUnique(productEntry(page,'ask'),'Original AI navigation')).click();
  const composer=page.locator('.office-composer-container:visible');
  await until(async()=>await composer.getAttribute('data-session-id')===sessionId,'Exact original composer owner');
  return composer;
}
export async function captureUi({app,page,output,report},name,root) {
  await visibleUnique(root,'D1 screenshot target');
  assert.equal(await root.locator('details,summary').count(),0,'No native disclosure on the exercised export controls');
  for(const [width,height]of [[1366,768],[1920,1080]]) {
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await waitInstanceCondition(page,size=>innerWidth===size.width&&innerHeight===size.height,{width,height},{description:'Actual D1 viewport size'});
    const file=name+'-'+width+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});
    report.screens.push({file,width,height,nativeDisclosures:0});
  }
}
/** Declared native-dialog seam only: exactly one output-directory chooser.
 * No business IPC/API, Pi tool response, authorization DB or provider is mocked. */
export async function outputChoice(app,page,workspace,cancel) {
  await app.evaluate(({dialog},input)=>{
    if(globalThis.__d1OutputChoice)throw new Error('D1 chooser already installed');
    const original=dialog.showOpenDialog,state={original,calls:[]};globalThis.__d1OutputChoice=state;
    dialog.showOpenDialog=async function(...args) {
      const options=args.length>1?args[1]:args[0];
      if(typeof options?.title==='string'&&options.title.includes('试卷保存文件夹')) {
        if(state.calls.length)throw new Error('D1 chooser invoked more than once');
        if(!options.properties?.includes('openDirectory'))throw new Error('Unexpected D1 chooser kind');
        state.calls.push({title:options.title,canceled:input.cancel,directory:input.cancel?undefined:input.workspace});
        dialog.showOpenDialog=original;
        return {canceled:input.cancel,filePaths:input.cancel?[]:[input.workspace]};
      }
      return original.apply(dialog,args);
    };
  },{workspace,cancel});
  try {
    const choose=await visibleUnique(page.getByTestId('paper-output-choose'),'Explicit output-directory control');
    await until(async()=>!await choose.isDisabled(),'Output-directory control ready');await choose.click();
    await until(async()=>await app.evaluate(()=>globalThis.__d1OutputChoice.calls.length===1),'Actual output chooser invocation');
    return await app.evaluate(()=>globalThis.__d1OutputChoice.calls);
  } finally {
    await app.evaluate(({dialog})=>{const state=globalThis.__d1OutputChoice;if(state){dialog.showOpenDialog=state.original;delete globalThis.__d1OutputChoice;}});
  }
}
export async function selectOwnOutput(app,page,read,owner,workspace) {
  const calls=await outputChoice(app,page,workspace,false);
  await until(async()=>!await page.getByTestId('paper-output-choose').isDisabled(),'Explicit directory selection settled');
  await until(()=>{
    const grants=readOutputGrants(read,owner);
    return grants.paperOutputs.length===1&&path.resolve(grants.paperOutputs[0].path)===path.resolve(workspace);
  },'Exact persisted OWN output path before any specification button');
  assertOwnOutput(readOutputGrants(read,owner),workspace);return calls;
}
export function expectedName(paper,spec) {
  return paper.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)+'-'+(spec.template==='answer_sheet'?'answer_sheet':spec.audience)+'.'+spec.format;
}
export async function seededDraft(page,owner,paper,spec,validate) {
  let draft;
  await until(async()=>{
    draft=await observeDraft(page,owner);
    return draft.visible&&!draft.pending&&!!draft.text&&!!draft.paperExportIntent;
  },'Actual UI seed and persisted typed binding');
  assertIntentIdentity(draft.paperExportIntent,paper,spec,validate);
  const binding=await visibleUnique(page.getByTestId('paper-export-draft-binding'),'Actual composer binding notice');
  const label=await binding.innerText();assert(label.includes(spec.format==='docx'?'Word':'PDF'));assert(label.includes(spec.template==='answer_sheet'?'答题卡':spec.audience==='teacher'?'教师答案卷':'学生卷'));
  assert(draft.text.includes('education_export_paper')&&draft.text.includes(spec.format)&&draft.text.includes(expectedName(paper,spec)),'Keep the real UI request; do not replace it with a QA tool command');
  return draft;
}
/** Turn the already existing witness basket into B after the A seed was captured. */
export async function confirmCompetitionB(ctx,fixture,marker) {
  const {page}=ctx,owner=fixture.sessionId,basketId=fixture.otherBasketId;
  let basket=await openBasket(page,owner,basketId);
  await instanceStage(ctx,owner,basketId,'organize');
  const card=entryCard(page,basket.entries[0].entryId);await card.getByTestId('paper-instance-open').click();
  await card.getByTestId('paper-instance-edit-question').click();
  const role=card.getByTestId('paper-instance-role-question');
  if(!await role.getByTestId('paper-instance-text').count())await role.getByTestId('paper-instance-add-text').click();
  const stem=role.getByTestId('paper-instance-text').first();await stem.fill((await stem.inputValue())+'\nD1竞争卷B '+marker);
  const options=role.getByRole('group',{name:/^第 \d+ 块 · 选项$/});
  if(!await options.count())await role.getByTestId('paper-instance-add-options').click();
  assert.equal(await options.count(),1);
  const labels=options.getByTestId('paper-instance-item-label'),texts=options.getByTestId('paper-instance-item-text');
  const count=await labels.count();assert(count>=2&&count<=30);
  for(let index=0;index<count;index++) {
    await labels.nth(index).fill(['戊','己','庚','辛'][index]??('B'+index));
    await texts.nth(index).fill('竞争B选项 '+marker+' '+index);
  }
  for(const name of ['answer','analysis']) {
    const trigger=disclosureTrigger(card.getByTestId('paper-instance-edit-fold-'+name),name==='answer'?'参考答案':'解析');
    if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
    await card.getByTestId('paper-instance-edit-'+name).click();
    const field=card.getByTestId('paper-instance-role-'+name).getByTestId('paper-instance-text');assert.equal(await field.count(),1);
    await field.fill('竞争B'+(name==='answer'?'答案':'解析')+' '+marker);
  }
  await card.getByTestId('paper-instance-save').click();
  await waitInstanceUi(page,owner,basketId,{stage:'organize',revision:basket.revision+1});
  basket=await readInstanceBasket(page,owner,basketId);assert.equal(basket.entries[0].reviewCurrent,false);
  await card.getByTestId('paper-instance-confirm').click();
  await waitInstanceUi(page,owner,basketId,{stage:'organize',revision:basket.revision+1});
  basket=await readInstanceBasket(page,owner,basketId);assert(basket.complete&&basket.entries[0].reviewCurrent);
  await instanceStage(ctx,owner,basketId,'preview');await page.getByTestId('paper-basket-snapshot').click();
  await page.getByTestId('paper-basket-confirm').and(page.locator(':enabled')).waitFor();await page.getByTestId('paper-basket-confirm').click();
  await visibleUnique(page.getByTestId('paper-export-entry'),'Actual confirmed B export');
  const result=await page.evaluate(()=>window.omniEdu.listPapers());assert(result.ok);
  const matches=result.value.filter(p=>p.sessionId===owner&&p.title===basket.title&&p.state==='confirmed');assert.equal(matches.length,1);
  const paper=await readPaper(page,owner,matches[0].id);assert(paper.exportCurrent&&paper.sourceCurrent);
  assert.equal(paper.basket?.basketId,basketId);assert.equal(paper.basket.basketRevision,basket.revision);
  assert.deepEqual(paper.selection.items[0].instance,basket.entries[0].instance);return {paper,basket};
}
export async function showHistoricalA(page,owner,paperId) {
  await page.getByTestId('paper-entry-automatic').click();
  await openPaperHistory(page);
  const row=await visibleUnique(page.locator(`[data-testid="paper-saved"][data-paper-id="${paperId}"]`),'Exact historical A record');await row.click();
  await page.getByTestId('paper-confirmed').waitFor();
  const paper=await readPaper(page,owner,paperId);assert.equal(paper.exportCurrent,false);
  await page.getByTestId('paper-export-older').waitFor();
  assert.equal(await page.getByTestId('paper-export-entry').count(),0,'Historical A must remain blocked, never export B');return paper;
}
