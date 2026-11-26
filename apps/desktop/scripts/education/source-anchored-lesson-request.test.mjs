import assert from 'node:assert/strict';
import test from 'node:test';
import '../office-agent/register-source.mjs';
const {naturalLessonDraft} = await import('../../src/main/education/natural-lesson-draft.ts');

test('binds an explicitly named ordinary source and leaves an unstated subject for source resolution', () => {
  assert.deepEqual(naturalLessonDraft('根据 SYN-LESSON-01 制作45分钟七年级一次方程教案，包含两个教学目标、导入5/讲解12/练习18/总结10分钟，例题和检验准确，先确认后导出。'), {
    mode: 'outline', materialTitle: 'SYN-LESSON-01', grade: '七年级', requestedMinutes: 45,
  });
});

test('recognizes another subject and a quoted file name without treating it as a curriculum registration', () => {
  assert.deepEqual(naturalLessonDraft('请参考《昆虫观察笔记.txt》，帮我编写一份35分钟的五年级科学教案。'), {
    mode: 'outline', materialTitle: '昆虫观察笔记.txt', grade: '五年级', subject: '科学', requestedMinutes: 35,
  });
});

test('keeps uniquely registered sources on the existing curriculum path', () => {
  assert.deepEqual(naturalLessonDraft('请根据资料库中的《观察A》，编写35分钟五年级科学教案。'), {
    mode: 'outline', lesson: {grade: '五年级', subject: '科学', curricula: []}, sourceTitles: ['观察A'],
    requestedMinutes: 35,
  });
});

test('leaves template, revision, ambiguous grade, and implicit attachment requests outside auto-admission', () => {
  for (const prompt of [
    '如何参考《昆虫观察笔记.txt》编写五年级科学教案？',
    '不要依据《昆虫观察笔记.txt》编写五年级科学教案。',
    '参考《昆虫观察笔记.txt》编写五年级科学教案模板。',
    '根据《观察A》修改五年级科学教案。',
    '依据《观察A》制作四年级和五年级的联合教案。',
    '依据《观察A》制作五年级语文和科学教案。',
    '根据我上传的资料制作五年级科学教案。',
  ]) assert.equal(naturalLessonDraft(prompt), undefined, prompt);
});
