import type { MistakeImageAnalysis } from '../../shared/contracts';

export const VISION_SOLVER_SCHEMA_VERSION = 'omni.vision.solver.v1' as const;

export type VisionSolverCommand = {
  command: string;
  description: string;
  valid: boolean;
  warning?: string;
};

export type VisionSolverDraft = {
  schemaVersion: typeof VISION_SOLVER_SCHEMA_VERSION;
  status: 'ready' | 'no_image' | 'empty_commands';
  hasImage: boolean;
  analysisId?: string;
  imageIsReference: boolean;
  imageReferenceKeywords: string[];
  constraints: string[];
  geometricRelations: string[];
  commands: VisionSolverCommand[];
  ggbScript: string;
  teacherPreview: {
    requiresTeacherReview: true;
    originalImageUploaded: false;
    localImageAvailable: boolean;
    ocrStatus?: MistakeImageAnalysis['ocrStatus'];
    redactionCount: number;
  };
  facts: string[];
  unknowns: string[];
  nextActions: string[];
};

const MAX_COMMANDS = 24;
const MAX_COMMAND_LENGTH = 320;
const MAX_TEXT_LENGTH = 240;

// Reuses DeepTutor's practical GeoGebra surface while keeping the host-side
// execution boundary smaller: no scripts, URLs, assignments to arbitrary
// properties, or commands that can invoke external state.
const ALLOWED_COMMANDS = new Set([
  'ShowAxes', 'ShowGrid', 'Point', 'Midpoint', 'Intersect', 'Center', 'Line',
  'Segment', 'Ray', 'Perpendicular', 'PerpendicularBisector', 'AngleBisector',
  'Vector', 'Circle', 'Ellipse', 'Hyperbola', 'Parabola', 'Polygon', 'Angle',
  'Translate', 'Rotate', 'Reflect', 'Dilate', 'SetColor', 'SetLineThickness',
  'SetPointSize', 'SetLabelVisible', 'SetCaption', 'SetVisible', 'SetLineStyle',
  'Text', 'Function', 'Derivative', 'Integral',
]);

const FORBIDDEN_COMMAND = /(?:https?:\/\/|javascript:|<script|\b(?:Execute|Run|Eval|Import|Export|SetValue|Delete|File|Open|Load)\b|[{};])/iu;
const SENSITIVE_COMMAND_TEXT = /(?:\b\d{7,}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|PRIVATE|RAW|SHOULD[_ ]*NOT[_ ]*LEAK)/iu;
const POINT_ASSIGNMENT = /^[A-Za-z][A-Za-z0-9_]{0,20}\s*=\s*\(\s*[-+0-9A-Za-z_.°\s,]+\s*\)$/u;
const REFERENCE_WORDS = /如图|如图所示|看图|从图中|图示|图中|根据图|观察图|参照图/gu;

