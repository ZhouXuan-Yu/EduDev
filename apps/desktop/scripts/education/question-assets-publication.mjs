import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { nativeTestPng } from './native-test-png.mjs';

const { QuestionAssets } = await import('../../src/main/assets/question-assets.ts');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'omni-asset-publication-'));
const assets = new QuestionAssets(() => root);
const bytes = nativeTestPng(30);
const signal = new AbortController().signal;
const sha = value => createHash('sha256').update(value).digest('hex');
const imageFor = (content = bytes) => ({ assetId: 'asset_' + randomUUID(), sha256: sha(content),
  width: content.readUInt32BE(16), height: content.readUInt32BE(20) });
const directory = path.join(root, 'question-assets', 'v1');
const checks = [];
const file = image => path.join(directory, image.assetId + '.png');
const absent = async image => assert.rejects(fs.stat(file(image)), { code: 'ENOENT' });
async function check(name, action) {
  await action();
  checks.push(name);
  console.log('PASS ' + name);
}

await check('A missing candidate cache reuses the authenticated formal image for read and promotion', async () => {
  const image = imageFor();
  await assets.put(image, bytes, true, signal);
  assert.deepEqual(await assets.read(image, false, signal), bytes);
  await assets.promote(image, signal);
  await assert.rejects(fs.stat(path.join(root, 'cache/question-candidates/v1', image.assetId + '.png')), { code: 'ENOENT' });
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Missing candidate and formal images still fail without creating image facts', async () => {
  const image = imageFor();
  await assert.rejects(assets.read(image, false, signal), /unavailable/);
  await assert.rejects(assets.promote(image, signal), /unavailable/);
  await absent(image);
});

await check('Existing corrupt candidate bytes remain rejected even when the formal image is healthy', async () => {
  const image = imageFor();
  await assets.put(image, bytes, false, signal);
  await assets.put(image, bytes, true, signal);
  const cached = path.join(root, 'cache/question-candidates/v1', image.assetId + '.png');
  await fs.writeFile(cached, Buffer.from('corrupt candidate'));
  await assert.rejects(assets.read(image, false, signal), /unavailable/);
  await assert.rejects(assets.promote(image, signal), /unavailable/);
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Fallback validates the formal SHA and dimensions against the same candidate reference', async () => {
  const image = imageFor();
  await assets.put(image, bytes, true, signal);
  for (const altered of [{ ...image, sha256: sha(nativeTestPng(60)) }, { ...image, width: image.width + 1 }]) {
    await assert.rejects(assets.read(altered, false, signal), /unavailable/);
    await assert.rejects(assets.promote(altered, signal), /unavailable/);
  }
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Candidate hardlinks and persistent formal hardlinks remain rejected during fallback', async () => {
  const image = imageFor(), cachedExtra = path.join(root, 'candidate-extra.png');
  await assets.put(image, bytes, false, signal);
  await assets.put(image, bytes, true, signal);
  const cached = path.join(root, 'cache/question-candidates/v1', image.assetId + '.png');
  await fs.link(cached, cachedExtra);
  try { await assert.rejects(assets.read(image, false, signal), /unavailable/); }
  finally { await fs.unlink(cachedExtra); }
  await fs.unlink(cached);
  const formalExtra = path.join(root, 'formal-extra.png');
  await fs.link(file(image), formalExtra);
  try { await assert.rejects(assets.read(image, false, signal), /unavailable/); }
  finally { await fs.unlink(formalExtra); }
  assert.deepEqual(await assets.read(image, false, signal), bytes);
});

