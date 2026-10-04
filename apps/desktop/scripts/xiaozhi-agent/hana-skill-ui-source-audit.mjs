import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(desktop, 'src/renderer/components/office/hana-skills');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json'), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const row of manifest.files) {
  assert.equal(hash(path.join(manifest.source, row.upstream)), row.sourceSha256);
  assert.equal(hash(path.join(root, row.file)), row.outputSha256);
}
const cssRoot = path.join(desktop, 'src/renderer/heroui-pro'), css = JSON.parse(fs.readFileSync(path.join(cssRoot, 'heroui-oss-source.json'), 'utf8'));
assert.equal(hash(path.join(desktop, css.source)), css.sha256);
assert.equal(hash(path.join(cssRoot, css.output)), css.sha256);
assert(!fs.readFileSync(path.join(cssRoot, css.output), 'utf8').includes('@apply'));
const report = { success: true, hanaUi: manifest.files.length, officialCss: 1, bytes: css.bytes, license: manifest.license };
fs.writeFileSync(path.join(desktop, 'test-results/xiaozhi-agent/hana-skill-ui-source-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
