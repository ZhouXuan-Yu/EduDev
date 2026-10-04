import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const desktop=process.cwd(),repo=path.resolve(desktop,'../..');
const target=path.join(repo,'docs/design/codex-2026-10-03/p07-domestic-web');
assert(!fs.existsSync(path.join(target,'artifacts.json')),'Immutable archive already exists');
const env=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const credentials=[...env.matchAll(/(?:^|\n)[A-Z_]*(?:KEY|TOKEN|SECRET)\s*=\s*([^\r\n]+)/g)]
 .map(m=>m[1].trim().replace(/^['"]|['"]$/g,'')).filter(v=>v.length>12);
const safe=bytes=>{for(const key of credentials)assert(!bytes.includes(Buffer.from(key)),'Credential in public artifact');assert(!/\bsk-[A-Za-z0-9]{24,}\b/.test(bytes.toString('utf8')),'API key in public artifact');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),entries=[];
const copy=(source,destination)=>{const bytes=fs.readFileSync(source);safe(bytes);const output=path.join(target,destination);assert(!path.relative(target,output).startsWith('..'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes,{flag:'wx'});assert(sha(fs.readFileSync(output))===sha(bytes));entries.push({source:path.relative(repo,source).replaceAll('\\','/'),file:destination,bytes:bytes.length,sha256:sha(bytes)});};
const results=path.join(desktop,'test-results/xiaozhi-agent');
for(const name of ['p07c-build5.log','p07c-renderer-final2.log','p07c-main-smoke-final2.log','p07c-web-source-audit.json','p07c-public-probe-final.jsonl'])copy(path.join(results,name),'gates/'+name);
for(const dir of ['pi-web-ui-9uZomc','pi-web-boundary-7JFNQJ','pi-web-legacy-Dexx8J'])copy(path.join(results,dir,'report.json'),dir+'/report.json');
for(const file of ['source-1366x768.png','source-1920x1080.png','actual-public-error.png'])copy(path.join(results,'pi-web-ui-9uZomc',file),'pi-web-ui-9uZomc/'+file);
for(const dir of ['pi-web-ui-SoGCs3','pi-web-ui-iHK3ic','pi-web-ui-NL9blZ','pi-web-ui-FefUeb','pi-web-ui-xwjMYj']){
 copy(path.join(results,dir,'report.json'),'failed/'+dir+'/report.json');
 const failure=path.join(results,dir,'failure.png');if(fs.existsSync(failure))copy(failure,'failed/'+dir+'/failure.png');
}
for(const file of ['docs/128_PI_DOMESTIC_WEB_AND_CITATION_CONTRACT.md','docs/129_PI_DOMESTIC_WEB_AND_CITATION_ACCEPTANCE.md','third_party/openhanako/LICENSE','apps/desktop/src/main/office-agent/vendor/hana/source-manifest.json','apps/desktop/src/renderer/heroui-pro/README.md'])copy(path.join(repo,file),'references/'+path.basename(file));
const files=['src/main/office-agent/office-network.ts','src/main/office-agent/hana-tool-adapter.ts','src/main/xiaozhi-agent/web-tools.ts','src/main/xiaozhi-agent/web-api.ts','src/main/xiaozhi-agent/model-settings-state.ts','src/main/xiaozhi-agent/model-settings.ts','src/main/xiaozhi-agent/pi-session.ts','src/main/xiaozhi-agent/production-host.ts','src/main/xiaozhi-agent/ipc.ts','src/preload/index.ts','src/shared/xiaozhi-web.ts','src/shared/xiaozhi-settings.ts','src/shared/office-agent.ts','src/shared/xiaozhi-agent.ts','src/shared/xiaozhi-projection.ts','src/renderer/components/office/PiWebSettings.tsx','src/renderer/components/office/PiModelSettings.tsx','src/renderer/components/office/PiSettingsWorkspace.tsx','src/renderer/components/office/OfficeToolProcess.tsx','src/renderer/components/office/OfficeConversation.tsx','src/renderer/components/office/PiWorkspaceContext.tsx','src/renderer/components/office/pi-education-workspace.css','out/main/index.js','out/preload/index.cjs','out/renderer/index.html'];
// Resolve exact renderer/main paths from the built workspace; source hashes are evidence, not source identity.
const runtime=[];
files.push('scripts/xiaozhi-agent/pi-web-boundary-smoke.mjs','scripts/xiaozhi-agent/pi-web-ui-smoke.mjs','scripts/xiaozhi-agent/pi-web-legacy-ui-smoke.mjs','scripts/xiaozhi-agent/verify-web-reuse.mjs','scripts/xiaozhi-agent/pi-web-public-probe.mjs','scripts/xiaozhi-agent/archive-web-acceptance.mjs');
for(const file of files){const source=path.join(desktop,file);assert(fs.existsSync(source),'Missing source/runtime file: '+file);const bytes=fs.readFileSync(source);safe(bytes);runtime.push({file,bytes:bytes.length,sha256:sha(bytes)});}
for(const file of fs.readdirSync(path.join(desktop,'out/renderer/assets')).filter(f=>/^index-.*\.js$/.test(f))){const name='out/renderer/assets/'+file,bytes=fs.readFileSync(path.join(desktop,name));safe(bytes);runtime.push({file:name,bytes:bytes.length,sha256:sha(bytes)});}
const manifest={schemaVersion:'xiaozhi.public-acceptance.v1',slice:'P07-C',createdAt:new Date().toISOString(),boundary:'Explicit safe reports/screenshots/logs only. No env, profile, database, native JSONL, key, student data. Actual UI15, legacy3; HTTP boundary13 is mocked. No VPN-off, Codex identity or installer claim.',entries,runtime};
const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');safe(bytes);fs.writeFileSync(path.join(target,'artifacts.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({success:true,entries:entries.length,runtime:runtime.length,output:target}));
