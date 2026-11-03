/** Parent runner: exactly one D1-copy launch, one UI submission, no retries.
 * Default/--check is inert. No build command or provider invocation in check mode.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const paperAdaptationParentCommand='node scripts/ui-final-paper-adaptation-live.mjs --run-ui --live --pins=<owned-freeze-json>';
export async function main(argv=process.argv.slice(2)){
 if(!argv.includes('--run-ui')){
  assert(argv.every(arg=>arg==='--check'),'Use --check, or explicit --run-ui --live --pins=<owned-json>');
  const contract={preparedOnly:true,execution:false,launches:0,modelSubmissions:0,
   liveBudget:{parentLaunches:1,modelSubmissions:1,retries:0},command:paperAdaptationParentCommand,
   pins:'Existing owned test-results JSON with buildRoot/build/source SHA256 fields',
   baseline:'Exact completed D1 test-results/ui-goal-paper-export-intent-mOHpzM; copied data and profile, originals untouched',
   gate:{request:'<output>/paper-adaptation-review.request.json',receipt:'<output>/paper-adaptation-review.receipt.json',
    schemaVersion:'xiaozhi.qa.paper-adaptation-review-receipt.v1',
    fields:['schemaVersion','requestId','digest','decision=approve|reject','reviewerType=human|parent_qa','reviewer','reviewedAt','rationale','reviewed','checks'],
    checks:['parentLineage','requirements','stemAndOptions','uniqueAnswer','analysis'],timeoutMs:600000,
    instruction:'Actual human or parent QA must inspect request + screenshot and write the exact matching receipt. Runner never creates/approves a receipt.'},
   offlineLimitation:'Syntax/check preparation only; actual helper selectors/provider path are not certified by this command'};
  console.log(JSON.stringify(contract,null,2));return contract;
 }
 assert(argv.includes('--live')&&argv.filter(v=>v.startsWith('--pins=')).length===1,'Require explicit live flag and one pins file');
 assert(argv.every(v=>['--run-ui','--live'].includes(v)||/^--pins=.+/.test(v)),'Unknown or mixed check/live arguments');
 assert(process.env.DEEPSEEK_API_KEY,'Inherited DEEPSEEK_API_KEY is required; its value is never logged');
 const [{_electron:electron},{fingerprint},{assertIsolatedPiMain},{copyC2OfficeBaseline},
  {runPaperAdaptationLiveUi},{paperAdaptationParentReviewGate}]=await Promise.all([
  import('playwright'),import('./acceptance/evidence.mjs'),import('./acceptance/build-root.mjs'),
  import('./ui-final-resume-c2-office.mjs'),import('./acceptance/paper-adaptation-live-ui.mjs'),
  import('./acceptance/paper-adaptation-parent-review-gate.mjs')]);
 const owned=fs.realpathSync(path.join(desktop,'test-results'));
 const pinFile=fs.realpathSync(argv.find(v=>v.startsWith('--pins=')).slice(7));assert(pinFile.startsWith(owned+path.sep),'Pins must be owned test-results');
 const pins=JSON.parse(fs.readFileSync(pinFile,'utf8'));
 for(const key of ['source','build'])assert.match(pins[key]??'',/^[a-f0-9]{64}$/i);
 const buildRoot=fs.realpathSync(pins.buildRoot),dailyOut=fs.realpathSync(path.join(desktop,'out'));
 assert(buildRoot===dailyOut||buildRoot.startsWith(owned+path.sep),'Only daily out or owned frozen builds');
 const mainFile=path.join(buildRoot,'main/index.js');assert(fs.statSync(mainFile).isFile());
 const sourceRoot=path.join(desktop,'src'),scriptsRoot=path.join(desktop,'scripts');
 const scriptPin=fingerprint(scriptsRoot).sha256;
 const observePins=()=>({build:fingerprint(buildRoot).sha256,source:fingerprint(sourceRoot).sha256,scripts:fingerprint(scriptsRoot).sha256});
 const verifyPins=()=>{const now=observePins();assert.equal(now.build,pins.build,'Frozen out changed');assert.equal(now.source,pins.source,'Frozen production source changed');assert.equal(now.scripts,scriptPin,'Frozen QA scripts changed');return now;};
 const before=verifyPins();
 const output=fs.mkdtempSync(path.join(owned,'ui-final-paper-adaptation-live-'));
 const report={success:false,scope:'A27-actual-single-run-designated-entry-adaptation',output,pinFile,
  pins:{buildRoot,build:pins.build,source:pins.source},pinsBefore:before,
  budget:{parentLaunches:1,modelSubmissions:1,retries:0},launchAttempts:0,launches:[],errors:[],checks:[]};
 const secrets=[...new Set(Object.entries(process.env).filter(([key,value])=>/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)&&value&&value.length>=8).map(([,value])=>value))];
 const redact=value=>secrets.reduce((text,secret)=>text.split(secret).join('[credential]'),String(value));
 const sanitized=value=>JSON.parse(redact(JSON.stringify(value)));
 const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(sanitized(report),null,2));
 let app,page,proof;
 try{
  console.log(JSON.stringify({phase:'A27-predeclared-live-budget',output,budget:report.budget}));persist();
  proof=copyC2OfficeBaseline({output});report.baseline=proof;
  verifyPins();
  const env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:proof.data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  report.launchAttempts++;assert.equal(report.launchAttempts,1);persist();
  app=await electron.launch({args:[mainFile,'--user-data-dir='+proof.profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
  report.launches.push(await assertIsolatedPiMain(app,mainFile,proof.profile));
  page=await app.firstWindow();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>{report.errors.push({kind:'pageerror',message:redact(error.message).slice(0,2000)});persist();});
  page.on('console',message=>{if(message.type()==='error'){report.errors.push({kind:'console.error',message:redact(message.text()).slice(0,2000)});persist();}});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  assert.equal(fs.realpathSync(await page.evaluate(()=>window.omniEdu.getDataRoot())),fs.realpathSync(proof.data),'Observe the actual launched D1 copy');
  const notebook=await page.evaluate(()=>window.omniEdu.listQuestionNotebook({subject:'数学',grade:'初二',questionType:'选择题',offset:0,limit:100}));
  const known=notebook.items.find(q=>q.sourceKind==='local_bank'&&q.stem&&q.answer);assert(known,'D1 must expose a real original-bank 初二数学选择题');
  const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),known.id);assert.equal(question?.id,known.id);assert.equal(question.sourceKind,'local_bank');
  report.originalQuestionId=question.id;verifyPins();
  const reviewCandidate=paperAdaptationParentReviewGate(output,{pins,verifyPins,onEvidence:gate=>{report.reviewGate=gate;persist();}});
  const result=await runPaperAdaptationLiveUi({page,app,data:proof.data,output,report,question,live:true,reviewCandidate});
  assert(result.success);assert.equal(result.modelSubmissions,1);assert.equal(result.retries,0);assert.equal(result.helperLaunches,0);
  assert.equal(report.reviewGate?.status,'external-approved','No candidate confirmation without external actual review');
  report.checks=result.checks;assert.deepEqual(report.errors,[]);verifyPins();report.success=true;
 }catch(error){report.error={name:error.name,message:redact(error.message).slice(0,4000)};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'runner-failure.png')}).catch(()=>{});
 }finally{
  if(app)try{await app.close();}catch(error){report.success=false;report.closeError=redact(error.message).slice(0,2000);}
  try{report.pinsAfter=verifyPins();if(proof){report.baselineAfter=fingerprint(proof.original).sha256;assert.equal(report.baselineAfter,proof.originalBefore,'Original D1 source changed');}report.integrityVerified=true;}
  catch(error){report.success=false;report.integrityError=redact(error.message).slice(0,2000);}
  const helperReport=path.join(output,'paper-adaptation-live-report.json');
  if(fs.existsSync(helperReport)){const text=fs.readFileSync(helperReport,'utf8');fs.writeFileSync(helperReport,redact(text));}
  persist();console.log(JSON.stringify({success:report.success,output,launchAttempts:report.launchAttempts,
   modelSubmissions:report.paperAdaptation?.modelSubmissions??0,checks:report.checks.length,integrityVerified:report.integrityVerified??false}));
 }
 if(!report.success)process.exitCode=1;
 return sanitized(report);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
