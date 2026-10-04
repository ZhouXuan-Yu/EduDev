import assert from 'node:assert/strict';
import { Annotation, Command, END, MemorySaver, START, StateGraph, interrupt } from '@langchain/langgraph';

const State = Annotation.Root({ count: Annotation(), decision: Annotation() });
let firstRuns = 0;
const graph = new StateGraph(State)
  .addNode('first', () => { firstRuns += 1; return { count: 1 }; })
  .addNode('teacher', () => {
    const decision = interrupt({ kind: 'teacher_approval', prompt: '保存题组？' });
    return { decision };
  })
  .addEdge(START, 'first').addEdge('first', 'teacher').addEdge('teacher', END)
  .compile({ checkpointer: new MemorySaver() });
const config = { configurable: { thread_id: 'approval-smoke' }, durability: 'sync' };
const paused = await graph.invoke({ count: 0 }, config);
const snapshot = await graph.getState(config);
assert.equal(paused.count, 1);
assert.equal(snapshot.next[0], 'teacher');
assert.equal(snapshot.tasks[0].interrupts[0].value.kind, 'teacher_approval');
const resumed = await graph.invoke(new Command({ resume: { approved: true } }), config);
assert.deepEqual(resumed.decision, { approved: true });
assert.equal(firstRuns, 1);
console.log(JSON.stringify({ suite: 'langgraph-interrupt-contract', passed: true, pausedNext: snapshot.next, firstRuns }));
