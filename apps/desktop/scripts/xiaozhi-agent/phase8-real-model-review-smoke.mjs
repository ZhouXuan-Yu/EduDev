import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {schedule, sha256, syntheticFiles} from './phase8-real-model-plan.mjs';
import {createReviewTemplate, summarizeReviews} from './phase8-real-model-review.mjs';
import {exportBlindBundle, readOriginalRecords} from './phase8-real-model-readback.mjs';
import {createArchivedSupplement} from './phase8-archived-readback.mjs';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-independent-review-'));
const checks = [];
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
function check(name, action) {
  try {action(); checks.push({name, pass: true});}
  catch (error) {checks.push({name, pass: false, error: error.stack});}
  console.log(JSON.stringify(checks.at(-1)));
}
function fixture(name) {
  const root = path.join(output, name), blind = path.join(root, 'blind-samples'); fs.mkdirSync(blind, {recursive: true});
  const summary = {mode: 'execute', collectionStatus: 'PASS', stoppedAt: null, plannedRunIds: schedule.map(row => row.id), results: []};
  const identities = [];
  for (const [index, row] of schedule.entries()) {
    const runRoot = path.join(root, row.id); fs.mkdirSync(runRoot);
    const file = path.join(runRoot, 'synthetic.txt'); fs.writeFileSync(file, 'synthetic ' + row.id);
    const receipt = {...row, collectionStatus: 'PASS', terminal: 'completed', qualityStatus: 'NOT_TESTED',
      answer: 'Synthetic anonymous answer ' + index, artifacts: [{path: file, relativePath: 'synthetic.txt', sha256: sha256(fs.readFileSync(file))}]};
    write(path.join(runRoot, 'report.json'), receipt);
    summary.results.push({id: row.id, collectionStatus: 'PASS', terminal: receipt.terminal, qualityStatus: receipt.qualityStatus,
      receiptSha256: sha256(fs.readFileSync(path.join(runRoot, 'report.json')))});
    const id = 'sample-' + String(index).padStart(2, '0'), sampleRoot = path.join(blind, id);
    fs.mkdirSync(path.join(sampleRoot, 'artifacts'), {recursive: true}); fs.copyFileSync(file, path.join(sampleRoot, 'artifacts', 'synthetic.txt'));
    const sampleFile = path.join(sampleRoot, 'sample.json');
    write(sampleFile, {id, task: row.task, answer: receipt.answer, artifacts: [{relativePath: 'artifacts/synthetic.txt', sha256: receipt.artifacts[0].sha256}], scoringStatus: 'NOT_TESTED'});
    identities.push({sampleId: id, executionId: row.id, version: row.version, round: row.round, sampleSha256: sha256(fs.readFileSync(sampleFile))});
  }
  function save() {
    write(path.join(root, 'blind-identity-map.json'), identities);
    summary.identityMapSha256 = sha256(fs.readFileSync(path.join(root, 'blind-identity-map.json')));
    write(path.join(root, 'summary.json'), summary);
  }
  function resealReceipts() {
    for (const row of summary.results) row.receiptSha256 = row.collectionStatus === 'NOT_TESTED' ? null
      : sha256(fs.readFileSync(path.join(root, row.id, 'report.json')));
  }
  save();
  const reviewFile = path.join(output, name + '-review.json'), reportFile = path.join(output, name + '-report.json');
  const review = createReviewTemplate(blind, reviewFile);
  function grade() {
    review.reviewer = {name: 'Synthetic independent reviewer fixture', independent: true, blindingLimitations: 'Synthetic test only'};
    for (const row of review.samples) {
      for (const criterion of row.criteria) {criterion.score = 2; criterion.reason = 'Fixture-authored reason'; criterion.evidenceRefs = [row.evidence[0]];}
      for (const defect of row.hardDefects) {defect.status = 'ABSENT'; defect.reason = 'Fixture-authored check'; defect.evidenceRefs = [row.evidence[0]];}
    }
    write(reviewFile, review);
  }
  return {root, blind, summary, identities, save, resealReceipts, review, reviewFile, reportFile, grade,
    summarize: () => {write(reviewFile, review); return summarizeReviews(root, reviewFile, reportFile);}};
}

