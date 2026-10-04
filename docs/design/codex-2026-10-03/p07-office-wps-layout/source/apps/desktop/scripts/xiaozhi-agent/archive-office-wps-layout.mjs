// Local, explicit safe-source archive. Never walk an application profile or private ledger.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const desktop=path.resolve('.'),repo=path.resolve('../..'),tests=path.join(desktop,'test-results/xiaozhi-agent');
const output=path.join(repo,'docs/design/codex-2026-10-03/p07-office-wps-layout');
const entries=[];const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const env=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const secrets=[...env.matchAll(/^(?:[A-Z_]*API_KEY|[A-Z_]*TOKEN)\s*=\s*(.*)$/gm)].map(m=>m[1].trim().replace(/^['"]|['"]$/g,'')).filter(v=>v.length>=16);
function copy(file,name){
 const bytes=fs.readFileSync(file);const text=bytes.toString('utf8');
 if(/sk-[a-zA-Z0-9]{20,}/.test(text)||secrets.some(s=>bytes.includes(Buffer.from(s))))throw new Error('Credential bytes refused');
 const target=path.resolve(output,name);assert(target.startsWith(output+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});
 if(fs.existsSync(target))assert.equal(sha(fs.readFileSync(target)),sha(bytes),'Existing archive differs');else fs.writeFileSync(target,bytes,{flag:'wx'});
 entries.push({path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=['1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md','docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md','docs/35_XIAZHI_OFFICE_AGENT_TODO.md','docs/67_CODEX_DESKTOP_PROCESS_AND_COMPONENT_DESIGN.md','docs/126_PI_OFFICE_WPS_LAYOUT_CONTRACT.md','docs/127_PI_OFFICE_WPS_LAYOUT_ACCEPTANCE.md',
 'apps/desktop/package.json','apps/desktop/package-lock.json','apps/desktop/src/main/xiaozhi-agent/office-generator.ts','apps/desktop/scripts/xiaozhi-agent/pi-office-wps-acceptance.ps1','apps/desktop/scripts/xiaozhi-agent/pi-office-layout-fixture.mjs','apps/desktop/scripts/xiaozhi-agent/verify-office-wps-render.py','apps/desktop/scripts/xiaozhi-agent/verify-office-wps-content.py','apps/desktop/scripts/xiaozhi-agent/archive-office-wps-layout.mjs'];
for(const file of sourceFiles)copy(path.join(repo,file),'source/'+file);
for(const file of fs.readdirSync(tests).filter(f=>/^p07b3c.*\.log$/.test(f)))copy(path.join(tests,file),'logs/'+file);
for(const dir of ['wps-probe1','wps-probe2','wps-probe3','wps-render1','wps-layout1','wps-layout2','wps-layout3','wps-layout4','wps-long1','wps-mixed1']){
 for(const file of fs.readdirSync(path.join(tests,dir)).filter(f=>/\.(json|pdf|png)$/.test(f)))copy(path.join(tests,dir,file),'evidence/'+dir+'/'+file);
}
for(const [dir,names] of [['office-layout-qtZZb0',['fixture.json','generation.json','generated.docx','generated.xlsx','generated.pptx']],['office-layout-TlEVvi',['fixture.json','generation.json','generated.docx','generated.xlsx','generated.pptx']],['pi-office-generation-nh7TH4',['draft.json','report.json','format-readback.json','generated.docx','generated.xlsx','generated.pptx','generated.pdf']],['pi-office-generation-LMTjkz',['report.json','format-readback.json']],['pi-office-artifact-ui-vWOfNs',['report.json']]]){
 for(const file of names)copy(path.join(tests,dir,file),'inputs-and-reports/'+dir+'/'+file);
}
for(const dir of ['pi-office-artifact-ui-vWOfNs'])for(const file of fs.readdirSync(path.join(tests,dir)).filter(f=>/\.png$/.test(f)))copy(path.join(tests,dir,file),'evidence/'+dir+'/'+file);
for(const file of ['package.json','dist/utils.js','dist/utils.d.ts'])copy(path.join(desktop,'node_modules/@earendil-works/pi-tui',file),'upstream/pi-tui/'+file);
for(const [folder,file]of [['get-east-asian-width','license'],['@earendil-works/pi-tui/node_modules/marked','LICENSE']])copy(path.join(desktop,'node_modules',folder,file),'upstream/'+folder.replaceAll('/','-')+'/'+file);
const previous=JSON.parse(fs.readFileSync(path.join(repo,'docs/design/codex-2026-10-03/p07-office-artifact-user-flow/artifacts.json'),'utf8'));
const runtime=previous.runtimeHashes.map(row=>{const file=path.join(desktop,row.path);assert(fs.existsSync(file));const bytes=fs.readFileSync(file);return{path:row.path,bytes:bytes.length,sha256:sha(bytes)};});
fs.mkdirSync(output,{recursive:true});const report={version:1,scope:'Actual WPS Office layout accepted for owned synthetic inputs; limited Office B complete. C/D/E, full Codex parity, Windows installer and actual no-VPN remain pending.',entries,runtimeHashes:runtime};
const target=path.join(output,'artifacts.json');const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');if(fs.existsSync(target))assert.equal(sha(fs.readFileSync(target)),sha(bytes));else fs.writeFileSync(target,bytes,{flag:'wx'});
for(const row of entries)assert.equal(sha(fs.readFileSync(path.join(output,row.path))),row.sha256);
console.log(JSON.stringify({success:true,entries:entries.length,runtime:runtime.length,credentialScan:true,output:path.relative(repo,output)}));