function cleanText(value: unknown, max = MAX_TEXT_LENGTH) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function commandName(command: string) {
  const match = command.match(/^\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?([A-Za-z][A-Za-z0-9_]*)\s*(?:\[|\()/);
  return match?.[1] ?? '';
}

function normalizeCommand(command: string) {
  const compact = cleanText(command, MAX_COMMAND_LENGTH);
  if (!compact) return { command: '', valid: false, warning: '命令为空。' };
  if (FORBIDDEN_COMMAND.test(compact)) return { command: '[已拒绝命令]', valid: false, warning: '命令包含脚本、外部资源或未允许的副作用。' };
  if (SENSITIVE_COMMAND_TEXT.test(compact)) return { command: '[已拒绝命令]', valid: false, warning: '命令文本疑似包含个人信息或内部标记，已从草稿中移除。' };
  if (POINT_ASSIGNMENT.test(compact)) return { command: compact, valid: true };
  const name = commandName(compact);
  if (!name || !ALLOWED_COMMANDS.has(name)) return { command: '[已拒绝命令]', valid: false, warning: `命令 ${name || '未知'} 不在 GeoGebra 白名单内。` };
  // DeepTutor's validator repairs the most common parenthesis mistake. We do
  // the same only for known commands and never evaluate the resulting text.
  const repaired = compact.replace(new RegExp(`\\b(${name})\\s*\\((.*)\\)$`, 'u'), '$1[$2]');
  return {
    command: repaired,
    valid: true,
    warning: repaired === compact ? undefined : '已将已知 GeoGebra 命令的圆括号修正为方括号，请老师预览。',
  };
}

function boundedList(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? cleanText(item) : cleanText((item as Record<string, unknown>)?.description))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function buildVisionSolverDraft(params: {
  analysis?: MistakeImageAnalysis;
  questionText?: string;
  commands?: unknown;
  constraints?: unknown;
  geometricRelations?: unknown;
}): VisionSolverDraft {
  const analysis = params.analysis;
  const questionText = cleanText(params.questionText, 1_200);
  const hasImage = Boolean(analysis?.localPath);
  const commands: VisionSolverCommand[] = Array.isArray(params.commands)
    ? params.commands.slice(0, MAX_COMMANDS).map((item) => {
        const record = typeof item === 'string' ? { command: item, description: '' } : (item && typeof item === 'object' ? item as Record<string, unknown> : {});
        const normalized = normalizeCommand(String(record.command ?? ''));
        return {
          command: normalized.command,
          description: cleanText(record.description),
          valid: normalized.valid,
          ...(normalized.warning ? { warning: normalized.warning } : {}),
        };
      }).filter((item) => item.command)
    : [];
  const validCommands = commands.filter((item) => item.valid);
  const keywords = [...new Set((questionText.match(REFERENCE_WORDS) ?? []).map((item) => item.slice(0, 20)))];
  const sanitizedText = cleanText(analysis?.sanitizedText || analysis?.teacherCorrectedText, 1_200);
  const redactionCount = (analysis?.redactions ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0);
  const imageIsReference = keywords.length > 0;
  const unknowns = [
    !hasImage ? '当前没有可用的本地错题图片。' : '',
    hasImage && !sanitizedText ? '图片已有本地文件，但没有可供模型使用的脱敏 OCR/教师修正文。' : '',
    commands.length && validCommands.length !== commands.length ? '部分 GeoGebra 命令未通过白名单校验，未进入草稿脚本。' : '',
    validCommands.length ? '几何关系和坐标仍需老师对照原图确认，不能把图中估算点当作题干事实。' : '没有生成可预览的 GeoGebra 命令。',
  ].filter(Boolean).slice(0, 8);
  const ggbScript = validCommands.map((item) => item.command).join('\n');
  const status: VisionSolverDraft['status'] = !hasImage ? 'no_image' : validCommands.length ? 'ready' : 'empty_commands';
  return {
    schemaVersion: VISION_SOLVER_SCHEMA_VERSION,
    status,
    hasImage,
    ...(analysis?.id ? { analysisId: analysis.id } : {}),
    imageIsReference,
    imageReferenceKeywords: keywords,
    constraints: boundedList(params.constraints),
    geometricRelations: boundedList(params.geometricRelations),
    commands,
    ggbScript,
    teacherPreview: {
      requiresTeacherReview: true,
      originalImageUploaded: false,
      localImageAvailable: hasImage,
      ...(analysis?.ocrStatus ? { ocrStatus: analysis.ocrStatus } : {}),
      redactionCount,
    },
    facts: [
      hasImage ? `已找到本地错题图片分析 ${analysis?.id ?? '未命名'}。` : '未找到本地错题图片分析。',
      sanitizedText ? '只使用了脱敏 OCR/教师修正文作为题干上下文。' : '没有把本地图片原文发送给模型。',
      validCommands.length ? `通过白名单校验的 GeoGebra 命令：${validCommands.length} 条。` : '没有通过白名单校验的 GeoGebra 命令。',
    ],
    unknowns,
    nextActions: validCommands.length
      ? ['老师对照本地原图检查点、线、角和坐标估算。', '确认后再把 ggbScript 草稿用于可视化；本轮不会自动写回或上传原图。']
      : ['先完成本地 OCR 或教师修正，再重新请求几何草稿。', '如果没有几何图片，请改用纯文本解题，不调用视觉求解。'],
  };
}

export function buildVisionSolverMarkdown(draft: VisionSolverDraft) {
  const lines = [
    '## GeoGebra 几何草稿（教师预览）',
    `- 状态：${draft.status}；原图上传：否；需老师复核：是`,
    ...draft.facts.map((item) => `- 事实：${item}`),
    ...draft.unknowns.map((item) => `- 未知/边界：${item}`),
  ];
  if (draft.ggbScript) lines.push('', '```ggbscript[main;题目图形]', draft.ggbScript, '```');
  return lines.join('\n');
}
