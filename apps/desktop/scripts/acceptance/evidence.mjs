import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function fingerprint(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Build must not contain symlinks');
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push({ file: path.relative(root, absolute).replaceAll('\\','/'), sha256: sha256(fs.readFileSync(absolute)) });
      else throw new Error('Unsupported build entry');
    }
  }
  walk(root);
  if (!files.length) throw new Error('Empty build');
  return { sha256: sha256(JSON.stringify(files)), files };
}
export function gradeAttempt(e) {
  const reasons=[];
  if (e.exitCode !== 0 || e.timedOut) reasons.push('PROCESS_FAILED');
  if (!e.report || e.report.success !== true) reasons.push('REPORT_NOT_SUCCESS');
  if (!Array.isArray(e.report?.checks) || !e.report.checks.length || e.report.checks.some(c=>!c || c.pass!==true || typeof c.name!=='string' || !c.name.trim() || c.skipped)) reasons.push('ASSERTIONS_INCOMPLETE');
  if (Array.isArray(e.report?.checks) && (e.report.checks.length < (e.requiredAssertions || 1) || new Set(e.report.checks.map(c=>c?.name)).size!==e.report.checks.length)) reasons.push('CASE_COVERAGE_INCOMPLETE');
  if (!e.artifactsVerified) reasons.push('ARTIFACTS_UNVERIFIED');
  if (!e.buildUnchanged) reasons.push('BUILD_CHANGED');
  if (e.scriptUnchanged === false) reasons.push('TEST_SCRIPT_CHANGED');
  if (e.layer!=='isolated_formal_ui') reasons.push('NOT_FORMAL_UI');
  return { status: reasons.length?'FAIL':'PASS', reasons, assertionCount: e.report?.checks?.length || 0 };
}
export function summarize(attempts, {requiredCases=['web','ocr'], requiredRepeats=1, humanAccepted=false, sameDailyConfiguration=false, openFeedback=[]}={}) {
  const missing=requiredCases.filter(id=>attempts.filter(a=>a.caseId===id).length<requiredRepeats);
  const automationPass=!missing.length && attempts.length>0 && attempts.every(a=>a.grade.status==='PASS');
  const reasons=[];
  if(!automationPass) reasons.push('AUTOMATION_INCOMPLETE_OR_FAILED');
  if(!humanAccepted) reasons.push('HUMAN_ACCEPTANCE_PENDING');
  if(!sameDailyConfiguration) reasons.push('DAILY_PROFILE_NOT_VERIFIED');
  if(openFeedback.length) reasons.push('USER_FAILURES_OPEN');
  return {status:reasons.length?'NOT_ACCEPTED':'ACCEPTED',automation:automationPass?'PASS':'FAIL_OR_INCOMPLETE',missing,reasons,openFeedback,firstFailures:attempts.filter(a=>a.grade.status==='FAIL').map(a=>({caseId:a.caseId,attempt:a.attempt,output:a.output})),repeatStatus:attempts.some(a=>a.grade.status==='FAIL')?'HAS_RECORDED_FAILURES':requiredRepeats<3?'STABILITY_UNVERIFIED':automationPass?'ALL_REQUESTED_RUNS_PASSED':'UNSTABLE_OR_BLOCKED'};
}
