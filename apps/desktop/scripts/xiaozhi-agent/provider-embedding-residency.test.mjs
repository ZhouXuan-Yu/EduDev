import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
const { EmbeddingClient } = await import('../../src/main/retrieval/embedding-client.ts');
const { verifyRetrievalRuntime } = await import('../../src/main/retrieval/runtime-command.ts');

const runtimeRoot = process.env.OMNI_EDU_EMBEDDING_TEST_ROOT;
assert(runtimeRoot && path.isAbsolute(runtimeRoot), 'Pass an isolated locally managed runtime root');
const executable = await verifyRetrievalRuntime(runtimeRoot);

test('a real native embedding process keeps its residency through an idle result and settles on close', async () => {
  const visits = [];
  const client = new EmbeddingClient(executable, undefined, async () => {
    visits.push('acquire');
    return () => visits.push('close');
  });
  try {
    const values = await client.embed('query', ['直角三角形的斜边']);
    assert.equal(values[0][0].vector.length, 512);
    assert.deepEqual(visits, ['acquire']);
    await client.embed('query', ['分数的等值变换']);
    assert.deepEqual(visits, ['acquire'], 'a live idle owner should reuse the same residency');
  } finally {
    client.close();
  }
  const end = performance.now() + 10_000;
  while (visits.length < 2 && performance.now() < end) await delay(25);
  assert.deepEqual(visits, ['acquire', 'close']);
});

test('refused residency yields no native result and never acquires a release callback', async () => {
  let requests = 0;
  const client = new EmbeddingClient(executable, undefined, async () => {
    requests += 1;
    throw Error('busy');
  });
  try {
    await assert.rejects(client.embed('query', ['合成的独立测试题']), /embedding_unavailable/);
    assert.equal(requests, 1);
  } finally {
    client.close();
  }
});
