import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase3-helper-final-'));
const archive = path.resolve('../../docs/goal/xiaozhi-harness/evidence/phase3/windows-helper-platform/platform-source-and-binaries.tar.gz');
const extracted = spawnSync('tar', ['-xzf', archive, '-C', root], {encoding: 'utf8', windowsHide: true});
if (extracted.status !== 0) throw Error(extracted.stderr || 'archived helper test extraction failed');
const source = path.resolve('src/main/xiaozhi-agent/permissions/windows');
for (const file of ['NativeSandbox.cs', 'PlatformInfo.cs', 'TrustedRuntimes.cs']) fs.copyFileSync(path.join(source, file), path.join(root, file));
for (const file of ['xiaozhi-sandbox.exe', 'sandbox-manifest.json']) fs.copyFileSync(path.join(source, 'generated', file), path.join(root, file));
for (const file of ['test-helper.mjs', 'test-platform-info.mjs']) {
  const filename = path.join(root, file);
  const previous = fs.readFileSync(filename, 'utf8');
  const next = previous.replaceAll("path.join(root,'NativeSandbox.cs'),", "path.join(root,'NativeSandbox.cs'),path.join(root,'PlatformInfo.cs'),")
    .replaceAll("command:'x'.repeat(16385)", "command:'x'.repeat(32769)");
  fs.writeFileSync(filename, next);
}
const report = {success: false, root, boundary: 'Archived delegated test clients exercise the current production three-source build and actual executable bytes. All data and native profiles are owned TEMP.', suites: []};
for (const [file, expected] of [['test-helper.mjs', 'SUMMARY 51/51'], ['test-platform-info.mjs', 'SUMMARY 11/11']]) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, file)], {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 2097152});
  fs.writeFileSync(path.join(root, file + '.log'), (result.stdout || '') + (result.stderr || ''));
  const success = result.status === 0 && result.stdout.includes(expected);
  report.suites.push({file, success, exitCode: result.status, durationMs: performance.now() - started, error: result.error?.message});
  console.log((result.stdout || '').trim());
  if (!success) {process.exitCode = 1; break;}
}
report.success = report.suites.length === 2 && report.suites.every(suite => suite.success);
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
