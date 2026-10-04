import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = 'D:/WorkProject/开源/openhanako', relative = 'core/session-compaction-runtime.ts';
const original = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
const ast = ts.createSourceFile(relative, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const get = name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!node) throw new Error(`Missing Hana function: ${name}`); return node.getText(ast);
};
let wrapper = get('installMidRunCompaction');
const replace = (from, to) => { if (!wrapper.includes(from)) throw new Error('Hana source changed'); wrapper = wrapper.replace(from, to); };
replace('runCompaction: deps.runCompaction ?? runCachePreservingCompactionForSession,', 'runCompaction: deps.runCompaction ?? (() => { throw new Error("configuration"); }),');
replace('await maybeCompactMidRun(session, turn, signal, resolved)', 'Boolean(await resolved.runCompaction(session, { turn: { ...turn, context: snapshot?.context ?? turn?.context }, signal }))');
const output = `// Hana 0.449.0, Apache-2.0. AST-extracted runtime seam; see source-manifest.json.\n// Education host owns full-request admission and injects native compaction.\nexport const MIN_COMPACTION_RESERVE_TOKENS = 16_384;\nconst COMPACTION_RESERVE_RATIO = 0.1;\nconst MIDRUN_COMPACTION_INSTALLED = Symbol("hanaMidRunCompaction");\n\n${get('computeCompactionReserveTokens')}\n\n${wrapper}\n`;
const destination = path.join(appRoot, 'src/main/xiaozhi-agent/vendor/hana/core/session-compaction-runtime.ts');
fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output);
const manifestPath = path.join(appRoot, 'src/main/xiaozhi-agent/vendor/hana/source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
manifest.rows = manifest.rows.filter(row => row.path !== relative);
manifest.rows.push({ sourceRoot, path: relative, sourceSha256: hash(original), outputSha256: hash(output), adaptations: [
  'AST extraction of proportional reserve and native prepareNextTurnWithContext wrapper',
  'Required injected compaction callback replaces cache/persona dependency closure',
  'Education host checks complete request and propagates failures instead of swallowing unsafe continuation',
] });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ source: relative, sourceSha256: hash(original), outputSha256: hash(output) }));
