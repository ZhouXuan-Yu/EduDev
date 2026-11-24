import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {execFileSync} from 'node:child_process';import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const prior=path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/live-ZfxRlK/report.json'),prefix=JSON.parse(fs.readFileSync(prior));
assert.equal(prefix.failure.stage,'ppt-generation');assert.equal(prefix.ppt.saved.state,'saved');
const output=fs.mkdtempSync(path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/ppt-readback-'));
const db=new DatabaseSync(path.join(prefix.data,'app.db'),{readOnly:true});const fact=db.prepare('SELECT id,session_id,title,file_path,file_size,content_hash,status FROM document_artifacts WHERE id=?').get(prefix.ppt.saved.artifactId);db.close();
assert(fact?.file_path);assert(path.resolve(fact.file_path).startsWith(path.join(desktop,'test-results')+path.sep));
const bytes=fs.readFileSync(fact.file_path);assert.equal(sha256(bytes),fact.content_hash);assert.equal(bytes.length,fact.file_size);
const readback=JSON.parse(execFileSync('python',['-c','import sys,json,zipfile,xml.etree.ElementTree as E;z=zipfile.ZipFile(sys.argv[1]);n=[s for s in z.namelist() if s.startswith("ppt/slides/slide") and s.endswith(".xml")];print(json.dumps({"slides":len(n),"texts":["".join(E.fromstring(z.read(s)).itertext()) for s in n],"title":E.fromstring(z.read("docProps/core.xml")).find("{http://purl.org/dc/elements/1.1/}title").text},ensure_ascii=False))',fact.file_path],{encoding:'utf8',windowsHide:true}));
assert.equal(readback.slides,3);assert(JSON.stringify(readback).includes('教师修订'));
const main=path.join(desktop,'out/main/index.js'),report={success:false,source:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),build:fingerprint(path.join(desktop,'out')).sha256,prior,fact,readback,checks:['Actual managed output location comes from the saved artifact fact, not a presumed input workspace path','PPT ZIP/XML readback contains all three generated slides and the teacher-edited title'],errors:[],boundary:'Continuation of the actually saved real-provider PPT. Cold launch and UI preview only; HTTP blocked, no regeneration or native journal edits.'};
let app,page;
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:prefix.data,OMNI_EDU_REPO_ROOT:repo};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(k)||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
 const bootstrap=zeroNetworkBootstrap({main,profile:prefix.profile,output,counter:'__savedPptHttp'});
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+prefix.profile],env,cwd:desktop,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});report.identity=await assertIsolatedPiMain(app,main,prefix.profile);
 assert.equal(await page.locator('.office-composer-container:visible').getAttribute('data-session-id'),prefix.session);
 const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${prefix.ppt.saved.id}"]`).filter({visible:true});
 await card.waitFor();const trigger=card.locator('[data-slot="chat-tool-trigger"]').first();if(await trigger.getAttribute('aria-expanded')==='false')await trigger.click();
 await card.getByTestId('pi-office-open').click();await page.locator('[data-testid="pi-file-preview"][aria-busy="false"]').waitFor();
 report.preview=await page.getByTestId('pi-file-preview').innerText();await page.screenshot({path:path.join(output,'opened-preview.png')});
 assert(JSON.stringify(readback.texts).includes('一元一次方程'));assert(report.preview.includes('一元一次方程')&&report.preview.includes('12'),'Opening the actual saved artifact must preview its generated equation content');
 await page.getByTestId('pi-files-close').click();assert.equal(await page.locator('.office-composer-container:visible').getAttribute('data-session-id'),prefix.session);report.checks.push('Cold-start saved PPT opens the original local preview and returns to its own conversation');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.failure=String(e.stack||e);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(app){report.http=await app.evaluate(()=>globalThis.__savedPptHttp);await app.close();}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,failure:report.failure}));}
