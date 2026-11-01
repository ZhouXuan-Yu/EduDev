// Recognize explicit length phrasing, not arbitrary numbers or a guessed task scope.
// Unrecognized/ambiguous phrasing stays in the original teacher request unchanged.
const count = String.raw`\d+(?:\s*(?:[-–—~～]|至|到)\s*\d+)?`;
const chineseLength = new RegExp(String.raw`(?:用|以|写|控制在|限定为|限制在|不超过|不多于|不少于|至少|至多|字数(?:为|是|[:：])?)\s*(?:大约|约|最多|最少)?\s*${count}\s*(?:字符|字)(?![母样体形画])`, 'u');
const englishLength = new RegExp(String.raw`\b(?:in|within|under|at most|at least|no more than|no fewer than|limited to|word count[:=]?)\s+(?:(?:about|around|approximately)\s+)?${count}\s+(?:words?|characters?)\b`, 'iu');

/** Per-request guidance only: no inferred numeric limit, output rewriting or budget changes. */
export function responseScopeInstructions(text: string, hasSubjectConstraints = false): string {
  const explicitLength = chineseLength.test(text) || englishLength.test(text);
  if (!explicitLength && !hasSubjectConstraints) return '';
  return [
    '[本次回答的范围与篇幅]',
    '只交付教师本次要求的内容。学科护栏用于核对，不是额外输出提纲；正文保留结论成立必需的条件和来源边界，不删必要条件来缩短，也不因核对规则涉及某知识点就增加未被询问的规律或扩展段落。',
    ...(explicitLength ? [
      '仅按教师原文明确的对象应用篇幅要求：若字数只限定解释、摘要等部分，就核对该部分；另行要求的题目与答案分开呈现。若限定全文或总字数，所有部分共同计入，不擅自把题目、答案或引用排除。多个范围分别遵守，不合并、不猜分配，也不把资料中的数字、题号或示例当作字数指令。',
      '按指定语言和计数单位核对，为公式、标点及引用的可见文字预留余量；按字符计数时不只统计汉字，按words要求时不擅自改成字符计数。解释与额外任务的计数边界不明确时保守控制篇幅，不自行新增数值上限、容差或变式格式。',
    ] : []),
  ].join('\n');
}
