import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

export const COMPOSER_ATTACHMENT_ANSWER='确认收到附件即可，不调用其他工具、不写文件。';
const activeGate=item=>['pending','approved','executing'].includes(item.state);
const unanswered=state=>(state.controls??[]).filter(item=>item.kind==='question'&&item.state==='pending');

/** The one declared live clarification, never a recovered/new-run question. */
export function composerAttachmentQuestion(state,run,permit,count){
  if((state.approvals??[]).some(activeGate)||(state.changes??[]).some(activeGate))throw Error('UNEXPECTED_EXTERNAL_GATE');
  const questions=unanswered(state);
  if(!questions.length)return null;
  if(!permit||permit.phase!=='ATTACHMENT_ONLY'||count!==2||questions.length!==1)throw Error('UNEXPECTED_EXTERNAL_GATE');
  const question=questions[0],turn=state.projection.turns.at(-1);
  if(state.projection.threadId!==permit.sessionId||state.projection.turns.length!==count||!state.running||
    !turn||turn.id!==permit.runId||!['running','waiting_input'].includes(turn.status)||
    !run||run.id!==permit.runId||run.session_id!==permit.sessionId||run.status!=='running'||question.runId!==permit.runId)
    throw Error('ATTACHMENT_QUESTION_NOT_BOUND');
  if(!/^pictrl_[a-f0-9-]{36}$/i.test(question.id)||typeof question.callId!=='string'||!question.callId||question.canResume||question.answer!==undefined||
    typeof question.text!=='string'||!question.text.trim()||question.text.length>1000||!Array.isArray(question.options)||
    question.options.length<2||question.options.length>3||question.options.some(option=>typeof option!=='string'||!option.trim()||option.length>200)||new Set(question.options).size!==question.options.length)
    throw Error('ATTACHMENT_QUESTION_INVALID');
  if(permit.question&&JSON.stringify(question)!==JSON.stringify(permit.question))throw Error('ATTACHMENT_QUESTION_CHANGED');
  if((state.controls??[]).some(item=>item.kind==='question'&&item.runId===permit.runId&&item.id!==question.id))throw Error('ATTACHMENT_QUESTION_REPEATED');
  return question;
}

/** True only after both persisted and public terminal contracts agree. */
export function composerSendTerminal(state,run,sessionId,count){
  if(state.projection.turns.length>count)throw Error('DUPLICATE_PROJECTED_TURN');
  const turn=state.projection.turns.at(-1);
  if(!turn||state.projection.turns.length<count)return false;
  if(!run||run.id!==turn.id||run.session_id!==sessionId)throw Error('RUN_NOT_BOUND');
  if(['failed','interrupted'].includes(turn.status)||['failed','blocked','cancelled'].includes(run.status))throw Error('SEND_NOT_SUCCEEDED');
  return !state.running&&turn.status==='completed'&&run.status==='succeeded'&&!unanswered(state).length&&
    !(state.approvals??[]).some(activeGate)&&!(state.changes??[]).some(activeGate);
}

