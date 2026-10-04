// Fixed, already inspected upstream source; no automatic network update.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reference = path.join(appRoot, 'test-results/office-plan/references/codex-plugin-cc');
const source = JSON.parse(fs.readFileSync(path.join(reference, 'source.json'), 'utf8'));
if (source.sha !== 'db52e28f4d9ded852ab3942cea316258ae4ef346') throw new Error('Review upstream changes before vendoring');
const original = fs.readFileSync(path.join(reference, 'plugins__codex__scripts__lib__app-server.mjs'), 'utf8');
const parsed = ts.createSourceFile('app-server.mjs', original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = ['buildJsonRpcError', 'createProtocolError', 'AppServerClientBase', 'SpawnedCodexAppServerClient'];
let code = names.map(name => {
  const node = parsed.statements.find(item => item.name?.text === name);
  if (!node) throw new Error(`Upstream symbol missing: ${name}`);
  return node.getText(parsed);
}).join('\n\n');
code = code.replace('class SpawnedCodexAppServerClient', 'export class SpawnedCodexAppServerClient')
  .replace('this.proc = spawn("codex", ["app-server"], {', 'this.proc = spawn(this.options.binaryPath, ["app-server", "--listen", "stdio://"], {')
  .replace('env: this.options.env ?? process.env,', 'env: this.options.env,')
  .replace('shell: process.platform === "win32" ? (process.env.SHELL || true) : false,', 'shell: false,')
  .replace('this.stderr += chunk;', 'this.stderr = (this.stderr + chunk).slice(-8192);')
  .replace('this.proc.stdout.setEncoding("utf8");', 'this.proc.stdin.on("error", (error) => this.handleExit(error));\n    this.proc.stdout.setEncoding("utf8");')
  .replace('`Failed to parse codex app-server JSONL: ${error.message}`, { line }', '"Malformed app-server JSONL"')
  .replace('this.readline = readline.createInterface({ input: this.proc.stdout });\n    this.readline.on("line", (line) => {\n      this.handleLine(line);\n    });',
    'this.proc.stdout.on("data", (chunk) => {\n      if (this.lineBuffer.length + chunk.length > 4 * 1024 * 1024) { this.handleExit(new Error("App-server JSONL bound exceeded")); return; }\n      this.handleChunk(chunk);\n    });')
  .replace('this.sendMessage({ id, method, params });', 'try { this.sendMessage({ id, method, params }); } catch (error) { this.pending.delete(id); reject(error); }');
const header = `// @ts-nocheck
// OpenAI codex-plugin-cc ${source.sha}, Apache-2.0.
// Mechanically extracted transport classes; adaptations in source-manifest.json.
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
const DEFAULT_CLIENT_INFO = { name: 'xiaozhi_office', title: '小智', version: '0.1.0' };
const DEFAULT_CAPABILITIES = { experimentalApi: true, requestAttestation: false,
  optOutNotificationMethods: ['item/reasoning/textDelta','item/reasoning/summaryTextDelta','item/reasoning/summaryPartAdded'] };
function terminateProcessTree(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid owned PID');
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
}
`;
const destination = path.join(appRoot, 'src/main/office-agent/vendor/official-client'); fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'transport.ts'), header + code + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
fs.writeFileSync(path.join(destination, 'source-manifest.json'), JSON.stringify({ repository: source.repository,
  commit: source.sha, upstreamPath: 'plugins/codex/scripts/lib/app-server.mjs', license: 'Apache-2.0',
  sourceSha256: hash(original), extractedSymbols: names, vendoredSha256: hash(header + code + '\n'),
  adaptations: ['private native binary/env; no shell or broker', 'streaming enabled; private reasoning notifications opt-out',
    'bounded stderr/chunk buffer; malformed line content omitted; stdin errors disconnect', 'owned-PID shutdown helper', 'send failure removes pending request', 'upstream implicit types retained; strict facade'] }, null, 2));
const licenseRoot = path.resolve(appRoot, '../../third_party/codex-plugin-cc');fs.mkdirSync(licenseRoot, { recursive: true });
fs.copyFileSync(path.join(reference, 'LICENSE'), path.join(licenseRoot, 'LICENSE'));
fs.writeFileSync(path.join(licenseRoot, 'README.md'), `# Official app-server transport reuse\n\nOpenAI codex-plugin-cc, commit ${source.sha}, Apache-2.0. See src/main/office-agent/vendor/official-client/source-manifest.json and docs/45–46.\n`);
console.log(JSON.stringify({ commit: source.sha, symbols: names.length }));
