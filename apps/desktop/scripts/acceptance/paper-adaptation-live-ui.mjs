/** Inert A27 live journey. Import/--check never launches, sends, copies data or
 * writes business state. Parent owns the ONE launch and explicit live opt-in.
 * All business writes below are visible UI actions. SQLite/public APIs observe.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {enterPaper,choose,disclosureTrigger} from './paper-basket-ui-driver.mjs';
import {entryCard,selectTrigger,visibleUnique} from './paper-basket-ui-locators.mjs';
import {readInstanceBasket,findInstanceCandidate,waitInstanceUi} from './paper-instance-ui-driver.mjs';
import {readAdaptationObservation} from './paper-adaptation-continuation.mjs';

export const paperAdaptationLiveContract=Object.freeze({
  budgets:{modelSubmissions:1,parentLaunches:1,retries:0},helperLaunches:0,
  required:['page','app','data','output','report','question','live:true','reviewCandidate'],
  entry:'runPaperAdaptationLiveUi(options)',
  writes:'UI only; no API mutation, SQL mutation, prompt replacement, resend or repair loop',
  reviewCandidate:'async ({draft,quality,original,requirements,runId,candidateId}) => true only after teacher/QA review; read-only gate before UI confirmation',
  wrongCandidateBoundary:'UI excludes non-bound candidates; forged host accept is covered by focused tests, never attempted via write API here',
});
const schema='xiaozhi.paper-basket-adaptation.v1';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pinned=e=>({entryId:e.entryId,questionId:e.questionId,contentVersion:e.contentVersion,
  sectionId:e.sectionId,position:e.position,instance:e.instance,question:e.question,generation:e.generation});
const points=(b,e)=>b.c2?.entryPoints[e.entryId]??b.blueprint.sections.find(s=>s.id===e.sectionId)?.points;

/** app is an ALREADY launched Playwright ElectronApplication. No launcher seam.
 * question is a real read-only original-bank DTO from the parent's D1 copy.
 * Requires one other matching bank question (observed through notebook) as witness.
 */
