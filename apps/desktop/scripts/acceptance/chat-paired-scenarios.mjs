/** Exact prompts shared by the two existing UI runners; no model/runtime work. */
export const pairedScenarios = Object.freeze({
  default: Object.freeze({
    prompt: '请读取附件里的合成资料，为八年级浮力实验课写一份40分钟教学活动建议，正文约300字。需要准确引用附件内容，先说明将如何使用资料，再调用适用工具；不要联网，不写入本地文件。',
    explanation: '为什么受到浮力不一定会上浮？',
    explainBeforeTools: true,
  }),
  misconception: Object.freeze({
    prompt: '有学生说：物体受到浮力就一定会上浮。请结合附件的3N和2N数据，诊断这个说法，用约200字解释，并给一道变式及答案。',
    explainBeforeTools: false,
  }),
  practice: Object.freeze({
    prompt: '请依据附件设计3道八年级浮力形成性检查题，分别检查浮力计算、浮沉判断和实验变量；每题附答案、简短解释和引用依据，不补造附件没有的数据。',
    explainBeforeTools: false,
  }),
});

export function pairedScenario(args = process.argv.slice(2), env = process.env) {
  const flags = args.filter(arg => arg.startsWith('--scenario='));
  if (flags.length > 1) throw Error('Only one --scenario= is permitted');
  const name = flags[0]?.slice('--scenario='.length) ?? env.UI_PAIRED_SCENARIO ?? 'default';
  if (!Object.hasOwn(pairedScenarios, name)) throw Error('Unknown paired scenario: ' + name);
  const preset = pairedScenarios[name];
  const prompt = env.UI_PAIRED_PROMPT ?? preset.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10000)
    throw Error('UI_PAIRED_PROMPT must be a nonempty prompt of at most 10000 characters');
  // Preserve caller bytes: paired comparisons must not silently trim/rewrite input.
  return { name, ...preset, prompt, promptOverride: env.UI_PAIRED_PROMPT !== undefined };
}
