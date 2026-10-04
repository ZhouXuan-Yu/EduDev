import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const desktop=process.cwd(),repo=path.resolve(desktop,'../..');
const target=path.join(repo,'docs/design/codex-2026-10-03/p07-attachment-foundation');
assert(!fs.existsSync(target),'Immutable archive already exists');
const env=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const credentials=[...env.matchAll(/(?:^|\n)[A-Z_]*(?:KEY|TOKEN|SECRET)\s*=\s*([^\r\n]+)/g)]
 .map(m=>m[1].trim().replace(/^['"]|['"]$/g,'')).filter(v=>v.length>12);
const safe=bytes=>{
 for(const key of credentials)assert(!bytes.includes(Buffer.from(key)),'Credential in public artifact');
 assert(!/\bsk-[A-Za-z0-9]{24,}\b/.test(bytes.toString('utf8')),'API key in public artifact');
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=path.join(desktop,'test-results/xiaozhi-agent');
const entries=[],runtime=[],pending=[];
const enqueue=(source,file)=>{
 const bytes=fs.readFileSync(source);safe(bytes);
 const output=path.join(target,file),relative=path.relative(target,output);
 assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Invalid archive destination');
 assert(!pending.some(v=>v.output===output),'Duplicate archive destination');
 pending.push({bytes,output});
 entries.push({source:path.relative(repo,source).replaceAll('\\','/'),file,bytes:bytes.length,sha256:sha(bytes)});
};
for(const name of ['p07d1-source-audit.json','p07d1-foundation-final3.log','p07d1-native-store-final2.log',
 'p07d1-renderer-final.log','p07d1-main-smoke-final2.log','p07d1-main-smoke-diagnostic.log',
 'p07d1-build1.log','p07d1-foundation1.log','p07d1-foundation2.log','p07d1-native-store1.log'])
 enqueue(path.join(results,name),'gates/'+name);
for(const dir of ['pi-attachment-foundation-oWWoLZ','pi-attachment-native-tLtLnu','pi-public-image-EYFAYU'])
 enqueue(path.join(results,dir,'report.json'),dir+'/report.json');
for(const dir of ['pi-attachment-foundation-cItlgD','pi-attachment-native-ggXZXd'])
 enqueue(path.join(results,dir,'report.json'),'failed/'+dir+'/report.json');
enqueue(path.join(desktop,'test-results/electron-e2e/failure.png'),'failed/legacy-no-provider-failure.png');
enqueue(path.join(desktop,'scripts/xiaozhi-agent/fixtures/attachment-rgb.png'),'synthetic/attachment-rgb.png');
for(const file of ['docs/130_PI_ATTACHMENTS_AND_IMAGE_DELIVERY_CONTRACT.md','docs/131_PI_ATTACHMENT_FOUNDATION_ACCEPTANCE.md',
 '1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md',
 'docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md','docs/35_XIAZHI_OFFICE_AGENT_TODO.md',
 'docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md'])
 enqueue(path.join(repo,file),'references/'+path.basename(file));
for(const file of ['src/main/xiaozhi-agent/vendor/hana/lib/session-files/source-manifest.json',
 'src/main/xiaozhi-agent/vendor/hana/lib/session-files/LICENSE','src/renderer/heroui-pro/README.md'])
 enqueue(path.join(desktop,file),'references/'+(file.endsWith('/LICENSE')?'Hana.LICENSE':path.basename(file)));
const files=['src/shared/xiaozhi-attachments.ts','src/main/xiaozhi-agent/attachment-state.ts',
 'src/main/xiaozhi-agent/attachment-service.ts','src/main/xiaozhi-agent/session-state.ts',
 'src/main/xiaozhi-agent/vendor/hana/lib/session-files/attachment-identity.ts',
 'src/main/xiaozhi-agent/workspace-authority.ts','src/main/xiaozhi-agent/pi-session.ts',
 'src/main/xiaozhi-agent/production-host.ts','src/main/db.ts','src/preload/index.ts',
 'scripts/xiaozhi-agent/reuse-hana-attachment-identity.mjs',
 'scripts/xiaozhi-agent/pi-attachment-foundation-smoke.mjs',
 'scripts/xiaozhi-agent/pi-attachment-native-store-smoke.mjs',
 'scripts/xiaozhi-agent/pi-attachment-native-store-worker.ts','scripts/xiaozhi-agent/pi-public-image-probe.mjs',
 'scripts/xiaozhi-agent/archive-attachment-foundation.mjs','scripts/electron-smoke.mjs',
 'out/main/index.js','out/preload/index.cjs','out/renderer/index.html'];
for(const file of ['index.ts','chat-attachment.tsx','chat-attachment.styles.ts','chat-attachment-input.tsx','chat-attachment-group.tsx'])
 files.push('src/renderer/heroui-pro/components/chat-attachment/'+file);
for(const file of fs.readdirSync(path.join(desktop,'out/renderer/assets')).filter(v=>/^index-.*\.js$/.test(v)))
 files.push('out/renderer/assets/'+file);
for(const file of files){const bytes=fs.readFileSync(path.join(desktop,file));safe(bytes);runtime.push({file,bytes:bytes.length,sha256:sha(bytes)});}
const manifest={schemaVersion:'xiaozhi.public-acceptance.v1',slice:'P07-D1',createdAt:new Date().toISOString(),
 boundary:'D1 only: real local SQLite/FS13, actual Electron native sqlite3/OmniEduStore4, original Hana2 and Pro5, direct official synthetic RGB HTTP200. Renderer79 and same-product-build smoke207. Earlier legacy no-provider foreign-key failure retained; repeat success does not prove its cause. No chooser/attachment renderer/Pi vision/OCR/viewed-image claim. Explicit safe reports/logs/synthetic images/hash only; no env, profile, database, native JSONL, worker bundles, keys or real teacher/student data. No VPN-off, installer or Codex identity claim.',entries,runtime};
const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');safe(bytes);
// Preflight every explicit source before publishing any artifact; never rewrite an existing archive.
fs.mkdirSync(target,{recursive:true});
for(const item of pending){fs.mkdirSync(path.dirname(item.output),{recursive:true});fs.writeFileSync(item.output,item.bytes,{flag:'wx'});assert.equal(sha(fs.readFileSync(item.output)),sha(item.bytes));}
fs.writeFileSync(path.join(target,'artifacts.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({success:true,entries:entries.length,runtime:runtime.length,output:target}));
