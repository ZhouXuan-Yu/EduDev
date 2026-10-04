import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.resolve(desktop, '../..');
const target = path.join(root, 'docs/design/codex-2026-10-03/p07-goal-production');
assert(!fs.existsSync(target), 'Preserve earlier evidence; archive target must be new');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entries = [];
const add = (name, bytes) => {
  assert(!/sk-[a-zA-Z0-9]{16,}/.test(bytes.toString()), 'Possible credential');
  assert(!/data:image\/[a-z]+;base64,[a-zA-Z0-9+/]{256}/.test(bytes.toString()), 'Image payload');
  const file = path.join(target, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  entries.push({ file: name, bytes: bytes.length, sha256: sha(bytes) });
};
const source = [
  '1.Agent.md', '2.Memory.md', '3.Learning.md', '4.Wiki.md', '测试样例说明书.md',
  'docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md', 'docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md',
  'docs/35_XIAZHI_OFFICE_AGENT_TODO.md', 'docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md',
  'docs/156_PI_PERSISTENT_GOAL_PRODUCTION_CONTRACT.md', 'docs/157_PI_PERSISTENT_GOAL_PRODUCTION_ACCEPTANCE.md',
  'docs/testing/持续目标样例补充.md', 'docs/testing/本轮执行记录_2026_10_04.md',
  'docs/design/codex-2026-10-03/p07-goal-pro-reference.json',
  ...['xiaozhi-goal.ts', 'xiaozhi-agent.ts', 'xiaozhi-projection.ts'].map(n => 'apps/desktop/src/shared/' + n),
  ...['goal-state.ts', 'goal-coordinator.ts', 'session-state.ts', 'pi-session.ts', 'production-host.ts', 'ipc.ts'].map(n => 'apps/desktop/src/main/xiaozhi-agent/' + n),
  'apps/desktop/src/preload/index.ts',
  ...['PiGoalControl.tsx', 'pi-goal.css', 'PiEducationWorkspace.tsx'].map(n => 'apps/desktop/src/renderer/components/office/' + n),
  ...['pi-goal-state-worker.ts', 'pi-goal-state-smoke.mjs', 'pi-goal-ui-smoke.mjs', 'pi-web-ui-smoke.mjs', 'archive-goal-production.mjs', 'goal-native-source.lock.json'].map(n => 'apps/desktop/scripts/xiaozhi-agent/' + n),
];
for (const name of source) add('source/' + name, fs.readFileSync(path.join(root, name)));
const output = path.join(desktop, 'test-results/xiaozhi-agent');
for (const directory of ['pi-goal-state-NHWhVR', 'pi-goal-ui-BRwT0l', 'pi-web-ui-srkFGa', 'deepseek-cache-live-rHuyAF', 'pi-auto-boundary-Q00AHI']) {
  const report = JSON.parse(fs.readFileSync(path.join(output, directory, 'report.json')));
  assert(report.success && (!report.checks || report.checks.every(c => c.pass)), directory);
  const safe = { directory, success: report.success, checks: report.checks?.map(c => ({ name: c.name, pass: c.pass })), layer: report.layer, humanAccepted: false, boundary: report.boundary, boundaries: report.boundaries, build: report.build, scriptSha256: report.scriptSha256 };
  if (report.requests) safe.requests = report.requests.map(r => ({ index: r.index, httpStatus: r.httpStatus, input: r.input, hit: r.hit, miss: r.miss, hitRate: r.hitRate }));
  if (report.previousFailures) safe.previousFailures = report.previousFailures.map(r => ({ directory: r.directory, checks: r.checks, buildSha256: r.buildSha256, scriptSha256: r.scriptSha256, retainedAt: 'Original isolated test directory and acceptance document 157' }));
  add('evidence/' + directory + '.json', Buffer.from(JSON.stringify(safe, null, 2) + '\n'));
}
const original = path.join(output, 'pi-goal-native-E6W1SV');
const preflight = JSON.parse(fs.readFileSync(path.join(original, 'report.json')));
for (const item of preflight.sources) {
  const bytes = fs.readFileSync(path.join(original, 'source', item.file));
  assert.equal(sha(bytes), item.sha256);
  add('upstream/' + item.file, bytes);
}
fs.writeFileSync(path.join(target, 'archive-manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files: entries, boundary: 'Explicit source/license/doc and sanitized report allowlist only. No DB, native conversation, credentials, profile, materials, images or binaries. Limited A/B/C acceptance; daily manual, no-VPN and full objective NOT_ACCEPTED.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ success: true, files: entries.length, target }));
