import {aiTextSignature,type AiImageQuestion} from './material-ai-image';
import type {AiPagePrompt} from './material-ai-page';

export const SOURCE_LAYOUT_TEXT = 'source-layout-text.v1' as const;
export const sourceLayoutEnabled = (prompt?: AiPagePrompt) => prompt?.policy === 'page-fragments.v3' && prompt.sourceLayoutPolicy === SOURCE_LAYOUT_TEXT;

/** Chinese typesetting boundaries only. Spaces inside mathematical/Latin tokens survive. */
export function sourceLayoutSignature(text: string) {
  return aiTextSignature(text.normalize('NFC').replace(/(?<=\p{Script=Han})[ \t\r\n]+(?=[\p{Script=Han}A-Za-z\p{N}\p{Script=Greek}])|(?<=[A-Za-z\p{N}\p{Script=Greek}])[ \t\r\n]+(?=\p{Script=Han})/gu, ''));
}

/** Comparison copy. Raw models, source readings and the archived question retain their text. */
export function sourceLayoutQuestion(question: AiImageQuestion, prompt?: AiPagePrompt): AiImageQuestion {
  if (!sourceLayoutEnabled(prompt)) return question;
  const projection = {...question.projection};
  for (const role of ['statement','formulas','choices','subquestions'] as const) {
    projection[role] = {...projection[role], text:sourceLayoutSignature(projection[role].text)};
  }
  return {...question,stem:sourceLayoutSignature(question.stem),projection};
}