/** No write IPC: original visible Composer/picker and one scoped question reply only. */
export async function composerSendJourney({getPage,output,fixture,report,check,until,query,nativeBytes,hash,snapshot,setScenario,stopping,cold,provider,ledger,random}){
  let page=getPage();
  const composer=()=>page.locator('.office-composer-container:visible');
  const input=()=>composer().getByTestId('office-prompt-input');
  const send=()=>composer().getByRole('button',{name:'发送消息',exact:true});
  const session=()=>composer().getAttribute('data-session-id');
  const demand=(condition,code)=>{if(!condition)throw Error(code);};
  const shot=code=>composer().screenshot({path:path.join(output,code+'.png'),animations:'disabled'});
  const body=turn=>turn.items.filter(item=>item.role==='assistant'&&item.text?.trim()).map(item=>item.text).join('\n');
  const readRun=id=>query('SELECT id,session_id,status,prompt FROM ai_agent_runs WHERE id=?',[id]);
  const readQuestion=id=>query('SELECT id,conversation_id,run_id,kind,state,payload_json FROM xiaozhi_pi_controls WHERE id=?',[id]);
  const questionIdentity=item=>JSON.stringify({id:item.id,runId:item.runId,kind:item.kind,text:item.text,options:item.options,callId:item.callId});
  async function validateQuestion(permit,count){
    demand(await session()===permit.sessionId,'ATTACHMENT_QUESTION_NOT_BOUND');
    const state=await snapshot(permit.sessionId),runs=readRun(permit.runId);
    demand(runs.length===1,'RUN_NOT_BOUND');
    const question=composerAttachmentQuestion(state,runs[0],permit,count);
    demand(question&&questionIdentity(question)===questionIdentity(permit.question),'ATTACHMENT_QUESTION_CHANGED');
    const saved=readQuestion(question.id);demand(saved.length===1,'ATTACHMENT_QUESTION_NOT_BOUND');
    const row=saved[0],payload=JSON.parse(row.payload_json);
    demand(row.conversation_id===permit.sessionId&&row.run_id===permit.runId&&row.kind==='question'&&row.state==='pending'&&
      payload.sessionId===permit.sessionId&&payload.state==='pending'&&!payload.canResume&&questionIdentity(payload)===questionIdentity(question),'ATTACHMENT_QUESTION_NOT_BOUND');
    demand(provider().phase==='ATTACHMENT_ONLY'&&!provider().fatal&&provider().wire<8,'REQUEST_BUDGET_EXHAUSTED');
  }
  async function answerQuestion(permit,count){
    demand(!permit.submitted,'ATTACHMENT_QUESTION_REPEATED');
    const card=page.locator(`[data-turn-id="${permit.runId}"]`).locator(`[data-testid="pi-teacher-question"][data-control-id="${permit.question.id}"][data-state="pending"]`);
    await until(async()=>await card.count()===1&&await card.isVisible(),'ATTACHMENT_QUESTION_UI_MISSING',15000);
    const answer=card.getByTestId('pi-question-answer'),submit=card.getByTestId('pi-question-submit');
    demand(await answer.count()===1&&await answer.isVisible()&&await answer.isEnabled(),'ATTACHMENT_QUESTION_UI_MISSING');
    demand(await submit.count()===1&&await submit.isVisible(),'ATTACHMENT_QUESTION_UI_MISSING');
    demand(await card.locator('.pi-question-text').innerText()===permit.question.text,'ATTACHMENT_QUESTION_CHANGED');
    demand(await card.locator('[data-testid^="pi-question-option-"]').count()===permit.question.options.length,'ATTACHMENT_QUESTION_CHANGED');
    await validateQuestion(permit,count);
    await answer.fill(COMPOSER_ATTACHMENT_ANSWER);
    demand(await answer.inputValue()===COMPOSER_ATTACHMENT_ANSWER&&await submit.isEnabled(),'ATTACHMENT_QUESTION_UI_MISSING');
    await validateQuestion(permit,count);
    // Latch before the single real click. A failed click/submission is never retried.
    permit.submitted=true;await submit.click();
    report.attachmentQuestion={code:'QUESTION_REPLY_SUBMITTED',phase:'ATTACHMENT_ONLY',runHash:hash(permit.runId),controlHash:hash(permit.question.id),
      questionHash:hash(questionIdentity(permit.question)),answerHash:hash(COMPOSER_ATTACHMENT_ANSWER),attempts:1};
  }
  const bound=async(id,count,permit)=>{
    const state=await snapshot(id);
    demand(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count()===0,'PRIVATE_REASONING_UI_PRESENT');
    demand(await page.locator('[data-testid="pi-tool-timing"],.office-step-duration').count()===0,'TOOL_TIMING_UI_PRESENT');
    demand(state.projection.turns.length<=count,'DUPLICATE_PROJECTED_TURN');
    const turn=state.projection.turns.at(-1);
    if(permit&&state.projection.turns.length===count){
      demand(state.projection.threadId===id,'ATTACHMENT_QUESTION_NOT_BOUND');
      permit.runId??=turn.id;demand(turn.id===permit.runId,'ATTACHMENT_QUESTION_NOT_BOUND');
    }
    const question=composerAttachmentQuestion(state,turn?readRun(turn.id)[0]:undefined,permit,count);
    if(question&&!permit.submitted){permit.question=structuredClone(question);await answerQuestion(permit,count);}
    if(permit?.submitted&&!question){
      const answers=(state.controls??[]).filter(item=>item.id===permit.question.id);
      demand(answers.length===1&&answers[0].runId===permit.runId&&answers[0].state==='answered'&&!answers[0].canResume&&
        answers[0].answer===COMPOSER_ATTACHMENT_ANSWER&&questionIdentity(answers[0])===questionIdentity(permit.question),'ATTACHMENT_QUESTION_NOT_ANSWERED');
      demand(!(state.controls??[]).some(item=>item.kind==='question'&&item.runId===permit.runId&&item.id!==permit.question.id),'ATTACHMENT_QUESTION_REPEATED');
      const saved=readQuestion(permit.question.id);demand(saved.length===1,'ATTACHMENT_QUESTION_NOT_BOUND');
      const row=saved[0],payload=JSON.parse(row.payload_json);
      demand(row.conversation_id===id&&row.run_id===permit.runId&&row.state==='answered'&&payload.answer===COMPOSER_ATTACHMENT_ANSWER&&
        questionIdentity(payload)===questionIdentity(permit.question),'ATTACHMENT_QUESTION_NOT_ANSWERED');
      report.attachmentQuestion.code='QUESTION_ANSWERED_BOUND';
    }
    return state;
  };
  async function completed(id,count,permit){
    const state=await until(async()=>{
      const value=await bound(id,count,permit),turn=value.projection.turns.at(-1);
      if(!turn||value.projection.turns.length<count)return false;
      const runs=readRun(turn.id);demand(runs.length===1,'RUN_NOT_BOUND');
      return composerSendTerminal(value,runs[0],id,count)?value:false;
    },'SEND_COMPLETION_TIMEOUT');
    const turn=state.projection.turns.at(-1);demand(body(turn).length>0,'COMPLETED_BODY_EMPTY');
    demand(await input().inputValue()==='','SENT_DRAFT_NOT_CLEARED');
    demand(query('SELECT id FROM ai_agent_runs').length===count,'DUPLICATE_SQL_RUN');
    report.terminals??=[];report.terminals.push({code:'SUCCEEDED_COMPLETED',runHash:hash(turn.id),answerHash:hash(body(turn)),wire:provider().wire});
    const timer=page.locator(`[data-turn-id="${turn.id}"]`).getByTestId('model-thinking-duration');
    if(await timer.count()===1){
      const value=await timer.innerText();const deadline=Date.now()+1100;
      while(Date.now()<deadline){await until(async()=>{demand(await timer.innerText()===value,'TERMINAL_TIMER_NOT_FROZEN');return true;},'TIMER_OBSERVATION');await new Promise(resolve=>setTimeout(resolve,100));}
      report.terminals.at(-1).timer={code:'TERMINAL_TIMER_FROZEN',hash:hash(value)};
    }else report.terminals.at(-1).timer={code:'NO_PUBLIC_PROCESS_TIMER_NOT_RUN'};
    return turn;
  }
  const id=await session();demand(id&&id!=='loading','SESSION_NOT_READY');demand(await composer().count()===1,'COMPOSER_NOT_UNIQUE');
  demand((await snapshot(id)).projection.turns.length===0,'FRESH_HISTORY_NOT_EMPTY');
  let first,attachment,stopped,retained,unsent,nativeAtStop,ledgerAtStop,wireAtStop;
  await check('TEXT_SEND_REENTRY',async()=>{
    demand(await send().isDisabled(),'EMPTY_SEND_ENABLED');
    await input().fill('   ');demand(await send().isDisabled(),'WHITESPACE_SEND_ENABLED');
    const marker='QA-'+random(),prompt=`合成验收：只回复 ${marker}。不调用工具、不读取文件、不提问。`;
    await input().fill(prompt);demand(!await send().isDisabled(),'TEXT_SEND_DISABLED');
    await setScenario('TEXT',1,id);
    // Two real Enter events. The second must not admit a duplicate turn or queue.
    await input().press('Enter');await input().press('Enter');
    first=await completed(id,1);
    const user=first.items.filter(item=>item.role==='user');demand(user.length===1&&user[0].text===prompt,'USER_PROMPT_NOT_EXACT');
    const messages=query('SELECT content FROM ai_conversation_messages WHERE session_id=? AND role=?',[id,'user']);
    demand(messages.length===1&&messages[0].content===prompt,'DUPLICATE_USER_MESSAGE');
    const native=nativeBytes(id).toString('utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    const users=native.filter(entry=>entry.type==='message'&&entry.message?.role==='user');
    demand(users.length===1&&JSON.stringify(users[0].message.content).includes(marker),'NATIVE_USER_NOT_UNIQUE');
    demand(!(await snapshot(id)).controls?.some(item=>item.kind==='instruction'),'REENTRY_QUEUED');
    demand(await page.getByTestId('pi-queued-instruction').count()===0,'REENTRY_QUEUED');
    await shot('TEXT_SEND_REENTRY');
  });
  await check('ATTACHMENT_ONLY_SEND',async()=>{
    demand(await input().inputValue()==='','ATTACHMENT_DRAFT_NOT_EMPTY');
    const picker=composer().locator('button[aria-label="添加本地附件"]');demand(await picker.count()===1,'ATTACHMENT_TRIGGER_NOT_UNIQUE');
    const selected=page.waitForEvent('filechooser');await picker.click();await (await selected).setFiles([fixture]);
    const drafts=await until(async()=>{
      const value=await page.evaluate(value=>window.omniEdu.listXiaozhiAttachments(value),{schemaVersion:'xiaozhi.attachments.v1',sessionId:id,requestId:'xiattach_'+random()});
      demand(value?.ok,'ATTACHMENT_LIST_FAILED');return value.data.length===1?value.data:false;
    },'ATTACHMENT_IMPORT_TIMEOUT',30000);
    demand(drafts[0].name===path.basename(fixture),'ATTACHMENT_IMPORT_MISMATCH');
    const draftChip=composer().getByTestId('pi-attachments').getByTestId('pi-agent-attachment-'+drafts[0].id);
    await draftChip.waitFor({state:'visible'});demand(await draftChip.count()===1&&await draftChip.getAttribute('data-state')==='draft','ATTACHMENT_DRAFT_CHIP_MISSING');
    await until(async()=>!await send().isDisabled(),'ATTACHMENT_SEND_DISABLED',15000);
    await setScenario('ATTACHMENT_ONLY',2,id);await send().click();attachment=await completed(id,2,{phase:'ATTACHMENT_ONLY',sessionId:id});
    const users=attachment.items.filter(item=>item.role==='user');demand(users.length===1&&users[0].attachments?.length===1,'ATTACHMENT_USER_BINDING_MISSING');
    const file=users[0].attachments[0];demand(file.id===drafts[0].id&&file.state==='submitted'&&file.runId===attachment.id&&file.messageId===users[0].id,'ATTACHMENT_SUBMITTED_BINDING_MISMATCH');
    const sends=query('SELECT run_id,message_id,selection_json FROM xiaozhi_pi_attachment_sends WHERE run_id=?',[attachment.id]);
    demand(sends.length===1&&sends[0].message_id===users[0].id,'ATTACHMENT_SEND_LEDGER_MISMATCH');
    const selection=JSON.parse(sends[0].selection_json);demand(selection.length===1&&selection[0].id===drafts[0].id&&selection[0].revision===drafts[0].revision,'ATTACHMENT_SELECTION_MISMATCH');
    await until(async()=>{
      const remaining=await page.evaluate(value=>window.omniEdu.listXiaozhiAttachments(value),{schemaVersion:'xiaozhi.attachments.v1',sessionId:id,requestId:'xiattach_'+random()});
      demand(remaining?.ok,'ATTACHMENT_LIST_FAILED');return remaining.data.length===0&&await draftChip.count()===0;
    },'ATTACHMENT_PENDING_NOT_CLEARED',15000);
    const historyChip=page.locator(`[data-turn-id="${attachment.id}"]`).getByTestId('pi-attachment-history').getByTestId('pi-agent-attachment-'+file.id);
    demand(await historyChip.count()===1&&await historyChip.getAttribute('data-state')==='submitted','ATTACHMENT_HISTORY_CHIP_MISSING');
    report.attachment={code:'SUBMITTED_BOUND',fixtureHash:hash(fs.readFileSync(fixture)),idHash:hash(file.id),runHash:hash(attachment.id)};
    await shot('ATTACHMENT_ONLY_SEND');
  });
  await check('BODY_STOP',async()=>{
    const prompt=`合成验收 ${random()}：请直接输出从1到500的编号清单，每行写“本地合成教学练习，第N项，17加8等于25”。不要调用工具、不要读取文件、不要提问；持续输出正文。`;
    await input().fill(prompt);await setScenario('STOP',3,id);await send().click();
    const streaming=await until(async()=>{
      const value=await bound(id,3);if(value.projection.turns.length<3)return false;
      const turn=value.projection.turns.at(-1);demand(!['completed','failed','interrupted'].includes(turn.status),'STOP_WINDOW_MISSED');
      const lastBody=turn.items.filter(item=>item.role==='assistant'&&item.text?.trim()).at(-1);
      if(!lastBody)return false;
      const rendered=page.locator(`[data-turn-id="${turn.id}"] [data-item-id="${lastBody.id}"][data-testid="agent-reply-body"]`);
      return value.running&&body(turn).length>=40&&await rendered.count()===1&&await rendered.isVisible()&&(await rendered.innerText()).trim().length>=20?turn:false;
    },'STOP_BODY_TIMEOUT');
    retained=body(streaming);await stopping();
    // The polling predicate required the exact projected body item to be visible.
    const stop=composer().getByRole('button',{name:'停止本轮',exact:true});demand(await stop.count()===1,'STOP_TRIGGER_NOT_UNIQUE');await stop.click();
    const terminal=await until(async()=>{
      const value=await bound(id,3),turn=value.projection.turns.at(-1),run=readRun(streaming.id)[0];
      demand(turn.id===streaming.id&&run,'STOP_RUN_CHANGED');
      demand(turn.status!=='completed'&&run.status!=='succeeded','STOP_WINDOW_MISSED');
      return !value.running&&turn.status==='interrupted'&&run.status==='blocked'?turn:false;
    },'STOP_TERMINAL_TIMEOUT',30000);
    stopped=terminal;demand(body(stopped).startsWith(retained),'STOP_BODY_NOT_RETAINED');
    unsent='未发送冷启草稿 '+random();await input().fill(unsent);
    await until(async()=>await page.evaluate(({id,text})=>JSON.parse(localStorage.getItem('xiaozhi.composer-draft.v1:'+id)||'null')?.text===text,{id,text:unsent}),'DRAFT_NOT_DURABLE',10000);
    nativeAtStop=nativeBytes(id);ledgerAtStop=ledger();wireAtStop=provider().wire;
    report.stop={code:'BLOCKED_INTERRUPTED',runHash:hash(stopped.id),bodyHash:hash(body(stopped)),nativeHash:hash(nativeAtStop),draftHash:hash(unsent)};
    await shot('BODY_STOP');
  });
  await check('STOP_COLD_NO_REPLAY',async()=>{
    page=await cold();
    const navigation=page.locator('[data-testid="edu-navigation"]:visible');
    if(await navigation.getAttribute('data-collapsed')==='true')await navigation.getByTestId('workbench-sidebar-toggle').click();
    const entry=navigation.getByTestId('workbench-session-'+id);demand(await entry.count()===1,'PUBLIC_HISTORY_TARGET_NOT_UNIQUE');await entry.click();
    await until(async()=>await session()===id&&!await input().isDisabled(),'PUBLIC_HISTORY_NOT_RESTORED',30000);
    const state=await bound(id,3);demand(!state.running&&state.projection.turns.at(-1).id===stopped.id&&state.projection.turns.at(-1).status==='interrupted','STOP_COLD_PROJECTION_CHANGED');
    demand(body(state.projection.turns.at(-1))===body(stopped),'STOP_COLD_BODY_CHANGED');
    demand(await input().inputValue()===unsent,'STOP_COLD_DRAFT_LOST');
    assert.deepEqual(ledger(),ledgerAtStop,'STOP_COLD_LEDGER_CHANGED');assert.deepEqual(nativeBytes(id),nativeAtStop,'STOP_COLD_NATIVE_REPLAY');
    demand(provider().wire===wireAtStop,'STOP_COLD_PROVIDER_REPLAY');
    // Re-read after a bounded observation interval; no asynchronous predicate is
    // passed to Playwright waitForFunction and no business operation is retried.
    const deadline=Date.now()+1500;while(Date.now()<deadline){await until(async()=>{demand(!(await snapshot(id)).running,'STOP_COLD_RESTARTED');return true;},'COLD_OBSERVATION');await new Promise(resolve=>setTimeout(resolve,100));}
    assert.deepEqual(ledger(),ledgerAtStop,'STOP_COLD_LEDGER_LATE_CHANGED');assert.deepEqual(nativeBytes(id),nativeAtStop,'STOP_COLD_NATIVE_LATE_REPLAY');
    demand(provider().wire===wireAtStop,'STOP_COLD_PROVIDER_LATE_REPLAY');await shot('STOP_COLD_NO_REPLAY');
  });
}
