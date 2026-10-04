import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve('../..'),target=path.join(root,'docs/design/codex-2026-10-03/p07-goal-native');
assert(!fs.existsSync(target),'Earlier evidence must remain immutable');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),entries=[];
const add=(name,bytes)=>{assert(!/sk-[a-zA-Z0-9]{16,}/.test(bytes.toString()),'Possible key');assert(!/data:image\/[a-z]+;base64,[a-zA-Z0-9+/]{256}/.test(bytes.toString()),'Image payload');const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});entries.push({file:name,bytes:bytes.length,sha256:sha(bytes)});};
const source=['1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md','docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md','docs/35_XIAZHI_OFFICE_AGENT_TODO.md','docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md','docs/154_PI_PERSISTENT_GOAL_NATIVE_CONTRACT.md','docs/155_PI_PERSISTENT_GOAL_NATIVE_ACCEPTANCE.md','apps/desktop/scripts/xiaozhi-agent/pi-goal-native-preflight.mjs','apps/desktop/scripts/xiaozhi-agent/goal-native-source.lock.json','apps/desktop/scripts/xiaozhi-agent/archive-goal-native.mjs'];
const output=path.resolve('test-results/xiaozhi-agent/pi-goal-native-E6W1SV'),report=JSON.parse(fs.readFileSync(path.join(output,'report.json')));
assert(report.success&&report.checks.length===19&&report.checks.every(c=>c.pass));
assert.equal(report.scriptSha256,sha(fs.readFileSync('scripts/xiaozhi-agent/pi-goal-native-preflight.mjs')));
assert.equal(report.sourceLockSha256,sha(fs.readFileSync('scripts/xiaozhi-agent/goal-native-source.lock.json')));
for(const name of source)add('source/'+name,fs.readFileSync(path.join(root,name)));
for(const item of report.sources){const bytes=fs.readFileSync(path.join(output,'source',item.file));assert.equal(sha(bytes),item.sha256);add('upstream/'+item.file,bytes);}
add('evidence/report.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
fs.writeFileSync(path.join(target,'archive-manifest.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),files:entries,boundary:'Original source/license and explicit script/doc/report allowlist only; no native, DB, keys, profile, raw materials or binaries. Source/A/B preflight; production E NOT implemented, full objective NOT_ACCEPTED.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({success:true,files:entries.length,target}));
