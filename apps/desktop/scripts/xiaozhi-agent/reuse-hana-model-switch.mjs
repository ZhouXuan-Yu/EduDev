import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const sourceRoot = 'D:/WorkProject/开源/openhanako';
const sourceFile = path.join(sourceRoot, 'core/session-coordinator.ts');
const destination = path.resolve('src/main/xiaozhi-agent/vendor/hana/core/model-switch-context.ts');
const manifestFile = path.resolve('src/main/xiaozhi-agent/vendor/hana/model-switch-source-manifest.json');
const source = fs.readFileSync(sourceFile, 'utf8');
const ast = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
const helper = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createModelContextTooLargeError');
assert(helper);
let switchNode;
function visit(node) { if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'switchSessionModel') switchNode = node; ts.forEachChild(node, visit); }
visit(ast); assert(switchNode?.body);
const statements = switchNode.body.statements.find(node => ts.isTryStatement(node))?.tryBlock.statements;
assert(statements);
const begin = statements.findIndex(node => node.getText(ast).startsWith('const msgs'));
const end = statements.findIndex(node => node.getText(ast).startsWith('await session.setModel'));
assert(begin >= 0 && end > begin);
const guard = statements.slice(begin, end).map(node => node.getText(ast)).join('\n');
const output = '// Hana 0.449.0 Apache-2.0. AST extraction; see model-switch-source-manifest.json.\n'
  + '// Adaptation: stable education error replaces Hana i18n; no coordinator/cache/persona imports.\n'
  + 'import { estimateTokens } from "@earendil-works/pi-coding-agent";\n'
  + 'const t = (_key: string) => "context_limit";\nconst MODEL_CONTEXT_TOO_LARGE_CODE = "MODEL_CONTEXT_TOO_LARGE";\n'
  + helper.getText(ast) + '\n\nexport function assertHanaModelSwitchContext(session: { agent?: { state?: { messages?: Parameters<typeof estimateTokens>[0][] } }; getContextUsage?: () => any }, newModel: { contextWindow: number }): void {\n' + guard + '\n}\n';
const sha256 = content => createHash('sha256').update(content).digest('hex');
const license = fs.readFileSync(path.join(sourceRoot, 'LICENSE'));
const vendoredLicense = fs.readFileSync('../../third_party/openhanako/LICENSE');
assert.equal(sha256(license), sha256(vendoredLicense));
const evidence = { version: JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8')).version,
  license: 'Apache-2.0', source: sourceFile.replaceAll('\\','/'), sourceSha256: sha256(source),
  output: 'core/model-switch-context.ts', outputSha256: sha256(output), licenseSha256: sha256(license),
  adaptations: ['AST extract createModelContextTooLargeError and context admission before native setModel',
    'Hana i18n replaced by fixed context_limit; estimateTokens uses already locked Pi 0.80.3',
    'Durable education SQLite/native recovery is separate host code; no copied Persona or coordinator authority'] };
assert.equal(evidence.version, '0.449.0');
if (process.argv.includes('--verify')) {
  assert.equal(fs.readFileSync(destination, 'utf8'), output);
  assert.deepEqual(JSON.parse(fs.readFileSync(manifestFile,'utf8')), evidence);
} else { fs.writeFileSync(destination, output); fs.writeFileSync(manifestFile, JSON.stringify(evidence,null,2)+'\n'); }
console.log(JSON.stringify({ success: true, checks: 3, sourceSha256: evidence.sourceSha256, outputSha256: evidence.outputSha256, boundary: 'Static provenance only' }));
