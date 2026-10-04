// Reuse reviewed Hana runtime boundaries; do not import its entire Engine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const primary = 'D:/WorkProject/开源/openhanako', supplemental = 'D:/WorkProject/开源/openhanako-0.449.0';
const folder = path.join(root, 'src/main/xiaozhi-agent/vendor/hana');
const hash = value => createHash('sha256').update(value).digest('hex');
const rows = [];
function reuse(sourceRoot, relative, transform = value => value, adaptations = []) {
  const original = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
  const output = '// @ts-nocheck\n// Hana 0.449.0, Apache-2.0; provenance in source-manifest.json.\n' + transform(original);
  const target = path.join(folder, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, output);
  rows.push({ sourceRoot, path: relative, sourceSha256: hash(original), outputSha256: hash(output), adaptations });
}
function extract(original, relative, names) {
  const parsed = ts.createSourceFile(relative, original, ts.ScriptTarget.Latest, true);
  return names.map(name => {
    const item = parsed.statements.find(node => node.name?.text === name
      || (ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => decl.name.getText(parsed) === name)));
    if (!item) throw new Error(`Missing Hana symbol ${name}`);
    return item.getText(parsed);
  }).join('\n\n');
}
reuse(primary, 'lib/pi-sdk/session-options.ts', original =>
  `export const PI_CODING_AGENT_VERSION = '0.80.3';\nconst getPiCodingAgentVersion = () => PI_CODING_AGENT_VERSION;\n` + extract(original, 'session-options.ts', [
    'PI_BUILTIN_TOOL_NAMES', 'isPiSdkNameAllowlistVersion', 'assertAgentTool', 'getToolDefinitionName',
    'stableJson', 'normalizeToolCallId', 'pickAssistantMessageId', 'toolExecutionKey', 'createToolExecutionOnceState',
    'wrapToolDefinitionExecutionOnce', 'agentToolToToolDefinition', 'uniqueToolNames', 'normalizeCreateAgentSessionOptions',
  ]), ['AST extraction; fixed SDK version instead of import.meta/global module discovery']);
reuse(primary, 'lib/session-execution-registry.ts', original => extract(original, 'session-execution-registry.ts', [
  'nonEmptyText', 'combinedSignal', 'SessionExecutionRegistry',
]), ['AST extraction of explicit sessionId cancellation registry; excludes Hana path-discovery wrapper']);
reuse(primary, 'lib/pi-sdk/tool-outcome-adapter.ts');
reuse(supplemental, 'shared/tool-outcome.ts');
reuse(primary, 'lib/pi-sdk/stream-guard.ts');
reuse(primary, 'lib/tool-protocol-sanitizer.ts');
fs.writeFileSync(path.join(folder, 'source-manifest.json'), JSON.stringify({ version: '0.449.0', license: 'Apache-2.0', rows }, null, 2));
const licenseDir = path.resolve(root, '../../third_party/pi'); fs.mkdirSync(licenseDir, { recursive: true });
fs.copyFileSync(path.join(root, 'test-results/office-plan/references/pi-0.80.3/LICENSE'), path.join(licenseDir, 'LICENSE'));
fs.writeFileSync(path.join(licenseDir, 'README.md'), '# Pi SDK\n\nMIT, exact 0.80.3; reference commit a23abe4a695df8b69b613f73e9fdda2a8af894d4. See docs/48–51. SDK embedding uses custom education identity/tools, not the CLI entry.\n');
console.log(JSON.stringify({ suite: 'hana-runtime-vendor', files: rows.length }));