await check('Fallback reads wait for a concurrent publisher to finish its temporary hardlink', async () => {
  const image = imageFor(), originalUnlink = fs.unlink;
  let linked, release;
  const observed = new Promise(resolve => { linked = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let blocked = false;
  fs.unlink = async (...args) => {
    if (!blocked && String(args[0]).includes('.pending-')) {
      blocked = true;
      linked();
      await hold;
    }
    return originalUnlink(...args);
  };
  let publishing, reading;
  try {
    publishing = assets.put(image, bytes, true, signal);
    await observed;
    reading = assets.read(image, false, signal);
    await new Promise(resolve => setTimeout(resolve, 15));
    release();
    const [, content] = await Promise.all([publishing, reading]);
    assert.deepEqual(content, bytes);
  } finally {
    release();
    await Promise.allSettled([publishing, reading]);
    fs.unlink = originalUnlink;
  }
});

await check('Cancellation during formal fallback stays cancelled and preserves the saved image', async () => {
  const image = imageFor(), controller = new AbortController(), originalOpen = fs.open;
  await assets.put(image, bytes, true, signal);
  fs.open = async (...args) => {
    if (args[0] === file(image)) controller.abort();
    return originalOpen(...args);
  };
  try { await assert.rejects(assets.read(image, false, controller.signal), /cancelled/); }
  finally { fs.open = originalOpen; }
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Promotion pins metadata before awaiting a candidate cache read', async () => {
  const image = imageFor(), expected = { ...image }, originalOpen = fs.open;
  await assets.put(image, bytes, false, signal);
  const differentId = 'asset_' + randomUUID();
  fs.open = async (...args) => {
    if (String(args[0]).includes('question-candidates')) image.assetId = differentId;
    return originalOpen(...args);
  };
  try { await assets.promote(image, signal); }
  finally { fs.open = originalOpen; }
  assert.deepEqual(await assets.read(expected, true, signal), bytes);
  await absent({ ...expected, assetId: differentId });
});

await check('Rejected image bytes leave the immutable identity available for a valid retry', async () => {
const image = imageFor();
await assert.rejects(assets.put(image, Buffer.from('wrong PNG bytes'), true, signal));
const filesAfterRejection = await fs.readdir(directory);
console.log(JSON.stringify({ root, filesAfterRejection }));
assert.equal(filesAfterRejection.includes(image.assetId + '.png'), false,
  'Rejected image bytes must not occupy the immutable identity');
await assets.put(image, bytes, true, signal);
assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('A correct PNG with the wrong SHA is rejected before publication', async () => {
  const image = imageFor();
  await assert.rejects(assets.put(image, nativeTestPng(90), true, signal));
  await absent(image);
  await assets.put(image, bytes, true, signal);
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Incorrect width or height leaves no file and permits a corrected retry', async () => {
  for (const key of ['width', 'height']) {
    const image = imageFor();
    await assert.rejects(assets.put({ ...image, [key]: image[key] + 1 }, bytes, true, signal));
    await absent(image);
    await assets.put(image, bytes, true, signal);
    assert.deepEqual(await assets.read(image, true, signal), bytes);
  }
});

await check('A PNG beyond the existing 4MiB budget never reaches a pending or published file', async () => {
  const oversized = Buffer.alloc(4 * 1048576 + 1);
  bytes.copy(oversized);
  const image = imageFor(oversized);
  await assert.rejects(assets.put(image, oversized, true, signal));
  await absent(image);
  assert(!(await fs.readdir(directory)).some(name => name.startsWith('.pending-')));
});

await check('Already cancelled writes publish no asset', async () => {
  const image = imageFor(), controller = new AbortController();
  controller.abort();
  await assert.rejects(assets.put(image, bytes, true, controller.signal));
  await absent(image);
});

await check('Cancellation after temporary open cleans up before publishing an identity', async () => {
  const image = imageFor(), controller = new AbortController(), originalOpen = fs.open;
  fs.open = async (...args) => {
    if (String(args[0]).includes('.pending-')) controller.abort();
    return originalOpen(...args);
  };
  try { await assert.rejects(assets.put(image, bytes, true, controller.signal)); }
  finally { fs.open = originalOpen; }
  await absent(image);
  assert(!(await fs.readdir(directory)).some(name => name.startsWith('.pending-')));
});

await check('Caller byte and metadata mutations during an asynchronous open cannot change stored content', async () => {
  const image = imageFor(), expected = { ...image }, input = Buffer.from(bytes), originalOpen = fs.open;
  fs.open = async (...args) => {
    if (String(args[0]).includes('.pending-')) {
      input.fill(0);
      image.assetId = 'asset_' + randomUUID();
      image.sha256 = 'f'.repeat(64);
      image.width++;
    }
    return originalOpen(...args);
  };
  try { await assets.put(image, input, true, signal); }
  finally { fs.open = originalOpen; }
  assert.deepEqual(await assets.read(expected, true, signal), bytes);
  await absent(image);
});

await check('An already authenticated identity remains idempotent even if unused incoming bytes differ', async () => {
  const image = imageFor();
  await assets.put(image, bytes, true, signal);
  const before = await fs.stat(file(image));
  await assets.put(image, Buffer.from('unused candidate'), true, signal);
  const after = await fs.stat(file(image));
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Concurrent same-identity publishers wait for the pending hardlink to be removed', async () => {
  const image = imageFor(), other = new QuestionAssets(() => root), originalUnlink = fs.unlink;
  let linked, release;
  const observed = new Promise(resolve => { linked = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let blocked = false;
  fs.unlink = async (...args) => {
    if (!blocked && String(args[0]).includes('.pending-')) {
      blocked = true;
      linked();
      await hold;
    }
    return originalUnlink(...args);
  };
  let first, second;
  try {
    first = assets.put(image, bytes, true, signal);
    await observed;
    second = other.put(image, bytes, true, signal);
    await new Promise(resolve => setTimeout(resolve, 15));
    release();
    await Promise.all([first, second]);
  } finally {
    release();
    await Promise.allSettled([first, second]);
    fs.unlink = originalUnlink;
  }
  assert.equal((await fs.stat(file(image))).nlink, 1);
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('An unrelated persistent hardlink stays rejected and never weakens the read guard', async () => {
  const image = imageFor(), extra = path.join(root, 'untrusted-extra-link.png');
  await assets.put(image, bytes, true, signal);
  await fs.link(file(image), extra);
  try {
    await assert.rejects(assets.put(image, bytes, true, signal));
    await assert.rejects(assets.read(image, true, signal));
    assert.equal(sha(await fs.readFile(file(image))), image.sha256);
  } finally { await fs.unlink(extra); }
  assert.deepEqual(await assets.read(image, true, signal), bytes);
});

await check('Historical corrupt identities stay protected from silent replacement', async () => {
  const image = imageFor(), corrupt = Buffer.from('historical corrupt bytes');
  await fs.writeFile(file(image), corrupt);
  await assert.rejects(assets.put(image, bytes, true, signal));
  assert.deepEqual(await fs.readFile(file(image)), corrupt);
});

await check('Cache-to-formal promotion retains exact bytes and independent single-link files', async () => {
  const image = imageFor();
  await assets.put(image, bytes, false, signal);
  await assets.promote(image, signal);
  assert.deepEqual(await assets.read(image, false, signal), bytes);
  assert.deepEqual(await assets.read(image, true, signal), bytes);
  assert.equal((await fs.stat(file(image))).nlink, 1);
});

await check('Conflicting concurrent identities have one authenticated winner without overwriting it', async () => {
  const image = imageFor(), alternative = nativeTestPng(170);
  const conflicting = { ...image, sha256: sha(alternative) };
  const results = await Promise.allSettled([
    assets.put(image, bytes, true, signal), assets.put(conflicting, alternative, true, signal),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const winner = results[0].status === 'fulfilled' ? image : conflicting;
  assert.equal(sha(await assets.read(winner, true, signal)), winner.sha256);
  assert(!(await fs.readdir(directory)).some(name => name.startsWith('.pending-')));
});

console.log(JSON.stringify({ success: true, root, count: checks.length, checks,
  scope: 'Production QuestionAssets with real PNG and filesystem, controlled faults and concurrency. No OCR/model/source-quality acceptance.' }));
