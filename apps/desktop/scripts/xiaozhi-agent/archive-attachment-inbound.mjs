import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const desktop=process.cwd(),repo=path.resolve(desktop,'../..'),target=path.join(repo,'docs/design/codex-2026-10-03/p07-attachment-inbound');
assert(!fs.existsSync(target),'Immutable archive already exists');
const env=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const credentials=[...env.matchAll(/(?:^|\n)[A-Z_]*(?:KEY|TOKEN|SECRET)\s*=\s*([^\r\n]+)/g)].map(v=>v[1].trim().replace(/^['"]|['"]$/g,'')).filter(v=>v.length>12);
const safe=bytes=>{for(const key of credentials)assert(!bytes.includes(Buffer.from(key)),'Credential in public artifact');assert(!/\bsk-[A-Za-z0-9]{24,}\b/.test(bytes.toString('utf8')),'API key in public artifact');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),entries=[],runtime=[],pending=[];
const enqueue=(source,file)=>{
 const bytes=fs.readFileSync(source);safe(bytes);const destination=path.join(target,file),relative=path.relative(target,destination);
 assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert(!pending.some(v=>v.destination===destination));pending.push({bytes,destination});
 entries.push({source:path.relative(repo,source).replaceAll('\\','/'),file,bytes:bytes.length,sha256:sha(bytes)});
};
const results=path.join(desktop,'test-results/xiaozhi-agent');
for(const name of ['p07d2a-source-audit.json','p07d2a-native5.log','p07d2a-d1-foundation.log','p07d2a-d1-native.log',
 'p07d2a-renderer.log','p07d2a-main-smoke.log','p07d2a-build1.log','p07d2a-native1.log','p07d2a-native2.log','p07d2a-native3.log'])
 enqueue(path.join(results,name),'gates/'+name);
for(const dir of ['pi-attachment-import-native-WDTtST','pi-attachment-foundation-AWwkO3','pi-attachment-native-6t3Fug'])
 enqueue(path.join(results,dir,'report.json'),dir+'/report.json');
for(const dir of ['pi-attachment-import-native-eMT0EB','pi-attachment-import-native-nazLgS'])
 enqueue(path.join(results,dir,'report.json'),'failed/'+dir+'/report.json');
enqueue(path.join(results,'pi-attachment-import-native-0ikops','worker.log'),'failed/pi-attachment-import-native-0ikops/worker.log');
for(const file of ['docs/132_PI_ATTACHMENT_ENTRY_DELIVERY_CONTRACT.md','docs/133_PI_ATTACHMENT_INBOUND_FOUNDATION_ACCEPTANCE.md',
 '1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md',
 'docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md','docs/35_XIAZHI_OFFICE_AGENT_TODO.md','docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md'])
 enqueue(path.join(repo,file),'references/'+path.basename(file));
for(const file of ['src/main/xiaozhi-agent/vendor/hana/lib/session-files/inbound-filenames.source.json',
 'src/main/xiaozhi-agent/vendor/hana/lib/session-files/LICENSE','src/renderer/heroui-pro/README.md'])
 enqueue(path.join(desktop,file),'references/'+(file.endsWith('/LICENSE')?'Hana.LICENSE':path.basename(file)));
const files=['src/main/xiaozhi-agent/attachment-import-state.ts','src/main/xiaozhi-agent/attachment-import-service.ts',
 'src/main/xiaozhi-agent/attachment-service.ts','src/main/xiaozhi-agent/attachment-state.ts','src/main/xiaozhi-agent/session-state.ts',
 'src/main/xiaozhi-agent/workspace-files.ts','src/main/xiaozhi-agent/workspace-authority.ts','src/main/xiaozhi-agent/production-host.ts',
 'src/main/xiaozhi-agent/vendor/hana/lib/session-files/inbound-filenames.ts',
 'src/main/xiaozhi-agent/vendor/hana/lib/session-files/attachment-identity.ts','src/shared/xiaozhi-attachments.ts','src/main/db.ts',
 'scripts/xiaozhi-agent/reuse-hana-inbound-filenames.mjs','scripts/xiaozhi-agent/pi-attachment-import-native-smoke.mjs',
 'scripts/xiaozhi-agent/pi-attachment-import-native-worker.ts','scripts/xiaozhi-agent/archive-attachment-inbound.mjs',
 'scripts/xiaozhi-agent/pi-attachment-foundation-smoke.mjs','scripts/xiaozhi-agent/pi-attachment-native-store-smoke.mjs',
 'scripts/electron-smoke.mjs','out/main/index.js','out/preload/index.cjs','out/renderer/index.html'];
for(const file of ['index.ts','chat-attachment.tsx','chat-attachment.styles.ts','chat-attachment-input.tsx','chat-attachment-group.tsx'])files.push('src/renderer/heroui-pro/components/chat-attachment/'+file);
for(const file of fs.readdirSync(path.join(desktop,'out/renderer/assets')).filter(v=>/^index-.*\.js$/.test(v)))files.push('out/renderer/assets/'+file);
for(const file of files){const bytes=fs.readFileSync(path.join(desktop,file));safe(bytes);runtime.push({file,bytes:bytes.length,sha256:sha(bytes)});}
const manifest={schemaVersion:'xiaozhi.public-acceptance.v1',slice:'P07-D2-A',createdAt:new Date().toISOString(),
 boundary:'D2-A only. Actual Electron main/native Store/FS20 with three owned OS forced terminations and two reopens; D1 boundary13/native4, renderer79 and final product build/main smoke207. Original Hana4 fragments. Synthetic workspace/binding rows are not Pi history proof. Only PNG/text local preview tested. No native picker/attachment renderer/send/Pi vision/OCR/viewed-image claim. Failed RUN_AS_NODE import, wrong namespace schema and process.exit73 native teardown actual134 retained; OS kill recovery is not a fix for that teardown. Safe explicit reports/logs/hash only; no env/profile/DB/WAL/native JSONL/worker/bootstrap/original source data/credentials/real teacher data. Prior archives immutable; no VPN-off/installer/Codex identity claim.',entries,runtime};
const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');safe(bytes);
fs.mkdirSync(target,{recursive:true});for(const item of pending){fs.mkdirSync(path.dirname(item.destination),{recursive:true});fs.writeFileSync(item.destination,item.bytes,{flag:'wx'});assert.equal(sha(fs.readFileSync(item.destination)),sha(item.bytes));}
fs.writeFileSync(path.join(target,'artifacts.json'),bytes,{flag:'wx'});console.log(JSON.stringify({success:true,entries:entries.length,runtime:runtime.length,output:target}));