export async function runPaperAdaptationLiveUi({page,app,data,output,report,question,
  live=false,reviewCandidate,teacherEdit,timeoutMs=240000,requirements,marker='A27-'+Date.now()}) {
  assert.equal(live,true,'Explicit parent live opt-in required');
  assert(page&&app&&typeof app.evaluate==='function','Parent supplies its single already running Electron app/page');
  assert(question?.id&&question.stem&&question.answer&&question.subject&&question.grade&&question.questionType);
  assert.equal(typeof reviewCandidate,'function','Supply explicit read-only teacher/QA candidate review gate');
  assert(!report.paperAdaptation,'This report cannot execute A27 twice; zero retries');
  assert(fs.statSync(path.join(data,'app.db')).isFile(),'Use the launched D1 copy, not source database');
  assert(fs.statSync(output).isDirectory(),'Parent supplies its owned evidence output directory');
  const evidence=report.paperAdaptation={success:false,marker,modelSubmissions:0,helperLaunches:0,retries:0,
    budget:paperAdaptationLiveContract.budgets,checks:[],phase:'preflight'};
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  const sql=(query,args=[])=>db.prepare(query).all(...args);
  const until=async(predicate,label)=>{const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,250));}throw Error('A27 timeout: '+label);};
  const click=async locator=>{await visibleUnique(locator,'A27 exact action');await locator.click({timeout:30000});};
  const expand=async(root,title)=>{const trigger=disclosureTrigger(root,title);await visibleUnique(trigger,'Official disclosure');if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();};
  const check=name=>evidence.checks.push({name,pass:true});
  let owner,basketId;
  try {
    const originalRows=sql('SELECT * FROM question_bank_items ORDER BY id');
    assert(originalRows.some(q=>q.id===question.id),'Known original must actually exist in this launched copy');
    const originalHashes=new Map(originalRows.map(row=>[row.id,hash(row)]));
    const oldSessions=sql('SELECT id FROM ai_conversation_sessions').map(row=>row.id);
    const oldCandidateIds=sql("SELECT id FROM ai_confirmation_items WHERE action_type='pi_question_candidate'").map(row=>row.id);
    const composer=page.locator('.office-composer-container:visible');
    assert.equal(await composer.count(),1,'Parent must enter original Pi UI with a clean composer before calling');
    const previousOwner=await composer.getAttribute('data-session-id');
    const previousDraft=await composer.getByTestId('office-prompt-input').inputValue();
    await click(page.getByTestId('pi-new-session'));
    await until(async()=>{const id=await composer.getAttribute('data-session-id');return id&&!oldSessions.includes(id);},'fresh UI session');
    owner=await composer.getAttribute('data-session-id');evidence.sessionId=owner;
    assert.equal(await composer.getByTestId('office-prompt-input').inputValue(),'','The new session must have its own empty draft');
    if(previousDraft){
      const retained=await page.evaluate(id=>JSON.parse(localStorage.getItem('xiaozhi.composer-draft.v1:'+id)||'null')?.text,previousOwner);
      assert.equal(retained,previousDraft,'Starting a new session must preserve the existing unsent draft');
    }
    assert.equal(sql('SELECT id FROM ai_agent_runs WHERE session_id=?',[owner]).length,0);
    const session=sql('SELECT student_id FROM ai_conversation_sessions WHERE id=?',[owner])[0];assert(session);const studentId=String(session.student_id||'');
    await enterPaper(page);
    await page.getByTestId('paper-basket-owner-search').fill(owner);
    await choose(page,page.getByTestId('paper-basket-owner'),owner);
    const workspace=page.getByTestId('paper-basket-workspace');const priorBasket=await workspace.getAttribute('data-basket-id');
    await click(page.getByTestId('paper-basket-new'));
    if(await page.getByTestId('paper-basket-new-choice').isVisible())await click(page.getByTestId('paper-basket-keep-new'));
    await until(async()=>{const id=await workspace.getAttribute('data-basket-id');return id&&id!==priorBasket;},'new basket');
    basketId=await workspace.getAttribute('data-basket-id');evidence.basketId=basketId;
    let b=await readInstanceBasket(page,owner,basketId);
    if((b.purpose??'paper')!=='practice'){
      await choose(page,page.getByTestId('paper-basket-purpose'),'practice');
      await until(async()=>(await readInstanceBasket(page,owner,basketId)).purpose==='practice','practice purpose save');
    }
    await expand(page.getByTestId('paper-basket-blueprint-fold'),'蓝图与来源策略');
    const editor=page.getByTestId('paper-basket-blueprint-fold').getByTestId('paper-basket-blueprint');
    await visibleUnique(editor,'The saved basket blueprint, not the separate requirements proposal');
    await editor.getByTestId('paper-basket-title').fill('真实指定题改编 '+marker);
    await editor.getByTestId('paper-basket-subject').fill(question.subject);
    await editor.getByTestId('paper-basket-grade').fill(question.grade);
    const sections=editor.getByTestId('paper-basket-section-editor');
    while(await sections.count()>1)await click(sections.last().getByRole('button',{name:'移除此分节',exact:true}));
    await editor.getByTestId('paper-basket-section-type').fill(question.questionType);
    await editor.getByTestId('paper-basket-section-count').fill('3');
    await editor.getByTestId('paper-basket-section-points').fill('5');
    await choose(page,editor.getByTestId('paper-basket-mode'),'hybrid');
    assert.equal(await sections.count(),1,'Exactly one section remains after explicit UI removals');
    await sections.getByLabel('其中生成题数',{exact:true}).fill('1');
    b=await readInstanceBasket(page,owner,basketId);await click(editor.getByTestId('paper-basket-save-blueprint'));
    await waitInstanceUi(page,owner,basketId,{stage:'select',revision:b.revision+1});
    b=await readInstanceBasket(page,owner,basketId);assert.equal(b.purpose,'practice');assert.equal(b.blueprint.mode,'hybrid');assert.equal(b.blueprint.sections[0].generatedCount,1);
    const notebook=await page.evaluate(filters=>window.omniEdu.listQuestionNotebook(filters),{subject:question.subject,grade:question.grade,questionType:question.questionType,offset:0,limit:50});
    const witness=notebook.items.find(q=>q.id!==question.id&&originalHashes.has(q.id)&&q.stem&&q.answer);
    assert(witness,'Need another actual matching D1 bank question to prove unchosen-entry preservation');
    for(const q of [question,witness]){
      const row=await findInstanceCandidate(page,report,owner,basketId,q);
      b=await readInstanceBasket(page,owner,basketId);
      await choose(page,selectTrigger(row,'加入分节'),b.blueprint.sections[0].id);
      await click(row.getByTestId('paper-basket-add'));
      await waitInstanceUi(page,owner,basketId,{stage:'select',revision:b.revision+1});
    }
    await click(page.getByTestId('paper-basket-stage-organize'));await waitInstanceUi(page,owner,basketId,{stage:'organize'});
    const before=await readInstanceBasket(page,owner,basketId),target=before.entries.find(e=>e.questionId===question.id),unchosen=before.entries.find(e=>e.questionId===witness.id);
    assert(target&&unchosen&&before.entries.length===2);evidence.before={revision:before.revision,target:pinned(target),targetPoints:points(before,target),unchosen:pinned(unchosen)};
    await click(entryCard(page,target.entryId).getByTestId('paper-basket-adapt'));
    const panel=page.getByTestId('paper-entry-adaptation');await expand(panel,'指定此题改编');
    const exactRequirements=requirements??'保持数学初二原题知识点，改换具体数值或情境，生成一道四选一选择题；保留原题型和难度，给出A/B/C/D选项、唯一答案字母及完整解析，不照抄原题。';
    await panel.getByTestId('paper-adaptation-requirements').fill(exactRequirements);
    await choose(page,panel.getByTestId('paper-adaptation-intent'),'replace');
    await click(panel.getByTestId('paper-adaptation-prepare'));
    const listInput={schemaVersion:schema,sessionId:owner,studentId,basketId,entryId:target.entryId};
    let prepared;
    await until(async()=>{const r=await page.evaluate(i=>window.omniEdu.listPaperBasketAdaptations(i),listInput);prepared=r.ok&&r.value.find(v=>v.status==='prepared'&&v.input.requirements===exactRequirements);return !!prepared;},'persisted exact intent');
    const reference={schemaVersion:schema,sessionId:owner,studentId,basketId,intentId:prepared.intentId};
    const readIntent=()=>readAdaptationObservation(page,reference,()=>{evidence.busyReadObservations=(evidence.busyReadObservations||0)+1;});
    evidence.intentId=prepared.intentId;
    assert.equal(prepared.current,true,'Exact current source and instance must be verified before the single paid submission');
    assert.equal(prepared.input.expectedBasketRevision,before.revision);assert.equal(prepared.input.instanceRevision,target.instance.instanceRevision);assert.equal(prepared.input.parentQuestionId,target.questionId);assert.equal(prepared.input.parentSourceVersion,target.contentVersion);assert.equal(prepared.input.intent,'replace');assert.equal(prepared.generationStarted,false);assert.deepEqual(prepared.candidates,[]);
    check('UI frozen exact source, instance, revision, requirements and replace intent');
    await click(panel.getByTestId('paper-adaptation-send'));
    await until(async()=>await composer.count()===1&&await composer.getAttribute('data-session-id')===owner,'original composer navigation');
    const input=composer.getByTestId('office-prompt-input');assert.equal(await input.inputValue(),prepared.prompt,'Seed must survive original composer intact; never fill/replace it');
    assert.equal(sql('SELECT id FROM ai_agent_runs WHERE session_id=?',[owner]).length,0,'Loading is not admission');
    evidence.phase='single-model-submission';evidence.modelSubmissions++;assert.equal(evidence.modelSubmissions,1);
    await click(composer.getByRole('button',{name:'发送消息',exact:true})); // ONE attempt; never resend on timeout.
    let record,runId;
    await until(async()=>{const row=sql('SELECT adaptation_json FROM paper_basket_operations WHERE session_id=? AND request_id=?',[owner,prepared.intentId])[0];record=row&&JSON.parse(row.adaptation_json);return !!record?.runId;},'actual Pi admission-bound runId');
    runId=record.runId;evidence.runId=runId;
    const run=sql('SELECT id,prompt,route,sub_intent,status FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,owner])[0];assert(run);assert.equal(run.prompt,prepared.prompt);assert.equal(run.route,'knowledge_retrieval');assert.equal(run.sub_intent,'pi_education');
    let current;
    // The real propose tool deliberately stays pending until teacher decide.
    // Requiring a succeeded run here would prevent the review that completes it.
    await until(async()=>{
      current=await readIntent();const runs=sql('SELECT id,status FROM ai_agent_runs WHERE session_id=?',[owner]);
      assert.equal(runs.length,1,'One model submission; no repeated run');assert.equal(runs[0].id,runId);
      if(['failed','cancelled','interrupted','blocked'].includes(runs[0].status))throw Error('Real Pi run terminated '+runs[0].status);
      if(!current)return false;
      const pending=current.candidates.some(c=>c.state==='pending'&&!c.supersededBy);
      if(runs[0].status==='succeeded'&&!pending)throw Error('Real Pi run ended without a reviewable designated candidate');
      if(pending)assert.equal(runs[0].status,'running','Teacher review must belong to the live bound run');
      return pending;
    },'real bound Pi proposal awaiting teacher review');
    const candidates=current.candidates.filter(c=>c.state==='pending'&&!c.supersededBy);assert.equal(candidates.length,1,'No ambiguous candidate auto-selection');const candidate=candidates[0];
    assert.equal(candidate.runId,runId);assert.equal(candidate.count,1);assert.equal(candidate.variation.parents.length,1);assert.equal(candidate.variation.parents[0].question.questionId,target.questionId);assert.equal(candidate.variation.parents[0].question.version,target.contentVersion);
    for(const c of current.candidates)assert.equal(c.runId,runId,'Host view never returns same-prompt wrong-run candidates');
    evidence.wrongCandidate={oldCandidateIds,visibleIds:current.candidates.map(c=>c.id),uiExclusion:true,forgedHostAcceptAttempted:false,boundary:paperAdaptationLiveContract.wrongCandidateBoundary};
    for(const id of oldCandidateIds)assert(!current.candidates.some(c=>c.id===id));
    const review=page.getByTestId('pi-question-review').and(page.locator(`[data-review-id="${candidate.id}"]`));await visibleUnique(review,'Exact actual Pi review card');
    const confirm=review.getByTestId('question-review-confirm');
    if(!await confirm.isVisible())await click(review.locator(':scope > [data-slot="disclosure-heading"] > [data-slot="chat-tool-trigger"]'));
    await expand(review.getByTestId('question-variation-comparison'),'逐题变式与父题版本对照');
    await page.screenshot({path:path.join(output,'paper-adaptation-before-edit.png'),fullPage:true});
    let reviewDraft=candidate.draft;
    if(teacherEdit) {
      reviewDraft=await teacherEdit({draft:candidate.draft,original:question,requirements:exactRequirements,runId,candidateId:candidate.id});
      const originalAnalysis=candidate.draft.items[0].analysis;
      const expected=structuredClone(candidate.draft);expected.items[0].analysis=reviewDraft.items[0].analysis;
      assert.deepEqual(reviewDraft,expected,'Only the explicitly reviewed single analysis may be edited in this journey');
      if(reviewDraft.items[0].analysis!==originalAnalysis) {
        const editor=review.getByTestId('question-review-analysis');await visibleUnique(editor,'Exact real analysis editor');
        await editor.fill(reviewDraft.items[0].analysis);assert.equal(await editor.inputValue(),reviewDraft.items[0].analysis);
        evidence.teacherEdit={field:'analysis',before:originalAnalysis,after:reviewDraft.items[0].analysis,via:'original visible UI'};
      }
    }
    await click(review.getByTestId('question-quality-check'));
    let reviewed;
    await until(async()=>{const row=sql('SELECT result_json FROM ai_confirmation_items WHERE id=? AND session_id=?',[candidate.id,owner])[0];const history=row&&JSON.parse(row.result_json).qualityHistory;reviewed=history?.findLast(h=>JSON.stringify(h.draft)===JSON.stringify(reviewDraft));return !!reviewed?.quality;},'UI-persisted current quality history (SQLite observation only)');
    assert.notEqual(reviewed.quality.state,'blocked','Blocked proposal fails the single-shot batch; no edits/model retry');
    await page.screenshot({path:path.join(output,'paper-adaptation-real-comparison.png'),fullPage:true});
    assert.equal(await reviewCandidate({draft:reviewed.draft,quality:reviewed.quality,original:question,requirements:exactRequirements,runId,candidateId:candidate.id}),true,'Explicit read-only teacher/QA review gate');
    const currentUiDraft=structuredClone(reviewed.draft);
    for(const field of ['title','subject','grade','knowledgePoint','reason'])currentUiDraft[field]=await review.getByTestId('question-review-'+field).inputValue();
    assert.equal(currentUiDraft.items.length,1);
    for(const field of ['stem','answer','analysis','difficulty'])currentUiDraft.items[0][field]=await review.getByTestId('question-review-'+field).inputValue();
    if(currentUiDraft.items[0].questionType==='choice')for(const key of ['A','B','C','D'])currentUiDraft.items[0].options[key]=await review.getByTestId('question-review-option-'+key).inputValue();
    assert.deepEqual(currentUiDraft,reviewed.draft,'No local edit may race the externally approved version');
    const readReview=async()=>{const r=await page.evaluate(i=>window.omniEdu.reviewXiaozhiQuestions(i),{schemaVersion:'xiaozhi.education.question-review.v1',sessionId:owner,id:candidate.id});assert(r.ok,'Read exact original review');return r.value;};
    const approvalView=await readReview();assert.deepEqual(approvalView.draft,reviewed.draft);
    assert.equal(approvalView.quality?.revisionHash,reviewed.quality.revisionHash,'Final approve must refer to the exact checked revision');
    if(reviewed.quality.state==='manual_review'){
      const acknowledgement=review.getByTestId('question-quality-reviewed');await visibleUnique(acknowledgement,'Exact reviewed-version acknowledgement');
      const checkbox=acknowledgement.getByRole('checkbox');await visibleUnique(checkbox,'Unique real quality acknowledgement input');
      assert.equal(await checkbox.evaluate(node=>node.tagName==='INPUT'&&node.type==='checkbox'),true,'Keep the actual native checkbox');
      assert.equal(await checkbox.isEnabled(),true,'Quality acknowledgement must be enabled');
      // Official Content/Control owns pointer interaction; the clipped input can be covered by its indicator.
      const content=await visibleUnique(acknowledgement.locator('[data-slot="checkbox-content"]'),'Official acknowledgement Content');
      const control=await visibleUnique(content.locator('[data-slot="checkbox-control"]'),'Official visible acknowledgement Control');
      if(!await checkbox.isChecked())await click(control);
      await until(async()=>await checkbox.isChecked(),'Visible Control checks the actual quality acknowledgement');
      assert.equal(await checkbox.isChecked(),true,'Externally reviewed revision must be explicitly acknowledged before approval');
    }
    await click(confirm);
    await until(async()=>{const r=await readIntent();return !!r&&r.candidates.some(c=>c.id===candidate.id&&c.state==='confirmed'&&c.effectDigest);},'original Pi UI confirmation saved');
    const savedReview=await readReview();assert.equal(savedReview.state,'confirmed');
    assert.deepEqual(savedReview.draft,reviewed.draft,'Only the externally approved and checked draft may be saved');
    await until(async()=>{
      const runs=sql('SELECT id,status FROM ai_agent_runs WHERE session_id=?',[owner]);assert.equal(runs.length,1);assert.equal(runs[0].id,runId);
      if(['failed','cancelled','interrupted','blocked'].includes(runs[0].status))throw Error('Real Pi run terminated after review: '+runs[0].status);
      return runs[0].status==='succeeded'&&!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id).then(v=>v.running),owner));
    },'single real run succeeded after actual teacher confirmation');
    assert.deepEqual((await readInstanceBasket(page,owner,basketId)).entries.map(pinned),before.entries.map(pinned),'Saving candidate alone must not change basket');
    await enterPaper(page);await page.getByTestId('paper-basket-owner-search').fill(owner);await choose(page,page.getByTestId('paper-basket-owner'),owner);
    await choose(page,page.getByTestId('paper-basket-saved'),basketId);
    await click(page.getByTestId('paper-basket-stage-organize'));await waitInstanceUi(page,owner,basketId,{stage:'organize'});
    await click(entryCard(page,target.entryId).getByTestId('paper-basket-adapt'));await expand(panel,'指定此题改编');await click(panel.getByTestId('paper-adaptation-read'));
    const chosen=panel.getByTestId('paper-adaptation-candidate').and(page.locator(`[data-candidate-id="${candidate.id}"]`));await visibleUnique(chosen,'Only the exact bound saved candidate');
    for(const id of oldCandidateIds)assert.equal(await panel.locator(`[data-candidate-id="${id}"]`).count(),0);
    await click(chosen.getByTestId('paper-adaptation-accept'));
    let accepted;await until(async()=>{accepted=await readIntent();return !!accepted&&accepted.status==='accepted'&&!!accepted.receipt;},'explicit UI replacement receipt');
    const after=await readInstanceBasket(page,owner,basketId),changed=after.entries.find(e=>e.entryId===target.entryId);
    assert(changed);assert.equal(after.entries.length,before.entries.length);assert.equal(after.revision,before.revision+1);assert.equal(changed.position,target.position);assert.equal(changed.sectionId,target.sectionId);assert.equal(points(after,changed),points(before,target));assert.notEqual(changed.questionId,target.questionId);assert.equal(changed.questionId,accepted.receipt.questionId);assert.equal(changed.contentVersion,accepted.receipt.sourceVersion);
    assert.deepEqual(pinned(after.entries.find(e=>e.entryId===unchosen.entryId)),pinned(unchosen),'Unchosen basket entry must remain exact');
    const finalRecord=JSON.parse(sql('SELECT adaptation_json FROM paper_basket_operations WHERE session_id=? AND request_id=?',[owner,prepared.intentId])[0].adaptation_json);
    assert.equal(finalRecord.runId,runId);assert.equal(finalRecord.input.requirements,exactRequirements);assert.equal(finalRecord.input.parentSourceVersion,target.contentVersion);assert.equal(finalRecord.receipt.candidateId,candidate.id);
    const commits=sql("SELECT adaptation_json FROM paper_basket_operations WHERE session_id=? AND basket_id=? AND operation_kind='domain:adaptation-accept'",[owner,basketId]);assert.equal(commits.length,1);assert.equal(JSON.parse(commits[0].adaptation_json).candidateId,candidate.id);
    const now=new Map(sql('SELECT * FROM question_bank_items ORDER BY id').map(row=>[row.id,hash(row)]));for(const [id,digest]of originalHashes)assert.equal(now.get(id),digest,'Every pre-existing bank question remains unchanged');
    assert.equal(sql('SELECT id FROM ai_agent_runs WHERE session_id=?',[owner]).length,1);
    evidence.after={revision:after.revision,target:pinned(changed),targetPoints:points(after,changed),unchosen:pinned(unchosen),receipt:accepted.receipt,record:finalRecord};
    check('Single admitted exact run -> real Pi proposal -> original review UI confirmation -> explicit UI replace');check('Exact source/requirements/run ledger, stable position/points, unchosen entries and original bank unchanged');
    await page.screenshot({path:path.join(output,'paper-adaptation-final.png'),fullPage:true});
    evidence.phase='complete';evidence.success=true;return evidence;
  }catch(error){evidence.error=String(error?.stack||error);try{await page.screenshot({path:path.join(output,'paper-adaptation-failure.png'),fullPage:true});}catch{}throw error;
  }finally{db.close();fs.writeFileSync(path.join(output,'paper-adaptation-live-report.json'),JSON.stringify(evidence,null,2));}
}
