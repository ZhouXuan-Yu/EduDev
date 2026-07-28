import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sqlite3 from 'sqlite3';
import { hashFileSha256, isInsideRoot, resolveInsideRoot } from './local-file-security';
import type {
  Attachment,
  AttachmentImportItem,
  AttachmentImportResult,
  AiConfirmationCreateInput,
  AiConfirmationDecisionResult,
  AiConfirmationItem,
  AiConfirmationPayload,
  AiConfirmationStatus,
  AiAgentEvent,
  AiAgentRun,
  AiAgentRunStatus,
  AiAgentTraceStep,
  AiConsoleRunResult,
  AiConversationDetail,
  AiConversationFolder,
  AiConversationFolderInput,
  AiConversationFolderUpdateInput,
  AiConversationMessage,
  AiConversationMessageInput,
  AiConversationSession,
  AiConversationSessionInput,
  AiConversationSessionUpdateInput,
  AiConversationWorkspace,
  AiRegressionGate,
  AiRegressionGateStatus,
  AiRegressionReport,
  AiRegressionReportInput,
  AiTelemetryLatency,
  AiTelemetrySnapshot,
  BootstrapData,
  DeepSeekSettings,
  DeepSeekSettingsInput,
  DocumentArtifactExportInput,
  DocumentArtifactExportResult,
  DocumentArtifactType,
  ExerciseSet,
  ExerciseSetDraftPayload,
  ExerciseSetItem,
  ExportDataRootResult,
  ExportStudentResult,
  KnowledgeEvidenceStrength,
  KnowledgeEdge,
  KnowledgeImportResult,
  KnowledgeNode,
  KnowledgeOverview,
  KnowledgeSourceTrust,
  LearningRecord,
  LearningRecordFilters,
  LearningRecordInput,
  LearningRecordUpdateInput,
  MistakeImageAnalysis,
  MistakeImageAnalysisInput,
  MistakeImageCorrectionInput,
  MistakeImageRedaction,
  MistakeImageOcrStatus,
  PlatformOverview,
  QuestionBankItem,
  QuestionBankItemInput,
  QuestionSearchFilters,
  SanitizedProblemText,
  ResourceChunk,
  ReviewDraftInput,
  ReviewReport,
  ReviewQualityCheck,
  SearchResult,
  Student,
  StudentInput,
} from '../shared/contracts';

type SqlValue = string | number | null | Buffer;
type Row = Record<string, unknown>;

const DEFAULT_RECORD_PAGE_SIZE = 100;
const MAX_RECORD_PAGE_SIZE = 500;
const FTS_MATCH_LIMIT = 500;
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

function now() {
  return new Date().toISOString();
}

