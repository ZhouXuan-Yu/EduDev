import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { preparePersonalMemoryExtraction, bindPersonalMemoryProposals } from '../../src/main/education/personal-memory/candidate-admission.ts';

const hash = text => createHash('sha256').update(text).digest('hex');
const quote = '本学期初三甲班讲义的答案统一放在最后。';
const source = {
  id: 'teacher-message-1',
  sourceVersion: hash('canonical revision 1'),
  generation: 1,
  policyRevision: 1,
  role: 'teacher',
  purpose: ['discover', 'extract'],
  scope: { kind: 'class', id: 'class-7' },
  term: '本学期',
  sanitizedText: '请记住：' + quote,
};
const policy = { policyRevision: 1, cancelGeneration: 0 };
const proposal = {
  kind: 'preference',
  source_id: 'teacher-message-1',
  source_version: 1,
  scope_id: 'class-7',
  valid_term: '本学期',
  supporting_quote: quote,
  value: '将讲义答案放在最后',
  supersedes: null,
};
const cases = [
  ['Only sanitized teacher sources with extract permission reach the edge', () => {
    const sources = [
      source,
      {...source, id:'discover-only', purpose:['index', 'discover']},
      {...source, id:'assistant', role:'assistant'},
    ];
    const request = preparePersonalMemoryExtraction(sources, policy);
    assert.deepEqual(request.sources, [{id:source.id, version:1, scope:source.scope, term:source.term, text:source.sanitizedText}]);
  }],
  ['Accepted draft preserves authority and the exact localized supporting span', () => {
    const admitted = bindPersonalMemoryProposals([proposal], preparePersonalMemoryExtraction([source], policy), [source], policy);
    assert.deepEqual(admitted.rejections, []);
    assert.equal(admitted.candidates[0].state, 'pending');
    assert.equal(admitted.candidates[0].witness.sourceVersion, source.sourceVersion);
    assert.equal(admitted.candidates[0].witness.generation, 1);
    assert.equal(source.sanitizedText.slice(admitted.candidates[0].witness.start, admitted.candidates[0].witness.end), quote);
  }],
  ['No extraction grant means no candidate even with a valid current use permission', () => {
    const disallowed = {...source, purpose:['index', 'discover', 'use']};
    const request = preparePersonalMemoryExtraction([disallowed], policy);
    assert.equal(request.sources.length, 0);
    assert.deepEqual(bindPersonalMemoryProposals([proposal], request, [disallowed], policy).rejections, ['source_unavailable']);
  }],
  ['Model cannot widen scope, refine date precision or supply a version not in the manifest', () => {
    const request = preparePersonalMemoryExtraction([source], policy);
    const bad = [
      {...proposal, scope_id:'teacher'},
      {...proposal, valid_term:'2026-11-25'},
      {...proposal, source_version:2},
      {...proposal, approved:true},
    ];
    assert.deepEqual(bindPersonalMemoryProposals(bad,request,[source],policy).rejections,
      ['scope_mismatch', 'term_mismatch', 'source_changed', 'invalid_schema']);
  }],
  ['Unsent text, ambiguous spans and unverified replacements fail closed', () => {
    const request = preparePersonalMemoryExtraction([source], policy);
    const repeated = {...source, sanitizedText:quote+' '+quote};
    assert.deepEqual(bindPersonalMemoryProposals([{...proposal, supporting_quote:'未发送的原文'}],request,[source],policy).rejections,['ungrounded']);
    assert.deepEqual(bindPersonalMemoryProposals([proposal],preparePersonalMemoryExtraction([repeated],policy),[repeated],policy).rejections,['ungrounded']);
    assert.deepEqual(bindPersonalMemoryProposals([{...proposal,supersedes:'other-record'}],request,[source],policy).rejections,['invalid_target']);
  }],
  ['Revoked grants, a changed source and cancellation invalidate in-flight output', () => {
    const request = preparePersonalMemoryExtraction([source],policy);
    const revoked = {...source,generation:2,purpose:['discover']};
    const changed = {...source,sourceVersion:hash('canonical revision 2')};
    assert.deepEqual(bindPersonalMemoryProposals([proposal],request,[revoked],policy).rejections,['source_changed']);
    assert.deepEqual(bindPersonalMemoryProposals([proposal],request,[changed],policy).rejections,['source_changed']);
    assert.deepEqual(bindPersonalMemoryProposals([proposal],request,[source],{...policy,cancelGeneration:1}).rejections,['cancelled']);
  }],
  ['Replayed output deduplicates and contradictory values with the same evidence stay unresolved', () => {
    const request=preparePersonalMemoryExtraction([source],policy);
    assert.equal(bindPersonalMemoryProposals([proposal,proposal],request,[source],policy).candidates.length,1);
    const ambiguous=bindPersonalMemoryProposals([proposal,{...proposal,value:'把答案放在开头'}],request,[source],policy);
    assert.deepEqual(ambiguous.candidates,[]);
    assert.deepEqual(ambiguous.rejections,['conflicting_proposals']);
  }],
  ['Oversized manifests and result batches fail rather than picking an arbitrary subset', () => {
    assert.throws(()=>preparePersonalMemoryExtraction(Array.from({length:13},(_,i)=>({...source,id:'source-'+i})),policy),/manifest_too_large/);
    assert.throws(()=>preparePersonalMemoryExtraction([{...source,sanitizedText:'字'.repeat(11000)}],policy),/manifest_too_large/);
    assert.throws(()=>bindPersonalMemoryProposals(Array(21).fill(proposal),preparePersonalMemoryExtraction([source],policy),[source],policy),/result_too_large/);
  }],
];
let failed=0;
for (const [name, run] of cases) {
  try { run(); console.log('PASS '+name); }
  catch (error) { failed++; console.error('FAIL '+name+' '+error.message); }
}
console.log(JSON.stringify({ total: cases.length, passed:cases.length-failed, failed }));
if (failed) process.exitCode=1;
