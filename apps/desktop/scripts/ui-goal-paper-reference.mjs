/** C2a QA preparation. Default/--check is offline, zero-model and no persistence.
 * C2b/c are explicitly excluded until implemented and independently accepted.
 * Uses the actual C2a API/selectors; actual execution awaits Sol's source freeze.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeReferenceFixtures,readReferenceTruth,writeReferenceFixtures} from './acceptance/paper-reference-fixtures.mjs';
import {sha256} from './acceptance/evidence.mjs';
import {readPort,until,jsonEqual} from './acceptance/paper-export-intent-evidence.mjs';
import {sourceParserPreflight} from './acceptance/paper-reference-evidence.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const budget=Object.freeze({modelCalls:0,composerSends:0,officeWrites:0,templateSaves:0,templateApplications:0});
export const command='node scripts/ui-goal-paper-reference.mjs --run-ui --expect-build=<parent-frozen-C2a-full-out-sha256> --from=test-results/ui-goal-paper-export-intent-mOHpzM';
export function parseArgs(argv) {
  assert(argv.every(arg=>['--check','--prepare-fixtures','--run-ui'].includes(arg)||arg.startsWith('--expect-build=')||arg.startsWith('--from=')),'Unknown C2a QA argument; no --live/model mode exists');
  assert.equal(new Set(argv.map(arg=>arg.split('=')[0])).size,argv.length,'Duplicate C2a QA argument');
  const check=argv.includes('--check'),prepare=argv.includes('--prepare-fixtures'),run=argv.includes('--run-ui');
  assert(Number(check)+Number(prepare)+Number(run)<=1,'Choose offline check, fixture preparation or actual UI');
  const expectedBuild=argv.find(arg=>arg.startsWith('--expect-build='))?.slice(15),from=argv.find(arg=>arg.startsWith('--from='))?.slice(7);
  if(run){assert.match(expectedBuild||'',/^[a-f0-9]{64}$/i,'Actual C2a requires a pinned full build fingerprint');assert(from,'Parent must name the owned UI-created baseline copy');}
  else assert(expectedBuild===undefined&&from===undefined,'Build and baseline arguments belong to --run-ui only');
  return {prepare,run,expectedBuild:expectedBuild?.toLowerCase(),from};
}
/** Whole-row hashes detect changed revisions/content/confirmations, not only counts.
 * Run ONLY against the independent copied data, after legitimate import has settled.
 */
