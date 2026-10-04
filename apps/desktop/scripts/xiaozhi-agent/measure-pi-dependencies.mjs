import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(fs.readFileSync(path.join(appRoot, 'package-lock.json'), 'utf8')).packages;
const roots = ['@earendil-works/pi-coding-agent', '@earendil-works/pi-agent-core', '@earendil-works/pi-ai'];
const seen = new Set(), native = [], rows = [];
function resolve(owner, name) {
  let base = owner;
  while (base) {
    const candidate = `${base}/node_modules/${name}`;
    if (lock[candidate] && fs.existsSync(path.join(appRoot, candidate))) return candidate;
    const index = base.lastIndexOf('/node_modules/'); base = index < 0 ? '' : base.slice(0, index);
  }
  const candidate = `node_modules/${name}`;
  return lock[candidate] && fs.existsSync(path.join(appRoot, candidate)) ? candidate : null;
}
function size(dir, owner) {
  let bytes = 0;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.isSymbolicLink()) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) bytes += size(full, owner);
    else { bytes += fs.statSync(full).size; if (item.name.endsWith('.node')) native.push({ package: owner, file: path.relative(appRoot, full).replaceAll('\\', '/') }); }
  }
  return bytes;
}
function visit(key) {
  if (!key || seen.has(key)) return; seen.add(key);
  const metadata = lock[key];
  rows.push({ path: key, version: metadata.version, license: metadata.license || 'see-package-license', installedBytes: size(path.join(appRoot, key), key) });
  for (const name of Object.keys({ ...metadata.dependencies, ...metadata.optionalDependencies })) visit(resolve(key, name));
}
for (const name of roots) visit(resolve('', name));
const report = { scope: 'Installed Pi production dependency closure, including shared packages; not incremental installer growth',
  measuredAt: new Date().toISOString(), platform: process.platform, arch: process.arch, packages: rows.length,
  totalBytes: rows.reduce((sum, row) => sum + row.installedBytes, 0), nativeBindings: native, entries: rows.sort((a, b) => a.path.localeCompare(b.path)) };
fs.writeFileSync(path.join(appRoot, '../../third_party/pi/dependency-footprint.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ packages: report.packages, totalBytes: report.totalBytes, nativeBindings: native }));