check('32-entry paired report joins independently authored grades; A failure and B−A remain visible', () => {
  const f = fixture('happy'); f.grade(); f.review.samples[0].criteria[0].score = 0;
  const report = f.summarize();
  assert.equal(report.groups.length, 8); assert(report.groups.every(group => group.rows.length === 4 && group.pairs.length === 2));
  assert.equal(report.reviewStatus, 'COMPLETE'); assert.equal(report.bPresetQuality, 'MEETS_PRESET_QUALITY');
  assert.equal(report.groups[0].rows[0].result, 'FAIL'); assert.equal(report.groups[0].pairs[0].scoreDeltaBMinusA, 2);
  assert.equal(report.groups[0].rows[0].grade.authoredReview.criteria[0].reason, 'Fixture-authored reason');
});
check('Template reads anonymous samples without parent map, has blank scores and hashes, and refuses overwrite', () => {
  const f = fixture('template'); fs.unlinkSync(path.join(f.root, 'blind-identity-map.json'));
  const file = path.join(output, 'detached-template.json'), value = createReviewTemplate(f.blind, file);
  assert(value.samples.every(row => row.criteria.every(item => item.score === null) && row.hardDefects.every(item => item.status === null)));
  assert(value.samples.every(row => !['version', 'round', 'executionId'].some(key => Object.hasOwn(row, key))));
  assert.equal(value.samples[0].evidence[0].path, 'sample.json');
  assert.throws(() => createReviewTemplate(f.blind, file), /output_exists/);
});
check('Blank/missing grades produce explicit incomplete results and no paired deltas', () => {
  const f = fixture('partial'); f.review.samples.pop(); const report = f.summarize();
  assert.equal(report.reviewStatus, 'REVIEW_INCOMPLETE'); assert.equal(report.bPresetQuality, 'REVIEW_INCOMPLETE');
  assert(report.groups.every(group => group.pairs.every(pair => pair.scoreDeltaBMinusA === null)));
});
check('UNKNOWN hard violations cannot be absorbed by 10/10; PRESENT hard errors fail independently', () => {
  const f = fixture('unknown'); f.grade(); f.review.samples[1].hardDefects[0].status = 'UNKNOWN';
  f.review.samples[2].hardDefects[3].status = 'PRESENT'; const report = f.summarize();
  assert.equal(report.groups[0].rows[1].grade.total, 10);
  assert.equal(report.groups[0].rows[1].result, 'REVIEW_INCOMPLETE');
  assert.equal(report.groups[0].rows[2].result, 'FAIL'); assert.equal(report.bPresetQuality, 'FAIL');
  assert.equal(report.groups[0].pairs[0].scoreDeltaBMinusA, null);
});
check('B first three criteria each require 2 even when total equals 9', () => {
  const f = fixture('threshold'); f.grade(); f.review.samples[1].criteria[2].score = 1;
  const report = f.summarize(); assert.equal(report.groups[0].rows[1].grade.total, 9); assert.equal(report.bPresetQuality, 'FAIL');
});
check('Original objective FAIL is preserved even when reviewer grades all 2', () => {
  const f = fixture('objective-fail'); f.grade(); f.summary.results[0].qualityStatus = 'FAIL';
  const file = path.join(f.root, schedule[0].id, 'report.json'), receipt = JSON.parse(fs.readFileSync(file)); receipt.qualityStatus = 'FAIL'; write(file, receipt); f.resealReceipts(); f.save();
  const report = f.summarize(); assert.equal(report.groups[0].rows[0].result, 'FAIL');
  assert.equal(report.groups[0].rows[0].grade.status, 'MEETS_PRESET_QUALITY');
});
check('Collection FAIL and NOT_TESTED remain distinct from review incompleteness', () => {
  const f = fixture('collection-fail'); f.grade();
  f.summary.collectionStatus = 'FAIL'; f.summary.stoppedAt = {id: schedule[30].id, code: 'fixture_stopped'};
  for (const index of [30, 31]) {
    f.summary.results[index].collectionStatus = index === 30 ? 'FAIL' : 'NOT_TESTED';
    if (index === 30) {
      const file = path.join(f.root, schedule[index].id, 'report.json'), receipt = JSON.parse(fs.readFileSync(file)); receipt.collectionStatus = 'FAIL'; write(file, receipt);
    }
    const identity = f.identities.find(item => item.executionId === schedule[index].id);
    fs.rmSync(path.join(f.blind, identity.sampleId), {recursive: true});
    f.review.samples = f.review.samples.filter(row => row.sampleId !== identity.sampleId);
    f.identities.splice(f.identities.indexOf(identity), 1);
  }
  f.resealReceipts(); f.save(); const report = f.summarize();
  assert.equal(report.collectionStatus, 'FAIL'); assert.equal(report.reviewStatus, 'REVIEW_INCOMPLETE');
  assert.equal(report.groups[7].rows[2].result, 'FAIL'); assert.equal(report.groups[7].rows[3].result, 'NOT_TESTED');
});
check('Refused/indeterminate independence cannot produce complete grading', () => {
  const f = fixture('refused-independent'); f.grade(); f.review.reviewer.independent = false;
  assert.equal(f.summarize().reviewStatus, 'REVIEW_INCOMPLETE');
});
check('Early failed collection with zero anonymous samples remains auditable', () => {
  const f = fixture('empty-packet');
  for (const name of fs.readdirSync(f.blind)) fs.rmSync(path.join(f.blind, name), {recursive: true});
  f.identities.splice(0); f.summary.collectionStatus = 'FAIL';
  f.summary.stoppedAt = {id: schedule[0].id, code: 'fixture_early_stop'};
  for (const [index, row] of f.summary.results.entries()) row.collectionStatus = index === 0 ? 'FAIL' : 'NOT_TESTED';
  const file = path.join(f.root, schedule[0].id, 'report.json'), receipt = JSON.parse(fs.readFileSync(file));
  receipt.collectionStatus = 'FAIL'; write(file, receipt); f.resealReceipts(); f.save();
  const empty = createReviewTemplate(f.blind, path.join(output, 'empty-blank.json')); assert.deepEqual(empty.samples, []);
  f.review.samples = empty.samples; const report = f.summarize();
  assert.equal(report.collectionStatus, 'FAIL'); assert.equal(report.reviewStatus, 'REVIEW_INCOMPLETE');
  assert.equal(report.groups[0].rows[0].result, 'FAIL');
  assert.equal(report.groups.flatMap(group => group.rows).filter(row => row.result === 'NOT_TESTED').length, 31);
  f.summary.results[1].receiptSha256 = 'a'.repeat(64); f.save();
  assert.throws(f.summarize, /invalid_original_receipt_seal/);
});
check('Q8 permission violation fails independently of perfect numerical criteria', () => {
  const f = fixture('q8-permission'); f.grade();
  f.review.samples[29].hardDefects.find(item => item.id === 'permissionViolation').status = 'PRESENT';
  const report = f.summarize(); assert.equal(report.groups[7].rows[1].grade.total, 10);
  assert.equal(report.groups[7].rows[1].result, 'FAIL'); assert.equal(report.bPresetQuality, 'FAIL');
});
check('Actual blind exporter receipts, copied artifacts and identity seals are compatible', () => {
  const f = fixture('actual-export');
  fs.rmSync(f.blind, {recursive: true});
  const receipts = schedule.map(row => JSON.parse(fs.readFileSync(path.join(f.root, row.id, 'report.json'))));
  const exported = exportBlindBundle(f.blind, receipts);
  f.summary.identityMapSha256 = exported.identityMapSha256; write(path.join(f.root, 'summary.json'), f.summary);
  const packet = createReviewTemplate(f.blind, path.join(output, 'actual-export-blank.json'));
  f.review.samples = packet.samples; f.grade();
  const report = f.summarize(); assert.equal(report.reviewStatus, 'COMPLETE');
});

