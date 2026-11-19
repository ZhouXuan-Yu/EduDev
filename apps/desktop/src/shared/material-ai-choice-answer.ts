import {sourceLayoutEnabled,sourceLayoutSignature,sourceLayoutSignatureFor} from './material-ai-source-layout';
import {aiTextSignature,questionNumberPrefix,type AiImageQuestion} from './material-ai-image';
import type {AiPagePrompt} from './material-ai-page';

export const PRINTED_CHOICE_ANSWER = 'printed-choice-answer.v1' as const;
export const PRINTED_CHOICE_LITERAL_ANSWER = 'printed-choice-literal-answer.v1' as const;
export const printedChoiceAnswerEnabled = (prompt?: AiPagePrompt) => prompt?.policy === 'page-fragments.v3' && prompt.choiceAnswerPolicy === PRINTED_CHOICE_ANSWER;
type Option = {label: string; text: string};

/** Literal source labels only. Ambiguous, nested and repeated groups remain unsupported. */
function options(text: string, signature = aiTextSignature, skipBeforeA=false): Option[] | undefined {
  if (!text || text.length > 64000) return;
  let markers = [...text.matchAll(/[（(]([A-H])[）)]|(?:^|\s)([A-H])[.．、]/gu)];
  if (skipBeforeA || signature === sourceLayoutSignature) markers = markers.slice(markers.findIndex(marker => (marker[1] || marker[2]) === 'A'));
  if (markers.length < 2 || markers.length > 8) return;
  const result: Option[] = [];
  for (const [index, marker] of markers.entries()) {
    const label = marker[1] || marker[2];
    if (label !== String.fromCharCode(65 + index)) return;
    if (marker[1] && (marker[0][0] === '(' ? marker[0].at(-1) !== ')' : marker[0].at(-1) !== '）')) return;
    const value = text.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? text.length).trim();
    if (!value || value.length > 2000 || /(?:^|\n)\s*[（(][1-9]\d?[）)]/u.test(value)) return;
    result.push({label, text: signature(value)});
  }
  if (new Set(result.map(option => option.text)).size !== result.length) return;
  return result;
}

function selected(answer: string, source: Option[], signature = aiTextSignature): string[] | undefined {
  let rest = answer.trim();
  const labels: string[] = [];
  while (rest && labels.length < 8) {
    const token = /^([A-H])(?:[ \t]*([（(])([^()（）\r\n]{1,2000})([）)]))?/u.exec(rest);
    if (!token || token[2] && (token[2] === '(' ? token[4] !== ')' : token[4] !== '）')) return;
    const option = source.find(option => option.label === token[1]);
    if (!option || labels.includes(option.label) || token[3] && signature(token[3].trim()) !== option.text) return;
    labels.push(option.label);
    rest = rest.slice(token[0].length).replace(/^[ \t,，、;；\r\n]+/u, '');
  }
  return rest || !labels.length ? undefined : labels.sort();
}

/** Exact question/options bind the representation. Agreement does not prove a solution correct. */
export function printedChoiceAnswerComparison(a: AiImageQuestion, b: AiImageQuestion, prompt?: AiPagePrompt): 'same' | 'conflict' | undefined {
  if (!printedChoiceAnswerEnabled(prompt) || a.number !== b.number || a.answerOrigin !== 'ai_generated' || b.answerOrigin !== 'ai_generated' || a.questionType !== b.questionType || !/选择|单选|多选|choice/iu.test(a.questionType)) return;
  const body = (question: AiImageQuestion) => {
    const prefix = questionNumberPrefix(question.stem, question.number);
    return prefix ? question.stem.slice(prefix[0].length) : question.stem;
  };
  const layout=sourceLayoutEnabled(prompt),signature = layout ? (s:string)=>sourceLayoutSignatureFor(s,prompt,a.number) : aiTextSignature;
  const left = body(a), right = body(b);
  if (signature(left) !== signature(right) || a.projection.choices.state !== 'provided' || b.projection.choices.state !== 'provided') return;
  const source = options(left,signature,layout), other = options(right,signature,layout);
  if (!source || !other || JSON.stringify(source) !== JSON.stringify(other) || JSON.stringify(options(a.projection.choices.text,signature,layout)) !== JSON.stringify(source) || JSON.stringify(options(b.projection.choices.text,signature,layout)) !== JSON.stringify(source)) return;
  const x = selected(a.answer, source,signature), y = selected(b.answer, source,signature);
  if (!x || !y || /单|single/iu.test(a.questionType) && (x.length !== 1 || y.length !== 1)) return 'conflict';
  return JSON.stringify(x) === JSON.stringify(y) ? 'same' : 'conflict';
}

export const PRINTED_CHOICE_ANSWER_INSTRUCTION = `\n[普通选择题答案 printed-choice-answer.v1] 对新增的选择题解答，answer仅填写实际选项字母，多选按原选项顺序填写；选项内容、推导和说明写入analysis。完整原选项继续按来源协议保留，不能为答案改写选项。原件印刷的source答案保持原文。存在真实答案、条件、图义或选项数量疑点时保留原疑点，不能用格式统一声称答案正确或教师确认。`;

/** Frozen for new structure-backed inputs; nested literal roles keep their schema. */
export function printedChoiceLiteralInstruction(prompt: AiPagePrompt | undefined, sourceOnly: boolean) {
  if (sourceOnly || prompt?.policy !== 'page-fragments.v3' || prompt.literalChoiceAnswerPolicy !== PRINTED_CHOICE_LITERAL_ANSWER) return '';
  return PRINTED_CHOICE_ANSWER_INSTRUCTION.replace('printed-choice-answer.v1', PRINTED_CHOICE_LITERAL_ANSWER)
    .replace('answer仅填写', 'answer.text仅填写').replace('写入analysis', '写入analysis.text');
}
