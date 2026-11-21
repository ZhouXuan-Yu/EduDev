import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {budgetError} from './phase8-budget-ledger.mjs';
import {schedule, sha256, validateManifest} from './phase8-real-model-plan.mjs';

const evidence = new URL('../../../../docs/goal/xiaozhi-harness/evidence/phase8/formal-collection-first-stop-20261121.json', import.meta.url);

export function selectCorrectionRows(original, rowIds) {
  const planned = schedule.map(row => row.id);
  if (original.mode !== 'execute' || original.collectionStatus !== 'FAIL'
      || JSON.stringify(original.plannedRunIds) !== JSON.stringify(planned)
      || !Array.isArray(original.results) || original.results.length !== planned.length
      || original.results.some((row, index) => row.id !== planned[index])) throw Error('phase8_correction_original_invalid');
  if (!Array.isArray(rowIds) || !rowIds.length || new Set(rowIds).size !== rowIds.length) throw Error('phase8_correction_rows_invalid');
  const eligible = new Map(original.results.map(row => {
    const affected = /^Q[35]-r[12]-B$/.test(row.id) || ['Q1-r2-B', 'Q2-r2-B'].includes(row.id);
    const reason = row.collectionStatus === 'NOT_TESTED' ? 'not_executed'
      : original.stoppedAt?.id === row.id && row.collectionStatus === 'FAIL' ? 'capture_failure'
      : affected && row.collectionStatus === 'PASS' ? 'affected_candidate' : null;
    return [row.id, reason];
  }));
  if (rowIds.some(id => !eligible.get(id))) throw Error('phase8_correction_row_ineligible');
  return schedule.filter(row => rowIds.includes(row.id)).map(row => ({...row, correctionReason: eligible.get(row.id)}));
}

function assertSame(value, original) {
  assert.deepEqual(value, original, 'phase8_correction_input_changed');
}

export function loadCorrectionPlan(manifest, rowIds, maxRequests) {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 200) throw Error('phase8_correction_budget_invalid');
  const seal = JSON.parse(fs.readFileSync(evidence, 'utf8'));
  const originalRoot = path.join(seal.reportBase, seal.reportDirectory);
  const summary = fs.readFileSync(path.join(originalRoot, 'summary.json'));
  const inputs = fs.readFileSync(path.join(originalRoot, 'execution-manifest.json'));
  if (sha256(summary) !== seal.summarySha256 || sha256(inputs) !== seal.executionManifestSha256) throw Error('phase8_correction_original_changed');
  const original = JSON.parse(summary);
  const formerManifest = validateManifest(JSON.parse(inputs));
  assertSame(manifest.model, formerManifest.model);
  assertSame(manifest.versions.A, formerManifest.versions.A);
  assertSame(manifest.questionSeedEvidence, formerManifest.questionSeedEvidence);
  assertSame(manifest.versions.B.dataSha256, formerManifest.versions.B.dataSha256);
  assertSame(manifest.versions.B.profileSha256, formerManifest.versions.B.profileSha256);
  if (manifest.versions.B.commit === formerManifest.versions.B.commit || manifest.versions.B.outSha256 === formerManifest.versions.B.outSha256) {
    throw Error('phase8_correction_candidate_unchanged');
  }
  const rows = selectCorrectionRows(original, rowIds);
  return {rows, maxRequests, original: {summarySha256: seal.summarySha256, manifestSha256: seal.executionManifestSha256,
    originalStop: original.stoppedAt, originalRoot, candidate: formerManifest.versions.B.commit}};
}

export function correctionBudget(ledger, maxRequests) {
  const initial = ledger.summary();
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || initial.unresolved
      || initial.remaining !== null && maxRequests > initial.remaining) {
    throw Error('phase8_correction_budget_invalid');
  }
  let used = 0;
  let rejected = 0;
  return {...ledger, reserve(context) {
    if (used >= maxRequests) {
      rejected++;
      throw budgetError('budget_exhausted');
    }
    const reservation = ledger.reserve(context);
    used++;
    return reservation;
  }, correctionUsage: () => ({used, rejected, maxRequests, remaining: maxRequests - used})};
}
