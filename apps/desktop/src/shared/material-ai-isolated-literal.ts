import type { AiImageQuestion } from './material-ai-image';
import type { AiIssue } from './material-ai';
import type { SourceReading } from './material-ai-source-reading';

type OwnedQuestion = {
  number: string;
  ocrStatus: string;
  crops: {
    sha256: string;
    ocrSha256?: string;
    kind?: string;
    text: string;
    truncated: boolean;
  }[];
};

export function assertLiteralQuestionIdentity(
  previous: AiImageQuestion[],
  ownedQuestions: OwnedQuestion[],
  modelQuestions: unknown[],
): void {
  if (new Set(previous.map(question => question.number)).size !== previous.length) {
    throw Error('invalid_response');
  }

  for (const [index, prior] of previous.entries()) {
    const model = modelQuestions[index];
    const owned = ownedQuestions[index];
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
      (model as Record<string, unknown>).number !== prior.number || owned?.number !== prior.number ||
      !Array.isArray(owned.crops) || owned.crops.length > 8) {
      throw Error('invalid_response');
    }
    if (owned.ocrStatus !== 'available') continue;

    for (const crop of owned.crops) {
      if (!/^[a-f0-9]{64}$/.test(crop.sha256) || typeof crop.ocrSha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(crop.ocrSha256) || typeof crop.text !== 'string' ||
        typeof crop.truncated !== 'boolean' || !['body', 'table', 'figure', 'mixed'].includes(crop.kind || '')) {
        throw Error('invalid_response');
      }
    }
  }
}

/** Keep the first draft as a held placeholder with explicitly unavailable readings. */
export function heldLiteralQuestion(prior: AiImageQuestion, owned: OwnedQuestion): {
  question: AiImageQuestion;
  reading: SourceReading;
} {
  const issues: AiIssue[] = [...new Set<AiIssue>([
    ...prior.issues, 'uncertain_ocr', 'incomplete_question',
  ])];
  if (issues.length > 5) throw Error('invalid_response');

  const requiresImage = prior.requiresImage || owned.crops.some(crop =>
    crop.kind === 'figure' || crop.kind === 'mixed');
  const projection = structuredClone(prior.projection);
  if (requiresImage) projection.figures = { state: 'missing', text: '' };

  return {
    question: {
      ...prior,
      answer: '',
      analysis: '',
      answerOrigin: 'missing',
      analysisOrigin: 'missing',
      requiresImage,
      issues,
      projection,
    },
    reading: {
      number: prior.number,
      crops: owned.ocrStatus === 'available' ? owned.crops.map(crop => ({
        sha256: crop.sha256,
        ocrSha256: crop.ocrSha256!,
        text: '',
        parts: [],
        assessment: 'uncertain',
        issues: ['uncertain_ocr'],
      })) : [],
    },
  };
}
