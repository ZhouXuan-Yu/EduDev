import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const appRoot = new URL('..', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\');
const tempRoot = mkdtempSync(join(tmpdir(), 'omni-review-reminder-'));
const outfile = join(tempRoot, 'review-reminder.mjs');
await build({ entryPoints: [join(appRoot, 'src/main/ai-harness/review-reminder.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
const reminder = await import(pathToFileURL(outfile).href);

const now = 1_800_000_000;
const candidates = [
  { id: 'due', name: '一次函数', moduleId: 'm1', moduleName: '函数', type: 'procedure', dueAt: now - 1 },
  { id: 'soon', name: '方程', moduleId: 'm1', moduleName: '方程', type: 'concept', dueAt: now + 2 * 86_400 },
  { id: 'later', name: '几何', moduleId: 'm2', moduleName: '几何', type: 'design', dueAt: now + 31 * 86_400 },
];
const due = reminder.buildReviewReminder(candidates, now, 'UTC');
assert.equal(due.schemaVersion, 'omni.review.reminder.v1');
assert.equal(due.status, 'due');
assert.equal(due.dueCount, 1);
assert.equal(due.upcomingCount, 1);
assert.deepEqual(due.items.map((item) => item.knowledgePointId), ['due', 'soon']);
assert.equal(due.items[0].state, 'due');
assert.equal(due.items[1].state, 'upcoming');
assert.equal(due.rawRecordsIncluded, false);
assert.equal(due.requiresTeacherReview, true);
assert.equal(due.timezoneInvariant, true);

const shanghai = reminder.buildReviewReminder(candidates, now, 'Asia/Shanghai');
const newYork = reminder.buildReviewReminder(candidates, now, 'America/New_York');
assert.deepEqual({ ...due, timezone: 'UTC' }, { ...shanghai, timezone: 'UTC' });
assert.deepEqual({ ...due, timezone: 'UTC' }, { ...newYork, timezone: 'UTC' });

const clear = reminder.buildReviewReminder([{ id: 'far', name: '远期', moduleId: '', moduleName: '', type: 'procedure', dueAt: now + 31 * 86_400 }], now, 'UTC');
assert.equal(clear.status, 'clear');
assert.equal(clear.dueCount, 0);
assert.equal(clear.upcomingCount, 0);
assert.equal(clear.nextAt, null);

const malformed = reminder.buildReviewReminder([
  { id: '', name: 'missing id', dueAt: now },
  { id: 'nan', name: 'nan', dueAt: Number.NaN },
  { id: 'negative', name: 'negative', dueAt: -1 },
  { id: 'valid', name: 'valid', dueAt: now },
  { id: 'valid', name: 'duplicate', dueAt: now },
], now, 'UTC', 999);
assert.equal(malformed.status, 'due');
assert.equal(malformed.dueCount, 1);
assert.equal(malformed.items.length, 1);
assert.equal(malformed.horizonSeconds, 30 * 86_400);

const huge = Array.from({ length: 10_000 }, (_, index) => ({ id: `p${index}`, name: `知识点${index}`, moduleId: 'm', moduleName: '模块', type: 'procedure', dueAt: now + index * 86_400 }));
const bounded = reminder.buildReviewReminder(huge, now, 'UTC');
assert.equal(bounded.items.length, 3);
assert.equal(bounded.dueCount, 1);
assert.equal(bounded.upcomingCount, 3);
assert.equal(JSON.stringify(bounded).includes('learning_records'), true);
assert.equal(JSON.stringify(bounded).includes('raw content'), false);

const result = { ok: true, cases: 18, bounded: true, deterministic: true, timezoneInvariant: true, noRawRecords: true };
console.log(JSON.stringify(result));
try { rmSync(tempRoot, { recursive: true, force: true }); } catch { /* best effort */ }
