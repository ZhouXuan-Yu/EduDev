import '../office-agent/register-source.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const methods=await import('../../src/main/xiaozhi-agent/skills/tools.ts');

test('Current Task evidence distinguishes teacher review, file readback and method adoption',()=>{
  const owner={sessionId:'session',runId:'new-run',generation:3,taskId:'task'};
  const criteria=[{id:'human',version:2,kind:'human'},{id:'file',version:1,kind:'file'}];
  const confirmation={criterionId:'human',criterionVersion:2,state:'failed',authority:'teacher',confirmationId:'decision',
    runId:'prior',candidate:{runId:'prior'},digest:'a'.repeat(64)};
  const readback={criterionId:'file',criterionVersion:1,state:'passed',authority:'readback',callId:'call',digest:'b'.repeat(64)};
  const task={state:'active',id:owner.taskId,sessionId:owner.sessionId,binding:owner,requirementsVersion:4,criteria,checks:[confirmation,readback]};
  const review=methods.currentMethodEvidence(task,owner);
  assert.deepEqual(review,{category:'reusable_method',scope:'current_task',requirementsVersion:4,
    teacherAccepted:0,teacherRejected:1,readbackPassed:1,independentValidation:'not_established'});
  assert.equal(methods.currentMethodEvidence(task,{...owner,generation:4}),undefined);
  assert.equal(methods.currentMethodEvidence(task,{...owner,taskId:'other'}),undefined);
  assert.equal(methods.currentMethodEvidence({...task,state:'ended'},owner),undefined);
  for(const checks of [[{...confirmation,criterionVersion:1}], [{...confirmation,confirmationId:''}],[{...readback,callId:''}]]){
    const observed=methods.currentMethodEvidence({...task,checks},owner);
    assert.equal(observed.teacherRejected+observed.teacherAccepted+observed.readbackPassed,0);
  }
  const duplicate=methods.currentMethodEvidence({...task,checks:[confirmation,confirmation,readback,readback]},owner);
  assert.deepEqual(duplicate,review);
});

test('Task instructions for a trial do not convert the trial into Skill publication',()=>{
  for(const prompt of ['将备课流程留作候选，核对适用条件。','请先试用这个方法。','暂不启用个人技能。']){
    assert.equal(methods.methodReviewOnly(prompt),true);
  }
  for(const prompt of ['请把已验证的通用流程保存为个人技能。','请先检查这一题的计算。']){
    assert.equal(methods.methodReviewOnly(prompt),false);
  }
});
