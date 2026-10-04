import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sdkRoot = path.join(root, 'src/main/xiaozhi-agent/vendor/hana');
const toolRoot = path.join(root, 'src/main/office-agent/vendor/hana');
const sdk = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'source-manifest.json'), 'utf8'));
const tools = JSON.parse(fs.readFileSync(path.join(toolRoot, 'source-manifest.json'), 'utf8'));
const checks = [
  ...sdk.rows.map(row => ({ source: path.join(row.sourceRoot, row.path), output: path.join(sdkRoot, row.path), expectedSource: row.sourceSha256, expectedOutput: row.outputSha256 })),
  ...tools.entries.map(row => ({ source: row.source, output: path.join(toolRoot, row.destination), expectedSource: row.sourceSha256, expectedOutput: row.vendoredSha256 })),
].map(row => ({ ...row, sourceSha256: hash(row.source), outputSha256: hash(row.output) }));
for (const row of checks) { assert.equal(row.sourceSha256, row.expectedSource, row.source); assert.equal(row.outputSha256, row.expectedOutput, row.output); }
const report = { success: true, observedAt: new Date().toISOString(), sdk: sdk.rows.length, tools: tools.entries.length, checks,
  boundary: 'Static provenance only; no API or user flow validation implied' };
const output = path.join(root, 'test-results/xiaozhi-agent/hana-auto-source-audit.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ success: true, sdk: report.sdk, tools: report.tools, checks: checks.length, report: path.relative(root, output) }));
