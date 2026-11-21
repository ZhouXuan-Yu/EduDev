import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {schedule, sha256, syntheticFiles} from './phase8-real-model-plan.mjs';
import {confined, directory, newJson} from './phase8-real-model-review.mjs';
import {readOriginalRecords, readQ5SourceEvidence, verifiedRunBinding} from './phase8-real-model-readback.mjs';

const hash = /^[a-f0-9]{64}$/;
const sampleIdPattern = /^sample-[A-Za-z0-9-]+$/;
const checksMatch = (first, second) => JSON.stringify(first) === JSON.stringify(second);
function requireThat(proof, reason) {
  if (!proof) throw Error('phase8_archive_' + reason);
}
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function fileState(root, relative) {
  try {
    const bytes = fs.readFileSync(confined(root, relative));
    return {bytes: bytes.length, sha256: sha256(bytes)};
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function databaseState(runRoot) {
  return Object.fromEntries(['', '-wal', '-journal', '-shm'].map(suffix =>
    [suffix, fileState(runRoot, 'data/app.db' + suffix)]));
}

function observeWorkspace(runRoot, receipt, name) {
  const previously = receipt.beforeFiles?.find(file => file.relativePath === name);
  const expected = receipt.artifacts?.find(file => file.relativePath === name);
  const actual = fileState(runRoot, 'workspace/' + name);
  const sealMatches = expected
    ? Boolean(actual && actual.sha256 === expected.sha256 && actual.bytes === expected.bytes)
    : !actual;
  return {present: Boolean(actual), bytes: actual?.bytes ?? null,
    presentAtCollectionStart: Array.isArray(receipt.beforeFiles) ? Boolean(previously) : null,
    seal: sealMatches ? 'MATCHED' : 'DIFFERENT',
    matchesInitial: sealMatches && previously && actual ? actual.sha256 === previously.sha256 : null,
    matchesSyntheticInput: sealMatches && Object.hasOwn(syntheticFiles, name) && actual
      ? actual.sha256 === sha256(syntheticFiles[name]) : null,
    matchesRequestedText: name === 'practice.txt' && sealMatches && actual
      ? actual.sha256 === sha256('合成练习：3/4 + 1/4 = 1') : null};
}

function observeWorkspaceArtifacts(runRoot, receipt, sampleRoot, sample) {
  const files = Array.isArray(receipt.artifacts) ? receipt.artifacts : [];
  const verified = files.filter(file => file.path && !file.unsupported);
  requireThat(Array.isArray(sample.artifacts) && sample.artifacts.length === verified.length, 'artifact_count_mismatch');
  const byPath = new Map(sample.artifacts.map(item => [item.relativePath, item.sha256]));
  requireThat(byPath.size === verified.length, 'artifact_path_duplicate');
  let matched = 0;
  for (const file of verified) {
    const relative = path.relative(runRoot, path.resolve(file.path)).replaceAll('\\', '/');
    requireThat(relative === 'workspace/' + file.relativePath, 'artifact_outside_workspace');
    const detached = 'artifacts/' + file.relativePath;
    requireThat(byPath.get(detached) === file.sha256, 'artifact_sample_binding');
    const current = fileState(runRoot, relative);
    const blind = fileState(sampleRoot, detached);
    if (current?.sha256 === file.sha256 && current.bytes === file.bytes && blind?.sha256 === file.sha256) matched++;
  }
  return {sealed: verified.length, matched, unavailableAtCollection: files.length - verified.length};
}

function matchesQ5Seal(current, sealed) {
  if (checksMatch(current, sealed)) return true;
  // Some sealed runs predate the separate persistedMatched field. Their original
  // digest, source, native entry and HTTP observations must still agree exactly.
  const receipts = current.receipts.map((result, index) => {
    const old = sealed.receipts[index];
    if (!old || Object.hasOwn(old, 'persistedMatched')) return result;
    const {persistedMatched: _newObservation, ...originalFields} = result;
    return originalFields;
  });
  return checksMatch({...current, receipts}, sealed);
}

function observeColdStore(runRoot, receipt) {
  const before = databaseState(runRoot);
  if (!before['']) return {status:'UNAVAILABLE', reason:'database_missing'};
  if (before['-wal']?.bytes || before['-journal']?.bytes) {
    return {status:'UNAVAILABLE', reason:'uncheckpointed_database'};
  }
  let facts;
  try {
    const databasePath = confined(runRoot, 'data/app.db');
    const records = readOriginalRecords(databasePath, receipt.binding?.sessionId, receipt.binding?.runId, {immutable:true});
    const binding = verifiedRunBinding({...receipt.binding, snapshot:receipt.snapshot, records});
    requireThat(binding.taskId === receipt.binding.taskId, 'task_binding_changed');
    if (!checksMatch(records, receipt.coldRecords)) {
      facts = {status:'DIFFERENT', reason:'closed_store_differs_from_frozen_receipt'};
    } else {
      const accepted = state => ['executed', 'rejected', 'pending', 'approved', 'expired', 'stale', 'failed'].includes(state);
      facts = {
        status:'MATCHED', runStatus:records.runs[0].status, taskRecorded:Boolean(binding.taskId),
        toolReceipts:records.receipts.length, approvalRows:records.approvals.length,
        approvalStates:records.approvals.map(row => accepted(row.state) ? row.state : 'other').sort(),
        approvalExecutions:records.approvalAudit.filter(row => row.kind === 'approval_executed').length,
      };
      if (receipt.task === 'Q8') {
        const copyReceipts = records.receipts.filter(row => row.tool === 'office_copy_file');
        facts.copyToolReceipts = copyReceipts.length;
        facts.copyToolSuccesses = copyReceipts.filter(row => row.success === 1 || row.success === true).length;
      }
      if (receipt.task === 'Q5') {
        const segments = receipt.runSegments?.filter(segment => segment.coldQ5SourceEvidence) ?? [];
        const checked = segments.map(segment => {
          const owned = readOriginalRecords(databasePath, segment.binding.sessionId, segment.binding.runId, {immutable:true});
          verifiedRunBinding({...segment.binding, snapshot:segment.snapshot, records:owned});
          const current = readQ5SourceEvidence({databasePath, binding:segment.binding, records:owned, events:segment.rendererEvents,
            webpageHttpTiming:segment.webpageHttpTiming, immutable:true});
          return {matches:matchesQ5Seal(current, segment.coldQ5SourceEvidence), read:current.status === 'read'};
        });
        facts.fixedPublicRead = checked.some(item => item.matches && item.read) ? 'MATCHED_COMPLETE_GET_AND_NATIVE_RECEIPT'
          : checked.some(item => !item.matches) ? 'DIFFERENT' : 'UNVERIFIED';
      }
    }
  } catch {
    facts = {status:'UNAVAILABLE', reason:'run_or_store_could_not_be_verified'};
  }
  requireThat(checksMatch(before, databaseState(runRoot)), 'archived_database_changed_during_read');
  return facts;
}

function observeRun(runRoot, receipt, sampleRoot, sample) {
  const cold = observeColdStore(runRoot, receipt);
  const workspace = Object.fromEntries([
    ['Q2', ['facts.txt']], ['Q4', ['scores.csv']],
    ['Q7', ['practice.txt']], ['Q8', ['facts.txt', 'copy.txt']],
  ].filter(([task]) => task === receipt.task).flatMap(([, names]) => names.map(name => [name, observeWorkspace(runRoot, receipt, name)])));
  const decisionCount = decision => Array.isArray(receipt.decisions)
    ? receipt.decisions.filter(item => item.decision === decision).length : null;
  return {cold, workspace, artifacts:observeWorkspaceArtifacts(runRoot, receipt, sampleRoot, sample),
    visibleDecisions:{approved:decisionCount('approve'), refused:decisionCount('reject')},
    upstreamPrivacyEvidence:'UNAVAILABLE_REQUEST_BODY_NOT_CAPTURED'};
}

export function createArchivedSupplement(collectionDirectory, expectedSummarySha256, output) {
  const root = directory(collectionDirectory), summaryFile = confined(root, 'summary.json');
  const summaryBytes = fs.readFileSync(summaryFile);
  requireThat(hash.test(expectedSummarySha256) && sha256(summaryBytes) === expectedSummarySha256, 'summary_seal');
  const summary = JSON.parse(summaryBytes);
  requireThat(['execute','correct'].includes(summary.mode) && Array.isArray(summary.results)
    && Array.isArray(summary.plannedRunIds) && checksMatch(summary.plannedRunIds, summary.results.map(row => row.id))
    && new Set(summary.plannedRunIds).size === summary.results.length, 'invalid_collection');
  const identityBytes = fs.readFileSync(confined(root, 'blind-identity-map.json'));
  requireThat(sha256(identityBytes) === summary.identityMapSha256, 'identity_seal');
  const identities = JSON.parse(identityBytes);
  const successful = summary.results.filter(row => row.collectionStatus === 'PASS');
  requireThat(Array.isArray(identities) && identities.length === successful.length
    && new Set(identities.map(item => item.sampleId)).size === identities.length
    && new Set(identities.map(item => item.executionId)).size === identities.length, 'invalid_identity');
  const sampleRoot = confined(root, 'blind-samples', 'directory');
  const samples = successful.map(row => {
    const fixed = schedule.find(item => item.id === row.id);
    const identity = identities.find(item => item.executionId === row.id);
    requireThat(fixed && identity?.version === fixed.version && identity.round === fixed.round
      && sampleIdPattern.test(identity.sampleId), 'identity_mismatch');
    const runRoot = confined(root, fixed.id, 'directory');
    const receiptBytes = fs.readFileSync(confined(runRoot, 'report.json'));
    requireThat(sha256(receiptBytes) === row.receiptSha256, 'receipt_seal');
    const receipt = JSON.parse(receiptBytes);
    const individualSampleRoot = confined(sampleRoot, identity.sampleId, 'directory');
    const sampleBytes = fs.readFileSync(confined(individualSampleRoot, 'sample.json'));
    requireThat(sha256(sampleBytes) === identity.sampleSha256, 'sample_seal');
    const sample = JSON.parse(sampleBytes);
    requireThat(receipt.id === fixed.id && receipt.task === fixed.task && receipt.round === fixed.round
      && receipt.version === fixed.version && receipt.collectionStatus === 'PASS'
      && sample.id === identity.sampleId && sample.task === fixed.task && sample.answer === receipt.answer, 'sample_binding');
    return {sampleId:sample.id, task:sample.task, sampleSha256:identity.sampleSha256,
      observations:observeRun(runRoot, receipt, individualSampleRoot, sample)};
  }).sort((a,b) => a.sampleId.localeCompare(b.sampleId));
  const value = {kind:'phase8-anonymous-archived-readback', schemaVersion:1, samples,
    limitation:'Independent evaluation is still required. Facts are scoped to the sealed run, retained files and readable SQLite. This supplement does not change collection or grading.'};
  newJson(output, value, root);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [collection, expectedSummarySha256, output, ...extra] = process.argv.slice(2);
    requireThat(collection && expectedSummarySha256 && output && !extra.length, 'usage_collection_expectedSummarySha256_newSupplement');
    const result = createArchivedSupplement(collection, expectedSummarySha256, output);
    console.log(JSON.stringify({samples:result.samples.length,
      coldMatched:result.samples.filter(item => item.observations.cold.status === 'MATCHED').length,
      artifactMismatches:result.samples.filter(item => item.observations.artifacts.matched !== item.observations.artifacts.sealed).length}));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
