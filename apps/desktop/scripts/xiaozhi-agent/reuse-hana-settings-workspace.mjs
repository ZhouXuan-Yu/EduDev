import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = 'D:/WorkProject/开源/openhanako', destination = path.resolve('src/renderer/components/office/hana-settings');
const sha = value => createHash('sha256').update(value).digest('hex');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
assert.equal(version, '0.449.0');
const outputs = [], records = [];
for (const name of ['SettingsRow.tsx', 'SettingsSection.tsx']) {
  const source = `desktop/src/react/settings/components/${name}`, bytes = fs.readFileSync(path.join(root, source));
  outputs.push([name, bytes]); records.push({ source, sourceSha256: sha(bytes), output: name, outputSha256: sha(bytes), adaptation: 'Exact complete file; existing SettingsPrimitives and CSS dependencies retained' });
}
const searchPath = 'desktop/src/react/settings/settings-search-index.ts', search = fs.readFileSync(path.join(root, searchPath), 'utf8');
const ast = ts.createSourceFile(searchPath, search, ts.ScriptTarget.Latest, true);
const names = ['SettingsSearchNavItem', 'SettingsSearchEntry', 'SettingsSearchResult', 'Translate', 'normalizeSearchText', 'translated', 'scoreCandidate', 'searchSettings'];
const nodes = names.map(name => ast.statements.find(node => node.name?.text === name));
assert(nodes.every(Boolean));
const searchOutput = '// Hana 0.449.0 Apache-2.0; exact AST extraction. See workspace-source.json.\n' + nodes.map(node => node.getText(ast)).join('\n\n') + '\n';
outputs.push(['settings-search.ts', searchOutput]); records.push({ source: searchPath, sourceSha256: sha(search), output: 'settings-search.ts', outputSha256: sha(searchOutput), adaptation: 'Exact types and normalization/ranking/search functions; excluded unsupported Hana built-in settings data and builder' });
const cssPath = 'desktop/src/react/settings/Settings.module.css', css = fs.readFileSync(path.join(root, cssPath), 'utf8');
const selected = new Set(['settings-search-results', 'settings-search-results-title', 'settings-search-result', 'settings-search-result:hover', 'settings-search-result-title', 'settings-search-result-path', 'settings-search-empty', 'settings-nav-item', 'settings-nav-item svg', 'settings-nav-item.active svg', 'settings-nav-item:hover', 'settings-nav-item.active']);
const rules = [...css.matchAll(/\.([^{}]+)\{([^{}]*)\}/g)].filter(match => selected.has(match[1].trim()));
assert.equal(rules.length, selected.size);
const cssOutput = '/* Hana 0.449.0 Apache-2.0; exact selected navigation/search rules. See workspace-source.json. */\n' + rules.map(match => match[0]).join('\n\n') + '\n';
outputs.push(['workspace-nav.module.css', cssOutput]); records.push({ source: cssPath, sourceSha256: sha(css), output: 'workspace-nav.module.css', outputSha256: sha(cssOutput), adaptation: 'Exact navigation/search-result rules; local tokens and layout live in pi-settings-workspace.css, no Hana store or image assets' });
const license = fs.readFileSync(path.join(root, 'LICENSE'));
assert.equal(sha(license), sha(fs.readFileSync(path.join(destination, 'LICENSE'))));
const manifest = { version, license: 'Apache-2.0', licenseSha256: sha(license), records };
if (process.argv.includes('--verify')) {
  for (const [name, bytes] of outputs) assert.equal(sha(fs.readFileSync(path.join(destination, name))), sha(bytes));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'workspace-source.json'), 'utf8')), manifest);
} else {
  for (const [name, bytes] of outputs) fs.writeFileSync(path.join(destination, name), bytes);
  fs.writeFileSync(path.join(destination, 'workspace-source.json'), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(JSON.stringify({ success: true, checks: outputs.length + 1, boundary: 'Static provenance only', version }));
