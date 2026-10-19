import type { MistakeImageAnalysis } from './contracts';

/**
 * DB 用负置信度作为“云端未提供可信置信度”的无迁移哨兵。
 * 这里统一归一化为 null，并要求教师复核，避免 UI 显示伪造百分比。
 */
export function normalizeMistakeImageAnalysis(analysis: MistakeImageAnalysis): MistakeImageAnalysis {
  const confidence = analysis.ocrConfidence;
  if (typeof confidence === 'number' && Number.isFinite(confidence) && confidence < 0) {
    return {
      ...analysis,
      ocrConfidence: null,
      requiresReview: true,
      ocrSource: 'cloud',
    };
  }
  return analysis;
}

export function normalizeMistakeImageAnalyses(analyses: MistakeImageAnalysis[]): MistakeImageAnalysis[] {
  return analyses.map(normalizeMistakeImageAnalysis);
}
