/** Pure adapter regression checks; never business acceptance or a launch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertCurrentC2Draft,assertCurrentC2Snapshot} from './paper-template-office-evidence.mjs';
import {SIX_EXPORTS} from './paper-instance-export-readback.mjs';
import {c2OfficeBudget,c2OfficeContractHash,c2OfficeContractFiles,makeCurrentC2OfficeInputs,assertFormalC2Purpose,validateC2OfficeMatrixGate} from './paper-template-office-ui.mjs';
const digest='a'.repeat(64),layout={schemaVersion:'xiaozhi.paper-layout.v1',paper:'A4',orientation:'portrait',columns:2,margins:{top:200,bottom:150,left:250,right:200},columnGap:100};
const paper={id:'pure-assertion-input',digest,snapshotSchema:'xiaozhi.paper-basket-snapshot.c2.v1',c2:{layout}};
const fixtures=await makeCurrentC2OfficeInputs({subject:'数学',grade:'初二',questionType:'选择题'});const {readReferenceTruth}=await import('./paper-reference-fixtures.mjs');const truth=readReferenceTruth(fixtures,{python:process.env.OMNI_EDU_FIXTURE_PYTHON??'python'});assert.equal(truth.length,2);assert.equal(truth[1].facts.layout.columns,2);let rejected=0;
for(const spec of SIX_EXPORTS){
  const draft={schemaVersion:'xiaozhi.office-paper-draft.v7',paperSource:{paperId:paper.id,digest,audience:spec.audience,template:spec.template,snapshotSchema:paper.snapshotSchema,layout}};
  assertCurrentC2Draft(paper,draft,spec);
  for(const mutate of [d=>d.schemaVersion='xiaozhi.office-paper-draft.v6',d=>delete d.paperSource.template,d=>d.paperSource.digest='b'.repeat(64),d=>d.paperSource.layout={...layout,columns:1},d=>d.paperSource.snapshotSchema='xiaozhi.paper-basket-snapshot.v2']){
    const bad=structuredClone(draft);mutate(bad);assert.throws(()=>assertCurrentC2Draft(paper,bad,spec));rejected++;
  }
}
assert.throws(()=>assertCurrentC2Snapshot(paper,{persistedSchemaVersion:'xiaozhi.paper-basket.v2'}));rejected++;
assertFormalC2Purpose({purpose:'paper',paperRequirements:'provided'},{purpose:'paper'});for(const value of [{purpose:'practice',paperRequirements:'provided'},{purpose:'paper',paperRequirements:'required'},{paperRequirements:'provided'},{purpose:'paper',paperRequirements:'provided',fulfillment:{status:'confirmed'}}]){assert.throws(()=>assertFormalC2Purpose(value));rejected++;}assert.throws(()=>assertFormalC2Purpose({purpose:'paper',paperRequirements:'provided'},{purpose:'practice'}));rejected++;assert.throws(()=>validateC2OfficeMatrixGate({scenario:'A28-C2b-real-template-UI',success:false},{}));rejected++;
// Validator-only values stay in memory; never a persisted acceptance report.
const gatePins={source:'a'.repeat(64),build:'b'.repeat(64)},gate={scenario:'A28-C2b-real-template-UI',success:true,integrityVerified:true,errors:[],networkAttempts:[],launches:[{},{}],checks:[{name:'Cold startup',pass:true},{name:'source-byte change',pass:true}],operations:[...Array.from({length:6},()=>({kind:'save'})),...Array.from({length:3},()=>({kind:'apply'})),...Array.from({length:2},()=>({kind:'arrange'}))],pins:gatePins};
validateC2OfficeMatrixGate(gate,gatePins);
for(const mutate of [g=>g.pins.source='c'.repeat(64),g=>g.pins.build='c'.repeat(64),g=>g.integrityVerified=false,g=>g.operations.pop(),g=>g.launches.pop(),g=>g.checks[0].skipped=true,g=>g.errors.push({kind:'failure'}),g=>g.success=false]){const bad=structuredClone(gate);mutate(bad);assert.throws(()=>validateC2OfficeMatrixGate(bad,gatePins));rejected++;}
assert.deepEqual(c2OfficeBudget,{launchesByAdapter:0,modelSubmissions:6,successfulFiles:6,automaticRetries:0,imports:2,templateSaves:2,templateApplications:3});
assert.equal(new Set(SIX_EXPORTS.map(s=>s.kind+'.'+s.format)).size,6);
assert(c2OfficeContractFiles.length>=10);assert.match(c2OfficeContractHash(),/^[a-f0-9]{64}$/);
for(const file of ['paper-template-office-ui.mjs','paper-template-office-evidence.mjs']){
  const text=fs.readFileSync(new URL(file,import.meta.url),'utf8');assert(!/\.dispatchEvent\(|force\s*:\s*true|\.evaluate\([^\n]*(?:reviewEntry|applyPaperTemplates|savePaperTemplateVersion|confirmPaper|mutatePaper)/.test(text));
}
console.log(JSON.stringify({offline:true,success:true,execution:false,launches:0,providerRequests:0,rejectedMutations:rejected,budget:c2OfficeBudget,contractHash:c2OfficeContractHash(),coverage:'C2-only v7 binding guards and integration imports; no real UI or Office acceptance'}));
