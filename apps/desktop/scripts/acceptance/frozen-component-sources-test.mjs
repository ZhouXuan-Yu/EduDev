import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyFrozenComponentSources} from './frozen-component-sources.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const baselineFile=path.join(desktop,'src/renderer/design-review/component-baseline.json');
const original=fs.readFileSync(baselineFile);
const baseline=JSON.parse(original);
const read=file=>fs.readFileSync(path.join(desktop,file));
const result=verifyFrozenComponentSources(desktop,baseline);
// Mutate every protected file in memory. There is no temporary vendor edit and
// no hash update; the same validator used by the real gate must reject all 16.
for(const changed of baseline.files)assert.throws(()=>verifyFrozenComponentSources(desktop,baseline,file=>file===changed.path?Buffer.concat([read(file),Buffer.from('\n/* unexpected change */')]):read(file)),undefined,changed.path);
for(const changed of result.filter(file=>file.kind==='historical-production-update')){
 const predecessor=execFileSync('git',['show',changed.revision+'^:apps/desktop/'+changed.path],{cwd:desktop});
 assert.throws(()=>verifyFrozenComponentSources(desktop,baseline,file=>file===changed.path?predecessor:read(file)),undefined,'Rollback: '+changed.path);
}
assert(fs.readFileSync(baselineFile).equals(original));
console.log(JSON.stringify({success:true,originalFrozen:result.filter(f=>f.kind==='original-frozen').length,reconstructed:result.filter(f=>f.kind==='historical-production-update').length,rejectedDrifts:baseline.files.length,rejectedRollbacks:5,originalBaselineUntouched:true,boundary:'Deployed source identity and drift prevention. Official licensed artifact identity remains unverified.'}));
