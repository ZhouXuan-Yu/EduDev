import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve('test-results/harness-audit-20261012/mu'), revision = 'faed8c364323c477399b1dc2ef1d2fa36ce51267';
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), revision);
const file = 'packages/kyrn-judge/src/decision.ts', original = fs.readFileSync(path.join(root, file), 'utf8');
const excerpt = original.slice(original.indexOf('export const ABSTAIN:'), original.indexOf('export interface DecisionSpec<'));
assert(excerpt.includes('export type DecisionMode') && excerpt.includes('export type CacheImpact') && excerpt.includes('export type LatencyClass'));
const target = path.resolve('src/main/xiaozhi-agent/vendor/mu-decisions'), header = '// Extracted unchanged from mu; MIT. See source-manifest.json.\n';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const content = header + excerpt;
const manifest = { repository: 'https://github.com/qybaihe/mu', revision, source: file, sourceSha256: digest(original), adaptedSha256: digest(content), extraction: 'ABSTAIN, DecisionMode, CacheImpact and LatencyClass declarations; no judge provider or AgentLoop.', dependenciesAdded: [] };
if (process.argv.includes('--verify')) { assert.equal(fs.readFileSync(path.join(target, 'contract.ts'), 'utf8'), content); assert.deepEqual(fs.readFileSync(path.join(target, 'LICENSE')),fs.readFileSync(path.join(root, 'LICENSE'))); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'source-manifest.json'), 'utf8')), manifest); }
else { fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'contract.ts'), content); fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE')); fs.writeFileSync(path.join(target, 'source-manifest.json'), JSON.stringify(manifest, null, 2)); }
console.log(JSON.stringify({ verified: true, revision, files: 3 }));
