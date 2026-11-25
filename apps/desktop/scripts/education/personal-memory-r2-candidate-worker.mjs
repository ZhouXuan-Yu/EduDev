import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { preparePersonalMemoryExtraction, bindPersonalMemoryProposals } = await import('../../src/main/education/personal-memory/candidate-admission.ts');
const { runPersonalMemoryCandidateWorker } = await import('../../src/main/education/personal-memory/candidate-worker-client.ts');
const authority = { policyRevision:1, cancelGeneration:0 };
const base = {
  id:'synthetic-teacher-physics',
  sourceVersion:createHash('sha256').update('synthetic canonical message').digest('hex'),
  generation:1, policyRevision:1, role:'teacher', purpose:['extract'],
  scope:{kind:'course', id:'synthetic-physics'}, term:'下学期',
  sanitizedText:'从下学期起我教高二物理。',
};
const configured = {
  pythonExecutable:process.env.OMNI_EDU_R2_PYTHON ?? '',
  providerKey:process.env.DEEPSEEK_API_KEY ?? '',
  repoRoot:fileURLToPath(new URL('../../../../',import.meta.url)),
};
const checks = [];
const empty = preparePersonalMemoryExtraction([{...base,purpose:['discover','use']}],authority);
assert.deepEqual(await runPersonalMemoryCandidateWorker({...configured,providerKey:''},empty),{
  status:'success_empty', proposals:[], modelCalls:0, usage:[],
});
checks.push('no authorized sources means no worker and no credential required');
const ready = preparePersonalMemoryExtraction([base],authority);
const aborted = new AbortController();
aborted.abort();
await assert.rejects(runPersonalMemoryCandidateWorker(configured,ready,[],aborted.signal),/cancelled/);
await assert.rejects(runPersonalMemoryCandidateWorker({...configured,providerKey:''},ready),/provider_configuration/);
checks.push('pre-cancelled worker and missing provider key fail closed');
const report = {checks,live:process.argv.includes('--live'),provider:'deepseek-flash'};
try {
  if(report.live){
    const response = await runPersonalMemoryCandidateWorker(configured,ready);
    report.workerStatus=response.status;
    report.modelCalls=response.modelCalls;
    report.usage=response.usage;
    assert.equal(response.status,'success');
    const observed = bindPersonalMemoryProposals(response.proposals,ready,[base],authority);
    report.candidates = observed.candidates;
    report.rejections = observed.rejections;
    assert.equal(observed.candidates.length,1);
    assert.equal(observed.candidates[0].state,'pending');
    assert.equal(observed.candidates[0].scope.id,'synthetic-physics');
    assert.deepEqual(observed.rejections,[]);
    const revoked = bindPersonalMemoryProposals(response.proposals,ready,[{...base, purpose:[]}],authority);
    assert.deepEqual(revoked.rejections,['source_changed']);
    checks.push('real versioned worker yield is bound against current authority and stays pending');
  }
  report.ok=true;
} catch(error) {
  report.ok=false;
  report.error=String(error);
  process.exitCode=1;
} finally {
  const endpoint=process.env.OMNI_EDU_R2_WORKER_EVIDENCE;
  if(endpoint)writeFileSync(endpoint,JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks,live:report.live,error:report.error}));
}
