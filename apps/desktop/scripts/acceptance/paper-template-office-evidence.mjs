/** C2/v7-only assertions. Legacy V2/v6 defaults are unchanged. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sha256} from './evidence.mjs';
import {jsonEqual as equal} from './paper-export-intent-evidence.mjs';
import {assertSixExportMatrix,validateExportExpectations,assertExportInvariants,readSavedExportFacts} from './paper-instance-export-readback.mjs';
export function assertCurrentC2Snapshot(paper,basket){
  assert.equal(basket.purpose,'paper');assert.equal(basket.paperRequirements,'provided');assert.equal(paper.purpose,'paper');assert.equal(basket.schemaVersion,'xiaozhi.paper-basket.v2');equal(paper.blueprint,basket.blueprint);
  assert.equal(basket.persistedSchemaVersion,'xiaozhi.paper-basket.c2.v1');assert.equal(paper.snapshotSchema,'xiaozhi.paper-basket-snapshot.c2.v1');
  assert(paper.state==='confirmed'&&paper.complete&&paper.sourceCurrent&&paper.exportCurrent===true);assert.equal(paper.answerVerified,false);assert.match(paper.digest,/^[a-f0-9]{64}$/);
  equal(paper.c2,basket.c2);assert(paper.c2.layout&&paper.c2.structureTemplate&&paper.c2.layoutTemplate);assert.equal(paper.c2.layout.schemaVersion,'xiaozhi.paper-layout.v1');assert.equal(paper.c2.layout.paper,'A4');assert.equal(paper.c2.layout.orientation,'portrait','This narrow Pi fixture uses current portrait/two-column layout only');assert.equal(paper.c2.layout.columns,2);
  assert(paper.c2.retainedSections.every(r=>r.released&&!r.entryIds.length));assert(!paper.c2.unknownRetainedSections?.some(r=>!r.released));
  assert.equal(paper.basket.basketId,basket.id);assert.equal(paper.basket.basketRevision,basket.revision);equal(paper.basket.entryIds,paper.selection.items.map(i=>i.entryId));assert.equal(paper.selection.items.length,basket.entries.length);assert(basket.entries.length);
  for(const item of paper.selection.items){const e=basket.entries.find(e=>e.entryId===item.entryId);assert(e&&e.reviewCurrent&&!e.deliveryBlock&&e.availability.available);equal(item.instance,e.instance);equal(item.question,e.question);assert.equal(item.sectionId,e.sectionId);assert.equal(item.points,paper.c2.entryPoints[e.entryId]);const i=item.instance;assert.equal(i.entryId,item.entryId);assert.equal(i.review.action,'confirm');assert.equal(i.review.instanceRevision,i.instanceRevision);assert.equal(i.review.contentDigest,i.contentDigest);equal(i.review.sourceBinding,i.sourceBinding);assert.equal(i.sourceBinding.questionId,item.source.questionId);assert.equal(i.sourceBinding.sourceVersion,item.source.version);assert.equal(e.contentVersion,item.source.version);}
  equal(paper.templateSources.map(s=>s.template),[paper.c2.structureTemplate,paper.c2.layoutTemplate]);for(const s of paper.templateSources){assert.match(s.candidateDigest,/^[a-f0-9]{64}$/);assert.match(s.source.version,/^[a-f0-9]{64}$/);assert(s.source.complete&&s.source.units.length);}
}
export function assertCurrentC2Draft(paper,draft,spec){assert.equal(draft.schemaVersion,'xiaozhi.office-paper-draft.v7');equal(draft.paperSource,{paperId:paper.id,digest:paper.digest,audience:spec.audience,template:spec.template,printLayout:'xiaozhi.paper-print.a4.v1',snapshotSchema:paper.snapshotSchema,layout:paper.c2.layout});}
export function collectCurrentC2Manifest(input){
  const {paper,basket,files,expectations,before,workspace,sourceFiles=[]}=input;assertCurrentC2Snapshot(paper,basket);assertSixExportMatrix(files);validateExportExpectations(expectations);assert(before);const after=assertExportInvariants(before);
  equal(before.scope,{dbPath:path.resolve(input.dbPath),sessionId:input.sessionId,basketId:basket.id,otherBasketId:before.scope.otherBasketId,paperId:paper.id,historyPaperIds:before.scope.historyPaperIds},'Invariant scope differs');
  const outputs=readSavedExportFacts({...input,evidenceProtocol:'c2-v7'}).map(f=>({...f,...expectations[f.kind]}));
  // Existing independent text/image/order reader is explicitly portrait-only.
  // This fixture is portrait; separate mandatory layout readback checks columns/margins.
  return {schemaVersion:'u4b.paper-instance-export-readback.v1',scope:'actual-C2-v7-current-confirmed-layout-only',productAcceptance:false,workspace:fs.realpathSync(workspace),paper:{id:paper.id,digest:paper.digest,basket:paper.basket,snapshotSchema:paper.snapshotSchema,c2:paper.c2,templateSources:paper.templateSources},files:outputs,invariants:{before,after},sourceHashes:sourceFiles.map(f=>({path:f,sha256:sha256(fs.readFileSync(f))}))};
}
export async function readCurrentC2Layout({manifest,output,python=process.env.OMNI_EDU_FIXTURE_PYTHON??'python'}){
  const input=path.join(output,'c2-layout-manifest.json'),report=path.join(output,'c2-layout-readback.json');fs.writeFileSync(input,JSON.stringify(manifest),{flag:'wx'});
  await promisify(execFile)(python,[fileURLToPath(new URL('./paper-template-office-layout.py',import.meta.url)),input,report],{windowsHide:true,timeout:120000});const value=JSON.parse(fs.readFileSync(report));assert.equal(value.success,true);return value;
}
