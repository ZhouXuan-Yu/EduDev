// Explicit sources and safe metrics only; never copy configuration or native data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sha256} from '../acceptance/evidence.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),root=path.resolve(desktop,'../..');
const base=fs.realpathSync(path.join(desktop,'test-results/xiaozhi-agent')),output=fs.realpathSync(process.argv[2]);assert(output.startsWith(base+path.sep)&&path.basename(output).startsWith('pi-saved-credential-tools-'));
const target=path.join(root,'docs/design/codex-2026-10-03/p07-saved-credential-tools-final');assert(!fs.existsSync(target),'Keep previous archives immutable');
const report=JSON.parse(fs.readFileSync(path.join(output,'report.json'))),readback=JSON.parse(fs.readFileSync(path.join(output,'readback.json')));assert(report.success&&readback.success&&report.checks.length===15&&report.checks.every(c=>c.pass));
const files=['1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','测试样例说明书.md','docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md','docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md','docs/35_XIAZHI_OFFICE_AGENT_TODO.md','docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md','docs/162_PI_SAVED_CREDENTIAL_TOOL_FLOW_CONTRACT.md','docs/163_PI_SAVED_CREDENTIAL_TOOL_FLOW_ACCEPTANCE.md','docs/testing/本轮执行记录_2026_10_04.md',
  ...['model-settings.ts','model-settings-api.ts','model-settings-state.ts','public-image-runtime.ts'].map(n=>'apps/desktop/src/main/xiaozhi-agent/'+n),
  'apps/desktop/src/shared/xiaozhi-settings.ts','apps/desktop/src/renderer/components/office/PiModelSettings.tsx',
  ...['pi-saved-credential-tools-ui-smoke.mjs','pi-saved-credential-readback.mjs','archive-saved-credential-tools.mjs'].map(n=>'apps/desktop/scripts/xiaozhi-agent/'+n)];
// Validate every source and credential scan before creating the archive.
const sources=files.map(file=>{const bytes=fs.readFileSync(path.join(root,file));assert(!/sk-[a-zA-Z0-9]{16,}/.test(bytes.toString()),'Credential refused: '+file);return{file:'source/'+file,bytes};});
const safe={directory:path.basename(output),success:report.success,checks:report.checks,layer:report.layer,humanAccepted:false,build:report.build,scriptSha256:report.scriptSha256,transports:report.transports,freshUnsupportedCapability:report.freshUnsupportedCapability,previousFailures:report.previousFailures.map(f=>({...f,error:f.error?.split('\n')[0]})),boundary:report.boundary};
sources.push({file:'evidence/formal-ui.json',bytes:Buffer.from(JSON.stringify(safe,null,2)+'\n')});
sources.push({file:'evidence/readonly-metrics.json',bytes:fs.readFileSync(path.join(output,'readback.json'))});
sources.push({file:'evidence/readonly-first-failure.json',bytes:fs.readFileSync(path.join(output,'readback-first-failure.json'))});
sources.push({file:'evidence/archive-first-failure.json',bytes:fs.readFileSync(path.join(output,'archive-first-failure.json'))});
for(const {file,bytes}of sources){const text=bytes.toString();assert(!/sk-[a-zA-Z0-9]{16,}/.test(text)&&!/data:image\/[a-z]+;base64,[a-zA-Z0-9+/]{256}/.test(text),'Payload refused: '+file);}
const entries=[];for(const {file,bytes}of sources){const location=path.resolve(target,file);assert(location.startsWith(target+path.sep));fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,bytes,{flag:'wx'});entries.push({file,bytes:bytes.length,sha256:sha256(bytes)});}
fs.writeFileSync(path.join(target,'archive-manifest.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),files:entries,boundary:'Explicit source/docs and safe CFG/C/cache metrics only. No credentials/ciphertexts/profile/DB/native/media/build. Complete Codex goal not accepted.'},null,2)+'\n',{flag:'wx'});
for(const entry of entries)assert.equal(sha256(fs.readFileSync(path.join(target,entry.file))),entry.sha256);
console.log(JSON.stringify({success:true,files:entries.length,target}));
