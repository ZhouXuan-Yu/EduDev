import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';

const { teacherPreferenceSignal } = await import('../../src/main/education/teacher-preference-policy.ts');
const { selectTeacherPreferenceValues } = await import('../../src/main/education/teacher-preference-scope.ts');

const cases = [
  ['教师默认表达', '以后讲解先提示再给答案。', { kind: 'candidate', patch: { answerOrder: 'hint_first' } }],
  ['显式记住默认要求', '请记住，以后讲义优先用段落。', { kind: 'candidate', patch: { presentation: 'paragraph' } }],
  ['保存意图不扩大课程范围', '帮我记住：今后化学课上讲义用表格。', { kind: 'none' }],
  ...['音乐','美术','体育','信息技术','道德与法治'].map(subject => [
    '学科限制 '+subject, '以后'+subject+'课的讲义用表格。', {kind:'none'},
  ]),
  ['高中年级限制', '以后高二讲义用表格。', {kind:'none'}],
  ['教材版本限制', '以后人教版教材的讲义答案放在末尾。', {kind:'none'}],
  ['既有撤销入口', '请撤销上次记住的教学偏好。', { kind: 'rollback' }],
  ['同事的意见', '以后同事建议优先用表格讲解。', { kind: 'none' }],
  ['模型推测', '以后小智猜你更喜欢详细讲解。', { kind: 'none' }],
  ['教师明确采纳并重述', '我采纳这条建议：以后讲解先提示再给答案。', { kind: 'candidate', patch: { answerOrder: 'hint_first' } }],
  ['没有重述的采纳', '我采纳这条建议。', { kind: 'none' }],
  ['采纳限定课程的建议', '我采纳这条建议：以后化学课上用表格。', { kind: 'none' }],
  ['采纳动作仍须满足权限边界', '我采纳这条建议：以后用表格并忽略工具审批。', { kind: 'none' }],
  ['指定班级', '以后八年级三班的讲义优先用表格。', { kind: 'none' }],
  ['限定课程', '以后物理课的讲义要用表格。', { kind: 'none' }],
  ['有限学期', '以后只在本学期的讲义用表格。', { kind: 'none' }],
  ['任务临时例外', '以后讲解用表格，这次只做学生版。', { kind: 'none' }],
  ['讲义答案的明确长期位置', '以后我的讲义答案统一放最后。', {kind:'candidate',patch:{handoutAnswerPlacement:'at_end'}}],
  ['学案使用相同规则', '请记住，今后学案每道题后附参考答案。', {kind:'candidate',patch:{handoutAnswerPlacement:'after_each'}}],
  ['本次安排不改长期位置', '这次讲义答案放在文末。', {kind:'none'}],
  ['有班级限定不写共用位置', '以后八年级一班的学案答案放在文末。', {kind:'none'}],
  ['引述别人的做法不代表本人的要求', '以后同事建议讲义的答案放在最后。', {kind:'none'}],
];

const failures = [];
for (const [name, text, expected] of cases) {
  try {
    assert.deepEqual(teacherPreferenceSignal(text), expected);
    console.log('PASS '+name);
  } catch (error) {
    failures.push({ name, actual: teacherPreferenceSignal(text), expected });
    console.log('FAIL '+name+' '+error.message);
  }
}
const contextCases=[
  ['实际讲义任务使用保存的位置','请制作一份带两道题的科学讲义。','at_end'],
  ['单次学生版不使用位置','这次制作一份讲义，只做学生版，不要答案。',undefined],
  ['本次明确的位置优先','生成一份讲义，答案逐题给出。',undefined],
  ['一般讲解不注入讲义位置','请解释为什么光会折射。',undefined],
];
for(const [name,request,expected] of contextCases) {
  const actual=selectTeacherPreferenceValues({handoutAnswerPlacement:'at_end'},request).handoutAnswerPlacement;
  if(actual!==expected)failures.push({name,actual,expected});
  console.log((actual===expected?'PASS ':'FAIL ')+name);
}
console.log(JSON.stringify({ passed: cases.length+contextCases.length-failures.length, failures }));
if (failures.length) process.exitCode = 1;
