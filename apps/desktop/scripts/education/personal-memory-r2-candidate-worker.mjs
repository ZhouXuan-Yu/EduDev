import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { preparePersonalMemoryExtraction, bindPersonalMemoryProposals } = await import('../../src/main/education/personal-memory/candidate-admission.ts');
const { runPersonalMemoryCandidateWorker } = await import('../../src/main/education/personal-memory/candidate-worker-client.ts');
const { createPersonalMemoryWorkerPaths } = await import('../../src/main/education/personal-memory/runtime.ts');
const authority = { policyRevision:1, cancelGeneration:0 };
const base = {
  id:'synthetic-teacher-physics',
  sourceVersion:createHash('sha256').update('synthetic canonical message').digest('hex'),
  generation:1, policyRevision:1, role:'teacher', purpose:['extract'],
  scope:{kind:'course', id:'synthetic-physics'}, term:'下学期',
  sanitizedText:'从下学期起我教高二物理。',
};
const devWorker = {
  pythonExecutable:process.env.OMNI_EDU_R2_PYTHON ?? '',
  repoRoot:fileURLToPath(new URL('../../../../',import.meta.url)),
};
const checks = [];
const bundled=process.argv.includes('--bundled');
const packaged=(resourcesPath)=>createPersonalMemoryWorkerPaths({packaged:true,resourcesPath,repoRoot:devWorker.repoRoot,
  configuredPython:devWorker.pythonExecutable});
let worker=devWorker;
if(bundled){
  const source=process.env.OMNI_EDU_R2_PACKAGED_RESOURCES;
  assert(source,'An isolated packaged resources fixture is required');
  const resolved=await packaged(source)();
  assert(resolved?.executable && !resolved.pythonExecutable);
  const missing=mkdtempSync(join(tmpdir(),'edudev-r2-worker-missing-'));
  assert.equal(await packaged(missing)(),null);
  const changed=mkdtempSync(join(tmpdir(),'edudev-r2-worker-changed-'));
  const clone=join(changed,'personal-memory-runtime');
  cpSync(resolved.repoRoot,clone,{recursive:true,errorOnExist:true,force:false});
  const added=join(clone,'unexpected.dll');
  writeFileSync(added,'synthetic untracked bytes');
  assert.equal(await packaged(changed)(),null);
  unlinkSync(added);
  appendFileSync(join(clone,'licenses','SOURCE.md'),'synthetic changed content');
  assert.equal(await packaged(changed)(),null);
  checks.push('the exact bundled worker resolves while missing, untracked and modified resources fail closed');
  worker=resolved;
}
const configured={...worker,providerKey:process.env.DEEPSEEK_API_KEY ?? ''};
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
const report = {checks,live:process.argv.includes('--live'),bundled,provider:'deepseek-flash'};
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