const invalidCases = [
  ['preflight', f => {f.summary.mode = 'preflight'; f.save();}, /execute_collection_required/],
  ['short-schedule', f => {f.summary.plannedRunIds.pop(); f.save();}, /exact32_schedule_required/],
  ['duplicate-execution', f => {f.summary.results[1] = f.summary.results[0]; f.save();}, /exact32_schedule_required/],
  ['collection-pass-contradiction', f => {f.summary.results[31].collectionStatus = 'NOT_TESTED'; f.save();}, /collection_status_contradiction/],
  ['collection-stop-contradiction', f => {f.summary.collectionStatus = 'FAIL'; f.summary.stoppedAt = {id: schedule[0].id}; f.save();}, /collection_stop_contradiction/],
  ['duplicate-grade', f => {f.review.samples.push(f.review.samples[0]);}, /duplicate_or_unknown_grade/],
  ['unknown-grade', f => {f.review.samples[0].sampleId = 'sample-unknown';}, /duplicate_or_unknown_grade/],
  ['duplicate-criterion', f => {f.review.samples[0].criteria[1] = f.review.samples[0].criteria[0];}, /invalid_score/],
  ['missing-reason', f => {f.review.samples[0].criteria[0].reason = '';}, /grade_without_reason_or_evidence/],
  ['out-of-range', f => {f.review.samples[0].criteria[0].score = 3;}, /invalid_score/],
  ['wrong-ref', f => {f.review.samples[0].criteria[0].evidenceRefs = [{path: '../outside.json', sha256: 'a'.repeat(64)}];}, /invalid_evidence_ref/],
  ['defect-without-evidence', f => {f.review.samples[0].hardDefects[0].evidenceRefs = [];}, /defect_without_reason_or_evidence/],
  ['missing-defect', f => {f.review.samples[0].hardDefects.pop();}, /criteria_missing/],
  ['duplicate-pairing', f => {f.identities[1].sampleId = f.identities[0].sampleId; f.save();}, /invalid_or_duplicate_pairing/],
  ['wrong-version', f => {f.identities[0].version = 'B'; f.save();}, /invalid_or_duplicate_pairing/],
  ['missing-map-seal', f => {delete f.summary.identityMapSha256; write(path.join(f.root, 'summary.json'), f.summary);}, /identity_map_seal/],
  ['missing-receipt-seal', f => {delete f.summary.results[0].receiptSha256; f.save();}, /invalid_original_receipt_seal/],
  ['uppercase-receipt-seal', f => {f.summary.results[0].receiptSha256 = 'A'.repeat(64); f.save();}, /invalid_original_receipt_seal/],
  ['changed-uninspected-observation', f => {const file = path.join(f.root, schedule[0].id, 'report.json'), receipt = JSON.parse(fs.readFileSync(file)); receipt.observation = {uninspected: 'changed after collection'}; write(file, receipt);}, /original_receipt_seal_changed/],
  ['changed-map', f => {fs.appendFileSync(path.join(f.root, 'blind-identity-map.json'), ' ');}, /identity_map_seal/],
  ['changed-sample', f => {fs.appendFileSync(path.join(f.blind, 'sample-00', 'sample.json'), ' ');}, /invalid_or_duplicate_pairing/],
  ['changed-artifact', f => {fs.appendFileSync(path.join(f.blind, 'sample-00', 'artifacts', 'synthetic.txt'), 'changed');}, /artifact_changed/],
  ['changed-original', f => {fs.appendFileSync(path.join(f.root, schedule[0].id, 'synthetic.txt'), 'changed');}, /original_artifact_changed/],
  ['changed-binding', f => {f.review.samples[0].bindingSha256 = 'a'.repeat(64);}, /sample_binding_changed/],
  ['identified-sample', f => {const file = path.join(f.blind, 'sample-00', 'sample.json'), sample = JSON.parse(fs.readFileSync(file)); sample.version = 'A'; write(file, sample);}, /identified_sample/],
  ['artifact-path-escape', f => {const file = path.join(f.blind, 'sample-00', 'sample.json'), sample = JSON.parse(fs.readFileSync(file)); sample.artifacts[0].relativePath = 'artifacts/../../outside'; write(file, sample);}, /unsafe_path/],
];
for (const [name, mutate, pattern] of invalidCases) check('Reject ' + name, () => {
  const f = fixture('invalid-' + name); f.grade(); mutate(f);
  assert.throws(f.summarize, pattern); assert.equal(fs.existsSync(f.reportFile), false);
});
check('Reject sample directory junction before reading any linked content', () => {
  const f = fixture('symlink'), target = path.join(output, 'linked-sample');
  fs.renameSync(path.join(f.blind, 'sample-00'), target);
  fs.symlinkSync(target, path.join(f.blind, 'sample-00'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createReviewTemplate(f.blind, path.join(output, 'symlink-review.json')), /symlink/);
});
check('CLI template/summarize operate locally, return review status and refuse invalid actions', () => {
  const f = fixture('cli'); f.grade();
  const script = fileURLToPath(new URL('./phase8-real-model-review.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'summarize', f.root, f.reviewFile, f.reportFile], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).reviewStatus, 'COMPLETE');
  const bad = spawnSync(process.execPath, [script, 'score', f.root, f.reviewFile], {encoding: 'utf8'});
  assert.equal(bad.status, 1); assert.match(bad.stderr, /usage/);
  const template = spawnSync(process.execPath, [script, 'template', f.blind, path.join(output, 'cli-blank.json')], {encoding: 'utf8'});
  assert.equal(template.status, 0, template.stderr); assert.equal(JSON.parse(template.stdout).samples, 32);
});

function archivedFixture(name) {
  const root = path.join(output, name), row = schedule.find(item => item.id === 'Q8-r2-B');
  const run = path.join(root, row.id), workspace = path.join(run, 'workspace'), data = path.join(run, 'data');
  fs.mkdirSync(workspace, {recursive:true}); fs.mkdirSync(data);
  const file = path.join(workspace, 'facts.txt'); fs.writeFileSync(file, syntheticFiles['facts.txt']);
  const databasePath = path.join(data, 'app.db'), database = new DatabaseSync(databasePath);
  database.exec('CREATE TABLE ai_agent_runs (id, session_id, status, model)');
  database.prepare('INSERT INTO ai_agent_runs VALUES (?,?,?,?)').run('fixture.run', 'fixture.session', 'succeeded', 'fixture-model');
  database.close();
  const binding = {sessionId:'fixture.session', runId:'fixture.run', taskId:null};
  const receiptFile = path.join(run, 'report.json');
  const relative = {relativePath:'facts.txt',bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file))};
  const receipt = {...row, collectionStatus:'PASS', answer:'Anonymous synthetic answer', binding,
    snapshot:{projection:{turns:[{id:binding.runId}]}}, beforeFiles:[relative], artifacts:[{...relative,path:file}],
    coldRecords:readOriginalRecords(databasePath,binding.sessionId,binding.runId,{immutable:true}), decisions:[]};
  write(receiptFile,receipt);
  const blind = exportBlindBundle(path.join(root,'blind-samples'),[receipt]);
  const summaryFile = path.join(root,'summary.json');
  write(summaryFile,{mode:'correct',plannedRunIds:[row.id],identityMapSha256:blind.identityMapSha256,
    results:[{id:row.id,collectionStatus:'PASS',receiptSha256:sha256(fs.readFileSync(receiptFile))}]});
  const sampleRoot = path.join(root,'blind-samples',blind.samples[0].id);
  return {root,run,receiptFile,databasePath,sampleRoot,summaryHash:sha256(fs.readFileSync(summaryFile)),
    outputFile:path.join(output,name+'-supplement.json')};
}

check('Archive supplement reads the sealed sample and physical SQLite while hiding run identity and leaving privacy unverified', () => {
  const f = archivedFixture('archive-match');
  const original = sha256(fs.readFileSync(f.databasePath));
  const supplement = createArchivedSupplement(f.root,f.summaryHash,f.outputFile);
  const sample = supplement.samples[0];
  assert.equal(sample.observations.cold.status,'MATCHED');
  assert.equal(sample.observations.workspace['facts.txt'].matchesInitial,true);
  assert.equal(sample.observations.workspace['facts.txt'].presentAtCollectionStart,true);
  assert.equal(sample.observations.workspace['copy.txt'].present,false);
  assert.equal(sample.observations.workspace['copy.txt'].presentAtCollectionStart,false);
  assert.equal(sample.observations.artifacts.matched,1);
  assert.equal(sample.observations.upstreamPrivacyEvidence,'UNAVAILABLE_REQUEST_BODY_NOT_CAPTURED');
  assert.deepEqual(Object.keys(sample),['sampleId','task','sampleSha256','observations']);
  assert.doesNotMatch(fs.readFileSync(f.outputFile,'utf8'), /Q8-r2-B|fixture\.run|fixture-model/);
  assert.equal(sha256(fs.readFileSync(f.databasePath)),original);
});

check('Archive supplement refuses a wrong summary digest, changed original report and a write inside sealed evidence', () => {
  const f = archivedFixture('archive-seals');
  assert.throws(() => createArchivedSupplement(f.root,'0'.repeat(64),f.outputFile),/summary_seal/);
  assert.throws(() => createArchivedSupplement(f.root,f.summaryHash,path.join(f.run,'unwanted.json')),/output_inside_evidence/);
  fs.appendFileSync(f.receiptFile,' ');
  assert.throws(() => createArchivedSupplement(f.root,f.summaryHash,f.outputFile),/receipt_seal/);
  assert(!fs.existsSync(f.outputFile));
});

check('Archive supplement preserves a live journal boundary and flags a changed blind artifact', () => {
  const f = archivedFixture('archive-partial');
  fs.writeFileSync(f.databasePath+'-wal','fixture active WAL');
  fs.appendFileSync(path.join(f.sampleRoot,'artifacts','facts.txt'),'changed');
  const sample = createArchivedSupplement(f.root,f.summaryHash,f.outputFile).samples[0];
  assert.deepEqual(sample.observations.cold,{status:'UNAVAILABLE',reason:'uncheckpointed_database'});
  assert.equal(sample.observations.artifacts.matched,0);
  assert.equal(fs.readFileSync(f.databasePath+'-wal','utf8'),'fixture active WAL');
});

const report = {success: checks.every(check => check.pass), output, checks,
  realProviderCalls: 0, actualGoalLedgerOpened: false, boundary: 'Synthetic anonymous fixtures only; no UI, provider, production data or ledger.'};
write(path.join(output, 'report.json'), report);
console.log(JSON.stringify({success: report.success, passed: checks.filter(check => check.pass).length, total: checks.length, output}));
if (!report.success) process.exitCode = 1;
