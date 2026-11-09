import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';

export async function stopAndFailureJourney(ctx){
 const input=ctx.page().getByTestId('office-prompt-input');
 for(const mode of ['stop','failure']){
  const turn=await ctx.submit(mode,'仅生成公开合成教学说明，供'+(mode==='stop'?'停止':'传输失败')+'状态验收。');
  const scope=ctx.turn(turn.id),body=scope.getByTestId('agent-reply-body'),text=mode==='stop'?'这是停止前已收到的公开正文。':'这是传输失败前已收到的公开正文。';
  await ctx.until(()=>body.innerText().then(t=>t.includes(text)),'PARTIAL_BODY_'+mode);assert((await ctx.snapshot()).running);
  await ctx.shot(mode+'-streaming');
  if(mode==='stop')await ctx.stop();else await ctx.app().evaluate(()=>globalThis.__recoveryProvider.fail());
  const expected=mode==='stop'?'interrupted':'failed';await ctx.terminal(turn.id,expected);assert((await body.innerText()).includes(text));assert.equal(await scope.locator('.office-turn-notice').getAttribute('data-state'),expected);
  assert.equal(await scope.locator('details,summary').count(),0);assert.equal(await scope.getByTestId('office-turn-duration').count(),0);await ctx.shot(mode+'-terminal');ctx.check('Original '+mode+' transition retains received body and real terminal state');
  const action=scope.getByTestId(mode==='stop'?'office-turn-continue':'office-turn-retry');await action.waitFor();const before=await ctx.providerCount();
  await input.fill('教师尚未发送的独立草稿');await action.click();assert.equal(await input.inputValue(),'教师尚未发送的独立草稿');assert((await ctx.page().getByTestId('pi-retry-hint').innerText()).includes('保留'));assert.equal(await ctx.providerCount(),before);
  await input.fill('');await action.click();assert((await input.inputValue()).includes('公开合成教学说明'));assert.equal(await ctx.providerCount(),before);assert.equal((await ctx.snapshot()).running,false);await input.fill('');ctx.check('Original '+mode+' recovery protects an existing draft and prepares a new unsent continuation without replay');
 }
}

export async function copyApprovalJourney(ctx){
 for(const [decision,target] of [['reject','拒绝副本.txt'],['stop','停止副本.txt'],['approve','批准副本.txt']]){
  const turn=await ctx.submit('copy','请求复制公开原件.txt为'+target+'，必须等待教师本次决定。',target),scope=ctx.turn(turn.id);
  await ctx.until(async()=>(await ctx.snapshot()).approvals.some(a=>a.target===target&&a.state==='pending'),'APPROVAL_PENDING');
  const approval=(await ctx.snapshot()).approvals.filter(a=>a.target===target&&a.state==='pending');assert.equal(approval.length,1);const card=scope.locator(`[data-testid="pi-copy-approval"][data-approval-id="${approval[0].id}"]`);await card.waitFor();assert.equal(await card.count(),1);assert(!fs.existsSync(path.join(ctx.workspace,target)));ctx.approvalIds.push(approval[0].id);
  for(const [width,height] of [[1366,768],[1920,1080],[800,768]]){await ctx.size(width,height);await card.scrollIntoViewIfNeeded();for(const id of ['pi-copy-approve','pi-copy-reject']){const box=await card.getByTestId(id).boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=height,'Approval decisions must be reachable');}if(decision==='reject')await ctx.shot('pending-'+width);}
  ctx.check('Pending '+decision+' approval remains explicit and reachable at all three native sizes with zero write');
  if(decision==='stop')await ctx.stop();else await card.getByTestId('pi-copy-'+decision).click();
  await ctx.terminal(turn.id,decision==='stop'?'interrupted':'completed');
  const state=(await ctx.snapshot()).approvals.find(a=>a.id===approval[0].id);assert.equal(state.state,decision==='stop'?'interrupted':decision==='reject'?'rejected':'executed');
  assert.equal(await card.getByTestId('pi-copy-approve').count(),0);if(decision==='approve')assert.deepEqual(fs.readFileSync(path.join(ctx.workspace,target)),ctx.sourceBytes);else assert(!fs.existsSync(path.join(ctx.workspace,target)));
  await ctx.shot('approval-'+decision);ctx.check('Actual '+decision+' resolves the durable approval; only explicit approve creates the exact copy');
 }
}
