import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';

const { fixture, materialQueueBoundaries } = await import('./material-queue-boundaries.mjs');
const { randomUUID } = await import('node:crypto');
let checks = 0;
const wait = async predicate => {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const check = async (name, action) => {
  await action();
  checks++;
  console.log('PASS ' + name);
};

await check('A transient completion ACK failure recovers online and commits content once', async () => {
 const state = fixture();
 try {
  const resource = state.add('回执暂时失败的目录资料');
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
    if (!injected && values[0] === 'succeeded') {
      injected = true;
      throw Error('SQLITE_BUSY');
    }
    return change(sql, values);
  };
  await state.queue.start();
  await wait(() => state.row(resource.id).status === 'succeeded');
  const result = {
    injected,
    status: state.row(resource.id).status,
    ready: (await state.host.resource(resource.id)).parseStatus,
    ingestCalls: state.calls.length,
    committedParses: state.commits(),
  };
  console.log(JSON.stringify(result));
  assert(injected);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.committedParses, 1);
  assert.equal((await state.queue.snapshot()).running, 0);
 } finally {
  await state.close();
 }
});

await check('A transient post-ingest task read failure recovers without an application restart', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const all = state.host.all;
  let injected = false;
  state.host.all = async (sql, values = []) => {
   if (!injected && sql === 'SELECT * FROM ai_tasks WHERE id=?') {
    injected = true;
    throw Error('SQLITE_BUSY');
   }
   return all(sql, values);
  };
  await state.queue.start();
  await wait(() => state.row(resource.id).status === 'succeeded');
  assert(injected);
  assert.equal(state.row(resource.id).status, 'succeeded');
  assert.equal(state.commits(), 1);
 } finally { await state.close(); }
});

await check('A live worker retains its exact lease across recovery heartbeats', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  state.gates.set(resource.id, {});
  await state.queue.enqueue(resource.id, resource.version);
  await state.queue.start();
  await wait(() => state.calls.length === 1);
  const lease = state.row(resource.id).payload_json;
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(state.row(resource.id).status, 'running');
  assert.equal(state.row(resource.id).payload_json, lease);
  assert.equal(state.calls.length, 1);
  state.gates.get(resource.id).resolve();
  await wait(() => state.row(resource.id).status === 'succeeded');
  assert.equal(state.row(resource.id).status, 'succeeded');
 } finally { await state.close(); }
});

await check('More than 100 foreign live leases neither change nor hide this instance orphan', async () => {
 const state = fixture();
 try {
  const foreign = [];
  for (let index = 0; index < 101; index++) {
   const resource = state.add();
   await state.queue.enqueue(resource.id, resource.version);
   const payload = JSON.parse(state.row(resource.id).payload_json);
   payload.owner = { pid: process.pid, nonce: randomUUID() };
   const saved = JSON.stringify(payload);
   state.db.prepare("UPDATE ai_tasks SET status='running',payload_json=? WHERE id=?").run(saved, resource.task);
   foreign.push({ resource, saved });
  }
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
   if (!injected && values[0] === 'succeeded') { injected = true; throw Error('SQLITE_BUSY'); }
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => state.row(resource.id).status === 'succeeded');
  assert.equal(state.row(resource.id).status, 'succeeded');
  for (const { resource, saved } of foreign) {
   assert.equal(state.row(resource.id).status, 'running');
   assert.equal(state.row(resource.id).payload_json, saved);
  }
  assert(state.calls.every(id => id === resource.id));
 } finally { await state.close(); }
});

await check('Cancellation wins over recovery and never requeues the cancelled lease', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
   if (!injected && values[0] === 'succeeded') {
    injected = true;
    await state.action(resource, 'cancel');
    throw Error('SQLITE_BUSY');
   }
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => injected && state.queue.active.size === 0);
  await state.queue.close();
  assert.equal(state.row(resource.id).status, 'cancelled');
  assert.equal(state.calls.length, 1);
 } finally { await state.close(); }
});

await check('An original version change rejects recovery under the old task version', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
   if (!injected && values[0] === 'succeeded') {
    injected = true;
    state.db.prepare('UPDATE teacher_resources SET version=? WHERE id=?').run('f'.repeat(64), resource.id);
    throw Error('SQLITE_BUSY');
   }
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => state.row(resource.id).status === 'failed');
  assert.equal(state.row(resource.id).error_message, 'source_changed');
  assert.equal(state.calls.length, 1);
 } finally { await state.close(); }
});

await check('Shutdown returns an untracked claim before queue restart in the same process', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
   if (!injected && values[0] === 'succeeded') { injected = true; throw Error('SQLITE_BUSY'); }
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => injected && state.queue.active.size === 0);
  await state.queue.close();
  assert.equal(state.row(resource.id).status, 'pending');
  assert.equal(JSON.parse(state.row(resource.id).payload_json).owner, null);
  await state.queue.start();
  await wait(() => state.row(resource.id).status === 'succeeded');
  assert.equal(state.row(resource.id).status, 'succeeded');
  assert.equal(state.commits(), 1);
 } finally { await state.close(); }
});

await check('A lost completion ACK does not prevent later files and the original task from finishing', async () => {
 const state = fixture();
 try {
  const resources = [state.add(), state.add(), state.add()];
  for (const resource of resources) await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  let injected = false;
  state.host.change = async (sql, values) => {
   if (!injected && values[0] === 'succeeded' && values[6] === resources[0].task) {
    injected = true;
    throw Error('SQLITE_BUSY');
   }
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => resources.every(resource => state.row(resource.id).status === 'succeeded'));
  assert(resources.every(resource => state.row(resource.id).status === 'succeeded'));
  assert.equal(state.commits(), 3);
 } finally { await state.close(); }
});

await check('Persistent ACK errors retry at the bounded heartbeat instead of spinning', async () => {
 const state = fixture();
 try {
  const resource = state.add();
  await state.queue.enqueue(resource.id, resource.version);
  const change = state.host.change;
  state.host.change = async (sql, values) => {
   if (values[0] === 'succeeded') throw Error('SQLITE_BUSY');
   return change(sql, values);
  };
  await state.queue.start();
  await wait(() => state.calls.length === 1 && state.queue.active.size === 0);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert(state.calls.length >= 2 && state.calls.length <= 4);
  assert.equal(state.commits(), 1);
  await state.queue.close();
  assert.equal(state.row(resource.id).status, 'pending');
 } finally { await state.close(); }
});

const focused = checks;
await materialQueueBoundaries(check);
console.log(JSON.stringify({ success: true, focused, related: checks - focused, scope: 'Production queue and real SQLite with controlled ingest and transient SQL faults.' }));
