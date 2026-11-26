import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setImmediate as tick} from 'node:timers/promises';
import {HostResourceScheduler} from '../../src/main/host-resources/scheduler.ts';

const capacity = {cpu:2, memoryMiB:100, processes:2, indexOps:1, pdfWindows:1};
const request = (attempt, demand, lane='background', owner='fixture') =>
  ({owner, attempt, phase:'fixture', lane, demand, deadline:performance.now()+5000});
const scheduler = () => new HostResourceScheduler(capacity, {maxQueued:4, maxBypasses:2});

test('OCR and PDF launches cannot jointly use exhausted memory when CPU and physical slots remain', async () => {
  const abort = new AbortController();
  const host = scheduler();
  const acquire = stage => host.acquire(stage, abort.signal);
  const ocr = await acquire(request('ocr', {cpu:1, memoryMiB:80, processes:1}));
  let started = false;
  const pdf = acquire(request('pdf', {cpu:1, memoryMiB:30, pdfWindows:1}, 'foreground')).then(lease => {
    started = true;
    lease.settle();
  }, () => {});
  try {
    await tick();
    assert.equal(started, false, 'memory shortage must block a PDF launch even with a free CPU slot');
    assert.deepEqual(host.snapshot().used, {cpu:1,memoryMiB:80,processes:1,indexOps:0,pdfWindows:0});
  } finally {
    abort.abort();
    ocr.settle();
    await pdf;
  }
});

test('cancel before start rolls back, cancellation during work drains until its own actual completion', async () => {
  const host = scheduler(), queuedAbort = new AbortController();
  const first = await host.acquire(request('run', {cpu:2}), queuedAbort.signal);
  const beforeStart = new AbortController();
  const cancelled = host.acquire(request('skip', {cpu:2}), beforeStart.signal);
  beforeStart.abort();
  await assert.rejects(cancelled,/cancelled/);
  assert.equal(first.start(),true);
  const nextAbort = new AbortController();
  const next = host.acquire(request('next', {cpu:2}), nextAbort.signal);
  queuedAbort.abort();
  assert.equal(host.snapshot().used.cpu,2);
  assert.equal(host.snapshot().queued,1);
  first.settle();
  const reserved = await next;
  nextAbort.abort();
  assert.equal(reserved.start(),false);
  assert.equal(host.snapshot().used.cpu,0);
});

test('overlapping retries have separate lifetimes, and stale settlement cannot return newer capacity', async () => {
  const host = scheduler();
  const old = await host.acquire(request('attempt-1', {cpu:1,processes:1}));
  const fresh = await host.acquire(request('attempt-2', {cpu:1,processes:1}));
  old.start();
  fresh.start();
  await assert.rejects(host.acquire(request('attempt-2', {cpu:1})),/duplicate/);
  old.settle();
  old.settle();
  assert.equal(host.snapshot().used.processes,1);
  fresh.settle();
  assert.equal(host.snapshot().used.processes,0);
});

test('larger background stage gets a reservation opportunity despite continued foreground work', async () => {
  const host = scheduler();
  const running = await host.acquire(request('running',{cpu:1,memoryMiB:60}));
  const large = host.acquire(request('background',{cpu:2,memoryMiB:95}));
  for (let turn=0;turn<2;turn++) {
    const small = await host.acquire(request('small-'+turn,{cpu:1,memoryMiB:5},'foreground'));
    small.settle();
  }
  const final = host.acquire(request('foreground',{cpu:1},'foreground'));
  assert.equal(host.snapshot().queued,2);
  running.settle();
  const promoted = await large;
  assert.equal(host.snapshot().queued,1);
  promoted.settle();
  (await final).settle();
});

test('downshift retains outstanding work and reservations drain before new starts', async () => {
  const host = scheduler();
  const running = await host.acquire(request('running',{cpu:2,memoryMiB:90}));
  running.start();
  host.setTarget({...capacity,cpu:1,memoryMiB:60});
  assert.deepEqual(host.snapshot().debt,{cpu:1,memoryMiB:30,processes:0,indexOps:0,pdfWindows:0});
  const waiting = host.acquire(request('waiting',{cpu:1,memoryMiB:20},'foreground'));
  assert.equal(host.snapshot().queued,1);
  running.settle();
  (await waiting).settle();
});

test('invalid demand, impossible stages, bounded queue and expired deadline are explicit', async () => {
  const host = scheduler();
  for (const cpu of [-1,NaN,Infinity]) await assert.rejects(host.acquire(request('invalid',{cpu})),/invalid/);
  await assert.rejects(host.acquire(request('impossible',{memoryMiB:101})),/capacity/);
  await assert.rejects(host.acquire({...request('expired',{cpu:1}),deadline:performance.now()-10}),/timeout/);
  const running = await host.acquire(request('occupied',{cpu:2}));
  const wait = new AbortController();
  const queued = Array.from({length:4}, (_,i) => assert.rejects(host.acquire(request('q'+i,{cpu:1}),wait.signal),/cancelled/));
  await assert.rejects(host.acquire(request('too-many',{cpu:1})),/busy/);
  wait.abort();
  await Promise.all(queued);
  running.settle();
});

test('a caller can leave while an actual child still owns the resource', async () => {
  const host = scheduler(), cancellation = new AbortController();
  let started;
  const launch = new Promise(resolve => {started=resolve;});
  let child;
  const work = host.run(request('old-child',{processes:2}), cancellation.signal, async () => {
    child=spawn(process.execPath,['-e','process.stdin.resume()'],{stdio:['pipe','ignore','ignore'],windowsHide:true});
    const closed=once(child,'close');
    await once(child,'spawn');
    started();
    await closed;
  });
  await launch;
  try{
    cancellation.abort();
    const successor=host.acquire(request('new-child',{processes:1},'foreground'));
    await tick();
    assert.equal(host.snapshot().used.processes,2);
    assert.equal(host.snapshot().queued,1);
    assert.equal(host.recentEvents().at(-2).state,'cancel_requested');
    child.stdin.end();
    await work;
    const lease=await successor;
    lease.settle();
    assert.equal(host.snapshot().used.processes,0);
  }finally{
    if(child.exitCode===null)child.kill();
    await work;
  }
});
