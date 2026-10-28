import assert from 'node:assert/strict';

export const serializableConditions=value=>JSON.parse(JSON.stringify(value));

export function statistics(samples) {
  assert(samples.length>=5,'At least five raw samples are required');
  assert(samples.every(value=>Number.isFinite(value)&&value>=0),'Invalid measurement');
  const sorted=[...samples].sort((a,b)=>a-b);
  return {samples:samples.length,min:sorted[0],p50:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};
}

/** A missing measurement or mismatched machine/workload never means a pass. */
export function compareReports(baseline,current,{relative=1.25,absoluteMs=10}={}) {
  assert.equal(current.schema,'xiaozhi.audit-performance.v1');
  assert.equal(baseline.schema,current.schema);
  assert.equal(current.machine.signature,baseline.machine.signature,'Compare on the same machine/runtime');
  assert.deepEqual(current.workload,baseline.workload,'Workloads must match');
  assert.equal(current.scriptSha256,baseline.scriptSha256,'Probe scripts must match');
  assert.deepEqual(current.conditions,baseline.conditions,'Dependency/display/power/GPU conditions must match');
  assert(baseline.ok&&current.ok,'Both functional runs must succeed');
  for(const report of [baseline,current]) {
    const {rounds,viewports,repetitions}=report.workload;
    assert(Array.isArray(rounds)&&rounds.length>0&&new Set(rounds).size===rounds.length);
    assert(Array.isArray(viewports)&&viewports.length>0);
    assert(Number.isInteger(repetitions)&&repetitions>=5);
    const keys=rounds.flatMap(count=>viewports.map(([width,height])=>count+'-'+width+'x'+height));
    assert.equal(new Set(keys).size,keys.length,'Workload keys must be unique');
    assert.deepEqual(report.scenarios.map(item=>item.key).sort(),[...keys].sort(),'All expected scenarios exactly once');
    for(const scenario of report.scenarios){
      assert.equal(scenario.samples.length,repetitions,'Exact repetition count');
      for(const metric of ['openMs','snapshotMs','inputMs'])statistics(scenario.samples.map(item=>item[metric]));
    }
  }
  const results=[];
  for(const before of baseline.scenarios) {
    const after=current.scenarios.find(item=>item.key===before.key);
    assert(after,'Missing current scenario: '+before.key);
    for(const metric of ['openMs','snapshotMs','inputMs']) {
      const previous=statistics(before.samples.map(item=>item[metric]));
      const next=statistics(after.samples.map(item=>item[metric]));
      const limit=Math.max(previous.p95*relative,previous.p95+absoluteMs);
      results.push({scenario:before.key,metric,before:previous,after:next,limit,passed:next.p95<=limit});
    }
  }
  assert(results.length>0,'No comparable measurements');
  return {ok:results.every(item=>item.passed),relative,absoluteMs,results};
}
