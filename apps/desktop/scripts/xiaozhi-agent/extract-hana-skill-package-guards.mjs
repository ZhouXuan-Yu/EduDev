// Reviewed, bounded extraction; never imports upstream installation side effects.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = 'D:/WorkProject/开源/openhanako', sourcePath = 'lib/skills/skill-package-installer.ts';
const original = fs.readFileSync(path.join(sourceRoot, sourcePath), 'utf8');
const ast = ts.createSourceFile(sourcePath, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['SAFE_SKILL_NAME', 'SkillInstallError', 'sanitizeSkillName', 'assertInstallTargetInsideRoot'];
const selected = ast.statements.filter(node => names.includes(node.name?.text || node.declarationList?.declarations[0]?.name?.text));
if (selected.length !== names.length) throw new Error('Unexpected upstream AST');
const output = '// @ts-nocheck\n// Source: Hana 0.449.0, Apache-2.0. Independent guards only; see source-manifest.json.\nimport path from "node:path";\n\n'
  + selected.map(node => node.getText(ast)).join('\n\n') + '\n\nexport { assertInstallTargetInsideRoot };\n';
const vendor = path.join(root, 'src/main/xiaozhi-agent/vendor/hana');
fs.writeFileSync(path.join(vendor, sourcePath), output);
const manifestPath = path.join(vendor, 'source-manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const entry = { sourceRoot, path: sourcePath, sourceSha256: hash(original), outputSha256: hash(output), adaptations: [
  'AST extraction: safe name and destination containment guards plus error type only',
  'Main adds bounded no-link package read and immutable fresh-version publication; no archive/network/overwrite installer',
] };
manifest.rows = [...manifest.rows.filter(row => row.path !== sourcePath), entry];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ copied: names, sourceSha256: entry.sourceSha256, outputSha256: entry.outputSha256 }));
