/** Recover an actual interrupted C2 export through its original UI, without a model.
 * Clone the failed DB/profile; the original owned output file is read-only evidence.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {captureRuntimeDiagnostics} from './acceptance/runtime-diagnostics.mjs';
import {until} from './acceptance/paper-export-intent-evidence.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2);
assert(args.length===3&&args.includes('--run-ui')&&args.filter(v=>v.startsWith('--pins=')).length===1&&args.filter(v=>v.startsWith('--from=')).length===1,'Use --run-ui --pins=<owned JSON> --from=<actual failed owned run>');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const ownedPath=value=>{const result=fs.realpathSync(path.resolve(desktop,value));assert(result.startsWith(owned+path.sep));return result;};
const value=name=>args.find(v=>v.startsWith('--'+name+'=')).slice(name.length+3);
const pins=JSON.parse(fs.readFileSync(ownedPath(value('pins')),'utf8'));
const build=ownedPath(pins.buildRoot),main=path.join(build,'main/index.js');
const original=ownedPath(value('from')),originalBefore=fingerprint(original).sha256;
const output=fs.mkdtempSync(path.join(owned,'ui-final-office-recovery-'));
for(const name of ['data','profile']){const source=fs.realpathSync(path.join(original,name));assert.equal(path.dirname(source),original);fs.cpSync(source,path.join(output,name),{recursive:true,force:false,errorOnExist:true});assert.equal(fingerprint(path.join(output,name)).sha256,fingerprint(source).sha256);}
const data=path.join(output,'data'),profile=path.join(output,'profile'),dbPath=path.join(data,'app.db');
const read=(q,p=[])=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
const drafts=read("SELECT * FROM xiaozhi_pi_office_drafts WHERE state='uncertain' AND json_extract(draft_json,'$.schemaVersion')='xiaozhi.office-paper-draft.v7'");
assert.equal(drafts.length,1,'One real failed C2 draft required');const draft=drafts[0];
const file=fs.realpathSync(draft.result_path);assert(file.startsWith(fs.realpathSync(path.join(original,'workspace'))+path.sep));
assert.equal(sha256(fs.readFileSync(file)),draft.output_hash,'Actual installed bytes match interrupted output');
const ledger=()=>Object.fromEntries(['ai_agent_runs','xiaozhi_pi_commands','question_bank_items','paper_template_versions','document_artifacts'].map(t=>[t,read('SELECT count(*) AS n FROM '+t)[0].n]));
const before=ledger(),report={success:false,scope:'Actual cold C2 uncertain recovery, original UI; not full A30 acceptance',pins,original,originalBefore,output,draftId:draft.id,checks:[],errors:[],launches:[],modelCalls:0,seams:['Failed owned DB/profile copied exactly; original owned installed output is verified read-only, no source/path/row rewriting.']};
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
const verify=()=>{assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(original).sha256,originalBefore);};
let app,page;
async function launch(){
 const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
 Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
 app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});captureRuntimeDiagnostics(app,report,persist);
 report.launches.push(await assertIsolatedPiMain(app,main,profile));
 await app.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true})));
 page=await app.firstWindow();page.setDefaultTimeout(15000);
 for(const kind of ['pageerror','console'])page.on(kind,event=>{if(kind==='pageerror'||event.type()==='error')report.errors.push({kind,sha256:sha256(Buffer.from(kind==='pageerror'?String(event.message):event.text()))});});
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
 if(await page.locator('.office-composer-container:visible').getAttribute('data-session-id')!==draft.conversation_id)
  await page.locator(`[data-testid="edu-navigation"]:visible [data-testid="workbench-session-${draft.conversation_id}"]`).click();
 await until(async()=>await page.locator('.office-composer-container:visible').getAttribute('data-session-id')===draft.conversation_id,'Exact recovered owner');
 await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),draft.conversation_id)).running,'Cold run is terminal, no replay');
}
try{
 verify();persist();await launch();
 const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${draft.id}"]:visible`);
 await card.waitFor();assert.equal(await card.getAttribute('data-state'),'uncertain');assert(!await card.getByTestId('pi-office-verify').isDisabled());
 await page.screenshot({path:path.join(output,'before-recovery.png')});check('Actual interrupted export visible after cold launch with verification enabled');
 await card.getByTestId('pi-office-verify').click();
 await until(()=>read('SELECT state FROM xiaozhi_pi_office_drafts WHERE id=?',[draft.id])[0]?.state==='saved','Original verify publishes saved fact',30000);
 await until(async()=>await card.getAttribute('data-state')==='saved','Recovered saved state reaches original card');
 const saved=read('SELECT * FROM xiaozhi_pi_office_drafts WHERE id=?',[draft.id])[0];assert.equal(saved.revision,draft.revision+1);assert(saved.artifact_id);
 assert.equal(read('SELECT * FROM document_artifacts WHERE id=?',[saved.artifact_id]).length,1);
 const source=read('SELECT * FROM document_artifact_paper_sources WHERE artifact_id=?',[saved.artifact_id]);assert.equal(source.length,1);assert.equal(source[0].draft_id,draft.id);assert.equal(source[0].paper_id,JSON.parse(draft.draft_json).paperSource.paperId);
 assert.equal(sha256(fs.readFileSync(file)),draft.output_hash);assert.equal(await card.getByTestId('pi-office-verify').count(),0);check('One original UI verification publishes one exact artifact and paper lineage without rewriting the file');
 await page.screenshot({path:path.join(output,'after-recovery.png')});await app.close();app=undefined;await launch();
 const cold=read('SELECT * FROM xiaozhi_pi_office_drafts WHERE id=?',[draft.id])[0];assert.equal(cold.state,'saved');assert.equal(cold.artifact_id,saved.artifact_id);assert.equal(cold.revision,saved.revision);
 const after=ledger();for(const name of Object.keys(before))assert.equal(after[name],before[name]+(name==='document_artifacts'?1:0),name+' has no replay or duplicate');
 report.ledgerBefore=before;report.ledgerAfter=after;assert.deepEqual(report.errors,[]);check('Second cold launch retains recovered fact with zero model, command, bank or template additions');
 verify();report.success=true;
}catch(error){report.error={name:error.name,message:String(error.message).slice(0,1200),stack:String(error.stack).slice(0,2500)};await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});try{verify();report.integrityVerified=true;}catch(e){report.success=false;report.integrityError=String(e.message);}persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length}));}
if(!report.success)process.exitCode=1;
