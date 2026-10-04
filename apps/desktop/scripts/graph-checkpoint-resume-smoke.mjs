import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-graph-checkpoint-'));
const bundleDir = mkdtempSync(join(process.cwd(), '.checkpoint-smoke-'));
try {
  await build({ entryPoints: { db: 'src/main/db.ts', checkpointer: 'src/main/ai-harness/sqlite-graph-checkpointer.ts' }, outdir: bundleDir, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const { OmniEduStore } = await import(`file:///${join(bundleDir, 'db.js').replaceAll('\\', '/')}`);
  const { SqliteGraphCheckpointer } = await import(`file:///${join(bundleDir, 'checkpointer.js').replaceAll('\\', '/')}`);
  let store = new OmniEduStore(dataRoot);
  await store.init();
  const runId = await store.startAiAgentRun({ prompt: '隔离图恢复测试', route: 'practice_design', model: 'test-model' });
  await store.close();

  // An existing database without graph tables must migrate in place.
  const dbPath = join(dataRoot, 'app.db');
  const legacy = new DatabaseSync(dbPath);
  legacy.exec('DROP TABLE ai_graph_checkpoint_writes; DROP TABLE ai_graph_checkpoints;');
  legacy.close();
  store = new OmniEduStore(dataRoot);
  await store.init();
  assert.equal((await store.listAiAgentRuns(10)).find((run) => run.id === runId)?.status, 'blocked', 'restart must turn orphaned running state into a visible terminal state');
  assert.ok((await store.listAiAgentEvents(runId)).some((event) => event.outputSummary?.recovery === 'startup_interrupted'));
  const activeRunId = await store.startAiAgentRun({ prompt: '新进程的活跃运行', route: 'practice_design', model: 'test-model' });
  await store.init();
  assert.equal((await store.listAiAgentRuns(10)).find((run) => run.id === activeRunId)?.status, 'running', 'renderer bootstrap must not interrupt an active run');
  const exhaustedRunId = await store.startAiAgentRun({ prompt: '耗尽网络重试后进程退出', route: 'practice_design', subIntent: 'triplet_practice', model: 'test-model' });
  for (let retryNumber = 1; retryNumber <= 2; retryNumber += 1) {
    await store.recordAiAgentEvent(exhaustedRunId, { phase: 'route', status: 'succeeded', label: '网络恢复重试', detail: '隔离测试', outputSummary: { retryNumber } });
  }
  await store.close();
  store = new OmniEduStore(dataRoot);
  await store.init();
  assert.equal((await store.getAiAgentRun(exhaustedRunId))?.status, 'failed', 'restart must not bypass exhausted retry budget');
  assert.ok((await store.listAiAgentEvents(exhaustedRunId)).some((event) => event.outputSummary?.recovery === 'retry_budget_exhausted'));
  await store.close();

  const State = Annotation.Root({ count: Annotation() });
  let firstCalls = 0;
  const makeGraph = (checkpointer, fail) => new StateGraph(State)
    .addNode('first', () => { firstCalls += 1; return { count: 1 }; })
    .addNode('second', (state) => { if (fail) throw new Error('planned interruption'); return { count: state.count + 1 }; })
    .addEdge(START, 'first').addEdge('first', 'second').addEdge('second', END)
    .compile({ checkpointer });
  const config = { configurable: { thread_id: runId }, durability: 'sync' };
  let saver = new SqliteGraphCheckpointer(dbPath);
  await assert.rejects(makeGraph(saver, true).invoke({ count: 0 }, config), /planned interruption/);
  const beforeRestart = await saver.getTuple(config);
  assert.equal(beforeRestart?.checkpoint.channel_values.count, 1, 'completed first node must be checkpointed');
  await saver.close();

  saver = new SqliteGraphCheckpointer(dbPath);
  const restored = await saver.getTuple(config);
  assert.equal(restored?.checkpoint.channel_values.count, 1, 'new saver must read the persisted node state');
  const resumed = await makeGraph(saver, false).invoke(null, config);
  assert.equal(resumed.count, 2);
  assert.equal(firstCalls, 1, 'resume must not repeat an already checkpointed node');
  const history = [];
  for await (const item of saver.list(config)) history.push(item);
  assert.ok(history.length >= 3, 'checkpoint history must remain queryable after resume');
  await saver.close();
  console.log(JSON.stringify({ suite: 'sqlite-graph-checkpoint-resume', passed: true, checkpoints: history.length, firstNodeExecutions: firstCalls, oldDbMigration: true }));
} finally {
  if (realpathSync(dataRoot).startsWith(realpathSync(tmpdir()))) rmSync(dataRoot, { recursive: true, force: true });
  if (realpathSync(bundleDir).startsWith(realpathSync(process.cwd()))) rmSync(bundleDir, { recursive: true, force: true });
}
