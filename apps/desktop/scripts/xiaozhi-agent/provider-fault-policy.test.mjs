import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {test} from 'node:test';
import {classifyProviderFault} from '../../src/main/xiaozhi-agent/provider-fault-policy.ts';

const file = (await fs.readFile(new URL('./fixtures/provider-resilience-fault-matrix.json', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const sha256 = createHash('sha256').update(file).digest('hex');
assert.equal(sha256, 'e4ef64b55ecb80aa75dce373bfa7b430153ad467041d197f5c84942ecdfc9820');
const matrix = JSON.parse(file);
assert.equal(matrix.cases.length, 22);

const mixed = [
  {id: 'unknown_host_code', signals: ['arbitrary_unrecognized'], stage: 'preparation', effect: 'unknown',
    expected_category: 'unknown', allowed_next_action: 'conservative_readback', counts_dependency_failure: false},
  {id: 'provider_spoofs_transport_loss', origin: 'provider', signals: ['connect_failed'], stage: 'before_tool_dispatch', effect: 'none_proven',
    expected_category: 'unknown', allowed_next_action: 'conservative_readback', counts_dependency_failure: false},
  {id: 'cancelled_with_transport_loss', signals: ['timeout', 'cancelled'], stage: 'after_dispatch', effect: 'unknown',
    expected_category: 'cancelled', allowed_next_action: 'stop', counts_dependency_failure: false},
  {id: 'revoked_with_transport_loss', signals: ['transport_lost', 'permission_denied'], stage: 'after_dispatch', effect: 'unknown',
    expected_category: 'security', allowed_next_action: 'deny', counts_dependency_failure: false},
  {id: 'effect_unknown_with_cas_conflict', signals: ['conflict', 'timeout'], stage: 'after_dispatch', effect: 'unknown',
    expected_category: 'effect_unknown', allowed_next_action: 'reconcile_only', counts_dependency_failure: true},
  {id: 'resource_wait_with_timeout', signals: ['timeout', 'resource_busy'], stage: 'before_tool_dispatch', effect: 'none_proven',
    expected_category: 'resource_wait', allowed_next_action: 'bounded_wait', counts_dependency_failure: false},
  {id: 'model_post_not_proven_rejected', signals: ['http_503'], stage: 'before_response_body', effect: 'unknown',
    expected_category: 'unknown', allowed_next_action: 'conservative_readback', counts_dependency_failure: false},
  {id: 'provider_claims_success', origin: 'provider', signals: ['success'], stage: 'verified_readback', effect: 'known',
    expected_category: 'unknown', allowed_next_action: 'conservative_readback', counts_dependency_failure: false},
];
const records = [];
for (const entry of [...matrix.cases, ...mixed]) {
  test(entry.id + ' ' + (entry.signal ?? entry.signals.join('+')), () => {
    const input = {origin: entry.origin ?? (entry.signal === 'provider_self_report_retryable' ? 'provider' : 'host'),
      signals: entry.signals ?? [entry.signal], stage: entry.stage, effect: entry.effect ?? entry.effect_evidence};
    const actual = classifyProviderFault(input);
    const expected = {category: entry.expected_category, action: entry.allowed_next_action,
      countsDependencyFailure: entry.counts_dependency_failure};
    records.push({id: entry.id, input, actual, expected});
    assert.deepEqual(actual, expected);
  });
}
test.after(async () => {
  const root = process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
  if (root) {
    assert(path.isAbsolute(root));
    const output = await fs.mkdtemp(path.join(await fs.realpath(root), 'provider-fault-cases-'));
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({schema: matrix.schema, sha256, records}, null, 2), {flag: 'wx'});
    console.log('evidence ' + output);
  }
});