export function protectedFacts(read) {
  const tables=['paper_baskets','paper_basket_operations','question_bank_items','ai_confirmation_items','ai_conversation_messages',
    'xiaozhi_pi_commands','xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs','xiaozhi_pi_office_drafts','document_artifacts','document_artifact_paper_sources','document_artifact_sources'];
  return Object.fromEntries(tables.map(table=>{const rows=read('SELECT * FROM '+table+' ORDER BY rowid');return [table,{count:rows.length,sha256:sha256(JSON.stringify(rows))}];}));
}
export function assertCanceledUnchanged(before,after){jsonEqual(after,before,'C2a edit/cancel changed a protected domain fact');}
export async function checkOffline() {
  const checks=[];
  assert.deepEqual(parseArgs([]),{prepare:false,run:false,expectedBuild:undefined,from:undefined});
  for(const args of [['--live'],['--run-ui'],['--run-ui','--expect-build='+'a'.repeat(64)],['--check','--prepare-fixtures'],['--check','--check'],['--from=private']])assert.throws(()=>parseArgs(args));
  assert(parseArgs(['--run-ui','--expect-build='+'a'.repeat(64),'--from=test-results/parent-owned-ui-baseline']).run);checks.push('default offline; explicit actual opt-in, build pin and owned baseline required');
  const fixtures=await makeReferenceFixtures(),truth=readReferenceTruth(fixtures);
  assert.deepEqual(fixtures.map(f=>f.format),['txt','docx']);assert.notEqual(truth[0].inputSha256,truth[1].inputSha256);
  checks.push('two actual UTF-8/OOXML byte payloads independently read with Python stdlib, ZIP CRC and native XML');
  const repeated=await makeReferenceFixtures();assert.deepEqual(fixtures.map(f=>f.bytes),repeated.map(f=>f.bytes));checks.push('same input marker yields byte-identical TXT/DOCX for a stable fixture freeze');
  assert.notDeepEqual(truth[0].facts.sections,truth[1].facts.sections);assert.notEqual(truth[0].facts.totalPoints,truth[1].facts.totalPoints);
  assert.notEqual(truth[0].facts.durationMinutes,truth[1].facts.durationMinutes);assert.notEqual(truth[0].facts.questionNumbers.length,truth[1].facts.questionNumbers.length);
  for(const f of fixtures){assert(!f.fileName.includes(f.expected.subject));assert(!f.fileName.includes(f.expected.totalPoints+'分'));}
  checks.push('A/B differ in real body structure/count/score/time; misleading filenames cannot supply correct values');
  assert(truth[0].evidence.sections[1].start>1200,'Late section must be beyond the existing first source chunk');
  for(const t of truth)for(const span of [...Object.values(t.evidence).filter(v=>!Array.isArray(v)),...t.evidence.sections])assert.equal(t.body.slice(span.start,span.end),span.quote);
  checks.push('independent evidence spans point into actual body; late TXT section tests full-source coverage');
  for(const t of truth){assert.equal(t.facts.difficulty,null);assert.equal(t.facts.knowledgePoint,null);}
  assert.equal(truth[0].facts.layout,null);assert.deepEqual(truth[1].facts.layout,fixtures[1].expected.layout);
  checks.push('missing difficulty/knowledge/layout remain unknown; DOCX A4/orientation/columns/margins come from native sectPr');
  const changed=await makeReferenceFixtures('C2A_CHANGED');const other=readReferenceTruth(changed);
  assert.notEqual(other[0].inputSha256,truth[0].inputSha256);assert.notEqual(other[1].inputSha256,truth[1].inputSha256);
  assert.notEqual(other[0].bodySha256,truth[0].bodySha256);assert.notEqual(other[1].documentXmlSha256,truth[1].documentXmlSha256);
  checks.push('changed source bytes and real DOCX document XML produce distinct source digests');
  assert.throws(()=>readPort('must-not-open.db')('UPDATE paper_baskets SET revision=0'),/SELECT-only/);
  const before=protectedFacts(()=>[{id:'pure-cancel-probe',revision:4}]);assertCanceledUnchanged(before,structuredClone(before));
  for(const table of Object.keys(before))assert.throws(()=>assertCanceledUnchanged(before,{...before,[table]:{count:before[table].count,sha256:'changed-at-same-count'}}));
  checks.push('SELECT-only observer; cancellation detects changed content/revision/command/message/grant at unchanged counts');
  await assert.rejects(until(async()=>false,'C2a offline false',20),/D1 timeout/);
  await assert.rejects(until(async()=>({ready:true}),'C2a offline nonboolean',20),/must resolve to a boolean/);
  checks.push('awaited strict-boolean readiness rejects async false and truthy objects');
  const contract=path.resolve(desktop,'../../docs/audit/ui-goal-20261101/U4_C2_CONTRACT.md');
  assert(fs.readFileSync(contract,'utf8').includes('C2a真实候选'));assert.deepEqual(budget,{modelCalls:0,composerSends:0,officeWrites:0,templateSaves:0,templateApplications:0});
  checks.push('C2a-only budget; no C2b save/application or C2c Office acceptance claimed');
  const sourcePreflight=await sourceParserPreflight(fixtures,truth);
  checks.push('real current source splitter/DOCX parser/reference extractor matches independent byte truth and native layout evidence; pure no-persistence scope');
  const {assertReferenceEvidenceValues,assertReferenceFieldValue}=await import('./acceptance/paper-reference-ui.mjs');
  const verbatim=['正文第一行\n第二行 <x> & 原文','<w:sectPr><w:cols w:num="2"/></w:sectPr>'];let valueReads=0;
  const textAreas=(texts,readOnly=true)=>({locator:selector=>{
    assert.equal(selector,'textarea');return {count:async()=>texts.length,nth:index=>({waitFor:async()=>{},count:async()=>1,isVisible:async()=>true,
      evaluate:async predicate=>predicate({tagName:'TEXTAREA',readOnly,disabled:false}),inputValue:async()=>{valueReads++;return texts[index];}})};
  }});
  await assertReferenceEvidenceValues(textAreas(verbatim),verbatim);assert.equal(valueReads,2);
  await assert.rejects(assertReferenceEvidenceValues(textAreas(verbatim),[verbatim[0].replace('\n',' '),verbatim[1]]),/exact candidate text/);
  await assert.rejects(assertReferenceEvidenceValues(textAreas(verbatim,false),verbatim),/readonly TextArea/);
  await assert.rejects(assertReferenceEvidenceValues(textAreas([]),verbatim),/TextArea count/);
  checks.push('offline locator adapter: readonly TextArea count/property and inputValue preserve exact multiline/XML evidence; mutation/flattening/missing values fail');
  for(const [fieldPath,key,label]of [['layout.paper','A4','A4'],['layout.orientation','landscape','横向'],['layout.orientation','portrait','竖向'],['layout.columns','2','双栏'],['layout.columns','1','单栏'],['layout.paper','','待选择']]) {
    let open=false,closed=0,optionLabel=label,triggerLabel=label;
    const selected={waitFor:async()=>{},count:async()=>1,isVisible:async()=>open,getAttribute:async name=>{assert.equal(name,'data-option-id');return key;},innerText:async()=>optionLabel};
    const list={waitFor:async({state})=>{if(state==='hidden')assert.equal(open,false);},count:async()=>1,isVisible:async()=>open,
      getByRole:(role,options)=>{assert.equal(role,'option');assert.deepEqual(options,{selected:true});return selected;}};
    const page={getByRole:role=>{assert.equal(role,'listbox');return list;},keyboard:{press:async key=>{assert.equal(key,'Escape');open=false;closed++;}}};
    const input={getAttribute:async name=>{assert.equal(name,'data-slot');return 'select-trigger';},focus:async()=>{},press:async key=>{assert.equal(key,'Enter');open=true;},innerText:async()=>triggerLabel};
    await assertReferenceFieldValue(page,fieldPath,input,key);assert.equal(closed,1);
    await assert.rejects(assertReferenceFieldValue(page,fieldPath,input,key+'wrong'),/Exact selected reference choice label|Exact current reference field/);assert.equal(closed,2);
    optionLabel='wrong';await assert.rejects(assertReferenceFieldValue(page,fieldPath,input,key),/Exact selected reference choice label/);assert.equal(closed,3);
    optionLabel=label;triggerLabel='wrong';await assert.rejects(assertReferenceFieldValue(page,fieldPath,input,key),/Exact displayed reference trigger label/);assert.equal(closed,4);
  }
  const input={evaluate:async predicate=>predicate({tagName:'INPUT'}),inputValue:async()=>verbatim[0]};
  await assertReferenceFieldValue(undefined,'title',input,verbatim[0]);
  await assert.rejects(assertReferenceFieldValue(undefined,'title',input,'wrong'),/Exact current reference field/);
  checks.push('offline locator adapter: Input value and PaperSelect selected data-option-id, option/trigger Chinese labels including unknown empty value are exact; wrong key/label fails and Escape closes inspection without selection');
  return {success:true,productAcceptance:false,execution:false,persistence:false,modelCalls:0,checks,contractSha256:sha256(fs.readFileSync(contract)),
    fixtures:fixtures.map((f,index)=>({key:f.key,format:f.format,fileName:f.fileName,bytes:f.bytes.length,sha256:truth[index].inputSha256,bodySha256:truth[index].bodySha256,expected:f.expected})),
    sourcePreflight,pending:'Actual UI execution awaits Sol final source freeze and the parent pinned build; no production behavior is mocked'};
}
export async function main(argv=process.argv.slice(2)) {
  const options=parseArgs(argv),offline=await checkOffline();
  if(options.run){const {runReferenceUi}=await import('./acceptance/paper-reference-ui.mjs');return runReferenceUi({desktop,options,offline,budget,protectedFacts,assertCanceledUnchanged});}
  let output;
  if(options.prepare){
    const root=fs.realpathSync(path.join(desktop,'test-results'));output=fs.mkdtempSync(path.join(root,'ui-goal-paper-reference-offline-'));
    const fixtures=await makeReferenceFixtures(),truth=readReferenceTruth(fixtures);
    writeReferenceFixtures(path.join(output,'inputs'),fixtures,truth);
    const files=['scripts/ui-goal-paper-reference.mjs','scripts/acceptance/paper-reference-fixtures.mjs','scripts/acceptance/paper-reference-evidence.mjs','scripts/acceptance/paper-reference-ui.mjs'];
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success:true,productAcceptance:false,scope:'offline QA and controlled input preparation only',output,offline,budget,
      hashes:Object.fromEntries(files.map(file=>[file,sha256(fs.readFileSync(path.join(desktop,file)))])),actualReady:'adapter-prepared-parent-freeze-and-execution-pending'},null,2),{flag:'wx'});
  }
  console.log(JSON.stringify({preparedOnly:true,output,command,budget,offline,actualReady:'adapter-prepared-parent-freeze-and-execution-pending'}));return offline;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
