import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './evidence.mjs';

export const HARNESS_CASES = ['NET-01', 'NET-02', 'IMG-04', 'FILE-01'];
export const redact = value => String(value).replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
  .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');

/** This grades evidence quality, never lets a model or exit code certify a case. */
export function validateHarnessReport(report, { readArtifacts = false, evidenceRoot } = {}) {
  const errors = [];
  if (report?.schema !== 'xiaozhi.harness-baseline.v1') errors.push('INVALID_SCHEMA');
  if (!/^[a-f0-9]{64}$/.test(report?.build?.sha256 || '')) errors.push('MISSING_BUILD');
  if (report?.build?.unchanged !== true) errors.push('BUILD_CHANGED');
  const cases = Array.isArray(report?.cases) ? report.cases : [];
  if (cases.length !== HARNESS_CASES.length || HARNESS_CASES.some(id => cases.filter(c => c?.id === id).length !== 1)) errors.push('CASE_COVERAGE_INCOMPLETE');
  for (const item of cases) {
    if (!['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED'].includes(item.status)) errors.push(`${item.id}:INVALID_STATUS`);
    if (item.status !== 'PASS') continue;
    if (item.layer !== 'C' || item.synthetic !== true || item.modelJudged === true) errors.push(`${item.id}:INVALID_PROOF_LAYER`);
    if (item.buildSha256 !== report.build?.sha256 || !/^[a-f0-9]{64}$/.test(item.scriptSha256 || '')) errors.push(`${item.id}:IDENTITY_MISMATCH`);
    if (!Array.isArray(item.assertions) || !item.assertions.length || item.assertions.some(a => !a?.name || a.pass !== true || a.skipped)) errors.push(`${item.id}:NO_ASSERTIONS`);
    if (new Set(item.assertions?.map(a => a.name)).size !== item.assertions?.length) errors.push(`${item.id}:DUPLICATE_ASSERTIONS`);
    if (!Array.isArray(item.artifacts) || !item.artifacts.length) errors.push(`${item.id}:NO_ARTIFACTS`);
    for (const artifact of item.artifacts || []) {
      if (!/^[a-f0-9]{64}$/.test(artifact?.sha256 || '') || !Number.isSafeInteger(artifact?.bytes) || artifact.bytes < 1) errors.push(`${item.id}:INVALID_ARTIFACT`);
      if (readArtifacts) {
        try {
          const root = fs.realpathSync(evidenceRoot), file = fs.realpathSync(artifact.file);
          if (!file.startsWith(root + path.sep) || fs.lstatSync(artifact.file).isSymbolicLink()) throw new Error('scope');
          const bytes = fs.readFileSync(file);
          if (sha256(bytes) !== artifact.sha256 || bytes.length !== artifact.bytes) throw new Error('digest');
        } catch { errors.push(`${item.id}:ARTIFACT_UNVERIFIED`); }
      }
    }
  }
  if (report?.dailyAccepted !== false || report?.vpnOffAccepted !== false || report?.userFailuresClosed !== false) errors.push('CROSS_LAYER_PROMOTION');
  if (report?.overall !== 'NOT_ACCEPTED') errors.push('UNSUPPORTED_OVERALL_ACCEPTANCE');
  return { valid: errors.length === 0, errors, counts: Object.fromEntries(['PASS','FAIL','BLOCKED','UNVERIFIED'].map(state => [state, cases.filter(c => c.status === state).length])) };
}

/** Append only. A later success cannot replace the original failed attempt. */
export function appendAttempt(directory, attempt) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'attempts.jsonl');
  fs.appendFileSync(file, JSON.stringify(attempt) + '\n', { encoding: 'utf8', flag: 'a' });
  return file;
}
