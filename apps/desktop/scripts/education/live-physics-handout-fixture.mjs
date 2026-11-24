import assert from 'node:assert/strict';

export const physicsHandout = {
  title:'浮力与物体浮沉分层讲义',
  firstName:'浮力与排开液体.md',
  secondName:'物体浮沉条件.md',
  duplicateName:'浮力补充.md',
  quote:'物体受到的浮力等于它排开的液体所受的重力。',
  secondQuote:'静止漂浮时，物体所受浮力与重力大小相等、方向相反。',
  distractor:'观察物体浮沉前，先确认物体是否受到容器底部支持。',
  prompt:'请根据资料库里的《浮力与排开液体.md》和《物体浮沉条件》制作一份八年级可编辑物理讲义，标题是《浮力与物体浮沉分层讲义》，只做一章。两份资料都至少引用一句实读原文。用阿基米德原理讲解浮力，保留重点难点。例题用水的密度 1000 kg/m³、g=10 N/kg、排水体积 0.002 m³，分步求浮力。基础练习改用排水体积 0.0015 m³ 求浮力，巩固练习求质量 0.8 kg 的物体静止漂浮时的浮力。两题按基础、巩固排序，附答案和解析。公式使用 LaTeX。先保存草稿让我核对。',
};

export const physicsNotation = value => value.replace(/\\times\b/gu,'×')
  .replace(/\\(?:mathrm|text|textnormal|operatorname)\b|\\(?:[,;!]|\s+)|[\s{}$`]/gu,'');

export function assertPhysicsHandout(role) {
  const text=block=>physicsNotation(block.payload.text);
  assert.match(text(role('example')[0]),/0\.002|2×10\^?-3/u);
  const example=text(role('worked_solution')[0]);
  assert.match(example,/20(?:N|牛)/u);
  assert.match(example,/1000/u);
  assert.match(example,/浮力|重力|阿基米德|F_?浮/u);
  const [first,second]=role('exercise');
  assert.match(text(first),/0\.0015|1\.5×10\^?-3/u);
  assert.match(text(second),/0\.8/u);
  const [firstAnswer,secondAnswer]=role('exercise_solution').map(text);
  assert.match(firstAnswer,/15(?:N|牛)/u);
  assert.match(secondAnswer,/(?:^|[^0-9.])8(?:N|牛)/u);
  assert.match(secondAnswer,/漂浮|平衡/u);
}