function normalizeIsoDate(value?: string) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function incrementCount(target: Record<string, number>, key: string, amount = 1) {
  const safeKey = key || 'unknown';
  target[safeKey] = (target[safeKey] ?? 0) + amount;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return Math.round(sorted[Math.max(0, index)]);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function jsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toCsvList(value: string | undefined) {
  return (value ?? '')
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function searchTokens(value: string | undefined) {
  return (value ?? '')
    .split(/[\s，,、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableKnowledgeId(prefix: string, value: string) {
  return `${prefix}_${createHash('sha1').update(value.trim().toLowerCase()).digest('hex').slice(0, 16)}`;
}

function includesAny(text: string, candidates: string[]) {
  return candidates.find((candidate) => text.includes(candidate)) ?? '';
}

function inferKnowledgeSubject(text: string) {
  return includesAny(text, ['数学', '英语', '语文', '物理', '化学', '生物', '历史', '地理', '道德与法治', '科学']);
}

function inferKnowledgeGrade(text: string) {
  const direct = text.match(/(小学[一二三四五六]|[一二三四五六]年级|七年级|八年级|九年级|初[一二三]|高[一二三]|初中|高中)/);
  return direct?.[1] ?? '';
}

function inferKnowledgePoint(text: string) {
  const labeled = text.match(/(?:知识点|考点|主题|专题)[:：]\s*([^\n，,。；;]{2,24})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text, [
    '一次函数',
    '二次函数',
    '反比例函数',
    '方程应用题',
    '分式方程',
    '几何证明',
    '阅读理解',
    '完形填空',
    '古诗鉴赏',
    '电路分析',
    '化学方程式',
  ]);
}

function inferQuestionType(text: string) {
  const labeled = text.match(/(?:题型|类型)[:：]\s*([^\n，,。；;]{2,16})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text, ['选择题', '填空题', '解答题', '应用题', '证明题', '阅读理解', '写作题']);
}

function inferDifficulty(text: string) {
  if (/难度[:：]?\s*(hard|困难|较难|压轴)/i.test(text)) return 'hard';
  if (/难度[:：]?\s*(easy|简单|基础|入门)/i.test(text)) return 'easy';
  if (/难度[:：]?\s*(medium|中等|适中)/i.test(text)) return 'medium';
  return '';
}

function containsPersonalData(text: string) {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)
    || /(?<!\d)1[3-9]\d{9}(?!\d)/.test(text)
    || /(?<!\d)\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(text);
}

function inferResourceChunkMetadata(resourceTitle: string, heading: string, content: string) {
  const text = `${resourceTitle}\n${heading}\n${content}`;
  const subject = inferKnowledgeSubject(text);
  const grade = inferKnowledgeGrade(text);
  const knowledgePoint = inferKnowledgePoint(text);
  const questionType = inferQuestionType(text);
  const difficulty = inferDifficulty(text);
  const personal = containsPersonalData(text);
  const sourceTrust: KnowledgeSourceTrust = personal ? 'unverified' : 'teacher_verified';
  const qualityScore = clampNumber(
    45
      + (heading ? 10 : 0)
      + (content.trim().length >= 80 ? 10 : 0)
      + (subject ? 8 : 0)
      + (grade ? 6 : 0)
      + (knowledgePoint ? 10 : 0)
      + (questionType ? 6 : 0)
      - (personal ? 30 : 0),
    0,
    100,
  );
  const evidenceStrength: KnowledgeEvidenceStrength = personal
    ? 'background'
    : qualityScore >= 78
      ? 'direct'
      : qualityScore >= 60
        ? 'indirect'
        : 'background';
  return {
    subject,
    grade,
    knowledgePoint,
    questionType,
    difficulty,
    sourceTrust,
    containsPersonalData: personal,
    qualityScore,
    evidenceStrength,
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function jsonUnknownArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAiConfirmationPayload(value: unknown): AiConfirmationPayload {
  const parsed = jsonObject(value);
  const exerciseSet = parseExerciseSetDraftPayload(parsed.exerciseSet);
  return {
    studentId: String(parsed.studentId ?? ''),
    subject: String(parsed.subject ?? ''),
    startDate: String(parsed.startDate ?? ''),
    endDate: String(parsed.endDate ?? ''),
    reportType: String(parsed.reportType ?? 'ai_draft'),
    title: String(parsed.title ?? ''),
    contentMd: String(parsed.contentMd ?? ''),
    parentSummary: String(parsed.parentSummary ?? ''),
    sourceRecordIds: Array.isArray(parsed.sourceRecordIds) ? parsed.sourceRecordIds.map(String) : [],
    exerciseSet,
  };
}

function normalizeDifficulty(value: unknown): ExerciseSetItem['difficulty'] {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

function parseExerciseSetItems(value: unknown): ExerciseSetItem[] {
  if (!Array.isArray(value)) return [];
  const items: ExerciseSetItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const role = row.role === 'original' || row.role === 'similar' || row.role === 'variant'
      ? row.role
      : 'variant';
    const stem = String(row.stem ?? '').trim();
    if (!stem) continue;
    items.push({
      role,
      questionId: String(row.questionId ?? '').trim() || undefined,
      sourceKind: row.sourceKind === 'local_bank' || row.sourceKind === 'teacher_resource' ? row.sourceKind : 'generated',
      stem,
      answer: String(row.answer ?? '').trim(),
      analysis: String(row.analysis ?? '').trim(),
      knowledgePoint: String(row.knowledgePoint ?? '').trim(),
      difficulty: normalizeDifficulty(row.difficulty),
      teacherObservation: String(row.teacherObservation ?? '').trim(),
    });
  }
  return items;
}

function parseExerciseSetDraftPayload(value: unknown): ExerciseSetDraftPayload | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const parsed = value as Record<string, unknown>;
  const title = String(parsed.title ?? '').trim();
  const contentMd = String(parsed.contentMd ?? '').trim();
  if (!title && !contentMd) return undefined;
  return {
    title,
    subject: String(parsed.subject ?? '').trim(),
    knowledgePoint: String(parsed.knowledgePoint ?? '').trim(),
    contentMd,
    items: parseExerciseSetItems(parsed.items),
    sourceQuestionIds: Array.isArray(parsed.sourceQuestionIds) ? parsed.sourceQuestionIds.map(String) : [],
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactPattern(text: string, pattern: RegExp, token: string) {
  let count = 0;
  const sanitizedText = text.replace(pattern, () => {
    count += 1;
    return token;
  });
  return { sanitizedText, count };
}

function pushRedaction(redactions: MistakeImageRedaction[], kind: MistakeImageRedaction['kind'], count: number) {
  if (count <= 0) return;
  const existing = redactions.find((item) => item.kind === kind);
  if (existing) existing.count += count;
  else redactions.push({ kind, count });
}

function parseMistakeImageRedactions(value: unknown): MistakeImageRedaction[] {
  return jsonUnknownArray(value)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const kind = row.kind === 'phone' || row.kind === 'id_card' || row.kind === 'student_name' || row.kind === 'email'
        ? row.kind
        : undefined;
      const count = Number(row.count ?? 0);
      if (!kind || !Number.isFinite(count) || count <= 0) return null;
      return { kind, count: Math.trunc(count) };
    })
    .filter((item): item is MistakeImageRedaction => Boolean(item));
}

function fileType(fileName: string) {
  const ext = extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'docx';
  if (['.ppt', '.pptx'].includes(ext)) return 'pptx';
  if (['.xls', '.xlsx'].includes(ext)) return 'xlsx';
  if (['.txt', '.md'].includes(ext)) return 'txt';
  return 'other';
}

function canParseAsLocalText(fileName: string) {
  return ['.txt', '.md'].includes(extname(fileName).toLowerCase());
}

function titleFromFileName(fileName: string) {
  return basename(fileName, extname(fileName)).replace(/[_-]+/g, ' ').trim() || fileName;
}

function splitIntoChunks(content: string, maxLength = 1200) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks: Array<{ heading: string; content: string }> = [];
  const sections = normalized.split(/\n(?=#{1,6}\s+)/g);
  for (const section of sections) {
    const heading = section.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() ?? '';
    let remaining = section.trim();
    while (remaining.length > maxLength) {
      chunks.push({ heading, content: remaining.slice(0, maxLength).trim() });
      remaining = remaining.slice(maxLength).trim();
    }
    if (remaining) chunks.push({ heading, content: remaining });
  }
  return chunks.slice(0, 80);
}

function formatDate(date: string) {
  return date.slice(0, 10);
}

function requireNonEmpty(value: string | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function normalizeLimit(value: number | undefined, defaultValue = DEFAULT_RECORD_PAGE_SIZE) {
  if (!Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(Math.trunc(value as number), MAX_RECORD_PAGE_SIZE));
}

function normalizeOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

function hasColumn(rows: Row[], columnName: string) {
  return rows.some((row) => String(row.name) === columnName);
}

function maskApiKey(apiKey?: string) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function documentMimeType(type: DocumentArtifactType) {
  if (type === 'pdf') return 'application/pdf';
  if (type === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'text/markdown';
}

function documentExtension(type: DocumentArtifactType) {
  if (type === 'pdf') return '.pdf';
  if (type === 'docx') return '.docx';
  return '.md';
}

function normalizeDocumentArtifactType(type: string): DocumentArtifactType {
  if (type === 'markdown' || type === 'pdf' || type === 'docx') return type;
  throw new Error('不支持的文档产物类型');
}

function sanitizeDocumentFileName(fileName: string, type: DocumentArtifactType) {
  const extension = documentExtension(type);
  const rawBase = basename(fileName || `xiazhi-artifact${extension}`, extname(fileName || ''));
  const safeBase = rawBase
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    || 'xiazhi-artifact';
  return `${safeBase}${extension}`;
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function createPdfBuffer(title: string, markdown: string) {
  const lines = [`${title}`, ...markdownToPlainText(markdown).split('\n')]
    .flatMap((line) => line.match(/.{1,86}/g) ?? [''])
    .slice(0, 42);
  const commands = [
    'BT',
    '/F1 11 Tf',
    '50 790 Td',
    '14 TL',
    ...lines.map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands, 'utf8')} >>\nstream\n${commands}\nendstream`,
  ];
  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'utf8');
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function createZipBuffer(entries: { name: string; data: Buffer }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFiles, centralDirectory, end]);
}

function createDocxBuffer(title: string, markdown: string) {
  const paragraphs = [title, ...markdownToPlainText(markdown).split('\n')]
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
  return createZipBuffer([
    {
      name: '[Content_Types].xml',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`, 'utf8'),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`, 'utf8'),
    },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ]);
}

function createDocumentBuffer(type: DocumentArtifactType, title: string, contentMd: string) {
  if (type === 'markdown') return Buffer.from(contentMd, 'utf8');
  if (type === 'pdf') return createPdfBuffer(title, contentMd);
  return createDocxBuffer(title, contentMd);
}

function emptyTelemetrySnapshot(): AiTelemetrySnapshot {
  return {
    generatedAt: '',
    window: {},
    runCount: 0,
    statusCounts: {},
    routeCounts: {},
    modelCounts: {},
    eventCount: 0,
    eventPhaseCounts: {},
    toolEventCount: 0,
    toolUsageCounts: {},
    artifactCounts: {},
    confirmationCounts: {},
    latency: { count: 0, averageMs: 0, p50Ms: 0, p95Ms: 0 },
    tokenBudget: { promptTokens: 0, completionTokens: 0, totalTokens: 0, knownTaskCount: 0 },
    contextBudget: { sourceCount: 0, knowledgeSnippetCount: 0, graphNodeCount: 0, taskCount: 0 },
  };
}

function parseTelemetrySnapshot(value: unknown): AiTelemetrySnapshot {
  const parsed = jsonObject(value);
  const latency = parsed.latency && typeof parsed.latency === 'object' && !Array.isArray(parsed.latency)
    ? parsed.latency as Record<string, unknown>
    : {};
  const tokenBudget = parsed.tokenBudget && typeof parsed.tokenBudget === 'object' && !Array.isArray(parsed.tokenBudget)
    ? parsed.tokenBudget as Record<string, unknown>
    : {};
  const contextBudget = parsed.contextBudget && typeof parsed.contextBudget === 'object' && !Array.isArray(parsed.contextBudget)
    ? parsed.contextBudget as Record<string, unknown>
    : {};
  const windowValue = parsed.window && typeof parsed.window === 'object' && !Array.isArray(parsed.window)
    ? parsed.window as Record<string, unknown>
    : {};
  const counts = (raw: unknown) => raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, toNumber(value)]))
    : {};
  return {
    generatedAt: String(parsed.generatedAt ?? ''),
    window: {
      since: windowValue.since ? String(windowValue.since) : undefined,
      until: windowValue.until ? String(windowValue.until) : undefined,
    },
    runCount: toNumber(parsed.runCount),
    statusCounts: counts(parsed.statusCounts),
    routeCounts: counts(parsed.routeCounts),
    modelCounts: counts(parsed.modelCounts),
    eventCount: toNumber(parsed.eventCount),
    eventPhaseCounts: counts(parsed.eventPhaseCounts),
    toolEventCount: toNumber(parsed.toolEventCount),
    toolUsageCounts: counts(parsed.toolUsageCounts),
    artifactCounts: counts(parsed.artifactCounts),
    confirmationCounts: counts(parsed.confirmationCounts),
    latency: {
      count: toNumber(latency.count),
      averageMs: toNumber(latency.averageMs),
      p50Ms: toNumber(latency.p50Ms),
      p95Ms: toNumber(latency.p95Ms),
    },
    tokenBudget: {
      promptTokens: toNumber(tokenBudget.promptTokens),
      completionTokens: toNumber(tokenBudget.completionTokens),
      totalTokens: toNumber(tokenBudget.totalTokens),
      knownTaskCount: toNumber(tokenBudget.knownTaskCount),
    },
    contextBudget: {
      sourceCount: toNumber(contextBudget.sourceCount),
      knowledgeSnippetCount: toNumber(contextBudget.knowledgeSnippetCount),
      graphNodeCount: toNumber(contextBudget.graphNodeCount),
      taskCount: toNumber(contextBudget.taskCount),
    },
  };
}

function parseRegressionGates(value: unknown): AiRegressionGate[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const gate = item as Record<string, unknown>;
        const status = String(gate.status ?? 'warning');
        return {
          id: String(gate.id ?? ''),
          label: String(gate.label ?? ''),
          status: (status === 'passed' || status === 'failed' || status === 'warning') ? status : 'warning',
          detail: String(gate.detail ?? ''),
          evidence: gate.evidence && typeof gate.evidence === 'object' && !Array.isArray(gate.evidence)
            ? gate.evidence as Record<string, unknown>
            : {},
        };
      });
  } catch {
    return [];
  }
}

export class OmniEduStore {
  private db!: sqlite3.Database;
  private dbPath: string;

  constructor(private dataRoot: string) {
    this.dbPath = join(dataRoot, 'app.db');
  }

  async init(): Promise<BootstrapData> {
    mkdirSync(this.dataRoot, { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('students'), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('teacher_resources'), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('cache', 'thumbnails'), { recursive: true });

    if (!this.db) {
      this.db = await this.openDatabase(this.dbPath);
    }
    await this.migrate();
    await this.seedIfEmpty();
    return {
      dataRoot: this.dataRoot,
      students: await this.listStudents(''),
      overview: await this.getPlatformOverview(),
    };
  }

  getDataRoot() {
    return this.dataRoot;
  }

  async close() {
    if (!this.db) return;
    const db = this.db;
    await new Promise<void>((resolveClose, reject) => {
      db.close((error) => {
        if (error) reject(error);
        else resolveClose();
      });
    });
    this.db = undefined as unknown as sqlite3.Database;
  }

  async isManagedLocalPath(filePath: string) {
    return isInsideRoot(this.dataRoot, filePath);
  }

  getStudentFolder(studentId: string) {
    return this.studentRoot(studentId);
  }

  async getPlatformOverview(): Promise<PlatformOverview> {
    const [
      tagCount,
      reportTemplateCount,
      pendingSyncOperations,
      pendingAiTasks,
      teacherCount,
      assignmentCount,
      activeStudents,
      totalRecords,
      totalReports,
      totalAttachments,
    ] = await Promise.all([
      this.scalarCount('tag_dictionary'),
      this.scalarCount('report_templates'),
      this.scalarCount('sync_operations', `sync_status != 'succeeded'`),
      this.scalarCount('ai_tasks', `status IN ('pending', 'running', 'retrying')`),
      this.scalarCount('users'),
      this.scalarCount('teacher_student_assignments'),
      this.scalarCount('students', `status = 'active'`),
      this.scalarCount('learning_records'),
      this.scalarCount('review_reports'),
      this.scalarCount('attachments'),
    ]);

    return {
      tagCount,
      reportTemplateCount,
      pendingSyncOperations,
      pendingAiTasks,
      teacherCount,
      assignmentCount,
      analytics: {
        activeStudents,
        totalRecords,
        totalReports,
        totalAttachments,
      },
    };
  }

  async getDeepSeekSettings(): Promise<DeepSeekSettings> {
    const runtime = await this.getDeepSeekRuntimeSettings();
    return {
      configured: Boolean(runtime.apiKey),
      model: runtime.model,
      maskedApiKey: maskApiKey(runtime.apiKey),
      updatedAt: runtime.updatedAt,
    };
  }

  async getDeepSeekRuntimeSettings(): Promise<{ apiKey?: string; model: string; updatedAt: string }> {
    const row = (await this.all(`SELECT value_json, updated_at FROM app_settings WHERE key = 'deepseek'`))[0];
    if (!row) {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: '',
      };
    }
    try {
      const parsed = JSON.parse(String(row.value_json));
      return {
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : process.env.DEEPSEEK_API_KEY,
        model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? ''),
      };
    } catch {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? ''),
      };
    }
  }

  async saveDeepSeekSettings(input: DeepSeekSettingsInput): Promise<DeepSeekSettings> {
    const existing = await this.getDeepSeekRuntimeSettings();
    const apiKey = input.apiKey?.trim() || existing.apiKey || '';
    const model = input.model?.trim() || existing.model || DEFAULT_DEEPSEEK_MODEL;
    const timestamp = now();
    await this.run(
      `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at)
       VALUES ('deepseek', ?, ?)`,
      [JSON.stringify({ apiKey, model }), timestamp],
    );
    return this.getDeepSeekSettings();
  }

  async listStudents(query = ''): Promise<Student[]> {
    const like = `%${query.trim()}%`;
    const rows = await this.all(
      `SELECT s.*,
              COUNT(DISTINCT r.id) AS record_count,
              COALESCE(SUM(DISTINCT a.file_size), 0) AS attachment_bytes
         FROM students s
         LEFT JOIN learning_records r ON r.student_id = s.id
         LEFT JOIN attachments a ON a.student_id = s.id
        WHERE (? = '%%'
           OR s.display_name LIKE ?
           OR s.real_name LIKE ?
           OR s.grade LIKE ?
           OR s.tags LIKE ?)
        GROUP BY s.id
        ORDER BY s.status ASC, s.updated_at DESC`,
      [like, like, like, like, like],
    );
    return rows.map(this.mapStudent);
  }

  async createStudent(input: StudentInput): Promise<Student[]> {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    const id = `student_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO students (
        id, display_name, real_name, grade, school, subjects, goals,
        current_issues, parent_concerns, teacher_notes, tags, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        id,
        displayName,
        input.realName ?? '',
        input.grade ?? '',
        input.school ?? '',
        JSON.stringify(input.subjects ?? []),
        input.goals ?? '',
        input.currentIssues ?? '',
        input.parentConcerns ?? '',
        input.teacherNotes ?? '',
        JSON.stringify(input.tags ?? []),
        timestamp,
        timestamp,
      ],
    );
    mkdirSync(this.studentRoot(id), { recursive: true });
    return this.listStudents('');
  }

  async updateStudent(id: string, input: StudentInput): Promise<Student[]> {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    await this.run(
      `UPDATE students
          SET display_name = ?, real_name = ?, grade = ?, school = ?, subjects = ?,
              goals = ?, current_issues = ?, parent_concerns = ?, teacher_notes = ?,
              tags = ?, updated_at = ?
        WHERE id = ?`,
      [
        displayName,
        input.realName ?? '',
        input.grade ?? '',
        input.school ?? '',
        JSON.stringify(input.subjects ?? []),
        input.goals ?? '',
        input.currentIssues ?? '',
        input.parentConcerns ?? '',
        input.teacherNotes ?? '',
        JSON.stringify(input.tags ?? []),
        now(),
        id,
      ],
    );
    return this.listStudents('');
  }

  async archiveStudent(id: string): Promise<Student[]> {
    await this.run(`UPDATE students SET status = 'archived', updated_at = ? WHERE id = ?`, [now(), id]);
    return this.listStudents('');
  }

  async listRecords(studentId: string, filters: LearningRecordFilters = {}): Promise<LearningRecord[]> {
    const params: SqlValue[] = [studentId];
    let where = 'WHERE student_id = ?';
    if (filters.type) {
      where += ' AND record_type = ?';
      params.push(filters.type);
    }
    if (filters.subject?.trim()) {
      where += ' AND subject = ?';
      params.push(filters.subject.trim());
    }
    if (filters.tag?.trim()) {
      where += ' AND tags LIKE ?';
      params.push(`%${filters.tag.trim()}%`);
    }
    if (filters.startDate) {
      where += ' AND occurred_at >= ?';
      params.push(new Date(`${filters.startDate}T00:00:00`).toISOString());
    }
    if (filters.endDate) {
      where += ' AND occurred_at <= ?';
      params.push(new Date(`${filters.endDate}T23:59:59`).toISOString());
    }
    const keyword = filters.keyword?.trim();
    if (keyword) {
      const ftsIds = await this.searchRecordIdsByFts(keyword, studentId);
      if (ftsIds) {
        if (!ftsIds.length) return [];
        where += ` AND id IN (${ftsIds.map(() => '?').join(',')})`;
        params.push(...ftsIds);
      } else {
        where += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
        const like = `%${keyword}%`;
        params.push(like, like, like);
      }
    }
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);
    const records = (await this.all(
      `SELECT * FROM learning_records ${where} ORDER BY occurred_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )).map((row) => this.mapRecord(row));
    return this.withAttachments(records);
  }

  async createRecord(input: LearningRecordInput): Promise<LearningRecord[]> {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const id = `record_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO learning_records (
        id, student_id, record_type, subject, title, content, summary, tags, occurred_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
      [
        id,
        input.studentId,
        input.recordType,
        input.subject ?? '',
        title,
        input.content ?? '',
        JSON.stringify(input.tags ?? []),
        input.occurredAt || timestamp,
        timestamp,
        timestamp,
      ],
    );
    await this.touchStudent(input.studentId);
    await this.upsertRecordFts(id);
    mkdirSync(this.resolveInsideDataRoot('students', input.studentId, 'records', id, 'attachments'), { recursive: true });
    return this.listRecords(input.studentId);
  }

  async updateRecord(recordId: string, input: LearningRecordUpdateInput): Promise<LearningRecord[]> {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const record = (await this.all(`SELECT student_id FROM learning_records WHERE id = ?`, [recordId]))[0];
    if (!record) throw new Error('学习记录不存在');
    const studentId = String(record.student_id);
    await this.run(
      `UPDATE learning_records
          SET record_type = ?, subject = ?, title = ?, content = ?, tags = ?, occurred_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.recordType,
        input.subject ?? '',
        title,
        input.content ?? '',
        JSON.stringify(input.tags ?? []),
        input.occurredAt || now(),
        now(),
        recordId,
      ],
    );
    await this.touchStudent(studentId);
    await this.upsertRecordFts(recordId);
    return this.listRecords(studentId);
  }

  async importAttachments(studentId: string, recordId: string, sourcePaths: string[]): Promise<AttachmentImportResult> {
    const attachmentRoot = this.resolveInsideDataRoot('students', studentId, 'records', recordId, 'attachments');
    mkdirSync(attachmentRoot, { recursive: true });
    const items: AttachmentImportItem[] = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error('不是可导入的文件');
        const id = `attachment_${randomUUID()}`;
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(attachmentRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        await this.run(
          `INSERT INTO attachments (
            id, student_id, record_id, file_name, file_path, file_type, file_size, content_hash, extracted_text, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
          [id, studentId, recordId, originalName, targetPath, fileType(originalName), stat.size, hash, now()],
        );
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : '附件复制失败',
        });
      }
    }
    await this.touchStudent(studentId);
    const failed = items.filter((item) => !item.ok).length;
    const status = failed === 0 ? 'succeeded' : failed === items.length ? 'failed' : 'partial';
    return { status, records: await this.listRecords(studentId), items };
  }

  async sanitizeProblemText(text: string, studentId?: string): Promise<SanitizedProblemText> {
    const redactions: MistakeImageRedaction[] = [];
    let sanitizedText = text;

    let result = redactPattern(sanitizedText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱]');
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, 'email', result.count);

    result = redactPattern(sanitizedText, /(?<!\d)1[3-9]\d{9}(?!\d)/g, '[手机号]');
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, 'phone', result.count);

    result = redactPattern(sanitizedText, /(?<![0-9A-Za-z])\d{17}[\dXx](?![0-9A-Za-z])/g, '[身份证号]');
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, 'id_card', result.count);

    if (studentId) {
      const student = (await this.listStudents('')).find((item) => item.id === studentId);
      const names = [...new Set([student?.displayName, student?.realName].filter((name): name is string => Boolean(name?.trim())))]
        .filter((name) => name.length >= 2);
      for (const name of names) {
        result = redactPattern(sanitizedText, new RegExp(escapeRegExp(name), 'g'), '[学生姓名]');
        sanitizedText = result.sanitizedText;
        pushRedaction(redactions, 'student_name', result.count);
      }
    }

    return {
      sanitizedText,
      redactions,
      containsSensitiveData: redactions.some((item) => item.count > 0),
    };
  }

  async createMistakeImageAnalysis(input: MistakeImageAnalysisInput): Promise<MistakeImageAnalysis> {
    const studentId = requireNonEmpty(input.studentId, '错题图片解析缺少学生 ID');
    const student = (await this.listStudents('')).find((item) => item.id === studentId);
    if (!student) throw new Error('学生不存在');

    const attachment = input.attachmentId
      ? (await this.all(`SELECT * FROM attachments WHERE id = ? AND student_id = ?`, [input.attachmentId, studentId]))[0]
      : undefined;
    if (input.attachmentId && !attachment) throw new Error('附件不存在或不属于该学生');
    const recordId = input.recordId ?? (attachment ? String(attachment.record_id ?? '') : '');
    const attachmentId = input.attachmentId ?? '';
    const localPath = input.localPath ?? (attachment ? String(attachment.file_path ?? '') : '');
    if (localPath && !(await this.isManagedLocalPath(localPath))) {
      throw new Error('错题图片路径必须位于本地数据目录内');
    }
    if (localPath) {
      const localType = fileType(localPath);
      if (localType !== 'image') throw new Error('错题图片解析只接受图片附件');
    }

    const extractedText = input.extractedText?.trim() ?? '';
    const sanitized = extractedText ? await this.sanitizeProblemText(extractedText, studentId) : {
      sanitizedText: '',
      redactions: [],
      containsSensitiveData: false,
    };
    const status: MistakeImageOcrStatus = extractedText ? 'sanitized' : 'needs_ocr';
    const timestamp = now();
    const analysis: MistakeImageAnalysis = {
      id: `mistake_image_${randomUUID()}`,
      studentId,
      recordId,
      attachmentId,
      localPath,
      ocrStatus: status,
      extractedText,
      sanitizedText: sanitized.sanitizedText,
      redactions: sanitized.redactions,
      teacherCorrectedText: '',
      errorMessage: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.run(
      `INSERT INTO mistake_image_analyses (
        id, student_id, record_id, attachment_id, local_path, ocr_status,
        extracted_text, sanitized_text, redactions_json, teacher_corrected_text,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`,
      [
        analysis.id,
        analysis.studentId,
        analysis.recordId || null,
        analysis.attachmentId || null,
        analysis.localPath,
        analysis.ocrStatus,
        analysis.extractedText,
        analysis.sanitizedText,
        JSON.stringify(analysis.redactions),
        analysis.createdAt,
        analysis.updatedAt,
      ],
    );
    if (attachmentId && extractedText) {
      await this.run(`UPDATE attachments SET extracted_text = ? WHERE id = ?`, [extractedText, attachmentId]);
    }
    await this.touchStudent(studentId);
    return analysis;
  }

  async updateMistakeImageCorrection(id: string, input: MistakeImageCorrectionInput): Promise<MistakeImageAnalysis> {
    const existing = await this.getMistakeImageAnalysisOrThrow(id);
    const correctedText = requireNonEmpty(input.extractedText, '老师修正文不能为空');
    const sanitized = await this.sanitizeProblemText(correctedText, existing.studentId);
    const timestamp = now();
    await this.run(
      `UPDATE mistake_image_analyses
          SET ocr_status = 'teacher_corrected',
              extracted_text = ?,
              sanitized_text = ?,
              redactions_json = ?,
              teacher_corrected_text = ?,
              error_message = '',
              updated_at = ?
        WHERE id = ?`,
      [correctedText, sanitized.sanitizedText, JSON.stringify(sanitized.redactions), correctedText, timestamp, id],
    );
    if (existing.attachmentId) {
      await this.run(`UPDATE attachments SET extracted_text = ? WHERE id = ?`, [correctedText, existing.attachmentId]);
    }
    await this.touchStudent(existing.studentId);
    return this.getMistakeImageAnalysisOrThrow(id);
  }

  async listMistakeImageAnalyses(studentId: string): Promise<MistakeImageAnalysis[]> {
    const rows = await this.all(
      `SELECT * FROM mistake_image_analyses WHERE student_id = ? ORDER BY updated_at DESC`,
      [studentId],
    );
    return rows.map((row) => this.mapMistakeImageAnalysis(row));
  }

  async getKnowledgeOverview(): Promise<KnowledgeOverview> {
    const resources = (await this.all(
      `SELECT r.*,
              COUNT(c.id) AS chunk_count
         FROM teacher_resources r
         LEFT JOIN resource_chunks c ON c.resource_id = r.id
        GROUP BY r.id
        ORDER BY r.updated_at DESC
        LIMIT 100`,
    )).map(this.mapTeacherResource);
    const chunks = (await this.all(
      `SELECT c.*, r.title AS resource_title
         FROM resource_chunks c
         JOIN teacher_resources r ON r.id = c.resource_id
        ORDER BY c.quality_score DESC, c.created_at DESC, c.chunk_index ASC
        LIMIT 24`,
    )).map(this.mapResourceChunk);
    const nodes = (await this.all(
      `SELECT * FROM knowledge_nodes ORDER BY confidence DESC, updated_at DESC LIMIT 80`,
    )).map(this.mapKnowledgeNode);
    const edges = (await this.all(
      `SELECT * FROM knowledge_edges ORDER BY confidence DESC, created_at DESC LIMIT 120`,
    )).map(this.mapKnowledgeEdge);
    const [resourceCount, parsedResources, chunkCount, nodeCount, edgeCount, queuedTasks] = await Promise.all([
      this.scalarCount('teacher_resources'),
      this.scalarCount('teacher_resources', `parse_status IN ('parsed', 'chunked', 'indexed', 'graph_extracted', 'ready')`),
      this.scalarCount('resource_chunks'),
      this.scalarCount('knowledge_nodes'),
      this.scalarCount('knowledge_edges'),
      this.scalarCount('ai_tasks', `task_type IN ('resource_parse', 'ocr_extract', 'embedding_build') AND status IN ('pending', 'running', 'retrying')`),
    ]);
    return {
      resources,
      chunks,
      nodes,
      edges,
      counts: {
        resources: resourceCount,
        parsedResources,
        chunks: chunkCount,
        nodes: nodeCount,
        edges: edgeCount,
        queuedTasks,
      },
    };
  }

  async importKnowledgeResources(sourcePaths: string[]): Promise<KnowledgeImportResult> {
    const resourceRoot = this.resolveInsideDataRoot('teacher_resources');
    mkdirSync(resourceRoot, { recursive: true });
    const items: AttachmentImportItem[] = [];
    const resources: KnowledgeImportResult['resources'] = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error('不是可导入的文件');
        const id = `resource_${randomUUID()}`;
        const timestamp = now();
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(resourceRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        const resourceType = fileType(originalName);
        const isText = canParseAsLocalText(originalName);
        const title = titleFromFileName(originalName);
        const parseStatus = isText ? 'ready' : 'needs_parser';
        const parseEngine = isText ? 'local-text' : 'Docling/MinerU 待接入';
        await this.run(
          `INSERT INTO teacher_resources (
            id, title, resource_type, original_file_name, local_path, file_size,
            content_hash, parse_status, parse_engine, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, title, resourceType, originalName, targetPath, stat.size, hash, parseStatus, parseEngine, timestamp, timestamp],
        );
        await this.ensureTeacherLibraryNode();
        await this.createResourceGraph(id, title, resourceType, stat.size, timestamp);
        if (isText) {
          const text = readFileSync(targetPath, 'utf8');
          await this.createResourceChunksAndGraph(id, title, text, timestamp);
        } else {
          await this.enqueueResourceParseTask(id, title, resourceType, timestamp);
        }
        const saved = (await this.all(
          `SELECT r.*, COUNT(c.id) AS chunk_count
             FROM teacher_resources r
             LEFT JOIN resource_chunks c ON c.resource_id = r.id
            WHERE r.id = ?
            GROUP BY r.id`,
          [id],
        ))[0];
        resources.push(this.mapTeacherResource(saved));
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : '知识资源导入失败',
        });
      }
    }
    const failed = items.filter((item) => !item.ok).length;
    const status = items.length === 0 ? 'canceled' : failed === 0 ? 'succeeded' : failed === items.length ? 'failed' : 'partial';
    return { status, resources, items, overview: await this.getKnowledgeOverview() };
  }

  async searchKnowledge(keyword: string, limit = 8): Promise<ResourceChunk[]> {
    const trimmed = keyword.trim();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
    if (!trimmed) {
      return (await this.all(
        `SELECT c.*, r.title AS resource_title
           FROM resource_chunks c
           JOIN teacher_resources r ON r.id = c.resource_id
          ORDER BY c.quality_score DESC, c.created_at DESC, c.chunk_index ASC
          LIMIT ?`,
        [boundedLimit],
      )).map(this.mapResourceChunk);
    }
    const tokens = searchTokens(trimmed);
    const clauses = tokens.length
      ? tokens.map(() => `(
          c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?
          OR c.subject LIKE ? OR c.grade LIKE ? OR c.knowledge_point LIKE ? OR c.question_type LIKE ?
        )`)
      : ['(c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?)'];
    const params: SqlValue[] = [];
    if (tokens.length) {
      for (const token of tokens) {
        const like = `%${token}%`;
        params.push(like, like, like, like, like, like, like);
      }
    } else {
      const like = `%${trimmed}%`;
      params.push(like, like, like);
    }
    return (await this.all(
      `SELECT c.*, r.title AS resource_title
         FROM resource_chunks c
         JOIN teacher_resources r ON r.id = c.resource_id
        WHERE ${clauses.join(' OR ')}
        ORDER BY
          CASE WHEN c.contains_personal_data = 1 THEN 1 ELSE 0 END,
          c.quality_score DESC,
          c.created_at DESC,
          c.chunk_index ASC
        LIMIT ?`,
      [...params, boundedLimit],
    )).map(this.mapResourceChunk);
  }

  async recordAiConsoleRun(input: { prompt: string; studentId?: string; timeRange?: string; knowledgeScope?: string }, result: AiConsoleRunResult) {
    const timestamp = now();
    const taskId = `task_${randomUUID()}`;
    const inputHash = createHash('sha256').update(input.prompt.trim()).digest('hex');
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'ai_console', ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        taskId,
        result.ok ? 'succeeded' : 'failed',
        inputHash,
        JSON.stringify({
          studentId: input.studentId ?? '',
          timeRange: input.timeRange ?? '',
          knowledgeScope: input.knowledgeScope ?? '',
          model: result.model,
          sourceCount: result.sources.length,
          knowledgeSnippetCount: result.knowledgeSnippets?.length ?? 0,
          graphNodeCount: result.graphNodes?.length ?? 0,
        }),
        JSON.stringify({
          ok: result.ok,
          usage: result.usage ?? null,
          contentPreview: result.content.slice(0, 160),
        }),
        result.errorMessage ?? '',
        timestamp,
        timestamp,
      ],
    );
    for (const tool of result.toolRuns) {
      await this.run(
        `INSERT INTO ai_tool_runs (id, task_id, tool_name, input_json, output_summary, evidence_refs_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `toolrun_${randomUUID()}`,
          taskId,
          tool.name,
          JSON.stringify({ label: tool.label }),
          tool.detail,
          JSON.stringify({
            sources: result.sources.map((source) => source.title).slice(0, 8),
            knowledgeChunkIds: (result.knowledgeSnippets ?? []).map((chunk) => chunk.id).slice(0, 8),
            graphNodeIds: (result.graphNodes ?? []).map((node) => node.id).slice(0, 8),
          }),
          tool.status,
          timestamp,
        ],
      );
    }
  }

  async startAiAgentRun(input: {
    sessionId?: string;
    prompt: string;
    route: string;
    subIntent?: string;
    model?: string;
    studentId?: string;
  }) {
    const timestamp = now();
    const runId = `run_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_agent_runs (id, session_id, prompt, route, sub_intent, status, model, student_id, error_message, created_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?, '', ?, NULL, ?)`,
      [
        runId,
        input.sessionId ?? '',
        input.prompt,
        input.route,
        input.subIntent ?? '',
        input.model ?? '',
        input.studentId ?? '',
        timestamp,
        timestamp,
      ],
    );
    return runId;
  }

  async recordAiAgentEvent(runId: string, event: AiAgentTraceStep) {
    const timestamp = now();
    const sequenceRow = (await this.all(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM ai_agent_events WHERE run_id = ?`,
      [runId],
    ))[0];
    const sequence = Number(sequenceRow?.next_sequence ?? 1);
    await this.run(
      `INSERT INTO ai_agent_events (id, run_id, sequence, phase, status, label, detail, tool_name, input_summary_json, output_summary_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `event_${randomUUID()}`,
        runId,
        sequence,
        event.phase,
        event.status,
        event.label,
        event.detail,
        event.toolName ?? '',
        JSON.stringify(event.inputSummary ?? {}),
        JSON.stringify(event.outputSummary ?? {}),
        timestamp,
      ],
    );
  }

  async completeAiAgentRun(runId: string, status: AiAgentRunStatus, errorMessage = '') {
    const timestamp = now();
    await this.run(
      `UPDATE ai_agent_runs
       SET status = ?, error_message = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, errorMessage, timestamp, timestamp, runId],
    );
  }

  async getAiAgentRun(runId: string): Promise<AiAgentRun | null> {
    const row = (await this.all(`SELECT * FROM ai_agent_runs WHERE id = ?`, [runId]))[0];
    if (!row) return null;
    return this.mapAiAgentRun(row);
  }

  async listAiAgentEvents(runId: string): Promise<AiAgentEvent[]> {
    const rows = await this.all(
      `SELECT * FROM ai_agent_events WHERE run_id = ? ORDER BY sequence ASC`,
      [runId],
    );
    return rows.map((row) => this.mapAiAgentEvent(row));
  }

  async createAiConfirmation(input: AiConfirmationCreateInput): Promise<AiConfirmationItem> {
    if (input.actionType !== 'create_review_report' && input.actionType !== 'save_exercise_set') {
      throw new Error('当前确认队列只支持创建复盘报告或保存三元题组');
    }
    const payload = parseAiConfirmationPayload(JSON.stringify(input.payload));
    const studentId = input.studentId || payload.studentId;
    requireNonEmpty(studentId, '确认项缺少学生 ID');
    requireNonEmpty(input.title, '确认项标题不能为空');
    requireNonEmpty(input.previewMd, '确认项预览不能为空');
    if (input.actionType === 'create_review_report') {
      requireNonEmpty(payload.contentMd, '确认项报告正文不能为空');
      requireNonEmpty(payload.startDate, '确认项缺少开始日期');
      requireNonEmpty(payload.endDate, '确认项缺少结束日期');
    } else {
      requireNonEmpty(payload.exerciseSet?.contentMd || payload.contentMd, '确认项题组正文不能为空');
    }

    const timestamp = now();
    const item: AiConfirmationItem = {
      id: `confirm_${randomUUID()}`,
      runId: input.runId ?? '',
      sessionId: input.sessionId ?? '',
      studentId,
      actionType: input.actionType,
      status: 'pending',
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      previewMd: input.previewMd,
      payload: { ...payload, studentId },
      result: {},
      errorMessage: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedAt: '',
      rejectedAt: '',
    };

    await this.run(
      `INSERT INTO ai_confirmation_items (
        id, run_id, session_id, student_id, action_type, status, title, description,
        preview_md, payload_json, result_json, error_message, created_at, updated_at, confirmed_at, rejected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        item.id,
        item.runId,
        item.sessionId,
        item.studentId,
        item.actionType,
        item.status,
        item.title,
        item.description,
        item.previewMd,
        JSON.stringify(item.payload),
        JSON.stringify(item.result),
        item.errorMessage,
        item.createdAt,
        item.updatedAt,
      ],
    );
    return item;
  }

  async listAiConfirmations(status: AiConfirmationStatus | 'all' = 'pending'): Promise<AiConfirmationItem[]> {
    const allowedStatuses = new Set(['pending', 'confirmed', 'rejected', 'failed']);
    const rows = status === 'all'
      ? await this.all(`SELECT * FROM ai_confirmation_items ORDER BY updated_at DESC`)
      : await this.all(
        `SELECT * FROM ai_confirmation_items WHERE status = ? ORDER BY updated_at DESC`,
        [allowedStatuses.has(status) ? status : 'pending'],
      );
    return rows.map((row) => this.mapAiConfirmationItem(row));
  }

  async rejectAiConfirmation(id: string): Promise<AiConfirmationDecisionResult> {
    const existing = await this.getAiConfirmationOrThrow(id);
    if (existing.status !== 'pending') throw new Error('只能拒绝待确认项');
    const timestamp = now();
    await this.run(
      `UPDATE ai_confirmation_items
          SET status = 'rejected', updated_at = ?, rejected_at = ?, error_message = ''
        WHERE id = ?`,
      [timestamp, timestamp, id],
    );
    return { item: await this.getAiConfirmationOrThrow(id) };
  }

  async confirmAiConfirmation(id: string): Promise<AiConfirmationDecisionResult> {
    const existing = await this.getAiConfirmationOrThrow(id);
    if (existing.status !== 'pending') throw new Error('只能确认待确认项');
    const timestamp = now();
    try {
      const readback = await this.executeAiConfirmation(existing);
      if (existing.actionType === 'create_review_report' && !readback?.report) throw new Error('确认后未能读回复盘报告');
      if (existing.actionType === 'save_exercise_set' && !readback?.exerciseSet) throw new Error('确认后未能读回三元题组');
      const result = {
        reportId: readback?.report?.id,
        exerciseSetId: readback?.exerciseSet?.id,
        actionType: existing.actionType,
      };
      await this.run(
        `UPDATE ai_confirmation_items
            SET status = 'confirmed', result_json = ?, error_message = '', updated_at = ?, confirmed_at = ?
          WHERE id = ?`,
        [JSON.stringify(result), timestamp, timestamp, id],
      );
      return { item: await this.getAiConfirmationOrThrow(id), readback };
    } catch (error) {
      const message = error instanceof Error ? error.message : '确认项执行失败';
      await this.run(
        `UPDATE ai_confirmation_items
            SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ?`,
        [message, timestamp, id],
      );
      throw error;
    }
  }

  async generateReview(input: ReviewDraftInput): Promise<ReviewReport> {
    const records = (await this.listRecords(input.studentId, { limit: MAX_RECORD_PAGE_SIZE })).filter((record) => {
      const day = formatDate(record.occurredAt);
      const subjectMatch = !input.subject || input.subject === '全部' || record.subject === input.subject;
      return subjectMatch && day >= input.startDate && day <= input.endDate;
    });
    const student = (await this.listStudents('')).find((item) => item.id === input.studentId);
    if (!student) throw new Error('学生不存在');

    const typeCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const record of records) {
      typeCounts.set(record.recordType, (typeCounts.get(record.recordType) ?? 0) + 1);
      for (const tag of record.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recentEvidence = records.slice(0, 5);
    const title = `${student.displayName}${input.subject ? ` ${input.subject}` : ''}阶段复盘`;
    const parentSummary = records.length
      ? `本阶段围绕${input.subject || '主要科目'}共记录 ${records.length} 条学习证据，后续建议继续关注${topTags[0]?.[0] ?? '核心薄弱点'}，并用每周记录观察改善情况。`
      : '当前时间范围内学习记录不足，建议先补充课堂、作业或沟通证据后再形成家长沟通摘要。';
    const contentMd = [
      `# ${title}`,
      '',
      `复盘范围：${input.startDate} 至 ${input.endDate}`,
      '',
      '## 一、整体表现',
      records.length
        ? `本阶段共沉淀 ${records.length} 条学习记录。主要记录类型为：${[...typeCounts.entries()].map(([type, count]) => `${type} ${count} 条`).join('，')}。`
        : '当前时间范围内还没有学习记录，建议先补充课堂、作业或沟通证据。',
      '',
      '## 二、主要进步',
      '- 请老师结合最近记录补充学生已经改善的具体表现。',
      '- 可优先引用课堂表现、作业订正质量和沟通反馈。',
      '',
      '## 三、高频薄弱点',
      ...(topTags.length ? topTags.map(([tag, count]) => `- ${tag}：在 ${count} 条证据中出现。`) : ['- 暂无高频标签，请在学习记录中补充标签。']),
      '',
      '## 四、典型证据',
      ...(recentEvidence.length
        ? recentEvidence.map((record) => `- ${formatDate(record.occurredAt)}｜${record.subject || '全部'}｜${record.title}：${record.content || '无正文'}`)
        : ['- 暂无可引用证据。']),
      '',
      '## 五、学习习惯观察',
      student.currentIssues || '请老师根据长期观察补充学习习惯、订正习惯和注意力状态。',
      '',
      '## 六、下阶段建议',
      '1. 选择 1-2 个最高频问题做短周期专项训练。',
      '2. 每次记录保留错因一句话，便于下次复盘追踪。',
      '3. 一周后回看时间线，确认问题是否减少而不是只看单次表现。',
      '',
      '## 七、家长沟通版摘要',
      parentSummary,
    ].join('\n');
    const qualityChecks = this.buildReportQualityChecks(records, contentMd, parentSummary);

    const timestamp = now();
    const report: ReviewReport = {
      id: `report_${randomUUID()}`,
      studentId: input.studentId,
      subject: input.subject ?? '',
      startDate: input.startDate,
      endDate: input.endDate,
      reportType: input.reportType,
      title,
      contentMd,
      parentSummary,
      qualityChecks,
      sourceRecordIds: records.map((record) => record.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.run(
      `INSERT INTO review_reports (
        id, student_id, subject, start_date, end_date, report_type, title, content_md,
        parent_summary, quality_checks_json, source_record_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id,
        report.studentId,
        report.subject,
        report.startDate,
        report.endDate,
        report.reportType,
        report.title,
        report.contentMd,
        report.parentSummary,
        JSON.stringify(report.qualityChecks),
        JSON.stringify(report.sourceRecordIds),
        report.createdAt,
        report.updatedAt,
      ],
    );
    const reportRoot = this.resolveInsideDataRoot('students', input.studentId, 'reports');
    mkdirSync(reportRoot, { recursive: true });
    writeFileSync(resolveInsideRoot(reportRoot, `${report.id}.md`), contentMd, 'utf8');
    await this.touchStudent(input.studentId);
    return report;
  }

  async updateReport(id: string, contentMd: string, parentSummary?: string): Promise<ReviewReport> {
    const existing = (await this.all(`SELECT parent_summary, source_record_ids FROM review_reports WHERE id = ?`, [id]))[0];
    if (!existing) throw new Error('复盘报告不存在');
    const nextParentSummary = parentSummary ?? String(existing.parent_summary ?? '');
    const sourceRecordIds = jsonArray(existing.source_record_ids);
    const qualityChecks = this.buildReportQualityChecks(
      sourceRecordIds.map((recordId) => ({ id: recordId }) as LearningRecord),
      contentMd,
      nextParentSummary,
    );
    await this.run(
      `UPDATE review_reports
          SET content_md = ?, parent_summary = ?, quality_checks_json = ?, updated_at = ?
        WHERE id = ?`,
      [contentMd, nextParentSummary, JSON.stringify(qualityChecks), now(), id],
    );
    const report = (await this.all(`SELECT * FROM review_reports WHERE id = ?`, [id]))[0];
    return this.mapReport(report);
  }

  async listReports(studentId: string): Promise<ReviewReport[]> {
    return (await this.all(`SELECT * FROM review_reports WHERE student_id = ? ORDER BY created_at DESC`, [studentId])).map((row) => this.mapReport(row));
  }

  async createQuestionBankItem(input: QuestionBankItemInput): Promise<QuestionBankItem> {
    const stem = requireNonEmpty(input.stem, '题干不能为空');
    const difficulty = input.difficulty === 'easy' || input.difficulty === 'hard' ? input.difficulty : 'medium';
    const sourceKind = input.sourceKind === 'teacher_resource' || input.sourceKind === 'generated' ? input.sourceKind : 'local_bank';
    const timestamp = now();
    const item: QuestionBankItem = {
      id: `question_${randomUUID()}`,
      subject: input.subject?.trim() ?? '',
      grade: input.grade?.trim() ?? '',
      knowledgePoint: input.knowledgePoint?.trim() ?? '',
      questionType: input.questionType?.trim() ?? '',
      difficulty,
      stem,
      answer: input.answer?.trim() ?? '',
      analysis: input.analysis?.trim() ?? '',
      sourceTitle: input.sourceTitle?.trim() ?? '本地题库',
      sourceKind,
      tags: input.tags ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.run(
      `INSERT INTO question_bank_items (
        id, subject, grade, knowledge_point, question_type, difficulty, stem,
        answer, analysis, source_title, source_kind, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.subject,
        item.grade,
        item.knowledgePoint,
        item.questionType,
        item.difficulty,
        item.stem,
        item.answer,
        item.analysis,
        item.sourceTitle,
        item.sourceKind,
        JSON.stringify(item.tags),
        item.createdAt,
        item.updatedAt,
      ],
    );
    return item;
  }

  async searchQuestionBank(filters: QuestionSearchFilters = {}) {
    const clauses: string[] = [];
    const params: SqlValue[] = [];
    const subject = filters.subject?.trim();
    const knowledgePoint = filters.knowledgePoint?.trim();
    const questionType = filters.questionType?.trim();
    const difficulty = filters.difficulty;
    const query = filters.query?.trim();
    if (subject) {
      clauses.push('subject = ?');
      params.push(subject);
    }
    if (knowledgePoint) {
      clauses.push('knowledge_point LIKE ?');
      params.push(`%${knowledgePoint}%`);
    }
    if (questionType) {
      clauses.push('question_type = ?');
      params.push(questionType);
    }
    if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
      clauses.push('difficulty = ?');
      params.push(difficulty);
    }
    const tokens = searchTokens(query);
    if (tokens.length) {
      clauses.push(`(${tokens.map(() => '(stem LIKE ? OR analysis LIKE ? OR tags LIKE ? OR knowledge_point LIKE ?)').join(' OR ')})`);
      for (const token of tokens) {
        const like = `%${token}%`;
        params.push(like, like, like, like);
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.max(1, Math.min(Math.trunc(filters.limit ?? 8), 20));
    const rows = await this.all(
      `SELECT * FROM question_bank_items
       ${where}
       ORDER BY
         CASE WHEN knowledge_point = ? THEN 0 ELSE 1 END,
         updated_at DESC
       LIMIT ?`,
      [...params, knowledgePoint ?? '', limit],
    );
    const queryTokens = [...new Set([...searchTokens(query), ...searchTokens(knowledgePoint)])];
    return rows.map((row) => {
      const item = this.mapQuestionBankItem(row);
      const matchedToken = queryTokens.find((token) =>
        [item.stem, item.analysis, item.knowledgePoint, item.tags.join('、')].some((text) => text.includes(token)),
      );
      return {
        ...item,
        matchReason: matchedToken ? `命中关键词：${matchedToken}` : item.knowledgePoint ? `按知识点 ${item.knowledgePoint} 排序命中` : '按更新时间命中',
        score: matchedToken ? 0.9 : 0.6,
      };
    });
  }

  async saveExerciseSetFromDraft(studentId: string, draft: ExerciseSetDraftPayload): Promise<ExerciseSet> {
    requireNonEmpty(studentId, '题组缺少学生 ID');
    const title = requireNonEmpty(draft.title || '小智三元题组', '题组标题不能为空');
    const contentMd = requireNonEmpty(draft.contentMd, '题组正文不能为空');
    const timestamp = now();
    const items = parseExerciseSetItems(draft.items ?? []);
    const sourceQuestionIds = (draft.sourceQuestionIds ?? items.map((item) => item.questionId ?? '')).filter(Boolean);
    const exerciseSet: ExerciseSet = {
      id: `exercise_set_${randomUUID()}`,
      studentId,
      title,
      subject: draft.subject?.trim() ?? '',
      knowledgePoint: draft.knowledgePoint?.trim() ?? '',
      contentMd,
      items,
      sourceQuestionIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.run(
      `INSERT INTO exercise_sets (
        id, student_id, title, subject, knowledge_point, content_md,
        items_json, source_question_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseSet.id,
        exerciseSet.studentId,
        exerciseSet.title,
        exerciseSet.subject,
        exerciseSet.knowledgePoint,
        exerciseSet.contentMd,
        JSON.stringify(exerciseSet.items),
        JSON.stringify(exerciseSet.sourceQuestionIds),
        exerciseSet.createdAt,
        exerciseSet.updatedAt,
      ],
    );
    await this.touchStudent(studentId);
    return exerciseSet;
  }

  async listExerciseSets(studentId: string): Promise<ExerciseSet[]> {
    const rows = await this.all(`SELECT * FROM exercise_sets WHERE student_id = ? ORDER BY created_at DESC`, [studentId]);
    return rows.map((row) => this.mapExerciseSet(row));
  }

  async search(keyword: string): Promise<SearchResult> {
    const trimmedKeyword = keyword.trim();
    const ftsRecords = trimmedKeyword ? await this.searchRecordsByFts(trimmedKeyword) : null;
    const records = ftsRecords ?? await this.withAttachments((await this.all(
      `SELECT * FROM learning_records
        WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
        ORDER BY occurred_at DESC
        LIMIT 50`,
      [`%${trimmedKeyword}%`, `%${trimmedKeyword}%`, `%${trimmedKeyword}%`],
    )).map((row) => this.mapRecord(row)));
    return {
      students: await this.listStudents(keyword),
      records,
    };
  }

  async listAiConversationWorkspace(): Promise<AiConversationWorkspace> {
    const folders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NULL
        ORDER BY sort_order ASC, created_at ASC`,
    )).map(this.mapAiConversationFolder);
    const sessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC`,
    )).map(this.mapAiConversationSession);
    const archivedFolders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`,
    )).map(this.mapAiConversationFolder);
    const archivedSessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`,
    )).map(this.mapAiConversationSession);
    return { folders, sessions, archivedFolders, archivedSessions };
  }

  async createAiConversationFolder(input: AiConversationFolderInput): Promise<AiConversationWorkspace> {
    const name = requireNonEmpty(input.name, '文件夹名称不能为空');
    const timestamp = now();
    const sortRow = (await this.all(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM ai_conversation_folders`))[0];
    await this.run(
      `INSERT INTO ai_conversation_folders (id, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`aifolder_${randomUUID()}`, name, Number(sortRow?.next_order ?? 1), timestamp, timestamp],
    );
    return this.listAiConversationWorkspace();
  }

  async createAiConversationSession(input: AiConversationSessionInput): Promise<AiConversationDetail> {
    const title = (input.title?.trim() || '新对话').slice(0, 80);
    const folderId = input.folderId || null;
    if (folderId) await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    const sessionId = `aisession_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_conversation_sessions (
        id, folder_id, title, student_id, last_prompt, last_response_preview,
        message_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '', '', 0, ?, ?)`,
      [sessionId, folderId, title, input.studentId ?? '', timestamp, timestamp],
    );
    return this.getAiConversationSession(sessionId);
  }

  async getAiConversationSession(sessionId: string): Promise<AiConversationDetail> {
    const row = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!row) throw new Error('AI 对话不存在');
    const messages = (await this.all(
      `SELECT * FROM ai_conversation_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId],
    )).map(this.mapAiConversationMessage);
    return { session: this.mapAiConversationSession(row), messages };
  }

  async appendAiConversationMessage(sessionId: string, input: AiConversationMessageInput): Promise<AiConversationDetail> {
    const session = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!session) throw new Error('AI 对话不存在');
    const content = input.content.trim();
    if (!content) throw new Error('对话消息不能为空');
    const role = input.role === 'assistant' || input.role === 'system' ? input.role : 'user';
    const timestamp = now();
    await this.run(
      `INSERT INTO ai_conversation_messages (
        id, session_id, role, content, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [`aimsg_${randomUUID()}`, sessionId, role, content, JSON.stringify(input.metadata ?? {}), timestamp],
    );
    const messageCountRow = (await this.all(
      `SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id = ?`,
      [sessionId],
    ))[0];
    const messageCount = Number(messageCountRow?.count ?? 0);
    const nextTitle = String(session.title ?? '') === '新对话' && role === 'user'
      ? content.slice(0, 40)
      : String(session.title ?? '新对话');
    const lastPrompt = role === 'user' ? content.slice(0, 240) : String(session.last_prompt ?? '');
    const lastResponsePreview = role === 'assistant' ? content.slice(0, 240) : String(session.last_response_preview ?? '');
    await this.run(
      `UPDATE ai_conversation_sessions
          SET title = ?, last_prompt = ?, last_response_preview = ?, message_count = ?, updated_at = ?
        WHERE id = ?`,
      [nextTitle, lastPrompt, lastResponsePreview, messageCount, timestamp, sessionId],
    );
    return this.getAiConversationSession(sessionId);
  }

  async moveAiConversationSession(sessionId: string, folderId: string | null): Promise<AiConversationWorkspace> {
    if (folderId) await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_sessions SET folder_id = ?, updated_at = ? WHERE id = ?`,
      [folderId || null, now(), sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async renameAiConversationFolder(folderId: string, input: AiConversationFolderUpdateInput): Promise<AiConversationWorkspace> {
    const name = requireNonEmpty(input.name, '文件夹名称不能为空').slice(0, 80);
    await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_folders SET name = ?, updated_at = ? WHERE id = ?`,
      [name, now(), folderId],
    );
    return this.listAiConversationWorkspace();
  }

  async renameAiConversationSession(sessionId: string, input: AiConversationSessionUpdateInput): Promise<AiConversationWorkspace> {
    const title = requireNonEmpty(input.title, '对话名称不能为空').slice(0, 80);
    await this.run(
      `UPDATE ai_conversation_sessions SET title = ?, updated_at = ? WHERE id = ?`,
      [title, now(), sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async archiveAiConversationFolder(folderId: string): Promise<AiConversationWorkspace> {
    await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_folders SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, folderId],
    );
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE folder_id = ? AND archived_at IS NULL`,
      [timestamp, timestamp, folderId],
    );
    return this.listAiConversationWorkspace();
  }

  async archiveAiConversationSession(sessionId: string): Promise<AiConversationWorkspace> {
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async exportStudentArchive(studentId: string, destinationRoot: string): Promise<ExportStudentResult> {
    const student = (await this.listStudents('')).find((item) => item.id === studentId);
    if (!student) throw new Error('学生不存在');
    const safeName = student.displayName.replace(/[\\/:*?"<>|]/g, '_') || student.id;
    const exportPath = join(destinationRoot, `${safeName}-${student.id}`);
    mkdirSync(exportPath, { recursive: true });

    const metadata = {
      exportedAt: now(),
      student,
      records: await this.listRecords(studentId, { limit: MAX_RECORD_PAGE_SIZE }),
      reports: await this.listReports(studentId),
    };
    writeFileSync(join(exportPath, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    let fileCount = 1;
    const sourceStudentRoot = this.studentRoot(studentId);
    if (existsSync(sourceStudentRoot)) {
      fileCount += this.copyDirectory(sourceStudentRoot, join(exportPath, 'files'));
    }
    return { exportPath, fileCount };
  }

  async exportDataRoot(destinationRoot: string): Promise<ExportDataRootResult> {
    const exportPath = join(destinationRoot, `OmniEduData-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const fileCount = this.copyDirectory(this.dataRoot, exportPath);
    return { exportPath, fileCount };
  }

  async exportDocumentArtifact(input: DocumentArtifactExportInput): Promise<DocumentArtifactExportResult> {
    const type = normalizeDocumentArtifactType(input.type);
    const title = requireNonEmpty(input.title, '文档产物标题不能为空').slice(0, 120);
    const contentMd = requireNonEmpty(input.contentMd, '文档产物正文不能为空');
    const fileName = sanitizeDocumentFileName(input.fileName, type);
    const exportRoot = input.destinationRoot?.trim()
      ? input.destinationRoot.trim()
      : this.resolveInsideDataRoot('exports', 'ai-artifacts');
    mkdirSync(exportRoot, { recursive: true });
    const timestamp = now();
    const id = input.artifactId?.trim() || `artifact_${randomUUID()}`;
    const targetPrefix = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(-12) || String(Date.now());
    const filePath = join(exportRoot, `${targetPrefix}-${fileName}`);
    const mimeType = documentMimeType(type);
    const description = input.description?.trim() ?? '';

    try {
      writeFileSync(filePath, createDocumentBuffer(type, title, contentMd));
      const fileStat = statSync(filePath);
      const contentHash = await hashFileSha256(filePath);
      await this.run(
        `INSERT OR REPLACE INTO document_artifacts (
          id, session_id, message_id, title, artifact_type, file_name, mime_type, description,
          content_md, file_path, file_size, content_hash, status, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM document_artifacts WHERE id = ?), ?), ?)`,
        [
          id,
          input.sessionId ?? '',
          input.messageId ?? '',
          title,
          type,
          fileName,
          mimeType,
          description,
          contentMd,
          filePath,
          fileStat.size,
          contentHash,
          'exported',
          '',
          id,
          timestamp,
          timestamp,
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '文档产物导出失败';
      await this.run(
        `INSERT OR REPLACE INTO document_artifacts (
          id, session_id, message_id, title, artifact_type, file_name, mime_type, description,
          content_md, file_path, file_size, content_hash, status, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 'failed', ?, COALESCE((SELECT created_at FROM document_artifacts WHERE id = ?), ?), ?)`,
        [
          id,
          input.sessionId ?? '',
          input.messageId ?? '',
          title,
          type,
          fileName,
          mimeType,
          description,
          contentMd,
          filePath,
          message,
          id,
          timestamp,
          timestamp,
        ],
      );
      throw error;
    }

    return this.getDocumentArtifactOrThrow(id);
  }

  async getDocumentArtifact(id: string): Promise<DocumentArtifactExportResult | null> {
    const row = (await this.all(`SELECT * FROM document_artifacts WHERE id = ?`, [id]))[0];
    return row ? this.mapDocumentArtifact(row) : null;
  }

  async listDocumentArtifacts(sessionId?: string): Promise<DocumentArtifactExportResult[]> {
    const rows = sessionId?.trim()
      ? await this.all(
        `SELECT * FROM document_artifacts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 100`,
        [sessionId.trim()],
      )
      : await this.all(`SELECT * FROM document_artifacts ORDER BY updated_at DESC LIMIT 100`);
    return rows.map((row) => this.mapDocumentArtifact(row));
  }

  async buildAiTelemetrySnapshot(input: Pick<AiRegressionReportInput, 'since' | 'until'> = {}): Promise<AiTelemetrySnapshot> {
    const since = normalizeIsoDate(input.since);
    const until = normalizeIsoDate(input.until);
    const whereFor = (column: string) => {
      const clauses: string[] = [];
      const params: SqlValue[] = [];
      if (since) {
        clauses.push(`${column} >= ?`);
        params.push(since);
      }
      if (until) {
        clauses.push(`${column} <= ?`);
        params.push(until);
      }
      return {
        suffix: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
        params,
      };
    };

    const countRows = (rows: Row[], keyName: string) => {
      const counts: Record<string, number> = {};
      for (const row of rows) incrementCount(counts, String(row[keyName] ?? 'unknown'), Number(row.count ?? 0));
      return counts;
    };

    const runWhere = whereFor('created_at');
    const eventWhere = whereFor('created_at');
    const artifactWhere = whereFor('updated_at');
    const confirmationWhere = whereFor('updated_at');
    const taskWhere = whereFor('created_at');

    const [
      runRows,
      statusRows,
      routeRows,
      modelRows,
      eventRows,
      phaseRows,
      toolEventRows,
      toolRunRows,
      artifactRows,
      confirmationRows,
      taskRows,
    ] = await Promise.all([
      this.all(`SELECT created_at, completed_at FROM ai_agent_runs${runWhere.suffix}`, runWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY status`, runWhere.params),
      this.all(`SELECT route, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY route`, runWhere.params),
      this.all(`SELECT model, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY model`, runWhere.params),
      this.all(`SELECT COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix}`, eventWhere.params),
      this.all(`SELECT phase, COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix} GROUP BY phase`, eventWhere.params),
      this.all(`SELECT tool_name, COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix}${eventWhere.suffix ? ' AND' : ' WHERE'} tool_name != '' GROUP BY tool_name`, eventWhere.params),
      this.all(`SELECT tool_name, COUNT(*) AS count FROM ai_tool_runs${eventWhere.suffix} GROUP BY tool_name`, eventWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM document_artifacts${artifactWhere.suffix} GROUP BY status`, artifactWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM ai_confirmation_items${confirmationWhere.suffix} GROUP BY status`, confirmationWhere.params),
      this.all(`SELECT payload_json, result_json FROM ai_tasks${taskWhere.suffix}${taskWhere.suffix ? ' AND' : ' WHERE'} task_type = 'ai_console'`, taskWhere.params),
    ]);

    const latencies = runRows
      .map((row) => {
        const startedAt = Date.parse(String(row.created_at ?? ''));
        const completedAt = Date.parse(String(row.completed_at ?? ''));
        if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) return 0;
        return completedAt - startedAt;
      })
      .filter((value) => value > 0);
    const latency: AiTelemetryLatency = {
      count: latencies.length,
      averageMs: average(latencies),
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
    };

    const toolUsageCounts = countRows(toolRunRows, 'tool_name');
    for (const row of toolEventRows) incrementCount(toolUsageCounts, String(row.tool_name ?? 'unknown'), Number(row.count ?? 0));

    const tokenBudget = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      knownTaskCount: 0,
    };
    const contextBudget = {
      sourceCount: 0,
      knowledgeSnippetCount: 0,
      graphNodeCount: 0,
      taskCount: taskRows.length,
    };
    for (const row of taskRows) {
      const result = jsonObject(row.result_json);
      const usage = result.usage && typeof result.usage === 'object' && !Array.isArray(result.usage)
        ? result.usage as Record<string, unknown>
        : {};
      const totalTokens = toNumber(usage.totalTokens);
      if (totalTokens > 0 || toNumber(usage.promptTokens) > 0 || toNumber(usage.completionTokens) > 0) {
        tokenBudget.knownTaskCount += 1;
      }
      tokenBudget.promptTokens += toNumber(usage.promptTokens);
      tokenBudget.completionTokens += toNumber(usage.completionTokens);
      tokenBudget.totalTokens += totalTokens;
      const payload = jsonObject(row.payload_json);
      contextBudget.sourceCount += toNumber(payload.sourceCount);
      contextBudget.knowledgeSnippetCount += toNumber(payload.knowledgeSnippetCount);
      contextBudget.graphNodeCount += toNumber(payload.graphNodeCount);
    }

    return {
      generatedAt: now(),
      window: {
        since: since || undefined,
        until: until || undefined,
      },
      runCount: runRows.length,
      statusCounts: countRows(statusRows, 'status'),
      routeCounts: countRows(routeRows, 'route'),
      modelCounts: countRows(modelRows, 'model'),
      eventCount: Number(eventRows[0]?.count ?? 0),
      eventPhaseCounts: countRows(phaseRows, 'phase'),
      toolEventCount: Object.values(toolUsageCounts).reduce((sum, value) => sum + value, 0),
      toolUsageCounts,
      artifactCounts: countRows(artifactRows, 'status'),
      confirmationCounts: countRows(confirmationRows, 'status'),
      latency,
      tokenBudget,
      contextBudget,
    };
  }

  async createAiRegressionReport(input: AiRegressionReportInput = {}): Promise<AiRegressionReport> {
    const snapshot = await this.buildAiTelemetrySnapshot(input);
    const runningCount = snapshot.statusCounts.running ?? 0;
    const failedArtifacts = snapshot.artifactCounts.failed ?? 0;
    const pendingConfirmations = snapshot.confirmationCounts.pending ?? 0;
    const gates: AiRegressionGate[] = [
      {
        id: 'agent_runs_terminal',
        label: 'Agent run 终态',
        status: runningCount > 0 ? 'failed' : 'passed',
        detail: runningCount > 0 ? `仍有 ${runningCount} 个 running run。` : '没有遗留 running run。',
        evidence: { statusCounts: snapshot.statusCounts },
      },
      {
        id: 'event_trace_present',
        label: '事件轨迹可审计',
        status: snapshot.runCount === 0 ? 'warning' : snapshot.eventCount >= snapshot.runCount ? 'passed' : 'failed',
        detail: snapshot.runCount === 0
          ? '当前窗口没有 agent run，可观测性覆盖需要真实运行样本。'
          : `runs=${snapshot.runCount}, events=${snapshot.eventCount}。`,
        evidence: { runCount: snapshot.runCount, eventCount: snapshot.eventCount, eventPhaseCounts: snapshot.eventPhaseCounts },
      },
      {
        id: 'tool_trace_present',
        label: '工具轨迹可查询',
        status: snapshot.toolEventCount > 0 ? 'passed' : 'warning',
        detail: snapshot.toolEventCount > 0 ? `记录到 ${snapshot.toolEventCount} 条工具轨迹。` : '当前窗口没有工具轨迹样本。',
        evidence: { toolUsageCounts: snapshot.toolUsageCounts },
      },
      {
        id: 'artifact_export_status',
        label: '产物导出状态',
        status: failedArtifacts > 0 ? 'failed' : 'passed',
        detail: failedArtifacts > 0 ? `存在 ${failedArtifacts} 个 failed 文档产物。` : '没有 failed 文档产物。',
        evidence: { artifactCounts: snapshot.artifactCounts },
      },
      {
        id: 'confirmation_queue_state',
        label: '确认队列状态',
        status: pendingConfirmations > 0 ? 'warning' : 'passed',
        detail: pendingConfirmations > 0 ? `仍有 ${pendingConfirmations} 个待老师确认项。` : '没有待处理确认项。',
        evidence: { confirmationCounts: snapshot.confirmationCounts },
      },
      {
        id: 'latency_budget_available',
        label: '延迟预算可计算',
        status: snapshot.runCount === 0 ? 'warning' : snapshot.latency.count > 0 ? 'passed' : 'warning',
        detail: snapshot.latency.count > 0 ? `p50=${snapshot.latency.p50Ms}ms, p95=${snapshot.latency.p95Ms}ms。` : '当前窗口缺少 completed_at，暂不能计算延迟。',
        evidence: { latency: snapshot.latency },
      },
    ];
    if (input.expectedEvalTotal != null || input.expectedEvalPassed != null) {
      const total = Number(input.expectedEvalTotal ?? 0);
      const passed = Number(input.expectedEvalPassed ?? 0);
      gates.push({
        id: 'router_eval_baseline',
        label: 'Router eval 基线',
        status: total > 0 && passed === total ? 'passed' : 'failed',
        detail: total > 0 ? `${passed}/${total} router eval passed。` : '缺少 router eval 总数。',
        evidence: { expectedEvalTotal: total, expectedEvalPassed: passed },
      });
    }
    const status: AiRegressionGateStatus = gates.some((gate) => gate.status === 'failed')
      ? 'failed'
      : gates.some((gate) => gate.status === 'warning')
        ? 'warning'
        : 'passed';
    const title = input.title?.trim() || '小智 Observability Regression Report';
    const reportJson: Record<string, unknown> = {
      schemaVersion: 'xiazhi.observability.v1',
      replySchemaVersion: 'xiazhi.reply.v2',
      generatedAt: snapshot.generatedAt,
      title,
      status,
      snapshot,
      gates,
    };
    const summary = `runs=${snapshot.runCount}, events=${snapshot.eventCount}, tools=${snapshot.toolEventCount}, status=${status}`;
    const report: AiRegressionReport = {
      id: `aireport_${randomUUID()}`,
      title,
      status,
      summary,
      snapshot,
      gates,
      reportJson,
      createdAt: now(),
    };
    await this.run(
      `INSERT INTO ai_regression_reports (id, title, status, summary, snapshot_json, gates_json, report_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id,
        report.title,
        report.status,
        report.summary,
        JSON.stringify(report.snapshot),
        JSON.stringify(report.gates),
        JSON.stringify(report.reportJson),
        report.createdAt,
      ],
    );
    return this.getAiRegressionReportOrThrow(report.id);
  }

  async getAiRegressionReport(id: string): Promise<AiRegressionReport | null> {
    const row = (await this.all(`SELECT * FROM ai_regression_reports WHERE id = ?`, [id]))[0];
    return row ? this.mapAiRegressionReport(row) : null;
  }

  async listAiRegressionReports(limit = 20): Promise<AiRegressionReport[]> {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const rows = await this.all(`SELECT * FROM ai_regression_reports ORDER BY created_at DESC LIMIT ?`, [boundedLimit]);
    return rows.map((row) => this.mapAiRegressionReport(row));
  }

  private openDatabase(filePath: string) {
    return new Promise<sqlite3.Database>((resolveOpen, reject) => {
      const db = new sqlite3.Database(filePath, (error) => {
        if (error) reject(error);
        else resolveOpen(db);
      });
    });
  }

  private async migrate() {
    await this.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        real_name TEXT,
        grade TEXT,
        school TEXT,
        subjects TEXT NOT NULL DEFAULT '[]',
        goals TEXT,
        current_issues TEXT,
        parent_concerns TEXT,
        teacher_notes TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS learning_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        subject TEXT,
        title TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_id TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        extracted_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (record_id) REFERENCES learning_records(id)
      );
      CREATE TABLE IF NOT EXISTS mistake_image_analyses (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_id TEXT,
        attachment_id TEXT,
        local_path TEXT NOT NULL DEFAULT '',
        ocr_status TEXT NOT NULL DEFAULT 'needs_ocr',
        extracted_text TEXT NOT NULL DEFAULT '',
        sanitized_text TEXT NOT NULL DEFAULT '',
        redactions_json TEXT NOT NULL DEFAULT '[]',
        teacher_corrected_text TEXT NOT NULL DEFAULT '',
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (record_id) REFERENCES learning_records(id),
        FOREIGN KEY (attachment_id) REFERENCES attachments(id)
      );
      CREATE TABLE IF NOT EXISTS review_reports (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        subject TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        parent_summary TEXT NOT NULL DEFAULT '',
        quality_checks_json TEXT NOT NULL DEFAULT '[]',
        source_record_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
      CREATE TABLE IF NOT EXISTS question_bank_items (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        knowledge_point TEXT NOT NULL DEFAULT '',
        question_type TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT 'medium',
        stem TEXT NOT NULL,
        answer TEXT NOT NULL DEFAULT '',
        analysis TEXT NOT NULL DEFAULT '',
        source_title TEXT NOT NULL DEFAULT '',
        source_kind TEXT NOT NULL DEFAULT 'local_bank',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS exercise_sets (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        knowledge_point TEXT NOT NULL DEFAULT '',
        content_md TEXT NOT NULL DEFAULT '',
        items_json TEXT NOT NULL DEFAULT '[]',
        source_question_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tag_dictionary (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        color TEXT,
        description TEXT,
        scope TEXT NOT NULL DEFAULT 'personal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS report_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        report_type TEXT NOT NULL,
        subject TEXT,
        content_md TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'personal',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        base_version TEXT,
        client_timestamp TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_cursors (
        scope TEXT PRIMARY KEY,
        cursor_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entity_versions (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      CREATE TABLE IF NOT EXISTS ai_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL,
        input_hash TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_confirmation_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL DEFAULT '',
        session_id TEXT NOT NULL DEFAULT '',
        student_id TEXT NOT NULL DEFAULT '',
        action_type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        preview_md TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        rejected_at TEXT
      );
      CREATE TABLE IF NOT EXISTS ai_agent_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        route TEXT NOT NULL,
        sub_intent TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        student_id TEXT NOT NULL DEFAULT '',
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_agent_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        phase TEXT NOT NULL,
        status TEXT NOT NULL,
        label TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        tool_name TEXT NOT NULL DEFAULT '',
        input_summary_json TEXT NOT NULL DEFAULT '{}',
        output_summary_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_sessions (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        title TEXT NOT NULL,
        student_id TEXT,
        last_prompt TEXT NOT NULL DEFAULT '',
        last_response_preview TEXT NOT NULL DEFAULT '',
        message_count INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES ai_conversation_folders(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS document_artifacts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL DEFAULT '',
        message_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content_md TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_regression_reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        snapshot_json TEXT NOT NULL DEFAULT '{}',
        gates_json TEXT NOT NULL DEFAULT '[]',
        report_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS teacher_resources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        local_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        parse_status TEXT NOT NULL,
        parse_engine TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resource_chunks (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        heading TEXT,
        content_md TEXT NOT NULL,
        page_number INTEGER,
        bbox_json TEXT,
        token_count INTEGER NOT NULL DEFAULT 0,
        subject TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        knowledge_point TEXT NOT NULL DEFAULT '',
        question_type TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT '',
        source_trust TEXT NOT NULL DEFAULT 'unverified',
        contains_personal_data INTEGER NOT NULL DEFAULT 0,
        quality_score INTEGER NOT NULL DEFAULT 0,
        evidence_strength TEXT NOT NULL DEFAULT 'background',
        embedding_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (resource_id) REFERENCES teacher_resources(id)
      );
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        node_type TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1,
        evidence_strength TEXT NOT NULL DEFAULT 'background',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        evidence_source_id TEXT NOT NULL,
        evidence_text TEXT NOT NULL DEFAULT '',
        confidence REAL NOT NULL DEFAULT 1,
        evidence_strength TEXT NOT NULL DEFAULT 'background',
        evidence_kind TEXT NOT NULL DEFAULT 'inferred',
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id),
        FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id)
      );
      CREATE TABLE IF NOT EXISTS ai_tool_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input_json TEXT NOT NULL DEFAULT '{}',
        output_summary TEXT NOT NULL DEFAULT '',
        evidence_refs_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES ai_tasks(id)
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'teacher',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS teacher_student_assignments (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(teacher_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS analytics_daily (
        day TEXT PRIMARY KEY,
        active_students INTEGER NOT NULL DEFAULT 0,
        record_count INTEGER NOT NULL DEFAULT 0,
        report_count INTEGER NOT NULL DEFAULT 0,
        attachment_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_student_time ON learning_records(student_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_id);
      CREATE INDEX IF NOT EXISTS idx_mistake_image_student ON mistake_image_analyses(student_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mistake_image_record ON mistake_image_analyses(record_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_question_bank_lookup ON question_bank_items(subject, knowledge_point, difficulty);
      CREATE INDEX IF NOT EXISTS idx_exercise_sets_student ON exercise_sets(student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(sync_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_status ON ai_confirmation_items(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_session ON ai_confirmation_items(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_run ON ai_confirmation_items(run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session ON ai_agent_runs(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_events_run ON ai_agent_events(run_id, sequence ASC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_sessions_folder ON ai_conversation_sessions(folder_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_session ON ai_conversation_messages(session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_document_artifacts_session ON document_artifacts(session_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_artifacts_message ON document_artifacts(message_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_regression_reports_created ON ai_regression_reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_teacher_resources_status ON teacher_resources(parse_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource ON resource_chunks(resource_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_resource_chunks_metadata ON resource_chunks(subject, grade, knowledge_point, question_type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_task ON ai_tool_runs(task_id);
    `);
    await this.ensureFts();
    const reportColumns = await this.all(`PRAGMA table_info(review_reports)`);
    if (!hasColumn(reportColumns, 'parent_summary')) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN parent_summary TEXT NOT NULL DEFAULT ''`);
    }
    if (!hasColumn(reportColumns, 'quality_checks_json')) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN quality_checks_json TEXT NOT NULL DEFAULT '[]'`);
    }
    const aiFolderColumns = await this.all(`PRAGMA table_info(ai_conversation_folders)`);
    if (!hasColumn(aiFolderColumns, 'archived_at')) {
      await this.run(`ALTER TABLE ai_conversation_folders ADD COLUMN archived_at TEXT`);
    }
    const aiSessionColumns = await this.all(`PRAGMA table_info(ai_conversation_sessions)`);
    if (!hasColumn(aiSessionColumns, 'archived_at')) {
      await this.run(`ALTER TABLE ai_conversation_sessions ADD COLUMN archived_at TEXT`);
    }
    const chunkColumns = await this.all(`PRAGMA table_info(resource_chunks)`);
    for (const [column, definition] of [
      ['subject', `TEXT NOT NULL DEFAULT ''`],
      ['grade', `TEXT NOT NULL DEFAULT ''`],
      ['knowledge_point', `TEXT NOT NULL DEFAULT ''`],
      ['question_type', `TEXT NOT NULL DEFAULT ''`],
      ['difficulty', `TEXT NOT NULL DEFAULT ''`],
      ['source_trust', `TEXT NOT NULL DEFAULT 'unverified'`],
      ['contains_personal_data', `INTEGER NOT NULL DEFAULT 0`],
      ['quality_score', `INTEGER NOT NULL DEFAULT 0`],
      ['evidence_strength', `TEXT NOT NULL DEFAULT 'background'`],
    ] as const) {
      if (!hasColumn(chunkColumns, column)) {
        await this.run(`ALTER TABLE resource_chunks ADD COLUMN ${column} ${definition}`);
      }
    }
    const nodeColumns = await this.all(`PRAGMA table_info(knowledge_nodes)`);
    if (!hasColumn(nodeColumns, 'evidence_strength')) {
      await this.run(`ALTER TABLE knowledge_nodes ADD COLUMN evidence_strength TEXT NOT NULL DEFAULT 'background'`);
    }
    const edgeColumns = await this.all(`PRAGMA table_info(knowledge_edges)`);
    if (!hasColumn(edgeColumns, 'evidence_strength')) {
      await this.run(`ALTER TABLE knowledge_edges ADD COLUMN evidence_strength TEXT NOT NULL DEFAULT 'background'`);
    }
    if (!hasColumn(edgeColumns, 'evidence_kind')) {
      await this.run(`ALTER TABLE knowledge_edges ADD COLUMN evidence_kind TEXT NOT NULL DEFAULT 'inferred'`);
    }
    await this.run(`CREATE INDEX IF NOT EXISTS idx_resource_chunks_metadata ON resource_chunks(subject, grade, knowledge_point, question_type)`);
    await this.seedPlatformDefaults();
    await this.rebuildRecordFtsIfEmpty();
  }

  private async seedIfEmpty() {
    const count = Number((await this.all('SELECT COUNT(*) AS count FROM students'))[0]?.count ?? 0);
    if (count > 0) return;
    await this.createStudent({
      displayName: '小A',
      grade: '初二',
      subjects: ['数学', '英语'],
      goals: '期末数学稳定在 90 分以上',
      currentIssues: '函数图像理解不稳，移项和符号错误反复出现。',
      parentConcerns: '希望看到每月进步反馈。',
      tags: ['函数', '计算细节', '家长高关注'],
    });
    const studentId = (await this.listStudents('小A'))[0].id;
    await this.createRecord({
      studentId,
      recordType: 'mistake',
      subject: '数学',
      title: '一次函数图像与参数关系',
      content: '连续三次把 k 值正负与图像走向对应做错，需要从图像变化重新讲解。',
      tags: ['一次函数', '概念混淆'],
      occurredAt: new Date(Date.now() - 86400000).toISOString(),
    });
    await this.createRecord({
      studentId,
      recordType: 'homework',
      subject: '数学',
      title: '方程应用题订正',
      content: '能列式，但单位转换和未知数说明不稳定。',
      tags: ['审题', '表达规范'],
      occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
  }

  private async seedPlatformDefaults() {
    const timestamp = now();
    if (await this.scalarCount('users') === 0) {
      await this.run(
        `INSERT INTO users (id, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, 'owner', 'active', ?, ?)`,
        [`user_${randomUUID()}`, '默认老师', timestamp, timestamp],
      );
    }
    if (await this.scalarCount('tag_dictionary') === 0) {
      for (const [name, category, color] of [
        ['概念混淆', '错因', '#9a5b08'],
        ['计算粗心', '能力', '#b34035'],
        ['表达不规范', '习惯', '#2457a6'],
        ['家长高关注', '沟通', '#1d5c52'],
      ]) {
        await this.run(
          `INSERT INTO tag_dictionary (id, name, category, color, description, scope, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', 'team-ready', ?, ?)`,
          [`tag_${randomUUID()}`, name, category, color, timestamp, timestamp],
        );
      }
    }
    if (await this.scalarCount('report_templates') === 0) {
      await this.run(
        `INSERT INTO report_templates (id, name, report_type, subject, content_md, scope, is_default, created_at, updated_at)
         VALUES (?, '阶段复盘标准模板', 'monthly', '', ?, 'team-ready', 1, ?, ?)`,
        [
          `template_${randomUUID()}`,
          '# 阶段复盘\n\n## 整体表现\n\n## 主要进步\n\n## 高频薄弱点\n\n## 下阶段建议\n\n## 家长沟通版摘要\n',
          timestamp,
          timestamp,
        ],
      );
    }
    if (await this.scalarCount('question_bank_items') === 0) {
      await this.createQuestionBankItem({
        subject: '数学',
        grade: '初二',
        knowledgePoint: '一次函数',
        questionType: '解答题',
        difficulty: 'medium',
        stem: '已知一次函数 y = kx + b 经过点 (0, 2) 和 (3, 8)，求 k、b，并判断图像随 x 增大如何变化。',
        answer: 'b = 2，3k + 2 = 8，所以 k = 2；图像随 x 增大而增大。',
        analysis: '先用 x=0 得到截距 b，再代入另一点求斜率 k；k>0 表示递增。',
        sourceTitle: '内置演示题库',
        tags: ['一次函数', 'k值', '图像性质'],
      });
      await this.createQuestionBankItem({
        subject: '数学',
        grade: '初二',
        knowledgePoint: '一次函数',
        questionType: '变式题',
        difficulty: 'medium',
        stem: '一次函数 y = -3x + 5 的图像经过哪些象限？函数值随 x 增大如何变化？',
        answer: '经过第一、二、四象限；函数值随 x 增大而减小。',
        analysis: 'b>0，k<0，所以图像过一二四象限；斜率为负表示递减。',
        sourceTitle: '内置演示题库',
        tags: ['一次函数', '象限', '增减性'],
      });
    }
  }

  private async ensureTeacherLibraryNode() {
    const timestamp = now();
    await this.run(
      `INSERT OR IGNORE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
      ) VALUES ('node_teacher_library', '知识库', '老师知识库', '老师本地导入的教学资源集合。', 'system', 'teacher_library', 1, 'background', ?, ?)`,
      [timestamp, timestamp],
    );
  }

  private async createResourceGraph(resourceId: string, title: string, resourceType: string, fileSize: number, timestamp: string) {
    const nodeId = `node_${resourceId}`;
    await this.run(
      `INSERT OR REPLACE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
      ) VALUES (?, '资源', ?, ?, 'teacher_resource', ?, 1, 'background', ?, ?)`,
      [nodeId, title, `${resourceType} 文件，${fileSize} bytes。`, resourceId, timestamp, timestamp],
    );
    await this.run(
      `INSERT OR IGNORE INTO knowledge_edges (
        id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
      ) VALUES (?, 'node_teacher_library', ?, '包含', ?, ?, 1, 'background', 'metadata', ?)`,
      [`edge_library_${resourceId}`, nodeId, resourceId, title, timestamp],
    );
  }

  private async createResourceChunksAndGraph(resourceId: string, resourceTitle: string, content: string, timestamp: string) {
    const chunks = splitIntoChunks(content);
    for (const [index, chunk] of chunks.entries()) {
      const chunkId = `chunk_${randomUUID()}`;
      const metadata = inferResourceChunkMetadata(resourceTitle, chunk.heading, chunk.content);
      await this.run(
        `INSERT INTO resource_chunks (
          id, resource_id, chunk_index, heading, content_md, page_number, bbox_json,
          token_count, subject, grade, knowledge_point, question_type, difficulty,
          source_trust, contains_personal_data, quality_score, evidence_strength,
          embedding_status, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          chunkId,
          resourceId,
          index,
          chunk.heading,
          chunk.content,
          Math.ceil(chunk.content.length / 2),
          metadata.subject,
          metadata.grade,
          metadata.knowledgePoint,
          metadata.questionType,
          metadata.difficulty,
          metadata.sourceTrust,
          metadata.containsPersonalData ? 1 : 0,
          metadata.qualityScore,
          metadata.evidenceStrength,
          timestamp,
        ],
      );
      const nodeId = `node_${chunkId}`;
      await this.run(
        `INSERT OR REPLACE INTO knowledge_nodes (
          id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
        [
          nodeId,
          chunk.heading ? '章节' : '片段',
          chunk.heading || `${resourceTitle} #${index + 1}`,
          chunk.content.slice(0, 180),
          chunkId,
          metadata.qualityScore / 100,
          metadata.evidenceStrength,
          timestamp,
          timestamp,
        ],
      );
      await this.run(
        `INSERT OR IGNORE INTO knowledge_edges (
          id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
        ) VALUES (?, ?, ?, '包含', ?, ?, ?, ?, 'direct_quote', ?)`,
        [`edge_${resourceId}_${chunkId}`, `node_${resourceId}`, nodeId, chunkId, resourceTitle, metadata.qualityScore / 100, metadata.evidenceStrength, timestamp],
      );
      if (metadata.knowledgePoint) {
        const knowledgePointNodeId = stableKnowledgeId('node_kp', metadata.knowledgePoint);
        await this.run(
          `INSERT OR REPLACE INTO knowledge_nodes (
            id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
          ) VALUES (?, '知识点', ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
          [
            knowledgePointNodeId,
            metadata.knowledgePoint,
            `${metadata.subject || '未知学科'} / ${metadata.grade || '未标年级'}：${chunk.content.slice(0, 140)}`,
            chunkId,
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
            timestamp,
          ],
        );
        await this.run(
          `INSERT OR IGNORE INTO knowledge_edges (
            id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
          ) VALUES (?, ?, ?, '涉及', ?, ?, ?, ?, 'direct_quote', ?)`,
          [
            `edge_${chunkId}_${knowledgePointNodeId}`,
            `node_${chunkId}`,
            knowledgePointNodeId,
            chunkId,
            chunk.heading || chunk.content.slice(0, 80),
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
          ],
        );
      }
      if (metadata.questionType) {
        const questionTypeNodeId = stableKnowledgeId('node_qt', metadata.questionType);
        await this.run(
          `INSERT OR REPLACE INTO knowledge_nodes (
            id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
          ) VALUES (?, '题型', ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
          [
            questionTypeNodeId,
            metadata.questionType,
            `${metadata.subject || '未知学科'} 题型：${metadata.questionType}`,
            chunkId,
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
            timestamp,
          ],
        );
        await this.run(
          `INSERT OR IGNORE INTO knowledge_edges (
            id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
          ) VALUES (?, ?, ?, '题型', ?, ?, ?, ?, 'direct_quote', ?)`,
          [
            `edge_${chunkId}_${questionTypeNodeId}`,
            `node_${chunkId}`,
            questionTypeNodeId,
            chunkId,
            chunk.heading || chunk.content.slice(0, 80),
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
          ],
        );
      }
    }
  }

  private async enqueueResourceParseTask(resourceId: string, title: string, resourceType: string, timestamp: string) {
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'resource_parse', 'pending', ?, ?, NULL, '', 0, ?, ?)`,
      [
        `task_${randomUUID()}`,
        createHash('sha256').update(resourceId).digest('hex'),
        JSON.stringify({
          resourceId,
          title,
          resourceType,
          engine: resourceType === 'image' ? 'MinerU/OCR 待接入' : 'Docling 待接入',
        }),
        timestamp,
        timestamp,
      ],
    );
  }

  private async listAttachments(recordId: string): Promise<Attachment[]> {
    return (await this.all(`SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC`, [recordId])).map(this.mapAttachment);
  }

  private async listAttachmentsForRecords(recordIds: string[]): Promise<Map<string, Attachment[]>> {
    const grouped = new Map<string, Attachment[]>();
    if (!recordIds.length) return grouped;
    const rows = (await this.all(
      `SELECT * FROM attachments WHERE record_id IN (${recordIds.map(() => '?').join(',')}) ORDER BY created_at DESC`,
      recordIds,
    )).map(this.mapAttachment);
    for (const attachment of rows) {
      if (!attachment.recordId) continue;
      const group = grouped.get(attachment.recordId) ?? [];
      group.push(attachment);
      grouped.set(attachment.recordId, group);
    }
    return grouped;
  }

  private async withAttachments(records: LearningRecord[]): Promise<LearningRecord[]> {
    const attachmentsByRecord = await this.listAttachmentsForRecords(records.map((record) => record.id));
    return records.map((record) => ({ ...record, attachments: attachmentsByRecord.get(record.id) ?? [] }));
  }

  private studentRoot(studentId: string) {
    return this.resolveInsideDataRoot('students', studentId);
  }

  private resolveInsideDataRoot(...parts: string[]) {
    return resolveInsideRoot(this.dataRoot, ...parts);
  }

  private copyDirectory(source: string, target: string): number {
    mkdirSync(target, { recursive: true });
    let copied = 0;
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const sourcePath = join(source, entry.name);
      const targetPath = join(target, entry.name);
      if (entry.isDirectory()) {
        copied += this.copyDirectory(sourcePath, targetPath);
      } else if (entry.isFile()) {
        copyFileSync(sourcePath, targetPath);
        copied += 1;
      }
    }
    return copied;
  }

  private async touchStudent(studentId: string) {
    await this.run(`UPDATE students SET updated_at = ? WHERE id = ?`, [now(), studentId]);
  }

  private async ensureAiConversationFolder(folderId: string) {
    const folder = (await this.all(`SELECT id FROM ai_conversation_folders WHERE id = ?`, [folderId]))[0];
    if (!folder) throw new Error('AI 对话文件夹不存在');
  }

  private async getAiConfirmationOrThrow(id: string): Promise<AiConfirmationItem> {
    const row = (await this.all(`SELECT * FROM ai_confirmation_items WHERE id = ?`, [id]))[0];
    if (!row) throw new Error('确认项不存在');
    return this.mapAiConfirmationItem(row);
  }

  private async getMistakeImageAnalysisOrThrow(id: string): Promise<MistakeImageAnalysis> {
    const row = (await this.all(`SELECT * FROM mistake_image_analyses WHERE id = ?`, [id]))[0];
    if (!row) throw new Error('错题图片解析记录不存在');
    return this.mapMistakeImageAnalysis(row);
  }

  private async getDocumentArtifactOrThrow(id: string): Promise<DocumentArtifactExportResult> {
    const row = (await this.all(`SELECT * FROM document_artifacts WHERE id = ?`, [id]))[0];
    if (!row) throw new Error('文档产物导出后未能读回');
    return this.mapDocumentArtifact(row);
  }

  private async getAiRegressionReportOrThrow(id: string): Promise<AiRegressionReport> {
    const row = (await this.all(`SELECT * FROM ai_regression_reports WHERE id = ?`, [id]))[0];
    if (!row) throw new Error('AI 回归报告生成后未能读回');
    return this.mapAiRegressionReport(row);
  }

  private async executeAiConfirmation(item: AiConfirmationItem): Promise<AiConfirmationDecisionResult['readback']> {
    if (item.actionType === 'create_review_report') {
      const report = await this.createReviewReportFromConfirmation(item.payload);
      return { report };
    }
    if (item.actionType === 'save_exercise_set') {
      const exerciseSet = await this.createExerciseSetFromConfirmation(item.payload);
      return { exerciseSet };
    }
    throw new Error(`不支持的确认动作：${item.actionType}`);
  }

  private async createExerciseSetFromConfirmation(payload: AiConfirmationPayload): Promise<ExerciseSet> {
    const studentId = requireNonEmpty(payload.studentId, '确认项缺少学生 ID');
    const student = (await this.listStudents('')).find((item) => item.id === studentId);
    if (!student) throw new Error('学生不存在');
    const draft: ExerciseSetDraftPayload = payload.exerciseSet ?? {
      title: payload.title || '小智三元题组',
      subject: payload.subject,
      knowledgePoint: '',
      contentMd: payload.contentMd,
      sourceQuestionIds: [],
      items: [],
    };
    const exerciseSet = await this.saveExerciseSetFromDraft(studentId, draft);
    const readback = (await this.all(`SELECT * FROM exercise_sets WHERE id = ?`, [exerciseSet.id]))[0];
    if (!readback) throw new Error('确认后未能读回三元题组');
    return this.mapExerciseSet(readback);
  }

  private async createReviewReportFromConfirmation(payload: AiConfirmationPayload): Promise<ReviewReport> {
    const studentId = requireNonEmpty(payload.studentId, '确认项缺少学生 ID');
    const student = (await this.listStudents('')).find((item) => item.id === studentId);
    if (!student) throw new Error('学生不存在');
    const title = requireNonEmpty(payload.title, '确认项缺少报告标题');
    const contentMd = requireNonEmpty(payload.contentMd, '确认项缺少报告正文');
    const parentSummary = payload.parentSummary?.trim() || 'AI 已生成复盘草稿，请老师确认后再用于家长沟通。';
    const sourceRecordIds = (payload.sourceRecordIds ?? []).filter(Boolean);
    const sourceRecords = sourceRecordIds.length ? await this.recordsByIds(studentId, sourceRecordIds) : [];
    const qualityChecks = this.buildReportQualityChecks(sourceRecords, contentMd, parentSummary);
    const timestamp = now();
    const report: ReviewReport = {
      id: `report_${randomUUID()}`,
      studentId,
      subject: payload.subject ?? '',
      startDate: payload.startDate,
      endDate: payload.endDate,
      reportType: payload.reportType || 'ai_draft',
      title,
      contentMd,
      parentSummary,
      qualityChecks,
      sourceRecordIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const reportRoot = this.resolveInsideDataRoot('students', studentId, 'reports');
    mkdirSync(reportRoot, { recursive: true });
    const reportPath = resolveInsideRoot(reportRoot, `${report.id}.md`);
    let fileWritten = false;
    await this.run(`BEGIN IMMEDIATE`);
    try {
      await this.run(
        `INSERT INTO review_reports (
          id, student_id, subject, start_date, end_date, report_type, title, content_md,
          parent_summary, quality_checks_json, source_record_ids, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          report.id,
          report.studentId,
          report.subject,
          report.startDate,
          report.endDate,
          report.reportType,
          report.title,
          report.contentMd,
          report.parentSummary,
          JSON.stringify(report.qualityChecks),
          JSON.stringify(report.sourceRecordIds),
          report.createdAt,
          report.updatedAt,
        ],
      );
      writeFileSync(reportPath, contentMd, 'utf8');
      fileWritten = true;
      await this.touchStudent(studentId);
      const readback = (await this.all(`SELECT * FROM review_reports WHERE id = ?`, [report.id]))[0];
      if (!readback) throw new Error('确认后未能读回复盘报告');
      await this.run(`COMMIT`);
      return this.mapReport(readback);
    } catch (error) {
      await this.run(`ROLLBACK`).catch(() => undefined);
      if (fileWritten) rmSync(reportPath, { force: true });
      throw error;
    }
  }

  private async recordsByIds(studentId: string, recordIds: string[]): Promise<LearningRecord[]> {
    const uniqueIds = [...new Set(recordIds)].slice(0, 50);
    if (!uniqueIds.length) return [];
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const rows = await this.all(
      `SELECT * FROM learning_records WHERE student_id = ? AND id IN (${placeholders})`,
      [studentId, ...uniqueIds],
    );
    const records = rows.map((row) => this.mapRecord(row));
    return this.withAttachments(records);
  }

  private run(sql: string, params: SqlValue[] = []) {
    return new Promise<void>((resolveRun, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) reject(error);
        else resolveRun();
      });
    });
  }

  private all(sql: string, params: SqlValue[] = []) {
    return new Promise<Row[]>((resolveAll, reject) => {
      this.db.all(sql, params, (error, rows: Row[]) => {
        if (error) reject(error);
        else resolveAll(rows ?? []);
      });
    });
  }

  private exec(sql: string) {
    return new Promise<void>((resolveExec, reject) => {
      this.db.exec(sql, (error) => {
        if (error) reject(error);
        else resolveExec();
      });
    });
  }

  private async scalarCount(table: string, where?: string): Promise<number> {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const rows = await this.all(`SELECT COUNT(*) AS count FROM ${safeTable}${where ? ` WHERE ${where}` : ''}`);
    return Number(rows[0]?.count ?? 0);
  }

  private mapStudent(row: Row): Student {
    return {
      id: String(row.id),
      displayName: String(row.display_name ?? ''),
      realName: String(row.real_name ?? ''),
      grade: String(row.grade ?? ''),
      school: String(row.school ?? ''),
      subjects: jsonArray(row.subjects),
      goals: String(row.goals ?? ''),
      currentIssues: String(row.current_issues ?? ''),
      parentConcerns: String(row.parent_concerns ?? ''),
      teacherNotes: String(row.teacher_notes ?? ''),
      tags: jsonArray(row.tags),
      status: String(row.status ?? 'active') === 'archived' ? 'archived' : 'active',
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      recordCount: Number(row.record_count ?? 0),
      attachmentBytes: Number(row.attachment_bytes ?? 0),
    };
  }

  private mapRecord(row: Row): LearningRecord {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordType: String(row.record_type ?? ''),
      subject: String(row.subject ?? ''),
      title: String(row.title ?? ''),
      content: String(row.content ?? ''),
      summary: String(row.summary ?? ''),
      tags: jsonArray(row.tags),
      occurredAt: String(row.occurred_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      attachments: [],
    };
  }

  private mapAttachment(row: Row): Attachment {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordId: row.record_id ? String(row.record_id) : null,
      fileName: String(row.file_name ?? ''),
      filePath: String(row.file_path ?? ''),
      fileType: String(row.file_type ?? ''),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ''),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapMistakeImageAnalysis(row: Row): MistakeImageAnalysis {
    const status = String(row.ocr_status ?? 'needs_ocr');
    return {
      id: String(row.id),
      studentId: String(row.student_id ?? ''),
      recordId: String(row.record_id ?? ''),
      attachmentId: String(row.attachment_id ?? ''),
      localPath: String(row.local_path ?? ''),
      ocrStatus: (status === 'sanitized' || status === 'teacher_corrected' || status === 'failed') ? status : 'needs_ocr',
      extractedText: String(row.extracted_text ?? ''),
      sanitizedText: String(row.sanitized_text ?? ''),
      redactions: parseMistakeImageRedactions(row.redactions_json),
      teacherCorrectedText: String(row.teacher_corrected_text ?? ''),
      errorMessage: String(row.error_message ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapReport(row: Row): ReviewReport {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      subject: String(row.subject ?? ''),
      startDate: String(row.start_date ?? ''),
      endDate: String(row.end_date ?? ''),
      reportType: String(row.report_type ?? ''),
      title: String(row.title ?? ''),
      contentMd: String(row.content_md ?? ''),
      parentSummary: String(row.parent_summary ?? ''),
      qualityChecks: this.parseQualityChecks(row.quality_checks_json),
      sourceRecordIds: jsonArray(row.source_record_ids),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapQuestionBankItem(row: Row): QuestionBankItem {
    const difficulty = String(row.difficulty ?? 'medium');
    const sourceKind = String(row.source_kind ?? 'local_bank');
    return {
      id: String(row.id),
      subject: String(row.subject ?? ''),
      grade: String(row.grade ?? ''),
      knowledgePoint: String(row.knowledge_point ?? ''),
      questionType: String(row.question_type ?? ''),
      difficulty: difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium',
      stem: String(row.stem ?? ''),
      answer: String(row.answer ?? ''),
      analysis: String(row.analysis ?? ''),
      sourceTitle: String(row.source_title ?? ''),
      sourceKind: sourceKind === 'teacher_resource' || sourceKind === 'generated' ? sourceKind : 'local_bank',
      tags: jsonArray(row.tags),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapExerciseSet(row: Row): ExerciseSet {
    return {
      id: String(row.id),
      studentId: String(row.student_id ?? ''),
      title: String(row.title ?? ''),
      subject: String(row.subject ?? ''),
      knowledgePoint: String(row.knowledge_point ?? ''),
      contentMd: String(row.content_md ?? ''),
      items: parseExerciseSetItems(jsonUnknownArray(row.items_json)),
      sourceQuestionIds: jsonArray(row.source_question_ids),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiAgentRun(row: Row): AiAgentRun {
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? ''),
      prompt: String(row.prompt ?? ''),
      route: String(row.route ?? 'general_qa') as AiAgentRun['route'],
      subIntent: String(row.sub_intent ?? ''),
      status: String(row.status ?? 'running') as AiAgentRunStatus,
      model: String(row.model ?? ''),
      studentId: String(row.student_id ?? ''),
      errorMessage: String(row.error_message ?? ''),
      createdAt: String(row.created_at ?? ''),
      completedAt: String(row.completed_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiAgentEvent(row: Row): AiAgentEvent {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      sequence: Number(row.sequence ?? 0),
      phase: String(row.phase ?? 'plan') as AiAgentEvent['phase'],
      status: String(row.status ?? 'pending') as AiAgentEvent['status'],
      label: String(row.label ?? ''),
      detail: String(row.detail ?? ''),
      toolName: String(row.tool_name ?? '') || undefined,
      inputSummary: jsonObject(row.input_summary_json),
      outputSummary: jsonObject(row.output_summary_json),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapAiConfirmationItem(row: Row): AiConfirmationItem {
    return {
      id: String(row.id),
      runId: String(row.run_id ?? ''),
      sessionId: String(row.session_id ?? ''),
      studentId: String(row.student_id ?? ''),
      actionType: String(row.action_type ?? 'create_review_report') as AiConfirmationItem['actionType'],
      status: String(row.status ?? 'pending') as AiConfirmationStatus,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      previewMd: String(row.preview_md ?? ''),
      payload: parseAiConfirmationPayload(row.payload_json),
      result: jsonObject(row.result_json),
      errorMessage: String(row.error_message ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      confirmedAt: String(row.confirmed_at ?? ''),
      rejectedAt: String(row.rejected_at ?? ''),
    };
  }

  private mapAiConversationFolder(row: Row): AiConversationFolder {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      sortOrder: Number(row.sort_order ?? 0),
      archivedAt: String(row.archived_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiConversationSession(row: Row): AiConversationSession {
    return {
      id: String(row.id),
      folderId: row.folder_id ? String(row.folder_id) : null,
      title: String(row.title ?? '新对话'),
      studentId: String(row.student_id ?? ''),
      lastPrompt: String(row.last_prompt ?? ''),
      lastResponsePreview: String(row.last_response_preview ?? ''),
      messageCount: Number(row.message_count ?? 0),
      archivedAt: String(row.archived_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiConversationMessage(row: Row): AiConversationMessage {
    const role = String(row.role ?? 'user');
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      role: role === 'assistant' || role === 'system' ? role : 'user',
      content: String(row.content ?? ''),
      metadata: jsonObject(row.metadata_json),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapDocumentArtifact(row: Row): DocumentArtifactExportResult {
    const type = normalizeDocumentArtifactType(String(row.artifact_type ?? 'markdown'));
    const rawStatus = String(row.status ?? 'draft');
    const status = rawStatus === 'exported' || rawStatus === 'failed' ? rawStatus : 'draft';
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? ''),
      messageId: String(row.message_id ?? ''),
      title: String(row.title ?? ''),
      type,
      fileName: String(row.file_name ?? ''),
      mimeType: String(row.mime_type ?? documentMimeType(type)),
      description: String(row.description ?? ''),
      contentMd: String(row.content_md ?? ''),
      filePath: String(row.file_path ?? ''),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ''),
      status,
      errorMessage: String(row.error_message ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiRegressionReport(row: Row): AiRegressionReport {
    const rawStatus = String(row.status ?? 'warning');
    const status: AiRegressionGateStatus = rawStatus === 'passed' || rawStatus === 'failed' || rawStatus === 'warning'
      ? rawStatus
      : 'warning';
    const snapshot = row.snapshot_json ? parseTelemetrySnapshot(row.snapshot_json) : emptyTelemetrySnapshot();
    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      status,
      summary: String(row.summary ?? ''),
      snapshot,
      gates: parseRegressionGates(row.gates_json),
      reportJson: jsonObject(row.report_json),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapTeacherResource(row: Row) {
    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      resourceType: String(row.resource_type ?? ''),
      originalFileName: String(row.original_file_name ?? ''),
      localPath: String(row.local_path ?? ''),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ''),
      parseStatus: String(row.parse_status ?? 'queued') as KnowledgeImportResult['resources'][number]['parseStatus'],
      parseEngine: String(row.parse_engine ?? ''),
      chunkCount: Number(row.chunk_count ?? 0),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapResourceChunk(row: Row): ResourceChunk {
    const sourceTrust = String(row.source_trust ?? 'unverified');
    const evidenceStrength = String(row.evidence_strength ?? 'background');
    return {
      id: String(row.id),
      resourceId: String(row.resource_id),
      resourceTitle: String(row.resource_title ?? ''),
      chunkIndex: Number(row.chunk_index ?? 0),
      heading: String(row.heading ?? ''),
      contentMd: String(row.content_md ?? ''),
      pageNumber: row.page_number == null ? null : Number(row.page_number),
      subject: String(row.subject ?? ''),
      grade: String(row.grade ?? ''),
      knowledgePoint: String(row.knowledge_point ?? ''),
      questionType: String(row.question_type ?? ''),
      difficulty: String(row.difficulty ?? ''),
      sourceTrust: (sourceTrust === 'teacher_verified' || sourceTrust === 'machine_extracted') ? sourceTrust : 'unverified',
      containsPersonalData: Number(row.contains_personal_data ?? 0) === 1,
      qualityScore: Number(row.quality_score ?? 0),
      evidenceStrength: (evidenceStrength === 'direct' || evidenceStrength === 'indirect') ? evidenceStrength : 'background',
      embeddingStatus: String(row.embedding_status ?? 'pending'),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapKnowledgeNode(row: Row): KnowledgeNode {
    const evidenceStrength = String(row.evidence_strength ?? 'background');
    return {
      id: String(row.id),
      nodeType: String(row.node_type ?? ''),
      name: String(row.name ?? ''),
      summary: String(row.summary ?? ''),
      sourceKind: String(row.source_kind ?? ''),
      sourceId: String(row.source_id ?? ''),
      confidence: Number(row.confidence ?? 0),
      evidenceStrength: (evidenceStrength === 'direct' || evidenceStrength === 'indirect') ? evidenceStrength : 'background',
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapKnowledgeEdge(row: Row): KnowledgeEdge {
    const evidenceStrength = String(row.evidence_strength ?? 'background');
    const evidenceKind = String(row.evidence_kind ?? 'inferred');
    return {
      id: String(row.id),
      sourceNodeId: String(row.source_node_id ?? ''),
      targetNodeId: String(row.target_node_id ?? ''),
      relationType: String(row.relation_type ?? ''),
      evidenceSourceId: String(row.evidence_source_id ?? ''),
      evidenceText: String(row.evidence_text ?? ''),
      confidence: Number(row.confidence ?? 0),
      evidenceStrength: (evidenceStrength === 'direct' || evidenceStrength === 'indirect') ? evidenceStrength : 'background',
      evidenceKind: (evidenceKind === 'direct_quote' || evidenceKind === 'metadata') ? evidenceKind : 'inferred',
      createdAt: String(row.created_at ?? ''),
    };
  }

  private async ensureFts() {
    try {
      await this.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS learning_records_fts USING fts5(
          id UNINDEXED,
          student_id UNINDEXED,
          title,
          content,
          subject,
          tags
        );
      `);
    } catch {
      // Some SQLite builds can omit FTS5. Search falls back to LIKE in that case.
    }
  }

  private async rebuildRecordFts() {
    try {
      await this.run(`DELETE FROM learning_records_fts`);
      const rows = await this.all(`SELECT id FROM learning_records`);
      for (const row of rows) await this.upsertRecordFts(String(row.id));
    } catch {
      // FTS is an optional acceleration layer for MVP search.
    }
  }

  private async rebuildRecordFtsIfEmpty() {
    try {
      const recordCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records`))[0]?.count ?? 0);
      const ftsCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records_fts`))[0]?.count ?? 0);
      if (recordCount > 0 && ftsCount === 0) await this.rebuildRecordFts();
    } catch {
      // FTS remains optional and can be rebuilt by later maintenance tasks.
    }
  }

  private async upsertRecordFts(recordId: string) {
    try {
      const record = (await this.all(`SELECT * FROM learning_records WHERE id = ?`, [recordId]))[0];
      if (!record) return;
      await this.run(`DELETE FROM learning_records_fts WHERE id = ?`, [recordId]);
      await this.run(
        `INSERT INTO learning_records_fts (id, student_id, title, content, subject, tags)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(record.id),
          String(record.student_id),
          String(record.title ?? ''),
          String(record.content ?? ''),
          String(record.subject ?? ''),
          jsonArray(record.tags).join(' '),
        ],
      );
    } catch {
      // Keep record writes successful even if the optional FTS index cannot update.
    }
  }

  private async searchRecordIdsByFts(keyword: string, studentId?: string): Promise<string[] | null> {
    try {
      const query = this.toFtsQuery(keyword);
      const rows = studentId
        ? await this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ? AND student_id = ?
              LIMIT ?`,
            [query, studentId, FTS_MATCH_LIMIT],
          )
        : await this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ?
              LIMIT ?`,
            [query, FTS_MATCH_LIMIT],
          );
      return rows.map((row) => String(row.id));
    } catch {
      return null;
    }
  }

  private async searchRecordsByFts(keyword: string): Promise<LearningRecord[] | null> {
    const ids = await this.searchRecordIdsByFts(keyword);
    if (!ids) return null;
    if (!ids.length) return [];
    const rows = await this.all(
      `SELECT * FROM learning_records
        WHERE id IN (${ids.map(() => '?').join(',')})
        ORDER BY occurred_at DESC
        LIMIT 50`,
      ids,
    );
    return this.withAttachments(rows.map((row) => this.mapRecord(row)));
  }

  private toFtsQuery(keyword: string) {
    return keyword
      .split(/\s+/)
      .map((part) => part.replace(/["*]/g, '').trim())
      .filter(Boolean)
      .map((part) => `"${part}"`)
      .join(' OR ') || '""';
  }

  private buildReportQualityChecks(records: Array<Pick<LearningRecord, 'id'>>, contentMd: string, parentSummary: string): ReviewQualityCheck[] {
    const hasEvidence = records.length > 0;
    return [
      {
        key: 'has_evidence',
        label: '包含真实证据',
        passed: hasEvidence,
        detail: hasEvidence ? `引用 ${records.length} 条学习记录。` : '当前报告没有可追溯学习记录。',
      },
      {
        key: 'has_next_steps',
        label: '包含下阶段建议',
        passed: contentMd.includes('下阶段建议') && /\n1\./.test(contentMd),
        detail: '检查报告是否给出可执行的下一步。',
      },
      {
        key: 'has_parent_summary',
        label: '包含家长沟通版摘要',
        passed: parentSummary.trim().length >= 20,
        detail: parentSummary.trim() ? '家长摘要已单独保存。' : '缺少家长可读摘要。',
      },
      {
        key: 'editable',
        label: '保持教师可编辑',
        passed: true,
        detail: '报告以 Markdown 保存，老师可继续修改。',
      },
    ];
  }

  private parseQualityChecks(value: unknown): ReviewQualityCheck[] {
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        key: String(item.key ?? ''),
        label: String(item.label ?? ''),
        passed: Boolean(item.passed),
        detail: String(item.detail ?? ''),
      }));
    } catch {
      return [];
    }
  }
}

export { toCsvList };
