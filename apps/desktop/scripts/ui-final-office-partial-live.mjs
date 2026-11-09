/** One explicit continuation: reuse four saved files, request only two missing.
 * Archive first, retain interrupted run, exact grants/owner/versions, no SQL writes.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {runPaperInstanceExportJourney} from './acceptance/paper-instance-export-live.mjs';
import {readPartialOffice, showExactOfficeOwner} from './acceptance/paper-office-partial.mjs';
import {parentImageReviewGate} from './acceptance/parent-image-review-gate.mjs';
import {assertCurrentC2SourceRefusalUi, c2OfficeContractHash, readC2OfficeMatrixGate} from './acceptance/paper-template-office-ui.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2);
assert(args.includes('--run-ui')&&args.includes('--live')&&process.env.DEEPSEEK_API_KEY);
assert.equal(args.length,5); assert(args.every(a=>['--run-ui','--live'].includes(a)||/^--(?:pins|from|matrix)=.+/.test(a)));
const arg=name=>args.find(a=>a.startsWith('--'+name+'=')).slice(name.length+3);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const own=file=>{const p=fs.realpathSync(file);assert(p.startsWith(owned+path.sep));return p;};
const pins=JSON.parse(fs.readFileSync(own(arg('pins')))),from=own(arg('from'));
const main=path.join(own(pins.buildRoot),'main/index.js');
const output=fs.mkdtempSync(path.join(owned,'ui-final-office-partial-'));
const originalBefore=fingerprint(from).sha256,archive=path.join(output,'original-archive');
fs.cpSync(from,archive,{recursive:true,force:false,errorOnExist:true});
assert.equal(fingerprint(archive).sha256,originalBefore);
const partial=readPartialOffice({from,output,pins}),fixture=partial.fixture;
const matrix=readC2OfficeMatrixGate(own(arg('matrix')),pins);
const profile=path.join(from,'profile'),data=path.join(from,'data'),workspace=path.join(from,'workspace');
const verify=()=>{
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
  assert.equal(c2OfficeContractHash(),pins.contract);
  assert.equal(fingerprint(archive).sha256,originalBefore);
  assert.equal(fingerprint(fixture.baselineProof.original).sha256,fixture.baselineProof.originalBefore);
};
const report={success:false,scope:'Current writer: four verified saved files plus two explicit remaining exports',
  output,from,archive,originalBefore,pins,matrix,checks:[],errors:[],navigationObservations:[],
  budget:{launches:1,newSubmissions:2,automaticRetries:0,preservedSuccessfulFiles:4,
    attemptsThisScenarioIncludingInterrupted:7,attemptsIncludingLoaderFailure:8}};
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
let app,page;
try{
  verify();persist();console.log(JSON.stringify({phase:'explicit-remaining-only',output,budget:report.budget}));
  const env={...process.env};
  for(const key of Object.keys(env))if((key!=='DEEPSEEK_API_KEY'&&/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key))||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],env,cwd:desktop,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(30000);
  report.launchIdentity=await assertIsolatedPiMain(app,main,profile);
  for(const kind of ['pageerror','console'])page.on(kind,e=>{if(kind==='pageerror'||e.type()==='error'){
    let message=String(kind==='pageerror'?e.message:e.text());message=message.split(process.env.DEEPSEEK_API_KEY).join('[credential]');
    report.errors.push({kind,message:message.slice(0,1600)});persist();}});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await showExactOfficeOwner(page,fixture.sessionId,report.navigationObservations);
  check('Archived original failed run and verified four saved hashes, original approvals, cold owner and exact current writer');
  const result=await runPaperInstanceExportJourney({...fixture,page,app,workspace,output,pins,partialFrom:from,
    argv:args,evidenceProtocol:'c2-v7',inspectImages:parentImageReviewGate(output),onCheck:check,
    sourceFiles:[fileURLToPath(import.meta.url),fileURLToPath(new URL('./acceptance/paper-office-partial.mjs',import.meta.url)),fileURLToPath(new URL('./acceptance/paper-office-source.mjs',import.meta.url))],
    buildFiles:[main,path.join(pins.buildRoot,'preload/index.cjs')]});
  assert(result.success&&result.deliveries.length===6&&result.admissions.length===6);
  report.exports={success:true,deliveries:result.deliveries};
  report.sourceRefusal=await assertCurrentC2SourceRefusalUi({page,app,data,output,fixture,exportReport:result,pins});
  assert(report.sourceRefusal.success);assert.deepEqual(report.errors,[]);verify();report.success=true;
}catch(error){report.error={name:error.name,message:String(error.message).split(process.env.DEEPSEEK_API_KEY).join('[credential]').slice(0,2000)};
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{await app?.close().catch(()=>{});try{verify();report.integrityVerified=true;}catch(error){report.success=false;report.integrityError=String(error.message).slice(0,1200);}
  persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length}));}
if(!report.success)process.exitCode=1;
