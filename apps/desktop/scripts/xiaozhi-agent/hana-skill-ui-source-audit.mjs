import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(desktop, 'src/renderer/components/office/hana-skills');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json'), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Adapted text is tracked by Git with LF. Windows checkout CRLF is not a
// component change; upstream and official vendored CSS remain byte-exact below.
const adaptedTextHash = file => createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
for (const row of manifest.files) {
  assert.equal(hash(path.join(manifest.source, row.upstream)), row.sourceSha256);
  assert.equal(adaptedTextHash(path.join(root, row.file)), row.outputSha256);
}
for (const row of manifest.hostStyles || []) {
  const file = path.resolve(desktop, row.file);
  assert(file.startsWith(path.join(desktop, 'src/renderer/ui-system') + path.sep), 'Host CSS must remain in the application UI boundary');
  assert.equal(adaptedTextHash(file), row.sha256);
}
const cssRoot = path.join(desktop, 'src/renderer/heroui-pro'), css = JSON.parse(fs.readFileSync(path.join(cssRoot, 'heroui-oss-source.json'), 'utf8'));
assert.equal(hash(path.join(desktop, css.source)), css.sha256);
const official = fs.readFileSync(path.join(desktop, css.source));
const output = fs.readFileSync(path.join(cssRoot, css.output));
const checkout = Buffer.from(official.toString('utf8').replace(/\r?\n/g, '\r\n'));
assert(output.equals(official) || output.equals(checkout), 'Official CSS must match exact source bytes or its exact Git Windows newline checkout');
assert(!fs.readFileSync(path.join(cssRoot, css.output), 'utf8').includes('@apply'));
const report = { success: true, hanaUi: manifest.files.length, hostStyles: manifest.hostStyles?.length || 0, officialCss: 1, officialCssSourceSha256: css.sha256, officialCssOutputSha256: hash(path.join(cssRoot, css.output)), officialCssCheckout: output.equals(official) ? 'byte-identical' : 'exact-git-windows-newlines', bytes: css.bytes, license: manifest.license };
fs.writeFileSync(path.join(desktop, 'test-results/xiaozhi-agent/hana-skill-ui-source-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
