import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const {isTaskContinuation}=await import('../../src/main/xiaozhi-agent/tasks/continuation.ts');

test('recognizes a request to finish the current task without adding requirements',()=>{
  for(const text of ['继续原任务的未完成内容。','请恢复当前任务的剩余步骤！','接着做这个任务中还没完成的部分。','请继续完成原先的任务。'])
    assert(isTaskContinuation(text),text);
});
test('preserves existing brief continuations and terminal controls',()=>{
  for(const text of ['继续吧','好的。','给上一个终端发送下一条命令'])assert(isTaskContinuation(text),text);
});
test('does not treat negation, attribution or a request for a new task as continuation',()=>{
  for(const text of ['不要继续原任务。','教师说：“继续原任务。”','继续原任务，同时为 A 班新建一份讲义。','继续上学期 B 班的讲义。','什么时候继续原任务？'])
    assert.equal(isTaskContinuation(text),false,text);
});
