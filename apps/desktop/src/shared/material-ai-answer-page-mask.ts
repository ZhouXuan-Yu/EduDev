import {MATERIAL_PAGE_PROMPT,MATERIAL_PAGE_SOURCE} from './material-ai-page';
import {pageSha} from './material-page-preview';
import type {AiUnitInput} from './material-ai';

export const ANSWER_PAGE_HEADER_MASK = 'answer-page-header-mask.v1' as const;
export type AnswerPageHeaderMask = {
  policy: typeof ANSWER_PAGE_HEADER_MASK;
  structureGeneration: string;
  structureSha: string;
  originalImageSha: string;
  masks: [number, number, number, number][];
  privacySha: string;
  textSha: string;
  imageSha: string;
};

export function validAnswerPageHeaderMask(unit: AiUnitInput): boolean {
  const mask = unit.answerPageMask;
  return !!mask && typeof mask === 'object' && Object.keys(mask).length === 8 &&
    mask.policy === ANSWER_PAGE_HEADER_MASK &&
    typeof mask.structureGeneration === 'string' && /^[a-f0-9-]{36}$/i.test(mask.structureGeneration) &&
    [mask.structureSha, mask.originalImageSha, mask.privacySha, mask.textSha, mask.imageSha].every(pageSha) &&
    Array.isArray(mask.masks) && mask.masks.length > 0 && mask.masks.length <= 16 &&
    mask.masks.every(rect => Array.isArray(rect) && rect.length === 4 &&
      rect.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2401) &&
      rect[0] < rect[2] && rect[1] < rect[3]) &&
    mask.imageSha !== mask.originalImageSha && unit.bookRole?.kind === 'answers' && !!unit.bookPagePolicy &&
    !unit.native && Array.isArray(unit.sources) && unit.sources.length === 0 &&
    unit.pageSource?.schemaVersion === MATERIAL_PAGE_SOURCE && unit.pagePrompt?.policy === MATERIAL_PAGE_PROMPT;
}
