// <stdin>
import assert from "node:assert/strict";

// src/main/db.ts
import { createHash as createHash2, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sqlite3 from "sqlite3";

// src/main/local-file-security.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
function resolveInsideRoot(root, ...parts) {
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, ...parts);
  const relation = relative(resolvedRoot, target);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Path escapes the local data root");
  }
  return target;
}
async function isInsideRoot(root, targetPath) {
  try {
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      realpath(root),
      realpath(targetPath)
    ]);
    const relation = relative(resolvedRoot, resolvedTarget);
    return relation === "" || !relation.startsWith("..") && !isAbsolute(relation);
  } catch {
    return false;
  }
}
function hashFileSha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

// src/main/db.ts
var DEFAULT_RECORD_PAGE_SIZE = 100;
var MAX_RECORD_PAGE_SIZE = 500;
var FTS_MATCH_LIMIT = 500;
var DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
var AI_MEMORY_SURFACES = ["chat", "notebook", "quiz", "kb", "book", "partner", "cowriter"];
var AI_MEMORY_L3_SLOTS = ["recent", "profile", "scope", "preferences"];
var AI_MEMORY_TEXT_MAX = 1e3;
var AI_MEMORY_REF_MAX = 8;
function assertAiMemorySurface(surface) {
  if (!AI_MEMORY_SURFACES.includes(surface)) {
    throw new Error("L2 memory surface invalid");
  }
}
function assertAiMemoryL3Slot(slot) {
  if (!AI_MEMORY_L3_SLOTS.includes(slot)) throw new Error(`invalid L3 slot: ${slot}`);
}
function normalizeMemoryText(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("L2 memory text cannot be empty");
  if (normalized.length > AI_MEMORY_TEXT_MAX) throw new Error("L2 memory text exceeds 1000 characters");
  const banned = ["always", "never", "mastered", "expert in", "\u603B\u662F", "\u4ECE\u6765\u4E0D", "\u5B8C\u5168\u638C\u63E1", "\u4E13\u5BB6"];
  if (banned.some((phrase) => normalized.toLowerCase().includes(phrase.toLowerCase()))) {
    throw new Error("L2 memory text contains an absolute claim");
  }
  return normalized;
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function normalizeIsoDate(value) {
  if (!value) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}
function incrementCount(target, key, amount = 1) {
  const safeKey = key || "unknown";
  target[safeKey] = (target[safeKey] ?? 0) + amount;
}
function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return Math.round(sorted[Math.max(0, index)]);
}
function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
function jsonArray(value) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
function searchTokens(value) {
  return (value ?? "").split(/[\s，,、\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function stableKnowledgeId(prefix, value) {
  return `${prefix}_${createHash2("sha1").update(value.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
}
function includesAny(text, candidates) {
  return candidates.find((candidate) => text.includes(candidate)) ?? "";
}
function inferKnowledgeSubject(text) {
  return includesAny(text, ["\u6570\u5B66", "\u82F1\u8BED", "\u8BED\u6587", "\u7269\u7406", "\u5316\u5B66", "\u751F\u7269", "\u5386\u53F2", "\u5730\u7406", "\u9053\u5FB7\u4E0E\u6CD5\u6CBB", "\u79D1\u5B66"]);
}
function inferKnowledgeGrade(text) {
  const direct = text.match(/(小学[一二三四五六]|[一二三四五六]年级|七年级|八年级|九年级|初[一二三]|高[一二三]|初中|高中)/);
  return direct?.[1] ?? "";
}
function inferKnowledgePoint(text) {
  const labeled = text.match(/(?:知识点|考点|主题|专题)[:：]\s*([^\n，,。；;]{2,24})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text, [
    "\u4E00\u6B21\u51FD\u6570",
    "\u4E8C\u6B21\u51FD\u6570",
    "\u53CD\u6BD4\u4F8B\u51FD\u6570",
    "\u65B9\u7A0B\u5E94\u7528\u9898",
    "\u5206\u5F0F\u65B9\u7A0B",
    "\u51E0\u4F55\u8BC1\u660E",
    "\u9605\u8BFB\u7406\u89E3",
    "\u5B8C\u5F62\u586B\u7A7A",
    "\u53E4\u8BD7\u9274\u8D4F",
    "\u7535\u8DEF\u5206\u6790",
    "\u5316\u5B66\u65B9\u7A0B\u5F0F"
  ]);
}
function inferQuestionType(text) {
  const labeled = text.match(/(?:题型|类型)[:：]\s*([^\n，,。；;]{2,16})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text, ["\u9009\u62E9\u9898", "\u586B\u7A7A\u9898", "\u89E3\u7B54\u9898", "\u5E94\u7528\u9898", "\u8BC1\u660E\u9898", "\u9605\u8BFB\u7406\u89E3", "\u5199\u4F5C\u9898"]);
}
function inferDifficulty(text) {
  if (/难度[:：]?\s*(hard|困难|较难|压轴)/i.test(text)) return "hard";
  if (/难度[:：]?\s*(easy|简单|基础|入门)/i.test(text)) return "easy";
  if (/难度[:：]?\s*(medium|中等|适中)/i.test(text)) return "medium";
  return "";
}
function containsPersonalData(text) {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text) || /(?<!\d)1[3-9]\d{9}(?!\d)/.test(text) || /(?<!\d)\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(text);
}
function inferResourceChunkMetadata(resourceTitle, heading, content) {
  const text = `${resourceTitle}
${heading}
${content}`;
  const subject = inferKnowledgeSubject(text);
  const grade = inferKnowledgeGrade(text);
  const knowledgePoint = inferKnowledgePoint(text);
  const questionType = inferQuestionType(text);
  const difficulty = inferDifficulty(text);
  const personal = containsPersonalData(text);
  const sourceTrust = personal ? "unverified" : "teacher_verified";
  const qualityScore = clampNumber(
    45 + (heading ? 10 : 0) + (content.trim().length >= 80 ? 10 : 0) + (subject ? 8 : 0) + (grade ? 6 : 0) + (knowledgePoint ? 10 : 0) + (questionType ? 6 : 0) - (personal ? 30 : 0),
    0,
    100
  );
  const evidenceStrength = personal ? "background" : qualityScore >= 78 ? "direct" : qualityScore >= 60 ? "indirect" : "background";
  return {
    subject,
    grade,
    knowledgePoint,
    questionType,
    difficulty,
    sourceTrust,
    containsPersonalData: personal,
    qualityScore,
    evidenceStrength
  };
}
function jsonObject(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}
function inputObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return jsonObject(value);
}
function jsonUnknownArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function parseAiConfirmationPayload(value) {
  const parsed = jsonObject(value);
  const exerciseSet = parseExerciseSetDraftPayload(parsed.exerciseSet);
  const rawAssessment = parsed.masteryAssessment && typeof parsed.masteryAssessment === "object" ? parsed.masteryAssessment : void 0;
  const rawPath = parsed.masteryPath && typeof parsed.masteryPath === "object" ? parsed.masteryPath : void 0;
  const masteryAssessment = rawAssessment?.knowledgePointId && rawAssessment.knowledgePointName ? {
    knowledgePointId: String(rawAssessment.knowledgePointId),
    knowledgePointName: String(rawAssessment.knowledgePointName),
    knowledgeType: rawAssessment.knowledgeType === "design" ? "design" : "concept",
    passed: rawAssessment.passed === true,
    feedback: String(rawAssessment.feedback ?? "")
  } : void 0;
  const masteryPath = rawPath && Array.isArray(rawPath.modules) ? { mode: rawPath.mode === "append" ? "append" : "replace", modules: rawPath.modules } : void 0;
  return {
    studentId: String(parsed.studentId ?? ""),
    subject: String(parsed.subject ?? ""),
    startDate: String(parsed.startDate ?? ""),
    endDate: String(parsed.endDate ?? ""),
    reportType: String(parsed.reportType ?? "ai_draft"),
    title: String(parsed.title ?? ""),
    contentMd: String(parsed.contentMd ?? ""),
    parentSummary: String(parsed.parentSummary ?? ""),
    sourceRecordIds: Array.isArray(parsed.sourceRecordIds) ? parsed.sourceRecordIds.map(String) : [],
    exerciseSet,
    masteryOperation: parsed.masteryOperation === "assess" || parsed.masteryOperation === "build" ? parsed.masteryOperation : void 0,
    masteryAssessment,
    masteryPath
  };
}
function normalizeDifficulty(value) {
  return value === "easy" || value === "hard" ? value : "medium";
}
function parseExerciseSetItems(value) {
  if (!Array.isArray(value)) return [];
  const items = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item;
    const role = row.role === "original" || row.role === "similar" || row.role === "variant" ? row.role : "variant";
    const stem = String(row.stem ?? "").trim();
    if (!stem) continue;
    items.push({
      role,
      questionId: String(row.questionId ?? "").trim() || void 0,
      sourceKind: row.sourceKind === "local_bank" || row.sourceKind === "teacher_resource" ? row.sourceKind : "generated",
      stem,
      answer: String(row.answer ?? "").trim(),
      analysis: String(row.analysis ?? "").trim(),
      knowledgePoint: String(row.knowledgePoint ?? "").trim(),
      difficulty: normalizeDifficulty(row.difficulty),
      teacherObservation: String(row.teacherObservation ?? "").trim()
    });
  }
  return items;
}
function parseExerciseSetDraftPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  const parsed = value;
  const title = String(parsed.title ?? "").trim();
  const contentMd = String(parsed.contentMd ?? "").trim();
  if (!title && !contentMd) return void 0;
  return {
    title,
    subject: String(parsed.subject ?? "").trim(),
    knowledgePoint: String(parsed.knowledgePoint ?? "").trim(),
    contentMd,
    items: parseExerciseSetItems(parsed.items),
    sourceQuestionIds: Array.isArray(parsed.sourceQuestionIds) ? parsed.sourceQuestionIds.map(String) : []
  };
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function redactPattern(text, pattern, token) {
  let count = 0;
  const sanitizedText = text.replace(pattern, () => {
    count += 1;
    return token;
  });
  return { sanitizedText, count };
}
function pushRedaction(redactions, kind, count) {
  if (count <= 0) return;
  const existing = redactions.find((item) => item.kind === kind);
  if (existing) existing.count += count;
  else redactions.push({ kind, count });
}
function parseMistakeImageRedactions(value) {
  return jsonUnknownArray(value).map((item) => {
    if (!item || typeof item !== "object") return null;
    const row = item;
    const kind = row.kind === "phone" || row.kind === "id_card" || row.kind === "student_name" || row.kind === "email" ? row.kind : void 0;
    const count = Number(row.count ?? 0);
    if (!kind || !Number.isFinite(count) || count <= 0) return null;
    return { kind, count: Math.trunc(count) };
  }).filter((item) => Boolean(item));
}
function fileType(fileName) {
  const ext = extname(fileName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "docx";
  if ([".ppt", ".pptx"].includes(ext)) return "pptx";
  if ([".xls", ".xlsx"].includes(ext)) return "xlsx";
  if ([".txt", ".md"].includes(ext)) return "txt";
  return "other";
}
function canParseAsLocalText(fileName) {
  return [".txt", ".md"].includes(extname(fileName).toLowerCase());
}
function titleFromFileName(fileName) {
  return basename(fileName, extname(fileName)).replace(/[_-]+/g, " ").trim() || fileName;
}
function splitIntoChunks(content, maxLength = 1200) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks = [];
  const sections = normalized.split(/\n(?=#{1,6}\s+)/g);
  for (const section of sections) {
    const heading = section.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() ?? "";
    let remaining = section.trim();
    while (remaining.length > maxLength) {
      chunks.push({ heading, content: remaining.slice(0, maxLength).trim() });
      remaining = remaining.slice(maxLength).trim();
    }
    if (remaining) chunks.push({ heading, content: remaining });
  }
  return chunks.slice(0, 80);
}
function formatDate(date) {
  return date.slice(0, 10);
}
function requireNonEmpty(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}
function normalizeLimit(value, defaultValue = DEFAULT_RECORD_PAGE_SIZE) {
  if (!Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(Math.trunc(value), MAX_RECORD_PAGE_SIZE));
}
function normalizeOffset(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}
function hasColumn(rows, columnName) {
  return rows.some((row) => String(row.name) === columnName);
}
function maskApiKey(apiKey) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "****";
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}
function documentMimeType(type) {
  if (type === "pdf") return "application/pdf";
  if (type === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/markdown";
}
function documentExtension(type) {
  if (type === "pdf") return ".pdf";
  if (type === "docx") return ".docx";
  return ".md";
}
function normalizeDocumentArtifactType(type) {
  if (type === "markdown" || type === "pdf" || type === "docx") return type;
  throw new Error("\u4E0D\u652F\u6301\u7684\u6587\u6863\u4EA7\u7269\u7C7B\u578B");
}
function sanitizeDocumentFileName(fileName, type) {
  const extension = documentExtension(type);
  const rawBase = basename(fileName || `xiazhi-artifact${extension}`, extname(fileName || ""));
  const safeBase = rawBase.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "xiazhi-artifact";
  return `${safeBase}${extension}`;
}
function markdownToPlainText(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "")).replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\[([^\]]+)]\([^)]+\)/g, "$1").replace(/[#>*_`~|-]+/g, " ").replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function utf16beHex(value) {
  const utf16le = Buffer.from(value, "utf16le");
  const bytes = Buffer.alloc(utf16le.length);
  for (let index = 0; index < utf16le.length; index += 2) {
    bytes[index] = utf16le[index + 1] ?? 0;
    bytes[index + 1] = utf16le[index] ?? 0;
  }
  return `FEFF${bytes.toString("hex").toUpperCase()}`;
}
function createPdfBuffer(title, markdown) {
  const lines = [`${title}`, ...markdownToPlainText(markdown).split("\n")].flatMap((line) => line.match(/.{1,44}/gu) ?? [""]).slice(0, 48);
  const commands = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    "16 TL",
    ...lines.map((line, index) => `${index === 0 ? "" : "T* "}<${utf16beHex(line)}> Tj`),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(commands, "utf8")} >>
stream
${commands}
endstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>"
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj
${objects[index]}
endobj
`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref
0 ${objects.length + 1}
`);
  chunks.push("0000000000 65535 f \n");
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n 
`);
  }
  chunks.push(`trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`);
  return Buffer.from(chunks.join(""), "utf8");
}
function crc32(buffer) {
  let crc = 4294967295;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >>> 1 ^ 3988292384 & -(crc & 1);
    }
  }
  return (crc ^ 4294967295) >>> 0;
}
function dosDateTime(date = /* @__PURE__ */ new Date()) {
  const dosTime = date.getHours() << 11 | date.getMinutes() << 5 | Math.floor(date.getSeconds() / 2);
  const dosDate = date.getFullYear() - 1980 << 9 | date.getMonth() + 1 << 5 | date.getDate();
  return { dosDate, dosTime };
}
function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(67324752, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(2048, 6);
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
    centralHeader.writeUInt32LE(33639248, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(2048, 8);
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
  end.writeUInt32LE(101010256, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFiles, centralDirectory, end]);
}
function markdownToDocxBlocks(title, markdown) {
  const blocks = [{ text: title, style: "Title" }];
  let inCode = false;
  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (!line.trim()) continue;
    if (inCode) {
      blocks.push({ text: line, style: "Code" });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ text: heading[2].replace(/[\*_`~]/g, ""), style: `Heading${heading[1].length}` });
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push({ text: bullet[1], style: "ListBullet" });
      continue;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({ text: numbered[1], style: "ListNumber" });
      continue;
    }
    const quote = line.match(/^\s*>\s+(.+)$/);
    blocks.push({ text: quote ? quote[1] : line, style: quote ? "Quote" : "Normal" });
  }
  return blocks;
}
function createDocxBuffer(title, markdown) {
  const paragraphs = markdownToDocxBlocks(title, markdown).map((block) => `<w:p><w:pPr><w:pStyle w:val="${block.style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(block.text)}</w:t></w:r></w:p>`).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F3F4F6"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:style>
</w:styles>`;
  return createZipBuffer([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`, "utf8")
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`, "utf8")
    },
    {
      name: "word/_rels/document.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`, "utf8")
    },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
    { name: "word/styles.xml", data: Buffer.from(stylesXml, "utf8") }
  ]);
}
function createDocumentBuffer(type, title, contentMd) {
  if (type === "markdown") return Buffer.from(contentMd, "utf8");
  if (type === "pdf") return createPdfBuffer(title, contentMd);
  return createDocxBuffer(title, contentMd);
}
function emptyTelemetrySnapshot() {
  return {
    generatedAt: "",
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
    usability: {
      sampleCount: 0,
      passedCount: 0,
      failedCount: 0,
      averageScore: 0,
      minScore: 0,
      profileCounts: {},
      issueCounts: {}
    },
    humanUsability: emptyHumanUsabilitySummary(),
    usabilityReplay: emptyUsabilityReplaySummary(),
    modelGrader: emptyModelGradeSummary()
  };
}
function emptyHumanUsabilitySummary() {
  return {
    sampleCount: 0,
    averageTeacherScore: 0,
    minTeacherScore: 0,
    passedCount: 0,
    needsRewriteCount: 0,
    averageRoundsToUseful: 0,
    routeCounts: {},
    issueCounts: {},
    latestReviewedAt: ""
  };
}
function emptyUsabilityReplaySummary() {
  return {
    experimentCount: 0,
    improvedCount: 0,
    unresolvedCount: 0,
    liveLinkedCount: 0,
    improvementRate: 0,
    averageScoreDelta: 0,
    averageRoundsDelta: 0,
    issueTransitionCounts: {},
    latestCreatedAt: ""
  };
}
function emptyModelGradeSummary() {
  return {
    sampleCount: 0,
    passedCount: 0,
    failedCount: 0,
    averageOverallScore: 0,
    minOverallScore: 0,
    averageGradeAppropriatenessScore: 0,
    runLinkedCount: 0,
    tokenKnownCount: 0,
    issueCounts: {},
    graderModeCounts: {},
    promptVersionCounts: {},
    latestReviewedAt: ""
  };
}
function parseTelemetrySnapshot(value) {
  const parsed = jsonObject(value);
  const latency = parsed.latency && typeof parsed.latency === "object" && !Array.isArray(parsed.latency) ? parsed.latency : {};
  const tokenBudget = parsed.tokenBudget && typeof parsed.tokenBudget === "object" && !Array.isArray(parsed.tokenBudget) ? parsed.tokenBudget : {};
  const contextBudget = parsed.contextBudget && typeof parsed.contextBudget === "object" && !Array.isArray(parsed.contextBudget) ? parsed.contextBudget : {};
  const usability = parsed.usability && typeof parsed.usability === "object" && !Array.isArray(parsed.usability) ? parsed.usability : {};
  const humanUsability = parsed.humanUsability && typeof parsed.humanUsability === "object" && !Array.isArray(parsed.humanUsability) ? parsed.humanUsability : {};
  const usabilityReplay = parsed.usabilityReplay && typeof parsed.usabilityReplay === "object" && !Array.isArray(parsed.usabilityReplay) ? parsed.usabilityReplay : {};
  const modelGrader = parsed.modelGrader && typeof parsed.modelGrader === "object" && !Array.isArray(parsed.modelGrader) ? parsed.modelGrader : {};
  const windowValue = parsed.window && typeof parsed.window === "object" && !Array.isArray(parsed.window) ? parsed.window : {};
  const counts = (raw) => raw && typeof raw === "object" && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw).map(([key, value2]) => [key, toNumber(value2)])) : {};
  return {
    generatedAt: String(parsed.generatedAt ?? ""),
    window: {
      since: windowValue.since ? String(windowValue.since) : void 0,
      until: windowValue.until ? String(windowValue.until) : void 0
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
      p95Ms: toNumber(latency.p95Ms)
    },
    tokenBudget: {
      promptTokens: toNumber(tokenBudget.promptTokens),
      completionTokens: toNumber(tokenBudget.completionTokens),
      totalTokens: toNumber(tokenBudget.totalTokens),
      knownTaskCount: toNumber(tokenBudget.knownTaskCount)
    },
    contextBudget: {
      sourceCount: toNumber(contextBudget.sourceCount),
      knowledgeSnippetCount: toNumber(contextBudget.knowledgeSnippetCount),
      graphNodeCount: toNumber(contextBudget.graphNodeCount),
      taskCount: toNumber(contextBudget.taskCount)
    },
    usability: {
      sampleCount: toNumber(usability.sampleCount),
      passedCount: toNumber(usability.passedCount),
      failedCount: toNumber(usability.failedCount),
      averageScore: toNumber(usability.averageScore),
      minScore: toNumber(usability.minScore),
      profileCounts: counts(usability.profileCounts),
      issueCounts: counts(usability.issueCounts)
    },
    humanUsability: {
      sampleCount: toNumber(humanUsability.sampleCount),
      averageTeacherScore: toNumber(humanUsability.averageTeacherScore),
      minTeacherScore: toNumber(humanUsability.minTeacherScore),
      passedCount: toNumber(humanUsability.passedCount),
      needsRewriteCount: toNumber(humanUsability.needsRewriteCount),
      averageRoundsToUseful: toNumber(humanUsability.averageRoundsToUseful),
      routeCounts: counts(humanUsability.routeCounts),
      issueCounts: counts(humanUsability.issueCounts),
      latestReviewedAt: String(humanUsability.latestReviewedAt ?? "")
    },
    usabilityReplay: {
      experimentCount: toNumber(usabilityReplay.experimentCount),
      improvedCount: toNumber(usabilityReplay.improvedCount),
      unresolvedCount: toNumber(usabilityReplay.unresolvedCount),
      liveLinkedCount: toNumber(usabilityReplay.liveLinkedCount),
      improvementRate: toNumber(usabilityReplay.improvementRate),
      averageScoreDelta: toNumber(usabilityReplay.averageScoreDelta),
      averageRoundsDelta: toNumber(usabilityReplay.averageRoundsDelta),
      issueTransitionCounts: counts(usabilityReplay.issueTransitionCounts),
      latestCreatedAt: String(usabilityReplay.latestCreatedAt ?? "")
    },
    modelGrader: {
      sampleCount: toNumber(modelGrader.sampleCount),
      passedCount: toNumber(modelGrader.passedCount),
      failedCount: toNumber(modelGrader.failedCount),
      averageOverallScore: toNumber(modelGrader.averageOverallScore),
      minOverallScore: toNumber(modelGrader.minOverallScore),
      averageGradeAppropriatenessScore: toNumber(modelGrader.averageGradeAppropriatenessScore),
      runLinkedCount: toNumber(modelGrader.runLinkedCount),
      tokenKnownCount: toNumber(modelGrader.tokenKnownCount),
      issueCounts: counts(modelGrader.issueCounts),
      graderModeCounts: counts(modelGrader.graderModeCounts),
      promptVersionCounts: counts(modelGrader.promptVersionCounts),
      latestReviewedAt: String(modelGrader.latestReviewedAt ?? "")
    }
  };
}
function parseRegressionGates(value) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object").map((item) => {
      const gate = item;
      const status = String(gate.status ?? "warning");
      return {
        id: String(gate.id ?? ""),
        label: String(gate.label ?? ""),
        status: status === "passed" || status === "failed" || status === "warning" ? status : "warning",
        detail: String(gate.detail ?? ""),
        evidence: gate.evidence && typeof gate.evidence === "object" && !Array.isArray(gate.evidence) ? gate.evidence : {}
      };
    });
  } catch {
    return [];
  }
}
var OmniEduStore = class {
  constructor(dataRoot) {
    this.dataRoot = dataRoot;
    this.dbPath = join(dataRoot, "app.db");
  }
  db;
  dbPath;
  /**
   * Event sequence allocation is a read-then-write operation.  Sidecar events,
   * host checkpoints, and model observations can arrive concurrently for one
   * run, so serialize only that run's allocation instead of relying on a
   * racy MAX(sequence) query.
   */
  aiAgentEventLocks = /* @__PURE__ */ new Map();
  continuationClaimQueue = Promise.resolve();
  aiAgentActionQueue = Promise.resolve();
  async init() {
    mkdirSync(this.dataRoot, { recursive: true });
    mkdirSync(this.resolveInsideDataRoot("students"), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot("teacher_resources"), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot("cache", "thumbnails"), { recursive: true });
    if (!this.db) {
      this.db = await this.openDatabase(this.dbPath);
    }
    await this.migrate();
    await this.seedIfEmpty();
    return {
      dataRoot: this.dataRoot,
      students: await this.listStudents(""),
      overview: await this.getPlatformOverview()
    };
  }
  getDataRoot() {
    return this.dataRoot;
  }
  async close() {
    if (!this.db) return;
    const db = this.db;
    await new Promise((resolveClose, reject) => {
      db.close((error) => {
        if (error) reject(error);
        else resolveClose();
      });
    });
    this.db = void 0;
  }
  async isManagedLocalPath(filePath) {
    return isInsideRoot(this.dataRoot, filePath);
  }
  getStudentFolder(studentId) {
    return this.studentRoot(studentId);
  }
  async getPlatformOverview() {
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
      totalAttachments
    ] = await Promise.all([
      this.scalarCount("tag_dictionary"),
      this.scalarCount("report_templates"),
      this.scalarCount("sync_operations", `sync_status != 'succeeded'`),
      this.scalarCount("ai_tasks", `status IN ('pending', 'running', 'retrying')`),
      this.scalarCount("users"),
      this.scalarCount("teacher_student_assignments"),
      this.scalarCount("students", `status = 'active'`),
      this.scalarCount("learning_records"),
      this.scalarCount("review_reports"),
      this.scalarCount("attachments")
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
        totalAttachments
      }
    };
  }
  async getDeepSeekSettings() {
    const runtime = await this.getDeepSeekRuntimeSettings();
    return {
      configured: Boolean(runtime.apiKey),
      model: runtime.model,
      maskedApiKey: maskApiKey(runtime.apiKey),
      updatedAt: runtime.updatedAt
    };
  }
  async getDeepSeekRuntimeSettings() {
    const row = (await this.all(`SELECT value_json, updated_at FROM app_settings WHERE key = 'deepseek'`))[0];
    if (!row) {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: ""
      };
    }
    try {
      const parsed = JSON.parse(String(row.value_json));
      return {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : process.env.DEEPSEEK_API_KEY,
        model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? "")
      };
    } catch {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? "")
      };
    }
  }
  async saveDeepSeekSettings(input) {
    const existing = await this.getDeepSeekRuntimeSettings();
    const apiKey = input.apiKey?.trim() || existing.apiKey || "";
    const model = input.model?.trim() || existing.model || DEFAULT_DEEPSEEK_MODEL;
    const timestamp = now();
    await this.run(
      `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at)
       VALUES ('deepseek', ?, ?)`,
      [JSON.stringify({ apiKey, model }), timestamp]
    );
    return this.getDeepSeekSettings();
  }
  async listStudents(query = "") {
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
      [like, like, like, like, like]
    );
    return rows.map(this.mapStudent);
  }
  async createStudent(input) {
    const displayName = requireNonEmpty(input.displayName, "\u5B66\u751F\u663E\u793A\u540D\u4E0D\u80FD\u4E3A\u7A7A");
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
        input.realName ?? "",
        input.grade ?? "",
        input.school ?? "",
        JSON.stringify(input.subjects ?? []),
        input.goals ?? "",
        input.currentIssues ?? "",
        input.parentConcerns ?? "",
        input.teacherNotes ?? "",
        JSON.stringify(input.tags ?? []),
        timestamp,
        timestamp
      ]
    );
    mkdirSync(this.studentRoot(id), { recursive: true });
    return this.listStudents("");
  }
  async updateStudent(id, input) {
    const displayName = requireNonEmpty(input.displayName, "\u5B66\u751F\u663E\u793A\u540D\u4E0D\u80FD\u4E3A\u7A7A");
    await this.run(
      `UPDATE students
          SET display_name = ?, real_name = ?, grade = ?, school = ?, subjects = ?,
              goals = ?, current_issues = ?, parent_concerns = ?, teacher_notes = ?,
              tags = ?, updated_at = ?
        WHERE id = ?`,
      [
        displayName,
        input.realName ?? "",
        input.grade ?? "",
        input.school ?? "",
        JSON.stringify(input.subjects ?? []),
        input.goals ?? "",
        input.currentIssues ?? "",
        input.parentConcerns ?? "",
        input.teacherNotes ?? "",
        JSON.stringify(input.tags ?? []),
        now(),
        id
      ]
    );
    return this.listStudents("");
  }
  async archiveStudent(id) {
    await this.run(`UPDATE students SET status = 'archived', updated_at = ? WHERE id = ?`, [now(), id]);
    return this.listStudents("");
  }
  async listRecords(studentId, filters = {}) {
    const params = [studentId];
    let where = "WHERE student_id = ?";
    if (filters.type) {
      where += " AND record_type = ?";
      params.push(filters.type);
    }
    if (filters.subject?.trim()) {
      where += " AND subject = ?";
      params.push(filters.subject.trim());
    }
    if (filters.tag?.trim()) {
      where += " AND tags LIKE ?";
      params.push(`%${filters.tag.trim()}%`);
    }
    if (filters.startDate) {
      where += " AND occurred_at >= ?";
      params.push((/* @__PURE__ */ new Date(`${filters.startDate}T00:00:00`)).toISOString());
    }
    if (filters.endDate) {
      where += " AND occurred_at <= ?";
      params.push((/* @__PURE__ */ new Date(`${filters.endDate}T23:59:59`)).toISOString());
    }
    const keyword = filters.keyword?.trim();
    if (keyword) {
      const ftsIds = await this.searchRecordIdsByFts(keyword, studentId);
      if (ftsIds) {
        if (!ftsIds.length) return [];
        where += ` AND id IN (${ftsIds.map(() => "?").join(",")})`;
        params.push(...ftsIds);
      } else {
        where += " AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)";
        const like = `%${keyword}%`;
        params.push(like, like, like);
      }
    }
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);
    const records = (await this.all(
      `SELECT * FROM learning_records ${where} ORDER BY occurred_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )).map((row) => this.mapRecord(row));
    return this.withAttachments(records);
  }
  async createRecord(input) {
    const title = requireNonEmpty(input.title, "\u5B66\u4E60\u8BB0\u5F55\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
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
        input.subject ?? "",
        title,
        input.content ?? "",
        JSON.stringify(input.tags ?? []),
        input.occurredAt || timestamp,
        timestamp,
        timestamp
      ]
    );
    await this.touchStudent(input.studentId);
    await this.upsertRecordFts(id);
    mkdirSync(this.resolveInsideDataRoot("students", input.studentId, "records", id, "attachments"), { recursive: true });
    return this.listRecords(input.studentId);
  }
  async updateRecord(recordId, input) {
    const title = requireNonEmpty(input.title, "\u5B66\u4E60\u8BB0\u5F55\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    const record = (await this.all(`SELECT student_id FROM learning_records WHERE id = ?`, [recordId]))[0];
    if (!record) throw new Error("\u5B66\u4E60\u8BB0\u5F55\u4E0D\u5B58\u5728");
    const studentId = String(record.student_id);
    await this.run(
      `UPDATE learning_records
          SET record_type = ?, subject = ?, title = ?, content = ?, tags = ?, occurred_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.recordType,
        input.subject ?? "",
        title,
        input.content ?? "",
        JSON.stringify(input.tags ?? []),
        input.occurredAt || now(),
        now(),
        recordId
      ]
    );
    await this.touchStudent(studentId);
    await this.upsertRecordFts(recordId);
    return this.listRecords(studentId);
  }
  async createTeacherNotebook(input) {
    const name = requireNonEmpty(input.name, "\u6559\u5E08\u5907\u8BFE\u672C\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 160);
    const id = `notebook_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO teacher_notebooks (id, name, description, color, icon, status, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, '')`,
      [id, name, String(input.description ?? "").trim().slice(0, 2e3), String(input.color ?? "#3B82F6").slice(0, 32), String(input.icon ?? "book").slice(0, 64), timestamp, timestamp]
    );
    return this.getTeacherNotebookOrThrow(id);
  }
  async listTeacherNotebooks(includeDeleted = false) {
    const rows = await this.all(
      `SELECT n.*, COUNT(r.id) AS record_count
         FROM teacher_notebooks n
         LEFT JOIN teacher_notebook_records r ON r.notebook_id = n.id AND r.deleted_at = ''
        ${includeDeleted ? "" : `WHERE n.status = 'active'`}
        GROUP BY n.id
        ORDER BY n.updated_at DESC`
    );
    return rows.map((row) => this.mapTeacherNotebook(row));
  }
  async updateTeacherNotebook(id, input) {
    const version = Math.max(1, Math.trunc(Number(input.version)));
    const timestamp = now();
    const result = await this.runWithChanges(
      `UPDATE teacher_notebooks
          SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color), icon = COALESCE(?, icon), version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'active' AND version = ?`,
      [input.name == null ? null : requireNonEmpty(input.name, "\u6559\u5E08\u5907\u8BFE\u672C\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 160), input.description == null ? null : String(input.description).trim().slice(0, 2e3), input.color == null ? null : String(input.color).slice(0, 32), input.icon == null ? null : String(input.icon).slice(0, 64), timestamp, id, version]
    );
    if (!result) throw new Error("\u5907\u8BFE\u672C\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
    return this.getTeacherNotebookOrThrow(id);
  }
  async deleteTeacherNotebook(id) {
    const timestamp = now();
    const changed = await this.runWithChanges(`UPDATE teacher_notebooks SET status = 'deleted', version = version + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND status = 'active'`, [timestamp, timestamp, id]);
    if (!changed) throw new Error("\u5907\u8BFE\u672C\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664");
    return this.getTeacherNotebookOrThrow(id);
  }
  async restoreTeacherNotebook(id) {
    const changed = await this.runWithChanges(`UPDATE teacher_notebooks SET status = 'active', version = version + 1, updated_at = ?, deleted_at = '' WHERE id = ? AND status = 'deleted'`, [now(), id]);
    if (!changed) throw new Error("\u5907\u8BFE\u672C\u4E0D\u5B58\u5728\u6216\u672A\u5220\u9664");
    return this.getTeacherNotebookOrThrow(id);
  }
  async listTeacherNotebookRecords(notebookId, includeDeleted = false) {
    const rows = await this.all(`SELECT * FROM teacher_notebook_records WHERE notebook_id = ? ${includeDeleted ? "" : `AND deleted_at = ''`} ORDER BY created_at ASC`, [notebookId]);
    return rows.map((row) => this.mapTeacherNotebookRecord(row));
  }
  async addTeacherNotebookRecord(input) {
    const notebook = await this.getTeacherNotebook(input.notebookId);
    if (!notebook || notebook.status !== "active") throw new Error("\u5907\u8BFE\u672C\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664");
    const allowedTypes = /* @__PURE__ */ new Set(["solve", "question", "research", "chat", "co_writer", "tutorbot", "guided_learning"]);
    if (!allowedTypes.has(input.recordType)) throw new Error("\u4E0D\u652F\u6301\u7684\u5907\u8BFE\u672C\u8BB0\u5F55\u7C7B\u578B");
    const id = `notebook_record_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO teacher_notebook_records (id, notebook_id, record_type, title, summary, user_query, output, metadata_json, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, '')`,
      [id, input.notebookId, input.recordType, requireNonEmpty(input.title, "\u7B14\u8BB0\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 240), String(input.summary ?? "").trim().slice(0, 2e3), String(input.userQuery ?? "").trim().slice(0, 4e3), String(input.output ?? "").slice(0, 1e5), JSON.stringify(input.metadata ?? {}), timestamp, timestamp]
    );
    await this.run(`UPDATE teacher_notebooks SET version = version + 1, updated_at = ? WHERE id = ?`, [timestamp, input.notebookId]);
    return this.getTeacherNotebookRecordOrThrow(id);
  }
  async updateTeacherNotebookRecord(id, input) {
    const version = Math.max(1, Math.trunc(Number(input.version)));
    const changed = await this.runWithChanges(
      `UPDATE teacher_notebook_records
          SET record_type = COALESCE(?, record_type), title = COALESCE(?, title), summary = COALESCE(?, summary), user_query = COALESCE(?, user_query), output = COALESCE(?, output), metadata_json = COALESCE(?, metadata_json), version = version + 1, updated_at = ?
        WHERE id = ? AND deleted_at = '' AND version = ?`,
      [input.recordType ?? null, input.title == null ? null : requireNonEmpty(input.title, "\u7B14\u8BB0\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 240), input.summary == null ? null : String(input.summary).trim().slice(0, 2e3), input.userQuery == null ? null : String(input.userQuery).trim().slice(0, 4e3), input.output == null ? null : String(input.output).slice(0, 1e5), input.metadata == null ? null : JSON.stringify(input.metadata), now(), id, version]
    );
    if (!changed) throw new Error("\u7B14\u8BB0\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
    return this.getTeacherNotebookRecordOrThrow(id);
  }
  async deleteTeacherNotebookRecord(id) {
    const timestamp = now();
    const row = (await this.all(`SELECT notebook_id FROM teacher_notebook_records WHERE id = ? AND deleted_at = ''`, [id]))[0];
    if (!row) throw new Error("\u7B14\u8BB0\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664");
    await this.run(`UPDATE teacher_notebook_records SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at = ''`, [timestamp, timestamp, id]);
    await this.run(`UPDATE teacher_notebooks SET version = version + 1, updated_at = ? WHERE id = ?`, [timestamp, String(row.notebook_id)]);
    return this.getTeacherNotebookRecordOrThrow(id);
  }
  async importAttachments(studentId, recordId, sourcePaths) {
    const attachmentRoot = this.resolveInsideDataRoot("students", studentId, "records", recordId, "attachments");
    mkdirSync(attachmentRoot, { recursive: true });
    const items = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error("\u4E0D\u662F\u53EF\u5BFC\u5165\u7684\u6587\u4EF6");
        const id = `attachment_${randomUUID()}`;
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(attachmentRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        await this.run(
          `INSERT INTO attachments (
            id, student_id, record_id, file_name, file_path, file_type, file_size, content_hash, extracted_text, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
          [id, studentId, recordId, originalName, targetPath, fileType(originalName), stat.size, hash, now()]
        );
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : "\u9644\u4EF6\u590D\u5236\u5931\u8D25"
        });
      }
    }
    await this.touchStudent(studentId);
    const failed = items.filter((item) => !item.ok).length;
    const status = failed === 0 ? "succeeded" : failed === items.length ? "failed" : "partial";
    return { status, records: await this.listRecords(studentId), items };
  }
  async sanitizeProblemText(text, studentId) {
    const redactions = [];
    let sanitizedText = text;
    let result = redactPattern(sanitizedText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[\u90AE\u7BB1]");
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, "email", result.count);
    result = redactPattern(sanitizedText, /(?<!\d)1[3-9]\d{9}(?!\d)/g, "[\u624B\u673A\u53F7]");
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, "phone", result.count);
    result = redactPattern(sanitizedText, /(?<![0-9A-Za-z])\d{17}[\dXx](?![0-9A-Za-z])/g, "[\u8EAB\u4EFD\u8BC1\u53F7]");
    sanitizedText = result.sanitizedText;
    pushRedaction(redactions, "id_card", result.count);
    if (studentId) {
      const student = (await this.listStudents("")).find((item) => item.id === studentId);
      const names = [...new Set([student?.displayName, student?.realName].filter((name) => Boolean(name?.trim())))].filter((name) => name.length >= 2);
      for (const name of names) {
        result = redactPattern(sanitizedText, new RegExp(escapeRegExp(name), "g"), "[\u5B66\u751F\u59D3\u540D]");
        sanitizedText = result.sanitizedText;
        pushRedaction(redactions, "student_name", result.count);
      }
    }
    return {
      sanitizedText,
      redactions,
      containsSensitiveData: redactions.some((item) => item.count > 0)
    };
  }
  async createMistakeImageAnalysis(input) {
    const studentId = requireNonEmpty(input.studentId, "\u9519\u9898\u56FE\u7247\u89E3\u6790\u7F3A\u5C11\u5B66\u751F ID");
    const student = (await this.listStudents("")).find((item) => item.id === studentId);
    if (!student) throw new Error("\u5B66\u751F\u4E0D\u5B58\u5728");
    const attachment = input.attachmentId ? (await this.all(`SELECT * FROM attachments WHERE id = ? AND student_id = ?`, [input.attachmentId, studentId]))[0] : void 0;
    if (input.attachmentId && !attachment) throw new Error("\u9644\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u8BE5\u5B66\u751F");
    const recordId = input.recordId ?? (attachment ? String(attachment.record_id ?? "") : "");
    const attachmentId = input.attachmentId ?? "";
    const localPath = input.localPath ?? (attachment ? String(attachment.file_path ?? "") : "");
    if (localPath && !await this.isManagedLocalPath(localPath)) {
      throw new Error("\u9519\u9898\u56FE\u7247\u8DEF\u5F84\u5FC5\u987B\u4F4D\u4E8E\u672C\u5730\u6570\u636E\u76EE\u5F55\u5185");
    }
    if (localPath) {
      const localType = fileType(localPath);
      if (localType !== "image") throw new Error("\u9519\u9898\u56FE\u7247\u89E3\u6790\u53EA\u63A5\u53D7\u56FE\u7247\u9644\u4EF6");
    }
    const extractedText = input.extractedText?.trim() ?? "";
    const sanitized = extractedText ? await this.sanitizeProblemText(extractedText, studentId) : {
      sanitizedText: "",
      redactions: [],
      containsSensitiveData: false
    };
    const status = extractedText ? "sanitized" : "needs_ocr";
    const timestamp = now();
    const analysis = {
      id: `mistake_image_${randomUUID()}`,
      studentId,
      recordId,
      attachmentId,
      localPath,
      ocrStatus: status,
      extractedText,
      sanitizedText: sanitized.sanitizedText,
      redactions: sanitized.redactions,
      teacherCorrectedText: "",
      errorMessage: "",
      createdAt: timestamp,
      updatedAt: timestamp
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
        analysis.updatedAt
      ]
    );
    if (attachmentId && extractedText) {
      await this.run(`UPDATE attachments SET extracted_text = ? WHERE id = ?`, [extractedText, attachmentId]);
    }
    await this.touchStudent(studentId);
    return analysis;
  }
  async updateMistakeImageCorrection(id, input) {
    const existing = await this.getMistakeImageAnalysisOrThrow(id);
    const correctedText = requireNonEmpty(input.extractedText, "\u8001\u5E08\u4FEE\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
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
      [correctedText, sanitized.sanitizedText, JSON.stringify(sanitized.redactions), correctedText, timestamp, id]
    );
    if (existing.attachmentId) {
      await this.run(`UPDATE attachments SET extracted_text = ? WHERE id = ?`, [correctedText, existing.attachmentId]);
    }
    await this.touchStudent(existing.studentId);
    return this.getMistakeImageAnalysisOrThrow(id);
  }
  async listMistakeImageAnalyses(studentId) {
    const rows = await this.all(
      `SELECT * FROM mistake_image_analyses WHERE student_id = ? ORDER BY updated_at DESC`,
      [studentId]
    );
    return rows.map((row) => this.mapMistakeImageAnalysis(row));
  }
  async getKnowledgeOverview() {
    const resources = (await this.all(
      `SELECT r.*,
              COUNT(c.id) AS chunk_count
         FROM teacher_resources r
         LEFT JOIN resource_chunks c ON c.resource_id = r.id
        GROUP BY r.id
        ORDER BY r.updated_at DESC
        LIMIT 100`
    )).map(this.mapTeacherResource);
    const chunks = (await this.all(
      `SELECT c.*, r.title AS resource_title
         FROM resource_chunks c
         JOIN teacher_resources r ON r.id = c.resource_id
        ORDER BY c.quality_score DESC, c.created_at DESC, c.chunk_index ASC
        LIMIT 24`
    )).map(this.mapResourceChunk);
    const nodes = (await this.all(
      `SELECT * FROM knowledge_nodes ORDER BY confidence DESC, updated_at DESC LIMIT 80`
    )).map(this.mapKnowledgeNode);
    const edges = (await this.all(
      `SELECT * FROM knowledge_edges ORDER BY confidence DESC, created_at DESC LIMIT 120`
    )).map(this.mapKnowledgeEdge);
    const [resourceCount, parsedResources, chunkCount, nodeCount, edgeCount, queuedTasks] = await Promise.all([
      this.scalarCount("teacher_resources"),
      this.scalarCount("teacher_resources", `parse_status IN ('parsed', 'chunked', 'indexed', 'graph_extracted', 'ready')`),
      this.scalarCount("resource_chunks"),
      this.scalarCount("knowledge_nodes"),
      this.scalarCount("knowledge_edges"),
      this.scalarCount("ai_tasks", `task_type IN ('resource_parse', 'ocr_extract', 'embedding_build') AND status IN ('pending', 'running', 'retrying')`)
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
        queuedTasks
      }
    };
  }
  async importKnowledgeResources(sourcePaths) {
    const resourceRoot = this.resolveInsideDataRoot("teacher_resources");
    mkdirSync(resourceRoot, { recursive: true });
    const items = [];
    const resources = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error("\u4E0D\u662F\u53EF\u5BFC\u5165\u7684\u6587\u4EF6");
        const id = `resource_${randomUUID()}`;
        const timestamp = now();
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(resourceRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        const resourceType = fileType(originalName);
        const isText = canParseAsLocalText(originalName);
        const title = titleFromFileName(originalName);
        const parseStatus = isText ? "ready" : "needs_parser";
        const parseEngine = isText ? "local-text" : "Docling/MinerU \u5F85\u63A5\u5165";
        await this.run(
          `INSERT INTO teacher_resources (
            id, title, resource_type, original_file_name, local_path, file_size,
            content_hash, parse_status, parse_engine, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, title, resourceType, originalName, targetPath, stat.size, hash, parseStatus, parseEngine, timestamp, timestamp]
        );
        await this.ensureTeacherLibraryNode();
        await this.createResourceGraph(id, title, resourceType, stat.size, timestamp);
        if (isText) {
          const text = readFileSync(targetPath, "utf8");
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
          [id]
        ))[0];
        resources.push(this.mapTeacherResource(saved));
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : "\u77E5\u8BC6\u8D44\u6E90\u5BFC\u5165\u5931\u8D25"
        });
      }
    }
    const failed = items.filter((item) => !item.ok).length;
    const status = items.length === 0 ? "canceled" : failed === 0 ? "succeeded" : failed === items.length ? "failed" : "partial";
    return { status, resources, items, overview: await this.getKnowledgeOverview() };
  }
  async searchKnowledge(keyword, limit = 8) {
    const trimmed = keyword.trim();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
    if (!trimmed) {
      return (await this.all(
        `SELECT c.*, r.title AS resource_title
           FROM resource_chunks c
           JOIN teacher_resources r ON r.id = c.resource_id
          ORDER BY c.quality_score DESC, c.created_at DESC, c.chunk_index ASC
          LIMIT ?`,
        [boundedLimit]
      )).map(this.mapResourceChunk);
    }
    const tokens = searchTokens(trimmed);
    const clauses = tokens.length ? tokens.map(() => `(
          c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?
          OR c.subject LIKE ? OR c.grade LIKE ? OR c.knowledge_point LIKE ? OR c.question_type LIKE ?
        )`) : ["(c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?)"];
    const params = [];
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
        WHERE ${clauses.join(" OR ")}
        ORDER BY
          CASE WHEN c.contains_personal_data = 1 THEN 1 ELSE 0 END,
          c.quality_score DESC,
          c.created_at DESC,
          c.chunk_index ASC
        LIMIT ?`,
      [...params, boundedLimit]
    )).map(this.mapResourceChunk);
  }
  async recordAiConsoleRun(input, result) {
    const timestamp = now();
    const taskId = `task_${randomUUID()}`;
    const inputHash = createHash2("sha256").update(input.prompt.trim()).digest("hex");
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'ai_console', ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        taskId,
        result.ok ? "succeeded" : "failed",
        inputHash,
        JSON.stringify({
          studentId: input.studentId ?? "",
          timeRange: input.timeRange ?? "",
          knowledgeScope: input.knowledgeScope ?? "",
          model: result.model,
          sourceCount: result.sources.length,
          knowledgeSnippetCount: result.knowledgeSnippets?.length ?? 0,
          graphNodeCount: result.graphNodes?.length ?? 0
        }),
        JSON.stringify({
          ok: result.ok,
          agentRunId: result.harness?.agentRunId ?? "",
          usage: result.usage ?? null,
          schemaValid: result.harness?.schemaValid ?? null,
          educationGrade: result.harness?.educationGrade ?? null,
          usabilityGrade: result.harness?.usabilityGrade ?? null,
          contentPreview: result.content.slice(0, 160)
        }),
        result.errorMessage ?? "",
        timestamp,
        timestamp
      ]
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
            graphNodeIds: (result.graphNodes ?? []).map((node) => node.id).slice(0, 8)
          }),
          tool.status,
          timestamp
        ]
      );
    }
  }
  async createAiUsabilityReview(input) {
    const timestamp = now();
    const sampleId = input.sampleId?.trim();
    const prompt = input.prompt?.trim();
    const route = String(input.route ?? "").trim();
    const subIntent = String(input.subIntent ?? "").trim();
    const teacherScore = Math.round(Number(input.teacherScore));
    const roundsToUseful = Math.round(Number(input.roundsToUseful));
    const reviewedAt = normalizeIsoDate(input.reviewedAt) || timestamp;
    if (!sampleId) throw new Error("sampleId is required for AI usability human review");
    if (!prompt) throw new Error("prompt is required for AI usability human review");
    if (!route) throw new Error("route is required for AI usability human review");
    if (!subIntent) throw new Error("subIntent is required for AI usability human review");
    if (!Number.isFinite(teacherScore) || teacherScore < 1 || teacherScore > 5) {
      throw new Error("teacherScore must be an integer from 1 to 5");
    }
    if (!Number.isFinite(roundsToUseful) || roundsToUseful < 1 || roundsToUseful > 12) {
      throw new Error("roundsToUseful must be an integer from 1 to 12");
    }
    const review = {
      id: `aireview_${randomUUID()}`,
      sampleId,
      runId: input.runId?.trim() ?? "",
      sessionId: input.sessionId?.trim() ?? "",
      prompt,
      route,
      subIntent,
      model: input.model?.trim() ?? "",
      teacherScore,
      needsRewrite: Boolean(input.needsRewrite),
      roundsToUseful,
      mainIssueCode: input.mainIssueCode?.trim() || (input.needsRewrite ? "unspecified" : "none"),
      teacherNote: input.teacherNote?.trim() ?? "",
      reviewedAt,
      createdAt: timestamp
    };
    await this.run(
      `INSERT INTO ai_usability_reviews (
          id, sample_id, run_id, session_id, prompt, route, sub_intent, model,
          teacher_score, needs_rewrite, rounds_to_useful, main_issue_code, teacher_note,
          reviewed_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.sampleId,
        review.runId,
        review.sessionId,
        review.prompt,
        review.route,
        review.subIntent,
        review.model,
        review.teacherScore,
        review.needsRewrite ? 1 : 0,
        review.roundsToUseful,
        review.mainIssueCode,
        review.teacherNote,
        review.reviewedAt,
        review.createdAt
      ]
    );
    const row = (await this.all(`SELECT * FROM ai_usability_reviews WHERE id = ?`, [review.id]))[0];
    return this.mapAiUsabilityReview(row);
  }
  async listAiUsabilityReviews(limit = 100) {
    const boundedLimit = clampNumber(Math.round(Number(limit) || 100), 1, 500);
    const rows = await this.all(
      `SELECT * FROM ai_usability_reviews ORDER BY reviewed_at DESC, created_at DESC LIMIT ?`,
      [boundedLimit]
    );
    return rows.map((row) => this.mapAiUsabilityReview(row));
  }
  async getAiUsabilityReview(id) {
    const row = (await this.all(`SELECT * FROM ai_usability_reviews WHERE id = ?`, [id]))[0];
    return row ? this.mapAiUsabilityReview(row) : null;
  }
  async buildAiUsabilityReviewSummary(input = {}) {
    const since = normalizeIsoDate(input.since);
    const until = normalizeIsoDate(input.until);
    const clauses = [];
    const params = [];
    if (since) {
      clauses.push("reviewed_at >= ?");
      params.push(since);
    }
    if (until) {
      clauses.push("reviewed_at <= ?");
      params.push(until);
    }
    const rows = await this.all(
      `SELECT * FROM ai_usability_reviews${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}
       ORDER BY reviewed_at DESC, created_at DESC`,
      params
    );
    const summary = emptyHumanUsabilitySummary();
    const scores = [];
    const rounds = [];
    for (const row of rows) {
      const score = toNumber(row.teacher_score);
      const roundCount = toNumber(row.rounds_to_useful);
      summary.sampleCount += 1;
      scores.push(score);
      rounds.push(roundCount);
      if (score >= 4 && Number(row.needs_rewrite ?? 0) !== 1) summary.passedCount += 1;
      if (Number(row.needs_rewrite ?? 0) === 1) summary.needsRewriteCount += 1;
      incrementCount(summary.routeCounts, String(row.route ?? "unknown"));
      incrementCount(summary.issueCounts, String(row.main_issue_code ?? "unknown"));
      const reviewedAt = String(row.reviewed_at ?? "");
      if (!summary.latestReviewedAt || reviewedAt > summary.latestReviewedAt) summary.latestReviewedAt = reviewedAt;
    }
    summary.averageTeacherScore = average(scores);
    summary.minTeacherScore = scores.length ? Math.min(...scores) : 0;
    summary.averageRoundsToUseful = average(rounds);
    return summary;
  }
  async createAiUsabilityReplayExperiment(input) {
    const beforeReviewId = input.beforeReviewId?.trim();
    const afterReviewId = input.afterReviewId?.trim();
    if (!beforeReviewId) throw new Error("beforeReviewId is required for AI usability replay experiment");
    if (!afterReviewId) throw new Error("afterReviewId is required for AI usability replay experiment");
    if (beforeReviewId === afterReviewId) throw new Error("beforeReviewId and afterReviewId must be different");
    const [beforeReview, afterReview] = await Promise.all([
      this.getAiUsabilityReview(beforeReviewId),
      this.getAiUsabilityReview(afterReviewId)
    ]);
    if (!beforeReview) throw new Error(`before review not found: ${beforeReviewId}`);
    if (!afterReview) throw new Error(`after review not found: ${afterReviewId}`);
    const timestamp = now();
    const experiment = {
      id: `aireplay_${randomUUID()}`,
      beforeReviewId,
      afterReviewId,
      replayPrompt: input.replayPrompt?.trim() || afterReview.prompt || beforeReview.prompt,
      modelBefore: input.modelBefore?.trim() || beforeReview.model,
      modelAfter: input.modelAfter?.trim() || afterReview.model,
      promptVersionBefore: input.promptVersionBefore?.trim() || "",
      promptVersionAfter: input.promptVersionAfter?.trim() || "",
      experimentNote: input.experimentNote?.trim() || "",
      createdAt: timestamp
    };
    await this.run(
      `INSERT INTO ai_usability_replay_experiments (
          id, before_review_id, after_review_id, replay_prompt, model_before, model_after,
          prompt_version_before, prompt_version_after, experiment_note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        experiment.id,
        experiment.beforeReviewId,
        experiment.afterReviewId,
        experiment.replayPrompt,
        experiment.modelBefore,
        experiment.modelAfter,
        experiment.promptVersionBefore,
        experiment.promptVersionAfter,
        experiment.experimentNote,
        experiment.createdAt
      ]
    );
    const row = (await this.all(this.usabilityReplayExperimentSelectSql("WHERE replay.id = ?"), [experiment.id]))[0];
    return this.mapAiUsabilityReplayExperiment(row);
  }
  async listAiUsabilityReplayExperiments(limit = 50) {
    const boundedLimit = clampNumber(Math.round(Number(limit) || 50), 1, 200);
    const rows = await this.all(
      `${this.usabilityReplayExperimentSelectSql()} ORDER BY replay.created_at DESC LIMIT ?`,
      [boundedLimit]
    );
    return rows.map((row) => this.mapAiUsabilityReplayExperiment(row));
  }
  async buildAiUsabilityReplaySummary(input = {}) {
    const since = normalizeIsoDate(input.since);
    const until = normalizeIsoDate(input.until);
    const clauses = [];
    const params = [];
    if (since) {
      clauses.push("replay.created_at >= ?");
      params.push(since);
    }
    if (until) {
      clauses.push("replay.created_at <= ?");
      params.push(until);
    }
    const rows = await this.all(
      `${this.usabilityReplayExperimentSelectSql(clauses.length ? `WHERE ${clauses.join(" AND ")}` : "")} ORDER BY replay.created_at DESC`,
      params
    );
    const experiments = rows.map((row) => this.mapAiUsabilityReplayExperiment(row));
    const summary = emptyUsabilityReplaySummary();
    const scoreDeltas = [];
    const roundDeltas = [];
    for (const experiment of experiments) {
      summary.experimentCount += 1;
      if (experiment.improved) summary.improvedCount += 1;
      if (!experiment.improved || experiment.issueAfter !== "none" || experiment.scoreAfter < 4) summary.unresolvedCount += 1;
      if (experiment.afterRunId) summary.liveLinkedCount += 1;
      scoreDeltas.push(experiment.scoreDelta);
      roundDeltas.push(experiment.roundsDelta);
      incrementCount(summary.issueTransitionCounts, `${experiment.issueBefore}->${experiment.issueAfter}`);
      if (!summary.latestCreatedAt || experiment.createdAt > summary.latestCreatedAt) summary.latestCreatedAt = experiment.createdAt;
    }
    summary.improvementRate = summary.experimentCount ? Number((summary.improvedCount / summary.experimentCount).toFixed(2)) : 0;
    summary.averageScoreDelta = average(scoreDeltas);
    summary.averageRoundsDelta = average(roundDeltas);
    return summary;
  }
  async createAiModelGrade(input) {
    const timestamp = now();
    const sampleId = input.sampleId?.trim();
    const prompt = input.prompt?.trim();
    const answerMarkdown = input.answerMarkdown?.trim();
    const route = String(input.route ?? "").trim();
    const subIntent = String(input.subIntent ?? "").trim();
    const reviewedAt = normalizeIsoDate(input.reviewedAt) || timestamp;
    const totalTokens = Math.max(0, Math.round(Number(input.totalTokens ?? 0)));
    if (!sampleId) throw new Error("sampleId is required for AI model grade");
    if (!prompt) throw new Error("prompt is required for AI model grade");
    if (!answerMarkdown) throw new Error("answerMarkdown is required for AI model grade");
    if (!route) throw new Error("route is required for AI model grade");
    if (!subIntent) throw new Error("subIntent is required for AI model grade");
    const scores = [
      this.normalizeModelGradeScore(input.evidenceScore, "evidenceScore"),
      this.normalizeModelGradeScore(input.actionabilityScore, "actionabilityScore"),
      this.normalizeModelGradeScore(input.safetyScore, "safetyScore"),
      this.normalizeModelGradeScore(input.gradeAppropriatenessScore, "gradeAppropriatenessScore"),
      this.normalizeModelGradeScore(input.concisionScore, "concisionScore"),
      this.normalizeModelGradeScore(input.teacherControlScore, "teacherControlScore")
    ];
    const overallScore = average(scores);
    const issueCodes = Array.isArray(input.issueCodes) ? input.issueCodes.map((item) => String(item).trim()).filter(Boolean).slice(0, 12) : [];
    const passed = overallScore >= 4 && scores.every((score) => score >= 3) && !issueCodes.includes("unsafe_student_label");
    const graderMode = input.graderMode === "llm_judge" ? "llm_judge" : "deterministic_proxy";
    const grade = {
      id: `aimodelgrade_${randomUUID()}`,
      sampleId,
      runId: input.runId?.trim() ?? "",
      sessionId: input.sessionId?.trim() ?? "",
      prompt,
      answerMarkdown,
      route,
      subIntent,
      targetGrade: input.targetGrade?.trim() ?? "",
      modelUnderReview: input.modelUnderReview?.trim() ?? "",
      graderModel: input.graderModel?.trim() || (graderMode === "llm_judge" ? "unknown-llm-judge" : "deterministic-model-grader-proxy-v1"),
      graderMode,
      promptVersion: input.promptVersion?.trim() ?? "",
      totalTokens,
      evidenceScore: scores[0],
      actionabilityScore: scores[1],
      safetyScore: scores[2],
      gradeAppropriatenessScore: scores[3],
      concisionScore: scores[4],
      teacherControlScore: scores[5],
      overallScore,
      passed,
      issueCodes,
      graderRationale: input.graderRationale?.trim() ?? "",
      reviewedAt,
      createdAt: timestamp
    };
    await this.run(
      `INSERT INTO ai_model_grades (
          id, sample_id, run_id, session_id, prompt, answer_markdown, route, sub_intent, target_grade,
          model_under_review, grader_model, grader_mode,
          prompt_version, total_tokens,
          evidence_score, actionability_score, safety_score, grade_appropriateness_score,
          concision_score, teacher_control_score, overall_score, passed,
          issue_codes_json, grader_rationale, reviewed_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        grade.id,
        grade.sampleId,
        grade.runId,
        grade.sessionId,
        grade.prompt,
        grade.answerMarkdown,
        grade.route,
        grade.subIntent,
        grade.targetGrade,
        grade.modelUnderReview,
        grade.graderModel,
        grade.graderMode,
        grade.promptVersion,
        grade.totalTokens,
        grade.evidenceScore,
        grade.actionabilityScore,
        grade.safetyScore,
        grade.gradeAppropriatenessScore,
        grade.concisionScore,
        grade.teacherControlScore,
        grade.overallScore,
        grade.passed ? 1 : 0,
        JSON.stringify(grade.issueCodes),
        grade.graderRationale,
        grade.reviewedAt,
        grade.createdAt
      ]
    );
    const row = (await this.all(`SELECT * FROM ai_model_grades WHERE id = ?`, [grade.id]))[0];
    return this.mapAiModelGrade(row);
  }
  async listAiModelGrades(limit = 50) {
    const boundedLimit = clampNumber(Math.round(Number(limit) || 50), 1, 200);
    const rows = await this.all(
      `SELECT * FROM ai_model_grades ORDER BY reviewed_at DESC, created_at DESC LIMIT ?`,
      [boundedLimit]
    );
    return rows.map((row) => this.mapAiModelGrade(row));
  }
  async buildAiModelGradeSummary(input = {}) {
    const since = normalizeIsoDate(input.since);
    const until = normalizeIsoDate(input.until);
    const clauses = [];
    const params = [];
    if (since) {
      clauses.push("reviewed_at >= ?");
      params.push(since);
    }
    if (until) {
      clauses.push("reviewed_at <= ?");
      params.push(until);
    }
    const rows = await this.all(
      `SELECT * FROM ai_model_grades${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}
       ORDER BY reviewed_at DESC, created_at DESC`,
      params
    );
    const summary = emptyModelGradeSummary();
    const overallScores = [];
    const gradeAppropriatenessScores = [];
    for (const row of rows) {
      const grade = this.mapAiModelGrade(row);
      summary.sampleCount += 1;
      if (grade.passed) summary.passedCount += 1;
      else summary.failedCount += 1;
      if (grade.runId) summary.runLinkedCount += 1;
      if (grade.totalTokens > 0) summary.tokenKnownCount += 1;
      overallScores.push(grade.overallScore);
      gradeAppropriatenessScores.push(grade.gradeAppropriatenessScore);
      incrementCount(summary.graderModeCounts, grade.graderMode);
      incrementCount(summary.promptVersionCounts, grade.promptVersion || "unknown");
      for (const issueCode of grade.issueCodes) incrementCount(summary.issueCounts, issueCode);
      if (!summary.latestReviewedAt || grade.reviewedAt > summary.latestReviewedAt) summary.latestReviewedAt = grade.reviewedAt;
    }
    summary.averageOverallScore = average(overallScores);
    summary.minOverallScore = overallScores.length ? Math.min(...overallScores) : 0;
    summary.averageGradeAppropriatenessScore = average(gradeAppropriatenessScores);
    return summary;
  }
  async startAiAgentRun(input) {
    const timestamp = now();
    const runId = `run_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_agent_runs (id, parent_run_id, session_id, prompt, route, sub_intent, status, model, student_id, error_message, created_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, '', ?, NULL, ?)`,
      [
        runId,
        input.parentRunId ?? "",
        input.sessionId ?? "",
        input.prompt,
        input.route,
        input.subIntent ?? "",
        input.model ?? "",
        input.studentId ?? "",
        timestamp,
        timestamp
      ]
    );
    return runId;
  }
  async saveAiAgentRunRequest(runId, request) {
    const normalizedRunId = requireNonEmpty(runId, "AI run id cannot be empty").slice(0, 180);
    const payload = JSON.stringify(request ?? {});
    if (payload.length > 12e4) throw new Error("AI run request snapshot is too large.");
    const timestamp = now();
    await this.run(
      `INSERT INTO ai_agent_run_requests (run_id, request_json, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(run_id) DO UPDATE SET request_json = excluded.request_json, updated_at = excluded.updated_at`,
      [normalizedRunId, payload, timestamp, timestamp]
    );
  }
  async getAiAgentRunRequest(runId) {
    const normalizedRunId = String(runId ?? "").slice(0, 180);
    const row = (await this.all(`SELECT request_json FROM ai_agent_run_requests WHERE run_id = ?`, [normalizedRunId]))[0] ?? (await this.all(`SELECT request_json FROM ai_agent_run_actions WHERE child_run_id = ? ORDER BY created_at DESC LIMIT 1`, [normalizedRunId]))[0];
    return row ? jsonObject(row.request_json) : null;
  }
  async createAiAgentChildRun(input) {
    let release;
    const previous = this.aiAgentActionQueue;
    this.aiAgentActionQueue = new Promise((resolve2) => {
      release = resolve2;
    });
    await previous;
    try {
      const sourceRunId = requireNonEmpty(input.sourceRunId, "Source run id cannot be empty").slice(0, 180);
      const idempotencyKey = requireNonEmpty(input.idempotencyKey, "Idempotency key cannot be empty").slice(0, 180);
      const existing = (await this.all(
        `SELECT child_run_id FROM ai_agent_run_actions
         WHERE source_run_id = ? AND action = ? AND idempotency_key = ? LIMIT 1`,
        [sourceRunId, input.action, idempotencyKey]
      ))[0];
      if (existing?.child_run_id) return { runId: String(existing.child_run_id), reused: true };
      const requestJson = JSON.stringify(input.request ?? {});
      if (requestJson.length > 12e4) throw new Error("AI child request snapshot is too large.");
      await this.run("BEGIN IMMEDIATE");
      try {
        const runId = await this.startAiAgentRun({
          parentRunId: sourceRunId,
          sessionId: input.sessionId,
          prompt: input.prompt,
          route: input.route,
          subIntent: input.subIntent,
          model: input.model,
          studentId: input.studentId
        });
        const timestamp = now();
        await this.run(
          `INSERT INTO ai_agent_run_actions (id, source_run_id, action, idempotency_key, child_run_id, request_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [`run_action_${randomUUID()}`, sourceRunId, input.action, idempotencyKey, runId, requestJson, timestamp]
        );
        await this.run("COMMIT");
        return { runId, reused: false };
      } catch (error) {
        await this.run("ROLLBACK").catch(() => void 0);
        throw error;
      }
    } finally {
      release();
    }
  }
  async recordAiAgentEvent(runId, event) {
    const previous = this.aiAgentEventLocks.get(runId) ?? Promise.resolve();
    let release;
    const current = new Promise((resolveCurrent) => {
      release = resolveCurrent;
    });
    const chain = previous.then(() => current);
    this.aiAgentEventLocks.set(runId, chain);
    await previous;
    try {
      const timestamp = now();
      const sequenceRow = (await this.all(
        `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM ai_agent_events WHERE run_id = ?`,
        [runId]
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
          event.toolName ?? "",
          JSON.stringify(event.inputSummary ?? {}),
          JSON.stringify(event.outputSummary ?? {}),
          timestamp
        ]
      );
    } finally {
      release();
      if (this.aiAgentEventLocks.get(runId) === chain) {
        this.aiAgentEventLocks.delete(runId);
      }
    }
  }
  async completeAiAgentRun(runId, status, errorMessage = "") {
    const timestamp = now();
    await this.run(
      `UPDATE ai_agent_runs
       SET status = ?, error_message = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, errorMessage, timestamp, timestamp, runId]
    );
  }
  async reopenAiAgentRun(runId) {
    await this.run(
      `UPDATE ai_agent_runs
       SET status = 'running', error_message = '', completed_at = NULL, updated_at = ?
       WHERE id = ?`,
      [now(), runId]
    );
  }
  async createAiCapabilityCheckpoint(input) {
    const id = `checkpoint_${randomUUID()}`;
    const createdAt = now();
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 12e4).toISOString();
    await this.run(
      `INSERT INTO ai_capability_checkpoints (
        id, run_id, capability_name, checkpoint_type, state_json, status, expires_at, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`,
      [id, input.runId, input.capabilityName, input.checkpointType, JSON.stringify(input.state ?? {}), expiresAt, createdAt]
    );
    return this.getAiCapabilityCheckpointOrThrow(id);
  }
  async claimAiContinuation(token) {
    let release;
    const previous = this.continuationClaimQueue;
    this.continuationClaimQueue = new Promise((resolve2) => {
      release = resolve2;
    });
    await previous;
    try {
      return await this.claimAiContinuationExclusive(token);
    } finally {
      release();
    }
  }
  async getPendingAiContinuation(token) {
    const normalizedToken = String(token ?? "").trim().slice(0, 180);
    if (!normalizedToken) return null;
    const rows = await this.all(
      `SELECT * FROM ai_capability_checkpoints
       WHERE checkpoint_type = 'continuation' AND status = 'pending'
       ORDER BY created_at ASC LIMIT 200`
    );
    const row = rows.find((candidate) => String(jsonObject(candidate.state_json).continuationToken ?? "") === normalizedToken);
    if (!row) return null;
    if (String(row.expires_at ?? "") && Date.parse(String(row.expires_at)) <= Date.now()) {
      await this.run(
        `UPDATE ai_capability_checkpoints SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'`,
        [now(), String(row.id)]
      );
      return null;
    }
    return this.mapAiCapabilityCheckpoint(row, true);
  }
  async claimAiBudgetApproval(checkpointId) {
    let release;
    const previous = this.continuationClaimQueue;
    this.continuationClaimQueue = new Promise((resolve2) => {
      release = resolve2;
    });
    await previous;
    try {
      const id = String(checkpointId ?? "").trim().slice(0, 180);
      if (!id) return null;
      const row = (await this.all(
        `SELECT * FROM ai_capability_checkpoints WHERE id = ? AND checkpoint_type = 'budget_approval' AND status = 'pending'`,
        [id]
      ))[0];
      if (!row) return null;
      if (String(row.expires_at ?? "") && Date.parse(String(row.expires_at)) <= Date.now()) {
        await this.run(`UPDATE ai_capability_checkpoints SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'`, [now(), id]);
        return null;
      }
      await this.run("BEGIN IMMEDIATE");
      try {
        const claimed = await this.runWithChanges(
          `UPDATE ai_capability_checkpoints SET status = 'resolved', resolved_at = ? WHERE id = ? AND status = 'pending'`,
          [now(), id]
        );
        if (!claimed) {
          await this.run("ROLLBACK");
          return null;
        }
        await this.run("COMMIT");
      } catch (error) {
        await this.run("ROLLBACK").catch(() => void 0);
        throw error;
      }
      return this.mapAiCapabilityCheckpoint({ ...(await this.all(`SELECT * FROM ai_capability_checkpoints WHERE id = ?`, [id]))[0], status: "resolved" }, true);
    } finally {
      release();
    }
  }
  async getPendingAiBudgetApproval(continuationToken) {
    const token = String(continuationToken ?? "").trim().slice(0, 180);
    if (!token) return null;
    const rows = await this.all(
      `SELECT * FROM ai_capability_checkpoints
       WHERE checkpoint_type = 'budget_approval' AND status = 'pending'
       ORDER BY created_at DESC LIMIT 200`
    );
    const row = rows.find((candidate) => String(jsonObject(candidate.state_json).continuationToken ?? "") === token);
    if (!row) return null;
    if (String(row.expires_at ?? "") && Date.parse(String(row.expires_at)) <= Date.now()) {
      await this.run(`UPDATE ai_capability_checkpoints SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'`, [now(), String(row.id)]);
      return null;
    }
    return this.mapAiCapabilityCheckpoint(row);
  }
  async claimAiContinuationExclusive(token) {
    const normalizedToken = requireNonEmpty(token, "Continuation token cannot be empty").slice(0, 180);
    const rows = await this.all(
      `SELECT * FROM ai_capability_checkpoints
       WHERE checkpoint_type = 'continuation' AND status = 'pending'
       ORDER BY created_at ASC LIMIT 200`
    );
    const row = rows.find((candidate) => {
      const state = jsonObject(candidate.state_json);
      return String(state.continuationToken ?? "") === normalizedToken;
    });
    if (!row) return null;
    const expiresAt = String(row.expires_at ?? "");
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      await this.run(
        `UPDATE ai_capability_checkpoints SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'`,
        [now(), String(row.id)]
      );
      return null;
    }
    await this.run("BEGIN IMMEDIATE");
    try {
      const claimedByThisCaller = await this.runWithChanges(
        `UPDATE ai_capability_checkpoints SET status = 'resolved', resolved_at = ? WHERE id = ? AND status = 'pending'`,
        [now(), String(row.id)]
      );
      if (!claimedByThisCaller) {
        await this.run("ROLLBACK");
        return null;
      }
      await this.run("COMMIT");
    } catch (error) {
      await this.run("ROLLBACK").catch(() => void 0);
      throw error;
    }
    return this.mapAiCapabilityCheckpoint(
      (await this.all(`SELECT * FROM ai_capability_checkpoints WHERE id = ?`, [String(row.id)]))[0],
      true
    );
  }
  async getAiCapabilityCheckpoint(id) {
    const row = (await this.all(`SELECT * FROM ai_capability_checkpoints WHERE id = ?`, [id]))[0];
    return row ? this.mapAiCapabilityCheckpoint(row) : null;
  }
  async getPendingAiCapabilityCheckpoint(runId) {
    const row = (await this.all(
      `SELECT * FROM ai_capability_checkpoints WHERE run_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [runId]
    ))[0];
    return row ? this.mapAiCapabilityCheckpoint(row) : null;
  }
  async listPendingAiUserInputCheckpoints(limit = 20) {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(Number(limit) || 20), 100));
    const rows = await this.all(
      `SELECT * FROM ai_capability_checkpoints
       WHERE checkpoint_type = 'user_input' AND status = 'pending'
       ORDER BY created_at DESC LIMIT ?`,
      [boundedLimit]
    );
    const result = [];
    for (const row of rows) {
      if (String(row.expires_at ?? "") && Date.parse(String(row.expires_at)) <= Date.now()) {
        await this.run(`UPDATE ai_capability_checkpoints SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'`, [now(), String(row.id)]);
        continue;
      }
      result.push(this.mapAiCapabilityCheckpoint(row));
    }
    return result;
  }
  async claimAiUserInputCheckpoint(checkpointId, state) {
    const id = String(checkpointId ?? "").trim().slice(0, 180);
    if (!id) return false;
    await this.run("BEGIN IMMEDIATE");
    try {
      const changed = await this.runWithChanges(
        `UPDATE ai_capability_checkpoints
         SET status = 'resolved', state_json = ?, resolved_at = ?
         WHERE id = ? AND checkpoint_type = 'user_input' AND status = 'pending'`,
        [JSON.stringify(state ?? {}), now(), id]
      );
      if (!changed) {
        await this.run("ROLLBACK");
        return false;
      }
      await this.run("COMMIT");
      return true;
    } catch (error) {
      await this.run("ROLLBACK").catch(() => void 0);
      throw error;
    }
  }
  async resolveAiCapabilityCheckpoint(id, status, state) {
    const timestamp = now();
    await this.run(
      `UPDATE ai_capability_checkpoints
       SET status = ?, state_json = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending'`,
      [status, JSON.stringify(state ?? {}), timestamp, id]
    );
    return this.getAiCapabilityCheckpoint(id);
  }
  async createAiMasteryQuestion(input) {
    const [question] = await this.createAiMasteryQuestions({ ...input, questions: [input] });
    return question;
  }
  async createAiMasteryQuestions(input) {
    const normalizedQuestions = input.questions.slice(0, 5);
    if (!normalizedQuestions.length) throw new Error("Mastery question batch cannot be empty");
    const ids = normalizedQuestions.map(() => `mastery_question_${randomUUID()}`);
    const createdAt = now();
    await this.run("BEGIN IMMEDIATE");
    try {
      for (let index = 0; index < normalizedQuestions.length; index += 1) {
        const question = normalizedQuestions[index];
        await this.run(
          `INSERT INTO ai_mastery_questions (
            id, run_id, turn_id, student_id, knowledge_point_id, knowledge_point_name,
            stem, options_json, expected_answer, status, answer, is_correct, created_at,
            answered_at, graded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', NULL, ?, NULL, NULL)`,
          [ids[index], input.runId, input.turnId, input.studentId, question.knowledgePointId, question.knowledgePointName, question.stem, JSON.stringify(question.options.slice(0, 8)), question.expectedAnswer, new Date(Date.parse(createdAt) + index).toISOString()]
        );
      }
      await this.run("COMMIT");
    } catch (error) {
      await this.run("ROLLBACK").catch(() => void 0);
      throw error;
    }
    const questions = await Promise.all(ids.map((id) => this.getAiMasteryQuestion(id)));
    return questions.filter((question) => Boolean(question));
  }
  async getAiMasteryQuestion(id) {
    const row = (await this.all(`SELECT * FROM ai_mastery_questions WHERE id = ?`, [id]))[0];
    return row ? this.mapAiMasteryQuestion(row) : null;
  }
  async getPendingAiMasteryQuestion(studentId) {
    return (await this.getPendingAiMasteryQuestions(studentId, 1))[0] ?? null;
  }
  async getPendingAiMasteryQuestions(studentId, limit = 20) {
    const normalizedStudentId = requireNonEmpty(studentId, "Mastery pending question requires studentId");
    const boundedLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
    const rows = await this.all(
      `SELECT * FROM ai_mastery_questions
       WHERE student_id = ? AND status IN ('pending', 'answered')
       ORDER BY created_at ASC, id ASC LIMIT ?`,
      [normalizedStudentId, boundedLimit]
    );
    return rows.map((row) => this.mapAiMasteryQuestion(row));
  }
  async answerAiMasteryQuestion(id, answer) {
    const timestamp = now();
    await this.run(
      `UPDATE ai_mastery_questions SET status = 'answered', answer = ?, answered_at = ?
       WHERE id = ? AND status = 'pending'`,
      [answer.slice(0, 2e3), timestamp, id]
    );
    return this.getAiMasteryQuestion(id);
  }
  async gradeAiMasteryQuestion(id, isCorrect) {
    const timestamp = now();
    await this.run(
      `UPDATE ai_mastery_questions SET status = 'graded', is_correct = ?, graded_at = ?
       WHERE id = ? AND status = 'answered'`,
      [isCorrect ? 1 : 0, timestamp, id]
    );
    return this.getAiMasteryQuestion(id);
  }
  async cancelAiMasteryQuestion(id) {
    await this.run(
      `UPDATE ai_mastery_questions SET status = 'cancelled'
       WHERE id = ? AND status IN ('pending', 'answered')`,
      [id]
    );
    return this.getAiMasteryQuestion(id);
  }
  async getAiMasteryPath(studentId) {
    const row = (await this.all(`SELECT * FROM ai_mastery_paths WHERE student_id = ? AND status = 'active'`, [studentId]))[0];
    return row ? this.mapAiMasteryPath(row) : null;
  }
  async upsertAiMasteryPath(input) {
    const existing = await this.getAiMasteryPath(input.studentId);
    const modules = input.mode === "append" && existing ? [
      ...existing.modules,
      ...input.modules.map((module, moduleOffset) => ({
        ...module,
        id: `mastery_m${existing.modules.length + moduleOffset}`,
        order: existing.modules.length + moduleOffset,
        knowledgePoints: module.knowledgePoints.map((point, pointOffset) => ({
          ...point,
          id: `mastery_m${existing.modules.length + moduleOffset}_kp${pointOffset}`
        }))
      }))
    ] : input.modules;
    const pathId = existing?.id ?? `mastery_path_${randomUUID()}`;
    const version = (existing?.version ?? 0) + 1;
    const timestamp = now();
    if (existing) {
      await this.run(
        `UPDATE ai_mastery_paths SET version = ?, mode = ?, modules_json = ?, status = 'active', updated_at = ? WHERE id = ?`,
        [version, input.mode, JSON.stringify(modules), timestamp, pathId]
      );
    } else {
      await this.run(
        `INSERT INTO ai_mastery_paths (id, student_id, version, mode, modules_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
        [pathId, input.studentId, version, input.mode, JSON.stringify(modules), timestamp, timestamp]
      );
    }
    return await this.getAiMasteryPath(input.studentId);
  }
  async getAiAgentRun(runId) {
    const row = (await this.all(`SELECT * FROM ai_agent_runs WHERE id = ?`, [runId]))[0];
    if (!row) return null;
    return this.mapAiAgentRun(row);
  }
  async listAiAgentRuns(limit = 20) {
    const boundedLimit = Math.min(50, Math.max(1, Math.trunc(limit) || 20));
    const rows = await this.all(
      `SELECT * FROM ai_agent_runs ORDER BY created_at DESC LIMIT ?`,
      [boundedLimit]
    );
    return rows.map((row) => this.mapAiAgentRun(row));
  }
  async listAiAgentEvents(runId) {
    const rows = await this.all(
      `SELECT * FROM ai_agent_events WHERE run_id = ? ORDER BY sequence ASC`,
      [runId]
    );
    return rows.map((row) => this.mapAiAgentEvent(row));
  }
  async getAiMemoryTrace(runId, limit = 50) {
    const boundedLimit = Math.min(50, Math.max(1, Math.trunc(limit) || 50));
    const run = await this.getAiAgentRun(requireNonEmpty(runId, "\u8FD0\u884C ID \u4E0D\u80FD\u4E3A\u7A7A"));
    if (!run) {
      return { layer: "L1", runId, status: "missing", eventCount: 0, events: [], bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false };
    }
    const events = (await this.listAiAgentEvents(runId)).slice(-boundedLimit);
    return {
      layer: "L1",
      runId,
      status: run.status,
      eventCount: events.length,
      events: events.map((event) => ({
        sequence: event.sequence,
        phase: event.phase,
        status: event.status,
        label: String(event.label).slice(0, 160),
        toolName: String(event.toolName ?? "").slice(0, 120),
        createdAt: event.createdAt,
        inputKeys: Object.keys(event.inputSummary ?? {}).slice(0, 24),
        outputKeys: Object.keys(event.outputSummary ?? {}).slice(0, 24)
      })),
      bounded: true,
      rawPromptIncluded: false,
      hiddenReasoningIncluded: false
    };
  }
  async listAiMemoryDocuments() {
    const rows = await this.all(
      `SELECT d.*,
        COUNT(e.id) AS entry_count,
        SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) AS active_entry_count
       FROM ai_memory_documents d
       LEFT JOIN ai_memory_entries e ON e.document_id = d.id
       WHERE d.layer = 'L2'
       GROUP BY d.id
       ORDER BY d.updated_at DESC`
    );
    return rows.map((row) => this.mapAiMemoryDocument(row));
  }
  async getAiMemoryDocument(surface) {
    assertAiMemorySurface(surface);
    const row = (await this.all(
      `SELECT d.*,
        COUNT(e.id) AS entry_count,
        SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) AS active_entry_count
       FROM ai_memory_documents d
       LEFT JOIN ai_memory_entries e ON e.document_id = d.id
       WHERE d.layer = 'L2' AND d.surface = ?
       GROUP BY d.id`,
      [surface]
    ))[0];
    if (!row) return null;
    const entries = await this.all(
      `SELECT e.*, d.surface
       FROM ai_memory_entries e
       JOIN ai_memory_documents d ON d.id = e.document_id
       WHERE e.document_id = ?
       ORDER BY CASE WHEN e.status = 'active' THEN 0 ELSE 1 END, e.updated_at DESC`,
      [String(row.id)]
    );
    return {
      document: this.mapAiMemoryDocument(row),
      entries: entries.map((entry) => this.mapAiMemoryEntry(entry))
    };
  }
  async listAiMemoryRevisions(entryId, limit = 50) {
    const id = requireNonEmpty(entryId, "L2 memory entry ID cannot be empty");
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
    const rows = await this.all(
      `SELECT * FROM ai_memory_revisions WHERE entry_id = ? ORDER BY created_at DESC LIMIT ?`,
      [id, boundedLimit]
    );
    return rows.map((row) => this.mapAiMemoryRevision(row));
  }
  async draftAiMemorySummary(surface, runId, limit = 8) {
    assertAiMemorySurface(surface);
    const boundedLimit = Math.min(8, Math.max(1, Math.trunc(limit) || 8));
    const requestedRunId = String(runId ?? "").trim();
    const run = requestedRunId ? await this.getAiAgentRun(requestedRunId) : (await this.listAiAgentRuns(1))[0] ?? null;
    if (!run) {
      return { layer: "L2", surface, sourceRunId: "", entries: [], bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false };
    }
    const events = (await this.listAiAgentEvents(run.id)).filter((event) => event.status !== "pending").slice(-boundedLimit);
    return {
      layer: "L2",
      surface,
      sourceRunId: run.id,
      entries: events.map((event) => ({
        section: "Recent activity",
        text: `Observed ${event.phase} stage: ${event.status}${event.toolName ? `; tool=${event.toolName}` : ""}.`,
        refs: [{ ref: `ai_agent_event:${event.id}`, kind: "event", id: event.id, label: `${event.phase} event` }],
        origin: "derived",
        requiresTeacherReview: true
      })),
      bounded: true,
      rawPromptIncluded: false,
      hiddenReasoningIncluded: false
    };
  }
  async createAiMemoryEntry(input) {
    assertAiMemorySurface(input.surface);
    if (input.origin && input.origin !== "teacher") throw new Error("Derived L2 summaries must remain drafts until teacher review");
    const text = normalizeMemoryText(input.text);
    const section = String(input.section ?? "Teacher notes").replace(/\s+/g, " ").trim().slice(0, 120) || "Teacher notes";
    const refs = await this.validateAiMemoryRefs(input.refs);
    const timestamp = now();
    const document = await this.ensureAiMemoryDocument(input.surface);
    const entryId = `memory_entry_${randomUUID()}`;
    const revisionId = `memory_revision_${randomUUID()}`;
    await this.run("BEGIN IMMEDIATE");
    try {
      await this.run(
        `INSERT INTO ai_memory_entries (id, document_id, section, text, refs_json, status, origin, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, 'active', 'teacher', 1, ?, ?, NULL)`,
        [entryId, document.id, section, text, JSON.stringify(refs), timestamp, timestamp]
      );
      await this.run(
        `INSERT INTO ai_memory_revisions (id, document_id, entry_id, action, before_json, after_json, created_at)
         VALUES (?, ?, ?, 'create', NULL, ?, ?)`,
        [revisionId, document.id, entryId, JSON.stringify({ section, text, refs, status: "active", origin: "teacher", version: 1 }), timestamp]
      );
      await this.run(`UPDATE ai_memory_documents SET version = version + 1, updated_at = ? WHERE id = ?`, [timestamp, document.id]);
      await this.run("COMMIT");
    } catch (error) {
      await this.run("ROLLBACK").catch(() => void 0);
      throw error;
    }
    const detail = await this.getAiMemoryDocument(input.surface);
    const created = detail?.entries.find((entry) => entry.id === entryId);
    if (!created) throw new Error("L2 memory entry readback failed");
    return created;
  }
  async updateAiMemoryEntry(entryId, input) {
    const id = requireNonEmpty(entryId, "L2 memory entry ID cannot be empty");
    const row = (await this.all(
      `SELECT e.*, d.surface, d.version AS document_version FROM ai_memory_entries e JOIN ai_memory_documents d ON d.id = e.document_id WHERE e.id = ?`,
      [id]
    ))[0];
    if (!row) throw new Error("L2 memory entry not found");
    const current = this.mapAiMemoryEntry(row);
    if (current.version !== input.version) throw new Error("L2 memory entry version conflict");
    const text = input.text == null ? current.text : normalizeMemoryText(input.text);
    const section = input.section == null ? current.section : String(input.section).replace(/\s+/g, " ").trim().slice(0, 120) || current.section;
    const refs = input.refs == null ? current.refs : await this.validateAiMemoryRefs(input.refs);
    const status = input.status ?? (current.status === "deleted" ? "disabled" : current.status);
    const nextVersion = current.version + 1;
    const timestamp = now();
    const before = { section: current.section, text: current.text, refs: current.refs, status: current.status, origin: current.origin, version: current.version };
    const after = { section, text, refs, status, origin: current.origin, version: nextVersion };
    await this.run("BEGIN IMMEDIATE");
    try {
      await this.run(
        `UPDATE ai_memory_entries SET section = ?, text = ?, refs_json = ?, status = ?, version = ?, updated_at = ?, deleted_at = CASE WHEN ? = 'deleted' THEN ? ELSE NULL END WHERE id = ? AND version = ?`,
        [section, text, JSON.stringify(refs), status, nextVersion, timestamp, status, timestamp, id, input.version]
      );
      await this.run(
        `INSERT INTO ai_memory_revisions (id, document_id, entry_id, action, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`memory_revision_${randomUUID()}`, String(row.document_id), id, status === "disabled" ? "disable" : status === "active" && current.status === "disabled" ? "restore" : "edit", JSON.stringify(before), JSON.stringify(after), timestamp]
      );
      await this.run(`UPDATE ai_memory_documents SET version = version + 1, updated_at = ? WHERE id = ?`, [timestamp, String(row.document_id)]);
      await this.run("COMMIT");
    } catch (error) {
      await this.run("ROLLBACK").catch(() => void 0);
      throw error;
    }
    const updatedRow = (await this.all(`SELECT e.*, d.surface FROM ai_memory_entries e JOIN ai_memory_documents d ON d.id = e.document_id WHERE e.id = ?`, [id]))[0];
    if (!updatedRow) throw new Error("L2 memory entry readback failed");
    return this.mapAiMemoryEntry(updatedRow);
  }
  async deleteAiMemoryEntry(entryId, version) {
    return this.updateAiMemoryEntry(entryId, { version, status: "deleted" });
  }
  async listAiMemoryL3Documents() {
    const rows = await this.all(`
      SELECT d.*, COUNT(e.id) AS entry_count,
        SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) AS active_entry_count
      FROM ai_memory_l3_documents d
      LEFT JOIN ai_memory_l3_entries e ON e.document_id = d.id
      GROUP BY d.id ORDER BY d.updated_at DESC
    `);
    return rows.map((row) => this.mapAiMemoryL3Document(row));
  }
  async getAiMemoryL3Document(slot) {
    assertAiMemoryL3Slot(slot);
    const row = (await this.all(`SELECT d.*, COUNT(e.id) AS entry_count, SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) AS active_entry_count FROM ai_memory_l3_documents d LEFT JOIN ai_memory_l3_entries e ON e.document_id = d.id WHERE d.slot = ? GROUP BY d.id`, [slot]))[0];
    if (!row) return null;
    const entries = await this.all(`SELECT * FROM ai_memory_l3_entries WHERE document_id = ? ORDER BY updated_at DESC`, [String(row.id)]);
    return { document: this.mapAiMemoryL3Document(row), entries: entries.map((entry) => this.mapAiMemoryL3Entry(entry, slot)) };
  }
  async draftAiMemoryL3(slot, limit = 8) {
    assertAiMemoryL3Slot(slot);
    const boundedLimit = Math.min(8, Math.max(1, limit));
    const rows = await this.all(`SELECT d.surface, e.section, e.text FROM ai_memory_documents d JOIN ai_memory_entries e ON e.document_id = d.id WHERE e.status = 'active' ORDER BY e.updated_at DESC LIMIT ?`, [boundedLimit * 3]);
    const grouped = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const text = normalizeMemoryText(String(row.text ?? "")).slice(0, AI_MEMORY_TEXT_MAX);
      if (!text) continue;
      const key = `${String(row.section ?? "Recent activity")}: ${text}`;
      const surfaces = grouped.get(key) ?? [];
      const surface = String(row.surface ?? "chat");
      if (!surfaces.includes(surface)) surfaces.push(surface);
      grouped.set(key, surfaces);
    }
    const prefix = slot === "profile" ? "Cross-surface learner profile: " : slot === "preferences" ? "Teacher preference signal: " : slot === "scope" ? "Current learning scope: " : "Recent cross-surface activity: ";
    return {
      layer: "L3",
      slot,
      entries: [...grouped.entries()].slice(0, boundedLimit).map(([text, sourceDocuments]) => ({ text: `${prefix}${text}`, sourceDocuments, requiresTeacherReview: true })),
      bounded: true,
      rawPromptIncluded: false,
      hiddenReasoningIncluded: false
    };
  }
  async createAiMemoryL3Entry(input) {
    assertAiMemoryL3Slot(input.slot);
    const text = normalizeMemoryText(input.text);
    if (!text) throw new Error("L3 entry text is required");
    const sourceDocuments = [...new Set(input.sourceDocuments)].filter((surface) => {
      assertAiMemorySurface(surface);
      return true;
    });
    if (!sourceDocuments.length) throw new Error("L3 entry requires at least one source surface");
    const document = await this.ensureAiMemoryL3Document(input.slot);
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const id = `memory_l3_entry_${randomUUID()}`;
    await this.run(`INSERT INTO ai_memory_l3_entries (id, document_id, text, source_documents_json, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 1, ?, ?)`, [id, document.id, text, JSON.stringify(sourceDocuments), now2, now2]);
    await this.run(`UPDATE ai_memory_l3_documents SET version = version + 1, updated_at = ? WHERE id = ?`, [now2, document.id]);
    const detail = await this.getAiMemoryL3Document(input.slot);
    const entry = detail?.entries.find((item) => item.id === id);
    if (!entry) throw new Error("L3 entry readback failed");
    return entry;
  }
  async updateAiMemoryL3Entry(entryId, input) {
    const row = (await this.all(`SELECT e.*, d.slot FROM ai_memory_l3_entries e JOIN ai_memory_l3_documents d ON d.id = e.document_id WHERE e.id = ?`, [entryId]))[0];
    if (!row) throw new Error("L3 entry not found");
    if (Number(row.version) !== input.version) throw new Error("L3 entry version conflict; refresh before editing");
    const slot = String(row.slot);
    const text = input.text == null ? String(row.text) : normalizeMemoryText(input.text);
    const status = input.status ?? String(row.status);
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const changed = await this.runWithChanges(`UPDATE ai_memory_l3_entries SET text = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`, [text, status, now2, entryId, input.version]);
    if (!changed) throw new Error("L3 entry version conflict; refresh before editing");
    await this.run(`UPDATE ai_memory_l3_documents SET version = version + 1, updated_at = ? WHERE slot = ?`, [now2, slot]);
    const detail = await this.getAiMemoryL3Document(slot);
    const entry = detail?.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error("L3 entry readback failed");
    return entry;
  }
  async getAiMemoryEvidenceGraph(limit = 200) {
    const boundedLimit = Math.min(200, Math.max(1, Math.trunc(limit) || 200));
    const nodes = /* @__PURE__ */ new Map();
    const edges = [];
    const addNode = (node) => {
      if (nodes.size < boundedLimit || nodes.has(node.id)) nodes.set(node.id, node);
    };
    const l2Rows = await this.all(`SELECT e.id, e.section, e.status, e.refs_json, d.surface FROM ai_memory_entries e JOIN ai_memory_documents d ON d.id = e.document_id WHERE e.status = 'active' ORDER BY e.updated_at DESC LIMIT ?`, [boundedLimit]);
    for (const row of l2Rows) {
      const id = `l2:${String(row.id)}`;
      addNode({ id, kind: "l2_entry", label: `L2 ${String(row.surface)} / ${String(row.section ?? "entry")}`.slice(0, 160), status: String(row.status) });
      for (const ref of jsonUnknownArray(row.refs_json)) {
        if (!ref || typeof ref !== "object") continue;
        const item = ref;
        const refId = String(item.id ?? "").trim();
        const kind = String(item.kind ?? "");
        if (!refId || kind !== "event" && kind !== "run") continue;
        const evidenceId = `${kind}:${refId}`;
        addNode({ id: evidenceId, kind: kind === "event" ? "event" : "run", label: `${kind} ${refId}`.slice(0, 160), status: "evidence" });
        edges.push({ from: id, to: evidenceId, kind: "evidence" });
      }
    }
    const l3Rows = await this.all(`SELECT e.id, e.status, e.source_documents_json, d.slot FROM ai_memory_l3_entries e JOIN ai_memory_l3_documents d ON d.id = e.document_id WHERE e.status = 'active' ORDER BY e.updated_at DESC LIMIT ?`, [boundedLimit]);
    for (const row of l3Rows) {
      const id = `l3:${String(row.id)}`;
      addNode({ id, kind: "l3_entry", label: `L3 ${String(row.slot)}`, status: String(row.status) });
      for (const surface of jsonUnknownArray(row.source_documents_json).map(String)) {
        for (const candidate of l2Rows) {
          if (String(candidate.surface) === surface) edges.push({ from: id, to: `l2:${String(candidate.id)}`, kind: "derived_from" });
        }
      }
    }
    const allowedIds = new Set(nodes.keys());
    return { nodes: [...nodes.values()], edges: edges.filter((edge) => allowedIds.has(edge.from) && allowedIds.has(edge.to)).slice(0, boundedLimit * 2), bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false };
  }
  async getAiMemoryGovernanceReport() {
    const count = async (sql, params = []) => Number((await this.all(sql, params))[0]?.count ?? 0);
    const l2Documents = await count(`SELECT COUNT(*) AS count FROM ai_memory_documents WHERE layer = 'L2'`);
    const l2ActiveEntries = await count(`SELECT COUNT(*) AS count FROM ai_memory_entries WHERE status = 'active'`);
    const disabledEntries = await count(`SELECT COUNT(*) AS count FROM ai_memory_entries WHERE status = 'disabled'`);
    const deletedEntries = await count(`SELECT COUNT(*) AS count FROM ai_memory_entries WHERE status = 'deleted'`);
    const l3Documents = await count(`SELECT COUNT(*) AS count FROM ai_memory_l3_documents WHERE layer = 'L3'`);
    const l3ActiveEntries = await count(`SELECT COUNT(*) AS count FROM ai_memory_l3_entries WHERE status = 'active'`);
    const refs = await this.all(`SELECT refs_json FROM ai_memory_entries WHERE status = 'active'`);
    const [eventRows, runRows] = await Promise.all([
      this.all(`SELECT id FROM ai_agent_events`),
      this.all(`SELECT id FROM ai_agent_runs`)
    ]);
    const eventIds = new Set(eventRows.map((row) => String(row.id)));
    const runIds = new Set(runRows.map((row) => String(row.id)));
    let danglingEvidenceRefs = 0;
    for (const row of refs) {
      for (const ref of jsonUnknownArray(row.refs_json)) {
        if (!ref || typeof ref !== "object") continue;
        const item = ref;
        const kind = String(item.kind ?? "");
        const id = String(item.id ?? "");
        if (kind === "event" && !eventIds.has(id)) danglingEvidenceRefs += 1;
        if (kind === "run" && !runIds.has(id)) danglingEvidenceRefs += 1;
      }
    }
    const graph = await this.getAiMemoryEvidenceGraph(200);
    return { policyVersion: "memory-governance.v1", l2Documents, l2ActiveEntries, l3Documents, l3ActiveEntries, danglingEvidenceRefs, disabledEntries, deletedEntries, graphNodes: graph.nodes.length, graphEdges: graph.edges.length, bounded: true, writableByAi: false };
  }
  async createAiConfirmation(input) {
    if (input.actionType !== "create_review_report" && input.actionType !== "save_exercise_set" && input.actionType !== "save_mastery_state") {
      throw new Error("\u5F53\u524D\u786E\u8BA4\u961F\u5217\u53EA\u652F\u6301\u521B\u5EFA\u590D\u76D8\u62A5\u544A\u6216\u4FDD\u5B58\u4E09\u5143\u9898\u7EC4");
    }
    const payload = parseAiConfirmationPayload(JSON.stringify(input.payload));
    const studentId = input.studentId || payload.studentId;
    requireNonEmpty(studentId, "\u786E\u8BA4\u9879\u7F3A\u5C11\u5B66\u751F ID");
    requireNonEmpty(input.title, "\u786E\u8BA4\u9879\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    requireNonEmpty(input.previewMd, "\u786E\u8BA4\u9879\u9884\u89C8\u4E0D\u80FD\u4E3A\u7A7A");
    if (input.actionType === "create_review_report") {
      requireNonEmpty(payload.contentMd, "\u786E\u8BA4\u9879\u62A5\u544A\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
      requireNonEmpty(payload.startDate, "\u786E\u8BA4\u9879\u7F3A\u5C11\u5F00\u59CB\u65E5\u671F");
      requireNonEmpty(payload.endDate, "\u786E\u8BA4\u9879\u7F3A\u5C11\u7ED3\u675F\u65E5\u671F");
    } else if (input.actionType === "save_exercise_set") {
      requireNonEmpty(payload.exerciseSet?.contentMd || payload.contentMd, "\u786E\u8BA4\u9879\u9898\u7EC4\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (input.actionType === "save_mastery_state") {
      if (payload.masteryOperation === "build") {
        if (!payload.masteryPath?.modules?.length) throw new Error("Mastery path confirmation requires modules");
      } else if (payload.masteryOperation === "assess") {
        if (!payload.masteryAssessment?.knowledgePointId || !payload.masteryAssessment.knowledgePointName) {
          throw new Error("Mastery assessment confirmation requires a knowledge point");
        }
      } else {
        throw new Error("Invalid mastery confirmation operation");
      }
    }
    const timestamp = now();
    const item = {
      id: `confirm_${randomUUID()}`,
      runId: input.runId ?? "",
      sessionId: input.sessionId ?? "",
      studentId,
      actionType: input.actionType,
      status: "pending",
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      previewMd: input.previewMd,
      payload: { ...payload, studentId },
      result: {},
      errorMessage: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedAt: "",
      rejectedAt: ""
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
        item.updatedAt
      ]
    );
    return item;
  }
  async listAiConfirmations(status = "pending") {
    const allowedStatuses = /* @__PURE__ */ new Set(["pending", "confirmed", "rejected", "failed"]);
    const rows = status === "all" ? await this.all(`SELECT * FROM ai_confirmation_items ORDER BY updated_at DESC`) : await this.all(
      `SELECT * FROM ai_confirmation_items WHERE status = ? ORDER BY updated_at DESC`,
      [allowedStatuses.has(status) ? status : "pending"]
    );
    return rows.map((row) => this.mapAiConfirmationItem(row));
  }
  async rejectAiConfirmation(id) {
    const existing = await this.getAiConfirmationOrThrow(id);
    if (existing.status !== "pending") throw new Error("\u53EA\u80FD\u62D2\u7EDD\u5F85\u786E\u8BA4\u9879");
    const timestamp = now();
    await this.run(
      `UPDATE ai_confirmation_items
          SET status = 'rejected', updated_at = ?, rejected_at = ?, error_message = ''
        WHERE id = ?`,
      [timestamp, timestamp, id]
    );
    return { item: await this.getAiConfirmationOrThrow(id) };
  }
  async confirmAiConfirmation(id) {
    const existing = await this.getAiConfirmationOrThrow(id);
    if (existing.status !== "pending") throw new Error("\u53EA\u80FD\u786E\u8BA4\u5F85\u786E\u8BA4\u9879");
    const timestamp = now();
    try {
      const readback = await this.executeAiConfirmation(existing);
      if (existing.actionType === "create_review_report" && !readback?.report) throw new Error("\u786E\u8BA4\u540E\u672A\u80FD\u8BFB\u56DE\u590D\u76D8\u62A5\u544A");
      if (existing.actionType === "save_exercise_set" && !readback?.exerciseSet) throw new Error("\u786E\u8BA4\u540E\u672A\u80FD\u8BFB\u56DE\u4E09\u5143\u9898\u7EC4");
      if (existing.actionType === "save_mastery_state" && !readback?.masteryPath && !readback?.masteryAttempt) throw new Error("Mastery confirmation did not produce a readback");
      const result = {
        reportId: readback?.report?.id,
        exerciseSetId: readback?.exerciseSet?.id,
        masteryPathId: readback?.masteryPath?.id,
        masteryAttempt: readback?.masteryAttempt,
        actionType: existing.actionType
      };
      await this.run(
        `UPDATE ai_confirmation_items
            SET status = 'confirmed', result_json = ?, error_message = '', updated_at = ?, confirmed_at = ?
          WHERE id = ?`,
        [JSON.stringify(result), timestamp, timestamp, id]
      );
      return { item: await this.getAiConfirmationOrThrow(id), readback };
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u786E\u8BA4\u9879\u6267\u884C\u5931\u8D25";
      await this.run(
        `UPDATE ai_confirmation_items
            SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ?`,
        [message, timestamp, id]
      );
      throw error;
    }
  }
  async generateReview(input) {
    const records = (await this.listRecords(input.studentId, { limit: MAX_RECORD_PAGE_SIZE })).filter((record) => {
      const day = formatDate(record.occurredAt);
      const subjectMatch = !input.subject || input.subject === "\u5168\u90E8" || record.subject === input.subject;
      return subjectMatch && day >= input.startDate && day <= input.endDate;
    });
    const student = (await this.listStudents("")).find((item) => item.id === input.studentId);
    if (!student) throw new Error("\u5B66\u751F\u4E0D\u5B58\u5728");
    const typeCounts = /* @__PURE__ */ new Map();
    const tagCounts = /* @__PURE__ */ new Map();
    for (const record of records) {
      typeCounts.set(record.recordType, (typeCounts.get(record.recordType) ?? 0) + 1);
      for (const tag of record.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recentEvidence = records.slice(0, 5);
    const title = `${student.displayName}${input.subject ? ` ${input.subject}` : ""}\u9636\u6BB5\u590D\u76D8`;
    const parentSummary = records.length ? `\u672C\u9636\u6BB5\u56F4\u7ED5${input.subject || "\u4E3B\u8981\u79D1\u76EE"}\u5171\u8BB0\u5F55 ${records.length} \u6761\u5B66\u4E60\u8BC1\u636E\uFF0C\u540E\u7EED\u5EFA\u8BAE\u7EE7\u7EED\u5173\u6CE8${topTags[0]?.[0] ?? "\u6838\u5FC3\u8584\u5F31\u70B9"}\uFF0C\u5E76\u7528\u6BCF\u5468\u8BB0\u5F55\u89C2\u5BDF\u6539\u5584\u60C5\u51B5\u3002` : "\u5F53\u524D\u65F6\u95F4\u8303\u56F4\u5185\u5B66\u4E60\u8BB0\u5F55\u4E0D\u8DB3\uFF0C\u5EFA\u8BAE\u5148\u8865\u5145\u8BFE\u5802\u3001\u4F5C\u4E1A\u6216\u6C9F\u901A\u8BC1\u636E\u540E\u518D\u5F62\u6210\u5BB6\u957F\u6C9F\u901A\u6458\u8981\u3002";
    const contentMd = [
      `# ${title}`,
      "",
      `\u590D\u76D8\u8303\u56F4\uFF1A${input.startDate} \u81F3 ${input.endDate}`,
      "",
      "## \u4E00\u3001\u6574\u4F53\u8868\u73B0",
      records.length ? `\u672C\u9636\u6BB5\u5171\u6C89\u6DC0 ${records.length} \u6761\u5B66\u4E60\u8BB0\u5F55\u3002\u4E3B\u8981\u8BB0\u5F55\u7C7B\u578B\u4E3A\uFF1A${[...typeCounts.entries()].map(([type, count]) => `${type} ${count} \u6761`).join("\uFF0C")}\u3002` : "\u5F53\u524D\u65F6\u95F4\u8303\u56F4\u5185\u8FD8\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55\uFF0C\u5EFA\u8BAE\u5148\u8865\u5145\u8BFE\u5802\u3001\u4F5C\u4E1A\u6216\u6C9F\u901A\u8BC1\u636E\u3002",
      "",
      "## \u4E8C\u3001\u4E3B\u8981\u8FDB\u6B65",
      "- \u8BF7\u8001\u5E08\u7ED3\u5408\u6700\u8FD1\u8BB0\u5F55\u8865\u5145\u5B66\u751F\u5DF2\u7ECF\u6539\u5584\u7684\u5177\u4F53\u8868\u73B0\u3002",
      "- \u53EF\u4F18\u5148\u5F15\u7528\u8BFE\u5802\u8868\u73B0\u3001\u4F5C\u4E1A\u8BA2\u6B63\u8D28\u91CF\u548C\u6C9F\u901A\u53CD\u9988\u3002",
      "",
      "## \u4E09\u3001\u9AD8\u9891\u8584\u5F31\u70B9",
      ...topTags.length ? topTags.map(([tag, count]) => `- ${tag}\uFF1A\u5728 ${count} \u6761\u8BC1\u636E\u4E2D\u51FA\u73B0\u3002`) : ["- \u6682\u65E0\u9AD8\u9891\u6807\u7B7E\uFF0C\u8BF7\u5728\u5B66\u4E60\u8BB0\u5F55\u4E2D\u8865\u5145\u6807\u7B7E\u3002"],
      "",
      "## \u56DB\u3001\u5178\u578B\u8BC1\u636E",
      ...recentEvidence.length ? recentEvidence.map((record) => `- ${formatDate(record.occurredAt)}\uFF5C${record.subject || "\u5168\u90E8"}\uFF5C${record.title}\uFF1A${record.content || "\u65E0\u6B63\u6587"}`) : ["- \u6682\u65E0\u53EF\u5F15\u7528\u8BC1\u636E\u3002"],
      "",
      "## \u4E94\u3001\u5B66\u4E60\u4E60\u60EF\u89C2\u5BDF",
      student.currentIssues || "\u8BF7\u8001\u5E08\u6839\u636E\u957F\u671F\u89C2\u5BDF\u8865\u5145\u5B66\u4E60\u4E60\u60EF\u3001\u8BA2\u6B63\u4E60\u60EF\u548C\u6CE8\u610F\u529B\u72B6\u6001\u3002",
      "",
      "## \u516D\u3001\u4E0B\u9636\u6BB5\u5EFA\u8BAE",
      "1. \u9009\u62E9 1-2 \u4E2A\u6700\u9AD8\u9891\u95EE\u9898\u505A\u77ED\u5468\u671F\u4E13\u9879\u8BAD\u7EC3\u3002",
      "2. \u6BCF\u6B21\u8BB0\u5F55\u4FDD\u7559\u9519\u56E0\u4E00\u53E5\u8BDD\uFF0C\u4FBF\u4E8E\u4E0B\u6B21\u590D\u76D8\u8FFD\u8E2A\u3002",
      "3. \u4E00\u5468\u540E\u56DE\u770B\u65F6\u95F4\u7EBF\uFF0C\u786E\u8BA4\u95EE\u9898\u662F\u5426\u51CF\u5C11\u800C\u4E0D\u662F\u53EA\u770B\u5355\u6B21\u8868\u73B0\u3002",
      "",
      "## \u4E03\u3001\u5BB6\u957F\u6C9F\u901A\u7248\u6458\u8981",
      parentSummary
    ].join("\n");
    const qualityChecks = this.buildReportQualityChecks(records, contentMd, parentSummary);
    const timestamp = now();
    const report = {
      id: `report_${randomUUID()}`,
      studentId: input.studentId,
      subject: input.subject ?? "",
      startDate: input.startDate,
      endDate: input.endDate,
      reportType: input.reportType,
      title,
      contentMd,
      parentSummary,
      qualityChecks,
      sourceRecordIds: records.map((record) => record.id),
      createdAt: timestamp,
      updatedAt: timestamp
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
        report.updatedAt
      ]
    );
    const reportRoot = this.resolveInsideDataRoot("students", input.studentId, "reports");
    mkdirSync(reportRoot, { recursive: true });
    writeFileSync(resolveInsideRoot(reportRoot, `${report.id}.md`), contentMd, "utf8");
    await this.touchStudent(input.studentId);
    return report;
  }
  async updateReport(id, contentMd, parentSummary) {
    const existing = (await this.all(`SELECT parent_summary, source_record_ids FROM review_reports WHERE id = ?`, [id]))[0];
    if (!existing) throw new Error("\u590D\u76D8\u62A5\u544A\u4E0D\u5B58\u5728");
    const nextParentSummary = parentSummary ?? String(existing.parent_summary ?? "");
    const sourceRecordIds = jsonArray(existing.source_record_ids);
    const qualityChecks = this.buildReportQualityChecks(
      sourceRecordIds.map((recordId) => ({ id: recordId })),
      contentMd,
      nextParentSummary
    );
    await this.run(
      `UPDATE review_reports
          SET content_md = ?, parent_summary = ?, quality_checks_json = ?, updated_at = ?
        WHERE id = ?`,
      [contentMd, nextParentSummary, JSON.stringify(qualityChecks), now(), id]
    );
    const report = (await this.all(`SELECT * FROM review_reports WHERE id = ?`, [id]))[0];
    return this.mapReport(report);
  }
  async listReports(studentId) {
    return (await this.all(`SELECT * FROM review_reports WHERE student_id = ? ORDER BY created_at DESC`, [studentId])).map((row) => this.mapReport(row));
  }
  async createQuestionBankItem(input) {
    const stem = requireNonEmpty(input.stem, "\u9898\u5E72\u4E0D\u80FD\u4E3A\u7A7A");
    const difficulty = input.difficulty === "easy" || input.difficulty === "hard" ? input.difficulty : "medium";
    const sourceKind = input.sourceKind === "teacher_resource" || input.sourceKind === "generated" ? input.sourceKind : "local_bank";
    const timestamp = now();
    const item = {
      id: `question_${randomUUID()}`,
      subject: input.subject?.trim() ?? "",
      grade: input.grade?.trim() ?? "",
      knowledgePoint: input.knowledgePoint?.trim() ?? "",
      questionType: input.questionType?.trim() ?? "",
      difficulty,
      stem,
      answer: input.answer?.trim() ?? "",
      analysis: input.analysis?.trim() ?? "",
      sourceTitle: input.sourceTitle?.trim() ?? "\u672C\u5730\u9898\u5E93",
      sourceKind,
      tags: input.tags ?? [],
      createdAt: timestamp,
      updatedAt: timestamp
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
        item.updatedAt
      ]
    );
    return item;
  }
  /** DeepTutor Book Workspace adapter: a local, structured "专题讲义/单元备课包".
   * The book is an overlay over existing knowledge resources; source content is
   * never copied into the book tables, only bounded anchors and fingerprints.
   */
  async createTeachingBook(input) {
    const title = requireNonEmpty(input.title, "\u8BB2\u4E49\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 200);
    const timestamp = now();
    const book = {
      id: `teaching_book_${randomUUID()}`,
      title,
      description: String(input.description ?? "").trim().slice(0, 1e3),
      status: "draft",
      language: String(input.language ?? "zh-CN").slice(0, 40),
      targetLevel: String(input.targetLevel ?? "").trim().slice(0, 80),
      version: 1,
      chapterCount: 0,
      pageCount: 0,
      sourceCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: ""
    };
    await this.run(`INSERT INTO teaching_books (id, title, description, status, language, target_level, version, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, '')`, [book.id, book.title, book.description, book.status, book.language, book.targetLevel, timestamp, timestamp]);
    return book;
  }
  async listTeachingBooks(includeDeleted = false) {
    const where = includeDeleted ? "" : `WHERE b.deleted_at = ''`;
    const rows = await this.all(`SELECT b.*, COUNT(DISTINCT c.id) AS chapter_count, COUNT(DISTINCT p.id) AS page_count, COUNT(DISTINCT s.id) AS source_count
      FROM teaching_books b
      LEFT JOIN teaching_book_chapters c ON c.book_id = b.id
      LEFT JOIN teaching_book_pages p ON p.book_id = b.id
      LEFT JOIN teaching_book_sources s ON s.book_id = b.id
      ${where} GROUP BY b.id ORDER BY b.updated_at DESC`, []);
    return rows.map((row) => this.mapTeachingBook(row));
  }
  async getTeachingBook(id) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const bookRow = (await this.all(`SELECT b.*, COUNT(DISTINCT c.id) AS chapter_count, COUNT(DISTINCT p.id) AS page_count, COUNT(DISTINCT s.id) AS source_count FROM teaching_books b LEFT JOIN teaching_book_chapters c ON c.book_id = b.id LEFT JOIN teaching_book_pages p ON p.book_id = b.id LEFT JOIN teaching_book_sources s ON s.book_id = b.id WHERE b.id = ? GROUP BY b.id`, [bookId]))[0];
    if (!bookRow) return void 0;
    const [chapterRows, pageRows, blockRows, sourceRows] = await Promise.all([
      this.all(`SELECT * FROM teaching_book_chapters WHERE book_id = ? ORDER BY sort_order, created_at`, [bookId]),
      this.all(`SELECT p.*, COUNT(b.id) AS block_count FROM teaching_book_pages p LEFT JOIN teaching_book_blocks b ON b.page_id = p.id WHERE p.book_id = ? GROUP BY p.id ORDER BY p.sort_order, p.created_at`, [bookId]),
      this.all(`SELECT b.* FROM teaching_book_blocks b INNER JOIN teaching_book_pages p ON p.id = b.page_id WHERE p.book_id = ? ORDER BY b.sort_order, b.created_at`, [bookId]),
      this.all(`SELECT * FROM teaching_book_sources WHERE book_id = ? ORDER BY created_at`, [bookId])
    ]);
    const health = await this.getTeachingBookHealth(bookId);
    return {
      book: this.mapTeachingBook(bookRow),
      chapters: chapterRows.map((row) => this.mapTeachingBookChapter(row)),
      pages: pageRows.map((row) => this.mapTeachingBookPage(row)),
      blocks: blockRows.map((row) => this.mapTeachingBookBlock(row)),
      sources: sourceRows.map((row) => this.mapTeachingSource(row)),
      health
    };
  }
  async updateTeachingBook(id, input) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const current = (await this.all(`SELECT * FROM teaching_books WHERE id = ? AND deleted_at = ''`, [bookId]))[0];
    if (!current || Number(current.version ?? 0) !== Math.trunc(input.version)) throw new Error("\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u7248\u672C\u51B2\u7A81");
    const title = input.title == null ? String(current.title) : requireNonEmpty(input.title, "\u8BB2\u4E49\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 200);
    const status = input.status && ["draft", "spine_ready", "compiling", "ready", "partial", "error", "archived"].includes(input.status) ? input.status : String(current.status);
    const timestamp = now();
    await this.run(`UPDATE teaching_books SET title = ?, description = ?, language = ?, target_level = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND deleted_at = ''`, [title, input.description == null ? String(current.description ?? "") : String(input.description).slice(0, 1e3), input.language == null ? String(current.language ?? "zh-CN") : String(input.language).slice(0, 40), input.targetLevel == null ? String(current.target_level ?? "") : String(input.targetLevel).slice(0, 80), status, timestamp, bookId, Math.trunc(input.version)]);
    const row = (await this.all(`SELECT b.*, COUNT(DISTINCT c.id) AS chapter_count, COUNT(DISTINCT p.id) AS page_count, COUNT(DISTINCT s.id) AS source_count FROM teaching_books b LEFT JOIN teaching_book_chapters c ON c.book_id = b.id LEFT JOIN teaching_book_pages p ON p.book_id = b.id LEFT JOIN teaching_book_sources s ON s.book_id = b.id WHERE b.id = ? GROUP BY b.id`, [bookId]))[0];
    if (!row) throw new Error("\u8BB2\u4E49\u66F4\u65B0\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapTeachingBook(row);
  }
  async deleteTeachingBook(id) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const timestamp = now();
    const changed = await this.runWithChanges(`UPDATE teaching_books SET deleted_at = ?, status = 'archived', version = version + 1, updated_at = ? WHERE id = ? AND deleted_at = ''`, [timestamp, timestamp, bookId]);
    if (!changed) throw new Error("\u8BB2\u4E49\u4E0D\u5B58\u5728\u6216\u5DF2\u5F52\u6863");
    const row = (await this.all(`SELECT b.*, 0 AS chapter_count, 0 AS page_count, 0 AS source_count FROM teaching_books b WHERE b.id = ?`, [bookId]))[0];
    if (!row) throw new Error("\u8BB2\u4E49\u5F52\u6863\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapTeachingBook(row);
  }
  async createTeachingBookChapter(input) {
    const bookId = requireNonEmpty(input.bookId, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    if (!await this.getTeachingBook(bookId)) throw new Error("\u8BB2\u4E49\u4E0D\u5B58\u5728\u6216\u5DF2\u5F52\u6863");
    const timestamp = now();
    const chapter = { id: `teaching_chapter_${randomUUID()}`, bookId, title: requireNonEmpty(input.title, "\u7AE0\u8282\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 200), learningObjectives: (input.learningObjectives ?? []).map(String).slice(0, 12), contentType: input.contentType ?? "theory", prerequisites: (input.prerequisites ?? []).map(String).slice(0, 12), summary: String(input.summary ?? "").slice(0, 1e3), order: Math.max(0, Math.trunc(input.order ?? 0)), version: 1, createdAt: timestamp, updatedAt: timestamp };
    await this.run(`INSERT INTO teaching_book_chapters (id, book_id, title, learning_objectives_json, content_type, prerequisites_json, summary, sort_order, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [chapter.id, chapter.bookId, chapter.title, JSON.stringify(chapter.learningObjectives), chapter.contentType, JSON.stringify(chapter.prerequisites), chapter.summary, chapter.order, timestamp, timestamp]);
    return chapter;
  }
  async createTeachingBookPage(input) {
    const bookId = requireNonEmpty(input.bookId, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const chapterId = requireNonEmpty(input.chapterId, "\u7AE0\u8282 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const chapter = (await this.all(`SELECT id FROM teaching_book_chapters WHERE id = ? AND book_id = ?`, [chapterId, bookId]))[0];
    if (!chapter) throw new Error("\u7AE0\u8282\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u8BE5\u8BB2\u4E49");
    const timestamp = now();
    const page = { id: `teaching_page_${randomUUID()}`, bookId, chapterId, title: requireNonEmpty(input.title, "\u9875\u9762\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 200), learningObjectives: (input.learningObjectives ?? []).map(String).slice(0, 12), contentType: input.contentType ?? "theory", status: "pending", order: Math.max(0, Math.trunc(input.order ?? 0)), version: 1, blockCount: 0, error: "", createdAt: timestamp, updatedAt: timestamp };
    await this.run(`INSERT INTO teaching_book_pages (id, book_id, chapter_id, title, learning_objectives_json, content_type, status, sort_order, version, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1, '', ?, ?)`, [page.id, page.bookId, page.chapterId, page.title, JSON.stringify(page.learningObjectives), page.contentType, page.order, timestamp, timestamp]);
    return page;
  }
  async upsertTeachingBookBlock(input, id, version) {
    const pageId = requireNonEmpty(input.pageId, "\u9875\u9762 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const page = (await this.all(`SELECT id FROM teaching_book_pages WHERE id = ?`, [pageId]))[0];
    if (!page) throw new Error("\u9875\u9762\u4E0D\u5B58\u5728");
    const timestamp = now();
    const blockId = id?.trim() || `teaching_block_${randomUUID()}`;
    if (id) {
      const changed = await this.runWithChanges(`UPDATE teaching_book_blocks SET type = ?, status = ?, title = ?, params_json = ?, payload_json = ?, source_anchors_json = ?, metadata_json = ?, sort_order = ?, version = version + 1, error = '', updated_at = ? WHERE id = ? AND page_id = ? AND version = ?`, [input.type, input.status ?? "ready", String(input.title ?? "").slice(0, 200), JSON.stringify(inputObject(input.params)), JSON.stringify(inputObject(input.payload)), JSON.stringify((input.sourceAnchors ?? []).slice(0, 20)), JSON.stringify(inputObject(input.metadata)), Math.max(0, Math.trunc(input.order ?? 0)), timestamp, blockId, pageId, Math.trunc(version ?? 0)]);
      if (!changed) throw new Error("\u5185\u5BB9\u5757\u4E0D\u5B58\u5728\u6216\u7248\u672C\u51B2\u7A81");
    } else {
      await this.run(`INSERT INTO teaching_book_blocks (id, page_id, type, status, title, params_json, payload_json, source_anchors_json, metadata_json, sort_order, version, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?, ?)`, [blockId, pageId, input.type, input.status ?? "ready", String(input.title ?? "").slice(0, 200), JSON.stringify(inputObject(input.params)), JSON.stringify(inputObject(input.payload)), JSON.stringify((input.sourceAnchors ?? []).slice(0, 20)), JSON.stringify(inputObject(input.metadata)), Math.max(0, Math.trunc(input.order ?? 0)), timestamp, timestamp]);
    }
    const row = (await this.all(`SELECT * FROM teaching_book_blocks WHERE id = ?`, [blockId]))[0];
    if (!row) throw new Error("\u5185\u5BB9\u5757\u5199\u5165\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapTeachingBookBlock(row);
  }
  async addTeachingBookSource(input) {
    const bookId = requireNonEmpty(input.bookId, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    if (!await this.getTeachingBook(bookId)) throw new Error("\u8BB2\u4E49\u4E0D\u5B58\u5728\u6216\u5DF2\u5F52\u6863");
    const ref = requireNonEmpty(input.ref, "\u6765\u6E90\u5F15\u7528\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 240);
    const source = { kind: input.kind, ref, title: String(input.title ?? "").slice(0, 240), snippet: String(input.snippet ?? "").slice(0, 600), fingerprint: String(input.fingerprint ?? "").slice(0, 200), status: input.status ?? "available" };
    await this.run(`INSERT OR REPLACE INTO teaching_book_sources (id, book_id, kind, ref, title, snippet, fingerprint, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM teaching_book_sources WHERE id = ?), ?), ?)`, [`teaching_source_${createHash2("sha1").update(`${bookId}:${source.kind}:${source.ref}`).digest("hex").slice(0, 20)}`, bookId, source.kind, source.ref, source.title, source.snippet, source.fingerprint, source.status, `teaching_source_${createHash2("sha1").update(`${bookId}:${source.kind}:${source.ref}`).digest("hex").slice(0, 20)}`, now(), now()]);
    return source;
  }
  async regenerateTeachingBookBlock(id, version) {
    const blockId = requireNonEmpty(id, "\u5185\u5BB9\u5757 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const changed = await this.runWithChanges(`UPDATE teaching_book_blocks SET status = 'pending', error = '', version = version + 1, updated_at = ? WHERE id = ? AND version = ?`, [now(), blockId, Math.trunc(version)]);
    if (!changed) throw new Error("\u5185\u5BB9\u5757\u4E0D\u5B58\u5728\u6216\u7248\u672C\u51B2\u7A81");
    const row = (await this.all(`SELECT * FROM teaching_book_blocks WHERE id = ?`, [blockId]))[0];
    if (!row) throw new Error("\u5185\u5BB9\u5757\u91CD\u751F\u6210\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapTeachingBookBlock(row);
  }
  async regenerateTeachingBookPage(id, version) {
    const pageId = requireNonEmpty(id, "\u9875\u9762 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const changed = await this.runWithChanges(`UPDATE teaching_book_pages SET status = 'pending', error = '', version = version + 1, updated_at = ? WHERE id = ? AND version = ?`, [now(), pageId, Math.trunc(version)]);
    if (!changed) throw new Error("\u9875\u9762\u4E0D\u5B58\u5728\u6216\u7248\u672C\u51B2\u7A81");
    const row = (await this.all(`SELECT p.*, COUNT(b.id) AS block_count FROM teaching_book_pages p LEFT JOIN teaching_book_blocks b ON b.page_id = p.id WHERE p.id = ? GROUP BY p.id`, [pageId]))[0];
    if (!row) throw new Error("\u9875\u9762\u91CD\u751F\u6210\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapTeachingBookPage(row);
  }
  async getTeachingBookHealth(id) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const sources = await this.all(`SELECT * FROM teaching_book_sources WHERE book_id = ?`, [bookId]);
    const staleSourceRefs = [];
    const missingSourceRefs = [];
    for (const row of sources) {
      const kind = String(row.kind);
      const ref = String(row.ref);
      let current = "";
      if (kind === "knowledge_resource") {
        const source = (await this.all(`SELECT content_hash, local_path FROM teacher_resources WHERE id = ?`, [ref]))[0];
        current = source ? String(source.content_hash ?? "") : "";
      } else if (kind === "knowledge_chunk") {
        const source = (await this.all(`SELECT r.content_hash FROM resource_chunks c INNER JOIN teacher_resources r ON r.id = c.resource_id WHERE c.id = ?`, [ref]))[0];
        current = source ? String(source.content_hash ?? "") : "";
      } else if (kind === "teacher_notebook") {
        const source = (await this.all(`SELECT updated_at FROM teacher_notebook_records WHERE id = ? AND deleted_at = ''`, [ref]))[0];
        current = source ? String(source.updated_at ?? "") : "";
      } else if (kind === "question_notebook") {
        const source = (await this.all(`SELECT updated_at FROM question_bank_items WHERE id = ?`, [ref]))[0];
        current = source ? String(source.updated_at ?? "") : "";
      } else current = String(row.fingerprint ?? "");
      if (!current) missingSourceRefs.push(ref);
      else if (String(row.fingerprint ?? "") && current !== String(row.fingerprint)) staleSourceRefs.push(ref);
    }
    const affected = [...staleSourceRefs, ...missingSourceRefs];
    const blockRows = affected.length ? await this.all(`SELECT b.id, b.page_id, b.source_anchors_json FROM teaching_book_blocks b INNER JOIN teaching_book_pages p ON p.id = b.page_id WHERE p.book_id = ?`, [bookId]) : [];
    const staleBlockIds = [];
    for (const row of blockRows) {
      const anchors = Array.isArray(jsonUnknownArray(row.source_anchors_json)) ? jsonUnknownArray(row.source_anchors_json) : [];
      if (anchors.some((anchor) => affected.includes(String(anchor.ref ?? "")))) staleBlockIds.push(String(row.id));
    }
    const uniqueBlocks = [...new Set(staleBlockIds)];
    const pageRows = uniqueBlocks.length ? await this.all(`SELECT DISTINCT page_id FROM teaching_book_blocks WHERE id IN (${uniqueBlocks.map(() => "?").join(",")})`, uniqueBlocks) : [];
    const stalePageIds = [...new Set(pageRows.map((row) => String(row.page_id)))];
    return { bookId, status: missingSourceRefs.length ? "missing_sources" : staleSourceRefs.length ? "stale" : "healthy", sourceCount: sources.length, staleSourceRefs, missingSourceRefs, stalePageIds, staleBlockIds: uniqueBlocks, checkedAt: now() };
  }
  /**
   * Persist the latest source health without changing authored book content.
   * The baseline fingerprint stays immutable; only source status and the
   * local invalidation queue move. This keeps drift reviewable and granular.
   */
  async refreshTeachingBookHealth(id) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const health = await this.getTeachingBookHealth(bookId);
    const sources = await this.all(`SELECT * FROM teaching_book_sources WHERE book_id = ?`, [bookId]);
    const blocks = await this.all(`SELECT b.id, b.page_id, b.source_anchors_json FROM teaching_book_blocks b INNER JOIN teaching_book_pages p ON p.id = b.page_id WHERE p.book_id = ?`, [bookId]);
    const timestamp = health.checkedAt;
    const staleRefs = new Set(health.staleSourceRefs);
    const missingRefs = new Set(health.missingSourceRefs);
    for (const source of sources) {
      const kind = String(source.kind);
      const ref = String(source.ref);
      const status = missingRefs.has(ref) ? "missing" : staleRefs.has(ref) ? "stale" : "available";
      await this.run(`UPDATE teaching_book_sources SET status = ?, updated_at = ? WHERE book_id = ? AND kind = ? AND ref = ?`, [status, timestamp, bookId, kind, ref]);
      const affectedBlockIds = blocks.filter((block) => {
        const anchors = jsonUnknownArray(block.source_anchors_json);
        return anchors.some((anchor) => String(anchor.ref ?? "") === ref);
      }).map((block) => String(block.id));
      const affectedPageIds = [...new Set(blocks.filter((block) => affectedBlockIds.includes(String(block.id))).map((block) => String(block.page_id)))];
      const invalidationId = `teaching_invalidation_${createHash2("sha1").update(`${bookId}:${kind}:${ref}`).digest("hex").slice(0, 20)}`;
      if (status === "available") {
        await this.run(`INSERT INTO teaching_book_invalidations (id, book_id, kind, ref, status, stale_page_ids_json, stale_block_ids_json, detected_at, resolved_at)
          VALUES (?, ?, ?, ?, 'resolved', ?, ?, ?, ?)
          ON CONFLICT(book_id, kind, ref) DO UPDATE SET status = 'resolved', resolved_at = excluded.resolved_at`, [invalidationId, bookId, kind, ref, JSON.stringify(affectedPageIds), JSON.stringify(affectedBlockIds), timestamp, timestamp]);
      } else {
        await this.run(`INSERT INTO teaching_book_invalidations (id, book_id, kind, ref, status, stale_page_ids_json, stale_block_ids_json, detected_at, resolved_at)
          VALUES (?, ?, ?, ?, 'open', ?, ?, ?, '')
          ON CONFLICT(book_id, kind, ref) DO UPDATE SET status = 'open', stale_page_ids_json = excluded.stale_page_ids_json, stale_block_ids_json = excluded.stale_block_ids_json, detected_at = excluded.detected_at, resolved_at = ''`, [invalidationId, bookId, kind, ref, JSON.stringify(affectedPageIds), JSON.stringify(affectedBlockIds), timestamp]);
      }
    }
    const current = (await this.all(`SELECT status FROM teaching_books WHERE id = ? AND deleted_at = ''`, [bookId]))[0];
    const currentStatus = String(current?.status ?? "");
    if (["ready", "partial"].includes(currentStatus)) {
      const nextStatus = health.status === "healthy" ? "ready" : "partial";
      if (nextStatus !== currentStatus) await this.run(`UPDATE teaching_books SET status = ?, updated_at = ? WHERE id = ? AND deleted_at = ''`, [nextStatus, timestamp, bookId]);
    }
    return health;
  }
  async listTeachingBookInvalidations(id, includeResolved = false) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const rows = await this.all(`SELECT * FROM teaching_book_invalidations WHERE book_id = ? ${includeResolved ? "" : "AND status = 'open'"} ORDER BY detected_at DESC`, [bookId]);
    return rows.map((row) => ({
      id: String(row.id),
      bookId: String(row.book_id),
      kind: String(row.kind),
      ref: String(row.ref),
      status: String(row.status) === "resolved" ? "resolved" : "open",
      stalePageIds: jsonArray(row.stale_page_ids_json),
      staleBlockIds: jsonArray(row.stale_block_ids_json),
      detectedAt: String(row.detected_at ?? ""),
      resolvedAt: String(row.resolved_at ?? "")
    }));
  }
  async proposeTeachingBookBlockPatch(input) {
    const bookId = requireNonEmpty(input.bookId, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const blockId = requireNonEmpty(input.blockId, "\u5185\u5BB9\u5757 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const row = (await this.all("SELECT b.*, p.book_id FROM teaching_book_blocks b INNER JOIN teaching_book_pages p ON p.id = b.page_id WHERE b.id = ? AND p.book_id = ?", [blockId, bookId]))[0];
    if (!row) throw new Error("\u5185\u5BB9\u5757\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u8BE5\u8BB2\u4E49");
    if (Number(row.version ?? 0) !== Math.trunc(input.baseVersion)) throw new Error("\u5185\u5BB9\u5757\u5DF2\u88AB\u4FEE\u6539\uFF0C\u65E0\u6CD5\u57FA\u4E8E\u65E7\u7248\u672C\u751F\u6210 patch");
    const beforeTitle = String(row.title ?? "").slice(0, 200);
    const afterTitle = input.title == null ? beforeTitle : String(input.title).trim().slice(0, 200);
    const beforePayload = inputObject(jsonObject(row.payload_json));
    const afterPayload = input.payload == null ? beforePayload : inputObject(input.payload);
    if (JSON.stringify(afterPayload).length > 12e3) throw new Error("patch payload \u8D85\u51FA 12000 \u5B57\u7B26\u4E0A\u9650");
    const timestamp = now();
    const patch = {
      id: "teaching_patch_" + randomUUID(),
      bookId,
      pageId: String(row.page_id),
      blockId,
      baseVersion: Math.trunc(input.baseVersion),
      resultVersion: 0,
      operation: "replace_block",
      beforeTitle,
      afterTitle,
      beforePayload,
      afterPayload,
      reason: String(input.reason ?? "").trim().slice(0, 600),
      status: "draft",
      error: "",
      createdAt: timestamp,
      appliedAt: "",
      undoneAt: "",
      selectionStart: 0,
      selectionEnd: 0,
      selectedTextHash: "",
      selectedText: ""
    };
    await this.run("INSERT INTO teaching_book_patches (id, book_id, page_id, block_id, base_version, result_version, operation, before_title, after_title, before_payload_json, after_payload_json, reason, status, error, created_at, applied_at, undone_at, selection_start, selection_end, selected_text_hash, selected_text) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'draft', '', ?, '', '', 0, 0, '', '')", [patch.id, patch.bookId, patch.pageId, patch.blockId, patch.baseVersion, patch.operation, patch.beforeTitle, patch.afterTitle, JSON.stringify(patch.beforePayload), JSON.stringify(patch.afterPayload), patch.reason, timestamp]);
    return patch;
  }
  async proposeTeachingBookSelectionPatch(input) {
    const bookId = requireNonEmpty(input.bookId, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const blockId = requireNonEmpty(input.blockId, "\u5185\u5BB9\u5757 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const start = Math.trunc(input.selectionStart);
    const end = Math.trunc(input.selectionEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end - start > 2e4) throw new Error("\u9009\u533A\u8FB9\u754C\u65E0\u6548\u6216\u8D85\u51FA\u957F\u5EA6\u4E0A\u9650");
    const row = (await this.all("SELECT b.*, p.book_id FROM teaching_book_blocks b INNER JOIN teaching_book_pages p ON p.id = b.page_id WHERE b.id = ? AND p.book_id = ?", [blockId, bookId]))[0];
    if (!row) throw new Error("\u5185\u5BB9\u5757\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u8BE5\u8BB2\u4E49");
    const currentVersion = Number(row.version ?? 0);
    if (currentVersion !== Math.trunc(input.baseVersion)) throw new Error("\u5185\u5BB9\u5757\u5DF2\u88AB\u4FEE\u6539\uFF0C\u65E0\u6CD5\u57FA\u4E8E\u65E7\u7248\u672C\u751F\u6210\u9009\u533A patch");
    const beforePayload = inputObject(jsonObject(row.payload_json));
    const text = typeof beforePayload.text === "string" ? beforePayload.text : "";
    if (end > text.length) throw new Error("\u9009\u533A\u8D85\u51FA\u5185\u5BB9\u5757\u6587\u672C\u8303\u56F4");
    const selectedText = text.slice(start, end);
    if (selectedText !== String(input.selectedText ?? "")) throw new Error("\u9009\u533A\u6587\u672C\u5DF2\u6F02\u79FB\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u540E\u518D\u8BD5");
    const replacementText = String(input.replacementText ?? "");
    if (!replacementText.trim()) throw new Error("\u66FF\u6362\u6587\u672C\u4E0D\u80FD\u4E3A\u7A7A");
    if (replacementText.length > 2e4) throw new Error("\u66FF\u6362\u6587\u672C\u8D85\u51FA 20000 \u5B57\u7B26\u4E0A\u9650");
    const afterPayload = inputObject({ ...beforePayload, text: `${text.slice(0, start)}${replacementText}${text.slice(end)}` });
    const timestamp = now();
    const operation = input.mode === "automark" ? "automark_selection" : "replace_selection";
    const patch = {
      id: "teaching_patch_" + randomUUID(),
      bookId,
      pageId: String(row.page_id),
      blockId,
      baseVersion: currentVersion,
      resultVersion: 0,
      operation,
      beforeTitle: String(row.title ?? "").slice(0, 200),
      afterTitle: String(row.title ?? "").slice(0, 200),
      beforePayload,
      afterPayload,
      reason: String(input.reason ?? "").trim().slice(0, 600),
      status: "draft",
      error: "",
      createdAt: timestamp,
      appliedAt: "",
      undoneAt: "",
      selectionStart: start,
      selectionEnd: end,
      selectedTextHash: createHash2("sha256").update(selectedText).digest("hex"),
      selectedText: selectedText.slice(0, 2e4)
    };
    await this.run("INSERT INTO teaching_book_patches (id, book_id, page_id, block_id, base_version, result_version, operation, before_title, after_title, before_payload_json, after_payload_json, reason, status, error, created_at, applied_at, undone_at, selection_start, selection_end, selected_text_hash, selected_text) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'draft', '', ?, '', '', ?, ?, ?, ?)", [patch.id, patch.bookId, patch.pageId, patch.blockId, patch.baseVersion, patch.operation, patch.beforeTitle, patch.afterTitle, JSON.stringify(patch.beforePayload), JSON.stringify(patch.afterPayload), patch.reason, timestamp, start, end, patch.selectedTextHash, patch.selectedText]);
    return patch;
  }
  async applyTeachingBookPatch(id) {
    const patchId = requireNonEmpty(id, "patch ID \u4E0D\u80FD\u4E3A\u7A7A");
    const patchRow = (await this.all("SELECT * FROM teaching_book_patches WHERE id = ?", [patchId]))[0];
    if (!patchRow || String(patchRow.status) !== "draft") throw new Error("patch \u4E0D\u5B58\u5728\u3001\u5DF2\u5E94\u7528\u6216\u4E0D\u53EF\u5E94\u7528");
    const patchBlockId = String(patchRow.block_id ?? "");
    const patchPageId = String(patchRow.page_id ?? "");
    const patchBaseVersion = Number(patchRow.base_version ?? 0);
    const block = (await this.all("SELECT version, payload_json FROM teaching_book_blocks WHERE id = ? AND page_id = ?", [patchBlockId, patchPageId]))[0];
    if (!block || Number(block.version ?? 0) !== patchBaseVersion) {
      await this.run("UPDATE teaching_book_patches SET status = 'rejected', error = ? WHERE id = ? AND status = 'draft'", ["\u5185\u5BB9\u5757\u5DF2\u88AB\u8001\u5E08\u4FEE\u6539\uFF0Cpatch \u88AB\u62D2\u7EDD", patchId]);
      throw new Error("\u5185\u5BB9\u5757\u7248\u672C\u51B2\u7A81\uFF0C\u672A\u8986\u76D6\u8001\u5E08\u4FEE\u6539");
    }
    const selectionStart = Number(patchRow.selection_start ?? 0);
    const selectionEnd = Number(patchRow.selection_end ?? 0);
    const selectedTextHash = String(patchRow.selected_text_hash ?? "");
    if (selectedTextHash) {
      const currentPayload = inputObject(jsonObject(block.payload_json));
      const currentText = typeof currentPayload.text === "string" ? currentPayload.text : "";
      const currentSelectedText = currentText.slice(selectionStart, selectionEnd);
      const currentHash = createHash2("sha256").update(currentSelectedText).digest("hex");
      if (currentHash !== selectedTextHash) {
        await this.run("UPDATE teaching_book_patches SET status = 'rejected', error = ? WHERE id = ? AND status = 'draft'", ["\u9009\u533A\u5DF2\u6F02\u79FB\uFF0Cpatch \u88AB\u62D2\u7EDD", patchId]);
        throw new Error("\u9009\u533A\u5DF2\u6F02\u79FB\uFF0C\u672A\u8986\u76D6\u8001\u5E08\u4FEE\u6539");
      }
    }
    const timestamp = now();
    const changed = await this.runWithChanges("UPDATE teaching_book_blocks SET title = ?, payload_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND page_id = ? AND version = ?", [String(patchRow.after_title ?? ""), String(patchRow.after_payload_json ?? "{}"), timestamp, patchBlockId, patchPageId, patchBaseVersion]);
    if (!changed) throw new Error("patch \u5E94\u7528\u5931\u8D25\uFF0C\u5185\u5BB9\u5757\u7248\u672C\u5DF2\u53D8\u5316");
    await this.run("UPDATE teaching_book_patches SET status = 'applied', result_version = ?, applied_at = ?, error = '' WHERE id = ? AND status = 'draft'", [patchBaseVersion + 1, timestamp, patchId]);
    return this.mapTeachingBookPatch((await this.all("SELECT * FROM teaching_book_patches WHERE id = ?", [patchId]))[0]);
  }
  async undoTeachingBookPatch(id) {
    const patchId = requireNonEmpty(id, "patch ID \u4E0D\u80FD\u4E3A\u7A7A");
    const patchRow = (await this.all("SELECT * FROM teaching_book_patches WHERE id = ?", [patchId]))[0];
    if (!patchRow || String(patchRow.status) !== "applied") throw new Error("\u53EA\u80FD\u64A4\u9500\u5DF2\u5E94\u7528\u4E14\u672A\u64A4\u9500\u7684 patch");
    const patchBlockId = String(patchRow.block_id ?? "");
    const patchPageId = String(patchRow.page_id ?? "");
    const patchResultVersion = Number(patchRow.result_version ?? 0);
    const block = (await this.all("SELECT version FROM teaching_book_blocks WHERE id = ? AND page_id = ?", [patchBlockId, patchPageId]))[0];
    if (!block || Number(block.version ?? 0) !== patchResultVersion) throw new Error("\u5185\u5BB9\u5757\u5DF2\u88AB\u518D\u6B21\u4FEE\u6539\uFF0C\u64A4\u9500\u88AB\u963B\u6B62");
    const timestamp = now();
    const changed = await this.runWithChanges("UPDATE teaching_book_blocks SET title = ?, payload_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND page_id = ? AND version = ?", [String(patchRow.before_title ?? ""), String(patchRow.before_payload_json ?? "{}"), timestamp, patchBlockId, patchPageId, patchResultVersion]);
    if (!changed) throw new Error("\u64A4\u9500\u5931\u8D25\uFF0C\u5185\u5BB9\u5757\u7248\u672C\u5DF2\u53D8\u5316");
    await this.run("UPDATE teaching_book_patches SET status = 'undone', undone_at = ? WHERE id = ? AND status = 'applied'", [timestamp, patchId]);
    return this.mapTeachingBookPatch((await this.all("SELECT * FROM teaching_book_patches WHERE id = ?", [patchId]))[0]);
  }
  async listTeachingBookPatches(id) {
    const bookId = requireNonEmpty(id, "\u8BB2\u4E49 ID \u4E0D\u80FD\u4E3A\u7A7A");
    const rows = await this.all("SELECT * FROM teaching_book_patches WHERE book_id = ? ORDER BY created_at DESC LIMIT 100", [bookId]);
    return rows.map((row) => this.mapTeachingBookPatch(row));
  }
  async searchQuestionBank(filters = {}) {
    const clauses = [];
    const params = [];
    const subject = filters.subject?.trim();
    const knowledgePoint = filters.knowledgePoint?.trim();
    const questionType = filters.questionType?.trim();
    const difficulty = filters.difficulty;
    const query = filters.query?.trim();
    if (subject) {
      clauses.push("subject = ?");
      params.push(subject);
    }
    if (knowledgePoint) {
      clauses.push("knowledge_point LIKE ?");
      params.push(`%${knowledgePoint}%`);
    }
    if (questionType) {
      clauses.push("question_type = ?");
      params.push(questionType);
    }
    if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
      clauses.push("difficulty = ?");
      params.push(difficulty);
    }
    const tokens = searchTokens(query);
    if (tokens.length) {
      clauses.push(`(${tokens.map(() => "(stem LIKE ? OR analysis LIKE ? OR tags LIKE ? OR knowledge_point LIKE ?)").join(" OR ")})`);
      for (const token of tokens) {
        const like = `%${token}%`;
        params.push(like, like, like, like);
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.max(1, Math.min(Math.trunc(filters.limit ?? 8), 20));
    const rows = await this.all(
      `SELECT * FROM question_bank_items
       ${where}
       ORDER BY
         CASE WHEN knowledge_point = ? THEN 0 ELSE 1 END,
         updated_at DESC
       LIMIT ?`,
      [...params, knowledgePoint ?? "", limit]
    );
    const queryTokens = [.../* @__PURE__ */ new Set([...searchTokens(query), ...searchTokens(knowledgePoint)])];
    return rows.map((row) => {
      const item = this.mapQuestionBankItem(row);
      const matchedToken = queryTokens.find(
        (token) => [item.stem, item.analysis, item.knowledgePoint, item.tags.join("\u3001")].some((text) => text.includes(token))
      );
      return {
        ...item,
        matchReason: matchedToken ? `\u547D\u4E2D\u5173\u952E\u8BCD\uFF1A${matchedToken}` : item.knowledgePoint ? `\u6309\u77E5\u8BC6\u70B9 ${item.knowledgePoint} \u6392\u5E8F\u547D\u4E2D` : "\u6309\u66F4\u65B0\u65F6\u95F4\u547D\u4E2D",
        score: matchedToken ? 0.9 : 0.6
      };
    });
  }
  /**
   * DeepTutor Question Notebook adapter: the canonical question remains in
   * question_bank_items; this layer stores only bookmark/category/usage
   * overlays so categorisation never duplicates or mutates question content.
   */
  async listQuestionNotebook(filters = {}) {
    const clauses = [];
    const params = [];
    const query = filters.query?.trim().slice(0, 240) ?? "";
    const categoryId = filters.categoryId?.trim();
    if (filters.bookmarked != null) {
      clauses.push(`COALESCE(b.bookmarked, 0) = ?`);
      params.push(filters.bookmarked ? 1 : 0);
    }
    if (filters.sourceKind) {
      clauses.push("q.source_kind = ?");
      params.push(filters.sourceKind);
    }
    if (categoryId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM question_notebook_category_links l
        INNER JOIN question_notebook_categories c ON c.id = l.category_id AND c.status = 'active'
        WHERE l.question_id = q.id AND l.category_id = ?
      )`);
      params.push(categoryId);
    }
    const tokens = searchTokens(query).slice(0, 8);
    if (tokens.length) {
      clauses.push(`(${tokens.map(() => "(q.stem LIKE ? OR q.analysis LIKE ? OR q.tags LIKE ? OR q.knowledge_point LIKE ?)").join(" OR ")})`);
      for (const token of tokens) {
        const like = `%${token}%`;
        params.push(like, like, like, like);
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const countRows = await this.all(
      `SELECT COUNT(*) AS count FROM question_bank_items q
       LEFT JOIN question_notebook_bookmarks b ON b.question_id = q.id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.count ?? 0);
    const limit = Math.max(1, Math.min(Math.trunc(filters.limit ?? 20), 50));
    const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
    const rows = await this.all(
      `SELECT q.*, COALESCE(b.bookmarked, 0) AS notebook_bookmarked,
              COALESCE(b.version, 0) AS notebook_version,
              COALESCE(u.usage_count, 0) AS usage_count,
              COALESCE(u.last_used_at, '') AS last_used_at
       FROM question_bank_items q
       LEFT JOIN question_notebook_bookmarks b ON b.question_id = q.id
       LEFT JOIN (
         SELECT question_id, COUNT(*) AS usage_count, MAX(created_at) AS last_used_at
         FROM question_bank_usage GROUP BY question_id
       ) u ON u.question_id = q.id
       ${where}
       ORDER BY notebook_bookmarked DESC, last_used_at DESC, q.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const items = await Promise.all(rows.map(async (row) => {
      const item = this.mapQuestionBankItem(row);
      const categories = await this.listQuestionNotebookCategoriesForQuestion(item.id);
      return {
        ...item,
        bookmarked: Number(row.notebook_bookmarked ?? 0) === 1,
        version: Math.max(0, Number(row.notebook_version ?? 0)),
        categories,
        usageCount: Math.max(0, Number(row.usage_count ?? 0)),
        lastUsedAt: String(row.last_used_at ?? "")
      };
    }));
    return { items, total };
  }
  async getQuestionNotebookEntry(questionId) {
    const id = requireNonEmpty(questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    const result = await this.listQuestionNotebook({ query: "", limit: 50 });
    const direct = result.items.find((item2) => item2.id === id);
    if (direct) return direct;
    const rows = await this.all(`SELECT q.*, COALESCE(b.bookmarked, 0) AS notebook_bookmarked, COALESCE(b.version, 0) AS notebook_version, COALESCE(u.usage_count, 0) AS usage_count, COALESCE(u.last_used_at, '') AS last_used_at
      FROM question_bank_items q
      LEFT JOIN question_notebook_bookmarks b ON b.question_id = q.id
      LEFT JOIN (SELECT question_id, COUNT(*) AS usage_count, MAX(created_at) AS last_used_at FROM question_bank_usage GROUP BY question_id) u ON u.question_id = q.id
      WHERE q.id = ?`, [id]);
    const row = rows[0];
    if (!row) return void 0;
    const item = this.mapQuestionBankItem(row);
    return {
      ...item,
      bookmarked: Number(row.notebook_bookmarked ?? 0) === 1,
      version: Math.max(0, Number(row.notebook_version ?? 0)),
      categories: await this.listQuestionNotebookCategoriesForQuestion(item.id),
      usageCount: Math.max(0, Number(row.usage_count ?? 0)),
      lastUsedAt: String(row.last_used_at ?? "")
    };
  }
  async setQuestionNotebookBookmark(input) {
    const questionId = requireNonEmpty(input.questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    const question = await this.getQuestionBankItem(questionId);
    if (!question) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u5728\u672C\u5730\u9898\u5E93");
    const timestamp = now();
    const current = (await this.all(`SELECT version FROM question_notebook_bookmarks WHERE question_id = ?`, [questionId]))[0];
    const currentVersion = current ? Number(current.version ?? 1) : 0;
    if (input.version != null && Math.trunc(input.version) !== currentVersion) throw new Error("\u9898\u76EE\u6536\u85CF\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
    if (current) {
      const changed = await this.runWithChanges(`UPDATE question_notebook_bookmarks SET bookmarked = ?, version = version + 1, updated_at = ? WHERE question_id = ? AND version = ?`, [input.bookmarked ? 1 : 0, timestamp, questionId, currentVersion]);
      if (!changed) throw new Error("\u9898\u76EE\u6536\u85CF\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
    } else {
      await this.run(`INSERT INTO question_notebook_bookmarks (question_id, bookmarked, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`, [questionId, input.bookmarked ? 1 : 0, timestamp, timestamp]);
    }
    const updated = await this.getQuestionNotebookEntry(questionId);
    if (!updated) throw new Error("\u9898\u76EE\u6536\u85CF\u66F4\u65B0\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return updated;
  }
  async listQuestionNotebookCategories(includeDeleted = false) {
    const where = includeDeleted ? "" : `WHERE c.status = 'active'`;
    const rows = await this.all(`SELECT c.*, COUNT(l.question_id) AS entry_count FROM question_notebook_categories c LEFT JOIN question_notebook_category_links l ON l.category_id = c.id ${where} GROUP BY c.id ORDER BY c.name`, []);
    return rows.map((row) => this.mapQuestionNotebookCategory(row));
  }
  async createQuestionNotebookCategory(input) {
    const name = requireNonEmpty(input.name, "\u9898\u76EE\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 100);
    const timestamp = now();
    const category = { id: `question_category_${randomUUID()}`, name, status: "active", version: 1, entryCount: 0, createdAt: timestamp, updatedAt: timestamp, deletedAt: "" };
    try {
      await this.run(`INSERT INTO question_notebook_categories (id, name, status, version, created_at, updated_at, deleted_at) VALUES (?, ?, 'active', 1, ?, ?, '')`, [category.id, category.name, timestamp, timestamp]);
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) throw new Error("\u9898\u76EE\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
      throw error;
    }
    return category;
  }
  async updateQuestionNotebookCategory(id, input) {
    const categoryId = requireNonEmpty(id, "\u9898\u76EE\u5206\u7C7B ID \u4E0D\u80FD\u4E3A\u7A7A");
    const name = requireNonEmpty(input.name, "\u9898\u76EE\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 100);
    const changed = await this.runWithChanges(`UPDATE question_notebook_categories SET name = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'active' AND version = ?`, [name, now(), categoryId, Math.trunc(input.version)]);
    if (!changed) throw new Error("\u9898\u76EE\u5206\u7C7B\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u7248\u672C\u51B2\u7A81");
    const updated = (await this.listQuestionNotebookCategories(true)).find((item) => item.id === categoryId);
    if (!updated) throw new Error("\u9898\u76EE\u5206\u7C7B\u66F4\u65B0\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return updated;
  }
  async deleteQuestionNotebookCategory(id) {
    const categoryId = requireNonEmpty(id, "\u9898\u76EE\u5206\u7C7B ID \u4E0D\u80FD\u4E3A\u7A7A");
    const changed = await this.runWithChanges(`UPDATE question_notebook_categories SET status = 'deleted', version = version + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND status = 'active'`, [now(), now(), categoryId]);
    if (!changed) throw new Error("\u9898\u76EE\u5206\u7C7B\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664");
    const deleted = (await this.listQuestionNotebookCategories(true)).find((item) => item.id === categoryId);
    if (!deleted) throw new Error("\u9898\u76EE\u5206\u7C7B\u5220\u9664\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return deleted;
  }
  async restoreQuestionNotebookCategory(id) {
    const categoryId = requireNonEmpty(id, "\u9898\u76EE\u5206\u7C7B ID \u4E0D\u80FD\u4E3A\u7A7A");
    const changed = await this.runWithChanges(`UPDATE question_notebook_categories SET status = 'active', version = version + 1, updated_at = ?, deleted_at = '' WHERE id = ? AND status = 'deleted'`, [now(), categoryId]);
    if (!changed) throw new Error("\u9898\u76EE\u5206\u7C7B\u4E0D\u5B58\u5728\u6216\u672A\u5220\u9664");
    const restored = (await this.listQuestionNotebookCategories(true)).find((item) => item.id === categoryId);
    if (!restored) throw new Error("\u9898\u76EE\u5206\u7C7B\u6062\u590D\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return restored;
  }
  async addQuestionNotebookCategory(questionId, categoryId) {
    const qid = requireNonEmpty(questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    const cid = requireNonEmpty(categoryId, "\u9898\u76EE\u5206\u7C7B ID \u4E0D\u80FD\u4E3A\u7A7A");
    if (!await this.getQuestionBankItem(qid)) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u5728\u672C\u5730\u9898\u5E93");
    const category = (await this.listQuestionNotebookCategories()).find((item) => item.id === cid);
    if (!category) throw new Error("\u9898\u76EE\u5206\u7C7B\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u4E0D\u53EF\u7528");
    await this.run(`INSERT OR IGNORE INTO question_notebook_category_links (question_id, category_id, created_at) VALUES (?, ?, ?)`, [qid, cid, now()]);
    const entry = await this.getQuestionNotebookEntry(qid);
    if (!entry) throw new Error("\u9898\u76EE\u5206\u7C7B\u66F4\u65B0\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return entry;
  }
  async removeQuestionNotebookCategory(questionId, categoryId) {
    const qid = requireNonEmpty(questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    const cid = requireNonEmpty(categoryId, "\u9898\u76EE\u5206\u7C7B ID \u4E0D\u80FD\u4E3A\u7A7A");
    await this.runWithChanges(`DELETE FROM question_notebook_category_links WHERE question_id = ? AND category_id = ?`, [qid, cid]);
    const entry = await this.getQuestionNotebookEntry(qid);
    if (!entry) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u5728\u672C\u5730\u9898\u5E93");
    return entry;
  }
  async recordQuestionBankUsage(input) {
    const questionId = requireNonEmpty(input.questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    if (!await this.getQuestionBankItem(questionId)) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u5728\u672C\u5730\u9898\u5E93");
    const usageType = input.usageType === "exercise_set" || input.usageType === "learning_record" ? input.usageType : "manual";
    const usageId = String(input.usageId ?? "").trim().slice(0, 160);
    const id = `question_usage_${randomUUID()}`;
    const createdAt = now();
    await this.run(`INSERT OR IGNORE INTO question_bank_usage (id, question_id, usage_type, usage_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, questionId, usageType, usageId, JSON.stringify(input.metadata ?? {}), createdAt]);
    const row = (await this.all(`SELECT * FROM question_bank_usage WHERE question_id = ? AND usage_type = ? AND usage_id = ? ORDER BY created_at DESC LIMIT 1`, [questionId, usageType, usageId]))[0];
    if (!row) throw new Error("\u9898\u76EE\u5386\u53F2\u5F15\u7528\u5199\u5165\u540E\u65E0\u6CD5\u56DE\u8BFB");
    return this.mapQuestionNotebookUsage(row);
  }
  async listQuestionNotebookUsage(questionId, limit = 20) {
    const id = requireNonEmpty(questionId, "\u9898\u76EE ID \u4E0D\u80FD\u4E3A\u7A7A");
    const rows = await this.all(`SELECT * FROM question_bank_usage WHERE question_id = ? ORDER BY created_at DESC LIMIT ?`, [id, Math.max(1, Math.min(Math.trunc(limit), 50))]);
    return rows.map((row) => this.mapQuestionNotebookUsage(row));
  }
  async saveExerciseSetFromDraft(studentId, draft) {
    requireNonEmpty(studentId, "\u9898\u7EC4\u7F3A\u5C11\u5B66\u751F ID");
    const title = requireNonEmpty(draft.title || "\u5C0F\u667A\u4E09\u5143\u9898\u7EC4", "\u9898\u7EC4\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    const contentMd = requireNonEmpty(draft.contentMd, "\u9898\u7EC4\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
    const timestamp = now();
    const items = parseExerciseSetItems(draft.items ?? []);
    const sourceQuestionIds = (draft.sourceQuestionIds ?? items.map((item) => item.questionId ?? "")).filter(Boolean);
    const exerciseSet = {
      id: `exercise_set_${randomUUID()}`,
      studentId,
      title,
      subject: draft.subject?.trim() ?? "",
      knowledgePoint: draft.knowledgePoint?.trim() ?? "",
      contentMd,
      items,
      sourceQuestionIds,
      createdAt: timestamp,
      updatedAt: timestamp
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
        exerciseSet.updatedAt
      ]
    );
    for (const questionId of exerciseSet.sourceQuestionIds) {
      if (await this.getQuestionBankItem(questionId)) {
        await this.recordQuestionBankUsage({ questionId, usageType: "exercise_set", usageId: exerciseSet.id, metadata: { studentId, title: exerciseSet.title } });
      }
    }
    await this.touchStudent(studentId);
    return exerciseSet;
  }
  async listExerciseSets(studentId) {
    const rows = await this.all(`SELECT * FROM exercise_sets WHERE student_id = ? ORDER BY created_at DESC`, [studentId]);
    return rows.map((row) => this.mapExerciseSet(row));
  }
  async search(keyword) {
    const trimmedKeyword = keyword.trim();
    const ftsRecords = trimmedKeyword ? await this.searchRecordsByFts(trimmedKeyword) : null;
    const records = ftsRecords ?? await this.withAttachments((await this.all(
      `SELECT * FROM learning_records
        WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
        ORDER BY occurred_at DESC
        LIMIT 50`,
      [`%${trimmedKeyword}%`, `%${trimmedKeyword}%`, `%${trimmedKeyword}%`]
    )).map((row) => this.mapRecord(row)));
    return {
      students: await this.listStudents(keyword),
      records
    };
  }
  async listAiConversationWorkspace() {
    const folders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NULL
        ORDER BY sort_order ASC, created_at ASC`
    )).map(this.mapAiConversationFolder);
    const sessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC`
    )).map(this.mapAiConversationSession);
    const archivedFolders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`
    )).map(this.mapAiConversationFolder);
    const archivedSessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`
    )).map(this.mapAiConversationSession);
    return { folders, sessions, archivedFolders, archivedSessions };
  }
  async createAiConversationFolder(input) {
    const name = requireNonEmpty(input.name, "\u6587\u4EF6\u5939\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    const timestamp = now();
    const sortRow = (await this.all(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM ai_conversation_folders`))[0];
    await this.run(
      `INSERT INTO ai_conversation_folders (id, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`aifolder_${randomUUID()}`, name, Number(sortRow?.next_order ?? 1), timestamp, timestamp]
    );
    return this.listAiConversationWorkspace();
  }
  async createAiConversationSession(input) {
    const title = (input.title?.trim() || "\u65B0\u5BF9\u8BDD").slice(0, 80);
    const folderId = input.folderId || null;
    if (folderId) await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    const sessionId = `aisession_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_conversation_sessions (
        id, folder_id, title, student_id, last_prompt, last_response_preview,
        message_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '', '', 0, ?, ?)`,
      [sessionId, folderId, title, input.studentId ?? "", timestamp, timestamp]
    );
    return this.getAiConversationSession(sessionId);
  }
  async getAiConversationSession(sessionId) {
    const row = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!row) throw new Error("AI \u5BF9\u8BDD\u4E0D\u5B58\u5728");
    const messages = (await this.all(
      `SELECT * FROM ai_conversation_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    )).map(this.mapAiConversationMessage);
    return { session: this.mapAiConversationSession(row), messages };
  }
  async appendAiConversationMessage(sessionId, input) {
    const session = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!session) throw new Error("AI \u5BF9\u8BDD\u4E0D\u5B58\u5728");
    const content = input.content.trim();
    if (!content) throw new Error("\u5BF9\u8BDD\u6D88\u606F\u4E0D\u80FD\u4E3A\u7A7A");
    const role = input.role === "assistant" || input.role === "system" ? input.role : "user";
    const timestamp = now();
    await this.run(
      `INSERT INTO ai_conversation_messages (
        id, session_id, role, content, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [`aimsg_${randomUUID()}`, sessionId, role, content, JSON.stringify(input.metadata ?? {}), timestamp]
    );
    const messageCountRow = (await this.all(
      `SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id = ?`,
      [sessionId]
    ))[0];
    const messageCount = Number(messageCountRow?.count ?? 0);
    const nextTitle = String(session.title ?? "") === "\u65B0\u5BF9\u8BDD" && role === "user" ? content.slice(0, 40) : String(session.title ?? "\u65B0\u5BF9\u8BDD");
    const lastPrompt = role === "user" ? content.slice(0, 240) : String(session.last_prompt ?? "");
    const lastResponsePreview = role === "assistant" ? content.slice(0, 240) : String(session.last_response_preview ?? "");
    await this.run(
      `UPDATE ai_conversation_sessions
          SET title = ?, last_prompt = ?, last_response_preview = ?, message_count = ?, updated_at = ?
        WHERE id = ?`,
      [nextTitle, lastPrompt, lastResponsePreview, messageCount, timestamp, sessionId]
    );
    return this.getAiConversationSession(sessionId);
  }
  async moveAiConversationSession(sessionId, folderId) {
    if (folderId) await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_sessions SET folder_id = ?, updated_at = ? WHERE id = ?`,
      [folderId || null, now(), sessionId]
    );
    return this.listAiConversationWorkspace();
  }
  async renameAiConversationFolder(folderId, input) {
    const name = requireNonEmpty(input.name, "\u6587\u4EF6\u5939\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 80);
    await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_folders SET name = ?, updated_at = ? WHERE id = ?`,
      [name, now(), folderId]
    );
    return this.listAiConversationWorkspace();
  }
  async renameAiConversationSession(sessionId, input) {
    const title = requireNonEmpty(input.title, "\u5BF9\u8BDD\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 80);
    await this.run(
      `UPDATE ai_conversation_sessions SET title = ?, updated_at = ? WHERE id = ?`,
      [title, now(), sessionId]
    );
    return this.listAiConversationWorkspace();
  }
  async archiveAiConversationFolder(folderId) {
    await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_folders SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, folderId]
    );
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE folder_id = ? AND archived_at IS NULL`,
      [timestamp, timestamp, folderId]
    );
    return this.listAiConversationWorkspace();
  }
  async archiveAiConversationSession(sessionId) {
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, sessionId]
    );
    return this.listAiConversationWorkspace();
  }
  async exportStudentArchive(studentId, destinationRoot) {
    const student = (await this.listStudents("")).find((item) => item.id === studentId);
    if (!student) throw new Error("\u5B66\u751F\u4E0D\u5B58\u5728");
    const safeName = student.displayName.replace(/[\\/:*?"<>|]/g, "_") || student.id;
    const exportPath = join(destinationRoot, `${safeName}-${student.id}`);
    mkdirSync(exportPath, { recursive: true });
    const metadata = {
      exportedAt: now(),
      student,
      records: await this.listRecords(studentId, { limit: MAX_RECORD_PAGE_SIZE }),
      reports: await this.listReports(studentId)
    };
    writeFileSync(join(exportPath, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
    let fileCount = 1;
    const sourceStudentRoot = this.studentRoot(studentId);
    if (existsSync(sourceStudentRoot)) {
      fileCount += this.copyDirectory(sourceStudentRoot, join(exportPath, "files"));
    }
    return { exportPath, fileCount };
  }
  async exportDataRoot(destinationRoot) {
    const destination = destinationRoot.trim();
    if (!destination) throw new Error("\u5907\u4EFD\u76EE\u6807\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A");
    if (await isInsideRoot(this.dataRoot, destination)) {
      throw new Error("\u5907\u4EFD\u76EE\u6807\u4E0D\u80FD\u4F4D\u4E8E\u5F53\u524D\u6570\u636E\u76EE\u5F55\u5185\uFF0C\u907F\u514D\u9012\u5F52\u8986\u76D6\u6E90\u6570\u636E");
    }
    const exportPath = join(destination, `OmniEduData-backup-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}`);
    const fileCount = this.copyDirectory(this.dataRoot, exportPath);
    const manifestPath = join(exportPath, "omni-edu-backup-manifest.v1.json");
    const entries = await this.collectBackupManifestEntries(exportPath);
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: "omni-edu-backup-manifest.v1", createdAt: now(), fileCount: entries.length, files: entries }, null, 2), "utf8");
    const verification = await this.verifyDataBackup(exportPath);
    if (!verification.verified) throw new Error(`\u5907\u4EFD\u5B8C\u6574\u6027\u9A8C\u8BC1\u5931\u8D25\uFF1A${verification.errorMessage || "\u6587\u4EF6\u6821\u9A8C\u4E0D\u4E00\u81F4"}`);
    return { exportPath, fileCount, manifestPath, verified: true };
  }
  async verifyDataBackup(backupPath) {
    const resolvedBackup = backupPath.trim();
    const manifestPath = join(resolvedBackup, "omni-edu-backup-manifest.v1.json");
    const base = {
      backupPath: resolvedBackup,
      manifestPath,
      verified: false,
      fileCount: 0,
      missingFiles: [],
      changedFiles: [],
      unexpectedFiles: []
    };
    try {
      if (!existsSync(manifestPath)) return { ...base, errorMessage: "\u5907\u4EFD\u6E05\u5355\u4E0D\u5B58\u5728\u6216\u4E0D\u662F Omni-Edu v1 \u5907\u4EFD" };
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (parsed.schemaVersion !== "omni-edu-backup-manifest.v1" || !Array.isArray(parsed.files)) return { ...base, errorMessage: "\u5907\u4EFD\u6E05\u5355\u7248\u672C\u6216\u7ED3\u6784\u65E0\u6548" };
      const expected = new Map(parsed.files.flatMap((item) => {
        const relativePath = String(item.path ?? "").replace(/\\/g, "/");
        const sha256 = String(item.sha256 ?? "");
        const size = Number(item.size ?? -1);
        if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..") || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isFinite(size) || size < 0) return [];
        return [[relativePath, { size, sha256 }]];
      }));
      if (expected.size !== parsed.files.length) return { ...base, errorMessage: "\u5907\u4EFD\u6E05\u5355\u5305\u542B\u975E\u6CD5\u8DEF\u5F84\u6216\u91CD\u590D\u6761\u76EE" };
      const actual = await this.collectBackupManifestEntries(resolvedBackup);
      const actualMap = new Map(actual.map((item) => [item.path, item]));
      const missingFiles = [...expected.keys()].filter((path) => !actualMap.has(path));
      const changedFiles = [];
      for (const [path, expectedItem] of expected.entries()) {
        const actualItem = actualMap.get(path);
        if (actualItem && (actualItem.size !== expectedItem.size || actualItem.sha256 !== expectedItem.sha256)) changedFiles.push(path);
      }
      const unexpectedFiles = [...actualMap.keys()].filter((path) => !expected.has(path));
      return { ...base, verified: !missingFiles.length && !changedFiles.length && !unexpectedFiles.length, fileCount: expected.size, missingFiles, changedFiles, unexpectedFiles, errorMessage: missingFiles.length || changedFiles.length || unexpectedFiles.length ? "\u5907\u4EFD\u6587\u4EF6\u4E0E\u6E05\u5355\u4E0D\u4E00\u81F4" : void 0 };
    } catch (error) {
      return { ...base, errorMessage: error instanceof Error ? error.message : "\u5907\u4EFD\u6E05\u5355\u8BFB\u53D6\u5931\u8D25" };
    }
  }
  async collectBackupManifestEntries(root) {
    const files = [];
    const walk = (current) => {
      if (!existsSync(current)) return;
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.name === "omni-edu-backup-manifest.v1.json") continue;
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile()) files.push(fullPath);
      }
    };
    walk(root);
    const entries = await Promise.all(files.map(async (filePath) => {
      const stat = statSync(filePath);
      return { path: filePath.slice(root.length + 1).replace(/\\/g, "/"), size: stat.size, sha256: await hashFileSha256(filePath) };
    }));
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }
  async exportDocumentArtifact(input) {
    const type = normalizeDocumentArtifactType(input.type);
    const title = requireNonEmpty(input.title, "\u6587\u6863\u4EA7\u7269\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").slice(0, 120);
    const contentMd = requireNonEmpty(input.contentMd, "\u6587\u6863\u4EA7\u7269\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
    const fileName = sanitizeDocumentFileName(input.fileName, type);
    const exportRoot = input.destinationRoot?.trim() ? input.destinationRoot.trim() : this.resolveInsideDataRoot("exports", "ai-artifacts");
    mkdirSync(exportRoot, { recursive: true });
    const timestamp = now();
    const id = input.artifactId?.trim() || `artifact_${randomUUID()}`;
    const targetPrefix = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(-12) || String(Date.now());
    const filePath = join(exportRoot, `${targetPrefix}-${fileName}`);
    const mimeType = documentMimeType(type);
    const description = input.description?.trim() ?? "";
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
          input.sessionId ?? "",
          input.messageId ?? "",
          title,
          type,
          fileName,
          mimeType,
          description,
          contentMd,
          filePath,
          fileStat.size,
          contentHash,
          "exported",
          "",
          id,
          timestamp,
          timestamp
        ]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u6587\u6863\u4EA7\u7269\u5BFC\u51FA\u5931\u8D25";
      await this.run(
        `INSERT OR REPLACE INTO document_artifacts (
          id, session_id, message_id, title, artifact_type, file_name, mime_type, description,
          content_md, file_path, file_size, content_hash, status, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 'failed', ?, COALESCE((SELECT created_at FROM document_artifacts WHERE id = ?), ?), ?)`,
        [
          id,
          input.sessionId ?? "",
          input.messageId ?? "",
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
          timestamp
        ]
      );
      throw error;
    }
    return this.getDocumentArtifactOrThrow(id);
  }
  async getDocumentArtifact(id) {
    const row = (await this.all(`SELECT * FROM document_artifacts WHERE id = ?`, [id]))[0];
    return row ? this.mapDocumentArtifact(row) : null;
  }
  async listDocumentArtifacts(sessionId) {
    const rows = sessionId?.trim() ? await this.all(
      `SELECT * FROM document_artifacts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 100`,
      [sessionId.trim()]
    ) : await this.all(`SELECT * FROM document_artifacts ORDER BY updated_at DESC LIMIT 100`);
    return rows.map((row) => this.mapDocumentArtifact(row));
  }
  async buildAiTelemetrySnapshot(input = {}) {
    const since = normalizeIsoDate(input.since);
    const until = normalizeIsoDate(input.until);
    const whereFor = (column) => {
      const clauses = [];
      const params = [];
      if (since) {
        clauses.push(`${column} >= ?`);
        params.push(since);
      }
      if (until) {
        clauses.push(`${column} <= ?`);
        params.push(until);
      }
      return {
        suffix: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
        params
      };
    };
    const countRows = (rows, keyName) => {
      const counts = {};
      for (const row of rows) incrementCount(counts, String(row[keyName] ?? "unknown"), Number(row.count ?? 0));
      return counts;
    };
    const runWhere = whereFor("created_at");
    const eventWhere = whereFor("created_at");
    const artifactWhere = whereFor("updated_at");
    const confirmationWhere = whereFor("updated_at");
    const taskWhere = whereFor("created_at");
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
      taskRows
    ] = await Promise.all([
      this.all(`SELECT created_at, completed_at FROM ai_agent_runs${runWhere.suffix}`, runWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY status`, runWhere.params),
      this.all(`SELECT route, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY route`, runWhere.params),
      this.all(`SELECT model, COUNT(*) AS count FROM ai_agent_runs${runWhere.suffix} GROUP BY model`, runWhere.params),
      this.all(`SELECT COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix}`, eventWhere.params),
      this.all(`SELECT phase, COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix} GROUP BY phase`, eventWhere.params),
      this.all(`SELECT tool_name, COUNT(*) AS count FROM ai_agent_events${eventWhere.suffix}${eventWhere.suffix ? " AND" : " WHERE"} tool_name != '' GROUP BY tool_name`, eventWhere.params),
      this.all(`SELECT tool_name, COUNT(*) AS count FROM ai_tool_runs${eventWhere.suffix} GROUP BY tool_name`, eventWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM document_artifacts${artifactWhere.suffix} GROUP BY status`, artifactWhere.params),
      this.all(`SELECT status, COUNT(*) AS count FROM ai_confirmation_items${confirmationWhere.suffix} GROUP BY status`, confirmationWhere.params),
      this.all(`SELECT payload_json, result_json FROM ai_tasks${taskWhere.suffix}${taskWhere.suffix ? " AND" : " WHERE"} task_type = 'ai_console'`, taskWhere.params)
    ]);
    const latencies = runRows.map((row) => {
      const startedAt = Date.parse(String(row.created_at ?? ""));
      const completedAt = Date.parse(String(row.completed_at ?? ""));
      if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) return 0;
      return completedAt - startedAt;
    }).filter((value) => value > 0);
    const latency = {
      count: latencies.length,
      averageMs: average(latencies),
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95)
    };
    const toolUsageCounts = countRows(toolRunRows, "tool_name");
    for (const row of toolEventRows) incrementCount(toolUsageCounts, String(row.tool_name ?? "unknown"), Number(row.count ?? 0));
    const tokenBudget = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      knownTaskCount: 0
    };
    const contextBudget = {
      sourceCount: 0,
      knowledgeSnippetCount: 0,
      graphNodeCount: 0,
      taskCount: taskRows.length
    };
    const usabilityScores = [];
    const usability = {
      sampleCount: 0,
      passedCount: 0,
      failedCount: 0,
      averageScore: 0,
      minScore: 0,
      profileCounts: {},
      issueCounts: {}
    };
    for (const row of taskRows) {
      const result = jsonObject(row.result_json);
      const usage = result.usage && typeof result.usage === "object" && !Array.isArray(result.usage) ? result.usage : {};
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
      const usabilityGrade = result.usabilityGrade && typeof result.usabilityGrade === "object" && !Array.isArray(result.usabilityGrade) ? result.usabilityGrade : {};
      if (Object.keys(usabilityGrade).length) {
        const score = toNumber(usabilityGrade.score);
        usability.sampleCount += 1;
        usabilityScores.push(score);
        if (usabilityGrade.passed === true) usability.passedCount += 1;
        else usability.failedCount += 1;
        incrementCount(usability.profileCounts, String(usabilityGrade.profile ?? "unknown"));
        const issues = Array.isArray(usabilityGrade.issues) ? usabilityGrade.issues : [];
        for (const item of issues) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            incrementCount(usability.issueCounts, String(item.code ?? "unknown"));
          }
        }
      }
    }
    usability.averageScore = average(usabilityScores);
    usability.minScore = usabilityScores.length ? Math.min(...usabilityScores) : 0;
    const [humanUsability, usabilityReplay, modelGrader] = await Promise.all([
      this.buildAiUsabilityReviewSummary({ since, until }),
      this.buildAiUsabilityReplaySummary({ since, until }),
      this.buildAiModelGradeSummary({ since, until })
    ]);
    return {
      generatedAt: now(),
      window: {
        since: since || void 0,
        until: until || void 0
      },
      runCount: runRows.length,
      statusCounts: countRows(statusRows, "status"),
      routeCounts: countRows(routeRows, "route"),
      modelCounts: countRows(modelRows, "model"),
      eventCount: Number(eventRows[0]?.count ?? 0),
      eventPhaseCounts: countRows(phaseRows, "phase"),
      toolEventCount: Object.values(toolUsageCounts).reduce((sum, value) => sum + value, 0),
      toolUsageCounts,
      artifactCounts: countRows(artifactRows, "status"),
      confirmationCounts: countRows(confirmationRows, "status"),
      latency,
      tokenBudget,
      contextBudget,
      usability,
      humanUsability,
      usabilityReplay,
      modelGrader
    };
  }
  async createAiRegressionReport(input = {}) {
    const snapshot = await this.buildAiTelemetrySnapshot(input);
    const runningCount = snapshot.statusCounts.running ?? 0;
    const failedArtifacts = snapshot.artifactCounts.failed ?? 0;
    const pendingConfirmations = snapshot.confirmationCounts.pending ?? 0;
    const minimumUsabilityAverageScore = Number(input.minimumUsabilityAverageScore ?? 75);
    const minimumTeacherReviewSamples = Number(input.minimumTeacherReviewSamples ?? 0);
    const minimumTeacherScore = Number(input.minimumTeacherScore ?? 4);
    const maximumTeacherRoundsToUseful = Number(input.maximumTeacherRoundsToUseful ?? 2);
    const minimumReplayExperimentCount = Number(input.minimumReplayExperimentCount ?? 0);
    const minimumReplayImprovementRate = Number(input.minimumReplayImprovementRate ?? 0.6);
    const minimumLiveLinkedReplayCount = Number(input.minimumLiveLinkedReplayCount ?? 0);
    const minimumModelGradeSamples = Number(input.minimumModelGradeSamples ?? 0);
    const minimumModelGradeScore = Number(input.minimumModelGradeScore ?? 4);
    const minimumGradeAppropriatenessScore = Number(input.minimumGradeAppropriatenessScore ?? 4);
    const minimumRunLinkedModelGradeCount = Number(input.minimumRunLinkedModelGradeCount ?? 0);
    const gates = [
      {
        id: "agent_runs_terminal",
        label: "Agent run \u7EC8\u6001",
        status: runningCount > 0 ? "failed" : "passed",
        detail: runningCount > 0 ? `\u4ECD\u6709 ${runningCount} \u4E2A running run\u3002` : "\u6CA1\u6709\u9057\u7559 running run\u3002",
        evidence: { statusCounts: snapshot.statusCounts }
      },
      {
        id: "event_trace_present",
        label: "\u4E8B\u4EF6\u8F68\u8FF9\u53EF\u5BA1\u8BA1",
        status: snapshot.runCount === 0 ? "warning" : snapshot.eventCount >= snapshot.runCount ? "passed" : "failed",
        detail: snapshot.runCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709 agent run\uFF0C\u53EF\u89C2\u6D4B\u6027\u8986\u76D6\u9700\u8981\u771F\u5B9E\u8FD0\u884C\u6837\u672C\u3002" : `runs=${snapshot.runCount}, events=${snapshot.eventCount}\u3002`,
        evidence: { runCount: snapshot.runCount, eventCount: snapshot.eventCount, eventPhaseCounts: snapshot.eventPhaseCounts }
      },
      {
        id: "tool_trace_present",
        label: "\u5DE5\u5177\u8F68\u8FF9\u53EF\u67E5\u8BE2",
        status: snapshot.toolEventCount > 0 ? "passed" : "warning",
        detail: snapshot.toolEventCount > 0 ? `\u8BB0\u5F55\u5230 ${snapshot.toolEventCount} \u6761\u5DE5\u5177\u8F68\u8FF9\u3002` : "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709\u5DE5\u5177\u8F68\u8FF9\u6837\u672C\u3002",
        evidence: { toolUsageCounts: snapshot.toolUsageCounts }
      },
      {
        id: "artifact_export_status",
        label: "\u4EA7\u7269\u5BFC\u51FA\u72B6\u6001",
        status: failedArtifacts > 0 ? "failed" : "passed",
        detail: failedArtifacts > 0 ? `\u5B58\u5728 ${failedArtifacts} \u4E2A failed \u6587\u6863\u4EA7\u7269\u3002` : "\u6CA1\u6709 failed \u6587\u6863\u4EA7\u7269\u3002",
        evidence: { artifactCounts: snapshot.artifactCounts }
      },
      {
        id: "confirmation_queue_state",
        label: "\u786E\u8BA4\u961F\u5217\u72B6\u6001",
        status: pendingConfirmations > 0 ? "warning" : "passed",
        detail: pendingConfirmations > 0 ? `\u4ECD\u6709 ${pendingConfirmations} \u4E2A\u5F85\u8001\u5E08\u786E\u8BA4\u9879\u3002` : "\u6CA1\u6709\u5F85\u5904\u7406\u786E\u8BA4\u9879\u3002",
        evidence: { confirmationCounts: snapshot.confirmationCounts }
      },
      {
        id: "latency_budget_available",
        label: "\u5EF6\u8FDF\u9884\u7B97\u53EF\u8BA1\u7B97",
        status: snapshot.runCount === 0 ? "warning" : snapshot.latency.count > 0 ? "passed" : "warning",
        detail: snapshot.latency.count > 0 ? `p50=${snapshot.latency.p50Ms}ms, p95=${snapshot.latency.p95Ms}ms\u3002` : "\u5F53\u524D\u7A97\u53E3\u7F3A\u5C11 completed_at\uFF0C\u6682\u4E0D\u80FD\u8BA1\u7B97\u5EF6\u8FDF\u3002",
        evidence: { latency: snapshot.latency }
      },
      {
        id: "usability_quality_gate",
        label: "\u6559\u5E08\u53EF\u7528\u6027\u8BC4\u5206",
        status: snapshot.contextBudget.taskCount === 0 ? "warning" : snapshot.usability.sampleCount === 0 ? "warning" : snapshot.usability.failedCount > 0 || snapshot.usability.averageScore < minimumUsabilityAverageScore ? "failed" : "passed",
        detail: snapshot.contextBudget.taskCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709 AI console \u4EFB\u52A1\u6837\u672C\u3002" : snapshot.usability.sampleCount === 0 ? "\u5F53\u524D AI console \u4EFB\u52A1\u7F3A\u5C11 usabilityGrade\uFF0C\u65E0\u6CD5\u8BC4\u4F30\u6559\u5E08\u53EF\u7528\u6027\u3002" : `samples=${snapshot.usability.sampleCount}, passed=${snapshot.usability.passedCount}, average=${snapshot.usability.averageScore}, min=${snapshot.usability.minScore}\u3002`,
        evidence: { usability: snapshot.usability, minimumAverageScore: minimumUsabilityAverageScore }
      },
      {
        id: "teacher_review_score_gate",
        label: "\u771F\u5B9E\u6559\u5E08\u8BC4\u5206\u56DE\u8BFB",
        status: snapshot.humanUsability.sampleCount < minimumTeacherReviewSamples ? "failed" : snapshot.humanUsability.sampleCount === 0 ? "warning" : snapshot.humanUsability.averageTeacherScore < minimumTeacherScore || snapshot.humanUsability.averageRoundsToUseful > maximumTeacherRoundsToUseful || snapshot.humanUsability.needsRewriteCount > 0 ? "failed" : "passed",
        detail: snapshot.humanUsability.sampleCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709\u771F\u5B9E\u6559\u5E08\u4EBA\u5DE5\u8BC4\u5206\u6837\u672C\u3002" : `samples=${snapshot.humanUsability.sampleCount}, avgScore=${snapshot.humanUsability.averageTeacherScore}/5, avgRounds=${snapshot.humanUsability.averageRoundsToUseful}, needsRewrite=${snapshot.humanUsability.needsRewriteCount}\u3002`,
        evidence: {
          humanUsability: snapshot.humanUsability,
          minimumTeacherReviewSamples,
          minimumTeacherScore,
          maximumTeacherRoundsToUseful
        }
      },
      {
        id: "usability_replay_improvement_gate",
        label: "\u5931\u8D25\u6837\u672C before/after \u56DE\u653E",
        status: snapshot.usabilityReplay.experimentCount < minimumReplayExperimentCount ? "failed" : snapshot.usabilityReplay.experimentCount === 0 ? "warning" : snapshot.usabilityReplay.improvementRate < minimumReplayImprovementRate ? "failed" : "passed",
        detail: snapshot.usabilityReplay.experimentCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709 before/after \u56DE\u653E\u5B9E\u9A8C\uFF0C\u65E0\u6CD5\u91CF\u5316\u6539\u9020\u662F\u5426\u771F\u7684\u66F4\u597D\u3002" : `experiments=${snapshot.usabilityReplay.experimentCount}, improved=${snapshot.usabilityReplay.improvedCount}, rate=${snapshot.usabilityReplay.improvementRate}, avgScoreDelta=${snapshot.usabilityReplay.averageScoreDelta}, avgRoundsDelta=${snapshot.usabilityReplay.averageRoundsDelta}\u3002`,
        evidence: {
          usabilityReplay: snapshot.usabilityReplay,
          minimumReplayExperimentCount,
          minimumReplayImprovementRate
        }
      },
      {
        id: "model_grader_quality_gate",
        label: "\u6A21\u578B Grader \u8D28\u91CF\u88C1\u5224",
        status: snapshot.modelGrader.sampleCount < minimumModelGradeSamples ? "failed" : snapshot.modelGrader.sampleCount === 0 ? "warning" : snapshot.modelGrader.failedCount > 0 || snapshot.modelGrader.averageOverallScore < minimumModelGradeScore || snapshot.modelGrader.averageGradeAppropriatenessScore < minimumGradeAppropriatenessScore ? "failed" : "passed",
        detail: snapshot.modelGrader.sampleCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709\u6A21\u578B grader \u6837\u672C\uFF1B\u65E0\u6CD5\u7528\u72EC\u7ACB\u88C1\u5224\u590D\u6838\u5C0F\u667A\u8F93\u51FA\u8D28\u91CF\u3002" : `samples=${snapshot.modelGrader.sampleCount}, passed=${snapshot.modelGrader.passedCount}, avg=${snapshot.modelGrader.averageOverallScore}/5, gradeFit=${snapshot.modelGrader.averageGradeAppropriatenessScore}/5\u3002`,
        evidence: {
          modelGrader: snapshot.modelGrader,
          minimumModelGradeSamples,
          minimumModelGradeScore,
          minimumGradeAppropriatenessScore
        }
      },
      {
        id: "live_evidence_binding_gate",
        label: "Live \u8F93\u51FA\u8BC1\u636E\u94FE\u7ED1\u5B9A",
        status: snapshot.usabilityReplay.liveLinkedCount < minimumLiveLinkedReplayCount || snapshot.modelGrader.runLinkedCount < minimumRunLinkedModelGradeCount ? "failed" : snapshot.usabilityReplay.liveLinkedCount === 0 && snapshot.modelGrader.runLinkedCount === 0 ? "warning" : "passed",
        detail: snapshot.usabilityReplay.liveLinkedCount === 0 && snapshot.modelGrader.runLinkedCount === 0 ? "\u5F53\u524D\u7A97\u53E3\u6CA1\u6709\u7ED1\u5B9A runId \u7684 after review/replay/model grade\uFF1B\u65E0\u6CD5\u8BC1\u660E live \u8F93\u51FA\u5DF2\u8FDB\u5165\u8D28\u91CF\u8BC1\u636E\u94FE\u3002" : `liveLinkedReplay=${snapshot.usabilityReplay.liveLinkedCount}, runLinkedModelGrades=${snapshot.modelGrader.runLinkedCount}, tokenKnownModelGrades=${snapshot.modelGrader.tokenKnownCount}\u3002`,
        evidence: {
          liveLinkedReplayCount: snapshot.usabilityReplay.liveLinkedCount,
          runLinkedModelGradeCount: snapshot.modelGrader.runLinkedCount,
          tokenKnownModelGradeCount: snapshot.modelGrader.tokenKnownCount,
          minimumLiveLinkedReplayCount,
          minimumRunLinkedModelGradeCount
        }
      }
    ];
    if (input.expectedEvalTotal != null || input.expectedEvalPassed != null) {
      const total = Number(input.expectedEvalTotal ?? 0);
      const passed = Number(input.expectedEvalPassed ?? 0);
      gates.push({
        id: "router_eval_baseline",
        label: "Router eval \u57FA\u7EBF",
        status: total > 0 && passed === total ? "passed" : "failed",
        detail: total > 0 ? `${passed}/${total} router eval passed\u3002` : "\u7F3A\u5C11 router eval \u603B\u6570\u3002",
        evidence: { expectedEvalTotal: total, expectedEvalPassed: passed }
      });
    }
    if (input.expectedUsabilityEvalTotal != null || input.expectedUsabilityEvalPassed != null) {
      const total = Number(input.expectedUsabilityEvalTotal ?? 0);
      const passed = Number(input.expectedUsabilityEvalPassed ?? 0);
      gates.push({
        id: "usability_eval_baseline",
        label: "Usability eval \u6837\u672C\u96C6",
        status: total > 0 && passed === total ? "passed" : "failed",
        detail: total > 0 ? `${passed}/${total} usability eval cases passed\u3002` : "\u7F3A\u5C11 usability eval \u603B\u6570\u3002",
        evidence: { expectedUsabilityEvalTotal: total, expectedUsabilityEvalPassed: passed }
      });
    }
    const status = gates.some((gate) => gate.status === "failed") ? "failed" : gates.some((gate) => gate.status === "warning") ? "warning" : "passed";
    const title = input.title?.trim() || "\u5C0F\u667A Observability Regression Report";
    const reportJson = {
      schemaVersion: "xiazhi.observability.v1",
      replySchemaVersion: "xiazhi.reply.v2",
      generatedAt: snapshot.generatedAt,
      title,
      status,
      snapshot,
      gates
    };
    const summary = `runs=${snapshot.runCount}, events=${snapshot.eventCount}, tools=${snapshot.toolEventCount}, status=${status}`;
    const report = {
      id: `aireport_${randomUUID()}`,
      title,
      status,
      summary,
      snapshot,
      gates,
      reportJson,
      createdAt: now()
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
        report.createdAt
      ]
    );
    return this.getAiRegressionReportOrThrow(report.id);
  }
  async getAiRegressionReport(id) {
    const row = (await this.all(`SELECT * FROM ai_regression_reports WHERE id = ?`, [id]))[0];
    return row ? this.mapAiRegressionReport(row) : null;
  }
  async listAiRegressionReports(limit = 20) {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const rows = await this.all(`SELECT * FROM ai_regression_reports ORDER BY created_at DESC LIMIT ?`, [boundedLimit]);
    return rows.map((row) => this.mapAiRegressionReport(row));
  }
  openDatabase(filePath) {
    return new Promise((resolveOpen, reject) => {
      const db = new sqlite3.Database(filePath, (error) => {
        if (error) reject(error);
        else resolveOpen(db);
      });
    });
  }
  async migrate() {
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
      CREATE TABLE IF NOT EXISTS teacher_notebooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#3B82F6',
        icon TEXT NOT NULL DEFAULT 'book',
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS teacher_notebook_records (
        id TEXT PRIMARY KEY,
        notebook_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        user_query TEXT NOT NULL DEFAULT '',
        output TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (notebook_id) REFERENCES teacher_notebooks(id)
      );
      CREATE TABLE IF NOT EXISTS teaching_books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        language TEXT NOT NULL DEFAULT 'zh-CN',
        target_level TEXT NOT NULL DEFAULT '',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS teaching_book_chapters (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        title TEXT NOT NULL,
        learning_objectives_json TEXT NOT NULL DEFAULT '[]',
        content_type TEXT NOT NULL DEFAULT 'theory',
        prerequisites_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES teaching_books(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teaching_book_pages (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        title TEXT NOT NULL,
        learning_objectives_json TEXT NOT NULL DEFAULT '[]',
        content_type TEXT NOT NULL DEFAULT 'theory',
        status TEXT NOT NULL DEFAULT 'pending',
        sort_order INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES teaching_books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES teaching_book_chapters(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teaching_book_blocks (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        title TEXT NOT NULL DEFAULT '',
        params_json TEXT NOT NULL DEFAULT '{}',
        payload_json TEXT NOT NULL DEFAULT '{}',
        source_anchors_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (page_id) REFERENCES teaching_book_pages(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teaching_book_sources (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        snippet TEXT NOT NULL DEFAULT '',
        fingerprint TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'available',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(book_id, kind, ref),
        FOREIGN KEY (book_id) REFERENCES teaching_books(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teaching_book_invalidations (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        stale_page_ids_json TEXT NOT NULL DEFAULT '[]',
        stale_block_ids_json TEXT NOT NULL DEFAULT '[]',
        detected_at TEXT NOT NULL,
        resolved_at TEXT NOT NULL DEFAULT '',
        UNIQUE(book_id, kind, ref),
        FOREIGN KEY (book_id) REFERENCES teaching_books(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teaching_book_patches (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        block_id TEXT NOT NULL,
        base_version INTEGER NOT NULL,
        result_version INTEGER NOT NULL DEFAULT 0,
        operation TEXT NOT NULL DEFAULT 'replace_block',
        before_title TEXT NOT NULL DEFAULT '',
        after_title TEXT NOT NULL DEFAULT '',
        before_payload_json TEXT NOT NULL DEFAULT '{}',
        after_payload_json TEXT NOT NULL DEFAULT '{}',
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT '',
        undone_at TEXT NOT NULL DEFAULT '',
        selection_start INTEGER NOT NULL DEFAULT 0,
        selection_end INTEGER NOT NULL DEFAULT 0,
        selected_text_hash TEXT NOT NULL DEFAULT '',
        selected_text TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (book_id) REFERENCES teaching_books(id) ON DELETE CASCADE,
        FOREIGN KEY (page_id) REFERENCES teaching_book_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (block_id) REFERENCES teaching_book_blocks(id) ON DELETE CASCADE
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
      CREATE TABLE IF NOT EXISTS question_notebook_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS question_notebook_bookmarks (
        question_id TEXT PRIMARY KEY,
        bookmarked INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (question_id) REFERENCES question_bank_items(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS question_notebook_category_links (
        question_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (question_id, category_id),
        FOREIGN KEY (question_id) REFERENCES question_bank_items(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES question_notebook_categories(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS question_bank_usage (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        usage_type TEXT NOT NULL DEFAULT 'manual',
        usage_id TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        UNIQUE (question_id, usage_type, usage_id),
        FOREIGN KEY (question_id) REFERENCES question_bank_items(id) ON DELETE CASCADE
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
        parent_run_id TEXT NOT NULL DEFAULT '',
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
      CREATE TABLE IF NOT EXISTS ai_agent_run_requests (
        run_id TEXT PRIMARY KEY,
        request_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_agent_run_actions (
        id TEXT PRIMARY KEY,
        source_run_id TEXT NOT NULL,
        action TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        child_run_id TEXT NOT NULL,
        request_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        UNIQUE(source_run_id, action, idempotency_key),
        FOREIGN KEY (source_run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (child_run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ai_agent_run_actions_child ON ai_agent_run_actions(child_run_id, created_at DESC);
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
      CREATE TABLE IF NOT EXISTS ai_memory_documents (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL DEFAULT 'L2',
        surface TEXT NOT NULL,
        title TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(layer, surface)
      );
      CREATE TABLE IF NOT EXISTS ai_memory_entries (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT 'Recent activity',
        text TEXT NOT NULL,
        refs_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        origin TEXT NOT NULL DEFAULT 'derived',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (document_id) REFERENCES ai_memory_documents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_memory_revisions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        action TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES ai_memory_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (entry_id) REFERENCES ai_memory_entries(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_memory_l3_documents (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL DEFAULT 'L3',
        slot TEXT NOT NULL,
        title TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(layer, slot)
      );
      CREATE TABLE IF NOT EXISTS ai_memory_l3_entries (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        text TEXT NOT NULL,
        source_documents_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES ai_memory_l3_documents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_capability_checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        capability_name TEXT NOT NULL,
        checkpoint_type TEXT NOT NULL,
        state_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY (run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ai_capability_checkpoints_run_status
        ON ai_capability_checkpoints(run_id, status, created_at DESC);
      CREATE TABLE IF NOT EXISTS ai_mastery_questions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        knowledge_point_id TEXT NOT NULL,
        knowledge_point_name TEXT NOT NULL,
        stem TEXT NOT NULL,
        options_json TEXT NOT NULL DEFAULT '[]',
        expected_answer TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        answer TEXT NOT NULL DEFAULT '',
        is_correct INTEGER,
        created_at TEXT NOT NULL,
        answered_at TEXT,
        graded_at TEXT,
        FOREIGN KEY (run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ai_mastery_questions_run_status
        ON ai_mastery_questions(run_id, status, created_at DESC);
      CREATE TABLE IF NOT EXISTS ai_mastery_paths (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        mode TEXT NOT NULL DEFAULT 'replace',
        modules_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_mastery_paths_student_active
        ON ai_mastery_paths(student_id) WHERE status = 'active';
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
      CREATE TABLE IF NOT EXISTS ai_usability_reviews (
        id TEXT PRIMARY KEY,
        sample_id TEXT NOT NULL,
        run_id TEXT NOT NULL DEFAULT '',
        session_id TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        route TEXT NOT NULL,
        sub_intent TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        teacher_score INTEGER NOT NULL,
        needs_rewrite INTEGER NOT NULL DEFAULT 0,
        rounds_to_useful INTEGER NOT NULL DEFAULT 1,
        main_issue_code TEXT NOT NULL DEFAULT 'none',
        teacher_note TEXT NOT NULL DEFAULT '',
        reviewed_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_usability_replay_experiments (
        id TEXT PRIMARY KEY,
        before_review_id TEXT NOT NULL,
        after_review_id TEXT NOT NULL,
        replay_prompt TEXT NOT NULL DEFAULT '',
        model_before TEXT NOT NULL DEFAULT '',
        model_after TEXT NOT NULL DEFAULT '',
        prompt_version_before TEXT NOT NULL DEFAULT '',
        prompt_version_after TEXT NOT NULL DEFAULT '',
        experiment_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(before_review_id, after_review_id),
        FOREIGN KEY (before_review_id) REFERENCES ai_usability_reviews(id),
        FOREIGN KEY (after_review_id) REFERENCES ai_usability_reviews(id)
      );
      CREATE TABLE IF NOT EXISTS ai_model_grades (
        id TEXT PRIMARY KEY,
        sample_id TEXT NOT NULL,
        run_id TEXT NOT NULL DEFAULT '',
        session_id TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        answer_markdown TEXT NOT NULL,
        route TEXT NOT NULL,
        sub_intent TEXT NOT NULL DEFAULT '',
        target_grade TEXT NOT NULL DEFAULT '',
        model_under_review TEXT NOT NULL DEFAULT '',
        grader_model TEXT NOT NULL DEFAULT '',
        grader_mode TEXT NOT NULL DEFAULT 'deterministic_proxy',
        prompt_version TEXT NOT NULL DEFAULT '',
        total_tokens INTEGER NOT NULL DEFAULT 0,
        evidence_score INTEGER NOT NULL,
        actionability_score INTEGER NOT NULL,
        safety_score INTEGER NOT NULL,
        grade_appropriateness_score INTEGER NOT NULL,
        concision_score INTEGER NOT NULL,
        teacher_control_score INTEGER NOT NULL,
        overall_score INTEGER NOT NULL,
        passed INTEGER NOT NULL DEFAULT 0,
        issue_codes_json TEXT NOT NULL DEFAULT '[]',
        grader_rationale TEXT NOT NULL DEFAULT '',
        reviewed_at TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS idx_question_notebook_bookmark ON question_notebook_bookmarks(bookmarked, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_question_notebook_category ON question_notebook_category_links(category_id, question_id);
      CREATE INDEX IF NOT EXISTS idx_question_bank_usage ON question_bank_usage(question_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_teaching_book_updated ON teaching_books(updated_at DESC, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_teaching_chapter_book ON teaching_book_chapters(book_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_teaching_page_book ON teaching_book_pages(book_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_teaching_block_page ON teaching_book_blocks(page_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_teaching_source_book ON teaching_book_sources(book_id, kind, ref);
      CREATE INDEX IF NOT EXISTS idx_teaching_invalidation_book ON teaching_book_invalidations(book_id, status, detected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_teaching_patch_book ON teaching_book_patches(book_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_exercise_sets_student ON exercise_sets(student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(sync_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_status ON ai_confirmation_items(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_session ON ai_confirmation_items(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_confirmation_run ON ai_confirmation_items(run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session ON ai_agent_runs(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_events_run ON ai_agent_events(run_id, sequence ASC);
      CREATE INDEX IF NOT EXISTS idx_ai_memory_entries_document ON ai_memory_entries(document_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_memory_revisions_entry ON ai_memory_revisions(entry_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_memory_l3_entries_document ON ai_memory_l3_entries(document_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_sessions_folder ON ai_conversation_sessions(folder_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_session ON ai_conversation_messages(session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_document_artifacts_session ON document_artifacts(session_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_artifacts_message ON document_artifacts(message_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_regression_reports_created ON ai_regression_reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_reviews_reviewed ON ai_usability_reviews(reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_reviews_route ON ai_usability_reviews(route, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_reviews_sample ON ai_usability_reviews(sample_id, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_replay_created ON ai_usability_replay_experiments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_replay_before ON ai_usability_replay_experiments(before_review_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usability_replay_after ON ai_usability_replay_experiments(after_review_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_model_grades_reviewed ON ai_model_grades(reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_model_grades_route ON ai_model_grades(route, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_model_grades_mode ON ai_model_grades(grader_mode, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_teacher_resources_status ON teacher_resources(parse_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource ON resource_chunks(resource_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_task ON ai_tool_runs(task_id);
    `);
    await this.ensureFts();
    const reportColumns = await this.all(`PRAGMA table_info(review_reports)`);
    if (!hasColumn(reportColumns, "parent_summary")) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN parent_summary TEXT NOT NULL DEFAULT ''`);
    }
    if (!hasColumn(reportColumns, "quality_checks_json")) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN quality_checks_json TEXT NOT NULL DEFAULT '[]'`);
    }
    const aiAgentRunColumns = await this.all(`PRAGMA table_info(ai_agent_runs)`);
    if (!hasColumn(aiAgentRunColumns, "parent_run_id")) {
      await this.run(`ALTER TABLE ai_agent_runs ADD COLUMN parent_run_id TEXT NOT NULL DEFAULT ''`);
    }
    const aiFolderColumns = await this.all(`PRAGMA table_info(ai_conversation_folders)`);
    if (!hasColumn(aiFolderColumns, "archived_at")) {
      await this.run(`ALTER TABLE ai_conversation_folders ADD COLUMN archived_at TEXT`);
    }
    const aiSessionColumns = await this.all(`PRAGMA table_info(ai_conversation_sessions)`);
    if (!hasColumn(aiSessionColumns, "archived_at")) {
      await this.run(`ALTER TABLE ai_conversation_sessions ADD COLUMN archived_at TEXT`);
    }
    const chunkColumns = await this.all(`PRAGMA table_info(resource_chunks)`);
    for (const [column, definition] of [
      ["subject", `TEXT NOT NULL DEFAULT ''`],
      ["grade", `TEXT NOT NULL DEFAULT ''`],
      ["knowledge_point", `TEXT NOT NULL DEFAULT ''`],
      ["question_type", `TEXT NOT NULL DEFAULT ''`],
      ["difficulty", `TEXT NOT NULL DEFAULT ''`],
      ["source_trust", `TEXT NOT NULL DEFAULT 'unverified'`],
      ["contains_personal_data", `INTEGER NOT NULL DEFAULT 0`],
      ["quality_score", `INTEGER NOT NULL DEFAULT 0`],
      ["evidence_strength", `TEXT NOT NULL DEFAULT 'background'`]
    ]) {
      if (!hasColumn(chunkColumns, column)) {
        await this.run(`ALTER TABLE resource_chunks ADD COLUMN ${column} ${definition}`);
      }
    }
    const nodeColumns = await this.all(`PRAGMA table_info(knowledge_nodes)`);
    if (!hasColumn(nodeColumns, "evidence_strength")) {
      await this.run(`ALTER TABLE knowledge_nodes ADD COLUMN evidence_strength TEXT NOT NULL DEFAULT 'background'`);
    }
    const edgeColumns = await this.all(`PRAGMA table_info(knowledge_edges)`);
    if (!hasColumn(edgeColumns, "evidence_strength")) {
      await this.run(`ALTER TABLE knowledge_edges ADD COLUMN evidence_strength TEXT NOT NULL DEFAULT 'background'`);
    }
    if (!hasColumn(edgeColumns, "evidence_kind")) {
      await this.run(`ALTER TABLE knowledge_edges ADD COLUMN evidence_kind TEXT NOT NULL DEFAULT 'inferred'`);
    }
    const modelGradeColumns = await this.all(`PRAGMA table_info(ai_model_grades)`);
    for (const [column, definition] of [
      ["run_id", `TEXT NOT NULL DEFAULT ''`],
      ["session_id", `TEXT NOT NULL DEFAULT ''`],
      ["prompt_version", `TEXT NOT NULL DEFAULT ''`],
      ["total_tokens", `INTEGER NOT NULL DEFAULT 0`]
    ]) {
      if (!hasColumn(modelGradeColumns, column)) {
        await this.run(`ALTER TABLE ai_model_grades ADD COLUMN ${column} ${definition}`);
      }
    }
    const teachingPatchColumns = await this.all(`PRAGMA table_info(teaching_book_patches)`);
    for (const [column, definition] of [
      ["selection_start", `INTEGER NOT NULL DEFAULT 0`],
      ["selection_end", `INTEGER NOT NULL DEFAULT 0`],
      ["selected_text_hash", `TEXT NOT NULL DEFAULT ''`],
      ["selected_text", `TEXT NOT NULL DEFAULT ''`]
    ]) {
      if (!hasColumn(teachingPatchColumns, column)) {
        await this.run(`ALTER TABLE teaching_book_patches ADD COLUMN ${column} ${definition}`);
      }
    }
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ai_model_grades_run ON ai_model_grades(run_id, reviewed_at DESC)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_resource_chunks_metadata ON resource_chunks(subject, grade, knowledge_point, question_type)`);
    await this.seedPlatformDefaults();
    await this.rebuildRecordFtsIfEmpty();
  }
  async seedIfEmpty() {
    const count = Number((await this.all("SELECT COUNT(*) AS count FROM students"))[0]?.count ?? 0);
    if (count > 0) return;
    await this.createStudent({
      displayName: "\u5C0FA",
      grade: "\u521D\u4E8C",
      subjects: ["\u6570\u5B66", "\u82F1\u8BED"],
      goals: "\u671F\u672B\u6570\u5B66\u7A33\u5B9A\u5728 90 \u5206\u4EE5\u4E0A",
      currentIssues: "\u51FD\u6570\u56FE\u50CF\u7406\u89E3\u4E0D\u7A33\uFF0C\u79FB\u9879\u548C\u7B26\u53F7\u9519\u8BEF\u53CD\u590D\u51FA\u73B0\u3002",
      parentConcerns: "\u5E0C\u671B\u770B\u5230\u6BCF\u6708\u8FDB\u6B65\u53CD\u9988\u3002",
      tags: ["\u51FD\u6570", "\u8BA1\u7B97\u7EC6\u8282", "\u5BB6\u957F\u9AD8\u5173\u6CE8"]
    });
    const studentId = (await this.listStudents("\u5C0FA"))[0].id;
    await this.createRecord({
      studentId,
      recordType: "mistake",
      subject: "\u6570\u5B66",
      title: "\u4E00\u6B21\u51FD\u6570\u56FE\u50CF\u4E0E\u53C2\u6570\u5173\u7CFB",
      content: "\u8FDE\u7EED\u4E09\u6B21\u628A k \u503C\u6B63\u8D1F\u4E0E\u56FE\u50CF\u8D70\u5411\u5BF9\u5E94\u505A\u9519\uFF0C\u9700\u8981\u4ECE\u56FE\u50CF\u53D8\u5316\u91CD\u65B0\u8BB2\u89E3\u3002",
      tags: ["\u4E00\u6B21\u51FD\u6570", "\u6982\u5FF5\u6DF7\u6DC6"],
      occurredAt: new Date(Date.now() - 864e5).toISOString()
    });
    await this.createRecord({
      studentId,
      recordType: "homework",
      subject: "\u6570\u5B66",
      title: "\u65B9\u7A0B\u5E94\u7528\u9898\u8BA2\u6B63",
      content: "\u80FD\u5217\u5F0F\uFF0C\u4F46\u5355\u4F4D\u8F6C\u6362\u548C\u672A\u77E5\u6570\u8BF4\u660E\u4E0D\u7A33\u5B9A\u3002",
      tags: ["\u5BA1\u9898", "\u8868\u8FBE\u89C4\u8303"],
      occurredAt: new Date(Date.now() - 2 * 864e5).toISOString()
    });
  }
  async seedPlatformDefaults() {
    const timestamp = now();
    if (await this.scalarCount("users") === 0) {
      await this.run(
        `INSERT INTO users (id, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, 'owner', 'active', ?, ?)`,
        [`user_${randomUUID()}`, "\u9ED8\u8BA4\u8001\u5E08", timestamp, timestamp]
      );
    }
    if (await this.scalarCount("tag_dictionary") === 0) {
      for (const [name, category, color] of [
        ["\u6982\u5FF5\u6DF7\u6DC6", "\u9519\u56E0", "#9a5b08"],
        ["\u8BA1\u7B97\u7C97\u5FC3", "\u80FD\u529B", "#b34035"],
        ["\u8868\u8FBE\u4E0D\u89C4\u8303", "\u4E60\u60EF", "#2457a6"],
        ["\u5BB6\u957F\u9AD8\u5173\u6CE8", "\u6C9F\u901A", "#1d5c52"]
      ]) {
        await this.run(
          `INSERT INTO tag_dictionary (id, name, category, color, description, scope, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', 'team-ready', ?, ?)`,
          [`tag_${randomUUID()}`, name, category, color, timestamp, timestamp]
        );
      }
    }
    if (await this.scalarCount("report_templates") === 0) {
      await this.run(
        `INSERT INTO report_templates (id, name, report_type, subject, content_md, scope, is_default, created_at, updated_at)
         VALUES (?, '\u9636\u6BB5\u590D\u76D8\u6807\u51C6\u6A21\u677F', 'monthly', '', ?, 'team-ready', 1, ?, ?)`,
        [
          `template_${randomUUID()}`,
          "# \u9636\u6BB5\u590D\u76D8\n\n## \u6574\u4F53\u8868\u73B0\n\n## \u4E3B\u8981\u8FDB\u6B65\n\n## \u9AD8\u9891\u8584\u5F31\u70B9\n\n## \u4E0B\u9636\u6BB5\u5EFA\u8BAE\n\n## \u5BB6\u957F\u6C9F\u901A\u7248\u6458\u8981\n",
          timestamp,
          timestamp
        ]
      );
    }
    if (await this.scalarCount("question_bank_items") === 0) {
      await this.createQuestionBankItem({
        subject: "\u6570\u5B66",
        grade: "\u521D\u4E8C",
        knowledgePoint: "\u4E00\u6B21\u51FD\u6570",
        questionType: "\u89E3\u7B54\u9898",
        difficulty: "medium",
        stem: "\u5DF2\u77E5\u4E00\u6B21\u51FD\u6570 y = kx + b \u7ECF\u8FC7\u70B9 (0, 2) \u548C (3, 8)\uFF0C\u6C42 k\u3001b\uFF0C\u5E76\u5224\u65AD\u56FE\u50CF\u968F x \u589E\u5927\u5982\u4F55\u53D8\u5316\u3002",
        answer: "b = 2\uFF0C3k + 2 = 8\uFF0C\u6240\u4EE5 k = 2\uFF1B\u56FE\u50CF\u968F x \u589E\u5927\u800C\u589E\u5927\u3002",
        analysis: "\u5148\u7528 x=0 \u5F97\u5230\u622A\u8DDD b\uFF0C\u518D\u4EE3\u5165\u53E6\u4E00\u70B9\u6C42\u659C\u7387 k\uFF1Bk>0 \u8868\u793A\u9012\u589E\u3002",
        sourceTitle: "\u5185\u7F6E\u6F14\u793A\u9898\u5E93",
        tags: ["\u4E00\u6B21\u51FD\u6570", "k\u503C", "\u56FE\u50CF\u6027\u8D28"]
      });
      await this.createQuestionBankItem({
        subject: "\u6570\u5B66",
        grade: "\u521D\u4E8C",
        knowledgePoint: "\u4E00\u6B21\u51FD\u6570",
        questionType: "\u53D8\u5F0F\u9898",
        difficulty: "medium",
        stem: "\u4E00\u6B21\u51FD\u6570 y = -3x + 5 \u7684\u56FE\u50CF\u7ECF\u8FC7\u54EA\u4E9B\u8C61\u9650\uFF1F\u51FD\u6570\u503C\u968F x \u589E\u5927\u5982\u4F55\u53D8\u5316\uFF1F",
        answer: "\u7ECF\u8FC7\u7B2C\u4E00\u3001\u4E8C\u3001\u56DB\u8C61\u9650\uFF1B\u51FD\u6570\u503C\u968F x \u589E\u5927\u800C\u51CF\u5C0F\u3002",
        analysis: "b>0\uFF0Ck<0\uFF0C\u6240\u4EE5\u56FE\u50CF\u8FC7\u4E00\u4E8C\u56DB\u8C61\u9650\uFF1B\u659C\u7387\u4E3A\u8D1F\u8868\u793A\u9012\u51CF\u3002",
        sourceTitle: "\u5185\u7F6E\u6F14\u793A\u9898\u5E93",
        tags: ["\u4E00\u6B21\u51FD\u6570", "\u8C61\u9650", "\u589E\u51CF\u6027"]
      });
    }
  }
  async ensureTeacherLibraryNode() {
    const timestamp = now();
    await this.run(
      `INSERT OR IGNORE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
      ) VALUES ('node_teacher_library', '\u77E5\u8BC6\u5E93', '\u8001\u5E08\u77E5\u8BC6\u5E93', '\u8001\u5E08\u672C\u5730\u5BFC\u5165\u7684\u6559\u5B66\u8D44\u6E90\u96C6\u5408\u3002', 'system', 'teacher_library', 1, 'background', ?, ?)`,
      [timestamp, timestamp]
    );
  }
  async createResourceGraph(resourceId, title, resourceType, fileSize, timestamp) {
    const nodeId = `node_${resourceId}`;
    await this.run(
      `INSERT OR REPLACE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
      ) VALUES (?, '\u8D44\u6E90', ?, ?, 'teacher_resource', ?, 1, 'background', ?, ?)`,
      [nodeId, title, `${resourceType} \u6587\u4EF6\uFF0C${fileSize} bytes\u3002`, resourceId, timestamp, timestamp]
    );
    await this.run(
      `INSERT OR IGNORE INTO knowledge_edges (
        id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
      ) VALUES (?, 'node_teacher_library', ?, '\u5305\u542B', ?, ?, 1, 'background', 'metadata', ?)`,
      [`edge_library_${resourceId}`, nodeId, resourceId, title, timestamp]
    );
  }
  async createResourceChunksAndGraph(resourceId, resourceTitle, content, timestamp) {
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
          timestamp
        ]
      );
      const nodeId = `node_${chunkId}`;
      await this.run(
        `INSERT OR REPLACE INTO knowledge_nodes (
          id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
        [
          nodeId,
          chunk.heading ? "\u7AE0\u8282" : "\u7247\u6BB5",
          chunk.heading || `${resourceTitle} #${index + 1}`,
          chunk.content.slice(0, 180),
          chunkId,
          metadata.qualityScore / 100,
          metadata.evidenceStrength,
          timestamp,
          timestamp
        ]
      );
      await this.run(
        `INSERT OR IGNORE INTO knowledge_edges (
          id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
        ) VALUES (?, ?, ?, '\u5305\u542B', ?, ?, ?, ?, 'direct_quote', ?)`,
        [`edge_${resourceId}_${chunkId}`, `node_${resourceId}`, nodeId, chunkId, resourceTitle, metadata.qualityScore / 100, metadata.evidenceStrength, timestamp]
      );
      if (metadata.knowledgePoint) {
        const knowledgePointNodeId = stableKnowledgeId("node_kp", metadata.knowledgePoint);
        await this.run(
          `INSERT OR REPLACE INTO knowledge_nodes (
            id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
          ) VALUES (?, '\u77E5\u8BC6\u70B9', ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
          [
            knowledgePointNodeId,
            metadata.knowledgePoint,
            `${metadata.subject || "\u672A\u77E5\u5B66\u79D1"} / ${metadata.grade || "\u672A\u6807\u5E74\u7EA7"}\uFF1A${chunk.content.slice(0, 140)}`,
            chunkId,
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
            timestamp
          ]
        );
        await this.run(
          `INSERT OR IGNORE INTO knowledge_edges (
            id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
          ) VALUES (?, ?, ?, '\u6D89\u53CA', ?, ?, ?, ?, 'direct_quote', ?)`,
          [
            `edge_${chunkId}_${knowledgePointNodeId}`,
            `node_${chunkId}`,
            knowledgePointNodeId,
            chunkId,
            chunk.heading || chunk.content.slice(0, 80),
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp
          ]
        );
      }
      if (metadata.questionType) {
        const questionTypeNodeId = stableKnowledgeId("node_qt", metadata.questionType);
        await this.run(
          `INSERT OR REPLACE INTO knowledge_nodes (
            id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
          ) VALUES (?, '\u9898\u578B', ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
          [
            questionTypeNodeId,
            metadata.questionType,
            `${metadata.subject || "\u672A\u77E5\u5B66\u79D1"} \u9898\u578B\uFF1A${metadata.questionType}`,
            chunkId,
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp,
            timestamp
          ]
        );
        await this.run(
          `INSERT OR IGNORE INTO knowledge_edges (
            id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
          ) VALUES (?, ?, ?, '\u9898\u578B', ?, ?, ?, ?, 'direct_quote', ?)`,
          [
            `edge_${chunkId}_${questionTypeNodeId}`,
            `node_${chunkId}`,
            questionTypeNodeId,
            chunkId,
            chunk.heading || chunk.content.slice(0, 80),
            metadata.qualityScore / 100,
            metadata.evidenceStrength,
            timestamp
          ]
        );
      }
    }
  }
  async enqueueResourceParseTask(resourceId, title, resourceType, timestamp) {
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'resource_parse', 'pending', ?, ?, NULL, '', 0, ?, ?)`,
      [
        `task_${randomUUID()}`,
        createHash2("sha256").update(resourceId).digest("hex"),
        JSON.stringify({
          resourceId,
          title,
          resourceType,
          engine: resourceType === "image" ? "MinerU/OCR \u5F85\u63A5\u5165" : "Docling \u5F85\u63A5\u5165"
        }),
        timestamp,
        timestamp
      ]
    );
  }
  async listAttachments(recordId) {
    return (await this.all(`SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC`, [recordId])).map(this.mapAttachment);
  }
  async listAttachmentsForRecords(recordIds) {
    const grouped = /* @__PURE__ */ new Map();
    if (!recordIds.length) return grouped;
    const rows = (await this.all(
      `SELECT * FROM attachments WHERE record_id IN (${recordIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
      recordIds
    )).map(this.mapAttachment);
    for (const attachment of rows) {
      if (!attachment.recordId) continue;
      const group = grouped.get(attachment.recordId) ?? [];
      group.push(attachment);
      grouped.set(attachment.recordId, group);
    }
    return grouped;
  }
  async withAttachments(records) {
    const attachmentsByRecord = await this.listAttachmentsForRecords(records.map((record) => record.id));
    return records.map((record) => ({ ...record, attachments: attachmentsByRecord.get(record.id) ?? [] }));
  }
  studentRoot(studentId) {
    return this.resolveInsideDataRoot("students", studentId);
  }
  resolveInsideDataRoot(...parts) {
    return resolveInsideRoot(this.dataRoot, ...parts);
  }
  copyDirectory(source, target) {
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
  async touchStudent(studentId) {
    await this.run(`UPDATE students SET updated_at = ? WHERE id = ?`, [now(), studentId]);
  }
  async ensureAiConversationFolder(folderId) {
    const folder = (await this.all(`SELECT id FROM ai_conversation_folders WHERE id = ?`, [folderId]))[0];
    if (!folder) throw new Error("AI \u5BF9\u8BDD\u6587\u4EF6\u5939\u4E0D\u5B58\u5728");
  }
  async getAiConfirmationOrThrow(id) {
    const row = (await this.all(`SELECT * FROM ai_confirmation_items WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("\u786E\u8BA4\u9879\u4E0D\u5B58\u5728");
    return this.mapAiConfirmationItem(row);
  }
  async getAiCapabilityCheckpointOrThrow(id) {
    const row = (await this.all(`SELECT * FROM ai_capability_checkpoints WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("\u80FD\u529B checkpoint \u4E0D\u5B58\u5728");
    return this.mapAiCapabilityCheckpoint(row);
  }
  async getAiMasteryQuestionOrThrow(id) {
    const row = (await this.all(`SELECT * FROM ai_mastery_questions WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("Mastery \u9898\u76EE\u4E0D\u5B58\u5728");
    return this.mapAiMasteryQuestion(row);
  }
  async getMistakeImageAnalysisOrThrow(id) {
    const row = (await this.all(`SELECT * FROM mistake_image_analyses WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("\u9519\u9898\u56FE\u7247\u89E3\u6790\u8BB0\u5F55\u4E0D\u5B58\u5728");
    return this.mapMistakeImageAnalysis(row);
  }
  async getDocumentArtifactOrThrow(id) {
    const row = (await this.all(`SELECT * FROM document_artifacts WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("\u6587\u6863\u4EA7\u7269\u5BFC\u51FA\u540E\u672A\u80FD\u8BFB\u56DE");
    return this.mapDocumentArtifact(row);
  }
  async getAiRegressionReportOrThrow(id) {
    const row = (await this.all(`SELECT * FROM ai_regression_reports WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("AI \u56DE\u5F52\u62A5\u544A\u751F\u6210\u540E\u672A\u80FD\u8BFB\u56DE");
    return this.mapAiRegressionReport(row);
  }
  async executeAiConfirmation(item) {
    if (item.actionType === "create_review_report") {
      const report = await this.createReviewReportFromConfirmation(item.payload);
      return { report };
    }
    if (item.actionType === "save_exercise_set") {
      const exerciseSet = await this.createExerciseSetFromConfirmation(item.payload);
      return { exerciseSet };
    }
    if (item.actionType === "save_mastery_state") {
      const studentId = requireNonEmpty(item.payload.studentId, "Mastery confirmation missing studentId");
      const student = (await this.listStudents("")).find((candidate) => candidate.id === studentId);
      if (!student) throw new Error("Student does not exist");
      if (item.payload.masteryOperation === "build") {
        const pathPayload = item.payload.masteryPath;
        if (!pathPayload?.modules?.length) throw new Error("Mastery path confirmation missing modules");
        const masteryPath = await this.upsertAiMasteryPath({ studentId, mode: pathPayload.mode, modules: pathPayload.modules });
        return { masteryPath };
      }
      const assessment = item.payload.masteryAssessment;
      if (!assessment) throw new Error("Mastery assessment confirmation missing payload");
      if (!["concept", "design"].includes(assessment.knowledgeType)) throw new Error("Only concept/design assessment can be confirmed");
      await this.createRecord({
        studentId,
        recordType: "mastery_attempt",
        subject: "mastery_assessment",
        title: `Mastery assessment: ${assessment.knowledgePointName}`,
        content: JSON.stringify({
          knowledgePoint: assessment.knowledgePointName,
          knowledgeType: assessment.knowledgeType,
          isCorrect: assessment.passed,
          feedback: assessment.feedback ?? ""
        }),
        tags: [assessment.knowledgePointName, "mastery_assess"]
      });
      return { masteryAttempt: { studentId, knowledgePointId: assessment.knowledgePointId, passed: assessment.passed } };
    }
    throw new Error(`\u4E0D\u652F\u6301\u7684\u786E\u8BA4\u52A8\u4F5C\uFF1A${item.actionType}`);
  }
  async createExerciseSetFromConfirmation(payload) {
    const studentId = requireNonEmpty(payload.studentId, "\u786E\u8BA4\u9879\u7F3A\u5C11\u5B66\u751F ID");
    const student = (await this.listStudents("")).find((item) => item.id === studentId);
    if (!student) throw new Error("\u5B66\u751F\u4E0D\u5B58\u5728");
    const draft = payload.exerciseSet ?? {
      title: payload.title || "\u5C0F\u667A\u4E09\u5143\u9898\u7EC4",
      subject: payload.subject,
      knowledgePoint: "",
      contentMd: payload.contentMd,
      sourceQuestionIds: [],
      items: []
    };
    const exerciseSet = await this.saveExerciseSetFromDraft(studentId, draft);
    const readback = (await this.all(`SELECT * FROM exercise_sets WHERE id = ?`, [exerciseSet.id]))[0];
    if (!readback) throw new Error("\u786E\u8BA4\u540E\u672A\u80FD\u8BFB\u56DE\u4E09\u5143\u9898\u7EC4");
    return this.mapExerciseSet(readback);
  }
  async createReviewReportFromConfirmation(payload) {
    const studentId = requireNonEmpty(payload.studentId, "\u786E\u8BA4\u9879\u7F3A\u5C11\u5B66\u751F ID");
    const student = (await this.listStudents("")).find((item) => item.id === studentId);
    if (!student) throw new Error("\u5B66\u751F\u4E0D\u5B58\u5728");
    const title = requireNonEmpty(payload.title, "\u786E\u8BA4\u9879\u7F3A\u5C11\u62A5\u544A\u6807\u9898");
    const contentMd = requireNonEmpty(payload.contentMd, "\u786E\u8BA4\u9879\u7F3A\u5C11\u62A5\u544A\u6B63\u6587");
    const parentSummary = payload.parentSummary?.trim() || "AI \u5DF2\u751F\u6210\u590D\u76D8\u8349\u7A3F\uFF0C\u8BF7\u8001\u5E08\u786E\u8BA4\u540E\u518D\u7528\u4E8E\u5BB6\u957F\u6C9F\u901A\u3002";
    const sourceRecordIds = (payload.sourceRecordIds ?? []).filter(Boolean);
    const sourceRecords = sourceRecordIds.length ? await this.recordsByIds(studentId, sourceRecordIds) : [];
    const qualityChecks = this.buildReportQualityChecks(sourceRecords, contentMd, parentSummary);
    const timestamp = now();
    const report = {
      id: `report_${randomUUID()}`,
      studentId,
      subject: payload.subject ?? "",
      startDate: payload.startDate,
      endDate: payload.endDate,
      reportType: payload.reportType || "ai_draft",
      title,
      contentMd,
      parentSummary,
      qualityChecks,
      sourceRecordIds,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const reportRoot = this.resolveInsideDataRoot("students", studentId, "reports");
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
          report.updatedAt
        ]
      );
      writeFileSync(reportPath, contentMd, "utf8");
      fileWritten = true;
      await this.touchStudent(studentId);
      const readback = (await this.all(`SELECT * FROM review_reports WHERE id = ?`, [report.id]))[0];
      if (!readback) throw new Error("\u786E\u8BA4\u540E\u672A\u80FD\u8BFB\u56DE\u590D\u76D8\u62A5\u544A");
      await this.run(`COMMIT`);
      return this.mapReport(readback);
    } catch (error) {
      await this.run(`ROLLBACK`).catch(() => void 0);
      if (fileWritten) rmSync(reportPath, { force: true });
      throw error;
    }
  }
  async recordsByIds(studentId, recordIds) {
    const uniqueIds = [...new Set(recordIds)].slice(0, 50);
    if (!uniqueIds.length) return [];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = await this.all(
      `SELECT * FROM learning_records WHERE student_id = ? AND id IN (${placeholders})`,
      [studentId, ...uniqueIds]
    );
    const records = rows.map((row) => this.mapRecord(row));
    return this.withAttachments(records);
  }
  run(sql, params = []) {
    return new Promise((resolveRun, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) reject(error);
        else resolveRun();
      });
    });
  }
  runWithChanges(sql, params = []) {
    return new Promise((resolveRun, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolveRun(this.changes > 0);
      });
    });
  }
  all(sql, params = []) {
    return new Promise((resolveAll, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolveAll(rows ?? []);
      });
    });
  }
  exec(sql) {
    return new Promise((resolveExec, reject) => {
      this.db.exec(sql, (error) => {
        if (error) reject(error);
        else resolveExec();
      });
    });
  }
  async scalarCount(table, where) {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "");
    const rows = await this.all(`SELECT COUNT(*) AS count FROM ${safeTable}${where ? ` WHERE ${where}` : ""}`);
    return Number(rows[0]?.count ?? 0);
  }
  mapStudent(row) {
    return {
      id: String(row.id),
      displayName: String(row.display_name ?? ""),
      realName: String(row.real_name ?? ""),
      grade: String(row.grade ?? ""),
      school: String(row.school ?? ""),
      subjects: jsonArray(row.subjects),
      goals: String(row.goals ?? ""),
      currentIssues: String(row.current_issues ?? ""),
      parentConcerns: String(row.parent_concerns ?? ""),
      teacherNotes: String(row.teacher_notes ?? ""),
      tags: jsonArray(row.tags),
      status: String(row.status ?? "active") === "archived" ? "archived" : "active",
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      recordCount: Number(row.record_count ?? 0),
      attachmentBytes: Number(row.attachment_bytes ?? 0)
    };
  }
  mapRecord(row) {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordType: String(row.record_type ?? ""),
      subject: String(row.subject ?? ""),
      title: String(row.title ?? ""),
      content: String(row.content ?? ""),
      summary: String(row.summary ?? ""),
      tags: jsonArray(row.tags),
      occurredAt: String(row.occurred_at ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      attachments: []
    };
  }
  mapAttachment(row) {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordId: row.record_id ? String(row.record_id) : null,
      fileName: String(row.file_name ?? ""),
      filePath: String(row.file_path ?? ""),
      fileType: String(row.file_type ?? ""),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ""),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapMistakeImageAnalysis(row) {
    const status = String(row.ocr_status ?? "needs_ocr");
    return {
      id: String(row.id),
      studentId: String(row.student_id ?? ""),
      recordId: String(row.record_id ?? ""),
      attachmentId: String(row.attachment_id ?? ""),
      localPath: String(row.local_path ?? ""),
      ocrStatus: status === "sanitized" || status === "teacher_corrected" || status === "failed" ? status : "needs_ocr",
      extractedText: String(row.extracted_text ?? ""),
      sanitizedText: String(row.sanitized_text ?? ""),
      redactions: parseMistakeImageRedactions(row.redactions_json),
      teacherCorrectedText: String(row.teacher_corrected_text ?? ""),
      errorMessage: String(row.error_message ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  async getTeacherNotebook(id) {
    const row = (await this.all(`SELECT n.*, COUNT(r.id) AS record_count FROM teacher_notebooks n LEFT JOIN teacher_notebook_records r ON r.notebook_id = n.id AND r.deleted_at = '' WHERE n.id = ? GROUP BY n.id`, [id]))[0];
    return row ? this.mapTeacherNotebook(row) : null;
  }
  async getTeacherNotebookOrThrow(id) {
    const notebook = await this.getTeacherNotebook(id);
    if (!notebook) throw new Error("\u5907\u8BFE\u672C\u4E0D\u5B58\u5728");
    return notebook;
  }
  async getTeacherNotebookRecordOrThrow(id) {
    const row = (await this.all(`SELECT * FROM teacher_notebook_records WHERE id = ?`, [id]))[0];
    if (!row) throw new Error("\u5907\u8BFE\u672C\u7B14\u8BB0\u4E0D\u5B58\u5728");
    return this.mapTeacherNotebookRecord(row);
  }
  mapTeacherNotebook(row) {
    const status = String(row.status ?? "active");
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      color: String(row.color ?? "#3B82F6"),
      icon: String(row.icon ?? "book"),
      status: status === "deleted" ? "deleted" : "active",
      version: Math.max(1, Number(row.version ?? 1)),
      recordCount: Number(row.record_count ?? 0),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      deletedAt: String(row.deleted_at ?? "")
    };
  }
  mapTeacherNotebookRecord(row) {
    const type = String(row.record_type ?? "chat");
    const allowed = /* @__PURE__ */ new Set(["solve", "question", "research", "chat", "co_writer", "tutorbot", "guided_learning"]);
    return {
      id: String(row.id ?? ""),
      notebookId: String(row.notebook_id ?? ""),
      recordType: allowed.has(type) ? type : "chat",
      title: String(row.title ?? ""),
      summary: String(row.summary ?? ""),
      userQuery: String(row.user_query ?? ""),
      output: String(row.output ?? ""),
      metadata: jsonObject(row.metadata_json),
      version: Math.max(1, Number(row.version ?? 1)),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      deletedAt: String(row.deleted_at ?? "")
    };
  }
  mapReport(row) {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      subject: String(row.subject ?? ""),
      startDate: String(row.start_date ?? ""),
      endDate: String(row.end_date ?? ""),
      reportType: String(row.report_type ?? ""),
      title: String(row.title ?? ""),
      contentMd: String(row.content_md ?? ""),
      parentSummary: String(row.parent_summary ?? ""),
      qualityChecks: this.parseQualityChecks(row.quality_checks_json),
      sourceRecordIds: jsonArray(row.source_record_ids),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapTeachingBook(row) {
    return { id: String(row.id ?? ""), title: String(row.title ?? ""), description: String(row.description ?? ""), status: String(row.status ?? "draft"), language: String(row.language ?? "zh-CN"), targetLevel: String(row.target_level ?? ""), version: Math.max(1, Number(row.version ?? 1)), chapterCount: Math.max(0, Number(row.chapter_count ?? 0)), pageCount: Math.max(0, Number(row.page_count ?? 0)), sourceCount: Math.max(0, Number(row.source_count ?? 0)), createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? ""), deletedAt: String(row.deleted_at ?? "") };
  }
  mapTeachingBookChapter(row) {
    return { id: String(row.id ?? ""), bookId: String(row.book_id ?? ""), title: String(row.title ?? ""), learningObjectives: jsonArray(row.learning_objectives_json).slice(0, 12), contentType: String(row.content_type ?? "theory"), prerequisites: jsonArray(row.prerequisites_json).slice(0, 12), summary: String(row.summary ?? ""), order: Math.max(0, Number(row.sort_order ?? 0)), version: Math.max(1, Number(row.version ?? 1)), createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
  }
  mapTeachingBookPage(row) {
    return { id: String(row.id ?? ""), bookId: String(row.book_id ?? ""), chapterId: String(row.chapter_id ?? ""), title: String(row.title ?? ""), learningObjectives: jsonArray(row.learning_objectives_json).slice(0, 12), contentType: String(row.content_type ?? "theory"), status: String(row.status ?? "pending"), order: Math.max(0, Number(row.sort_order ?? 0)), version: Math.max(1, Number(row.version ?? 1)), blockCount: Math.max(0, Number(row.block_count ?? 0)), error: String(row.error ?? ""), createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
  }
  mapTeachingBookBlock(row) {
    return { id: String(row.id ?? ""), pageId: String(row.page_id ?? ""), type: String(row.type ?? "text"), status: String(row.status ?? "pending"), title: String(row.title ?? ""), params: jsonObject(row.params_json), payload: jsonObject(row.payload_json), sourceAnchors: jsonUnknownArray(row.source_anchors_json).slice(0, 20), metadata: jsonObject(row.metadata_json), order: Math.max(0, Number(row.sort_order ?? 0)), version: Math.max(1, Number(row.version ?? 1)), error: String(row.error ?? ""), createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
  }
  mapTeachingSource(row) {
    return { kind: String(row.kind), ref: String(row.ref ?? ""), title: String(row.title ?? ""), snippet: String(row.snippet ?? ""), fingerprint: String(row.fingerprint ?? ""), status: String(row.status ?? "available") };
  }
  mapTeachingBookPatch(row) {
    return {
      id: String(row.id ?? ""),
      bookId: String(row.book_id ?? ""),
      pageId: String(row.page_id ?? ""),
      blockId: String(row.block_id ?? ""),
      baseVersion: Math.max(1, Number(row.base_version ?? 1)),
      resultVersion: Math.max(0, Number(row.result_version ?? 0)),
      operation: String(row.operation ?? "replace_block") === "replace_selection" || String(row.operation ?? "") === "automark_selection" ? String(row.operation) : "replace_block",
      beforeTitle: String(row.before_title ?? ""),
      afterTitle: String(row.after_title ?? ""),
      beforePayload: jsonObject(row.before_payload_json),
      afterPayload: jsonObject(row.after_payload_json),
      reason: String(row.reason ?? ""),
      status: String(row.status ?? "draft"),
      error: String(row.error ?? ""),
      createdAt: String(row.created_at ?? ""),
      appliedAt: String(row.applied_at ?? ""),
      undoneAt: String(row.undone_at ?? ""),
      selectionStart: Math.max(0, Number(row.selection_start ?? 0)),
      selectionEnd: Math.max(0, Number(row.selection_end ?? 0)),
      selectedTextHash: String(row.selected_text_hash ?? ""),
      selectedText: String(row.selected_text ?? "")
    };
  }
  mapQuestionBankItem(row) {
    const difficulty = String(row.difficulty ?? "medium");
    const sourceKind = String(row.source_kind ?? "local_bank");
    return {
      id: String(row.id),
      subject: String(row.subject ?? ""),
      grade: String(row.grade ?? ""),
      knowledgePoint: String(row.knowledge_point ?? ""),
      questionType: String(row.question_type ?? ""),
      difficulty: difficulty === "easy" || difficulty === "hard" ? difficulty : "medium",
      stem: String(row.stem ?? ""),
      answer: String(row.answer ?? ""),
      analysis: String(row.analysis ?? ""),
      sourceTitle: String(row.source_title ?? ""),
      sourceKind: sourceKind === "teacher_resource" || sourceKind === "generated" ? sourceKind : "local_bank",
      tags: jsonArray(row.tags),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  async getQuestionBankItem(id) {
    const row = (await this.all(`SELECT * FROM question_bank_items WHERE id = ?`, [id]))[0];
    return row ? this.mapQuestionBankItem(row) : void 0;
  }
  mapQuestionNotebookCategory(row) {
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      status: String(row.status ?? "active") === "deleted" ? "deleted" : "active",
      version: Math.max(1, Number(row.version ?? 1)),
      entryCount: Math.max(0, Number(row.entry_count ?? 0)),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      deletedAt: String(row.deleted_at ?? "")
    };
  }
  async listQuestionNotebookCategoriesForQuestion(questionId) {
    const rows = await this.all(`SELECT c.*, COUNT(l2.question_id) AS entry_count
      FROM question_notebook_categories c
      INNER JOIN question_notebook_category_links l ON l.category_id = c.id AND l.question_id = ?
      LEFT JOIN question_notebook_category_links l2 ON l2.category_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id ORDER BY c.name`, [questionId]);
    return rows.map((row) => this.mapQuestionNotebookCategory(row));
  }
  mapQuestionNotebookUsage(row) {
    const usageType = String(row.usage_type ?? "manual");
    return {
      id: String(row.id ?? ""),
      questionId: String(row.question_id ?? ""),
      usageType: usageType === "exercise_set" || usageType === "learning_record" ? usageType : "manual",
      usageId: String(row.usage_id ?? ""),
      metadata: jsonObject(row.metadata_json),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapExerciseSet(row) {
    return {
      id: String(row.id),
      studentId: String(row.student_id ?? ""),
      title: String(row.title ?? ""),
      subject: String(row.subject ?? ""),
      knowledgePoint: String(row.knowledge_point ?? ""),
      contentMd: String(row.content_md ?? ""),
      items: parseExerciseSetItems(jsonUnknownArray(row.items_json)),
      sourceQuestionIds: jsonArray(row.source_question_ids),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  async ensureAiMemoryDocument(surface) {
    const existing = await this.getAiMemoryDocument(surface);
    if (existing) return existing.document;
    const id = `memory_doc_${surface}`;
    const timestamp = now();
    await this.run(
      `INSERT OR IGNORE INTO ai_memory_documents (id, layer, surface, title, version, created_at, updated_at) VALUES (?, 'L2', ?, ?, 1, ?, ?)`,
      [id, surface, `\u5C0F\u667A ${surface} L2 summary`, timestamp, timestamp]
    );
    const created = await this.getAiMemoryDocument(surface);
    if (!created) throw new Error("L2 memory document readback failed");
    return created.document;
  }
  async ensureAiMemoryL3Document(slot) {
    const existing = await this.getAiMemoryL3Document(slot);
    if (existing) return existing.document;
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const id = `memory_l3_${randomUUID()}`;
    await this.run(`INSERT OR IGNORE INTO ai_memory_l3_documents (id, layer, slot, title, version, created_at, updated_at) VALUES (?, 'L3', ?, ?, 1, ?, ?)`, [id, slot, `L3 ${slot}`, now2, now2]);
    const created = await this.getAiMemoryL3Document(slot);
    if (!created) throw new Error("L3 document create readback failed");
    return created.document;
  }
  async validateAiMemoryRefs(refs) {
    const unique = [...new Set((Array.isArray(refs) ? refs : []).map((ref) => String(ref ?? "").trim()).filter(Boolean))];
    if (!unique.length) throw new Error("L2 memory entry requires at least one evidence ref");
    if (unique.length > AI_MEMORY_REF_MAX) throw new Error("L2 memory entry supports at most 8 evidence refs");
    const result = [];
    for (const ref of unique) {
      if (ref.startsWith("ai_agent_event:")) {
        const id = ref.slice("ai_agent_event:".length).trim();
        if (!id || !/^event_[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid L2 event evidence ref");
        const row = (await this.all(`SELECT id, phase, status, tool_name FROM ai_agent_events WHERE id = ?`, [id]))[0];
        if (!row) throw new Error(`L2 event evidence not found: ${id}`);
        result.push({ ref, kind: "event", id, label: `${String(row.phase ?? "event")}:${String(row.status ?? "")}`.slice(0, 120) });
        continue;
      }
      if (ref.startsWith("ai_agent_run:")) {
        const id = ref.slice("ai_agent_run:".length).trim();
        if (!id || !/^run_[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid L2 run evidence ref");
        const row = (await this.all(`SELECT id, route, status FROM ai_agent_runs WHERE id = ?`, [id]))[0];
        if (!row) throw new Error(`L2 run evidence not found: ${id}`);
        result.push({ ref, kind: "run", id, label: `${String(row.route ?? "run")}:${String(row.status ?? "")}`.slice(0, 120) });
        continue;
      }
      throw new Error("L2 evidence refs must point to ai_agent_run or ai_agent_event");
    }
    return result;
  }
  mapAiMemoryDocument(row) {
    return {
      id: String(row.id ?? ""),
      layer: "L2",
      surface: String(row.surface ?? "chat"),
      title: String(row.title ?? ""),
      version: Math.max(1, Number(row.version ?? 1)),
      entryCount: Math.max(0, Number(row.entry_count ?? 0)),
      activeEntryCount: Math.max(0, Number(row.active_entry_count ?? 0)),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiMemoryEntry(row) {
    return {
      id: String(row.id ?? ""),
      documentId: String(row.document_id ?? ""),
      surface: String(row.surface ?? "chat"),
      section: String(row.section ?? ""),
      text: String(row.text ?? ""),
      refs: Array.isArray(row.refs_json) ? row.refs_json : jsonUnknownArray(row.refs_json).filter((item) => Boolean(item && typeof item === "object")),
      status: String(row.status ?? "active"),
      origin: String(row.origin ?? "teacher"),
      version: Math.max(1, Number(row.version ?? 1)),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      deletedAt: String(row.deleted_at ?? "")
    };
  }
  mapAiMemoryRevision(row) {
    return {
      id: String(row.id ?? ""),
      documentId: String(row.document_id ?? ""),
      entryId: String(row.entry_id ?? ""),
      action: String(row.action ?? "edit"),
      before: row.before_json ? jsonObject(row.before_json) : null,
      after: row.after_json ? jsonObject(row.after_json) : null,
      createdAt: String(row.created_at ?? "")
    };
  }
  mapAiMemoryL3Document(row) {
    return {
      id: String(row.id),
      layer: "L3",
      slot: String(row.slot),
      title: String(row.title ?? `L3 ${row.slot}`),
      version: Number(row.version ?? 1),
      entryCount: Number(row.entry_count ?? 0),
      activeEntryCount: Number(row.active_entry_count ?? 0),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiMemoryL3Entry(row, slot) {
    return {
      id: String(row.id),
      documentId: String(row.document_id),
      slot,
      text: String(row.text ?? ""),
      sourceDocuments: jsonUnknownArray(row.source_documents_json).map(String).filter((surface) => AI_MEMORY_SURFACES.includes(surface)),
      status: String(row.status ?? "active"),
      version: Number(row.version ?? 1),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiAgentRun(row) {
    return {
      id: String(row.id),
      parentRunId: String(row.parent_run_id ?? ""),
      sessionId: String(row.session_id ?? ""),
      prompt: String(row.prompt ?? ""),
      route: String(row.route ?? "general_qa"),
      subIntent: String(row.sub_intent ?? ""),
      status: String(row.status ?? "running"),
      model: String(row.model ?? ""),
      studentId: String(row.student_id ?? ""),
      errorMessage: String(row.error_message ?? ""),
      createdAt: String(row.created_at ?? ""),
      completedAt: String(row.completed_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiAgentEvent(row) {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      sequence: Number(row.sequence ?? 0),
      phase: String(row.phase ?? "plan"),
      status: String(row.status ?? "pending"),
      label: String(row.label ?? ""),
      detail: String(row.detail ?? ""),
      toolName: String(row.tool_name ?? "") || void 0,
      inputSummary: jsonObject(row.input_summary_json),
      outputSummary: jsonObject(row.output_summary_json),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapAiCapabilityCheckpoint(row, exposePrivateState = false) {
    const checkpointType = String(row.checkpoint_type ?? "user_input");
    const state = jsonObject(row.state_json);
    const safeState = (checkpointType === "continuation" || checkpointType === "budget_approval") && !exposePrivateState ? {
      continuationAvailable: checkpointType === "continuation",
      approvalRequired: checkpointType === "budget_approval",
      sourceRunId: String(state.sourceRunId ?? row.run_id ?? ""),
      continuationCount: Number(state.continuationCount ?? 0),
      ...checkpointType === "budget_approval" ? { requestedBudgets: state.requestedBudgets } : {}
    } : state;
    return {
      id: String(row.id),
      runId: String(row.run_id ?? ""),
      capabilityName: String(row.capability_name ?? "chat"),
      checkpointType,
      state: safeState,
      status: String(row.status ?? "pending"),
      expiresAt: String(row.expires_at ?? ""),
      createdAt: String(row.created_at ?? ""),
      resolvedAt: String(row.resolved_at ?? "")
    };
  }
  mapAiMasteryQuestion(row) {
    const isCorrect = row.is_correct == null ? void 0 : Number(row.is_correct) === 1;
    return {
      id: String(row.id),
      runId: String(row.run_id ?? ""),
      turnId: String(row.turn_id ?? ""),
      studentId: String(row.student_id ?? ""),
      knowledgePointId: String(row.knowledge_point_id ?? ""),
      knowledgePointName: String(row.knowledge_point_name ?? ""),
      stem: String(row.stem ?? ""),
      options: jsonArray(row.options_json),
      expectedAnswer: String(row.expected_answer ?? ""),
      status: String(row.status ?? "pending"),
      answer: String(row.answer ?? ""),
      ...isCorrect == null ? {} : { isCorrect },
      createdAt: String(row.created_at ?? ""),
      ...row.answered_at ? { answeredAt: String(row.answered_at) } : {},
      ...row.graded_at ? { gradedAt: String(row.graded_at) } : {}
    };
  }
  mapAiMasteryPath(row) {
    const modules = jsonUnknownArray(row.modules_json);
    return {
      id: String(row.id),
      studentId: String(row.student_id ?? ""),
      version: Math.max(1, Number(row.version ?? 1)),
      mode: String(row.mode ?? "replace"),
      modules,
      status: String(row.status ?? "active"),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiConfirmationItem(row) {
    return {
      id: String(row.id),
      runId: String(row.run_id ?? ""),
      sessionId: String(row.session_id ?? ""),
      studentId: String(row.student_id ?? ""),
      actionType: String(row.action_type ?? "create_review_report"),
      status: String(row.status ?? "pending"),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      previewMd: String(row.preview_md ?? ""),
      payload: parseAiConfirmationPayload(row.payload_json),
      result: jsonObject(row.result_json),
      errorMessage: String(row.error_message ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      confirmedAt: String(row.confirmed_at ?? ""),
      rejectedAt: String(row.rejected_at ?? "")
    };
  }
  mapAiConversationFolder(row) {
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      sortOrder: Number(row.sort_order ?? 0),
      archivedAt: String(row.archived_at ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiConversationSession(row) {
    return {
      id: String(row.id),
      folderId: row.folder_id ? String(row.folder_id) : null,
      title: String(row.title ?? "\u65B0\u5BF9\u8BDD"),
      studentId: String(row.student_id ?? ""),
      lastPrompt: String(row.last_prompt ?? ""),
      lastResponsePreview: String(row.last_response_preview ?? ""),
      messageCount: Number(row.message_count ?? 0),
      archivedAt: String(row.archived_at ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiConversationMessage(row) {
    const role = String(row.role ?? "user");
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      role: role === "assistant" || role === "system" ? role : "user",
      content: String(row.content ?? ""),
      metadata: jsonObject(row.metadata_json),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapDocumentArtifact(row) {
    const type = normalizeDocumentArtifactType(String(row.artifact_type ?? "markdown"));
    const rawStatus = String(row.status ?? "draft");
    const status = rawStatus === "exported" || rawStatus === "failed" ? rawStatus : "draft";
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? ""),
      messageId: String(row.message_id ?? ""),
      title: String(row.title ?? ""),
      type,
      fileName: String(row.file_name ?? ""),
      mimeType: String(row.mime_type ?? documentMimeType(type)),
      description: String(row.description ?? ""),
      contentMd: String(row.content_md ?? ""),
      filePath: String(row.file_path ?? ""),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ""),
      status,
      errorMessage: String(row.error_message ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapAiRegressionReport(row) {
    const rawStatus = String(row.status ?? "warning");
    const status = rawStatus === "passed" || rawStatus === "failed" || rawStatus === "warning" ? rawStatus : "warning";
    const snapshot = row.snapshot_json ? parseTelemetrySnapshot(row.snapshot_json) : emptyTelemetrySnapshot();
    return {
      id: String(row.id),
      title: String(row.title ?? ""),
      status,
      summary: String(row.summary ?? ""),
      snapshot,
      gates: parseRegressionGates(row.gates_json),
      reportJson: jsonObject(row.report_json),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapAiUsabilityReview(row) {
    return {
      id: String(row.id ?? ""),
      sampleId: String(row.sample_id ?? ""),
      runId: String(row.run_id ?? ""),
      sessionId: String(row.session_id ?? ""),
      prompt: String(row.prompt ?? ""),
      route: String(row.route ?? "general_qa"),
      subIntent: String(row.sub_intent ?? ""),
      model: String(row.model ?? ""),
      teacherScore: Number(row.teacher_score ?? 0),
      needsRewrite: Number(row.needs_rewrite ?? 0) === 1,
      roundsToUseful: Number(row.rounds_to_useful ?? 0),
      mainIssueCode: String(row.main_issue_code ?? "none"),
      teacherNote: String(row.teacher_note ?? ""),
      reviewedAt: String(row.reviewed_at ?? ""),
      createdAt: String(row.created_at ?? "")
    };
  }
  normalizeModelGradeScore(value, fieldName) {
    const score = Math.round(Number(value));
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new Error(`${fieldName} must be an integer from 1 to 5`);
    }
    return score;
  }
  mapAiModelGrade(row) {
    const mode = String(row.grader_mode ?? "deterministic_proxy") === "llm_judge" ? "llm_judge" : "deterministic_proxy";
    const issueCodes = (() => {
      try {
        const parsed = JSON.parse(String(row.issue_codes_json ?? "[]"));
        return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
      } catch {
        return [];
      }
    })();
    return {
      id: String(row.id ?? ""),
      sampleId: String(row.sample_id ?? ""),
      runId: String(row.run_id ?? ""),
      sessionId: String(row.session_id ?? ""),
      prompt: String(row.prompt ?? ""),
      answerMarkdown: String(row.answer_markdown ?? ""),
      route: String(row.route ?? "general_qa"),
      subIntent: String(row.sub_intent ?? ""),
      targetGrade: String(row.target_grade ?? ""),
      modelUnderReview: String(row.model_under_review ?? ""),
      graderModel: String(row.grader_model ?? ""),
      graderMode: mode,
      promptVersion: String(row.prompt_version ?? ""),
      totalTokens: Number(row.total_tokens ?? 0),
      evidenceScore: Number(row.evidence_score ?? 0),
      actionabilityScore: Number(row.actionability_score ?? 0),
      safetyScore: Number(row.safety_score ?? 0),
      gradeAppropriatenessScore: Number(row.grade_appropriateness_score ?? 0),
      concisionScore: Number(row.concision_score ?? 0),
      teacherControlScore: Number(row.teacher_control_score ?? 0),
      overallScore: Number(row.overall_score ?? 0),
      passed: Number(row.passed ?? 0) === 1,
      issueCodes,
      graderRationale: String(row.grader_rationale ?? ""),
      reviewedAt: String(row.reviewed_at ?? ""),
      createdAt: String(row.created_at ?? "")
    };
  }
  usabilityReplayExperimentSelectSql(whereClause = "") {
    return `
      SELECT
        replay.id,
        replay.before_review_id,
        replay.after_review_id,
        before_review.run_id AS before_run_id,
        after_review.run_id AS after_run_id,
        replay.replay_prompt,
        replay.model_before,
        replay.model_after,
        replay.prompt_version_before,
        replay.prompt_version_after,
        replay.experiment_note,
        replay.created_at,
        before_review.teacher_score AS score_before,
        after_review.teacher_score AS score_after,
        before_review.rounds_to_useful AS rounds_before,
        after_review.rounds_to_useful AS rounds_after,
        before_review.main_issue_code AS issue_before,
        after_review.main_issue_code AS issue_after,
        before_review.needs_rewrite AS needs_rewrite_before,
        after_review.needs_rewrite AS needs_rewrite_after
      FROM ai_usability_replay_experiments replay
      JOIN ai_usability_reviews before_review ON before_review.id = replay.before_review_id
      JOIN ai_usability_reviews after_review ON after_review.id = replay.after_review_id
      ${whereClause}
    `;
  }
  mapAiUsabilityReplayExperiment(row) {
    const scoreBefore = Number(row.score_before ?? 0);
    const scoreAfter = Number(row.score_after ?? 0);
    const roundsBefore = Number(row.rounds_before ?? 0);
    const roundsAfter = Number(row.rounds_after ?? 0);
    const issueBefore = String(row.issue_before ?? "unknown");
    const issueAfter = String(row.issue_after ?? "unknown");
    const scoreDelta = scoreAfter - scoreBefore;
    const roundsDelta = roundsBefore - roundsAfter;
    const afterNeedsRewrite = Number(row.needs_rewrite_after ?? 0) === 1;
    return {
      id: String(row.id ?? ""),
      beforeReviewId: String(row.before_review_id ?? ""),
      afterReviewId: String(row.after_review_id ?? ""),
      beforeRunId: String(row.before_run_id ?? ""),
      afterRunId: String(row.after_run_id ?? ""),
      replayPrompt: String(row.replay_prompt ?? ""),
      modelBefore: String(row.model_before ?? ""),
      modelAfter: String(row.model_after ?? ""),
      promptVersionBefore: String(row.prompt_version_before ?? ""),
      promptVersionAfter: String(row.prompt_version_after ?? ""),
      experimentNote: String(row.experiment_note ?? ""),
      scoreBefore,
      scoreAfter,
      scoreDelta,
      roundsBefore,
      roundsAfter,
      roundsDelta,
      issueBefore,
      issueAfter,
      improved: scoreDelta > 0 && roundsDelta >= 0 && !afterNeedsRewrite,
      createdAt: String(row.created_at ?? "")
    };
  }
  mapTeacherResource(row) {
    return {
      id: String(row.id),
      title: String(row.title ?? ""),
      resourceType: String(row.resource_type ?? ""),
      originalFileName: String(row.original_file_name ?? ""),
      localPath: String(row.local_path ?? ""),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ""),
      parseStatus: String(row.parse_status ?? "queued"),
      parseEngine: String(row.parse_engine ?? ""),
      chunkCount: Number(row.chunk_count ?? 0),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapResourceChunk(row) {
    const sourceTrust = String(row.source_trust ?? "unverified");
    const evidenceStrength = String(row.evidence_strength ?? "background");
    return {
      id: String(row.id),
      resourceId: String(row.resource_id),
      resourceTitle: String(row.resource_title ?? ""),
      chunkIndex: Number(row.chunk_index ?? 0),
      heading: String(row.heading ?? ""),
      contentMd: String(row.content_md ?? ""),
      pageNumber: row.page_number == null ? null : Number(row.page_number),
      subject: String(row.subject ?? ""),
      grade: String(row.grade ?? ""),
      knowledgePoint: String(row.knowledge_point ?? ""),
      questionType: String(row.question_type ?? ""),
      difficulty: String(row.difficulty ?? ""),
      sourceTrust: sourceTrust === "teacher_verified" || sourceTrust === "machine_extracted" ? sourceTrust : "unverified",
      containsPersonalData: Number(row.contains_personal_data ?? 0) === 1,
      qualityScore: Number(row.quality_score ?? 0),
      evidenceStrength: evidenceStrength === "direct" || evidenceStrength === "indirect" ? evidenceStrength : "background",
      embeddingStatus: String(row.embedding_status ?? "pending"),
      createdAt: String(row.created_at ?? "")
    };
  }
  mapKnowledgeNode(row) {
    const evidenceStrength = String(row.evidence_strength ?? "background");
    return {
      id: String(row.id),
      nodeType: String(row.node_type ?? ""),
      name: String(row.name ?? ""),
      summary: String(row.summary ?? ""),
      sourceKind: String(row.source_kind ?? ""),
      sourceId: String(row.source_id ?? ""),
      confidence: Number(row.confidence ?? 0),
      evidenceStrength: evidenceStrength === "direct" || evidenceStrength === "indirect" ? evidenceStrength : "background",
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  }
  mapKnowledgeEdge(row) {
    const evidenceStrength = String(row.evidence_strength ?? "background");
    const evidenceKind = String(row.evidence_kind ?? "inferred");
    return {
      id: String(row.id),
      sourceNodeId: String(row.source_node_id ?? ""),
      targetNodeId: String(row.target_node_id ?? ""),
      relationType: String(row.relation_type ?? ""),
      evidenceSourceId: String(row.evidence_source_id ?? ""),
      evidenceText: String(row.evidence_text ?? ""),
      confidence: Number(row.confidence ?? 0),
      evidenceStrength: evidenceStrength === "direct" || evidenceStrength === "indirect" ? evidenceStrength : "background",
      evidenceKind: evidenceKind === "direct_quote" || evidenceKind === "metadata" ? evidenceKind : "inferred",
      createdAt: String(row.created_at ?? "")
    };
  }
  async ensureFts() {
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
    }
  }
  async rebuildRecordFts() {
    try {
      await this.run(`DELETE FROM learning_records_fts`);
      const rows = await this.all(`SELECT id FROM learning_records`);
      for (const row of rows) await this.upsertRecordFts(String(row.id));
    } catch {
    }
  }
  async rebuildRecordFtsIfEmpty() {
    try {
      const recordCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records`))[0]?.count ?? 0);
      const ftsCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records_fts`))[0]?.count ?? 0);
      if (recordCount > 0 && ftsCount === 0) await this.rebuildRecordFts();
    } catch {
    }
  }
  async upsertRecordFts(recordId) {
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
          String(record.title ?? ""),
          String(record.content ?? ""),
          String(record.subject ?? ""),
          jsonArray(record.tags).join(" ")
        ]
      );
    } catch {
    }
  }
  async searchRecordIdsByFts(keyword, studentId) {
    try {
      const query = this.toFtsQuery(keyword);
      const rows = studentId ? await this.all(
        `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ? AND student_id = ?
              LIMIT ?`,
        [query, studentId, FTS_MATCH_LIMIT]
      ) : await this.all(
        `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ?
              LIMIT ?`,
        [query, FTS_MATCH_LIMIT]
      );
      return rows.map((row) => String(row.id));
    } catch {
      return null;
    }
  }
  async searchRecordsByFts(keyword) {
    const ids = await this.searchRecordIdsByFts(keyword);
    if (!ids) return null;
    if (!ids.length) return [];
    const rows = await this.all(
      `SELECT * FROM learning_records
        WHERE id IN (${ids.map(() => "?").join(",")})
        ORDER BY occurred_at DESC
        LIMIT 50`,
      ids
    );
    return this.withAttachments(rows.map((row) => this.mapRecord(row)));
  }
  toFtsQuery(keyword) {
    return keyword.split(/\s+/).map((part) => part.replace(/["*]/g, "").trim()).filter(Boolean).map((part) => `"${part}"`).join(" OR ") || '""';
  }
  buildReportQualityChecks(records, contentMd, parentSummary) {
    const hasEvidence = records.length > 0;
    return [
      {
        key: "has_evidence",
        label: "\u5305\u542B\u771F\u5B9E\u8BC1\u636E",
        passed: hasEvidence,
        detail: hasEvidence ? `\u5F15\u7528 ${records.length} \u6761\u5B66\u4E60\u8BB0\u5F55\u3002` : "\u5F53\u524D\u62A5\u544A\u6CA1\u6709\u53EF\u8FFD\u6EAF\u5B66\u4E60\u8BB0\u5F55\u3002"
      },
      {
        key: "has_next_steps",
        label: "\u5305\u542B\u4E0B\u9636\u6BB5\u5EFA\u8BAE",
        passed: contentMd.includes("\u4E0B\u9636\u6BB5\u5EFA\u8BAE") && /\n1\./.test(contentMd),
        detail: "\u68C0\u67E5\u62A5\u544A\u662F\u5426\u7ED9\u51FA\u53EF\u6267\u884C\u7684\u4E0B\u4E00\u6B65\u3002"
      },
      {
        key: "has_parent_summary",
        label: "\u5305\u542B\u5BB6\u957F\u6C9F\u901A\u7248\u6458\u8981",
        passed: parentSummary.trim().length >= 20,
        detail: parentSummary.trim() ? "\u5BB6\u957F\u6458\u8981\u5DF2\u5355\u72EC\u4FDD\u5B58\u3002" : "\u7F3A\u5C11\u5BB6\u957F\u53EF\u8BFB\u6458\u8981\u3002"
      },
      {
        key: "editable",
        label: "\u4FDD\u6301\u6559\u5E08\u53EF\u7F16\u8F91",
        passed: true,
        detail: "\u62A5\u544A\u4EE5 Markdown \u4FDD\u5B58\uFF0C\u8001\u5E08\u53EF\u7EE7\u7EED\u4FEE\u6539\u3002"
      }
    ];
  }
  parseQualityChecks(value) {
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        key: String(item.key ?? ""),
        label: String(item.label ?? ""),
        passed: Boolean(item.passed),
        detail: String(item.detail ?? "")
      }));
    } catch {
      return [];
    }
  }
};

// <stdin>
async function runAiUsabilityReplaySmoke(dataRoot) {
  const store = new OmniEduStore(dataRoot);
  try {
    await store.init();
    const prompt = "\u8BF7\u770B\u5C0FA\u6700\u8FD1\u6570\u5B66\u9519\u9898\u548C\u5B66\u4E60\u8FDB\u5EA6\uFF0C\u76F4\u63A5\u544A\u8BC9\u6211\u4E0B\u4E00\u6B65\u8865\u4EC0\u4E48\u3002";
    const before = await store.createAiUsabilityReview({
      sampleId: "replay_student_progress_before_001",
      prompt,
      route: "student_diagnosis",
      subIntent: "student_progress",
      teacherScore: 2,
      needsRewrite: true,
      roundsToUseful: 4,
      mainIssueCode: "manual_module_switch_fallback",
      teacherNote: "\u8981\u6C42\u8001\u5E08\u624B\u52A8\u5207\u6362\u6A21\u5757\uFF0C\u6CA1\u6709\u4E3B\u52A8\u67E5\u8BE2\u5B66\u751F\u6570\u636E\u3002",
      runId: "run_replay_before",
      sessionId: "session_replay",
      model: "deepseek-before",
      reviewedAt: "2026-07-29T09:00:00.000Z"
    });
    const after = await store.createAiUsabilityReview({
      sampleId: "replay_student_progress_after_001",
      prompt,
      route: "student_diagnosis",
      subIntent: "student_progress",
      teacherScore: 5,
      needsRewrite: false,
      roundsToUseful: 1,
      mainIssueCode: "none",
      teacherNote: "\u80FD\u76F4\u63A5\u8BC6\u522B\u5B66\u751F\u8BCA\u65AD\u4EFB\u52A1\uFF0C\u5E76\u7ED9\u51FA\u8BC1\u636E\u8FB9\u754C\u548C\u4E0B\u4E00\u6B65\u3002",
      runId: "run_replay_after",
      sessionId: "session_replay",
      model: "deepseek-after",
      reviewedAt: "2026-07-29T09:05:00.000Z"
    });
    const experiment = await store.createAiUsabilityReplayExperiment({
      beforeReviewId: before.id,
      afterReviewId: after.id,
      replayPrompt: prompt,
      modelBefore: "deepseek-before",
      modelAfter: "deepseek-after",
      promptVersionBefore: "xiazhi-usability-v1.3",
      promptVersionAfter: "xiazhi-usability-v1.4",
      experimentNote: "smoke seeded before/after replay experiment"
    });
    assert.equal(experiment.beforeReviewId, before.id);
    assert.equal(experiment.afterReviewId, after.id);
    assert.equal(experiment.scoreBefore, 2);
    assert.equal(experiment.scoreAfter, 5);
    assert.equal(experiment.scoreDelta, 3);
    assert.equal(experiment.roundsBefore, 4);
    assert.equal(experiment.roundsAfter, 1);
    assert.equal(experiment.roundsDelta, 3);
    assert.equal(experiment.issueBefore, "manual_module_switch_fallback");
    assert.equal(experiment.issueAfter, "none");
    assert.equal(experiment.improved, true);
    const list = await store.listAiUsabilityReplayExperiments();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, experiment.id);
    assert.equal(list[0].scoreDelta, 3);
    const summary = await store.buildAiUsabilityReplaySummary();
    assert.equal(summary.experimentCount, 1);
    assert.equal(summary.improvedCount, 1);
    assert.equal(summary.unresolvedCount, 0);
    assert.equal(summary.improvementRate, 1);
    assert.equal(summary.averageScoreDelta, 3);
    assert.equal(summary.averageRoundsDelta, 3);
    assert.equal(summary.issueTransitionCounts["manual_module_switch_fallback->none"], 1);
    const snapshot = await store.buildAiTelemetrySnapshot();
    assert.deepEqual(snapshot.usabilityReplay, summary);
    const report = await store.createAiRegressionReport({
      title: "Phase 12 v1.4 replay smoke",
      minimumTeacherReviewSamples: 2,
      minimumTeacherScore: 3.5,
      maximumTeacherRoundsToUseful: 3,
      minimumReplayExperimentCount: 1,
      minimumReplayImprovementRate: 1
    });
    const replayGate = report.gates.find((gate) => gate.id === "usability_replay_improvement_gate");
    assert.ok(replayGate, "usability_replay_improvement_gate should be present");
    assert.equal(replayGate.status, "passed");
    assert.equal(report.snapshot.usabilityReplay.experimentCount, 1);
    return {
      ok: true,
      experimentCount: summary.experimentCount,
      improvedCount: summary.improvedCount,
      averageScoreDelta: summary.averageScoreDelta,
      averageRoundsDelta: summary.averageRoundsDelta,
      replayGate: {
        id: replayGate.id,
        status: replayGate.status,
        detail: replayGate.detail
      }
    };
  } finally {
    await store.close();
  }
}
export {
  runAiUsabilityReplaySmoke
};
