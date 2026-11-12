/** Fresh live-export fixture ONLY through visible production UI. Typed methods
 * below are read-only observations; no SQL/typed API creates confirmations. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {enterPaper,disclosureTrigger} from './paper-basket-ui-driver.mjs';
import {entryCard,visibleUnique} from './paper-basket-ui-locators.mjs';
import {createInstanceBasket,instanceStage,readInstanceBasket,waitInstanceUi} from './paper-instance-ui-driver.mjs';

export function readFreshOfficeSession(dbPath,sessionId) {
  const db=new DatabaseSync(dbPath,{readOnly:true});
  try {
    return {
      session:db.prepare('SELECT id,archived_at,student_id,message_count FROM ai_conversation_sessions WHERE id=?').get(sessionId),
      workspaces:db.prepare('SELECT conversation_id,path,label FROM xiaozhi_pi_workspaces WHERE conversation_id=?').all(sessionId),
      paperOutputs:db.prepare('SELECT conversation_id,path,label FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?').all(sessionId),
      commands:db.prepare('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?').all(sessionId),
      runs:db.prepare('SELECT id,status FROM ai_agent_runs WHERE session_id=?').all(sessionId),
      messageCount:db.prepare('SELECT count(*) AS count FROM ai_conversation_messages WHERE session_id=?').get(sessionId).count,
    };
  } finally {db.close();}
}

export function assertFreshOfficeSession({sessionId,previousSessionId,existingSessionIds,snapshot,persisted}) {
  assert.match(sessionId,/^aisession_[a-f0-9-]{36}$/i);
  assert(Array.isArray(existingSessionIds),'Pre-launch persisted session identities required');
  assert(sessionId!==previousSessionId && !existingSessionIds.includes(sessionId),'Must capture a genuinely NEW UI session');
  assert.equal(snapshot?.projection?.threadId,sessionId,'UI and host snapshot session identities must agree');
  assert.equal(persisted?.session?.id,sessionId,'Fresh UI session must actually exist in SQLite');
  assert(!persisted.session.archived_at && !persisted.session.student_id,'Fresh independent general session required');
  assert.equal(persisted.session.message_count,0,'Fresh session must have no prior message count');
  for(const key of ['workspaces','paperOutputs','commands','runs'])assert.deepEqual(persisted[key],[],'Fresh session must have no persisted '+key);
  assert.equal(persisted.messageCount,0,'Fresh session must have no prior messages');
  assert.equal(snapshot.running,false,'Fresh session must have no running operation');
  assert.deepEqual(snapshot.projection.turns,[],'Fresh session must have no prior turns');
  assert(!snapshot.paperOutput,'Fresh session must have no public output grant');
  // production-host.snapshot exposes this label even when workspace(id) is null.
  // Authorization is proven above using the actual persisted rows, never inferred
  // from the presence of this public display object. Every explicit binding fails.
  if(snapshot.workspace!==undefined)assert.deepEqual(snapshot.workspace,{label:'小智生成文件'},'Only the unbound default workspace display is allowed');
}

export async function prepareFreshOfficePaperUi({page,app,output,data,report,question,marker,check,existingSessionIds,prepareCreatedBasketUi}) {
  assert(question?.id && question.stem && question.answer && question.analysis,'Complete real bank question required');
  assert(!question.document && !question.archive?.native,'This live fixture covers teacher-edited text/options/subquestions/table, not scanned source-role delivery');
  const composer=page.locator('.office-composer-container:visible');
  const old=await composer.getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  assert(Array.isArray(existingSessionIds),'Pre-launch persisted session identities required');
  await page.waitForFunction(({previous,existing})=>{
    const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return Boolean(id && id!==previous && !existing.includes(id));
  },{previous:old,existing:existingSessionIds});
  const owner=await composer.getAttribute('data-session-id');assert.match(owner,/^aisession_[a-f0-9-]{36}$/i);
  const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),owner);
  const persisted=readFreshOfficeSession(path.join(data,'app.db'),owner);
  report.freshSessionObservation={sessionId:owner,previousSessionId:old,existingSessionIds,
    snapshot:{projection:{threadId:snapshot.projection.threadId,turns:snapshot.projection.turns.map(t=>({id:t.id}))},running:snapshot.running,workspace:snapshot.workspace,paperOutput:snapshot.paperOutput},persisted};
  assertFreshOfficeSession({sessionId:owner,previousSessionId:old,existingSessionIds,snapshot,persisted});
  await enterPaper(page);
  const ctx={page,app,output,data,owner,marker,report,check,prepareCreatedBasketUi};
  const witness=await createInstanceBasket(ctx,owner,question,'B Office 对照题篮 '+marker);
  let basket=await createInstanceBasket(ctx,owner,question,'B Office 当前实例 '+marker);
  const basketId=basket.id,entryId=basket.entries[0].entryId;
  await instanceStage(ctx,owner,basketId,'organize');
  await entryCard(page,entryId).getByTestId('paper-instance-open').click();
  const card=page.locator(`[data-testid="paper-instance-dialog"][data-entry-id="${entryId}"]`);
  await card.getByTestId('paper-instance-edit-question').click();
  const role=card.getByTestId('paper-instance-role-question');
  if(!await role.getByTestId('paper-instance-text').count())await role.getByTestId('paper-instance-add-text').click();
  const stemField=role.getByTestId('paper-instance-text').first();
  await stemField.fill((await stemField.inputValue())+'\n本卷题干复核 '+marker);
  // Add a real mixed-order table and following text through their ordinary fields.
  await role.getByTestId('paper-instance-add-table').click();
  const table=role.locator(':scope > fieldset').last();
  for(const [r,c,value] of [[1,1,'对照变量'],[1,2,'本卷取值'],[2,1,'条件甲'],[2,2,'值二']])await table.getByRole('textbox',{name:`第 ${r} 行第 ${c} 列`,exact:true}).fill(value);
  await role.getByTestId('paper-instance-add-text').click();
  await role.getByTestId('paper-instance-text').last().fill('表后内容复核 '+marker);
  const optionBlocks=role.getByRole('group',{name:/^第 \d+ 块 · 选项$/});
  if(!await optionBlocks.count())await role.getByTestId('paper-instance-add-options').click();
  assert.equal(await optionBlocks.count(),1,'One explicit option group in this controlled live fixture');
  const labels=optionBlocks.getByTestId('paper-instance-item-label'),values=optionBlocks.getByTestId('paper-instance-item-text');
  const count=await labels.count();assert(count>=2 && count<=30);
  const currentLabels=[];
  for(let n=0;n<count;n++){
    const label=['甲','乙','丙','丁','戊','己'][n]??('项'+(n+1));currentLabels.push(label);
    await labels.nth(n).fill(label);await values.nth(n).fill('本卷选项 '+label+' '+marker);
  }
  await role.getByTestId('paper-instance-add-subquestions').click();
  const subquestion=role.locator(':scope > fieldset').last();
  await subquestion.getByTestId('paper-instance-item-text').fill('说明本卷判断依据 '+marker);
  for(const name of ['answer','analysis']) {
    const fold=card.getByTestId('paper-instance-edit-fold-'+name),trigger=disclosureTrigger(fold,name==='answer'?'参考答案':'解析');
    if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
    await card.getByTestId('paper-instance-edit-'+name).click();
    const text=card.getByTestId('paper-instance-role-'+name).getByTestId('paper-instance-text');
    assert.equal(await text.count(),1,'Plain source reference role');
    await text.fill(name==='answer'?'教师答案复核 '+marker+'：当前选项 '+currentLabels[1]:'教师解析复核 '+marker+'：核对当前题面、选项、小问和表格。');
  }
  await card.screenshot({path:path.join(output,'fresh-instance-edit-form.png'),animations:'disabled'});
  const before=basket.revision;
  await card.getByTestId('paper-instance-save').click();
  await waitInstanceUi(page,owner,basketId,{stage:'organize',revision:before+1});
  basket=await readInstanceBasket(page,owner,basketId);
  assert.equal(basket.entries[0].instance.content.question.mode,'edited');
  assert.equal(basket.entries[0].reviewCurrent,false);
  assert.equal(basket.entries[0].deliveryBlock,'needs_review');
  const savedRevision=basket.revision;
  await card.getByTestId('paper-instance-confirm').click();
  await waitInstanceUi(page,owner,basketId,{stage:'organize',revision:savedRevision+1});
  basket=await readInstanceBasket(page,owner,basketId);assert(basket.complete && basket.entries[0].reviewCurrent);
  check('Fresh real UI session creates two baskets; current instance saves stem/options/subquestion/table/teacher references and exact-revision review');
  await instanceStage(ctx,owner,basketId,'preview');
  await page.getByTestId('paper-basket-snapshot').click();
  await page.getByTestId('paper-basket-confirm').and(page.locator(':enabled')).waitFor();
  await page.getByTestId('paper-basket-confirm').click();
  await visibleUnique(page.getByTestId('paper-export-entry'),'Fresh UI-confirmed current snapshot export');
  const papers=await page.evaluate(()=>window.omniEdu.listPapers());assert(papers.ok);
  const matches=papers.value.filter(p=>p.sessionId===owner && p.title===basket.title && p.state==='confirmed');assert.equal(matches.length,1);
  const result=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner,id:matches[0].id});assert(result.ok);
  const paper=result.value;assert.equal(paper.basket.basketId,basketId);
  assert.deepEqual(paper.selection.items[0].instance,basket.entries[0].instance);
  await page.getByTestId('paper-export-entry').screenshot({path:path.join(output,'fresh-confirmed-six-export-choices.png'),animations:'disabled'});
  check('Only original snapshot and confirm buttons create the new exact instance paper; old stale paper is never reused');
  return {sessionId:owner,basketId,otherBasketId:witness.id,paperId:paper.id,digest:paper.digest,entryId,questionId:question.id,currentLabels};
}
