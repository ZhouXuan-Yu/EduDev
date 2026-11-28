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


test('Independent sample and holdout count only checked, explicitly selected originals in the confirmed teaching scope',async()=>{
  const {namedMethodReview,readMethodHistoryEvidence}=await import('../../src/main/xiaozhi-agent/skills/method-history-evidence.ts');
  const method='题目与答案编号复核';
  assert.equal(namedMethodReview('评估方法：'+method),method);
  assert.equal(namedMethodReview('评估方法：甲\n评估方法：乙'),undefined);
  assert(methods.methodReviewOnly('评估方法：'+method));
  const scope={folderId:'current-class',term:'2026-fall'};
  const pin=id=>({id,version:1});
  const source=(id,purpose='发现样本',patch={})=>({
    ref:{kind:'history_request',sessionId:'class-'+id,recordId:id},
    text:'验证方法：'+method+'\n证据用途：'+purpose+'\n试验记录',fingerprint:'source-'+id,
    temporal:{teachingTerm:scope.term},...patch,
  });
  const readings=new Map([
    ['a',source('a')],['b',source('b','留出验证')],['copy',source('copy')],
    ['prior',source('prior','留出验证',{temporal:{comparisonTargetTerm:'2026-fall'}})],
    ['quote',source('quote','留出验证',{attributedContent:{}})],
    ['unreviewed',source('unreviewed','留出验证')],
    ['cross',source('cross','留出验证')],
  ]);
  const inspected=[];
  const options={method,sessionId:'target',selected:['a','b','copy','prior','revoked','quote','unreviewed','cross'].map(pin),
    targetFor:async id=>id==='class-cross'?{...scope,folderId:'other'}:scope,
    source:async ({id})=>{if(!readings.has(id))throw Error('source_changed');return readings.get(id);},
    reviewedTask:async (_session,id)=>{
      inspected.push(id);
      if(id==='unreviewed')return;
      return {taskId:'task-'+id,runId:'run-'+id,resultFingerprint:id==='copy'?'a':id,confirmationId:'accepted-'+id,revision:2,requirementsVersion:1};
    }};
  const result=await readMethodHistoryEvidence(options);
  assert.deepEqual(result.map(item=>[item.role,item.task.taskId]),[['sample','task-a'],['holdout','task-b']]);
  assert.deepEqual(inspected,['a','b','copy','unreviewed']);
  assert.deepEqual(await readMethodHistoryEvidence({...options,selected:[]}),[]);
  assert.deepEqual(await readMethodHistoryEvidence({...options,method:'另一种方法'}),[]);
  readings.delete('b');
  assert.deepEqual((await readMethodHistoryEvidence(options)).map(item=>item.role),['sample']);
});
