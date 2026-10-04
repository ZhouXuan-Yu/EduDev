import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { copyFileRefToPath } = await import('../../src/main/office-agent/vendor/hana/lib/file-ref/resource-io.ts');
const { createHanaOfficeTools } = await import('../../src/main/office-agent/hana-tool-adapter.ts');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-copy-cancel-'));
const source = path.join(output, 'source.md'); fs.writeFileSync(source, '# 隔离源文件\n');
const checks = [], report = { suite: 'pi-copy-final-cancel-boundary', success: false, checks };
try {
  const abort = new AbortController(), target = path.join(output, 'cancelled.md');
  const copy = copyFileRefToPath({ from: { type: 'path', path: source }, targetPath: target, cwd: output,
    allowedRoots: [output], sourceAllowedRoots: [output], conflictPolicy: 'fail', signal: abort.signal });
  // FileRef resolution awaits. Cancel in that gap before the synchronous effect.
  abort.abort(); await assert.rejects(copy); assert(!fs.existsSync(target));
  checks.push({ name: 'Cancel during asynchronous FileRef resolution prevents the final exclusive copy', pass: true });
  const controlled = new AbortController();
  const tools = createHanaOfficeTools({ workspace: output, sessionId: 'fixture-session', runId: 'fixture-run',
    approveCopy: async () => true, beforeCopy: async () => { controlled.abort(); return true; } });
  const result = await tools.execute('office_copy_file', 'fixture-call', { source: 'source.md', target: 'cancelled-after-approval.md' }, controlled.signal);
  assert.equal(result.success, false); assert.equal(result.error.code, 'cancelled'); assert(!fs.existsSync(path.join(output, 'cancelled-after-approval.md')));
  checks.push({ name: 'Cancel after persisted execution gate still prevents the physical copy', pass: true });
  const conflict = path.join(output, 'existing.md'); fs.writeFileSync(conflict, '教师原文件');
  await assert.rejects(copyFileRefToPath({ from: { type: 'path', path: source }, targetPath: conflict, cwd: output,
    allowedRoots: [output], sourceAllowedRoots: [output], conflictPolicy: 'fail' }));
  assert.equal(fs.readFileSync(conflict, 'utf8'), '教师原文件');
  checks.push({ name: 'Existing teacher file is preserved by non-overwriting copy', pass: true });
  report.success = true;
} catch (error) { report.failure = String(error.stack).slice(0, 2500); process.exitCode = 1; }
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, report: path.relative(appRoot, path.join(output, 'report.json')) }));
