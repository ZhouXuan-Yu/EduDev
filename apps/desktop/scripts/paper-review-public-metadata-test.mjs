import assert from 'node:assert/strict';
import {test} from 'node:test';
import {paperReviewRunMetadata} from './acceptance/paper-review-public-metadata.mjs';

test('only fixed public metadata survives a turn containing synthetic private fields',()=>{
  const secret='SYNTHETIC_PRIVATE_SENTINEL';
  const result=paperReviewRunMetadata({id:'run_fixture',status:'completed',text:secret,
    modelReasoning:[{text:secret}],error:secret,payload:{secret},task:{text:secret},
    items:[{kind:'message',text:secret},{kind:'tool',toolName:'education_propose_paper',status:'failed',
      toolAttempt:{code:'task_blocked'},text:secret,resultSummary:{text:secret},payload:{secret}},
    {kind:'reasoning',text:secret}]});
  assert.deepEqual(result,{id:'run_fixture',status:'completed',itemKindCounts:{message:1,tool:1,other:1},
    tools:[{tool:'education_propose_paper',status:'failed',code:'task_blocked'}]});
  assert(!JSON.stringify(result).includes(secret));
  assert.deepEqual(Object.keys(result),['id','status','itemKindCounts','tools']);
});

test('metadata projection is re-allowlisted without forwarding extra properties',()=>{
  const result=paperReviewRunMetadata({id:'run_fixture',status:'failed',itemKindCounts:{message:2,tool:1,other:0,secret:'PRIVATE'},
    tools:[{tool:'education_read_paper',status:'completed',code:'PRIVATE',payload:'PRIVATE'}],extra:'PRIVATE'});
  assert.equal(result.tools[0].code,undefined);
  assert(!JSON.stringify(result).includes('PRIVATE'));
  assert.deepEqual(result.itemKindCounts,{message:2,tool:1,other:0});
});

test('malformed identifiers, statuses, counts and errors fail closed',()=>{
  assert.equal(paperReviewRunMetadata(null),null);
  const result=paperReviewRunMetadata({id:{private:'VALUE'},status:{private:'VALUE'},
    itemKindCounts:{message:-1,tool:Infinity,other:'VALUE'},tools:[{tool:'tool PRIVATE',status:'PRIVATE',code:'PRIVATE'}]});
  assert.equal(result.id,null);assert.equal(result.status,'unknown');
  assert.deepEqual(result.itemKindCounts,{message:0,tool:0,other:0});
  assert.equal(result.tools[0].tool,'unknown');assert.equal(result.tools[0].status,'unknown');
  assert(!JSON.stringify(result).includes('PRIVATE'));
});

test('returned DTO does not alias mutable source objects',()=>{
  const source={id:'run_fixture',status:'running',itemKindCounts:{tool:1},tools:[{tool:'education_read_paper',status:'running'}]};
  const result=paperReviewRunMetadata(source);
  source.tools[0].text='PRIVATE';source.tools[0].status='failed';source.itemKindCounts.tool=9;
  assert.equal(result.tools[0].status,'running');assert.equal(result.itemKindCounts.tool,1);
  assert(!JSON.stringify(result).includes('PRIVATE'));
});
