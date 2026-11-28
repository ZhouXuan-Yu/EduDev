import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const intent=await import('../../src/main/xiaozhi-agent/tasks/conversation-intent.ts');

test('teacher requests disambiguation of historical records before work',()=>{
  for(const prompt of ['两份班级记录同名，先给我确认目标。','有两段历史对话重名，请先问我用哪个班级。','两份同名的历史资料，请我先选一份。'])
    assert.equal(intent.requestsHistoryClarification(prompt),true,prompt);
  for(const prompt of ['请引用历史《班级记录》。','学生说：“两份班级记录同名，先给我确认目标。”','两个文件同名，导出这份讲义。','两份班级记录同名，直接写摘要。'])
    assert.equal(intent.requestsHistoryClarification(prompt),false,prompt);
});
test('clarifications show no inferred source names and offer a real defer option',()=>{
  for(const kind of ['history','handout']){
    const control=intent.sourceClarificationQuestion(kind);
    assert.equal(control.options.length,2);
    assert(control.options.some(option=>option.includes('暂不')));
    assert(!JSON.stringify(control).includes('《数学讲义》'));
    assert(control.question.includes(kind==='history'?'班级':'书名'));
  }
});
