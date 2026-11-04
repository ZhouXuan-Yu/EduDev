/** A19 bounded continuation of a real confirmed classroom. No generation or export. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {classroomEditorJourney} from './education/classroom-editor-journey.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),pinsArgs=args.filter(v=>v.startsWith('--pins=')),fromArgs=args.filter(v=>v.startsWith('--from='));
assert(args.length===3&&args.includes('--run-ui')&&pinsArgs.length===1&&fromArgs.length===1,'Use --run-ui --pins=<owned JSON> --from=<successful real classroom run>');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const inside=(root,file)=>{const result=fs.realpathSync(file);assert(result.startsWith(root+path.sep),'Path outside explicit owned root');return result;};
const pinsPath=inside(owned,path.resolve(desktop,pinsArgs[0].slice(7)));
const pins=JSON.parse(fs.readFileSync(pinsPath,'utf8')),build=inside(owned,pins.buildRoot),main=path.join(build,'main/index.js');
const sourcePath=fs.realpathSync(path.resolve(fromArgs[0].slice(7)));
const allowed=[owned,fs.realpathSync('D:/WorkProject/EduProject/apps/desktop/test-results')];
assert(allowed.some(root=>sourcePath.startsWith(root+path.sep))&&/^education-journey-[A-Za-z0-9]+$/.test(path.basename(sourcePath)));
const sourceReport=JSON.parse(fs.readFileSync(path.join(sourcePath,'report.json'),'utf8'));
assert(sourceReport.scenario==='MA-CLASSROOM'&&sourceReport.success&&sourceReport.classroom?.saved?.status==='confirmed');
const original=sourceReport.classroom.saved;assert.equal(original.revision,1);
const sourceData=fs.realpathSync(path.join(sourcePath,'data'));assert.equal(sourceData,path.join(sourcePath,'data'));
assert(!fs.existsSync(path.join(sourceData,'app.db-wal'))||fs.statSync(path.join(sourceData,'app.db-wal')).size===0,'Source must be quiescent');
const sourceBefore=fingerprint(sourcePath).sha256,sourceDataBefore=fingerprint(sourceData).sha256;
const output=fs.mkdtempSync(path.join(owned,'ui-final-classroom-editor-')),data=path.join(output,'data'),profile=path.join(output,'electron-profile');
const scripts=[fileURLToPath(import.meta.url),path.join(desktop,'scripts/education/classroom-editor-journey.mjs')];
const scriptsHash=()=>scripts.map(file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const qaBefore=scriptsHash();
const report={success:false,output,pins,pinsPath,sourcePath,sourceBefore,sourceDataBefore,checks:[],visuals:[],errors:[],launches:[],budget:{launches:2,modelSubmissions:0,exports:0,automaticRetries:0},
 seams:['A successful prior real Pi classroom is copied without links; original data/report remain unchanged.','Original editor UI performs writes; one intentionally stale confirmation API call verifies conflict without writes.','Network blocked after firstWindow; durable model ledger must stay byte-for-byte unchanged.'],
 notRun:['New classroom generation and Office export; retained in prior real evidence.','All-subject accuracy, genuine teacher pedagogical acceptance and OS native chooser.']};
let app,page,baseline;
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const verify=()=>{assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.deepEqual(scriptsHash(),qaBefore);assert.equal(fingerprint(sourcePath).sha256,sourceBefore,'Original source changed');};
const ledger=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));}finally{db.close();}};
const assertNoModel=()=>assert.deepEqual(ledger(),baseline,'Classroom editing must never admit or replay a model task');
const until=async(fn,label='classroom editor state')=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+label);};
const check=name=>{assertNoModel();report.checks.push({name,pass:true});persist();};
async function launch(){
 verify();assert(report.launches.length<2,'Two-launch maximum');
 if(!baseline){assert.equal(fingerprint(data).sha256,sourceDataBefore,'Copied data must equal the real original');baseline=ledger();report.modelLedgerBeforeHash=createHash('sha256').update(JSON.stringify(baseline)).digest('hex');}
 const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
 app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:60000});
 report.launches.push(await assertIsolatedPiMain(app,main,profile));page=await app.firstWindow();page.setDefaultTimeout(15000);
 const error=(kind,value)=>report.errors.push({kind,sha256:createHash('sha256').update(String(value)).digest('hex'),length:String(value).length});
 page.on('pageerror',e=>error('pageerror',e.message));page.on('console',m=>{if(m.type()==='error')error('console.error',m.text());});
 await app.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true})));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
 const read=await page.evaluate(id=>window.omniEdu.readClassroom(id),original.id);assert(read.ok);assert.deepEqual(read.data,original,'Exact prior classroom, not list order');assertNoModel();persist();
}
try{
 persist();verify();
 await classroomEditorJourney({data,output,report,sourcePath,captureStates:[['light',1366,768],['light',1920,1080]],page:()=>page,app:()=>app,launch,
  navigate:async view=>{assert.equal(view,'teaching');await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-teaching').click();},
  until,check,restart:async()=>{assertNoModel();await app.close();app=undefined;await launch();},neutralCapture:async()=>{await page.mouse.move(0,0);}});
 assert.equal(report.checks.length,5);assertNoModel();assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.error={message:String(error.message).slice(0,4000),stack:String(error.stack).slice(0,6000)};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{
 await app?.close().catch(error=>{report.success=false;report.closeError=String(error.message);});
 try{if(baseline){assertNoModel();report.modelLedgerAfterHash=createHash('sha256').update(JSON.stringify(ledger())).digest('hex');}verify();report.integrityVerified=true;}
 catch(error){report.success=false;report.integrityError=String(error.message);}
 persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,integrityVerified:report.integrityVerified??false}));
}
if(!report.success)process.exitCode=1;
