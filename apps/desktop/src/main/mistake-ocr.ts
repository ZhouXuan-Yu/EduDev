import type {
  MistakeImageAnalysis,
  MistakeImageCloudOcrInput,
  MistakeImageCloudOcrResult,
} from '../shared/contracts';
import { normalizeMistakeImageAnalysis } from '../shared/mistake-ocr';

export type OcrFileInfo = {
  exists: boolean;
  size: number;
};

export type LocalOcrRunResult =
  | { ok: true; lines: Array<{ text: string; confidence: number }>; lowConfidenceCount: number; modelVersion: string }
  | { ok: false; code: string; message: string };

export type CloudOcrProviderResult =
  | { ok: true; text: string; model: string }
  | { ok: false; message: string };

export type MistakeOcrApplyInput = {
  text: string;
  confidence: number;
  lowConfidenceCount: number;
  modelVersion: string;
};

export type LocalOcrDeps = {
  getAnalysis: (analysisId: string) => Promise<MistakeImageAnalysis | null>;
  isManagedLocalPath: (filePath: string) => Promise<boolean>;
  getFileInfo: (filePath: string) => Promise<OcrFileInfo>;
  runLocalOcr: (imagePath: string) => Promise<LocalOcrRunResult>;
  applyResult: (analysisId: string, result: MistakeOcrApplyInput) => Promise<MistakeImageAnalysis>;
  markFailed: (analysisId: string, message: string) => Promise<MistakeImageAnalysis>;
};

export type CloudOcrDeps = {
  getAnalysis: (analysisId: string) => Promise<MistakeImageAnalysis | null>;
  isManagedLocalPath: (filePath: string) => Promise<boolean>;
  getFileInfo: (filePath: string) => Promise<OcrFileInfo>;
  getApiSettings: () => Promise<{ apiKey?: string; model: string }>;
  analyzeImage: (params: {
    imagePath: string;
    prompt: string;
    apiKey: string;
    model?: string;
  }) => Promise<CloudOcrProviderResult>;
  applyResult: (analysisId: string, result: MistakeOcrApplyInput) => Promise<MistakeImageAnalysis>;
  now?: () => Date;
  createRequestId?: () => string;
};

export type CloudOcrFailureCode =
  | 'invalid_input'
  | 'not_found'
  | 'unsafe_path'
  | 'consent_required'
  | 'missing_api_key'
  | 'provider_failed';

export type CloudOcrOutcome =
  | { ok: true; result: MistakeImageCloudOcrResult }
  | { ok: false; code: CloudOcrFailureCode; message: string };

const CLOUD_OCR_PROMPT =
  '请识别这张错题图片中的全部文字，按行输出，保留数学符号和公式的原样书写（如分数、百分号）。不要解释，只输出图片中的文字内容。';

const MAX_TEACHER_NOTE_CHARS = 500;

function fail(code: CloudOcrFailureCode, message: string): CloudOcrOutcome {
  return { ok: false, code, message };
}

export async function runLocalOcr(analysisId: string, deps: LocalOcrDeps): Promise<MistakeImageAnalysis> {
  const id = typeof analysisId === 'string' ? analysisId.trim() : '';
  if (!id) throw new Error('缺少错题图片解析记录 ID');
  const analysis = await deps.getAnalysis(id);
  if (!analysis) throw new Error('错题图片解析记录不存在');
  if (!(await deps.isManagedLocalPath(analysis.localPath))) {
    throw new Error('错题图片文件不在本地受管目录内或已缺失');
  }
  const fileInfo = await deps.getFileInfo(analysis.localPath);
  if (!fileInfo.exists) {
    throw new Error('错题图片文件不在本地受管目录内或已缺失');
  }
  // 本地失败只标记失败，绝不自动回退到云端；云端识别必须由教师另行显式确认。
  const result = await deps.runLocalOcr(analysis.localPath);
  if (!result.ok) {
    await deps.markFailed(id, `${result.code}: ${result.message}`);
    throw new Error(result.message);
  }
  const confidence = result.lines.length
    ? Math.min(...result.lines.map((line) => line.confidence))
    : 0;
  return deps.applyResult(id, {
    text: result.lines.map((line) => line.text).join('\n'),
    confidence,
    lowConfidenceCount: result.lowConfidenceCount,
    modelVersion: result.modelVersion,
  });
}

export async function runCloudOcr(
  input: MistakeImageCloudOcrInput | null | undefined,
  deps: CloudOcrDeps,
): Promise<CloudOcrOutcome> {
  if (!input || typeof input !== 'object') {
    return fail('invalid_input', '缺少云端 OCR 参数。');
  }
  const analysisId = typeof input.analysisId === 'string' ? input.analysisId.trim() : '';
  if (!analysisId) {
    return fail('invalid_input', '缺少错题图片解析记录 ID。');
  }
  if (input.teacherNote !== undefined && (typeof input.teacherNote !== 'string' || input.teacherNote.length > MAX_TEACHER_NOTE_CHARS)) {
    return fail('invalid_input', `教师备注必须是不超过 ${MAX_TEACHER_NOTE_CHARS} 字符的文本。`);
  }

  const analysis = await deps.getAnalysis(analysisId);
  if (!analysis) {
    return fail('not_found', '错题图片解析记录不存在。');
  }
  if (!(await deps.isManagedLocalPath(analysis.localPath))) {
    return fail('unsafe_path', '错题图片文件不在本地受管目录内或已缺失。');
  }
  const fileInfo = await deps.getFileInfo(analysis.localPath);
  if (!fileInfo.exists || fileInfo.size <= 0) {
    return fail('unsafe_path', '错题图片文件不在本地受管目录内或已缺失。');
  }

  // 显式同意必须发生在读取图片和调用 provider 之前。
  if (input.confirmedUploadOriginal !== true) {
    return fail('consent_required', '必须由教师明确确认“会上传原图到云端”后才能调用云端识别。');
  }

  const settings = await deps.getApiSettings();
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return fail('missing_api_key', '缺少 DeepSeek API Key。请在设置页保存 DeepSeek API 配置后再使用云端识别。');
  }

  const confirmedAt = (deps.now?.() ?? new Date()).toISOString();
  const requestId = deps.createRequestId?.() ?? `cloud_ocr_${Date.now().toString(36)}`;

  const providerResult = await deps.analyzeImage({
    imagePath: analysis.localPath,
    prompt: CLOUD_OCR_PROMPT,
    apiKey,
    model: settings.model,
  });
  if (!providerResult.ok) {
    return fail('provider_failed', `云端识别失败：${providerResult.message}`);
  }
  const text = providerResult.text.trim();
  if (!text) {
    return fail('provider_failed', '云端识别返回空内容；未写入识别结果，请改用本地 OCR 或重试。');
  }

  // -1 是“未提供可信置信度”的落库哨兵；db.ts 保持不变，返回前归一化为 null。
  const saved = await deps.applyResult(analysisId, {
    text,
    confidence: -1,
    lowConfidenceCount: 0,
    modelVersion: `deepseek-cloud:${providerResult.model}`,
  });

  return {
    ok: true,
    result: {
      analysis: normalizeMistakeImageAnalysis(saved),
      audit: {
        provider: 'deepseek',
        model: providerResult.model,
        requestId,
        confirmedAt,
        imageBytes: fileInfo.size,
      },
    },
  };
}
