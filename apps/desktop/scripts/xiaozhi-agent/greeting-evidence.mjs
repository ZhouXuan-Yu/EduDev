import assert from 'node:assert/strict';

/** Regression for a historical reply that printed pseudo ask_teacher XML. */
export async function auditGreeting({page,newChat,send,snap,done,until,shot,report,check}) {
  await newChat();await send('你好，今天我们有什么工作吗');
  await until(async()=>{const snapshot=await snap();return !snapshot.running||snapshot.projection.turns.at(-1)?.status==='waiting_input';},180000);
  if((await snap()).projection.turns.at(-1)?.status==='waiting_input'){
    await page.getByTestId('pi-question-answer').fill('今天先了解你可以如何帮助教师，不创建资料。');
    await page.getByTestId('pi-question-submit').click();
  }
  const turn=await done(),body=turn.items.filter(i=>i.phase==='final_answer').map(i=>i.text).join('\n');
  check('greeting returns natural text or a genuine teacher question, without pseudo tool XML',()=>{
    assert.equal(turn.status,'completed',turn.error);assert(body.trim().length>10);
    assert(!/<\/?(?:ask_teacher|tool_call|function_call)\b/i.test(body));
  });
  report.greeting={turnId:turn.id,status:turn.status,chars:body.length,tools:turn.items.filter(i=>i.kind==='tool').map(i=>({name:i.toolName,status:i.status}))};
  await shot('greeting-completed');
}
