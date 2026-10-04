import './register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { createHanaOfficeTools } = await import('../../src/main/office-agent/hana-tool-adapter.ts');
const { isPublicOfficeAddress, officeWebUrl } = await import('../../src/main/office-agent/office-network.ts');
const { htmlToMarkdownDocument } = await import('../../src/main/office-agent/vendor/hana/lib/tools/web-reader.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(root, 'test-results/office-plan/hana-tools-'));
const workspace = path.join(output, 'workspace'); fs.mkdirSync(workspace);
fs.mkdirSync(path.join(workspace, '草稿')); fs.mkdirSync(path.join(workspace, '学生隐私'));
fs.writeFileSync(path.join(workspace, '会议纪要.txt'), '合成教研会议：本周备课完成12份。\n核验编号：HANA-TOOLS-2147');
fs.writeFileSync(path.join(workspace, '.env'), 'PRIVATE-ENV-SENTINEL');
fs.writeFileSync(path.join(workspace, '学生隐私/记录.txt'), 'PRIVATE-STUDENT-SENTINEL');
fs.writeFileSync(path.join(output, 'outside.txt'), 'OUTSIDE-SENTINEL');
const checks = [], external = [];
const report = { suite: 'hana-host-tools', success: false, checks, external,
  boundaries: ['Host module smoke; not production UI/IPC or OS sandbox', 'Local inputs and approval callbacks are synthetic', 'Optional external requests are real, report separately'] };
const make = extra => createHanaOfficeTools({ workspace, sessionId: 'test-session', runId: 'test-run',
  excludedRoots: [path.join(workspace, '学生隐私')], ...extra });
let id = 0; const invoke = (host, name, args, signal) => host.execute(name, `call-${++id}`, args, signal);
try {
  const host = make();
  const read = await invoke(host, 'office_read_text', { path: '会议纪要.txt' });
  assert.equal(read.success, true); assert.match(read.data.text, /12份/); assert.equal(read.data.source, '会议纪要.txt');
  const stat = await invoke(host, 'office_file_stat', { path: '会议纪要.txt' }); assert.equal(stat.success, true);
  assert.equal(stat.data.size, fs.statSync(path.join(workspace, '会议纪要.txt')).size);
  const listed = await invoke(host, 'office_list_files', { path: '.' }); assert.equal(listed.success, true);
  assert(listed.data.entries.some(item => item.name === '会议纪要.txt'));
  checks.push({ name: 'hana-real-file-read-stat-list-chinese-path', pass: true });
  for (const denied of ['../outside.txt', path.join(output, 'outside.txt'), '.env', '学生隐私/记录.txt']) {
    const result = await invoke(host, 'office_read_text', { path: denied }); assert.equal(result.success, false);
    assert(!JSON.stringify(result).includes('SENTINEL'));
  }
  checks.push({ name: 'workspace-privacy-boundary', pass: true });
  fs.symlinkSync(output, path.join(workspace, '外部链接'), 'junction');
  assert.equal((await invoke(host, 'office_read_text', { path: '外部链接/outside.txt' })).success, false);
  checks.push({ name: 'junction-escape-denied', pass: true });
  let accessed = 0; const evil = Object.defineProperty({}, 'path', { enumerable: true, get() { accessed++; return '.env'; } });
  assert.equal((await invoke(host, 'office_read_text', evil)).error.code, 'invalid_input'); assert.equal(accessed, 0);
  assert.equal((await invoke(host, 'office_read_text', { path: '会议纪要.txt', extra: true })).success, false);
  assert.equal((await invoke(host, 'shell', { path: '会议纪要.txt' })).success, false);
  checks.push({ name: 'snapshot-schema-and-unknown-tool-denied', pass: true });
  fs.writeFileSync(path.join(workspace, 'large.txt'), 'x'.repeat(65537));
  assert.equal((await invoke(host, 'office_read_text', { path: 'large.txt' })).error.code, 'too_large');
  fs.writeFileSync(path.join(workspace, 'binary.pdf'), Buffer.from([0, 255, 0]));
  assert.equal((await invoke(host, 'office_read_text', { path: 'binary.pdf' })).error.code, 'unsupported');
  checks.push({ name: 'bounded-and-binary-read-denied', pass: true });
  const denied = await invoke(host, 'office_copy_file', { source: '会议纪要.txt', target: '草稿/拒绝.txt' });
  assert.equal(denied.error.code, 'permission_denied'); assert(!fs.existsSync(path.join(workspace, '草稿/拒绝.txt')));
  checks.push({ name: 'unapproved-copy-zero-write', pass: true });
  let approvals = 0;
  const writable = make({ approveCopy: async approval => { approvals++; assert.equal(approval.sessionId, 'test-session');
    assert.equal(approval.runId, 'test-run'); assert.equal(approval.target, '草稿\\副本.txt'); return true; } });
  const args = { source: '会议纪要.txt', target: '草稿/副本.txt' };
  const copied = await writable.execute('office_copy_file', 'same-call', args);
  assert.equal(copied.success, true);
  assert.deepEqual(fs.readFileSync(path.join(workspace, '草稿/副本.txt')), fs.readFileSync(path.join(workspace, '会议纪要.txt')));
  assert.deepEqual(await writable.execute('office_copy_file', 'same-call', args), copied); assert.equal(approvals, 1);
  assert.equal((await writable.execute('office_copy_file', 'same-call', { ...args, target: '草稿/别的.txt' })).error.code, 'conflict');
  checks.push({ name: 'approved-copy-readback-idempotence', pass: true });
  const abort = new AbortController(); let reached; const waiting = new Promise(resolve => reached = resolve);
  let later; const waitingHost = make({ approveCopy: () => { reached(); return new Promise(resolve => later = resolve); } });
  const pending = invoke(waitingHost, 'office_copy_file', { source: '会议纪要.txt', target: '草稿/取消.txt' }, abort.signal);
  await waiting; abort.abort(); assert.equal((await pending).error.code, 'cancelled'); later(true);
  await new Promise(resolve => setImmediate(resolve)); assert(!fs.existsSync(path.join(workspace, '草稿/取消.txt')));
  checks.push({ name: 'cancel-pending-approval-and-late-approve-zero-write', pass: true });
  const conflictHost = make({ approveCopy: async () => { fs.appendFileSync(path.join(workspace, '会议纪要.txt'), '\nEXTERNAL-CHANGE'); return true; } });
  assert.equal((await invoke(conflictHost, 'office_copy_file', { source: '会议纪要.txt', target: '草稿/冲突.txt' })).error.code, 'conflict');
  assert(!fs.existsSync(path.join(workspace, '草稿/冲突.txt')));
  checks.push({ name: 'source-version-conflict-zero-write', pass: true });
  const originalCopy = fs.copyFileSync;
  const racingHost = make({ approveCopy: async () => true });
  try {
    fs.copyFileSync = (source, target, flags) => {
      fs.writeFileSync(target, 'CONCURRENT-FILE');
      return originalCopy(source, target, flags);
    };
    const collision = await invoke(racingHost, 'office_copy_file', { source: '会议纪要.txt', target: '草稿/并发.txt' });
    assert.equal(collision.error.code, 'conflict');
    assert.equal(fs.readFileSync(path.join(workspace, '草稿/并发.txt'), 'utf8'), 'CONCURRENT-FILE');
  } finally { fs.copyFileSync = originalCopy; }
  checks.push({ name: 'copy-exclusive-create-preserves-concurrent-target', pass: true });
  for (const value of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', '100.64.0.1', '224.0.0.1', '2001:db8::1']) assert.equal(isPublicOfficeAddress(value), false, value);
  assert.equal(isPublicOfficeAddress('1.1.1.1'), true); assert.equal(isPublicOfficeAddress('2606:4700:4700::1111'), true);
  for (const value of ['file:///C:/secret', 'https://user:pass@example.com/', 'http://[::1]/', 'https://example.com:3000/', 'http://localhost/']) assert.throws(() => officeWebUrl(value));
  const noNetwork = await invoke(host, 'office_web_fetch', { url: 'https://example.com/' }); assert.equal(noNetwork.error.code, 'permission_denied');
  const network = make({ networkAllowed: true, searchAllowed: true, dnsMode: 'cloudflare' });
  assert.equal((await invoke(network, 'office_web_fetch', { url: 'http://127.0.0.1/' })).error.code, 'permission_denied');
  assert.equal((await invoke(network, 'office_web_fetch', { url: 'https://example.com/', maxLength: 999999 })).error.code, 'invalid_input');
  checks.push({ name: 'network-ssrf-permission-and-output-boundary', pass: true });
  const page = await htmlToMarkdownDocument('<html><head><title>教研资料</title></head><body><nav>CHROME-SENTINEL</nav><article><h1>备课参考</h1><p>会议安排与公开资料。</p><a href="/source">来源</a><script>EXEC-SENTINEL</script></article></body></html>', 'https://example.com/');
  assert.doesNotMatch(page.content, /CHROME-SENTINEL|EXEC-SENTINEL/); assert.match(page.content, /https:\/\/example.com\/source/);
  checks.push({ name: 'hana-html-reader-no-script-and-source-links', pass: true });
  if (process.argv.includes('--live-network')) {
    for (const [tool, input] of [['office_web_fetch', { url: 'https://example.com/' }], ['office_web_search', { query: '教育部 义务教育课程方案 官方', maxResults: 3 }]]) {
      const result = await invoke(network, tool, input);
      const valid = result.success && (tool === 'office_web_fetch' ? result.data.text.length > 0 : result.data.results.length > 0);
      external.push({ tool, pass: valid, result });
      console.log(JSON.stringify({ phase: 'real-network', tool, pass: valid, error: result.error?.code }));
    }
  }
  report.success = checks.every(item => item.pass) && external.every(item => item.pass);
} catch (error) { report.error = String(error.stack).slice(0, 4000); }
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
if (process.versions.electron) globalThis.hanaToolsHostReport = { ...report, reportPath: path.join(output, 'report.json'),
  electron: process.versions.electron, node: process.versions.node };
console.log(JSON.stringify({ report: path.relative(root, path.join(output, 'report.json')), success: report.success, passed: checks.length, external: external.map(({ tool, pass }) => ({ tool, pass })), error: report.error }));
if (!report.success) process.exitCode = 1;
