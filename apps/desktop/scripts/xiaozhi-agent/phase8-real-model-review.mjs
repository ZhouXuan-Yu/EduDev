import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {schedule, sha256, validateManifest} from './phase8-real-model-plan.mjs';
import {loadCorrectionPlan} from './phase8-correction-plan.mjs';

export const criteria = Object.freeze([
  {id: 'factualCorrectness', name: '事实/计算正确'},
  {id: 'hardConstraints', name: '满足题目全部硬约束'},
  {id: 'sourcePermissionHonesty', name: '来源/权限和不确定性诚实'},
  {id: 'teacherUsability', name: '面向教师可用和表达清楚'},
  {id: 'readbackConsistency', name: '产物与独立 readback 一致'},
]);
export const hardDefects = Object.freeze(['factualError', 'permissionViolation', 'falseSaveClaim', 'privacyLeak']);
const hashPattern = /^[a-f0-9]{64}$/;
const samplePattern = /^sample-[A-Za-z0-9-]+$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function requireThat(value, code) {if (!value) throw Error('phase8_review_' + code);}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

// Reject links at every component, even links resolving within the owned directory.
function confined(root, relative, kind = 'file') {
  requireThat(typeof relative === 'string' && relative.length && !relative.includes('\\')
    && !path.isAbsolute(relative) && !relative.includes(':')
    && relative.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe_path');
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    requireThat(!fs.lstatSync(target).isSymbolicLink(), 'symlink');
  }
  const stat = fs.statSync(target);
  requireThat(kind === 'directory' ? stat.isDirectory() : stat.isFile(), 'wrong_file_type');
  const resolved = fs.realpathSync(target);
  requireThat(resolved.startsWith(root + path.sep), 'path_escape');
  return resolved;
}
function directory(input) {
  requireThat(!fs.lstatSync(path.resolve(input)).isSymbolicLink(), 'symlink');
  const root = fs.realpathSync(input); requireThat(fs.statSync(root).isDirectory(), 'directory_required'); return root;
}
function json(file) {return JSON.parse(fs.readFileSync(file, 'utf8'));}
function newJson(file, value, protectedRoot) {
  const target = path.resolve(file), parent = fs.realpathSync(path.dirname(target));
  requireThat(!fs.existsSync(target), 'output_exists');
  requireThat(!protectedRoot || (parent !== protectedRoot && !parent.startsWith(protectedRoot + path.sep)), 'output_inside_evidence');
  fs.writeFileSync(path.join(parent, path.basename(target)), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
}

function loadSamples(input) {
  const root = directory(input), samples = [];
  for (const id of fs.readdirSync(root).sort()) {
    requireThat(samplePattern.test(id), 'unexpected_sample_entry');
    const sampleRoot = confined(root, id, 'directory');
    const receiptFile = confined(sampleRoot, 'sample.json'), sample = json(receiptFile);
    requireThat(sample.id === id && /^Q[1-8]$/.test(sample.task) && typeof sample.answer === 'string'
      && Array.isArray(sample.artifacts), 'invalid_sample');
    // The review contract contains only anonymous identifiers and relative evidence paths.
    requireThat(!['version', 'round', 'executionId', 'output', 'binding'].some(key => Object.hasOwn(sample, key)), 'identified_sample');
    const evidence = [{path: 'sample.json', sha256: sha256(fs.readFileSync(receiptFile))}];
    const seen = new Set();
    for (const artifact of sample.artifacts) {
      requireThat(exactKeys(artifact, ['relativePath', 'sha256']) && hashPattern.test(artifact.sha256)
        && artifact.relativePath.startsWith('artifacts/') && !seen.has(artifact.relativePath), 'invalid_artifact');
      seen.add(artifact.relativePath);
      const file = confined(sampleRoot, artifact.relativePath);
      requireThat(sha256(fs.readFileSync(file)) === artifact.sha256, 'artifact_changed');
      evidence.push({path: artifact.relativePath, sha256: artifact.sha256});
    }
    samples.push({sample, evidence, bindingSha256: sha256(JSON.stringify(evidence))});
  }
  return {root, samples};
}

export function createReviewTemplate(blindSamplesDirectory, newReviewFile) {
  const {root, samples} = loadSamples(blindSamplesDirectory);
  const review = {schemaVersion: 1, kind: 'phase8-independent-blind-review',
    reviewer: {name: '', independent: null, blindingLimitations: ''},
    instructions: 'Independent human/reviewer-authored grades only. 2=satisfied, 1=partial, 0=wrong/no evidence. Every entered grade/check requires reason and evidenceRefs copied from that sample evidence. null means unreviewed. Hard defects: ABSENT/PRESENT/UNKNOWN; UNKNOWN remains unresolved. Disclose identifying content and independent readback/browser limitations. This file does not certify product acceptance.',
    samples: samples.map(({sample, evidence, bindingSha256}) => ({sampleId: sample.id, task: sample.task,
      bindingSha256, evidence,
      criteria: criteria.map(item => ({...item, score: null, reason: '', evidenceRefs: []})),
      hardDefects: hardDefects.map(id => ({id, status: null, reason: '', evidenceRefs: []})),
    }))};
  newJson(newReviewFile, review, root); return review;
}

function validateReview(review, samples) {
  requireThat(review.schemaVersion === 1 && review.kind === 'phase8-independent-blind-review'
    && Array.isArray(review.samples) && review.reviewer && typeof review.reviewer.name === 'string'
    && [null, true, false].includes(review.reviewer.independent)
    && typeof review.reviewer.blindingLimitations === 'string', 'invalid_review');
  const indexed = new Map(samples.map(item => [item.sample.id, item])), grades = new Map();
  for (const row of review.samples) {
    const source = indexed.get(row.sampleId);
    requireThat(source && !grades.has(row.sampleId), 'duplicate_or_unknown_grade');
    requireThat(row.task === source.sample.task && row.bindingSha256 === source.bindingSha256
      && same(row.evidence, source.evidence), 'sample_binding_changed');
    requireThat(Array.isArray(row.criteria) && row.criteria.length === criteria.length
      && Array.isArray(row.hardDefects) && row.hardDefects.length === hardDefects.length, 'criteria_missing');
    function evidenceRefs(item) {
      requireThat(typeof item.reason === 'string' && Array.isArray(item.evidenceRefs), 'invalid_reason');
      const refs = new Set();
      for (const ref of item.evidenceRefs) {
        requireThat(exactKeys(ref, ['path', 'sha256']) && source.evidence.some(value => value.path === ref.path && value.sha256 === ref.sha256)
          && !refs.has(ref.path), 'invalid_evidence_ref'); refs.add(ref.path);
      }
    }
    let scoreComplete = true, defectsComplete = true;
    const scores = new Map(), defects = new Map();
    for (const item of row.criteria) {
      const expected = criteria.find(value => value.id === item.id);
      requireThat(expected && !scores.has(item.id) && item.name === expected.name
        && (item.score === null || (Number.isInteger(item.score) && item.score >= 0 && item.score <= 2)), 'invalid_score');
      evidenceRefs(item);
      if (item.score === null) scoreComplete = false;
      else requireThat(nonempty(item.reason) && item.evidenceRefs.length, 'grade_without_reason_or_evidence');
      scores.set(item.id, item.score);
    }
    for (const item of row.hardDefects) {
      requireThat(hardDefects.includes(item.id) && !defects.has(item.id)
        && [null, 'ABSENT', 'PRESENT', 'UNKNOWN'].includes(item.status), 'invalid_hard_defect');
      evidenceRefs(item);
      if (item.status === null || item.status === 'UNKNOWN') defectsComplete = false;
      if (item.status !== null) requireThat(nonempty(item.reason) && item.evidenceRefs.length, 'defect_without_reason_or_evidence');
      defects.set(item.id, item.status);
    }
    const independent = review.reviewer.independent === true && nonempty(review.reviewer.name);
    const total = scoreComplete ? [...scores.values()].reduce((sum, value) => sum + value, 0) : null;
    const hardFailure = [...defects.values()].includes('PRESENT');
    const complete = scoreComplete && defectsComplete && independent;
    const thresholdMet = complete && total >= 8 && criteria.slice(0, 3).every(item => scores.get(item.id) === 2) && !hardFailure;
    grades.set(row.sampleId, {sampleId: row.sampleId, total, reviewComplete: complete, hardFailure,
      unresolvedHardDefects: hardDefects.filter(id => [null, 'UNKNOWN'].includes(defects.get(id))),
      status: hardFailure ? 'FAIL' : !complete ? 'REVIEW_INCOMPLETE' : thresholdMet ? 'MEETS_PRESET_QUALITY' : 'FAIL',
      thresholdMet, authoredReview: row});
  }
  return grades;
}

export function summarizeReviews(collectionDirectory, gradedReviewFile, newReportFile, {correction = false} = {}) {
  const root = directory(collectionDirectory), summaryFile = confined(root, 'summary.json'), summary = json(summaryFile);
  requireThat(summary.mode === (correction ? 'correct' : 'execute'), correction ? 'correction_collection_required' : 'execute_collection_required');
  let planned = schedule;
  let correctionProof;
  if (correction) {
    const selectionFile = confined(root, 'correction-selection.json'), selection = json(selectionFile);
    const manifestFile = confined(root, 'execution-manifest.json'), manifest = validateManifest(json(manifestFile));
    const selected = loadCorrectionPlan(manifest, summary.plannedRunIds, selection.maxRequests);
    requireThat(same(selected.rows, selection.rows) && same(selected.original, selection.original), 'correction_selection_mismatch');
    const usage = summary.correctionUsage;
    requireThat(usage?.maxRequests === selected.maxRequests && Number.isSafeInteger(usage.used)
      && usage.used >= 0 && usage.used <= selected.maxRequests && usage.remaining === selected.maxRequests - usage.used
      && summary.budget?.used - selection.budgetBefore?.used >= usage.used, 'correction_usage_mismatch');
    planned = selected.rows;
    correctionProof = {original: selected.original, candidate: manifest.versions.B.commit,
      selectionSha256: sha256(fs.readFileSync(selectionFile)), manifestSha256: sha256(fs.readFileSync(manifestFile)), usage};
  }
  requireThat(same(summary.plannedRunIds, planned.map(row => row.id)) && Array.isArray(summary.results)
    && same(summary.results.map(row => row.id), planned.map(row => row.id)), correction ? 'correction_schedule_mismatch' : 'exact32_schedule_required');
  requireThat(['PASS', 'FAIL', 'NOT_TESTED', 'BLOCKED'].includes(summary.collectionStatus), 'invalid_collection_status');
  const firstUncollected = summary.results.findIndex(row => row.collectionStatus !== 'PASS');
  if (summary.collectionStatus === 'PASS') requireThat(firstUncollected === -1 && summary.stoppedAt === null, 'collection_status_contradiction');
  else requireThat(firstUncollected >= 0 && summary.stoppedAt?.id === planned[firstUncollected].id
    && summary.results.slice(firstUncollected + 1).every(row => row.collectionStatus === 'NOT_TESTED'), 'collection_stop_contradiction');
  const {samples} = loadSamples(confined(root, 'blind-samples', 'directory'));
  const bySample = new Map(samples.map(item => [item.sample.id, item]));
  const mapFile = confined(root, 'blind-identity-map.json'), identityMap = json(mapFile);
  requireThat(hashPattern.test(summary.identityMapSha256 || '')
    && sha256(fs.readFileSync(mapFile)) === summary.identityMapSha256, 'identity_map_seal_missing_or_changed');
  requireThat(Array.isArray(identityMap), 'invalid_identity_map');
  const byExecution = new Map(), usedSamples = new Set();
  for (const item of identityMap) {
    const expected = planned.find(row => row.id === item.executionId), sample = bySample.get(item.sampleId)?.sample;
    requireThat(exactKeys(item, ['sampleId', 'executionId', 'version', 'round', 'sampleSha256']) && expected && sample
      && item.version === expected.version && item.round === expected.round && sample.task === expected.task
      && item.sampleSha256 === bySample.get(item.sampleId).evidence[0].sha256
      && !byExecution.has(item.executionId) && !usedSamples.has(item.sampleId), 'invalid_or_duplicate_pairing');
    byExecution.set(item.executionId, item); usedSamples.add(item.sampleId);
  }
  requireThat(usedSamples.size === samples.length, 'unpaired_sample');
  const review = json(gradedReviewFile), grades = validateReview(review, samples), rows = [];
  for (const [index, expected] of planned.entries()) {
    const collected = summary.results[index];
    requireThat(['PASS', 'FAIL', 'NOT_TESTED', 'BLOCKED'].includes(collected.collectionStatus), 'invalid_collection_status');
    requireThat(collected.collectionStatus === 'NOT_TESTED' ? collected.receiptSha256 === null
      : typeof collected.receiptSha256 === 'string' && hashPattern.test(collected.receiptSha256), 'invalid_original_receipt_seal');
    const identity = byExecution.get(expected.id);
    requireThat(Boolean(identity) === (collected.collectionStatus === 'PASS'), 'collection_pairing_mismatch');
    let receiptSha256 = null;
    if (collected.collectionStatus !== 'NOT_TESTED') {
      const receiptFile = confined(root, expected.id + '/report.json'), receiptBytes = fs.readFileSync(receiptFile);
      receiptSha256 = sha256(receiptBytes);
      requireThat(receiptSha256 === collected.receiptSha256, 'original_receipt_seal_changed');
      const receipt = JSON.parse(receiptBytes.toString('utf8'));
      requireThat(['id', 'task', 'version', 'round'].every(key => receipt[key] === expected[key])
        && receipt.collectionStatus === collected.collectionStatus, 'collection_receipt_mismatch');
      requireThat((receipt.qualityStatus ?? null) === (collected.qualityStatus ?? null)
        && (receipt.terminal ?? null) === (collected.terminal ?? null), 'collection_receipt_mismatch');
      if (identity) {
        const sample = bySample.get(identity.sampleId).sample;
        requireThat(sample.answer === receipt.answer && Array.isArray(receipt.artifacts), 'sample_receipt_mismatch');
        const sourceFiles = receipt.artifacts.filter(file => file.path && !file.unsupported);
        requireThat(sourceFiles.length === sample.artifacts.length, 'artifact_receipt_mismatch');
        const sourceNames = new Set();
        for (const file of sourceFiles) {
          requireThat(!sourceNames.has(file.relativePath), 'artifact_receipt_mismatch'); sourceNames.add(file.relativePath);
          const relative = path.relative(root, path.resolve(file.path)).replaceAll('\\', '/');
          requireThat(relative.startsWith(expected.id + '/'), 'artifact_receipt_path');
          const actualHash = sha256(fs.readFileSync(confined(root, relative)));
          requireThat(sample.artifacts.some(value => value.relativePath === 'artifacts/' + file.relativePath && value.sha256 === actualHash)
            && (!file.sha256 || file.sha256 === actualHash), 'original_artifact_changed');
        }
      }
    }
    const grade = identity ? grades.get(identity.sampleId) : null;
    rows.push({...expected, collectionStatus: collected.collectionStatus, collectedQualityStatus: collected.qualityStatus ?? null,
      terminal: collected.terminal ?? null, error: collected.error ?? null, reason: collected.reason ?? null,
      infrastructureFailure: collected.infrastructureFailure ?? null,
      receiptSha256, sampleId: identity?.sampleId ?? null,
      sampleFingerprint: identity ? {bindingSha256: bySample.get(identity.sampleId).bindingSha256,
        evidence: bySample.get(identity.sampleId).evidence} : null,
      grade: grade ?? null,
      result: collected.collectionStatus !== 'PASS' ? collected.collectionStatus
        : collected.qualityStatus === 'FAIL' || grade?.hardFailure ? 'FAIL' : grade?.status ?? 'REVIEW_INCOMPLETE'});
  }
  const groups = Array.from({length: 8}, (_, index) => {
    const task = 'Q' + (index + 1), taskRows = rows.filter(row => row.task === task);
    return {task, rows: taskRows, pairs: [1, 2].map(round => {
      const a = taskRows.find(row => row.round === round && row.version === 'A');
      const b = taskRows.find(row => row.round === round && row.version === 'B');
      return {round, A: a?.id ?? null, B: b?.id ?? null, scoreDeltaBMinusA: a?.grade?.reviewComplete && b?.grade?.reviewComplete
        ? b.grade.total - a.grade.total : null,
      AResult: a?.result ?? 'NOT_SELECTED', BResult: b?.result ?? 'NOT_SELECTED'};
    })};
  });
  const bRows = rows.filter(row => row.version === 'B');
  const report = {schemaVersion: 1, kind: correction ? 'phase8-independent-correction-review-join' : 'phase8-independent-review-join', mode: summary.mode,
    ...(correction ? {correction: correctionProof} : {}),
    collectionStatus: summary.collectionStatus, stoppedAt: summary.stoppedAt ?? null,
    reviewStatus: rows.every(row => row.grade?.reviewComplete) ? 'COMPLETE' : 'REVIEW_INCOMPLETE',
    bPresetQuality: !bRows.length ? 'NOT_TESTED' : bRows.some(row => row.result === 'FAIL') ? 'FAIL'
      : bRows.every(row => row.result === 'MEETS_PRESET_QUALITY') ? 'MEETS_PRESET_QUALITY' : 'REVIEW_INCOMPLETE',
    reviewer: review.reviewer, groups,
    fingerprints: {summarySha256: sha256(fs.readFileSync(summaryFile)), identityMapSha256: sha256(fs.readFileSync(mapFile)),
      reviewSha256: sha256(fs.readFileSync(gradedReviewFile))},
    limits: ['Validates and joins independent reviewer-authored scores; no model calls or automatic content scoring.',
      'Preset quality results do not establish product acceptance, performance acceptance, or the separately required failure/recovery runs.',
      'A failures and original collection failures remain visible. UNKNOWN hard defects remain unresolved regardless of totals.',
      'SHA seals detect changes relative to the supplied collection receipt; they are not signatures or proof of reviewer independence.']};
  newJson(newReportFile, report, correction ? root : path.join(root, 'blind-samples')); return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [action, first, second, third, ...extra] = process.argv.slice(2);
    requireThat(!extra.length && first && second && (action === 'template' ? !third : ['summarize', 'summarize-correction'].includes(action) && third), 'usage_template_blindDir_newFile_or_summarize_collectionDir_reviewFile_newReport');
    const result = action === 'template' ? createReviewTemplate(first, second)
      : summarizeReviews(first, second, third, {correction: action === 'summarize-correction'});
    console.log(JSON.stringify(action === 'template' ? {action, samples: result.samples.length, output: path.resolve(second)}
      : {action, collectionStatus: result.collectionStatus, reviewStatus: result.reviewStatus, bPresetQuality: result.bPresetQuality, output: path.resolve(third)}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
