import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';

const { teacherPreferenceSignal } = await import('../../src/main/education/teacher-preference-policy.ts');

const cases = [
  ['教师默认表达', '以后讲解先提示再给答案。', { kind: 'candidate', patch: { answerOrder: 'hint_first' } }],
  ['显式记住默认要求', '请记住，以后讲义优先用段落。', { kind: 'candidate', patch: { presentation: 'paragraph' } }],
  ['保存意图不扩大课程范围', '帮我记住：今后化学课上讲义用表格。', { kind: 'none' }],
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
console.log(JSON.stringify({ passed: cases.length-failures.length, failures }));
if (failures.length) process.exitCode = 1;
