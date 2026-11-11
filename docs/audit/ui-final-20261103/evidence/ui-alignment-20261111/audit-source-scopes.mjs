import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {sha256} from '../../scripts/acceptance/evidence.mjs';

const root = path.resolve(import.meta.dirname,'../../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(import.meta.dirname,name)));
const scopes = [
  {owner:'shell-home-paper',files:read('sol/static-check-current.json').changed},
  {owner:'materials',files:read('library-sol/static-check.json').sourceFiles},
  {owner:'students-settings',files:[...read('student-settings-sol/static-check.json').files,
    ...read('student-settings-sol/repair1-static-check.json').files,
    ...read('student-settings-sol/repair2-static-check.json').files]},
  {owner:'teaching',files:read('teaching-sol/static-check.json').files},
  {owner:'startup',files:read('library-sol/startup-R1-static.json').files},
  {owner:'checker-dependencies',files:read('library-sol/startup-R2-static.json').files},
];
const startupPaths = new Set([
  'apps/desktop/src/main/office-agent/hana-tool-adapter.ts',
  'apps/desktop/src/main/xiaozhi-agent/checks/structure.ts',
]);
const checkerPaths = new Set([
  'apps/desktop/src/shared/office-relative-path.ts',
  'apps/desktop/src/shared/xiaozhi-office-artifacts.ts',
  'apps/desktop/src/shared/xiaozhi-delivery-checks.ts',
]);
const allowed = new Map();
for (const scope of scopes) {
  for (const file of scope.files) {
    const name = file.path || file.file;
    assert.equal(typeof name,'string');
    const inScope = scope.owner === 'startup' ? startupPaths.has(name)
      : scope.owner === 'checker-dependencies' ? checkerPaths.has(name)
        : name.startsWith('apps/desktop/src/renderer/');
    assert.ok(inScope,name);
    assert.ok(!allowed.has(name) || allowed.get(name).owner===scope.owner,'Overlapping production ownership '+name);
    allowed.set(name,{owner:scope.owner,...file,path:name});
  }
}
const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const changed = [...new Set([
  ...git('diff','HEAD','--name-only','--','apps/desktop/src'),
  ...git('ls-files','--others','--exclude-standard','--','apps/desktop/src'),
])];
const unexpected = changed.filter(file=>!allowed.has(file));
for (const file of allowed.values()) {
  assert.equal(sha256(fs.readFileSync(path.join(root,file.path))),file.sha256,'Writer manifest changed '+file.path);
}
const report = {rendererBaseline:'87a7f9d',integrationHead:git('rev-parse','HEAD')[0],sourceFiles:changed.length,declaredFiles:allowed.size,unexpected,
  files:changed.map(file=>allowed.get(file)),meaning:'Ownership and exact writer-source hashes only. Runtime and visual acceptance are separate.'};
fs.writeFileSync(path.join(import.meta.dirname,'source-scope-audit.json'),JSON.stringify(report,null,2));
assert.deepEqual(unexpected,[],'Unassigned production changes');
assert.equal(changed.length,allowed.size,'Declared source set must match actual writes');
console.log(JSON.stringify({sourceFiles:changed.length,declaredFiles:allowed.size,unexpected}));
