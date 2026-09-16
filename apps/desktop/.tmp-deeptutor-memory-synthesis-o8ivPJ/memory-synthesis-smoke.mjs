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
function normalizeMemoryText(text2) {
  const normalized2 = String(text2 ?? "").replace(/\s+/g, " ").trim();
  if (!normalized2) throw new Error("L2 memory text cannot be empty");
  if (normalized2.length > AI_MEMORY_TEXT_MAX) throw new Error("L2 memory text exceeds 1000 characters");
  const banned = ["always", "never", "mastered", "expert in", "\u603B\u662F", "\u4ECE\u6765\u4E0D", "\u5B8C\u5168\u638C\u63E1", "\u4E13\u5BB6"];
  if (banned.some((phrase) => normalized2.toLowerCase().includes(phrase.toLowerCase()))) {
    throw new Error("L2 memory text contains an absolute claim");
  }
  return normalized2;
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
function includesAny(text2, candidates) {
  return candidates.find((candidate) => text2.includes(candidate)) ?? "";
}
function inferKnowledgeSubject(text2) {
  return includesAny(text2, ["\u6570\u5B66", "\u82F1\u8BED", "\u8BED\u6587", "\u7269\u7406", "\u5316\u5B66", "\u751F\u7269", "\u5386\u53F2", "\u5730\u7406", "\u9053\u5FB7\u4E0E\u6CD5\u6CBB", "\u79D1\u5B66"]);
}
function inferKnowledgeGrade(text2) {
  const direct = text2.match(/(小学[一二三四五六]|[一二三四五六]年级|七年级|八年级|九年级|初[一二三]|高[一二三]|初中|高中)/);
  return direct?.[1] ?? "";
}
function inferKnowledgePoint(text2) {
  const labeled = text2.match(/(?:知识点|考点|主题|专题)[:：]\s*([^\n，,。；;]{2,24})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text2, [
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
function inferQuestionType(text2) {
  const labeled = text2.match(/(?:题型|类型)[:：]\s*([^\n，,。；;]{2,16})/);
  if (labeled?.[1]) return labeled[1].trim();
  return includesAny(text2, ["\u9009\u62E9\u9898", "\u586B\u7A7A\u9898", "\u89E3\u7B54\u9898", "\u5E94\u7528\u9898", "\u8BC1\u660E\u9898", "\u9605\u8BFB\u7406\u89E3", "\u5199\u4F5C\u9898"]);
}
function inferDifficulty(text2) {
  if (/难度[:：]?\s*(hard|困难|较难|压轴)/i.test(text2)) return "hard";
  if (/难度[:：]?\s*(easy|简单|基础|入门)/i.test(text2)) return "easy";
  if (/难度[:：]?\s*(medium|中等|适中)/i.test(text2)) return "medium";
  return "";
}
function containsPersonalData(text2) {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text2) || /(?<!\d)1[3-9]\d{9}(?!\d)/.test(text2) || /(?<!\d)\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(text2);
}
function inferResourceChunkMetadata(resourceTitle, heading, content) {
  const text2 = `${resourceTitle}
${heading}
${content}`;
  const subject = inferKnowledgeSubject(text2);
  const grade = inferKnowledgeGrade(text2);
  const knowledgePoint = inferKnowledgePoint(text2);
  const questionType = inferQuestionType(text2);
  const difficulty = inferDifficulty(text2);
  const personal = containsPersonalData(text2);
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
function redactPattern(text2, pattern, token) {
  let count = 0;
  const sanitizedText = text2.replace(pattern, () => {
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
  const normalized2 = content.replace(/\r\n/g, "\n").trim();
  if (!normalized2) return [];
  const chunks = [];
  const sections = normalized2.split(/\n(?=#{1,6}\s+)/g);
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
  async sanitizeProblemText(text2, studentId) {
    const redactions = [];
    let sanitizedText = text2;
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
          const text2 = readFileSync(targetPath, "utf8");
          await this.createResourceChunksAndGraph(id, title, text2, timestamp);
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
    const tokens2 = searchTokens(trimmed);
    const clauses = tokens2.length ? tokens2.map(() => `(
          c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?
          OR c.subject LIKE ? OR c.grade LIKE ? OR c.knowledge_point LIKE ? OR c.question_type LIKE ?
        )`) : ["(c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?)"];
    const params = [];
    if (tokens2.length) {
      for (const token of tokens2) {
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
    const text2 = normalizeMemoryText(input.text);
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
        [entryId, document.id, section, text2, JSON.stringify(refs), timestamp, timestamp]
      );
      await this.run(
        `INSERT INTO ai_memory_revisions (id, document_id, entry_id, action, before_json, after_json, created_at)
         VALUES (?, ?, ?, 'create', NULL, ?, ?)`,
        [revisionId, document.id, entryId, JSON.stringify({ section, text: text2, refs, status: "active", origin: "teacher", version: 1 }), timestamp]
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
    const text2 = input.text == null ? current.text : normalizeMemoryText(input.text);
    const section = input.section == null ? current.section : String(input.section).replace(/\s+/g, " ").trim().slice(0, 120) || current.section;
    const refs = input.refs == null ? current.refs : await this.validateAiMemoryRefs(input.refs);
    const status = input.status ?? (current.status === "deleted" ? "disabled" : current.status);
    const nextVersion = current.version + 1;
    const timestamp = now();
    const before = { section: current.section, text: current.text, refs: current.refs, status: current.status, origin: current.origin, version: current.version };
    const after = { section, text: text2, refs, status, origin: current.origin, version: nextVersion };
    await this.run("BEGIN IMMEDIATE");
    try {
      await this.run(
        `UPDATE ai_memory_entries SET section = ?, text = ?, refs_json = ?, status = ?, version = ?, updated_at = ?, deleted_at = CASE WHEN ? = 'deleted' THEN ? ELSE NULL END WHERE id = ? AND version = ?`,
        [section, text2, JSON.stringify(refs), status, nextVersion, timestamp, status, timestamp, id, input.version]
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
      const text2 = normalizeMemoryText(String(row.text ?? "")).slice(0, AI_MEMORY_TEXT_MAX);
      if (!text2) continue;
      const key = `${String(row.section ?? "Recent activity")}: ${text2}`;
      const surfaces = grouped.get(key) ?? [];
      const surface = String(row.surface ?? "chat");
      if (!surfaces.includes(surface)) surfaces.push(surface);
      grouped.set(key, surfaces);
    }
    const prefix = slot === "profile" ? "Cross-surface learner profile: " : slot === "preferences" ? "Teacher preference signal: " : slot === "scope" ? "Current learning scope: " : "Recent cross-surface activity: ";
    return {
      layer: "L3",
      slot,
      entries: [...grouped.entries()].slice(0, boundedLimit).map(([text2, sourceDocuments]) => ({ text: `${prefix}${text2}`, sourceDocuments, requiresTeacherReview: true })),
      bounded: true,
      rawPromptIncluded: false,
      hiddenReasoningIncluded: false
    };
  }
  async createAiMemoryL3Entry(input) {
    assertAiMemoryL3Slot(input.slot);
    const text2 = normalizeMemoryText(input.text);
    if (!text2) throw new Error("L3 entry text is required");
    const sourceDocuments = [...new Set(input.sourceDocuments)].filter((surface) => {
      assertAiMemorySurface(surface);
      return true;
    });
    if (!sourceDocuments.length) throw new Error("L3 entry requires at least one source surface");
    const document = await this.ensureAiMemoryL3Document(input.slot);
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const id = `memory_l3_entry_${randomUUID()}`;
    await this.run(`INSERT INTO ai_memory_l3_entries (id, document_id, text, source_documents_json, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 1, ?, ?)`, [id, document.id, text2, JSON.stringify(sourceDocuments), now2, now2]);
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
    const text2 = input.text == null ? String(row.text) : normalizeMemoryText(input.text);
    const status = input.status ?? String(row.status);
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const changed = await this.runWithChanges(`UPDATE ai_memory_l3_entries SET text = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`, [text2, status, now2, entryId, input.version]);
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
    const text2 = typeof beforePayload.text === "string" ? beforePayload.text : "";
    if (end > text2.length) throw new Error("\u9009\u533A\u8D85\u51FA\u5185\u5BB9\u5757\u6587\u672C\u8303\u56F4");
    const selectedText = text2.slice(start, end);
    if (selectedText !== String(input.selectedText ?? "")) throw new Error("\u9009\u533A\u6587\u672C\u5DF2\u6F02\u79FB\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u540E\u518D\u8BD5");
    const replacementText = String(input.replacementText ?? "");
    if (!replacementText.trim()) throw new Error("\u66FF\u6362\u6587\u672C\u4E0D\u80FD\u4E3A\u7A7A");
    if (replacementText.length > 2e4) throw new Error("\u66FF\u6362\u6587\u672C\u8D85\u51FA 20000 \u5B57\u7B26\u4E0A\u9650");
    const afterPayload = inputObject({ ...beforePayload, text: `${text2.slice(0, start)}${replacementText}${text2.slice(end)}` });
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
    const tokens2 = searchTokens(query);
    if (tokens2.length) {
      clauses.push(`(${tokens2.map(() => "(stem LIKE ? OR analysis LIKE ? OR tags LIKE ? OR knowledge_point LIKE ?)").join(" OR ")})`);
      for (const token of tokens2) {
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
        (token) => [item.stem, item.analysis, item.knowledgePoint, item.tags.join("\u3001")].some((text2) => text2.includes(token))
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
    const tokens2 = searchTokens(query).slice(0, 8);
    if (tokens2.length) {
      clauses.push(`(${tokens2.map(() => "(q.stem LIKE ? OR q.analysis LIKE ? OR q.tags LIKE ? OR q.knowledge_point LIKE ?)").join(" OR ")})`);
      for (const token of tokens2) {
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
    const nodeId2 = `node_${resourceId}`;
    await this.run(
      `INSERT OR REPLACE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
      ) VALUES (?, '\u8D44\u6E90', ?, ?, 'teacher_resource', ?, 1, 'background', ?, ?)`,
      [nodeId2, title, `${resourceType} \u6587\u4EF6\uFF0C${fileSize} bytes\u3002`, resourceId, timestamp, timestamp]
    );
    await this.run(
      `INSERT OR IGNORE INTO knowledge_edges (
        id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, evidence_strength, evidence_kind, created_at
      ) VALUES (?, 'node_teacher_library', ?, '\u5305\u542B', ?, ?, 1, 'background', 'metadata', ?)`,
      [`edge_library_${resourceId}`, nodeId2, resourceId, title, timestamp]
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
      const nodeId2 = `node_${chunkId}`;
      await this.run(
        `INSERT OR REPLACE INTO knowledge_nodes (
          id, node_type, name, summary, source_kind, source_id, confidence, evidence_strength, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'resource_chunk', ?, ?, ?, ?, ?)`,
        [
          nodeId2,
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
        [`edge_${resourceId}_${chunkId}`, `node_${resourceId}`, nodeId2, chunkId, resourceTitle, metadata.qualityScore / 100, metadata.evidenceStrength, timestamp]
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
    const unique3 = [...new Set((Array.isArray(refs) ? refs : []).map((ref) => String(ref ?? "").trim()).filter(Boolean))];
    if (!unique3.length) throw new Error("L2 memory entry requires at least one evidence ref");
    if (unique3.length > AI_MEMORY_REF_MAX) throw new Error("L2 memory entry supports at most 8 evidence refs");
    const result = [];
    for (const ref of unique3) {
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

// src/main/ai-harness/role-profile.ts
function inferAiRoleProfile(prompt) {
  if (/研究助理|教研助理|research\s*assistant|文献综述|研究方案/i.test(prompt)) return "research_assistant";
  if (/同伴|陪练|一起想|peer|伙伴/i.test(prompt)) return "peer";
  return "teacher";
}

// src/main/ai-harness/router.ts
var ROUTE_ORDER = [
  "report_draft",
  "practice_design",
  "error_analysis",
  "student_diagnosis",
  "lesson_design",
  "knowledge_retrieval",
  "workspace_help",
  "general_qa"
];
var SUBJECT_PATTERNS = [
  ["\u6570\u5B66", /数学|方程|函数|几何|分数|应用题|代数|概率|统计|圆|三角/u],
  ["\u82F1\u8BED", /英语|单词|语法|阅读|听力|完形|写作/u],
  ["\u8BED\u6587", /语文|作文|阅读理解|文言文|古诗|现代文/u],
  ["\u7269\u7406", /物理|力学|电路|电学|光学/u],
  ["\u5316\u5B66", /化学|方程式|实验|酸碱|物质/u],
  ["\u751F\u7269", /生物|细胞|遗传|生态/u],
  ["\u5386\u53F2", /历史|朝代|事件|史料/u],
  ["\u5730\u7406", /地理|地图|气候|经纬/u]
];
var ROUTE_KEYWORDS = {
  general_qa: [/^(你?好|您好|hello|hi|嗨|在吗)[\s!！。.?？]*$/i, /你是谁|小智能做什么|介绍一下/, /解释.*(是什么|概念|区别)/],
  student_diagnosis: [
    /分析.*学生|当前学生|这个学生|最近.*表现|薄弱点|错因|学习问题|掌握情况|诊断|画像|阶段目标|学习进度/,
    /学生.*(最近|稳定|表现|薄弱|掌握|永久|标记|手机号|身份证|ADHD|自残|自杀|伤害)/i,
    /小[\p{L}\p{N}_-]{1,12}.*(学习|进度|表现|掌握|薄弱|错因|记录|档案)/u
  ],
  error_analysis: [
    /错题|错在哪里|错误原因|为什么错|失分点|易错点|订正|解题思路|这道题/,
    /小[\p{L}\p{N}_-]{1,12}.*(错题|错因|失分|订正)/u,
    /附件.*(分析|错误|题目)|分析.*附件|图片中|图中|照片中|OCR/
  ],
  practice_design: [
    /练习|作业|题组|三元题组|相似题|变式题|巩固|训练|出题|周练|复习队列|间隔复习|到期复习|待复习/,
    /小[\p{L}\p{N}_-]{1,12}.*(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取)/u
  ],
  lesson_design: [/教案|课堂|课时|讲解|导入|板书|教学设计|课程设计|备课|知识讲解|课堂活动/],
  report_draft: [/报告|复盘|家长|沟通摘要|阶段总结|月报|周报|可编辑|docx?|pdf|导出/],
  knowledge_retrieval: [/知识库|资料|讲义|教材|文档|笔记|备课本|历史草稿|notebook|引用|来源|查找|检索|根据.*材料|附件中|上传的文件|文档中|文件中|知识点|知识点图谱|关联|关系|先修/],
  workspace_help: [
    /怎么用|如何操作|API Key|DeepSeek/i,
    /(怎么|如何).*(导入|配置|设置|新建|归档|备份|打开|保存|使用)/,
    /导入.*(资料|知识库|文件|资源)|配置.*(API|Key|DeepSeek)|备份.*数据目录|新建.*文件夹|归档/,
    /普通问答模式|general_qa|学生数据模块|左侧导航|\/student|切换.*模式/,
    /忽略之前规则|上传所有附件原文|直接写入学生档案|自动.*学生数据工具|自动保存.*标签/
  ]
};
var ROUTE_POLICIES = {
  general_qa: {
    include: [],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u666E\u901A\u95EE\u7B54\u4E0D\u9ED8\u8BA4\u8BFB\u53D6\u5B66\u751F\u6570\u636E\u6216\u77E5\u8BC6\u5E93\u3002"
  },
  student_diagnosis: {
    include: ["student_lookup", "student_profile", "learning_records", "attachment_metadata", "teacher_knowledge"],
    recordLimit: 12,
    knowledgeLimit: 4,
    graphNodeLimit: 0,
    reason: "\u5B66\u751F\u8BCA\u65AD\u9700\u8981\u5148\u89E3\u6790\u5B66\u751F\u5F15\u7528\uFF0C\u518D\u8BFB\u53D6\u6863\u6848\u3001\u8FD1\u671F\u8BB0\u5F55\u548C\u5C11\u91CF\u8001\u5E08\u8D44\u6599\u4F5C\u4E3A\u8BC1\u636E\u3002"
  },
  error_analysis: {
    include: ["student_lookup", "student_profile", "learning_records", "attachment_metadata", "teacher_knowledge"],
    recordLimit: 8,
    knowledgeLimit: 5,
    graphNodeLimit: 0,
    reason: "\u9519\u56E0\u5206\u6790\u9700\u8981\u5B66\u751F\u6863\u6848\u3001\u9519\u9898/\u5B66\u4E60\u8BB0\u5F55\u8BC1\u636E\u548C\u76F8\u5173\u77E5\u8BC6\u7247\u6BB5\u3002"
  },
  practice_design: {
    include: ["student_lookup", "student_profile", "learning_records", "teacher_knowledge", "knowledge_graph", "question_bank"],
    recordLimit: 8,
    knowledgeLimit: 6,
    graphNodeLimit: 8,
    reason: "\u7EC3\u4E60\u8BBE\u8BA1\u9700\u8981\u7ED3\u5408\u5B66\u751F\u8584\u5F31\u70B9\u3001\u8001\u5E08\u8D44\u6599\u548C\u53EF\u8FFD\u6EAF\u77E5\u8BC6\u5173\u7CFB\u751F\u6210\u4E09\u5143\u9898\u7EC4\u3002"
  },
  lesson_design: {
    include: ["teacher_knowledge", "knowledge_graph"],
    recordLimit: 0,
    knowledgeLimit: 8,
    graphNodeLimit: 8,
    reason: "\u5907\u8BFE\u4EFB\u52A1\u4F18\u5148\u4F7F\u7528\u8001\u5E08\u8D44\u6599\u548C\u77E5\u8BC6\u7ED3\u6784\uFF0C\u4E0D\u9ED8\u8BA4\u8BFB\u53D6\u5B66\u751F\u9690\u79C1\u3002"
  },
  report_draft: {
    include: ["student_lookup", "student_profile", "learning_records", "attachment_metadata", "teacher_knowledge"],
    recordLimit: 20,
    knowledgeLimit: 4,
    graphNodeLimit: 0,
    reason: "\u62A5\u544A\u8349\u7A3F\u9700\u8981\u8DB3\u591F\u5B66\u4E60\u8BB0\u5F55\u8BC1\u636E\uFF0C\u4F46\u4ECD\u4E0D\u8BFB\u53D6\u6216\u4E0A\u4F20\u539F\u59CB\u9644\u4EF6\u3002"
  },
  knowledge_retrieval: {
    include: ["teacher_knowledge", "knowledge_graph"],
    recordLimit: 0,
    knowledgeLimit: 8,
    graphNodeLimit: 12,
    reason: "\u77E5\u8BC6\u68C0\u7D22\u53EA\u8BFB\u53D6\u8001\u5E08\u77E5\u8BC6\u5E93\u548C\u77E5\u8BC6\u56FE\u8C31\u6458\u8981\u3002"
  },
  workspace_help: {
    include: [],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u5DE5\u4F5C\u53F0\u5E2E\u52A9\u4E0D\u9700\u8981\u8BFB\u53D6\u5B66\u751F\u6216\u77E5\u8BC6\u5E93\u5185\u5BB9\u3002"
  }
};
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function extractStudentRefs(prompt) {
  const refs = prompt.match(/小[A-Za-z0-9_-]{1,12}|小[\u4e00-\u9fa5]{1,3}/g) ?? [];
  return unique(refs.map((ref) => ref.trim()).filter((ref) => ref !== "\u5C0F\u667A" && ref !== "\u5C0F\u667A\u80FD"));
}
function hasExplicitStudentReference(prompt, slots) {
  return slots.studentRefs.length > 0 || /学生|当前学生|这个学生/u.test(prompt);
}
function scoreRoute(prompt, route) {
  return ROUTE_KEYWORDS[route].reduce((score, pattern) => score + (pattern.test(prompt) ? 1 : 0), 0);
}
function inferTimeRange(prompt) {
  if (/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|从.+到.+|近\d+\s*(天|周|月)/.test(prompt)) return "custom";
  if (/最近一周|近一周|本周|这周|一周|周报|周复盘/.test(prompt)) return "last_week";
  if (/最近一个月|近一个月|本月|这个月|月报|月度|30\s*天/.test(prompt)) return "last_month";
  if (/本学期|这学期|本期|期中|期末|学期/.test(prompt)) return "this_term";
  return "none";
}
function inferSubject(prompt) {
  return SUBJECT_PATTERNS.find(([, pattern]) => pattern.test(prompt))?.[0] ?? "";
}
function inferKnowledgePoint2(prompt) {
  const known = ["\u4E00\u6B21\u51FD\u6570", "\u4E8C\u6B21\u51FD\u6570", "\u52FE\u80A1\u5B9A\u7406", "\u6982\u7387\u7EDF\u8BA1", "\u5206\u6570\u5E94\u7528\u9898", "\u5706\u7684\u6027\u8D28"];
  const hit = known.find((item) => prompt.includes(item));
  if (hit) return hit;
  const match = prompt.match(/(?:关于|围绕|针对|讲解|解释|复习|巩固|查找|检索)([\p{L}\p{N}A-Za-z0-9_+\-（）()·]{2,12})(?:这个)?(?:知识点|内容|专题|题型|讲义|材料)?/u);
  if (match?.[1]) return match[1].replace(/^(这个|一下|一下这个)/, "").trim();
  const direct = prompt.match(/([\p{L}\p{N}A-Za-z0-9_+\-（）()·]{2,24})(?:知识点|题型|专题)/u);
  return direct?.[1]?.trim() ?? "";
}
function extractSlots(prompt) {
  const studentRefs = extractStudentRefs(prompt);
  return {
    studentRefs,
    hasMultipleStudentRefs: studentRefs.length > 1 || /多个学生|两名学生|几个学生|全班|小组/.test(prompt),
    timeRange: inferTimeRange(prompt),
    subject: inferSubject(prompt),
    knowledgePoint: inferKnowledgePoint2(prompt),
    writeIntent: /保存|写入|更新|归档|提交|发布|直接保存|生成.*并保存|落库/.test(prompt)
  };
}
function pickRoute(prompt, slots) {
  const trimmed = prompt.trim();
  if (!trimmed) return { route: "general_qa", confidence: 0.4 };
  if (/忽略之前规则|上传所有附件原文|直接写入学生档案/.test(trimmed)) {
    return { route: "workspace_help", confidence: 0.9 };
  }
  if (/自动.*学生数据工具|自动保存.*标签|怎么.*(导入|配置|设置|备份|新建|归档|打开|保存|使用)|如何.*(导入|配置|设置|备份|新建|归档|打开|保存|使用)|API|Key|DeepSeek/i.test(trimmed)) {
    return { route: "workspace_help", confidence: 0.86 };
  }
  if (/(分析当前学生|当前学生|这个学生).*(错因|学习|表现|掌握|薄弱)/.test(trimmed)) {
    return { route: "student_diagnosis", confidence: 0.86 };
  }
  if (/(复习队列|间隔复习|到期复习|待复习)/.test(trimmed) && (slots.studentRefs.length > 0 || /当前学生|这个学生|学生/.test(trimmed))) {
    return { route: "student_diagnosis", confidence: 0.88 };
  }
  if (/(板书|导入|总结流程|课时安排).*(流程|练习|总结)|生成.*(板书|导入)/.test(trimmed)) {
    return { route: "lesson_design", confidence: 0.86 };
  }
  if (/(题目笔记本|题目收藏|收藏题目|收藏夹|收藏|错题本|题目书签|分类题目|我的题目)/.test(trimmed)) {
    return { route: "practice_design", confidence: 0.89 };
  }
  if (/(专题讲义|单元备课包|教材工作区|教学包|课程讲义|讲义包|章节页面|内容块|讲义健康|讲义引用|知识库漂移|来源漂移|重新生成.*(页面|块)|备课包状态|规划讲义|章节规划|生成章节大纲|章节骨架|来源探索|spine|source explorer)/i.test(trimmed)) {
    return { route: "lesson_design", confidence: 0.9 };
  }
  if (/(笔记|备课本|历史草稿|notebook)/i.test(trimmed)) {
    return { route: "knowledge_retrieval", confidence: 0.88 };
  }
  if (/(附件.*(分析|错误|题目)|分析.*附件|图片中|图中|照片中|OCR)/i.test(trimmed)) {
    return { route: "error_analysis", confidence: 0.88 };
  }
  if (/(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取|周练)/.test(trimmed)) {
    return { route: "practice_design", confidence: 0.85 };
  }
  if (/(错题|错因|失分|失分原因|错的点|错误原因|订正|纠错)/.test(trimmed)) {
    return { route: "error_analysis", confidence: 0.84 };
  }
  if (/(教案|课堂|课时|讲解|导入|板书|教学设计|课程设计|备课|课时安排|例题顺序|讲解版|课堂活动|总结流程)/.test(trimmed)) {
    return { route: "lesson_design", confidence: 0.84 };
  }
  if (/(档案|阶段目标|家长关注点)/.test(trimmed) && slots.studentRefs.length) {
    return { route: "student_diagnosis", confidence: 0.84 };
  }
  const asksStudentWork = /(学习进度|题目|题组|练习|作业|错题|错因|表现|掌握|薄弱|抽取|记录|档案|复盘|报告|月报|周报)/.test(trimmed);
  if (slots.studentRefs.length && asksStudentWork) {
    if (/(报告|复盘|月报|周报|家长|沟通摘要|总结)/.test(trimmed)) return { route: "report_draft", confidence: 0.88 };
    if (/(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取|周练)/.test(trimmed)) return { route: "practice_design", confidence: 0.87 };
    if (/(错题|错因|失分|订正|错误原因)/.test(trimmed)) return { route: "error_analysis", confidence: 0.85 };
    return { route: "student_diagnosis", confidence: 0.84 };
  }
  const scored = ROUTE_ORDER.map((route) => ({ route, score: scoreRoute(trimmed, route) })).sort((a, b) => b.score - a.score || ROUTE_ORDER.indexOf(a.route) - ROUTE_ORDER.indexOf(b.route));
  const best = scored[0] ?? { route: "general_qa", score: 0 };
  if (best.score <= 0) return { route: "general_qa", confidence: 0.55 };
  return { route: best.route, confidence: Math.min(0.95, 0.62 + best.score * 0.11) };
}
function inferRisk(prompt) {
  if (/自杀|自残|伤害自己|虐待|暴力|性侵|违法|危险/i.test(prompt)) return "safeguarding";
  if (/诊断|标签|智力|抑郁|多动|ADHD|隐私|身份证|电话|手机号|永久/i.test(prompt)) return "sensitive";
  return "normal";
}
function inferAudience(prompt) {
  if (/家长|沟通摘要|亲子/.test(prompt)) return "parent_material";
  if (/给学生|学生版|讲给孩子|课堂讲义|练习|作业/.test(prompt)) return "student_material";
  return "teacher";
}
function inferActionLevel(route, slots) {
  if (slots.writeIntent) return "write";
  if (route === "report_draft" || route === "practice_design" || route === "lesson_design") return "draft";
  return "answer";
}
function routeNeedsStudent(route) {
  return route === "student_diagnosis" || route === "error_analysis" || route === "practice_design" || route === "report_draft";
}
function inferSubIntent(route, prompt, slots, risk) {
  if (/忽略之前规则|上传所有附件原文|直接写入学生档案|手机号|身份证|自动保存.*标签/.test(prompt)) return "safety_boundary";
  if (risk === "safeguarding") return "risk_support";
  if (/研究|教研报告|文献综述|研究提纲|deep\s*research|research\s*assistant/i.test(prompt)) return "research_workspace";
  if (/可视化|流程图|概念图|关系图|mermaid|visualize/i.test(prompt)) return "visualization";
  if (/附件|图片中|图中|照片中|上传的文件|文档中|文件中|材料中/i.test(prompt)) return "attached_source_exploration";
  switch (route) {
    case "general_qa":
      if (/^(你?好|您好|hello|hi|嗨|在吗)/i.test(prompt)) return "casual_greeting";
      if (/你是谁|小智能做什么|介绍一下|能不能自动读取学生数据/.test(prompt)) return "capability_intro";
      return "concept_explanation";
    case "student_diagnosis":
      if (/复习队列|间隔复习|到期复习|待复习/.test(prompt)) return "review_queue";
      if (/画像|档案|阶段目标|标签|永久/.test(prompt)) return "student_profile_review";
      if (/薄弱|弱点|短板|掌握情况|掌握/.test(prompt)) return "student_weakness";
      return "student_progress";
    case "error_analysis":
      if (/高频|模式|归纳|汇总|找出|集中|排序|都容易错/.test(prompt)) return "error_pattern_summary";
      if (/订正|讲解思路|改正|纠错/.test(prompt)) return "correction_guidance";
      return "mistake_reasoning";
    case "practice_design":
      if (/复习队列|间隔复习|到期复习|待复习/.test(prompt)) return "review_queue";
      if (/题目笔记本|题目收藏|收藏题目|收藏夹|收藏|错题本|题目书签|分类题目|我的题目/.test(prompt)) return "question_notebook";
      if (/三元题组|原题|变式/.test(prompt)) return "triplet_practice";
      if (/相似题|同类题|类似题/.test(prompt)) return "similar_questions";
      return "homework_plan";
    case "lesson_design":
      if (/专题讲义|单元备课包|教材工作区|教学包|课程讲义|讲义包|章节页面|内容块|讲义健康|讲义引用|知识库漂移|来源漂移|重新生成.*(页面|块)|备课包状态|规划讲义|章节规划|生成章节大纲|章节骨架|来源探索|spine|source explorer/i.test(prompt)) return "book_workspace";
      if (/活动|互动|检查点|课堂练习/.test(prompt)) return "classroom_activity";
      if (/顺序|流程|课时安排|板书|导入|讲解版/.test(prompt)) return "teaching_sequence";
      return "lesson_plan";
    case "report_draft":
      if (/月报|月度/.test(prompt) || slots.timeRange === "last_month") return "monthly_report";
      if (/周报|每周|周复盘/.test(prompt) || slots.timeRange === "last_week") return "weekly_report";
      if (/Word|PDF|docx?|导出|可编辑/i.test(prompt)) return "export_document";
      return "parent_summary";
    case "knowledge_retrieval":
      if (/图谱|关联|关系|先修|前置知识/.test(prompt)) return "knowledge_graph_lookup";
      if (/引用|来源|出处/.test(prompt)) return "source_citation";
      return "resource_search";
    case "workspace_help":
      if (/API|Key|DeepSeek|配置|设置/i.test(prompt)) return "settings_help";
      if (/导入|备份|数据目录|归档|文件夹|打开|保存/.test(prompt)) return "data_management_help";
      return "usage_help";
    default:
      return "concept_explanation";
  }
}
function allowedToolsFor(policy, route) {
  const tools = ["ask_user"];
  if (policy.include.includes("student_lookup")) tools.push("resolve_student_reference");
  if (policy.include.includes("student_profile")) tools.push("get_student_profile");
  if (policy.include.includes("learning_records")) tools.push("search_learning_records");
  if (policy.include.includes("learning_records") && route === "error_analysis") tools.push("classify_error_patterns");
  if (policy.include.includes("learning_records") && (route === "student_diagnosis" || route === "report_draft")) tools.push("analyze_learning_progress");
  if (policy.include.includes("learning_records")) tools.push("mastery_status");
  if (policy.include.includes("learning_records")) tools.push("get_review_queue");
  if (policy.include.includes("learning_records")) tools.push("mastery_quiz", "mastery_grade");
  if (policy.include.includes("learning_records")) tools.push("mastery_assess", "mastery_build");
  if (policy.include.includes("attachment_metadata")) tools.push("list_attachment_metadata");
  if (policy.include.includes("attached_sources")) tools.push("explore_attached_sources");
  if (policy.include.includes("attachment_metadata") && route === "error_analysis") tools.push("analyze_geometry_figure");
  if (policy.include.includes("teacher_notebook")) tools.push("analyze_notebook_context");
  if (policy.include.includes("teacher_knowledge")) tools.push("search_teacher_knowledge");
  if (policy.include.includes("knowledge_graph")) tools.push("query_knowledge_graph");
  if (policy.include.includes("teacher_knowledge") && ["knowledge_retrieval", "lesson_design", "report_draft"].includes(route)) tools.push("generate_research_outline");
  if (policy.include.includes("knowledge_graph") && ["knowledge_retrieval", "lesson_design", "report_draft"].includes(route)) tools.push("render_learning_mermaid");
  if (policy.include.includes("question_bank")) tools.push("search_similar_questions");
  if (policy.include.includes("question_notebook")) tools.push("search_question_notebook");
  if (policy.include.includes("teaching_book")) tools.push("inspect_teaching_book", "refresh_teaching_book_health", "draft_teaching_book_patch", "draft_teaching_book_selection_patch", "draft_teaching_book_markdown");
  if (policy.include.includes("memory_trace")) tools.push("inspect_memory_trace");
  if (policy.include.includes("memory_summary")) tools.push("inspect_memory_summary", "draft_memory_summary");
  if (policy.include.includes("memory_synthesis")) tools.push("inspect_memory_synthesis", "draft_memory_synthesis", "inspect_memory_graph", "inspect_memory_governance");
  if (policy.include.includes("teaching_book") && policy.include.includes("teacher_knowledge")) tools.push("plan_teaching_book");
  return tools;
}
function buildClarificationQuestion(params) {
  if (params.slots.hasMultipleStudentRefs && params.needsStudent) {
    return "\u8BF7\u786E\u8BA4\u672C\u8F6E\u8981\u4EE5\u54EA\u4E00\u4E2A\u5B66\u751F\u4F5C\u4E3A\u4E3B\u5BF9\u8C61\uFF1B\u5982\u679C\u662F\u5BF9\u6BD4\u4EFB\u52A1\uFF0C\u8BF7\u8BF4\u660E\u662F\u5426\u5141\u8BB8\u5206\u522B\u8BFB\u53D6\u4E24\u540D\u5B66\u751F\u7684\u672C\u5730\u8BB0\u5F55\u3002";
  }
  const canResolveNamedStudent = !params.hasStudent && params.slots.studentRefs.length === 1;
  if (params.needsStudent && !params.hasStudent && !canResolveNamedStudent) {
    return "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5B66\u751F\uFF0C\u6216\u5728\u4EFB\u52A1\u91CC\u660E\u786E\u5B66\u751F\u663E\u793A\u540D\uFF0C\u4F8B\u5982\u201C\u5C0FA\u201D\u3002";
  }
  if (/帮我看看这个情况|给我一个计划|这个怎么办/.test(params.prompt) && params.prompt.length < 12) {
    return "\u8BF7\u8865\u5145\u4EFB\u52A1\u5BF9\u8C61\uFF1A\u662F\u5B66\u751F\u8BCA\u65AD\u3001\u9519\u9898\u5206\u6790\u3001\u7EC3\u4E60\u8BBE\u8BA1\uFF0C\u8FD8\u662F\u77E5\u8BC6\u5E93\u68C0\u7D22\uFF1F";
  }
  return void 0;
}
function routeAiPrompt(prompt, options) {
  const slots = extractSlots(prompt);
  const researchRequested = /研究|教研报告|文献综述|研究提纲|deep\s*research|research\s*assistant/i.test(prompt);
  const visualizationRequested = /可视化|流程图|概念图|关系图|mermaid|visualize/i.test(prompt);
  const questionNotebookRequested = /题目笔记本|题目收藏|收藏题目|收藏夹|收藏|错题本|题目书签|分类题目|我的题目/.test(prompt);
  const memorySummaryRequested = /L2|表面摘要|可编辑摘要|记忆摘要|近期事实|偏好摘要|memory summary|surface summary/i.test(prompt);
  const memorySynthesisRequested = /L3|综合记忆|综合摘要|跨 surface|cross[- ]surface|memory synthesis|profile memory|preferences memory/i.test(prompt);
  const memoryRequested = !memorySummaryRequested && /查看.*(L1|运行轨迹|处理过程|Agent trace)|L1.*(记忆|证据)|memory trace|run history|运行历史|小智.*轨迹|memory evidence/i.test(prompt);
  const teachingBookPlanRequested = /规划讲义|章节规划|生成章节大纲|章节骨架|来源探索|spine|source explorer/i.test(prompt);
  const teachingBookRequested = teachingBookPlanRequested || /专题讲义|单元备课包|教材工作区|教学包|课程讲义|讲义包|章节页面|内容块|讲义健康|刷新.*(来源|健康)|失效队列|来源指纹|编辑讲义|修改内容块|改写讲义|讲义 patch|撤销讲义|修改讲义.*撤销|支持撤销|讲义引用|知识库漂移|来源漂移|重新生成.*(页面|块)|备课包状态|选区|局部改写|自动批注|自动标注|CoWriter|co-writer/.test(prompt);
  const attachedSourceRequested = /附件|图片中|图中|照片中|上传的文件|文档中|文件中|材料中/i.test(prompt);
  const researchMode = researchRequested && !teachingBookRequested;
  const visualizationMode = visualizationRequested && !teachingBookRequested;
  const picked = teachingBookRequested ? { route: "lesson_design", confidence: 0.98 } : researchMode ? { route: "knowledge_retrieval", confidence: 0.94 } : visualizationRequested ? { route: "lesson_design", confidence: 0.94 } : pickRoute(prompt, slots);
  const basePolicy = ROUTE_POLICIES[picked.route];
  const notebookRequested = !questionNotebookRequested && /笔记|备课本|历史草稿|notebook/i.test(prompt);
  const contextPolicy = memoryRequested ? {
    ...basePolicy,
    include: ["memory_trace"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u8BB0\u5FC6\u68C0\u67E5\u53EA\u8BFB\u53D6\u672C\u5730 L1 run/event/tool \u6458\u8981\uFF1B\u4E0D\u8BFB\u53D6\u5B66\u751F\u6B63\u6587\uFF0C\u4E0D\u8FD4\u56DE prompt \u539F\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002"
  } : memorySynthesisRequested ? {
    ...basePolicy,
    include: ["memory_synthesis"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "L3 \u7EFC\u5408\u53EA\u8BFB\u53D6\u5DF2\u786E\u8BA4\u7684 L2 surface \u6761\u76EE\uFF0C\u5019\u9009\u9700\u6559\u5E08\u5BA1\u6838\uFF1B\u4E0D\u8BFB\u53D6\u5B66\u751F\u6B63\u6587\u3001\u539F\u59CB prompt \u6216\u9690\u85CF\u63A8\u7406\u3002"
  } : memorySummaryRequested ? {
    ...basePolicy,
    include: ["memory_summary"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "L2 \u8868\u9762\u6458\u8981\u53EA\u8BFB\u672C\u5730\u6559\u5E08\u53EF\u89C1\u6458\u8981\u4E0E evidence refs\uFF1B\u8349\u7A3F\u4E0D\u81EA\u52A8\u5199\u5165\u6B63\u5F0F\u8BB0\u5FC6\uFF0C\u4E0D\u8BFB\u53D6\u5B66\u751F\u6B63\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002"
  } : attachedSourceRequested ? {
    ...basePolicy,
    include: [.../* @__PURE__ */ new Set([...basePolicy.include.filter((item) => ["student_lookup", "student_profile", "attachment_metadata"].includes(item)), "attached_sources"])],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u9644\u4EF6\u63A2\u7D22\u53EA\u8BFB\u53D6\u5F53\u524D\u5DF2\u6388\u6743\u7684\u672C\u5730\u6765\u6E90\u53E5\u67C4\u548C\u8131\u654F OCR \u7247\u6BB5\uFF1B\u65E0\u9644\u4EF6\u6216\u65E0\u8131\u654F\u6587\u672C\u65F6\u660E\u786E\u8FD4\u56DE\u672A\u77E5\uFF0C\u4E0D\u8BFB\u53D6\u5168\u90E8\u539F\u6587\u4EF6\u3002"
  } : researchRequested ? {
    ...basePolicy,
    include: ["teacher_knowledge"],
    recordLimit: 0,
    knowledgeLimit: 6,
    graphNodeLimit: 0,
    reason: "\u7814\u7A76\u63D0\u7EB2\u53EA\u8BFB\u672C\u5730\u6559\u5E08\u77E5\u8BC6\u5207\u7247\u5E76\u8FD4\u56DE\u6765\u6E90\u4E0E\u672A\u77E5\u9879\uFF1B\u4E0D\u8054\u7F51\u3001\u4E0D\u8BFB\u53D6\u5B66\u751F\u6570\u636E\u3001\u4E0D\u81EA\u52A8\u5199\u6587\u4EF6\u3002"
  } : visualizationMode ? {
    ...basePolicy,
    include: ["knowledge_graph"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 12,
    reason: "\u53EF\u89C6\u5316\u53EA\u8BFB\u672C\u5730\u77E5\u8BC6\u56FE\u8C31\u6458\u8981\u5E76\u751F\u6210\u53D7\u9650 Mermaid\uFF1B\u4E0D\u6267\u884C\u811A\u672C\u3001\u4E0D\u52A0\u8F7D\u5916\u94FE\u3001\u4E0D\u5199\u6587\u4EF6\u3002"
  } : teachingBookPlanRequested ? {
    ...basePolicy,
    include: ["teaching_book", "teacher_knowledge"],
    recordLimit: 0,
    knowledgeLimit: 6,
    graphNodeLimit: 0,
    reason: "\u7AE0\u8282\u89C4\u5212\u5148\u6309\u9700\u63A2\u7D22\u8001\u5E08\u77E5\u8BC6\u5E93\u7684 bounded \u4E3B\u9898/\u6765\u6E90\uFF0C\u518D\u751F\u6210\u8BB2\u4E49\u7AE0\u8282\u5019\u9009\uFF1B\u4E0D\u8BFB\u53D6\u5B66\u751F\u6570\u636E\uFF0C\u4E0D\u81EA\u52A8\u5199\u5165\u8BB2\u4E49\u3002"
  } : teachingBookRequested ? {
    ...basePolicy,
    include: ["teaching_book"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u4E13\u9898\u8BB2\u4E49/\u5355\u5143\u5907\u8BFE\u5305\u4EFB\u52A1\u53EA\u8BFB\u53D6\u7ED3\u6784\u5316\u8BB2\u4E49\u76EE\u5F55\u3001\u5185\u5BB9\u5757\u548C\u6765\u6E90\u5065\u5EB7\uFF0C\u4E0D\u9ED8\u8BA4\u8BFB\u53D6\u5B66\u751F\u9690\u79C1\u6216\u5927\u6BB5\u77E5\u8BC6\u5E93\u6B63\u6587\u3002"
  } : questionNotebookRequested ? {
    ...basePolicy,
    include: ["question_notebook"],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: "\u9898\u76EE\u6536\u85CF/\u5206\u7C7B\u4EFB\u52A1\u53EA\u8BFB\u53D6\u73B0\u6709\u9898\u5E93\u4E0A\u7684 Question Notebook \u8F7B\u91CF\u7D22\u5F15\uFF0C\u4E0D\u8BFB\u53D6\u5B66\u751F\u6216\u6559\u5E08\u77E5\u8BC6\u5E93\u4E0A\u4E0B\u6587\u3002"
  } : notebookRequested ? {
    ...basePolicy,
    include: [.../* @__PURE__ */ new Set([...basePolicy.include, "teacher_notebook"])],
    reason: `${basePolicy.reason} \u672C\u8F6E\u660E\u786E\u8BF7\u6C42\u5907\u8BFE\u672C\u5185\u5BB9\uFF0C\u6309\u9700\u8BFB\u53D6\u6559\u5E08\u5907\u8BFE\u672C\u76EE\u5F55\u4E0E\u6709\u9650\u7EC6\u8282\u3002`
  } : basePolicy;
  const riskLevel = inferRisk(prompt);
  const needsStudent = memoryRequested || memorySummaryRequested || memorySynthesisRequested || questionNotebookRequested || teachingBookRequested || researchMode || visualizationMode ? false : routeNeedsStudent(picked.route) || attachedSourceRequested;
  const subIntent = memoryRequested ? "memory_trace" : memorySynthesisRequested ? "memory_synthesis" : memorySummaryRequested ? "memory_summary" : teachingBookRequested ? "book_workspace" : researchMode ? "research_workspace" : visualizationMode ? "visualization" : inferSubIntent(picked.route, prompt, slots, riskLevel);
  const clarificationQuestion = buildClarificationQuestion({
    needsStudent,
    hasStudent: options.hasStudent,
    slots,
    prompt: prompt.trim()
  });
  return {
    route: picked.route,
    subIntent,
    confidence: clarificationQuestion ? Math.min(picked.confidence, 0.58) : picked.confidence,
    audience: inferAudience(prompt),
    actionLevel: inferActionLevel(picked.route, slots),
    riskLevel,
    slots,
    needsStudent: needsStudent || !questionNotebookRequested && !memoryRequested && !memorySummaryRequested && !memorySynthesisRequested && !researchMode && !visualizationMode && hasExplicitStudentReference(prompt, slots),
    clarificationQuestion,
    allowedTools: allowedToolsFor(contextPolicy, picked.route),
    contextPolicy,
    roleProfile: inferAiRoleProfile(prompt)
  };
}

// src/main/ai-harness/mastery-snapshot.ts
async function buildMasterySnapshot(store, studentId) {
  const records = await store.listRecords(studentId, { limit: 200 });
  const points = /* @__PURE__ */ new Map();
  const attempts = [];
  let unknownEvidence = 0;
  for (const record of records) {
    let metadata = {};
    try {
      const parsed = JSON.parse(record.content || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;
    } catch {
    }
    const controlledTag = record.tags.find((tag) => tag !== "mastery_attempt" && tag !== "mastery_assess" && tag.trim().length > 0);
    const hasMasterySignal = record.recordType === "mastery_attempt" || record.tags.includes("mastery_attempt") || record.tags.includes("mastery_assess");
    const knowledgePoint = String(metadata.knowledgePoint || (hasMasterySignal ? controlledTag : "") || "").trim().slice(0, 160);
    if (!knowledgePoint) {
      unknownEvidence += 1;
      continue;
    }
    const moduleName = String(metadata.moduleName || record.subject || "\u672A\u5206\u7C7B").trim().slice(0, 80) || "\u672A\u5206\u7C7B";
    const moduleId = `subject_${moduleName.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 64) || "general"}`;
    const pointId = `kp_${knowledgePoint.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 80) || "unknown"}`;
    const rawType = String(metadata.knowledgeType || "procedure").toLowerCase();
    const type = ["memory", "concept", "procedure", "design"].includes(rawType) ? rawType : "procedure";
    if (!points.has(pointId)) points.set(pointId, { id: pointId, name: knowledgePoint, type, moduleId, moduleName, order: points.size });
    const explicitCorrect = typeof metadata.isCorrect === "boolean" ? metadata.isCorrect : void 0;
    const inferredCorrect = record.recordType === "mistake" ? false : void 0;
    const isCorrect = explicitCorrect ?? inferredCorrect;
    if (typeof isCorrect !== "boolean") {
      unknownEvidence += 1;
      continue;
    }
    const evidenceKind = record.tags.some((tag) => tag === "mastery_assess") || metadata.type === "mastery_assessment" ? "assess" : record.tags.some((tag) => tag === "mastery_attempt") || record.recordType === "mastery_attempt" ? "quiz" : "unknown";
    const occurred = Date.parse(record.occurredAt);
    attempts.push({
      questionId: record.id,
      knowledgePointId: pointId,
      moduleId,
      isCorrect,
      evidenceKind,
      timestamp: Number.isFinite(occurred) ? occurred / 1e3 : Date.now() / 1e3
    });
  }
  const modules = [...new Map([...points.values()].map((point) => [point.moduleId, point])).values()].sort((a, b) => a.order - b.order).map((first) => ({
    id: first.moduleId,
    name: first.moduleName,
    order: first.order,
    knowledge_points: [...points.values()].filter((point) => point.moduleId === first.moduleId).map((point) => ({ id: point.id, name: point.name, type: point.type, module_id: point.moduleId }))
  }));
  return {
    bookId: `omni_student_${studentId}`,
    modules,
    attempts,
    evidence: { recordCount: records.length, attemptCount: attempts.length, unknownEvidence }
  };
}

// src/main/ai-harness/review-scheduler.ts
var REVIEW_INTERVAL_DAYS = {
  memory: [0, 1, 3, 7, 14, 30, 60],
  concept: [3, 7, 14, 30],
  procedure: [3, 7, 14],
  design: [14, 28]
};
var SECONDS_PER_DAY = 86400;
var MAX_OUTCOMES = 200;
function normalizeReviewKnowledgeType(value) {
  return value === "memory" || value === "concept" || value === "procedure" || value === "design" ? value : "procedure";
}
function clampReviewNow(value, fallback = 0) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, parsed);
}
function scheduleFromOutcomes(knowledgeType, rawOutcomes, now2 = 0) {
  const outcomes = rawOutcomes.filter((outcome) => outcome && typeof outcome === "object" && typeof outcome.isCorrect === "boolean").map((outcome) => ({
    isCorrect: outcome.isCorrect,
    timestamp: clampReviewNow(outcome.timestamp, 0)
  })).sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_OUTCOMES);
  if (!outcomes.length) return null;
  const type = normalizeReviewKnowledgeType(knowledgeType);
  const intervals = REVIEW_INTERVAL_DAYS[type];
  let intervalIndex = 0;
  let consecutiveCorrect = 0;
  let consecutiveWrong = 0;
  for (const outcome of outcomes) {
    if (outcome.isCorrect) {
      consecutiveWrong = 0;
      consecutiveCorrect += 1;
      intervalIndex += consecutiveCorrect >= 2 ? 2 : 1;
      if (consecutiveCorrect >= 2) consecutiveCorrect = 0;
    } else {
      consecutiveWrong += 1;
      consecutiveCorrect = 0;
      intervalIndex = Math.max(0, intervalIndex - 1);
      if (consecutiveWrong >= 2) consecutiveWrong = 0;
    }
    intervalIndex = Math.max(0, Math.min(intervalIndex, intervals.length - 1));
  }
  const lastTimestamp = outcomes[outcomes.length - 1].timestamp;
  return {
    intervalIndex,
    consecutiveCorrect,
    consecutiveWrong,
    nextReviewAt: Math.max(0, lastTimestamp + intervals[intervalIndex] * SECONDS_PER_DAY)
  };
}

// src/main/ai-harness/mastery-policy.ts
var RECENCY_WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1];
var CONFIDENCE_CAP = { 1: 0.5, 2: 0.8 };
var QUANTITATIVE_GATE = 0.9;
var QUALITATIVE_TYPES = /* @__PURE__ */ new Set(["concept", "design"]);
var TYPE_PRIORITY = { memory: 2, concept: 3, procedure: 4, design: 5 };
function boundedOutcomeList(snapshot, pointId) {
  return snapshot.attempts.filter((attempt) => attempt.knowledgePointId === pointId).sort((a, b) => a.timestamp - b.timestamp || a.questionId.localeCompare(b.questionId)).slice(-200);
}
function computeMastery(outcomes) {
  if (!outcomes.length) return 0;
  const recent = outcomes.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  const weighted = recent.reduce((sum, value, index) => sum + weights[index] * (value ? 1 : 0), 0) / weights.reduce((sum, value) => sum + value, 0);
  return Math.min(weighted, CONFIDENCE_CAP[recent.length] ?? 1);
}
function scheduleFromOutcomes2(type, outcomes) {
  return scheduleFromOutcomes(type, outcomes, 0)?.nextReviewAt ?? null;
}
function buildMasteryPolicy(snapshot, now2 = Date.now() / 1e3) {
  const points = [];
  for (const module of [...snapshot.modules].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    for (const [pointOrder, point] of module.knowledge_points.entries()) {
      const attempts = boundedOutcomeList(snapshot, point.id);
      const outcomes = attempts.map((attempt) => attempt.isCorrect);
      const mastery = computeMastery(outcomes);
      const qualitativePassed = QUALITATIVE_TYPES.has(point.type) && attempts.some((attempt) => attempt.evidenceKind === "assess" && attempt.isCorrect);
      const mastered = qualitativePassed || !QUALITATIVE_TYPES.has(point.type) && mastery >= QUANTITATIVE_GATE;
      const nextReviewAt = scheduleFromOutcomes2(point.type, attempts);
      points.push({
        id: point.id,
        name: point.name,
        type: point.type,
        moduleId: module.id,
        moduleName: module.name,
        order: module.order * 1e4 + pointOrder,
        attempts: attempts.length,
        correct: outcomes.filter(Boolean).length,
        mastery: Math.round(mastery * 1e3) / 1e3,
        threshold: QUALITATIVE_TYPES.has(point.type) ? 1 : QUANTITATIVE_GATE,
        status: mastered ? "mastered" : attempts.length ? "learning" : "new",
        nextReviewAt,
        due: nextReviewAt != null && nextReviewAt <= now2
      });
    }
  }
  const dueReviews = points.filter((point) => point.due).sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9) || a.order - b.order).slice(0, 20);
  const nextReview = dueReviews[0];
  let next;
  if (nextReview) {
    next = {
      action: "review",
      moduleId: nextReview.moduleId,
      moduleName: nextReview.moduleName,
      knowledgePointId: nextReview.id,
      knowledgePointName: nextReview.name,
      knowledgePointType: nextReview.type,
      status: nextReview.status,
      mastery: nextReview.mastery,
      threshold: nextReview.threshold,
      reason: "\u5230\u671F\u590D\u4E60\u4F18\u5148\u4E8E\u63A8\u8FDB\u65B0\u77E5\u8BC6\u70B9\u3002"
    };
  } else {
    const candidate = points.find((point) => point.status !== "mastered");
    if (!candidate) {
      next = { action: "complete", reason: "\u6240\u6709\u77E5\u8BC6\u70B9\u5747\u5DF2\u901A\u8FC7\u638C\u63E1\u95E8\u7981\uFF0C\u4E14\u6CA1\u6709\u5230\u671F\u590D\u4E60\u3002" };
    } else {
      const qualitative = QUALITATIVE_TYPES.has(candidate.type);
      next = {
        action: candidate.status === "new" ? "probe" : qualitative ? "assess" : "practice",
        moduleId: candidate.moduleId,
        moduleName: candidate.moduleName,
        knowledgePointId: candidate.id,
        knowledgePointName: candidate.name,
        knowledgePointType: candidate.type,
        status: candidate.status,
        mastery: candidate.mastery,
        threshold: candidate.threshold,
        reason: candidate.status === "new" ? "\u5C1A\u65E0\u663E\u5F0F\u8BC1\u636E\uFF0C\u5148\u505A\u63A2\u6D4B\u9898\uFF0C\u4E0D\u9884\u8BBE\u5DF2\u638C\u63E1\u3002" : "\u5C1A\u672A\u8FBE\u5230\u8BE5\u77E5\u8BC6\u70B9\u7684\u638C\u63E1\u95E8\u7981\uFF0C\u7EE7\u7EED\u7EC3\u4E60\u6216\u8FDB\u884C\u8D28\u6027\u8BC4\u4F30\u3002"
      };
    }
  }
  return { policyVersion: "omni.mastery.policy.v1", now: now2, next, dueReviews, points, evidence: snapshot.evidence };
}

// src/main/ai-harness/learning-analytics.ts
var LEARNING_ANALYTICS_SCHEMA_VERSION = "omni.learning.analytics.v1";
function isoDate(value) {
  return value.toISOString().slice(0, 10);
}
function parseDateOnly(value, label2) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label2} \u5FC5\u987B\u662F YYYY-MM-DD\u3002`);
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== value) throw new Error(`${label2} \u4E0D\u662F\u6709\u6548\u65E5\u671F\u3002`);
  return value;
}
function dateOfRecord(record) {
  const parsed = new Date(record.occurredAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoDate(parsed);
}
function boundedKey(value) {
  return value.trim().slice(0, 120);
}
function increment(map, value) {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}
function parseMetadata(record) {
  try {
    const parsed = JSON.parse(record.content || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function stableCounts(map, limit = 20) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
  );
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}
function stableKey(value) {
  return JSON.stringify(stableValue(value));
}
function buildLearningAnalytics(input) {
  const now2 = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const defaultEnd = isoDate(new Date(now2));
  const defaultStart = isoDate(new Date(now2 - 29 * 864e5));
  const startDate = parseDateOnly(input.startDate || defaultStart, "startDate");
  const endDate = parseDateOnly(input.endDate || defaultEnd, "endDate");
  if (startDate > endDate) throw new Error("startDate \u4E0D\u80FD\u665A\u4E8E endDate\u3002");
  const spanDays = Math.floor((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 864e5) + 1;
  if (spanDays > 366) throw new Error("\u5206\u6790\u65F6\u95F4\u8303\u56F4\u4E0D\u80FD\u8D85\u8FC7 366 \u5929\u3002");
  const subject = boundedKey(input.subject || "");
  const included = [];
  let excludedRecordCount = 0;
  for (const record of input.records) {
    const day = dateOfRecord(record);
    const subjectMatch = !subject || subject === "\u5168\u90E8" || record.subject === subject;
    if (day && day >= startDate && day <= endDate && subjectMatch) included.push(record);
    else excludedRecordCount += 1;
  }
  included.sort((a, b) => {
    const timeA = Date.parse(a.occurredAt);
    const timeB = Date.parse(b.occurredAt);
    return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0) || a.id.localeCompare(b.id);
  });
  const recordTypeCounts = /* @__PURE__ */ new Map();
  const subjectCounts = /* @__PURE__ */ new Map();
  const tagCounts = /* @__PURE__ */ new Map();
  const activeDays = /* @__PURE__ */ new Set();
  const pointStats = /* @__PURE__ */ new Map();
  let attachmentCount = 0;
  let mistakeCount = 0;
  let masteryAttemptCount = 0;
  let masteryCorrectCount = 0;
  let unknownEvidenceCount = 0;
  for (const record of included) {
    const recordType = boundedKey(record.recordType || "unknown");
    const recordSubject = boundedKey(record.subject || "\u672A\u5206\u7C7B") || "\u672A\u5206\u7C7B";
    const day = dateOfRecord(record);
    increment(recordTypeCounts, recordType);
    increment(subjectCounts, recordSubject);
    if (day) activeDays.add(day);
    attachmentCount += record.attachments.length;
    if (/mistake|错题|错因|失分|错误/i.test(recordType) || /错题|错因|失分|错误/.test(record.title)) mistakeCount += 1;
    for (const tag of record.tags.slice(0, 16)) increment(tagCounts, boundedKey(tag));
    const metadata = parseMetadata(record);
    const knowledgePoint = boundedKey(String(metadata.knowledgePoint || ""));
    const explicitCorrect = typeof metadata.isCorrect === "boolean" ? metadata.isCorrect : void 0;
    if (knowledgePoint && typeof explicitCorrect === "boolean") {
      masteryAttemptCount += 1;
      if (explicitCorrect) masteryCorrectCount += 1;
      const stats = pointStats.get(knowledgePoint) ?? { attempts: 0, correct: 0 };
      stats.attempts += 1;
      if (explicitCorrect) stats.correct += 1;
      pointStats.set(knowledgePoint, stats);
    } else if (record.recordType === "mastery_attempt" || record.tags.includes("mastery_attempt") || record.tags.includes("mastery_assess")) {
      unknownEvidenceCount += 1;
    }
  }
  const topKnowledgePoints = [...pointStats.entries()].map(([knowledgePoint, stats]) => ({
    knowledgePoint,
    attempts: stats.attempts,
    correct: stats.correct,
    accuracy: Math.round(stats.correct / stats.attempts * 1e3) / 1e3
  })).sort((a, b) => b.attempts - a.attempts || a.accuracy - b.accuracy || a.knowledgePoint.localeCompare(b.knowledgePoint)).slice(0, 20);
  const masteryAccuracy = masteryAttemptCount ? Math.round(masteryCorrectCount / masteryAttemptCount * 1e3) / 1e3 : null;
  const metrics = {
    recordCount: included.length,
    activeDays: activeDays.size,
    attachmentCount,
    mistakeCount,
    masteryAttemptCount,
    masteryCorrectCount,
    masteryAccuracy,
    recordTypeCounts: stableCounts(recordTypeCounts),
    subjectCounts: stableCounts(subjectCounts)
  };
  const facts = included.length ? [
    `\u65F6\u95F4\u8303\u56F4\u5185\u5171\u6709 ${included.length} \u6761\u5B66\u4E60\u8BB0\u5F55\uFF0C\u8986\u76D6 ${activeDays.size} \u4E2A\u5B66\u4E60\u65E5\u3002`,
    `\u9519\u9898/\u9519\u8BEF\u76F8\u5173\u8BB0\u5F55 ${mistakeCount} \u6761\uFF0C\u663E\u5F0F\u638C\u63E1\u5EA6\u8BC1\u636E ${masteryAttemptCount} \u6761\u3002`,
    masteryAccuracy == null ? "\u5F53\u524D\u8303\u56F4\u6CA1\u6709\u53EF\u8BA1\u7B97\u638C\u63E1\u5EA6\u7684\u663E\u5F0F\u6B63\u8BEF\u8BC1\u636E\u3002" : `\u663E\u5F0F\u638C\u63E1\u5EA6\u8BC1\u636E\u6B63\u786E\u7387\u4E3A ${(masteryAccuracy * 100).toFixed(1)}%\u3002`
  ] : ["\u5F53\u524D\u65F6\u95F4\u8303\u56F4\u548C\u5B66\u79D1\u7B5B\u9009\u4E0B\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55\u3002"];
  const unknowns = [
    ...masteryAttemptCount ? [] : ["\u6CA1\u6709\u8DB3\u591F\u7684\u663E\u5F0F\u6B63\u8BEF\u8BC1\u636E\uFF0C\u4E0D\u80FD\u63A8\u65AD\u638C\u63E1\u5EA6\u3002"],
    ...included.length && mistakeCount ? [] : ["\u6CA1\u6709\u8DB3\u591F\u9519\u9898\u8BC1\u636E\uFF0C\u4E0D\u80FD\u5F52\u7EB3\u7A33\u5B9A\u9519\u56E0\u3002"]
  ];
  const sourceRecordIds = included.map((record) => record.id).slice(0, 100);
  const recalculationKey2 = stableKey({
    studentId: input.studentId,
    window: { startDate, endDate, subject },
    sourceRecordIds,
    metrics,
    topTags: Object.entries(stableCounts(tagCounts, 10)),
    topKnowledgePoints
  });
  return {
    schemaVersion: LEARNING_ANALYTICS_SCHEMA_VERSION,
    studentId: input.studentId,
    window: { startDate, endDate, subject, timezone: "UTC-calendar" },
    metrics,
    topTags: Object.entries(stableCounts(tagCounts, 10)).map(([tag, count]) => ({ tag, count })),
    topKnowledgePoints,
    evidence: {
      sourceRecordIds,
      includedRecordCount: included.length,
      excludedRecordCount,
      unknownEvidenceCount
    },
    facts,
    unknowns,
    recalculationKey: recalculationKey2
  };
}
function buildLearningAnalyticsMarkdown(analytics, studentName) {
  const { metrics, window } = analytics;
  const subjectLabel = window.subject || "\u5168\u90E8\u5B66\u79D1";
  return [
    `# ${studentName} \u5B66\u60C5\u5206\u6790\u8349\u7A3F`,
    "",
    `\u5206\u6790\u8303\u56F4\uFF1A${window.startDate} \u81F3 ${window.endDate}\uFF08${subjectLabel}\uFF0CUTC \u65E5\u5386\u8FB9\u754C\uFF09`,
    "",
    "## \u4E00\u3001\u53EF\u6838\u9A8C\u4E8B\u5B9E",
    ...analytics.facts.map((fact) => `- ${fact}`),
    `- \u5B66\u4E60\u8BB0\u5F55\u7C7B\u578B\uFF1A${Object.entries(metrics.recordTypeCounts).map(([key, value]) => `${key} ${value} \u6761`).join("\uFF0C") || "\u6682\u65E0"}`,
    `- \u5B66\u79D1\u5206\u5E03\uFF1A${Object.entries(metrics.subjectCounts).map(([key, value]) => `${key} ${value} \u6761`).join("\uFF0C") || "\u6682\u65E0"}`,
    "",
    "## \u4E8C\u3001\u8BC1\u636E\u8584\u5F31\u5904",
    ...analytics.unknowns.map((unknown) => `- ${unknown}`),
    "",
    "## \u4E09\u3001\u6559\u5E08\u590D\u6838\u5EFA\u8BAE",
    "- \u8BF7\u7ED3\u5408\u8BFE\u5802\u8868\u73B0\u548C\u8BA2\u6B63\u8FC7\u7A0B\u786E\u8BA4\u8FD9\u4E9B\u7EDF\u8BA1\u662F\u5426\u4EE3\u8868\u7A33\u5B9A\u8D8B\u52BF\u3002",
    "- \u4EFB\u4F55\u5B66\u751F\u6807\u7B7E\u6216\u6B63\u5F0F\u7ED3\u8BBA\u90FD\u9700\u8981\u6559\u5E08\u5355\u72EC\u786E\u8BA4\uFF0C\u4E0D\u80FD\u7531\u7EDF\u8BA1\u7ED3\u679C\u81EA\u52A8\u5199\u5165\u6863\u6848\u3002",
    "",
    "## \u56DB\u3001\u6765\u6E90\u8BB0\u5F55",
    analytics.evidence.sourceRecordIds.length ? analytics.evidence.sourceRecordIds.map((id) => `- ${id}`) : ["- \u6682\u65E0\u53EF\u5F15\u7528\u8BB0\u5F55\u3002"]
  ].join("\n");
}

// src/main/ai-harness/error-taxonomy.ts
var ERROR_TAXONOMY_SCHEMA_VERSION = "omni.error.taxonomy.v1";
function isoDate2(value) {
  return value.toISOString().slice(0, 10);
}
function parseDateOnly2(value, label2) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label2} \u5FC5\u987B\u662F YYYY-MM-DD\u3002`);
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate2(parsed) !== value) throw new Error(`${label2} \u4E0D\u662F\u6709\u6548\u65E5\u671F\u3002`);
  return value;
}
function resolveWindow(startDate, endDate, nowMs = Date.now()) {
  const today = isoDate2(new Date(nowMs));
  const end = parseDateOnly2(endDate || today, "endDate");
  const startFallback = isoDate2(new Date((/* @__PURE__ */ new Date(`${end}T00:00:00.000Z`)).getTime() - 29 * 864e5));
  const start = parseDateOnly2(startDate || startFallback, "startDate");
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (startMs > endMs) throw new Error("startDate \u4E0D\u80FD\u665A\u4E8E endDate\u3002");
  if ((endMs - startMs) / 864e5 > 365) throw new Error("\u9519\u56E0\u5206\u6790\u65F6\u95F4\u8DE8\u5EA6\u4E0D\u80FD\u8D85\u8FC7 366 \u5929\u3002");
  return { startDate: start, endDate: end };
}
function dateOfRecord2(record) {
  const parsed = new Date(record.occurredAt);
  return Number.isNaN(parsed.getTime()) ? null : isoDate2(parsed);
}
function parseMetadata2(record) {
  try {
    const value = JSON.parse(record.content || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}
function explicitCategory(value) {
  const key = normalized(value);
  if (!key) return void 0;
  if (["structural", "knowledge_structural", "concept", "knowledge", "\u77E5\u8BC6\u7ED3\u6784", "\u6982\u5FF5\u6DF7\u6DC6"].includes(key)) return "structural";
  if (["deviation", "understanding_deviation", "understanding", "\u9898\u610F\u504F\u5DEE", "\u7406\u89E3\u504F\u5DEE", "\u5BA1\u9898"].includes(key)) return "deviation";
  if (["application", "application_error", "procedure", "\u5E94\u7528\u9519\u8BEF", "\u6B65\u9AA4\u9519\u8BEF", "\u8BA1\u7B97\u9519\u8BEF"].includes(key)) return "application";
  if (["metacognitive", "metacognition", "blank", "unknown_answer", "\u5143\u8BA4\u77E5", "\u4E0D\u4F1A", "\u7A7A\u767D"].includes(key)) return "metacognitive";
  if (["unknown", "\u672A\u5206\u7C7B", "\u672A\u77E5"].includes(key)) return "unknown";
  return void 0;
}
function isBlank(value) {
  const text2 = normalized(value);
  return !text2 || ["\u7A7A\u767D", "\u672A\u4F5C\u7B54", "\u4E0D\u4F1A", "\u4E0D\u77E5\u9053", "\u653E\u5F03", ""].includes(text2);
}
function candidateText(record) {
  return [record.recordType, record.title, record.summary, ...record.tags, record.content].filter(Boolean).join(" ").toLowerCase();
}
function classifyRecord(record) {
  const metadata = parseMetadata2(record);
  const explicit = explicitCategory(
    metadata.errorType ?? metadata.error_type ?? metadata.errorCategory ?? metadata.error_category ?? metadata.mistakeType
  );
  if (explicit) {
    return {
      recordId: record.id,
      category: explicit,
      confidence: explicit === "unknown" ? "low" : "high",
      evidence: ["\u8BB0\u5F55\u5143\u6570\u636E\u63D0\u4F9B\u4E86\u663E\u5F0F\u9519\u56E0\u7C7B\u522B\u3002"],
      needsTeacherReview: explicit === "unknown"
    };
  }
  if (metadata.isCorrect === false && isBlank(metadata.answer ?? metadata.userAnswer ?? metadata.user_answer)) {
    return {
      recordId: record.id,
      category: "metacognitive",
      confidence: "high",
      evidence: ["\u7ED3\u6784\u5316\u8BB0\u5F55\u663E\u793A\u9898\u76EE\u672A\u4F5C\u7B54\u6216\u56DE\u7B54\u4E3A\u7A7A\u3002"],
      needsTeacherReview: false
    };
  }
  const text2 = candidateText(record);
  const signals = [
    { category: "metacognitive", words: ["\u7A7A\u767D", "\u672A\u4F5C\u7B54", "\u4E0D\u4F1A", "\u4E0D\u77E5\u9053", "\u6CA1\u601D\u8DEF", "\u653E\u5F03"] },
    { category: "structural", words: ["\u6982\u5FF5\u6DF7\u6DC6", "\u5B9A\u4E49\u4E0D\u6E05", "\u516C\u5F0F\u4E0D\u4F1A", "\u5B9A\u7406\u4E0D\u6E05", "\u77E5\u8BC6\u70B9\u4E0D\u4F1A", "\u77E5\u8BC6\u7ED3\u6784"] },
    { category: "deviation", words: ["\u8BFB\u9898", "\u9898\u610F", "\u5BA1\u9898", "\u6761\u4EF6\u7406\u89E3", "\u7406\u89E3\u504F\u5DEE", "\u8F6C\u5316\u9519\u8BEF"] },
    { category: "application", words: ["\u6B65\u9AA4", "\u8BA1\u7B97", "\u7B26\u53F7", "\u5355\u4F4D", "\u4EE3\u5165", "\u6284\u9519", "\u7C97\u5FC3", "\u8FD0\u7B97"] }
  ];
  const matched = signals.find((item) => item.words.some((word) => text2.includes(word)));
  if (matched) {
    const teacherReview = matched.category === "application" && text2.includes("\u7C97\u5FC3");
    return {
      recordId: record.id,
      category: matched.category,
      confidence: matched.category === "metacognitive" ? "medium" : "low",
      evidence: [`\u8BB0\u5F55\u6587\u672C\u5305\u542B\u201C${matched.words.find((word) => text2.includes(word))}\u201D\u4FE1\u53F7\u3002`],
      needsTeacherReview: teacherReview || matched.category === "application"
    };
  }
  return {
    recordId: record.id,
    category: "unknown",
    confidence: "low",
    evidence: ["\u8BB0\u5F55\u6CA1\u6709\u663E\u5F0F\u9519\u56E0\u7C7B\u522B\u6216\u8DB3\u591F\u7684\u53EF\u9A8C\u8BC1\u4FE1\u53F7\u3002"],
    needsTeacherReview: true
  };
}
function stableValue2(value) {
  if (Array.isArray(value)) return value.map(stableValue2);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, stableValue2(nested)]));
  }
  return value;
}
function recalculationKey(value) {
  return JSON.stringify(stableValue2(value));
}
function fingerprint(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function buildErrorTaxonomyAnalysis(input) {
  const window = resolveWindow(input.startDate, input.endDate, input.nowMs);
  const subject = String(input.subject ?? "").trim();
  const included = input.records.filter((record) => {
    const date = dateOfRecord2(record);
    if (!date || date < window.startDate || date > window.endDate) return false;
    if (subject && subject !== "\u5168\u90E8" && record.subject !== subject) return false;
    const text2 = candidateText(record);
    return /mistake|错题|错因|失分|错误|订正|纠错/.test(text2);
  });
  const classifications = included.map(classifyRecord);
  const counts = { structural: 0, deviation: 0, application: 0, metacognitive: 0, unknown: 0 };
  for (const item of classifications) counts[item.category] += 1;
  const sourceRecordIds = included.map((record) => record.id).slice(0, 100);
  const unknownRecordIds = classifications.filter((item) => item.category === "unknown").map((item) => item.recordId).slice(0, 100);
  const facts = [
    `\u5171\u7EB3\u5165 ${included.length} \u6761\u53EF\u8BC6\u522B\u7684\u9519\u9898/\u8BA2\u6B63\u8BB0\u5F55\u3002`,
    `\u7ED3\u6784\u6027\u3001\u7406\u89E3\u504F\u5DEE\u3001\u5E94\u7528\u9519\u8BEF\u3001\u5143\u8BA4\u77E5\u548C\u672A\u77E5\u5206\u522B\u4E3A ${counts.structural}/${counts.deviation}/${counts.application}/${counts.metacognitive}/${counts.unknown}\u3002`,
    ...counts.application ? ["\u5E94\u7528\u9519\u8BEF\u4ECD\u9700\u533A\u5206\u7C97\u5FC3\u3001\u6B65\u9AA4\u548C\u8BA1\u7B97\uFF0C\u4E0D\u80FD\u76F4\u63A5\u5F53\u4F5C\u7A33\u5B9A\u80FD\u529B\u7ED3\u8BBA\u3002"] : []
  ];
  const unknowns = [
    ...unknownRecordIds.length ? [`${unknownRecordIds.length} \u6761\u8BB0\u5F55\u6CA1\u6709\u8DB3\u591F\u8BC1\u636E\u5B8C\u6210\u9519\u56E0\u5206\u7C7B\uFF0C\u9700\u8001\u5E08\u590D\u6838\u3002`] : [],
    ...included.length ? [] : ["\u5F53\u524D\u65F6\u95F4\u7A97\u548C\u5B66\u79D1\u7B5B\u9009\u6CA1\u6709\u53EF\u8BC6\u522B\u7684\u9519\u9898/\u8BA2\u6B63\u8BB0\u5F55\u3002"]
  ];
  return {
    schemaVersion: ERROR_TAXONOMY_SCHEMA_VERSION,
    studentId: input.studentId,
    window: { ...window, subject: subject || "\u5168\u90E8", timezone: "UTC-calendar" },
    counts,
    classifications,
    evidence: {
      sourceRecordIds,
      includedRecordCount: included.length,
      excludedRecordCount: Math.max(0, input.records.length - included.length),
      unknownRecordIds
    },
    facts,
    unknowns,
    recalculationKey: recalculationKey({
      studentId: input.studentId,
      window,
      subject: subject || "\u5168\u90E8",
      records: included.map((record) => ({
        id: record.id,
        occurredAt: record.occurredAt,
        titleFingerprint: fingerprint(record.title),
        tagsFingerprint: fingerprint(record.tags.join("|")),
        contentFingerprint: fingerprint(record.content)
      }))
    })
  };
}
function buildErrorTaxonomyMarkdown(analysis, displayName) {
  const lines = [
    `## ${displayName}\u9519\u56E0\u5206\u7C7B\u8349\u7A3F`,
    `- \u7EDF\u8BA1\u8303\u56F4\uFF1A${analysis.window.startDate} \u81F3 ${analysis.window.endDate}\uFF08${analysis.window.subject}\uFF09`,
    `- \u8BC1\u636E\u8BB0\u5F55\uFF1A${analysis.evidence.sourceRecordIds.length} \u6761\uFF1B\u672A\u77E5\u5206\u7C7B\uFF1A${analysis.evidence.unknownRecordIds.length} \u6761`,
    "",
    "### \u53EF\u9A8C\u8BC1\u4E8B\u5B9E",
    ...analysis.facts.map((fact) => `- ${fact}`),
    "",
    "### \u5206\u7C7B\u7ED3\u679C\uFF08\u9700\u8001\u5E08\u786E\u8BA4\uFF09",
    ...analysis.classifications.slice(0, 100).map((item) => `- ${item.recordId}\uFF1A${item.category}\uFF08${item.confidence}\uFF0C${item.needsTeacherReview ? "\u9700\u590D\u6838" : "\u53EF\u6682\u7528"}\uFF09`),
    "",
    "### \u672A\u77E5\u4E0E\u8FB9\u754C",
    ...analysis.unknowns.length ? analysis.unknowns.map((item) => `- ${item}`) : ["- \u5F53\u524D\u6CA1\u6709\u989D\u5916\u672A\u77E5\u9879\u3002"],
    "",
    `\u6765\u6E90\u8BB0\u5F55 ID\uFF1A${analysis.evidence.sourceRecordIds.join("\u3001") || "\u65E0"}`
  ];
  return lines.join("\n").slice(0, 3800);
}

// src/main/ai-harness/vision-solver.ts
var VISION_SOLVER_SCHEMA_VERSION = "omni.vision.solver.v1";
var MAX_COMMANDS = 24;
var MAX_COMMAND_LENGTH = 320;
var MAX_TEXT_LENGTH = 240;
var ALLOWED_COMMANDS = /* @__PURE__ */ new Set([
  "ShowAxes",
  "ShowGrid",
  "Point",
  "Midpoint",
  "Intersect",
  "Center",
  "Line",
  "Segment",
  "Ray",
  "Perpendicular",
  "PerpendicularBisector",
  "AngleBisector",
  "Vector",
  "Circle",
  "Ellipse",
  "Hyperbola",
  "Parabola",
  "Polygon",
  "Angle",
  "Translate",
  "Rotate",
  "Reflect",
  "Dilate",
  "SetColor",
  "SetLineThickness",
  "SetPointSize",
  "SetLabelVisible",
  "SetCaption",
  "SetVisible",
  "SetLineStyle",
  "Text",
  "Function",
  "Derivative",
  "Integral"
]);
var FORBIDDEN_COMMAND = /(?:https?:\/\/|javascript:|<script|\b(?:Execute|Run|Eval|Import|Export|SetValue|Delete|File|Open|Load)\b|[{};])/iu;
var SENSITIVE_COMMAND_TEXT = /(?:\b\d{7,}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|PRIVATE|RAW|SHOULD[_ ]*NOT[_ ]*LEAK)/iu;
var POINT_ASSIGNMENT = /^[A-Za-z][A-Za-z0-9_]{0,20}\s*=\s*\(\s*[-+0-9A-Za-z_.°\s,]+\s*\)$/u;
var REFERENCE_WORDS = /如图|如图所示|看图|从图中|图示|图中|根据图|观察图|参照图/gu;
function cleanText(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function commandName(command) {
  const match = command.match(/^\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?([A-Za-z][A-Za-z0-9_]*)\s*(?:\[|\()/);
  return match?.[1] ?? "";
}
function normalizeCommand(command) {
  const compact = cleanText(command, MAX_COMMAND_LENGTH);
  if (!compact) return { command: "", valid: false, warning: "\u547D\u4EE4\u4E3A\u7A7A\u3002" };
  if (FORBIDDEN_COMMAND.test(compact)) return { command: "[\u5DF2\u62D2\u7EDD\u547D\u4EE4]", valid: false, warning: "\u547D\u4EE4\u5305\u542B\u811A\u672C\u3001\u5916\u90E8\u8D44\u6E90\u6216\u672A\u5141\u8BB8\u7684\u526F\u4F5C\u7528\u3002" };
  if (SENSITIVE_COMMAND_TEXT.test(compact)) return { command: "[\u5DF2\u62D2\u7EDD\u547D\u4EE4]", valid: false, warning: "\u547D\u4EE4\u6587\u672C\u7591\u4F3C\u5305\u542B\u4E2A\u4EBA\u4FE1\u606F\u6216\u5185\u90E8\u6807\u8BB0\uFF0C\u5DF2\u4ECE\u8349\u7A3F\u4E2D\u79FB\u9664\u3002" };
  if (POINT_ASSIGNMENT.test(compact)) return { command: compact, valid: true };
  const name = commandName(compact);
  if (!name || !ALLOWED_COMMANDS.has(name)) return { command: "[\u5DF2\u62D2\u7EDD\u547D\u4EE4]", valid: false, warning: `\u547D\u4EE4 ${name || "\u672A\u77E5"} \u4E0D\u5728 GeoGebra \u767D\u540D\u5355\u5185\u3002` };
  const repaired = compact.replace(new RegExp(`\\b(${name})\\s*\\((.*)\\)$`, "u"), "$1[$2]");
  return {
    command: repaired,
    valid: true,
    warning: repaired === compact ? void 0 : "\u5DF2\u5C06\u5DF2\u77E5 GeoGebra \u547D\u4EE4\u7684\u5706\u62EC\u53F7\u4FEE\u6B63\u4E3A\u65B9\u62EC\u53F7\uFF0C\u8BF7\u8001\u5E08\u9884\u89C8\u3002"
  };
}
function boundedList(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? cleanText(item) : cleanText(item?.description)).filter(Boolean).slice(0, maxItems);
}
function buildVisionSolverDraft(params) {
  const analysis = params.analysis;
  const questionText = cleanText(params.questionText, 1200);
  const hasImage = Boolean(analysis?.localPath);
  const commands = Array.isArray(params.commands) ? params.commands.slice(0, MAX_COMMANDS).map((item) => {
    const record = typeof item === "string" ? { command: item, description: "" } : item && typeof item === "object" ? item : {};
    const normalized2 = normalizeCommand(String(record.command ?? ""));
    return {
      command: normalized2.command,
      description: cleanText(record.description),
      valid: normalized2.valid,
      ...normalized2.warning ? { warning: normalized2.warning } : {}
    };
  }).filter((item) => item.command) : [];
  const validCommands = commands.filter((item) => item.valid);
  const keywords = [...new Set((questionText.match(REFERENCE_WORDS) ?? []).map((item) => item.slice(0, 20)))];
  const sanitizedText = cleanText(analysis?.sanitizedText || analysis?.teacherCorrectedText, 1200);
  const redactionCount = (analysis?.redactions ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0);
  const imageIsReference = keywords.length > 0;
  const unknowns = [
    !hasImage ? "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u672C\u5730\u9519\u9898\u56FE\u7247\u3002" : "",
    hasImage && !sanitizedText ? "\u56FE\u7247\u5DF2\u6709\u672C\u5730\u6587\u4EF6\uFF0C\u4F46\u6CA1\u6709\u53EF\u4F9B\u6A21\u578B\u4F7F\u7528\u7684\u8131\u654F OCR/\u6559\u5E08\u4FEE\u6B63\u6587\u3002" : "",
    commands.length && validCommands.length !== commands.length ? "\u90E8\u5206 GeoGebra \u547D\u4EE4\u672A\u901A\u8FC7\u767D\u540D\u5355\u6821\u9A8C\uFF0C\u672A\u8FDB\u5165\u8349\u7A3F\u811A\u672C\u3002" : "",
    validCommands.length ? "\u51E0\u4F55\u5173\u7CFB\u548C\u5750\u6807\u4ECD\u9700\u8001\u5E08\u5BF9\u7167\u539F\u56FE\u786E\u8BA4\uFF0C\u4E0D\u80FD\u628A\u56FE\u4E2D\u4F30\u7B97\u70B9\u5F53\u4F5C\u9898\u5E72\u4E8B\u5B9E\u3002" : "\u6CA1\u6709\u751F\u6210\u53EF\u9884\u89C8\u7684 GeoGebra \u547D\u4EE4\u3002"
  ].filter(Boolean).slice(0, 8);
  const ggbScript = validCommands.map((item) => item.command).join("\n");
  const status = !hasImage ? "no_image" : validCommands.length ? "ready" : "empty_commands";
  return {
    schemaVersion: VISION_SOLVER_SCHEMA_VERSION,
    status,
    hasImage,
    ...analysis?.id ? { analysisId: analysis.id } : {},
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
      ...analysis?.ocrStatus ? { ocrStatus: analysis.ocrStatus } : {},
      redactionCount
    },
    facts: [
      hasImage ? `\u5DF2\u627E\u5230\u672C\u5730\u9519\u9898\u56FE\u7247\u5206\u6790 ${analysis?.id ?? "\u672A\u547D\u540D"}\u3002` : "\u672A\u627E\u5230\u672C\u5730\u9519\u9898\u56FE\u7247\u5206\u6790\u3002",
      sanitizedText ? "\u53EA\u4F7F\u7528\u4E86\u8131\u654F OCR/\u6559\u5E08\u4FEE\u6B63\u6587\u4F5C\u4E3A\u9898\u5E72\u4E0A\u4E0B\u6587\u3002" : "\u6CA1\u6709\u628A\u672C\u5730\u56FE\u7247\u539F\u6587\u53D1\u9001\u7ED9\u6A21\u578B\u3002",
      validCommands.length ? `\u901A\u8FC7\u767D\u540D\u5355\u6821\u9A8C\u7684 GeoGebra \u547D\u4EE4\uFF1A${validCommands.length} \u6761\u3002` : "\u6CA1\u6709\u901A\u8FC7\u767D\u540D\u5355\u6821\u9A8C\u7684 GeoGebra \u547D\u4EE4\u3002"
    ],
    unknowns,
    nextActions: validCommands.length ? ["\u8001\u5E08\u5BF9\u7167\u672C\u5730\u539F\u56FE\u68C0\u67E5\u70B9\u3001\u7EBF\u3001\u89D2\u548C\u5750\u6807\u4F30\u7B97\u3002", "\u786E\u8BA4\u540E\u518D\u628A ggbScript \u8349\u7A3F\u7528\u4E8E\u53EF\u89C6\u5316\uFF1B\u672C\u8F6E\u4E0D\u4F1A\u81EA\u52A8\u5199\u56DE\u6216\u4E0A\u4F20\u539F\u56FE\u3002"] : ["\u5148\u5B8C\u6210\u672C\u5730 OCR \u6216\u6559\u5E08\u4FEE\u6B63\uFF0C\u518D\u91CD\u65B0\u8BF7\u6C42\u51E0\u4F55\u8349\u7A3F\u3002", "\u5982\u679C\u6CA1\u6709\u51E0\u4F55\u56FE\u7247\uFF0C\u8BF7\u6539\u7528\u7EAF\u6587\u672C\u89E3\u9898\uFF0C\u4E0D\u8C03\u7528\u89C6\u89C9\u6C42\u89E3\u3002"]
  };
}
function buildVisionSolverMarkdown(draft) {
  const lines = [
    "## GeoGebra \u51E0\u4F55\u8349\u7A3F\uFF08\u6559\u5E08\u9884\u89C8\uFF09",
    `- \u72B6\u6001\uFF1A${draft.status}\uFF1B\u539F\u56FE\u4E0A\u4F20\uFF1A\u5426\uFF1B\u9700\u8001\u5E08\u590D\u6838\uFF1A\u662F`,
    ...draft.facts.map((item) => `- \u4E8B\u5B9E\uFF1A${item}`),
    ...draft.unknowns.map((item) => `- \u672A\u77E5/\u8FB9\u754C\uFF1A${item}`)
  ];
  if (draft.ggbScript) lines.push("", "```ggbscript[main;\u9898\u76EE\u56FE\u5F62]", draft.ggbScript, "```");
  return lines.join("\n");
}

// src/main/ai-harness/notebook-analysis.ts
var NOTEBOOK_ANALYSIS_SCHEMA_VERSION = "omni.notebook.analysis.v1";
var MAX_CATALOG = 200;
var MAX_DETAIL = 5;
var MAX_DETAIL_CHARS = 1800;
var MAX_SUMMARY_CHARS = 600;
function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function tokens(value) {
  return [...new Set(clean(value, 600).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((item) => item.length >= 2))];
}
function scoreEntry(entry, queryTokens) {
  if (!queryTokens.length) return 1;
  const haystack = tokens([entry.title, entry.summary, entry.userQuery, entry.recordType].join(" "));
  const matched = queryTokens.filter((token) => haystack.includes(token)).length;
  return matched * 10 + (entry.summary ? 1 : 0);
}
function fallbackSummary(entry) {
  const stored = clean(entry.summary, MAX_SUMMARY_CHARS);
  if (stored) return { text: stored, basis: "stored_summary" };
  const output = clean(entry.output, MAX_SUMMARY_CHARS);
  const sentence = output.split(/[。！？!?\n]/u).find(Boolean) ?? output;
  return { text: clean(sentence, MAX_SUMMARY_CHARS) || "\u5F53\u524D\u8BB0\u5F55\u6CA1\u6709\u53EF\u63D0\u53D6\u7684\u6458\u8981\u3002", basis: "bounded_output_excerpt" };
}
async function buildNotebookAnalysis(params) {
  const queryInput = clean(params.query, 1e3);
  const sanitizedQuery = params.sanitize ? await params.sanitize(queryInput) : { sanitizedText: queryInput, redactions: [] };
  const query = clean(sanitizedQuery.sanitizedText, 1e3);
  const mode = params.mode === "record_summary" ? "record_summary" : "context";
  const rawEntries = params.records.flatMap(({ notebook, records }) => records.map((record) => ({ ...record, notebookName: notebook.name }))).filter((record) => !record.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CATALOG);
  const entries = await Promise.all(rawEntries.map(async (entry) => {
    const [notebookName, title, summary2, userQuery, output] = await Promise.all([
      params.sanitize ? params.sanitize(entry.notebookName) : Promise.resolve({ sanitizedText: entry.notebookName, redactions: [] }),
      params.sanitize ? params.sanitize(entry.title) : Promise.resolve({ sanitizedText: entry.title, redactions: [] }),
      params.sanitize ? params.sanitize(entry.summary) : Promise.resolve({ sanitizedText: entry.summary, redactions: [] }),
      params.sanitize ? params.sanitize(entry.userQuery) : Promise.resolve({ sanitizedText: entry.userQuery, redactions: [] }),
      params.sanitize ? params.sanitize(entry.output) : Promise.resolve({ sanitizedText: entry.output, redactions: [] })
    ]);
    return {
      ...entry,
      notebookName: clean(notebookName.sanitizedText, 160),
      title: clean(title.sanitizedText, 240),
      summary: clean(summary2.sanitizedText, MAX_SUMMARY_CHARS),
      userQuery: clean(userQuery.sanitizedText, 800),
      output: clean(output.sanitizedText, MAX_DETAIL_CHARS)
    };
  }));
  const queryTokens = tokens(query);
  const ranked = entries.map((entry, index) => ({ entry, score: scoreEntry(entry, queryTokens), index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = mode === "record_summary" && params.recordId ? ranked.filter(({ entry }) => entry.id === params.recordId).slice(0, 1) : ranked.slice(0, MAX_DETAIL);
  const selectedIds = new Set(selected.map(({ entry }) => entry.id));
  const selection = ranked.slice(0, Math.min(MAX_CATALOG, 50)).map(({ entry, score }) => ({
    recordId: entry.id,
    notebookId: entry.notebookId,
    notebookName: clean(entry.notebookName, 160),
    recordType: entry.recordType,
    title: clean(entry.title, 240),
    summary: clean(entry.summary, MAX_SUMMARY_CHARS),
    score,
    selectedForDetail: selectedIds.has(entry.id)
  }));
  const details = [];
  for (const { entry } of selected) {
    const sanitized = { sanitizedText: clean(entry.output, MAX_DETAIL_CHARS), redactions: [] };
    details.push({
      recordId: entry.id,
      notebookId: entry.notebookId,
      notebookName: clean(entry.notebookName, 160),
      recordType: entry.recordType,
      title: clean(entry.title, 240),
      userQuery: clean(entry.userQuery, 800),
      summary: clean(entry.summary, MAX_SUMMARY_CHARS),
      outputPreview: clean(sanitized.sanitizedText, MAX_DETAIL_CHARS),
      redactionCount: sanitized.redactions.reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0)
    });
  }
  const summaryEntry = mode === "record_summary" ? selected[0]?.entry : void 0;
  const summary = summaryEntry ? fallbackSummary(summaryEntry) : void 0;
  const omittedCount = Math.max(0, entries.length - details.length);
  const summaryDraft = summaryEntry && summary ? { recordId: summaryEntry.id, title: clean(summaryEntry.title, 240), text: summary.text, basis: summary.basis, requiresTeacherReview: true } : void 0;
  return {
    schemaVersion: NOTEBOOK_ANALYSIS_SCHEMA_VERSION,
    mode,
    query,
    coverage: { catalogCount: entries.length, selectedCount: selected.length, detailCount: details.length, omittedCount, maxDetailChars: MAX_DETAIL_CHARS },
    selection,
    details,
    ...summaryDraft ? { summaryDraft } : {},
    facts: [
      `\u672C\u8F6E\u626B\u63CF ${entries.length} \u6761\u672A\u5220\u9664\u5907\u8BFE\u672C\u8BB0\u5F55\uFF0C\u6309\u67E5\u8BE2\u76F8\u5173\u6027\u9009\u62E9 ${details.length} \u6761\u8BFB\u53D6\u7EC6\u8282\u3002`,
      details.length ? "\u7EC6\u8282\u5185\u5BB9\u5DF2\u9650\u5236\u957F\u5EA6\uFF0C\u5E76\u7ECF\u8FC7\u672C\u5730\u8131\u654F\u540E\u624D\u4F5C\u4E3A\u6A21\u578B\u4E0A\u4E0B\u6587\u3002" : "\u672C\u8F6E\u6CA1\u6709\u8BFB\u53D6\u4EFB\u4F55\u7B14\u8BB0\u6B63\u6587\u3002",
      params.notebooks.length ? `\u5F53\u524D\u6709 ${params.notebooks.length} \u4E2A\u53EF\u7528\u6559\u5E08\u5907\u8BFE\u672C\u3002` : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u6559\u5E08\u5907\u8BFE\u672C\u3002"
    ],
    unknowns: [
      entries.length > details.length ? `\u8FD8\u6709 ${entries.length - details.length} \u6761\u8BB0\u5F55\u53EA\u4FDD\u7559\u76EE\u5F55\u6458\u8981\uFF0C\u672A\u8BFB\u53D6\u6B63\u6587\u3002` : "",
      !entries.length ? "\u6CA1\u6709\u8DB3\u591F\u7B14\u8BB0\u5185\u5BB9\u652F\u6301\u8DE8\u8BB0\u5F55\u7ED3\u8BBA\u3002" : "",
      mode === "record_summary" && !summaryEntry ? "\u8BF7\u6C42\u7684 recordId \u672A\u547D\u4E2D\u5F53\u524D\u53EF\u89C1\u7B14\u8BB0\u3002" : ""
    ].filter(Boolean),
    nextActions: details.length ? ["\u57FA\u4E8E\u5DF2\u9009\u7B14\u8BB0\u56DE\u7B54\u5F53\u524D\u4EFB\u52A1\uFF0C\u5E76\u660E\u786E\u672A\u8BFB\u53D6\u8BB0\u5F55\u8303\u56F4\u3002", "\u6458\u8981\u6216\u6539\u5199\u7ED3\u679C\u4ECD\u9700\u8001\u5E08\u786E\u8BA4\u540E\u4FDD\u5B58\u56DE\u5907\u8BFE\u672C\u3002"] : ["\u5148\u521B\u5EFA\u5907\u8BFE\u672C\u5E76\u4FDD\u5B58\u4E00\u6761\u8BB0\u5F55\uFF0C\u518D\u8BF7\u6C42\u6309\u9700\u5206\u6790\u3002"]
  };
}

// src/main/ai-harness/question-notebook.ts
var QUESTION_NOTEBOOK_SCHEMA_VERSION = "omni.question.notebook.v1";
var MAX_TEXT = 1200;
var MAX_ITEMS = 20;
function clean2(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
async function buildQuestionNotebookAnalysis(params) {
  const filters = params.filters ?? {};
  const sanitize = async (text2, max = MAX_TEXT) => {
    const bounded = clean2(text2, max);
    const result = params.sanitize ? await params.sanitize(bounded) : { sanitizedText: bounded };
    return clean2(result.sanitizedText, max);
  };
  const items = await Promise.all(params.result.items.slice(0, MAX_ITEMS).map(async (item) => ({
    questionId: item.id,
    subject: await sanitize(item.subject, 120),
    grade: await sanitize(item.grade, 80),
    knowledgePoint: await sanitize(item.knowledgePoint, 180),
    questionType: await sanitize(item.questionType, 120),
    difficulty: item.difficulty,
    stem: await sanitize(item.stem),
    answer: await sanitize(item.answer),
    analysis: await sanitize(item.analysis),
    sourceTitle: await sanitize(item.sourceTitle, 180),
    sourceKind: item.sourceKind,
    tags: await Promise.all(item.tags.slice(0, 12).map((tag) => sanitize(tag, 80))),
    bookmarked: item.bookmarked,
    version: item.version,
    categories: await Promise.all(item.categories.slice(0, 12).map(async (category) => ({ id: category.id, name: await sanitize(category.name, 100) }))),
    usageCount: item.usageCount,
    lastUsedAt: item.lastUsedAt
  })));
  const query = await sanitize(filters.query ?? "", 240);
  const limit = Math.max(1, Math.min(Math.trunc(filters.limit ?? 20), MAX_ITEMS));
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
  return {
    schemaVersion: QUESTION_NOTEBOOK_SCHEMA_VERSION,
    filters: {
      query,
      categoryId: clean2(filters.categoryId, 160),
      ...filters.bookmarked == null ? {} : { bookmarked: filters.bookmarked },
      sourceKind: clean2(filters.sourceKind, 40),
      limit,
      offset
    },
    coverage: { total: params.result.total, selected: items.length, hasMore: offset + items.length < params.result.total },
    items,
    facts: [
      `\u5F53\u524D\u9898\u76EE\u6536\u85CF\u7D22\u5F15\u547D\u4E2D ${params.result.total} \u9053 canonical \u9898\u5E93\u9898\uFF0C\u8FD4\u56DE ${items.length} \u9053\u3002`,
      "\u6536\u85CF\u3001\u5206\u7C7B\u548C\u5386\u53F2\u5F15\u7528\u662F\u9898\u5E93\u4E4B\u4E0A\u7684\u8F7B\u91CF\u7D22\u5F15\uFF0C\u9898\u5E72/\u7B54\u6848\u4ECD\u4EE5\u672C\u5730\u9898\u5E93\u4E3A\u552F\u4E00\u771F\u6E90\u3002",
      items.some((item) => item.usageCount > 0) ? "\u90E8\u5206\u9898\u76EE\u5B58\u5728\u9898\u7EC4\u6216\u5176\u4ED6\u5386\u53F2\u5F15\u7528\u3002" : "\u5F53\u524D\u8FD4\u56DE\u9898\u76EE\u6CA1\u6709\u53EF\u56DE\u8BFB\u7684\u5386\u53F2\u5F15\u7528\u3002"
    ],
    unknowns: [
      params.result.total > items.length ? `\u8FD8\u6709 ${params.result.total - items.length} \u9053\u547D\u4E2D\u9898\u76EE\u672A\u5728\u672C\u9875\u5C55\u5F00\u3002` : "",
      !items.length ? "\u6CA1\u6709\u8DB3\u591F\u7684\u6536\u85CF/\u5206\u7C7B\u9898\u76EE\u652F\u6301\u8FDB\u4E00\u6B65\u5224\u65AD\u3002" : ""
    ].filter(Boolean),
    nextActions: items.length ? ["\u53EF\u7EE7\u7EED\u6309\u5206\u7C7B\u3001\u6536\u85CF\u72B6\u6001\u6216\u77E5\u8BC6\u70B9\u7B5B\u9009\u3002", "\u5982\u9700\u4FEE\u6539\u9898\u76EE\u6536\u85CF\u6216\u5206\u7C7B\uFF0C\u8BF7\u901A\u8FC7\u6559\u5E08\u64CD\u4F5C\u786E\u8BA4\u540E\u6267\u884C\u3002"] : ["\u5148\u4ECE\u73B0\u6709\u9898\u5E93\u6536\u85CF\u9898\u76EE\u6216\u521B\u5EFA\u5206\u7C7B\uFF0C\u518D\u8FDB\u884C\u68C0\u7D22\u3002"]
  };
}

// src/main/ai-harness/teaching-book.ts
var TEACHING_BOOK_SCHEMA_VERSION = "omni.teaching.book.v1";
function clean3(value, max = 400) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function buildTeachingBookInspection(detail, query = "") {
  if (!detail) return { schemaVersion: TEACHING_BOOK_SCHEMA_VERSION, ok: false, reason: "book_not_found", query: clean3(query, 240), coverage: { chapterCount: 0, pageCount: 0, selectedPages: 0, blockCount: 0, sourceCount: 0 }, health: { status: "missing_sources", staleSourceRefs: [], missingSourceRefs: [], stalePageIds: [], staleBlockIds: [] }, facts: [], unknowns: ["\u672A\u627E\u5230\u6307\u5B9A\u8BB2\u4E49\u6216\u8BB2\u4E49\u5DF2\u5F52\u6863\u3002"], nextActions: ["\u8BF7\u5148\u521B\u5EFA\u4E13\u9898\u8BB2\u4E49/\u5355\u5143\u5907\u8BFE\u5305\uFF0C\u518D\u67E5\u8BE2\u5176\u72B6\u6001\u3002"] };
  const { book, chapters, pages, blocks, sources, health } = detail;
  const selectedPages = pages.filter((page) => !query || `${page.title} ${page.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
  return {
    schemaVersion: TEACHING_BOOK_SCHEMA_VERSION,
    ok: true,
    book: { id: book.id, title: clean3(book.title, 200), description: clean3(book.description, 600), status: book.status, language: book.language, targetLevel: clean3(book.targetLevel, 80), version: book.version },
    coverage: { chapterCount: chapters.length, pageCount: pages.length, selectedPages: selectedPages.length, blockCount: blocks.length, sourceCount: sources.length },
    chapters: chapters.slice(0, 30).map((chapter) => ({ id: chapter.id, title: clean3(chapter.title, 200), order: chapter.order, contentType: chapter.contentType, pageCount: pages.filter((page) => page.chapterId === chapter.id).length, learningObjectives: chapter.learningObjectives.slice(0, 8).map((item) => clean3(item, 160)) })),
    pages: selectedPages.map((page) => ({ id: page.id, chapterId: page.chapterId, title: clean3(page.title, 200), status: page.status, version: page.version, blockCount: page.blockCount, error: clean3(page.error, 240) })),
    blocks: blocks.filter((block) => selectedPages.some((page) => page.id === block.pageId)).slice(0, 60).map((block) => ({ id: block.id, pageId: block.pageId, type: block.type, status: block.status, title: clean3(block.title, 160), version: block.version, sourceRefs: block.sourceAnchors.slice(0, 12).map((source) => source.ref), error: clean3(block.error, 180) })),
    sources: sources.slice(0, 40).map((source) => ({ kind: source.kind, ref: source.ref, title: clean3(source.title, 200), status: source.status, fingerprint: clean3(source.fingerprint, 160) })),
    health: { status: health.status, staleSourceRefs: health.staleSourceRefs.slice(0, 40), missingSourceRefs: health.missingSourceRefs.slice(0, 40), stalePageIds: health.stalePageIds.slice(0, 40), staleBlockIds: health.staleBlockIds.slice(0, 60) },
    facts: [
      `\u8BB2\u4E49\u201C${clean3(book.title, 120)}\u201D\u5F53\u524D\u4E3A ${book.status}\uFF0C\u5305\u542B ${chapters.length} \u4E2A\u7AE0\u8282\u3001${pages.length} \u4E2A\u9875\u9762\u548C ${blocks.length} \u4E2A\u5185\u5BB9\u5757\u3002`,
      health.status === "healthy" ? "\u5DF2\u767B\u8BB0\u6765\u6E90\u672A\u53D1\u73B0\u6F02\u79FB\u6216\u7F3A\u5931\u3002" : `\u6765\u6E90\u5065\u5EB7\u72B6\u6001\u4E3A ${health.status}\uFF0C\u53EA\u6807\u8BB0\u53D7\u5F71\u54CD\u9875\u9762/\u5185\u5BB9\u5757\uFF0C\u4E0D\u76F2\u76EE\u91CD\u751F\u6210\u6574\u672C\u8BB2\u4E49\u3002`,
      "\u5185\u5BB9\u5757\u4FDD\u7559 sourceRefs\uFF1B\u6B63\u6587\u4ECD\u7531\u672C\u5730\u8BB2\u4E49\u5DE5\u4F5C\u533A\u548C\u77E5\u8BC6\u8D44\u6E90\u4F5C\u4E3A\u771F\u6E90\u3002"
    ],
    unknowns: [
      health.missingSourceRefs.length ? "\u90E8\u5206\u6765\u6E90\u5DF2\u5220\u9664\u6216\u4E0D\u53EF\u56DE\u8BFB\uFF0C\u4E0D\u80FD\u636E\u6B64\u65AD\u8A00\u5185\u5BB9\u4ECD\u7136\u51C6\u786E\u3002" : "",
      health.staleSourceRefs.length ? "\u90E8\u5206\u6765\u6E90\u6307\u7EB9\u53D1\u751F\u53D8\u5316\uFF0C\u9700\u8981\u8001\u5E08\u786E\u8BA4\u540E\u518D\u91CD\u751F\u6210\u53D7\u5F71\u54CD\u5185\u5BB9\u5757\u3002" : ""
    ].filter(Boolean),
    nextActions: health.status === "healthy" ? ["\u53EF\u6309\u9875\u9762\u6216\u5185\u5BB9\u5757\u7EE7\u7EED\u7F16\u6392\u3001\u9884\u89C8\u6216\u5BFC\u51FA\u3002"] : ["\u5148\u6838\u5BF9\u53D7\u5F71\u54CD\u6765\u6E90\uFF0C\u518D\u6309\u9875\u9762/\u5185\u5BB9\u5757\u7C92\u5EA6\u91CD\u751F\u6210\uFF1B\u4E0D\u8981\u6574\u672C\u76F2\u76EE\u91CD\u5EFA\u3002"]
  };
}

// src/main/ai-harness/teaching-book-renderer.ts
var TEACHING_BOOK_MARKDOWN_SCHEMA_VERSION = "omni.teaching.book.markdown.v1";
var MAX_MARKDOWN = 18e3;
function text(value, max = 2e3) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function safeText(value, max = 2e3) {
  return text(value, max).replace(/javascript\s*:/gi, "").replace(/data\s*:/gi, "").replace(/https?:\/\//gi, "").replace(/[<>]/g, (character) => character === "<" ? "&lt;" : "&gt;");
}
function fence(value, language = "") {
  const body = text(value, 6e3).replace(/```/g, "``\\`");
  return body ? `

\`\`\`${language}
${body}
\`\`\`` : "";
}
function renderBlock(block) {
  if (block.status === "hidden") return { markdown: "", fallback: false };
  if (block.status === "pending" || block.status === "generating") return { markdown: `
> \u5185\u5BB9\u5757\u201C${text(block.title, 160)}\u201D\u6B63\u5728\u751F\u6210\uFF0C\u5F53\u524D\u4EC5\u5C55\u793A\u5360\u4F4D\u3002
`, fallback: true };
  if (block.status === "error") return { markdown: `
> \u26A0\uFE0F \u5185\u5BB9\u5757\u201C${text(block.title, 160)}\u201D\u751F\u6210\u5931\u8D25\uFF1A${text(block.error, 400) || "\u672A\u77E5\u9519\u8BEF"}
`, fallback: true };
  const payload = block.payload ?? {};
  switch (block.type) {
    case "text":
    case "chapter":
    case "section":
      return { markdown: text(payload.body ?? payload.markdown ?? payload.content ?? payload.text ?? ""), fallback: false };
    case "callout":
      return { markdown: `> **${text(payload.title ?? block.title ?? "\u63D0\u793A", 160)}**
> ${text(payload.body ?? payload.content, 2e3).replace(/\n/g, "\n> ")}`, fallback: false };
    case "quiz": {
      const questions = Array.isArray(payload.questions) ? payload.questions.slice(0, 12) : [];
      if (!questions.length) return { markdown: `> **${text(block.title || "\u968F\u5802\u5C0F\u6D4B", 160)}**
> \u6682\u65E0\u9898\u76EE\u3002`, fallback: true };
      const lines = questions.map((raw, index) => {
        const q = raw && typeof raw === "object" ? raw : {};
        const options = q.options && typeof q.options === "object" ? Object.entries(q.options).slice(0, 8).map(([key, value]) => `   - ${text(key, 20)}. ${text(value, 500)}`).join("\n") : "";
        const answer = text(q.correct_answer ?? q.answer, 300);
        const explanation = text(q.explanation, 800);
        return `${index + 1}. ${text(q.question ?? q.stem, 1200)}${options ? `
${options}` : ""}${answer ? `
   - \u7B54\u6848\uFF1A${answer}` : ""}${explanation ? `
   - \u89E3\u6790\uFF1A${explanation}` : ""}`;
      });
      return { markdown: `### ${text(block.title || "\u968F\u5802\u5C0F\u6D4B", 160)}

${lines.join("\n\n")}`, fallback: false };
    }
    case "card": {
      const cards = Array.isArray(payload.cards) ? payload.cards.slice(0, 20) : [];
      return { markdown: `### ${text(block.title || "\u95EA\u5361", 160)}

${cards.map((raw, index) => {
        const card = raw && typeof raw === "object" ? raw : {};
        return `**${index + 1}. ${text(card.front, 500)}**

${text(card.back, 800)}${card.hint ? `

> \u63D0\u793A\uFF1A${text(card.hint, 300)}` : ""}`;
      }).join("\n\n---\n\n") || "> \u6682\u65E0\u95EA\u5361\u3002"}`, fallback: cards.length === 0 };
    }
    case "figure": {
      const code = payload.code && typeof payload.code === "object" ? payload.code : {};
      const language = text(code.language ?? payload.render_type ?? "text", 40).replace(/[^a-zA-Z0-9_-]/g, "");
      return { markdown: `${text(payload.description ?? block.title, 600)}${fence(code.content, language)}`, fallback: !text(code.content) };
    }
    case "concept_graph": {
      const code = payload.code && typeof payload.code === "object" ? payload.code : {};
      const graph = payload.graph && typeof payload.graph === "object" ? payload.graph : {};
      const nodes = Array.isArray(graph.nodes) ? graph.nodes.slice(0, 40) : [];
      const edges = Array.isArray(graph.edges) ? graph.edges.slice(0, 60) : [];
      const graphSummary = `${nodes.length} \u4E2A\u6982\u5FF5\uFF0C${edges.length} \u6761\u5173\u7CFB\u3002`;
      return { markdown: `### ${text(block.title || "\u6982\u5FF5\u56FE", 160)}

${graphSummary}${fence(code.content, "mermaid")}`, fallback: !nodes.length && !text(code.content) };
    }
    case "timeline": {
      const events = Array.isArray(payload.events) ? payload.events.slice(0, 20) : [];
      if (!events.length) return { markdown: `### ${safeText(block.title || "\u65F6\u95F4\u7EBF", 160)}

> \u6682\u65E0\u53EF\u7528\u65F6\u95F4\u7EBF\u4E8B\u4EF6\u3002`, fallback: true };
      const lines = events.map((raw, index) => {
        const event = raw && typeof raw === "object" ? raw : {};
        const date = safeText(event.date ?? event.year ?? "", 60);
        const title = safeText(event.title ?? event.name ?? `\u4E8B\u4EF6 ${index + 1}`, 180);
        const body = safeText(event.body ?? event.description ?? event.content ?? "", 500);
        return `- **${date ? `${date} \xB7 ` : ""}${title}**${body ? `\uFF1A${body}` : ""}`;
      });
      return { markdown: `### ${safeText(block.title || "\u65F6\u95F4\u7EBF", 160)}

${lines.join("\n")}`, fallback: false };
    }
    case "code": {
      const code = payload.code && typeof payload.code === "object" ? payload.code : payload;
      const language = text(code.language ?? payload.language ?? "text", 40).replace(/[^a-zA-Z0-9_+#.-]/g, "") || "text";
      const body = safeText(code.content ?? code.body ?? payload.content ?? "", 6e3);
      if (!body) return { markdown: `### ${safeText(block.title || "\u4EE3\u7801\u793A\u4F8B", 160)}

> \u6682\u65E0\u4EE3\u7801\u5185\u5BB9\u3002`, fallback: true };
      return { markdown: `### ${safeText(block.title || "\u4EE3\u7801\u793A\u4F8B", 160)}${fence(body, language)}

> \u4EE3\u7801\u4EC5\u4F9B\u9605\u8BFB\u548C\u6559\u5E08\u590D\u6838\uFF0C\u8BB2\u4E49\u6E32\u67D3\u5668\u4E0D\u4F1A\u6267\u884C\u3002`, fallback: false };
    }
    case "deep_explanation": {
      const sections = Array.isArray(payload.sections) ? payload.sections.slice(0, 8) : [];
      const claim = safeText(payload.claim ?? payload.summary ?? "", 900);
      const intro = claim ? `> **\u6838\u5FC3\u7ED3\u8BBA**\uFF1A${claim}` : "";
      if (!sections.length && !intro) return { markdown: `### ${safeText(block.title || "\u6DF1\u5165\u8BB2\u89E3", 160)}

> \u6682\u65E0\u53EF\u7528\u8BB2\u89E3\u5185\u5BB9\u3002`, fallback: true };
      const rendered = sections.map((raw, index) => {
        const section = raw && typeof raw === "object" ? raw : {};
        const heading = safeText(section.heading ?? section.title ?? `\u6B65\u9AA4 ${index + 1}`, 180);
        const body = safeText(section.body ?? section.explanation ?? section.content ?? "", 900);
        const evidence = safeText(section.evidence ?? section.check ?? "", 500);
        return `#### ${heading}

${body || "> \u5F85\u6559\u5E08\u8865\u5145\u3002"}${evidence ? `

> **\u6838\u9A8C**\uFF1A${evidence}` : ""}`;
      }).join("\n\n");
      return { markdown: `### ${safeText(block.title || "\u6DF1\u5165\u8BB2\u89E3", 160)}

${intro}${intro && rendered ? "\n\n" : ""}${rendered}`, fallback: false };
    }
    case "user_note": {
      const note = safeText(payload.body ?? payload.content ?? payload.note ?? "", 2e3);
      if (!note) return { markdown: `> **\u6559\u5E08\u7B14\u8BB0**\uFF1A\u6682\u65E0\u5185\u5BB9\u3002`, fallback: true };
      return { markdown: `> **\u6559\u5E08\u7B14\u8BB0**
> ${note.replace(/\n/g, "\n> ")}`, fallback: false };
    }
    case "interactive":
    case "animation":
      return { markdown: `
> **${safeText(block.title || (block.type === "interactive" ? "\u4EA4\u4E92\u6A21\u5757" : "\u52A8\u753B\u6A21\u5757"), 160)}**
> \u5F53\u524D\u5BFC\u51FA\u901A\u9053\u53EA\u4FDD\u7559\u5B89\u5168\u5360\u4F4D\u4FE1\u606F\uFF1BHTML\u3001JavaScript\u3001iframe\u3001SVG \u4E8B\u4EF6\u548C\u672C\u5730\u8DEF\u5F84\u4E0D\u4F1A\u6267\u884C\u3002\u8BF7\u5728\u53D7\u63A7\u67E5\u770B\u5668\u4E2D\u5B8C\u6210\u6559\u5E08\u590D\u6838\u3002
`, fallback: true };
    case "prompt":
      return { markdown: `> **\u53EF\u7EE7\u7EED\u8FFD\u95EE**
> ${text(payload.prompt ?? payload.body ?? payload.content ?? block.title, 1200)}`, fallback: false };
    default:
      return { markdown: `
> **\u672A\u652F\u6301\u7684\u5185\u5BB9\u5757\u7C7B\u578B\uFF1A${text(block.type, 80)}**
> \u5DF2\u4FDD\u7559\u6807\u9898\u548C\u6765\u6E90\u5F15\u7528\uFF0C\u7B49\u5F85\u517C\u5BB9 renderer\u3002
`, fallback: true };
  }
}
function renderTeachingBookMarkdown(detail) {
  const pagesByChapter = /* @__PURE__ */ new Map();
  for (const page of detail.pages) pagesByChapter.set(page.chapterId, [...pagesByChapter.get(page.chapterId) ?? [], page]);
  const blocksByPage = /* @__PURE__ */ new Map();
  for (const block of detail.blocks) blocksByPage.set(block.pageId, [...blocksByPage.get(block.pageId) ?? [], block]);
  let fallbackCount = 0;
  const sourceRefs = /* @__PURE__ */ new Set();
  const sections = [`# ${text(detail.book.title, 200)}`, detail.book.description ? text(detail.book.description, 1e3) : "", detail.health.status !== "healthy" ? `> \u26A0\uFE0F \u6765\u6E90\u5065\u5EB7\u72B6\u6001\uFF1A${detail.health.status}\u3002\u8BF7\u5728\u5BFC\u51FA\u6216\u53D1\u5E03\u524D\u590D\u6838\u6807\u8BB0\u7684\u6765\u6E90\u3002` : ""];
  for (const chapter of [...detail.chapters].sort((a, b) => a.order - b.order)) {
    sections.push(`
## ${text(chapter.title, 200)}`);
    if (chapter.learningObjectives.length) sections.push(`
**\u5B66\u4E60\u76EE\u6807**
${chapter.learningObjectives.slice(0, 8).map((item) => `- ${text(item, 240)}`).join("\n")}`);
    for (const page of (pagesByChapter.get(chapter.id) ?? []).sort((a, b) => a.order - b.order)) {
      sections.push(`
### ${text(page.title, 200)}`);
      const blocks = (blocksByPage.get(page.id) ?? []).sort((a, b) => a.order - b.order);
      for (const block of blocks) {
        const rendered = renderBlock(block);
        if (rendered.fallback) fallbackCount += 1;
        sections.push(rendered.markdown);
        for (const source of block.sourceAnchors.slice(0, 20)) if (source.ref) sourceRefs.add(source.ref);
      }
    }
  }
  const markdown = sections.filter(Boolean).join("\n\n").replace(/\n{4,}/g, "\n\n").slice(0, MAX_MARKDOWN);
  return { schemaVersion: TEACHING_BOOK_MARKDOWN_SCHEMA_VERSION, markdown, fallbackCount, blockCount: detail.blocks.length, sourceRefs: [...sourceRefs].slice(0, 100) };
}

// src/main/ai-harness/teaching-book-planner.ts
var TEACHING_BOOK_PLAN_SCHEMA_VERSION = "omni.teaching.book.plan.v1";
function clean4(value, max = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function buildTeachingBookPlan(detail, chunks, request = "") {
  const seedTitles = chunks.map((chunk) => clean4(chunk.knowledgePoint || chunk.heading || chunk.resourceTitle, 120)).filter(Boolean);
  const uniqueTitles = [...new Set(seedTitles)];
  const fallbackTitles = ["\u5B66\u4E60\u76EE\u6807\u4E0E\u8303\u56F4", "\u6838\u5FC3\u6982\u5FF5", "\u65B9\u6CD5\u4E0E\u4F8B\u9898", "\u5E38\u89C1\u9519\u8BEF\u4E0E\u8FA8\u6790", "\u7EC3\u4E60\u4E0E\u8FC1\u79FB", "\u603B\u7ED3\u4E0E\u68C0\u67E5"];
  const chapterTitles = (uniqueTitles.length ? uniqueTitles : fallbackTitles).slice(0, 8);
  const sourceRefs = chunks.slice(0, 12).map((chunk) => ({ kind: "knowledge_chunk", ref: chunk.id, title: clean4(chunk.resourceTitle, 180), snippet: clean4(chunk.heading || chunk.contentMd, 360), fingerprint: chunk.createdAt, status: "available" }));
  const chapters = chapterTitles.map((title, index) => ({
    id: `plan_chapter_${index + 1}`,
    title,
    order: index,
    rationale: index === 0 ? "\u5148\u9501\u5B9A\u5B66\u4E60\u76EE\u6807\u548C\u8303\u56F4\uFF0C\u907F\u514D\u7AE0\u8282\u5806\u780C\u3002" : index === chapterTitles.length - 1 ? "\u4EE5\u68C0\u67E5\u70B9\u548C\u8FC1\u79FB\u4EFB\u52A1\u6536\u675F\uFF0C\u4FBF\u4E8E\u6559\u5E08\u9A8C\u6536\u3002" : "\u7531\u6765\u6E90\u547D\u4E2D\u7684\u6982\u5FF5/\u4E3B\u9898\u751F\u6210\uFF0C\u9700\u6559\u5E08\u786E\u8BA4\u987A\u5E8F\u3002",
    pages: [
      { id: `plan_page_${index + 1}_1`, title: `${title}\uFF1A\u6838\u5FC3\u8BB2\u89E3`, blockTypes: ["text", "callout"] },
      { id: `plan_page_${index + 1}_2`, title: `${title}\uFF1A\u7EC3\u4E60\u4E0E\u68C0\u67E5`, blockTypes: ["quiz", "card"] }
    ],
    sourceRefs: sourceRefs.slice(index % Math.max(1, sourceRefs.length), index % Math.max(1, sourceRefs.length) + 3).map((source) => source.ref)
  }));
  return {
    schemaVersion: TEACHING_BOOK_PLAN_SCHEMA_VERSION,
    ok: true,
    bookId: detail.book.id,
    title: clean4(detail.book.title, 200),
    request: clean4(request, 240),
    queries: [clean4(detail.book.title, 160), clean4(detail.book.description, 180)].filter(Boolean),
    coverage: { sourceChunks: chunks.length, selectedSources: sourceRefs.length, proposedChapters: chapters.length },
    chapters,
    sources: sourceRefs,
    facts: [
      `\u5DF2\u7528 ${sourceRefs.length} \u6761\u672C\u5730\u77E5\u8BC6\u7247\u6BB5\u7684\u6807\u9898/\u4E3B\u9898\u751F\u6210 ${chapters.length} \u4E2A\u7AE0\u8282\u5019\u9009\u3002`,
      "\u7AE0\u8282\u987A\u5E8F\u3001\u9875\u6807\u9898\u548C block \u7C7B\u578B\u662F draft\uFF0C\u4E0D\u81EA\u52A8\u5199\u5165\u8BB2\u4E49\u6216\u66FF\u6362\u6559\u5E08\u5DF2\u6709\u7ED3\u6784\u3002",
      "\u6765\u6E90\u53EA\u4FDD\u5B58 chunk \u5F15\u7528\u548C bounded \u6458\u8981\uFF0C\u6B63\u6587\u4ECD\u7531\u73B0\u6709\u77E5\u8BC6\u5E93\u771F\u6E90\u63D0\u4F9B\u3002"
    ],
    unknowns: [
      sourceRefs.length ? "\u7AE0\u8282\u662F\u5426\u8986\u76D6\u5168\u90E8\u6559\u5B66\u76EE\u6807\u4ECD\u9700\u6559\u5E08\u786E\u8BA4\u3002" : "\u5F53\u524D\u6CA1\u6709\u77E5\u8BC6\u5E93\u547D\u4E2D\uFF0C\u7AE0\u8282\u5019\u9009\u53EA\u6765\u81EA\u5B89\u5168 fallback \u6A21\u677F\u3002",
      "\u6CA1\u6709\u6267\u884C LLM spine synthesis\uFF1B\u590D\u6742\u8DE8\u5B66\u79D1\u4F9D\u8D56\u9700\u8981\u540E\u7EED\u6559\u5E08\u8C03\u6574\u3002"
    ],
    nextActions: ["\u786E\u8BA4\u7AE0\u8282\u987A\u5E8F\u4E0E\u5B66\u4E60\u76EE\u6807\u540E\uFF0C\u518D\u521B\u5EFA\u771F\u5B9E chapter/page shells\u3002", "\u5BF9\u6765\u6E90\u53D1\u751F\u6F02\u79FB\u7684\u5185\u5BB9\u5757\u6309 page/block \u7C92\u5EA6\u91CD\u751F\u6210\u3002"]
  };
}

// src/main/ai-harness/research-outline.ts
function clean5(value, max) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function unique2(values) {
  return [...new Set(values.filter(Boolean))];
}
function buildResearchOutline(query, chunks, limit = 6) {
  const boundedQuery = clean5(query, 240) || "\u672A\u6307\u5B9A\u7814\u7A76\u4E3B\u9898";
  const bounded = chunks.filter((chunk) => !chunk.containsPersonalData).slice(0, Math.max(1, Math.min(8, Math.trunc(limit))));
  const sourceRefs = bounded.map((chunk) => ({
    id: chunk.id,
    title: clean5(chunk.resourceTitle, 120),
    heading: clean5(chunk.heading || chunk.knowledgePoint || "\u672A\u547D\u540D\u7247\u6BB5", 120),
    evidenceStrength: chunk.evidenceStrength,
    pageNumber: chunk.pageNumber
  }));
  const outline = bounded.slice(0, 6).map((chunk, index) => ({
    id: `section-${index + 1}`,
    heading: clean5(chunk.heading || chunk.knowledgePoint || `\u8BC1\u636E\u4E3B\u9898 ${index + 1}`, 100),
    focus: clean5(chunk.contentMd, 360) || "\u5F85\u6559\u5E08\u8865\u5145\u8BE5\u4E3B\u9898\u7684\u6838\u5FC3\u8BBA\u70B9\u4E0E\u8303\u56F4\u3002",
    sourceRefs: [chunk.id]
  }));
  const unknowns = unique2([
    ...bounded.length ? [] : ["\u672C\u5730\u6559\u5E08\u77E5\u8BC6\u5E93\u6CA1\u6709\u547D\u4E2D\u4E0E\u8BE5\u4E3B\u9898\u76F8\u5173\u7684\u5B89\u5168\u5207\u7247\u3002"],
    ...bounded.some((chunk) => chunk.evidenceStrength !== "direct") ? ["\u90E8\u5206\u6765\u6E90\u4E0D\u662F\u76F4\u63A5\u8BC1\u636E\uFF0C\u9700\u6559\u5E08\u6838\u5BF9\u539F\u6587\u4E0E\u9002\u7528\u8303\u56F4\u3002"] : [],
    "\u672A\u8054\u7F51\u68C0\u7D22\u5916\u90E8\u6587\u732E\uFF0C\u4F5C\u8005\u3001\u53D1\u8868\u65F6\u95F4\u3001\u65B9\u6CD5\u4E0E\u53CD\u4F8B\u5C1A\u672A\u6838\u9A8C\u3002"
  ]).slice(0, 4);
  return {
    schemaVersion: "omni.research.outline.v1",
    query: boundedQuery,
    title: `${boundedQuery}\uFF1A\u7814\u7A76\u63D0\u7EB2\uFF08\u672C\u5730\u8BC1\u636E\u8349\u6848\uFF09`,
    outline,
    sourceRefs,
    unknowns,
    evidenceBoundary: "local_teacher_knowledge_only",
    requiresTeacherReview: true,
    writesFile: false
  };
}

// src/main/ai-harness/visualization.ts
function label(value, max = 70) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/https?:\/\/|javascript:|data:/gi, "").replace(/[\[\]{}();`<>|#]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "\u672A\u547D\u540D";
}
function nodeId(index) {
  return `n${index + 1}`;
}
function buildMermaidVisualization(title, nodes, edges, limit = 12) {
  const boundedNodes = nodes.slice(0, Math.max(1, Math.min(20, Math.trunc(limit))));
  const nodeIds = new Set(boundedNodes.map((node) => node.id));
  const boundedEdges = edges.filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)).slice(0, Math.max(0, boundedNodes.length * 2));
  const indexById = new Map(boundedNodes.map((node, index) => [node.id, nodeId(index)]));
  const lines = ["graph TD"];
  boundedNodes.forEach((node, index) => {
    lines.push(`  ${nodeId(index)}["${label(node.name || node.summary)}"]`);
  });
  boundedEdges.forEach((edge) => {
    const source = indexById.get(edge.sourceNodeId);
    const target = indexById.get(edge.targetNodeId);
    if (source && target) lines.push(`  ${source} -->|${label(edge.relationType, 40)}| ${target}`);
  });
  const safeTitle = label(title, 120);
  return {
    schemaVersion: "omni.visualization.mermaid.v1",
    renderType: "mermaid",
    title: safeTitle,
    mermaid: lines.join("\n").slice(0, 4e3),
    nodeCount: boundedNodes.length,
    edgeCount: boundedEdges.length,
    safe: true,
    requiresTeacherReview: true,
    writesFile: false,
    evidenceBoundary: "local_knowledge_graph_summary"
  };
}

// src/main/ai-harness/tool-registry.ts
var DEFAULT_TOOL_OUTPUT_LIMIT = 4e3;
var ALL_AI_ROUTES = [
  "general_qa",
  "student_diagnosis",
  "error_analysis",
  "practice_design",
  "lesson_design",
  "report_draft",
  "knowledge_retrieval",
  "workspace_help"
];
var TOOL_GROUPS = {
  student: ["resolve_student_reference", "get_student_profile"],
  learning: ["search_learning_records", "mastery_status", "get_review_queue", "analyze_learning_progress", "classify_error_patterns", "mastery_quiz", "mastery_grade", "mastery_assess", "mastery_build"],
  knowledge: ["search_teacher_knowledge", "query_knowledge_graph", "generate_research_outline", "render_learning_mermaid"],
  practice: ["search_similar_questions", "search_question_notebook"],
  attachments: ["list_attachment_metadata", "explore_attached_sources", "analyze_geometry_figure"],
  notebook: ["analyze_notebook_context"],
  book: ["inspect_teaching_book", "refresh_teaching_book_health", "draft_teaching_book_patch", "draft_teaching_book_selection_patch", "draft_teaching_book_markdown", "plan_teaching_book"],
  memory: ["inspect_memory_trace", "inspect_memory_summary", "draft_memory_summary", "inspect_memory_synthesis", "draft_memory_synthesis", "inspect_memory_graph", "inspect_memory_governance"]
};
var AI_TOOL_REGISTRY = [
  {
    name: "ask_user",
    label: "\u8BE2\u95EE\u8001\u5E08",
    description: "\u5F53\u7F3A\u5C11\u4F1A\u6539\u53D8\u7B54\u6848\u7684\u5173\u952E\u4FE1\u606F\u65F6\uFF0C\u5411\u8001\u5E08\u63D0\u51FA\u4E00\u4E2A\u660E\u786E\u3001\u53EF\u56DE\u7B54\u7684\u95EE\u9898\uFF1B\u4E0D\u4F1A\u8BFB\u53D6\u6216\u5199\u5165\u5B66\u751F\u6570\u636E\u3002",
    contextKey: "user_input",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 2e3,
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "\u9700\u8981\u8001\u5E08\u56DE\u7B54\u7684\u5355\u4E2A\u95EE\u9898\u3002",
          maxLength: 2e3
        }
      },
      required: ["question"],
      additionalProperties: false
    }
  },
  {
    name: "load_tools",
    label: "\u6309\u9700\u52A0\u8F7D\u5DE5\u5177\u65CF",
    description: "\u6309\u5F53\u524D route \u7684\u6700\u5C0F\u9700\u8981\u52A0\u8F7D\u4E00\u7EC4\u5DE5\u5177 schema\uFF1B\u53EA\u8FD4\u56DE\u5BBF\u4E3B\u5DF2\u8BB8\u53EF\u7684\u5DE5\u5177\uFF0C\u4E0D\u8BFB\u53D6\u5B66\u751F\u6570\u636E\u3001\u4E0D\u6267\u884C\u5DE5\u5177\uFF0C\u4E5F\u4E0D\u6539\u53D8\u6743\u9650\u3002\u4F18\u5148\u8BF7\u6C42\u4E00\u4E2A\u6700\u5C0F\u5DE5\u5177\u65CF\u3002",
    contextKey: "user_input",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ALL_AI_ROUTES,
    maxOutputChars: 6e3,
    parameters: {
      type: "object",
      properties: {
        groups: {
          type: "array",
          description: "\u5DE5\u5177\u65CF\uFF1Astudent/learning/knowledge/practice/attachments/notebook/book/memory\u3002\u6700\u591A 4 \u7EC4\u3002",
          items: { type: "string" },
          maxItems: 4
        },
        tools: {
          type: "array",
          description: "\u53EF\u9009\u7684\u660E\u786E\u5DE5\u5177\u540D\uFF1B\u53EA\u4F1A\u8FD4\u56DE\u5F53\u524D route \u5DF2\u5141\u8BB8\u7684\u5DE5\u5177\u3002\u6700\u591A 12 \u4E2A\u3002",
          items: { type: "string" },
          maxItems: 12
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "inspect_memory_trace",
    label: "\u67E5\u770B\u5C0F\u667A L1 \u8FD0\u884C\u8F68\u8FF9",
    description: "\u8BFB\u53D6\u672C\u5730\u5DF2\u5B8C\u6210\u6216\u8FDB\u884C\u4E2D\u7684 Agent run/event \u6458\u8981\uFF0C\u590D\u7528 DeepTutor L1 trace \u8BED\u4E49\uFF1B\u53EA\u8FD4\u56DE\u9636\u6BB5\u3001\u72B6\u6001\u3001\u5DE5\u5177\u540D\u548C\u8BC1\u636E\u952E\uFF0C\u4E0D\u8FD4\u56DE prompt \u539F\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002",
    contextKey: "memory_trace",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        runId: { type: "string", description: "\u53EF\u9009 run ID\uFF1B\u4E3A\u7A7A\u65F6\u8BFB\u53D6\u6700\u8FD1\u4E00\u6B21\u672C\u5730 run\u3002", maxLength: 160 },
        limit: { type: "number", description: "\u6700\u591A\u8FD4\u56DE\u4E8B\u4EF6\u6570\uFF0C1-50\u3002", minimum: 1, maximum: 50 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "inspect_memory_summary",
    label: "\u67E5\u770B\u5C0F\u667A L2 \u8868\u9762\u6458\u8981",
    description: "\u53EA\u8BFB\u67E5\u770B\u6307\u5B9A surface \u7684\u6559\u5E08\u53EF\u89C1 L2 \u6458\u8981\u6761\u76EE\u3001\u8BC1\u636E\u5F15\u7528\u548C\u7248\u672C\u72B6\u6001\uFF1B\u4E0D\u8BFB\u53D6\u539F\u59CB prompt\u3001\u5B66\u751F\u6B63\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002",
    contextKey: "memory_summary",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        surface: { type: "string", description: "DeepTutor L2 surface\uFF1Achat/notebook/quiz/kb/book/partner/cowriter", enum: ["chat", "notebook", "quiz", "kb", "book", "partner", "cowriter"] },
        includeDeleted: { type: "boolean", description: "\u662F\u5426\u5305\u542B\u5DF2\u7981\u7528/\u5220\u9664\u6761\u76EE\uFF1B\u9ED8\u8BA4 false" }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "draft_memory_summary",
    label: "\u751F\u6210 L2 \u6458\u8981\u8349\u7A3F",
    description: "\u4ECE\u672C\u5730 L1 run/event \u8BC1\u636E\u751F\u6210 bounded L2 \u8868\u9762\u6458\u8981\u8349\u7A3F\uFF1B\u53EA\u8FD4\u56DE\u5019\u9009\u548C evidence refs\uFF0C\u4E0D\u5199\u5165\u6B63\u5F0F\u8BB0\u5FC6\uFF0C\u5FC5\u987B\u7531\u8001\u5E08\u7F16\u8F91\u6216\u786E\u8BA4\u540E\u4FDD\u5B58\u3002",
    contextKey: "memory_summary",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        surface: { type: "string", description: "L2 surface", enum: ["chat", "notebook", "quiz", "kb", "book", "partner", "cowriter"] },
        runId: { type: "string", description: "\u53EF\u9009\u7684\u672C\u5730 run ID\uFF1B\u4E0D\u586B\u5219\u4F7F\u7528\u6700\u8FD1\u4E00\u6B21 run", maxLength: 160 },
        limit: { type: "number", description: "\u6700\u591A\u751F\u6210 1-8 \u6761\u8349\u7A3F", minimum: 1, maximum: 8 }
      },
      required: ["surface"],
      additionalProperties: false
    }
  },
  {
    name: "inspect_memory_synthesis",
    label: "\u93CC\u30E7\u6E45 L3 \u7D9C\u5408\u8BB0\u5FC6",
    description: "\u53EA\u8BFB\u67E5\u770B\u6309 recent/profile/scope/preferences \u69FD\u4F4D\u7EC4\u7EC7\u7684\u8DE8 surface L3 \u7EFC\u5408\u8BB0\u5FC6\uFF1B\u4E0D\u8BFB\u53D6\u5B66\u751F\u6B63\u6587\uFF0C\u4E0D\u66B4\u9732\u9690\u85CF\u63A8\u7406\u3002",
    contextKey: "memory_synthesis",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: { slot: { type: "string", enum: ["recent", "profile", "scope", "preferences"] } },
      required: ["slot"],
      additionalProperties: false
    }
  },
  {
    name: "draft_memory_synthesis",
    label: "\u751F\u6210 L3 \u7EFC\u5408\u5019\u9009",
    description: "\u4ECE\u5DF2\u786E\u8BA4\u7684 L2 \u6761\u76EE\u751F\u6210 bounded L3 \u8DE8 surface \u5019\u9009\uFF1B\u53EA\u8BFB\u3001\u9700\u6559\u5E08\u5BA1\u6838\uFF0C\u4E0D\u76F4\u63A5\u5199\u5165\u6B63\u5F0F\u8BB0\u5FC6\u3002",
    contextKey: "memory_synthesis",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: { slot: { type: "string", enum: ["recent", "profile", "scope", "preferences"] }, limit: { type: "number", minimum: 1, maximum: 8 } },
      required: ["slot"],
      additionalProperties: false
    }
  },
  {
    name: "inspect_memory_graph",
    label: "\u93CC\u30E7\u6E45\u7481\u677F\u7E42\u7487\u4F79\u5D41\u9365\u6350\u6C28",
    description: "\u8BFB\u53D6 L2/L3 \u6761\u76EE\u5230 run/event evidence \u7684 bounded \u56FE\u6295\u5F71\uFF1B\u53EA\u8FD4\u56DE\u8282\u70B9\u6807\u7B7E\u3001\u8FB9\u7C7B\u578B\u548C\u72B6\u6001\uFF0C\u4E0D\u8FD4\u56DE\u6B63\u6587\u3001prompt \u6216\u9690\u85CF\u63A8\u7406\u3002",
    contextKey: "memory_synthesis",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 200 } }, required: [], additionalProperties: false }
  },
  {
    name: "inspect_memory_governance",
    label: "\u93CC\u30E7\u6E45\u7481\u677F\u7E42\u6CBB\u7406\u72B6\u6001",
    description: "\u8BFB\u53D6 L2/L3 \u8BB0\u5FC6\u6CBB\u7406\u8BA1\u6570\u3001\u60AC\u7A7A evidence refs\u3001\u5220\u9664/\u505C\u7528\u72B6\u6001\u548C\u56FE\u89C4\u6A21\uFF1B\u53EA\u8BFB\uFF0C\u4E0D\u5141\u8BB8 AI \u5199\u5165\u3002",
    contextKey: "memory_synthesis",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval", "workspace_help"],
    maxOutputChars: 4e3,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
  },
  {
    name: "resolve_student_reference",
    label: "\u89E3\u6790\u5B66\u751F\u5F15\u7528",
    description: "\u4ECE\u5F53\u524D\u4EFB\u52A1\u6587\u672C\u6216\u663E\u5F0F studentName \u4E2D\u89E3\u6790\u672C\u5730\u5B66\u751F\u663E\u793A\u540D\uFF0C\u53EA\u8FD4\u56DE\u6700\u5C0F\u7ED1\u5B9A\u4FE1\u606F\u3002",
    contextKey: "student_lookup",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "error_analysis", "practice_design", "report_draft"],
    maxOutputChars: 2e3,
    parameters: {
      type: "object",
      properties: {
        studentName: {
          type: "string",
          description: "\u8001\u5E08\u63D0\u5230\u7684\u5B66\u751F\u663E\u793A\u540D\uFF0C\u4F8B\u5982\u201C\u5C0FA\u201D\u3002\u4E3A\u7A7A\u65F6\u4ECE\u4EFB\u52A1\u6587\u672C\u4E2D\u89E3\u6790\u3002",
          maxLength: 40
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "get_student_profile",
    label: "\u8BFB\u53D6\u5B66\u751F\u6863\u6848",
    description: "\u8BFB\u53D6\u5DF2\u7ED1\u5B9A\u5B66\u751F\u7684\u8131\u654F\u6863\u6848\u6458\u8981\uFF0C\u7528\u4E8E\u5B66\u751F\u8BCA\u65AD\u3001\u9519\u56E0\u5206\u6790\u3001\u9898\u7EC4\u8BBE\u8BA1\u6216\u62A5\u544A\u8349\u7A3F\u3002",
    contextKey: "student_profile",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "error_analysis", "practice_design", "report_draft"],
    maxOutputChars: 3e3,
    parameters: {
      type: "object",
      properties: {
        studentId: {
          type: "string",
          description: "\u53EF\u9009\u5B66\u751F ID\u3002\u4E3A\u7A7A\u65F6\u4F7F\u7528\u672C\u8F6E\u5DF2\u89E3\u6790\u6216\u5F53\u524D\u9009\u4E2D\u7684\u5B66\u751F\u3002",
          maxLength: 120
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "search_learning_records",
    label: "\u68C0\u7D22\u5B66\u4E60\u8BB0\u5F55",
    description: "\u6309\u5DF2\u7ED1\u5B9A\u5B66\u751F\u8BFB\u53D6\u8FD1\u671F\u5B66\u4E60\u8BB0\u5F55\uFF0C\u53EF\u9009 keyword \u7F29\u5C0F\u8303\u56F4\uFF1B\u8FD4\u56DE bounded \u6458\u8981\u3002",
    contextKey: "learning_records",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "error_analysis", "practice_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: {
          type: "string",
          description: "\u53EF\u9009\u5B66\u751F ID\u3002\u4E3A\u7A7A\u65F6\u4F7F\u7528\u672C\u8F6E\u5DF2\u89E3\u6790\u6216\u5F53\u524D\u9009\u4E2D\u7684\u5B66\u751F\u3002",
          maxLength: 120
        },
        keyword: {
          type: "string",
          description: "\u53EF\u9009\u68C0\u7D22\u5173\u952E\u8BCD\uFF0C\u4F8B\u5982\u201C\u65B9\u7A0B\u201D\u201C\u8BA1\u7B97\u7C97\u5FC3\u201D\u3002",
          maxLength: 80
        },
        limit: {
          type: "number",
          description: "\u6700\u591A\u8BFB\u53D6\u8BB0\u5F55\u6570\uFF0C\u4E0D\u80FD\u8D85\u8FC7\u5F53\u524D route \u7684 recordLimit\u3002",
          minimum: 1,
          maximum: 20
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "analyze_learning_progress",
    label: "\u5206\u6790\u5B66\u60C5\u7EDF\u8BA1",
    description: "\u57FA\u4E8E\u5F53\u524D\u5DF2\u7ED1\u5B9A\u5B66\u751F\u7684\u672C\u5730\u5B66\u4E60\u8BB0\u5F55\uFF0C\u6309\u65F6\u95F4\u8303\u56F4\u548C\u5B66\u79D1\u8BA1\u7B97\u53EF\u91CD\u7B97\u7684\u5B66\u60C5\u7EDF\u8BA1\uFF1B\u53EA\u8FD4\u56DE\u6C47\u603B\u3001\u4E8B\u5B9E\u3001\u672A\u77E5\u9879\u548C\u6765\u6E90 ID\uFF0C\u4E0D\u5199\u5165\u5B66\u751F\u6863\u6848\u3002",
    contextKey: "learning_records",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u53EF\u9009\u5B66\u751F ID\uFF1B\u5FC5\u987B\u4E0E\u672C\u8F6E\u5DF2\u7ED1\u5B9A\u5B66\u751F\u4E00\u81F4\u3002", maxLength: 120 },
        startDate: { type: "string", description: "\u5305\u542B\u8D77\u59CB\u65E5\uFF0C\u683C\u5F0F YYYY-MM-DD\u3002", maxLength: 10 },
        endDate: { type: "string", description: "\u5305\u542B\u7ED3\u675F\u65E5\uFF0C\u683C\u5F0F YYYY-MM-DD\u3002", maxLength: 10 },
        subject: { type: "string", description: "\u53EF\u9009\u5B66\u79D1\uFF1B\u201C\u5168\u90E8\u201D\u8868\u793A\u4E0D\u7B5B\u9009\u3002", maxLength: 80 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "classify_error_patterns",
    label: "\u9352\u55D9\u88AB\u932F\u56E0\u6A21\u5F0F",
    description: "\u57FA\u4E8E\u5DF2\u7ED1\u5B9A\u5B66\u751F\u7684\u672C\u5730\u9519\u9898/\u8BA2\u6B63\u8BB0\u5F55\uFF0C\u6309 DeepTutor \u56DB\u7C7B taxonomy \u751F\u6210\u53EF\u91CD\u7B97\u7684\u9519\u56E0\u5206\u7C7B\uFF1B\u672A\u77E5\u6216\u4F4E\u7F6E\u4FE1\u7ED3\u679C\u5FC5\u987B\u4EA4\u7531\u8001\u5E08\u590D\u6838\uFF0C\u4E0D\u5199\u5165\u5B66\u751F\u6863\u6848\u3002",
    contextKey: "learning_records",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["error_analysis"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u53EF\u9009\u5B66\u751F ID\uFF1B\u5FC5\u987B\u4E0E\u672C\u8F6E\u7ED1\u5B9A\u5B66\u751F\u4E00\u81F4\u3002", maxLength: 120 },
        startDate: { type: "string", description: "\u5305\u542B\u8D77\u59CB\u65E5\u671F\uFF0C\u683C\u5F0F YYYY-MM-DD\u3002", maxLength: 10 },
        endDate: { type: "string", description: "\u5305\u542B\u7ED3\u675F\u65E5\u671F\uFF0C\u683C\u5F0F YYYY-MM-DD\u3002", maxLength: 10 },
        subject: { type: "string", description: "\u53EF\u9009\u5B66\u79D1\uFF1B\u201C\u5168\u90E8\u201D\u8868\u793A\u4E0D\u7B5B\u9009\u3002", maxLength: 80 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "mastery_status",
    label: "\u8BFB\u53D6\u638C\u63E1\u5EA6\u72B6\u6001",
    description: "\u8BFB\u53D6\u5F53\u524D\u5B66\u751F\u57FA\u4E8E\u663E\u5F0F\u5B66\u4E60\u8BB0\u5F55\u8BA1\u7B97\u51FA\u7684\u77E5\u8BC6\u70B9\u638C\u63E1\u5EA6\u6458\u8981\uFF1B\u4E0D\u4F1A\u4FEE\u6539\u5B66\u4E60\u6570\u636E\uFF0C\u4E5F\u4E0D\u4F1A\u66B4\u9732\u539F\u59CB\u8BB0\u5F55\u3002",
    contextKey: "learning_records",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: {
          type: "string",
          description: "\u53EF\u9009\u5B66\u751F ID\u3002\u4E3A\u7A7A\u65F6\u4F7F\u7528\u672C\u8F6E\u5DF2\u89E3\u6790\u6216\u5F53\u524D\u9009\u4E2D\u7684\u5B66\u751F\u3002",
          maxLength: 120
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "get_review_queue",
    label: "\u8BFB\u53D6\u95F4\u9694\u590D\u4E60\u961F\u5217",
    description: "\u6309 DeepTutor \u786E\u5B9A\u6027\u95F4\u9694\u590D\u4E60\u7B56\u7565\u8BFB\u53D6\u5F53\u524D\u5B66\u751F\u5230\u671F\u77E5\u8BC6\u70B9\uFF1B\u53EA\u8FD4\u56DE\u77E5\u8BC6\u70B9\u6458\u8981\u3001\u4F18\u5148\u7EA7\u548C due \u65F6\u95F4\uFF0C\u4E0D\u4FEE\u6539\u5B66\u4E60\u8BB0\u5F55\u3002",
    contextKey: "learning_records",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 3500,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u5B66\u751F ID\uFF1B\u4E3A\u7A7A\u65F6\u4F7F\u7528\u672C\u8F6E\u5DF2\u89E3\u6790\u6216\u5F53\u524D\u9009\u4E2D\u7684\u5B66\u751F\u3002", maxLength: 120 },
        limit: { type: "number", description: "\u6700\u591A\u8FD4\u56DE 1-20 \u4E2A\u590D\u4E60\u4EFB\u52A1\u3002", minimum: 1, maximum: 20 },
        timezone: { type: "string", description: "\u4EC5\u7528\u4E8E\u5C55\u793A\u5143\u6570\u636E\uFF0C\u4E0D\u6539\u53D8 epoch due \u5224\u65AD\u3002", maxLength: 80 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "mastery_quiz",
    label: "\u751F\u6210\u638C\u63E1\u5EA6\u5C0F\u6D4B",
    description: "\u4E3A\u5F53\u524D\u5B66\u751F\u7684\u8584\u5F31\u77E5\u8BC6\u70B9\u521B\u5EFA\u4E00\u9053\u672C\u5730\u53EF\u8BC4\u5206\u5C0F\u6D4B\uFF1B\u6B63\u786E\u7B54\u6848\u53EA\u4FDD\u5B58\u5728\u4E3B\u8FDB\u7A0B\uFF0C\u4E0D\u8FD4\u56DE\u7ED9\u6A21\u578B\u6216\u754C\u9762\u3002",
    contextKey: "learning_records",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 2500,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u5B66\u751F ID\u3002", maxLength: 120 },
        knowledgePointId: { type: "string", description: "\u53EF\u9009\u77E5\u8BC6\u70B9 ID\uFF1B\u4E3A\u7A7A\u65F6\u81EA\u52A8\u9009\u62E9\u6700\u9700\u8981\u7EC3\u4E60\u7684\u70B9\u3002", maxLength: 120 },
        questionCount: { type: "number", description: "\u53EF\u9009\u8FDE\u7EED\u9898\u6570\uFF0C1-5\uFF1B\u6BCF\u6B21\u53EA\u5C55\u793A\u5F53\u524D\u9898\uFF0C\u8BC4\u5206\u540E\u53EF\u7EE7\u7EED\u8BFB\u53D6\u4E0B\u4E00\u9898\u3002", minimum: 1, maximum: 5 }
      },
      required: ["studentId"],
      additionalProperties: false
    }
  },
  {
    name: "mastery_grade",
    label: "\u8BC4\u5206\u5E76\u5199\u56DE\u638C\u63E1\u5EA6",
    description: "\u4F7F\u7528\u4E3B\u8FDB\u7A0B\u4FDD\u5B58\u7684\u79C1\u6709\u7B54\u6848\u5BF9\u5C0F\u6D4B\u8BC4\u5206\uFF0C\u5E76\u5199\u5165\u4E00\u6761\u663E\u5F0F mastery_attempt \u5B66\u4E60\u8BB0\u5F55\u3002",
    contextKey: "learning_records",
    effect: "write",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 2e3,
    parameters: {
      type: "object",
      properties: {
        questionId: { type: "string", description: "\u53EF\u9009\u9898\u76EE ID\uFF1B\u7701\u7565\u65F6\u4F7F\u7528\u5F53\u524D\u7ED1\u5B9A\u5B66\u751F\u6700\u8FD1\u4E00\u6761\u5DF2\u56DE\u7B54\u9898\u76EE\u3002", maxLength: 160 },
        answer: { type: "string", description: "\u8001\u5E08\u6216\u5B66\u751F\u63D0\u4EA4\u7684\u9009\u9879\u7B54\u6848\u3002", maxLength: 2e3 }
      },
      required: ["answer"],
      additionalProperties: false
    }
  },
  {
    name: "mastery_assess",
    label: "\u8BB0\u5F55\u6982\u5FF5\u638C\u63E1\u5224\u65AD",
    description: "\u8BB0\u5F55\u6982\u5FF5\u6216\u8BBE\u8BA1\u7C7B\u77E5\u8BC6\u70B9\u7684\u6559\u5E08/\u5BFC\u5E08\u5224\u65AD\uFF1B\u53EA\u6709\u660E\u786E passed \u7ED3\u679C\u624D\u4F1A\u5199\u5165\u663E\u5F0F mastery_attempt\u3002",
    contextKey: "learning_records",
    effect: "write",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 2e3,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u5B66\u751F ID\u3002", maxLength: 120 },
        knowledgePointId: { type: "string", description: "\u77E5\u8BC6\u70B9 ID\u3002", maxLength: 120 },
        passed: { type: "boolean", description: "\u89E3\u91CA\u662F\u5426\u8DB3\u4EE5\u8BC1\u660E\u638C\u63E1\u3002" },
        feedback: { type: "string", description: "\u7B80\u77ED\u8BC1\u636E\u8BF4\u660E\u3002", maxLength: 600 }
      },
      required: ["studentId", "knowledgePointId", "passed"],
      additionalProperties: false
    }
  },
  {
    name: "mastery_build",
    label: "\u6784\u5EFA\u5B66\u4E60\u8DEF\u5F84",
    description: "\u6839\u636E\u6559\u5E08\u786E\u8BA4\u7684\u5B66\u4E60\u76EE\u6807\u521B\u5EFA\u6216\u8FFD\u52A0\u6709\u5E8F\u77E5\u8BC6\u70B9\u8DEF\u5F84\uFF1B\u5BBF\u4E3B\u4F1A\u751F\u6210\u7A33\u5B9A ID \u5E76\u9650\u5236\u6570\u91CF\u3001\u957F\u5EA6\u548C\u77E5\u8BC6\u70B9\u7C7B\u578B\u3002",
    contextKey: "learning_records",
    effect: "write",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "practice_design"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u5B66\u751F ID\u3002", maxLength: 120 },
        mode: { type: "string", description: "replace \u6216 append\u3002", enum: ["replace", "append"] },
        modules: {
          type: "array",
          description: "\u6A21\u5757\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u6A21\u5757\u5305\u542B name \u548C knowledgePoints\u3002",
          maxItems: 12,
          items: { type: "object" }
        }
      },
      required: ["studentId", "modules"],
      additionalProperties: false
    }
  },
  {
    name: "list_attachment_metadata",
    label: "\u8BFB\u53D6\u9644\u4EF6\u5143\u6570\u636E",
    description: "\u7EDF\u8BA1\u5DF2\u8BFB\u53D6\u5B66\u4E60\u8BB0\u5F55\u4E2D\u7684\u9644\u4EF6\u6570\u91CF\u548C\u7C7B\u578B\uFF1B\u4E0D\u8BFB\u53D6\u3001\u4E0D\u4E0A\u4F20\u539F\u59CB\u9644\u4EF6\u3002",
    contextKey: "attachment_metadata",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "error_analysis", "report_draft"],
    maxOutputChars: 1500,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "explore_attached_sources",
    label: "\u6309\u9700\u63A2\u7D22\u9644\u4EF6\u6765\u6E90",
    description: "\u590D\u7528 DeepTutor read_source/attached-source manifest \u7684\u6309\u9700\u63A2\u7D22\u539F\u5219\uFF1A\u53EA\u8BFB\u53D6\u5F53\u524D\u7ED1\u5B9A\u5B66\u751F\u5DF2\u6388\u6743\u9644\u4EF6\u5BF9\u5E94\u7684\u8131\u654F OCR \u7247\u6BB5\uFF0C\u6309\u67E5\u8BE2\u8BCD\u9009\u62E9\u5C11\u91CF\u6765\u6E90\uFF0C\u4E0D\u8BFB\u53D6\u539F\u59CB\u8DEF\u5F84\u6216\u5168\u90E8\u6587\u4EF6\u3002",
    contextKey: "attached_sources",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["student_diagnosis", "error_analysis", "report_draft", "knowledge_retrieval"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "\u53EF\u9009\u5B66\u751F ID\uFF1B\u5FC5\u987B\u4E0E\u5F53\u524D\u7ED1\u5B9A\u5B66\u751F\u4E00\u81F4\u3002", maxLength: 120 },
        query: { type: "string", description: "\u8981\u5728\u8131\u654F\u9644\u4EF6\u7247\u6BB5\u4E2D\u63A2\u7D22\u7684\u5173\u952E\u8BCD\u6216\u95EE\u9898\uFF1B\u4E3A\u7A7A\u65F6\u53EA\u8FD4\u56DE\u6709\u9650\u6765\u6E90\u9884\u89C8\u3002", maxLength: 800 },
        attachmentIds: { type: "array", description: "\u53EF\u9009\u9644\u4EF6 ID \u767D\u540D\u5355\uFF1B\u53EA\u5141\u8BB8\u5F53\u524D\u8BB0\u5F55\u5DF2\u7ECF\u6302\u8F7D\u7684\u9644\u4EF6\u3002", maxItems: 8, items: { type: "string" } },
        limit: { type: "number", description: "\u6700\u591A\u8FD4\u56DE 1-5 \u4E2A\u6765\u6E90\u7247\u6BB5\u3002", minimum: 1, maximum: 5 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "analyze_geometry_figure",
    label: "\u751F\u6210\u51E0\u4F55\u56FE\u5F62\u8349\u7A3F",
    description: "\u590D\u7528 DeepTutor Vision Solver \u7684\u5355\u6B21\u5206\u6790/\u4E00\u6B21\u4FEE\u590D\u8FB9\u754C\uFF0C\u4E3A\u672C\u5730\u9519\u9898\u56FE\u7247\u751F\u6210\u7ECF\u767D\u540D\u5355\u6821\u9A8C\u7684 GeoGebra \u8349\u7A3F\uFF1B\u9ED8\u8BA4\u4E0D\u4E0A\u4F20\u539F\u56FE\u3001\u4E0D\u5199\u56DE\u6570\u636E\uFF0C\u5FC5\u987B\u7531\u8001\u5E08\u9884\u89C8\u786E\u8BA4\u3002",
    contextKey: "attachment_metadata",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["error_analysis"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        analysisId: { type: "string", description: "\u53EF\u9009\u672C\u5730\u9519\u9898\u56FE\u7247\u5206\u6790 ID\uFF1B\u4E3A\u7A7A\u65F6\u4F7F\u7528\u5F53\u524D\u5B66\u751F\u6700\u8FD1\u4E00\u6761\u56FE\u7247\u5206\u6790\u3002", maxLength: 160 },
        questionText: { type: "string", description: "\u8131\u654F\u9898\u5E72\u6216\u9898\u5E72\u6458\u8981\uFF1B\u4E0D\u8981\u4F20\u5165\u539F\u56FE\u8DEF\u5F84\u6216\u5B66\u751F\u9690\u79C1\u3002", maxLength: 1200 },
        commands: { type: "array", description: "\u89C6\u89C9\u6A21\u578B\u8349\u62DF\u7684 GeoGebra \u547D\u4EE4\u6570\u7EC4\uFF1B\u5BBF\u4E3B\u53EA\u4FDD\u7559\u767D\u540D\u5355\u547D\u4EE4\u3002", maxItems: 24, items: { type: "object" } },
        constraints: { type: "array", description: "\u53EF\u9009\u51E0\u4F55\u7EA6\u675F\u6458\u8981\u3002", maxItems: 12, items: { type: "string" } },
        geometricRelations: { type: "array", description: "\u53EF\u9009\u51E0\u4F55\u5173\u7CFB\u6458\u8981\u3002", maxItems: 12, items: { type: "string" } }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "analyze_notebook_context",
    label: "\u6309\u9700\u5206\u6790\u6559\u5E08\u5907\u8BFE\u672C",
    description: "\u590D\u7528 DeepTutor Notebook Analysis/Summarize \u7684\u76EE\u5F55\u9009\u62E9\u3001\u6709\u9650\u7EC6\u8282\u8BFB\u53D6\u548C\u6458\u8981\u8349\u7A3F\u8FB9\u754C\uFF1B\u4EC5\u5728\u660E\u786E\u8BF7\u6C42\u7B14\u8BB0\u6216\u5907\u8BFE\u672C\u65F6\u8BFB\u53D6\uFF0C\u4E0D\u5E38\u9A7B\u6CE8\u5165\u666E\u901A\u95EE\u7B54\u3002",
    contextKey: "teacher_notebook",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["general_qa", "knowledge_retrieval", "lesson_design", "report_draft", "student_diagnosis"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "\u7B14\u8BB0\u76EE\u5F55\u6216\u5185\u5BB9\u67E5\u8BE2\uFF1B\u4E0D\u4F1A\u4F5C\u4E3A\u5B66\u751F\u67E5\u8BE2\u3002", maxLength: 1e3 },
        notebookId: { type: "string", description: "\u53EF\u9009\u5907\u8BFE\u672C ID\uFF1B\u6307\u5B9A\u540E\u53EA\u5141\u8BB8\u8BFB\u53D6\u8BE5\u5907\u8BFE\u672C\u3002", maxLength: 160 },
        mode: { type: "string", description: "context \u8FD4\u56DE\u76EE\u5F55\u4E0E\u6709\u9650\u7EC6\u8282\uFF1Brecord_summary \u8FD4\u56DE\u5355\u6761\u6458\u8981\u8349\u7A3F\u3002", enum: ["context", "record_summary"] },
        recordId: { type: "string", description: "record_summary \u6A21\u5F0F\u4E0B\u7684\u672C\u5730\u8BB0\u5F55 ID\u3002", maxLength: 160 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "search_question_notebook",
    label: "\u68C0\u7D22\u9898\u76EE\u6536\u85CF\u4E0E\u5206\u7C7B",
    description: "\u590D\u7528 DeepTutor Question Notebook \u7684\u4E66\u7B7E\u3001\u5206\u7C7B\u548C\u5386\u53F2\u5F15\u7528\u8BED\u4E49\uFF0C\u4F46\u53EA\u8BFB\u53D6 Omni-Edu \u73B0\u6709\u9898\u5E93\u4E0A\u7684\u8F7B\u91CF\u7D22\u5F15\uFF0C\u4E0D\u590D\u5236\u9898\u76EE\u6B63\u6587\u3002",
    contextKey: "question_notebook",
    effect: "read",
    privacy: "sanitized_cloud",
    allowedRoutes: ["practice_design", "knowledge_retrieval", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "\u9898\u76EE\u6536\u85CF/\u5206\u7C7B\u68C0\u7D22\u5173\u952E\u8BCD\u3002", maxLength: 240 },
        categoryId: { type: "string", description: "\u53EF\u9009\u9898\u76EE\u5206\u7C7B ID\u3002", maxLength: 160 },
        bookmarked: { type: "boolean", description: "\u662F\u5426\u53EA\u8FD4\u56DE\u5DF2\u6536\u85CF\u9898\u76EE\u3002" },
        sourceKind: { type: "string", description: "\u9898\u76EE\u6765\u6E90\u7C7B\u578B\u3002", enum: ["local_bank", "teacher_resource", "generated"] },
        limit: { type: "number", description: "\u6700\u591A\u8FD4\u56DE\u9898\u76EE\u6570\uFF0C1-20\u3002", minimum: 1, maximum: 20 },
        offset: { type: "number", description: "\u5206\u9875\u504F\u79FB\u91CF\u3002", minimum: 0, maximum: 1e4 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "inspect_teaching_book",
    label: "\u68C0\u67E5\u4E13\u9898\u8BB2\u4E49\u5DE5\u4F5C\u533A",
    description: "\u8BFB\u53D6 DeepTutor Book Workspace \u9002\u914D\u540E\u7684\u4E13\u9898\u8BB2\u4E49/\u5355\u5143\u5907\u8BFE\u5305\u76EE\u5F55\u3001\u9875\u9762\u3001\u5185\u5BB9\u5757\u548C\u6765\u6E90\u5065\u5EB7\uFF1B\u4EC5\u8FD4\u56DE bounded \u5143\u6570\u636E\u4E0E\u5F15\u7528\uFF0C\u4E0D\u76F4\u63A5\u5199\u5165\u6216\u76F2\u76EE\u91CD\u751F\u6210\u3002",
    contextKey: "teaching_book",
    effect: "read",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "knowledge_retrieval", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u53EF\u9009\u8BB2\u4E49 ID\uFF1B\u672A\u6307\u5B9A\u65F6\u6309\u67E5\u8BE2\u5339\u914D\u6700\u8FD1\u8BB2\u4E49\u3002", maxLength: 160 },
        query: { type: "string", description: "\u53EF\u9009\u9875\u9762/\u8BB2\u4E49\u67E5\u8BE2\u5173\u952E\u8BCD\u3002", maxLength: 240 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "draft_teaching_book_markdown",
    label: "\u751F\u6210\u8BB2\u4E49 Markdown \u9884\u89C8",
    description: "\u5C06\u5DF2\u5B58\u5728\u7684\u4E13\u9898\u8BB2\u4E49 block \u7F16\u6392\u7F16\u8BD1\u4E3A bounded Markdown \u8349\u7A3F\uFF1B\u652F\u6301 text/chapter/quiz/card/figure/concept graph/prompt\uFF0C\u672A\u77E5\u7C7B\u578B\u5B89\u5168\u964D\u7EA7\uFF0C\u4E0D\u5199\u5165\u6587\u4EF6\u3002",
    contextKey: "teaching_book",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u8BB2\u4E49 ID\uFF1B\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\uFF0C\u907F\u514D\u8DE8\u8BB2\u4E49\u8BFB\u53D6\u3002", maxLength: 160 }
      },
      required: ["bookId"],
      additionalProperties: false
    }
  },
  {
    name: "refresh_teaching_book_health",
    label: "\u5237\u65B0\u8BB2\u4E49\u6765\u6E90\u5065\u5EB7",
    description: "\u91CD\u65B0\u8BA1\u7B97\u6258\u7BA1\u77E5\u8BC6\u8D44\u6E90\u3001\u5907\u8BFE\u672C\u548C\u9898\u5E93\u6765\u6E90\u7684 fingerprint \u5065\u5EB7\u72B6\u6001\uFF0C\u5E76\u628A\u6F02\u79FB\u7CBE\u786E\u5199\u5165\u672C\u5730\u5931\u6548\u961F\u5217\uFF1B\u4E0D\u4FEE\u6539\u8BB2\u4E49\u6B63\u6587\u3001\u4E0D\u81EA\u52A8\u91CD\u751F\u6210\u3002",
    contextKey: "teaching_book",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "knowledge_retrieval", "report_draft"],
    maxOutputChars: 3e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u8BB2\u4E49 ID\uFF1B\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u3002", maxLength: 160 }
      },
      required: ["bookId"],
      additionalProperties: false
    }
  },
  {
    name: "draft_teaching_book_patch",
    label: "\u751F\u6210\u8BB2\u4E49\u5185\u5BB9\u5757 patch",
    description: "\u4E3A\u6307\u5B9A\u8BB2\u4E49\u5185\u5BB9\u5757\u751F\u6210\u53EF\u5BA1\u9605\u7684\u66FF\u6362 patch\uFF1B\u4FDD\u7559 before/after\u3001\u57FA\u7840\u7248\u672C\u548C\u7406\u7531\uFF0C\u4E0D\u76F4\u63A5\u8986\u76D6\u8001\u5E08\u6B63\u6587\uFF0C\u5E94\u7528\u4E0E\u64A4\u9500\u5FC5\u987B\u8D70\u663E\u5F0F\u786E\u8BA4\u548C\u7248\u672C\u6821\u9A8C\u3002",
    contextKey: "teaching_book",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u8BB2\u4E49 ID\uFF1B\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u3002", maxLength: 160 },
        blockId: { type: "string", description: "\u5185\u5BB9\u5757 ID\uFF1B\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u3002", maxLength: 160 },
        baseVersion: { type: "number", description: "\u5185\u5BB9\u5757\u5F53\u524D\u7248\u672C\u3002", minimum: 1, maximum: 1e5 },
        title: { type: "string", description: "\u53EF\u9009\u65B0\u6807\u9898\u3002", maxLength: 200 },
        payload: { type: "object", description: "\u53EF\u9009\u7684\u65B0 payload\uFF0C\u6700\u5927 12000 \u5B57\u7B26\u3002" },
        reason: { type: "string", description: "\u6539\u5199\u7406\u7531\u3002", maxLength: 600 }
      },
      required: ["bookId", "blockId", "baseVersion"],
      additionalProperties: false
    }
  },
  {
    name: "draft_teaching_book_selection_patch",
    label: "\u751F\u6210\u8BB2\u4E49\u9009\u533A\u7F16\u8F91 patch",
    description: "\u590D\u7528 DeepTutor CoWriter \u7684 react-edit/automark \u8BED\u4E49\uFF0C\u5BF9\u6307\u5B9A\u5185\u5BB9\u5757\u7684\u660E\u786E\u9009\u533A\u751F\u6210 bounded before/after patch \u548C\u6D41\u5F0F\u8349\u7A3F\u4E8B\u4EF6\uFF1B\u4E0D\u81EA\u52A8\u8986\u76D6\u6B63\u6587\uFF0C\u5E94\u7528\u524D\u5FC5\u987B\u786E\u8BA4\u4E14\u6821\u9A8C\u7248\u672C\u4E0E\u9009\u533A\u6307\u7EB9\u3002",
    contextKey: "teaching_book",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u8BB2\u4E49 ID\u3002", maxLength: 160 },
        blockId: { type: "string", description: "\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u5185\u5BB9\u5757 ID\u3002", maxLength: 160 },
        baseVersion: { type: "number", description: "\u5185\u5BB9\u5757\u5F53\u524D\u7248\u672C\u3002", minimum: 1, maximum: 1e5 },
        selectionStart: { type: "number", description: "\u9009\u533A\u8D77\u59CB\u5B57\u7B26\u4F4D\u7F6E\u3002", minimum: 0, maximum: 2e4 },
        selectionEnd: { type: "number", description: "\u9009\u533A\u7ED3\u675F\u5B57\u7B26\u4F4D\u7F6E\uFF08\u4E0D\u542B\uFF09\u3002", minimum: 1, maximum: 2e4 },
        selectedText: { type: "string", description: "\u5BA2\u6237\u7AEF\u9009\u4E2D\u7684\u539F\u6587\uFF0C\u7528\u4E8E\u9009\u533A\u6F02\u79FB\u6821\u9A8C\u3002", maxLength: 2e4 },
        replacementText: { type: "string", description: "\u6A21\u578B\u751F\u6210\u7684\u5019\u9009\u66FF\u6362\u6587\u672C\uFF1B\u5FC5\u987B\u5148\u4F5C\u4E3A\u8349\u7A3F\u5BA1\u9605\u3002", maxLength: 2e4 },
        mode: { type: "string", enum: ["react_edit", "automark"], description: "\u5C40\u90E8\u6539\u5199\u6216\u6279\u6CE8\u6807\u8BB0\u6A21\u5F0F\u3002" },
        reason: { type: "string", description: "\u6539\u5199\u7406\u7531\u3002", maxLength: 600 }
      },
      required: ["bookId", "blockId", "baseVersion", "selectionStart", "selectionEnd", "selectedText", "replacementText"],
      additionalProperties: false
    }
  },
  {
    name: "plan_teaching_book",
    label: "\u89C4\u5212\u8BB2\u4E49\u7AE0\u8282\u9AA8\u67B6",
    description: "\u590D\u7528 DeepTutor SourceExplorer/Spine/PagePlanner \u7684\u6765\u6E90\u63A2\u7D22\u4E0E\u7AE0\u8282\u89C4\u5212\u8BED\u4E49\uFF0C\u57FA\u4E8E\u672C\u5730\u77E5\u8BC6\u7247\u6BB5\u7684 bounded \u4E3B\u9898\u751F\u6210\u53EF\u5BA1\u9605\u7684\u7AE0\u8282/page/block \u5019\u9009\uFF1B\u4E0D\u5199\u5165\u8BB2\u4E49\u3002",
    contextKey: "teaching_book",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["lesson_design", "knowledge_retrieval"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u8BB2\u4E49 ID\u3002", maxLength: 160 },
        query: { type: "string", description: "\u53EF\u9009\u7AE0\u8282\u89C4\u5212/\u6765\u6E90\u63A2\u7D22\u4E3B\u9898\u3002", maxLength: 240 },
        limit: { type: "number", description: "\u77E5\u8BC6\u7247\u6BB5\u4E0A\u9650\uFF0C1-8\u3002", minimum: 1, maximum: 8 }
      },
      required: ["bookId"],
      additionalProperties: false
    }
  },
  {
    name: "generate_research_outline",
    label: "\u751F\u6210\u7814\u7A76\u63D0\u7EB2",
    description: "\u57FA\u4E8E\u672C\u5730\u6559\u5E08\u77E5\u8BC6\u5207\u7247\u751F\u6210\u5E26\u6765\u6E90\u3001\u8BC1\u636E\u5F3A\u5EA6\u548C\u672A\u77E5\u9879\u7684\u7814\u7A76\u63D0\u7EB2\u8349\u6848\uFF1B\u4E0D\u8054\u7F51\u3001\u4E0D\u8BFB\u53D6\u5B66\u751F\u6570\u636E\u3001\u4E0D\u5199\u6587\u4EF6\u3002",
    contextKey: "teacher_knowledge",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["knowledge_retrieval", "lesson_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "\u7814\u7A76\u4E3B\u9898\u6216\u6559\u7814\u95EE\u9898", maxLength: 240 },
        limit: { type: "number", description: "\u6700\u591A\u4F7F\u7528\u7684\u672C\u5730\u77E5\u8BC6\u5207\u7247\u6570", minimum: 1, maximum: 8 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "render_learning_mermaid",
    label: "\u751F\u6210\u5B66\u4E60\u5173\u7CFB\u56FE",
    description: "\u57FA\u4E8E\u672C\u5730\u77E5\u8BC6\u56FE\u8C31\u6458\u8981\u751F\u6210\u53D7\u9650 Mermaid \u5173\u7CFB\u56FE\uFF1B\u6E05\u7406\u811A\u672C\u3001\u5916\u94FE\u548C\u5371\u9669\u5B57\u7B26\uFF0C\u4E0D\u5199\u6587\u4EF6\u3002",
    contextKey: "knowledge_graph",
    effect: "draft",
    privacy: "local_only",
    allowedRoutes: ["knowledge_retrieval", "lesson_design", "report_draft"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "\u56FE\u6807\u9898", maxLength: 120 },
        limit: { type: "number", description: "\u6700\u591A\u5C55\u793A\u7684\u8282\u70B9\u6570", minimum: 1, maximum: 20 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "search_teacher_knowledge",
    label: "\u68C0\u7D22\u8001\u5E08\u77E5\u8BC6\u5E93",
    description: "\u68C0\u7D22\u8001\u5E08\u672C\u5730\u77E5\u8BC6\u5E93\u5207\u7247\uFF0C\u8FD4\u56DE\u53EF\u53D1\u9001\u7ED9\u6A21\u578B\u7684 bounded \u6559\u5B66\u8D44\u6599\u7247\u6BB5\u3002",
    contextKey: "teacher_knowledge",
    effect: "read",
    privacy: "sanitized_cloud",
    allowedRoutes: ["student_diagnosis", "error_analysis", "practice_design", "lesson_design", "report_draft", "knowledge_retrieval"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "\u77E5\u8BC6\u5E93\u68C0\u7D22\u67E5\u8BE2\u3002\u4E3A\u7A7A\u65F6\u4F7F\u7528\u8001\u5E08\u539F\u59CB\u4EFB\u52A1\u3002",
          maxLength: 160
        },
        limit: {
          type: "number",
          description: "\u6700\u591A\u8FD4\u56DE\u77E5\u8BC6\u7247\u6BB5\u6570\uFF0C\u4E0D\u80FD\u8D85\u8FC7\u5F53\u524D route \u7684 knowledgeLimit\u3002",
          minimum: 1,
          maximum: 12
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "query_knowledge_graph",
    label: "\u67E5\u8BE2\u77E5\u8BC6\u56FE\u8C31",
    description: "\u8BFB\u53D6\u77E5\u8BC6\u56FE\u8C31\u8282\u70B9\u6458\u8981\uFF0C\u4E0D\u6267\u884C Graph RAG\uFF0C\u53EA\u8FD4\u56DE bounded \u8282\u70B9\u5217\u8868\u3002",
    contextKey: "knowledge_graph",
    effect: "read",
    privacy: "sanitized_cloud",
    allowedRoutes: ["practice_design", "lesson_design", "knowledge_retrieval"],
    maxOutputChars: 3e3,
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "\u6700\u591A\u8FD4\u56DE\u8282\u70B9\u6570\uFF0C\u4E0D\u80FD\u8D85\u8FC7\u5F53\u524D route \u7684 graphNodeLimit\u3002",
          minimum: 1,
          maximum: 20
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "search_similar_questions",
    label: "\u68C0\u7D22\u672C\u5730\u76F8\u4F3C\u9898",
    description: "\u6309\u5B66\u79D1\u3001\u77E5\u8BC6\u70B9\u548C\u67E5\u8BE2\u6587\u672C\u4ECE\u672C\u5730\u9898\u5E93\u53EC\u56DE\u76F8\u4F3C\u9898\uFF1B\u8FD4\u56DE\u9898\u5E93\u9898\u548C\u751F\u6210\u9898\u6765\u6E90\u8FB9\u754C\u3002",
    contextKey: "question_bank",
    effect: "read",
    privacy: "sanitized_cloud",
    allowedRoutes: ["practice_design"],
    maxOutputChars: 4e3,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "\u68C0\u7D22\u67E5\u8BE2\uFF0C\u4F8B\u5982\u201C\u4E00\u6B21\u51FD\u6570 k \u503C \u56FE\u50CF\u201D\u3002\u4E3A\u7A7A\u65F6\u4F7F\u7528\u8001\u5E08\u539F\u59CB\u4EFB\u52A1\u3002",
          maxLength: 160
        },
        subject: {
          type: "string",
          description: "\u5B66\u79D1\uFF0C\u4F8B\u5982\u201C\u6570\u5B66\u201D\u3002",
          maxLength: 40
        },
        knowledgePoint: {
          type: "string",
          description: "\u77E5\u8BC6\u70B9\uFF0C\u4F8B\u5982\u201C\u4E00\u6B21\u51FD\u6570\u201D\u3002",
          maxLength: 80
        },
        limit: {
          type: "number",
          description: "\u6700\u591A\u8FD4\u56DE\u9898\u76EE\u6570\uFF0C1-12\u3002",
          minimum: 1,
          maximum: 12
        }
      },
      required: [],
      additionalProperties: false
    }
  }
];
function descriptorByName(name) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}
function createToolRun(tool, status, detail, inputSummary, outputSummary) {
  return {
    name: tool.name,
    label: tool.label,
    status,
    detail,
    effect: tool.effect,
    privacy: tool.privacy,
    inputSummary,
    outputSummary
  };
}
function addSource(sources, source) {
  sources.push(source);
}
function extractNamedStudentHints(prompt) {
  const hints = /* @__PURE__ */ new Set();
  for (const match of prompt.matchAll(/小[\p{L}\p{N}_-]{1,12}/gu)) {
    hints.add(match[0]);
  }
  return [...hints];
}
function findStudentByPrompt(prompt, students, explicitName) {
  const hints = new Set(extractNamedStudentHints(prompt));
  if (explicitName?.trim()) hints.add(explicitName.trim());
  const hintList = [...hints];
  const exact = students.find(
    (student) => [student.displayName, student.realName].some((name) => name && hintList.includes(name))
  );
  if (exact) return { student: exact, matchType: "exact_hint", hints: hintList };
  const embedded = students.find(
    (student) => [student.displayName, student.realName].some((name) => name && `${prompt} ${explicitName ?? ""}`.includes(name))
  );
  if (embedded) return { student: embedded, matchType: "embedded_name", hints: hintList };
  return { student: void 0, matchType: "none", hints: hintList };
}
function parseToolArguments(value) {
  if (!value) return {};
  if (typeof value === "string") {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("\u5DE5\u5177\u53C2\u6570\u5FC5\u987B\u662F JSON object\u3002");
    }
    return parsed;
  }
  if (typeof value === "object" && !Array.isArray(value)) return value;
  throw new Error("\u5DE5\u5177\u53C2\u6570\u5FC5\u987B\u662F object\u3002");
}
function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return void 0;
}
function validateArguments(tool, rawArgs) {
  const schema = tool.parameters;
  const errors = [];
  const normalized2 = {};
  const allowedKeys = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(rawArgs)) {
    if (!allowedKeys.has(key)) errors.push(`\u4E0D\u5141\u8BB8\u7684\u53C2\u6570\uFF1A${key}`);
  }
  for (const requiredKey of schema.required ?? []) {
    if (rawArgs[requiredKey] == null || rawArgs[requiredKey] === "") errors.push(`\u7F3A\u5C11\u5FC5\u586B\u53C2\u6570\uFF1A${requiredKey}`);
  }
  for (const [key, rule] of Object.entries(schema.properties)) {
    const raw = rawArgs[key];
    if (raw == null || raw === "") continue;
    if (rule.type === "string") {
      if (typeof raw !== "string") {
        errors.push(`${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u3002`);
        continue;
      }
      const value = raw.trim();
      if (rule.maxLength && value.length > rule.maxLength) errors.push(`${key} \u8D85\u8FC7\u6700\u5927\u957F\u5EA6 ${rule.maxLength}\u3002`);
      if (rule.enum && !rule.enum.includes(value)) errors.push(`${key} \u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185\u3002`);
      normalized2[key] = value;
    } else if (rule.type === "number") {
      const value = normalizeNumber(raw);
      if (value == null) {
        errors.push(`${key} \u5FC5\u987B\u662F\u6570\u5B57\u3002`);
        continue;
      }
      if (rule.minimum != null && value < rule.minimum) errors.push(`${key} \u5C0F\u4E8E\u6700\u5C0F\u503C ${rule.minimum}\u3002`);
      if (rule.maximum != null && value > rule.maximum) errors.push(`${key} \u8D85\u8FC7\u6700\u5927\u503C ${rule.maximum}\u3002`);
      normalized2[key] = Math.trunc(value);
    } else if (rule.type === "boolean") {
      if (typeof raw !== "boolean") {
        errors.push(`${key} \u5FC5\u987B\u662F\u5E03\u5C14\u503C\u3002`);
        continue;
      }
      normalized2[key] = raw;
    } else if (rule.type === "array") {
      if (!Array.isArray(raw)) {
        errors.push(`${key} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
        continue;
      }
      if (rule.maxItems && raw.length > rule.maxItems) errors.push(`${key} \u8D85\u8FC7\u6700\u5927\u6570\u91CF ${rule.maxItems}\u3002`);
      normalized2[key] = raw.slice(0, rule.maxItems ?? 32);
    } else if (rule.type === "object") {
      if (typeof raw !== "object" || raw == null || Array.isArray(raw)) {
        errors.push(key + " \u5FC5\u987B\u662F object\u3002");
        continue;
      }
      normalized2[key] = raw;
    }
  }
  return { errors, normalized: normalized2 };
}
function capLimit(requested, routeLimit, fallback) {
  const numeric = normalizeNumber(requested);
  const max = Math.max(0, routeLimit);
  const base = numeric == null ? fallback : Math.trunc(numeric);
  if (max <= 0) return 0;
  return Math.max(1, Math.min(base, max));
}
function boundedPayload(payload, maxChars = DEFAULT_TOOL_OUTPUT_LIMIT) {
  const text2 = JSON.stringify(payload);
  if (text2.length <= maxChars) return { payload, truncated: false };
  const compact = {
    truncated: true,
    truncatedReason: `tool output exceeded ${maxChars} chars`,
    preview: text2.slice(0, maxChars)
  };
  for (const key of ["ok", "count", "studentId", "toolName", "reason", "rawRecordsIncluded"]) {
    if (key in payload && (typeof payload[key] === "string" || typeof payload[key] === "number" || typeof payload[key] === "boolean")) {
      compact[key] = payload[key];
    }
  }
  if (Array.isArray(payload.loadedToolNames)) {
    compact.loadedToolNames = payload.loadedToolNames.slice(0, 32).map((name) => String(name));
  }
  return {
    payload: compact,
    truncated: true
  };
}
function summarizeRecords(records) {
  return records.map((record) => ({
    id: record.id,
    occurredAt: record.occurredAt,
    recordType: record.recordType,
    subject: record.subject,
    title: record.title,
    contentPreview: record.content.slice(0, 600),
    tags: record.tags.slice(0, 8),
    attachmentCount: record.attachments.length
  }));
}
function summarizeStudent(student) {
  return {
    id: student.id,
    displayName: student.displayName,
    grade: student.grade,
    subjects: student.subjects,
    goals: student.goals,
    currentIssues: student.currentIssues,
    parentConcerns: student.parentConcerns,
    tags: student.tags,
    recordCount: student.recordCount,
    attachmentBytes: student.attachmentBytes
  };
}
function baseBlockedReview(toolName, router, reason, errors = []) {
  return {
    ok: false,
    toolName,
    route: router.route,
    reason,
    errors,
    normalizedArguments: {}
  };
}
function getModelToolDefinitions(router, options = {}) {
  const requested = options.toolNames ? new Set(options.toolNames) : void 0;
  return AI_TOOL_REGISTRY.filter((tool) => {
    const routeAllowed = tool.allowedRoutes.includes(router.route);
    const routeToolAllowed = router.allowedTools.includes(tool.name) || options.includeLoader === true && tool.name === "load_tools";
    const requestedAllowed = !requested || requested.has(tool.name);
    return routeAllowed && routeToolAllowed && requestedAllowed;
  }).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: `${tool.description} \u6743\u9650\uFF1A${tool.effect}/${tool.privacy}\u3002`,
      parameters: tool.parameters
    }
  }));
}
function resolveLoadToolNames(router, args) {
  const groups = Array.isArray(args.groups) ? args.groups.map((item) => String(item)).slice(0, 4) : [];
  const explicit = Array.isArray(args.tools) ? args.tools.map((item) => String(item)).slice(0, 12) : [];
  const candidates = [...explicit, ...groups.flatMap((group) => TOOL_GROUPS[group] ?? [])];
  return [...new Set(candidates)].filter((name) => name !== "load_tools").filter((name) => router.allowedTools.includes(name)).filter((name) => descriptorByName(name)?.allowedRoutes.includes(router.route));
}
function reviewModelToolCall(call, router, options = {}) {
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  if (!tool) return baseBlockedReview(toolName, router, "\u5DE5\u5177\u4E0D\u5B58\u5728\u3002", ["unknown_tool"]);
  if (tool.name !== "load_tools" && !router.allowedTools.includes(tool.name)) {
    return baseBlockedReview(toolName, router, `\u5F53\u524D route ${router.route} \u4E0D\u5141\u8BB8\u8C03\u7528\u8BE5\u5DE5\u5177\u3002`, ["route_allowlist_blocked"]);
  }
  if (!tool.allowedRoutes.includes(router.route)) {
    return baseBlockedReview(toolName, router, `\u5DE5\u5177 ${tool.name} \u4E0D\u5C5E\u4E8E route ${router.route} \u7684\u5141\u8BB8\u8303\u56F4\u3002`, ["tool_route_blocked"]);
  }
  if (tool.name !== "ask_user" && tool.name !== "load_tools" && !router.contextPolicy.include.includes(tool.contextKey)) {
    return baseBlockedReview(toolName, router, "\u5F53\u524D\u4E0A\u4E0B\u6587\u7B56\u7565\u672A\u5305\u542B\u8BE5\u5DE5\u5177\u6240\u9700 contextKey\u3002", ["context_policy_blocked"]);
  }
  const managedWrite = options.allowManagedWrite === true && ["mastery_quiz", "mastery_grade", "mastery_assess", "mastery_build"].includes(tool.name);
  if (tool.effect !== "read" && tool.effect !== "draft" && !managedWrite) {
    return baseBlockedReview(toolName, router, "Tool Calling v1 \u53EA\u5141\u8BB8\u53EA\u8BFB\u6216\u672C\u5730\u8349\u7A3F\u5DE5\u5177\uFF1B\u5199\u5165\u5FC5\u987B\u8FDB\u5165\u786E\u8BA4\u961F\u5217\u3002", ["write_requires_confirmation"]);
  }
  if (tool.privacy !== "local_only" && tool.privacy !== "sanitized_cloud") {
    return baseBlockedReview(toolName, router, "\u5DE5\u5177\u9690\u79C1\u7EA7\u522B\u672A\u77E5\u3002", ["invalid_privacy_level"]);
  }
  try {
    const args = parseToolArguments(call.arguments ?? {});
    const checked = validateArguments(tool, args);
    if (checked.errors.length) {
      return baseBlockedReview(toolName, router, "\u5DE5\u5177\u53C2\u6570\u672A\u901A\u8FC7\u672C\u5730 schema \u6821\u9A8C\u3002", checked.errors);
    }
    return {
      ok: true,
      toolName,
      route: router.route,
      reason: "\u5DE5\u5177\u8C03\u7528\u901A\u8FC7\u672C\u5730\u5BA1\u6838\u3002",
      errors: [],
      normalizedArguments: checked.normalized
    };
  } catch (error) {
    return baseBlockedReview(toolName, router, "\u5DE5\u5177\u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON object\u3002", [error instanceof Error ? error.message : "invalid_arguments"]);
  }
}
function createAiToolExecutionState(router, seed) {
  return {
    student: seed?.student,
    records: seed?.records ?? [],
    knowledgeSnippets: seed?.knowledgeSnippets ?? [],
    graphNodes: seed?.graphNodes ?? [],
    similarQuestions: seed?.similarQuestions ?? [],
    sources: seed?.sources ?? [],
    toolRuns: seed?.toolRuns ?? [],
    selectedContext: seed?.selectedContext ?? router.contextPolicy.include,
    resolvedStudentId: seed?.resolvedStudentId,
    learningAnalytics: seed?.learningAnalytics
  };
}
async function executeAiToolCall(params) {
  const { store, prompt, router, state, call } = params;
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  const review = reviewModelToolCall(call, router, { allowManagedWrite: params.allowManagedWrite });
  const safeTool = tool ?? {
    name: toolName,
    label: toolName,
    effect: "read",
    privacy: "local_only",
    maxOutputChars: DEFAULT_TOOL_OUTPUT_LIMIT
  };
  const inputSummary = {
    args: review.normalizedArguments,
    route: router.route,
    review: review.ok ? "allowed" : "blocked"
  };
  const getMasteryKnowledgePoints = async (studentId) => {
    const snapshot = await buildMasterySnapshot(store, studentId);
    const path = await store.getAiMasteryPath(studentId);
    const pathPoints = path?.modules.flatMap((module) => module.knowledgePoints.map((point) => ({
      id: point.id,
      name: point.name,
      type: point.type,
      module_id: module.id,
      moduleName: module.name
    }))) ?? [];
    return { snapshot, points: pathPoints.length ? pathPoints : snapshot.modules.flatMap((module) => module.knowledge_points.map((point) => ({ ...point, moduleName: module.name }))) };
  };
  if (!review.ok || !tool) {
    const toolRun = createToolRun(safeTool, "blocked", review.reason, inputSummary, { errors: review.errors });
    state.toolRuns.push(toolRun);
    return {
      review,
      toolRun,
      modelResult: {
        ok: false,
        toolName,
        blocked: true,
        reason: review.reason,
        errors: review.errors
      }
    };
  }
  try {
    const args = review.normalizedArguments;
    if (tool.name === "load_tools") {
      const loadedNames = resolveLoadToolNames(router, args);
      const definitions = getModelToolDefinitions(router, { toolNames: loadedNames });
      const outputSummary = {
        schemaVersion: "omni.tool.catalog.v1",
        requestedGroups: Array.isArray(args.groups) ? args.groups.map((item) => String(item)).slice(0, 4) : [],
        requestedTools: Array.isArray(args.tools) ? args.tools.map((item) => String(item)).slice(0, 12) : [],
        loadedToolNames: definitions.map((definition) => definition.function.name),
        loadedCount: definitions.length,
        permissionSource: "router_allowlist_and_tool_route",
        toolsExecuted: false,
        rawRecordsIncluded: false
      };
      const status = definitions.length ? "used" : "blocked";
      const toolRun2 = createToolRun(
        tool,
        status,
        definitions.length ? `\u5DF2\u6309\u9700\u52A0\u8F7D ${definitions.length} \u4E2A\u5DE5\u5177 schema\uFF1B\u5C1A\u672A\u6267\u884C\u4EFB\u4F55\u5DE5\u5177\u3002` : "\u8BF7\u6C42\u7684\u5DE5\u5177\u65CF\u5728\u5F53\u524D route \u4E0B\u6CA1\u6709\u53EF\u52A0\u8F7D\u5DE5\u5177\u3002",
        inputSummary,
        outputSummary
      );
      state.toolRuns.push(toolRun2);
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({
          ok: definitions.length > 0,
          toolDefinitions: definitions,
          ...outputSummary
        }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "inspect_memory_trace") {
      const requestedRunId = String(args.runId ?? "").trim();
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 50) || 50));
      const recentRuns = requestedRunId ? [] : await store.listAiAgentRuns(1);
      const runId = requestedRunId || recentRuns[0]?.id || "";
      if (!runId) {
        const toolRun3 = createToolRun(tool, "used", "\u672C\u5730\u8FD8\u6CA1\u6709\u53EF\u68C0\u67E5\u7684 Agent run\uFF1B\u6CA1\u6709\u751F\u6210\u8BB0\u5FC6\u7ED3\u8BBA\u3002", inputSummary, { layer: "L1", status: "missing", eventCount: 0, bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: true, layer: "L1", status: "missing", events: [], bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false } };
      }
      const trace = await store.getAiMemoryTrace(runId, limit);
      const found = trace.status !== "missing";
      const outputSummary = { runId, layer: trace.layer, status: trace.status, eventCount: trace.eventCount, bounded: trace.bounded, rawPromptIncluded: trace.rawPromptIncluded, hiddenReasoningIncluded: trace.hiddenReasoningIncluded };
      const toolRun2 = createToolRun(tool, found ? "used" : "blocked", found ? `\u5DF2\u8BFB\u53D6 ${trace.eventCount} \u6761 L1 \u9636\u6BB5/\u5DE5\u5177\u6458\u8981\uFF1B\u672A\u8FD4\u56DE prompt \u539F\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002` : "\u6307\u5B9A run \u4E0D\u5B58\u5728\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: runId, title: "\u5C0F\u667A L1 \u8FD0\u884C\u8F68\u8FF9", type: "SQLite ai_agent_runs/ai_agent_events", detail: "\u53EA\u8BFB bounded \u9636\u6BB5\u3001\u72B6\u6001\u3001\u5DE5\u5177\u540D\u548C\u8BC1\u636E\u952E\uFF1B\u4E0D\u542B prompt \u539F\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002", count: trace.eventCount });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: found, trace, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "inspect_memory_summary") {
      const surface = String(args.surface ?? "chat");
      const detail = await store.getAiMemoryDocument(surface);
      const includeDeleted = args.includeDeleted === true;
      const entries = detail?.entries.filter((entry) => includeDeleted || entry.status === "active") ?? [];
      const outputSummary = {
        layer: "L2",
        surface,
        exists: Boolean(detail),
        entryCount: entries.length,
        activeEntryCount: entries.filter((entry) => entry.status === "active").length,
        refsValidated: true,
        rawPromptIncluded: false,
        hiddenReasoningIncluded: false
      };
      const toolRun2 = createToolRun(tool, "used", detail ? "\u5DF2\u8BFB\u53D6\u672C\u5730 L2 \u6458\u8981\u6761\u76EE\u4E0E evidence refs\uFF1B\u672A\u8BFB\u53D6\u539F\u59CB prompt\u3002" : "\u5F53\u524D surface \u5C1A\u65E0 L2 \u6458\u8981\u6587\u6863\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: `memory_l2:${surface}`, title: `\u5C0F\u667A L2 ${surface} \u6458\u8981`, type: "SQLite ai_memory_documents/ai_memory_entries", detail: "\u6559\u5E08\u53EF\u89C1\u3001\u53EF\u7F16\u8F91\u3001\u5E26 evidence refs \u7684\u672C\u5730\u6458\u8981\uFF1B\u4E0D\u5305\u542B\u539F\u59CB prompt \u6216\u9690\u85CF\u63A8\u7406\u3002", count: entries.length });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({
          ok: Boolean(detail),
          document: detail?.document ?? null,
          entries: entries.map((entry) => ({
            id: entry.id,
            section: entry.section,
            text: entry.text,
            refs: entry.refs,
            status: entry.status,
            origin: entry.origin,
            version: entry.version,
            updatedAt: entry.updatedAt
          })),
          ...outputSummary
        }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "draft_memory_summary") {
      const surface = String(args.surface ?? "chat");
      const runId = args.runId == null ? void 0 : String(args.runId);
      const limit = Math.min(8, Math.max(1, Number(args.limit ?? 8) || 8));
      const draft = await store.draftAiMemorySummary(surface, runId, limit);
      const outputSummary = {
        layer: "L2",
        surface,
        sourceRunId: draft.sourceRunId,
        candidateCount: draft.entries.length,
        requiresTeacherReview: true,
        writesMemory: false,
        rawPromptIncluded: false,
        hiddenReasoningIncluded: false
      };
      const toolRun2 = createToolRun(tool, draft.entries.length ? "used" : "blocked", draft.entries.length ? "\u5DF2\u4ECE\u672C\u5730 L1 \u8BC1\u636E\u751F\u6210 L2 \u8349\u7A3F\uFF1B\u5C1A\u672A\u5199\u5165\u6B63\u5F0F\u8BB0\u5FC6\u3002" : "\u6CA1\u6709\u53EF\u7528 L1 run/event \u8BC1\u636E\uFF0C\u65E0\u6CD5\u751F\u6210 L2 \u8349\u7A3F\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: draft.sourceRunId ? `ai_agent_run:${draft.sourceRunId}` : "memory_l1:missing", title: "L2 \u6458\u8981\u8349\u7A3F\u8BC1\u636E", type: "SQLite ai_agent_events", detail: "\u8349\u7A3F\u53EA\u4FDD\u7559\u9636\u6BB5/\u72B6\u6001/\u5DE5\u5177\u540D\u548C evidence refs\uFF0C\u4FDD\u5B58\u524D\u9700\u8981\u6559\u5E08\u7F16\u8F91\u6216\u786E\u8BA4\u3002", count: draft.entries.length });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: draft.entries.length > 0, draft, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "inspect_memory_synthesis") {
      const slot = String(args.slot ?? "recent");
      const detail = await store.getAiMemoryL3Document(slot);
      const outputSummary = { layer: "L3", slot, exists: Boolean(detail), entryCount: detail?.entries.length ?? 0, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun2 = createToolRun(tool, detail ? "used" : "blocked", detail ? "\u5DF2\u8BFB\u53D6 bounded L3 \u7EFC\u5408\u8BB0\u5FC6\u3002" : "\u5F53\u524D\u69FD\u4F4D\u5C1A\u65E0 L3 \u6587\u6863\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: `memory_l3:${slot}`, title: `\u5C0F\u667A L3 ${slot} \u7EFC\u5408\u8BB0\u5FC6`, type: "SQLite ai_memory_l3_documents/ai_memory_l3_entries", detail: "\u53EA\u8BFB\u8DE8 surface \u7EFC\u5408\uFF0C\u4E0D\u542B prompt\u3001\u5B66\u751F\u6B63\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002", count: detail?.entries.length ?? 0 });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: Boolean(detail), detail: detail ? { document: detail.document, entries: detail.entries.filter((entry) => entry.status === "active") } : null, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "draft_memory_synthesis") {
      const slot = String(args.slot ?? "recent");
      const limit = Math.min(8, Math.max(1, Number(args.limit ?? 8) || 8));
      const draft = await store.draftAiMemoryL3(slot, limit);
      const outputSummary = { layer: "L3", slot, candidateCount: draft.entries.length, requiresTeacherReview: true, writesMemory: false, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun2 = createToolRun(tool, draft.entries.length ? "used" : "blocked", draft.entries.length ? "\u5DF2\u4ECE L2 \u751F\u6210 L3 \u5019\u9009\uFF0C\u7B49\u5F85\u6559\u5E08\u5BA1\u6838\u3002" : "\u6CA1\u6709\u53EF\u7EFC\u5408\u7684 L2 \u6761\u76EE\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: `memory_l3_draft:${slot}`, title: `L3 ${slot} \u5019\u9009\u8BC1\u636E`, type: "SQLite ai_memory_documents/ai_memory_entries", detail: "\u5019\u9009\u53EA\u5F15\u7528 surface \u540D\u79F0\uFF0C\u4E0D\u5199\u5165\u6B63\u5F0F L3\u3002", count: draft.entries.length });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: draft.entries.length > 0, draft, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "inspect_memory_graph") {
      const limit = Math.min(200, Math.max(1, Number(args.limit ?? 200) || 200));
      const graph = await store.getAiMemoryEvidenceGraph(limit);
      const outputSummary = { layer: "L2/L3", nodeCount: graph.nodes.length, edgeCount: graph.edges.length, bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun2 = createToolRun(tool, "used", "\u5DF2\u8BFB\u53D6 L2/L3 \u5230\u672C\u5730 run/event \u7684 evidence graph \u6295\u5F71\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: "memory_graph", title: "\u5C0F\u667A\u8BB0\u5FC6\u8BC1\u636E\u56FE", type: "SQLite memory graph projection", detail: "\u53EA\u8FD4\u56DE bounded \u8282\u70B9\u6807\u7B7E\u3001\u8FB9\u7C7B\u578B\u548C\u72B6\u6001\uFF0C\u4E0D\u8FD4\u56DE\u6B63\u6587\u6216\u9690\u85CF\u63A8\u7406\u3002", count: graph.nodes.length });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, graph, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "inspect_memory_governance") {
      const governance = await store.getAiMemoryGovernanceReport();
      const toolRun2 = createToolRun(tool, "used", "\u5DF2\u8BFB\u53D6\u672C\u5730\u8BB0\u5FC6\u6CBB\u7406\u62A5\u544A\uFF1BAI \u5199\u5165\u4FDD\u6301\u5173\u95ED\u3002", inputSummary, governance);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: "memory_governance", title: "\u5C0F\u667A\u8BB0\u5FC6\u6CBB\u7406\u62A5\u544A", type: "SQLite governance projection", detail: "\u53EA\u8BFB\u7EDF\u8BA1\u548C\u60AC\u7A7A\u5F15\u7528\u68C0\u67E5\uFF0C\u4E0D\u5305\u542B\u8BB0\u5FC6\u6B63\u6587\u3002", count: governance.graphNodes });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, governance }, tool.maxOutputChars).payload };
    }
    if (tool.name === "resolve_student_reference") {
      const students = await store.listStudents("");
      const resolved = findStudentByPrompt(prompt, students, String(args.studentName ?? ""));
      if (resolved.student) {
        state.resolvedStudentId = resolved.student.id;
        const outputSummary2 = {
          displayName: resolved.student.displayName,
          matchType: resolved.matchType,
          hints: resolved.hints
        };
        const toolRun3 = createToolRun(tool, "used", `\u4ECE\u4EFB\u52A1\u6587\u672C\u4E2D\u89E3\u6790\u5230\u5B66\u751F\uFF1A${resolved.student.displayName}\u3002`, inputSummary, outputSummary2);
        state.toolRuns.push(toolRun3);
        addSource(state.sources, {
          id: "student_lookup",
          title: "\u5B66\u751F\u5F15\u7528\u89E3\u6790",
          type: "SQLite students",
          detail: `\u5C0F\u667A\u5DF2\u81EA\u52A8\u628A\u4EFB\u52A1\u7ED1\u5B9A\u5230 ${resolved.student.displayName}\u3002`,
          count: "\u5DF2\u89E3\u6790"
        });
        return {
          review,
          toolRun: toolRun3,
          modelResult: boundedPayload({ ok: true, studentId: resolved.student.id, ...outputSummary2 }, tool.maxOutputChars).payload
        };
      }
      const outputSummary = { hints: resolved.hints, candidatesChecked: students.length };
      const toolRun2 = createToolRun(
        tool,
        "blocked",
        resolved.hints.length ? `\u68C0\u6D4B\u5230\u5B66\u751F\u5F15\u7528 ${resolved.hints.join("\u3001")}\uFF0C\u4F46\u672C\u5730\u5B66\u751F\u6863\u6848\u672A\u547D\u4E2D\u3002` : "\u672A\u627E\u5230\u53EF\u89E3\u6790\u5B66\u751F\u3002",
        inputSummary,
        outputSummary
      );
      state.toolRuns.push(toolRun2);
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: false, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "get_student_profile") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u5B66\u751F\u6863\u6848\u3002", inputSummary, { found: false });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const student = (await store.listStudents("")).find((item) => item.id === studentId);
      state.student = student;
      const outputSummary = { studentId, found: Boolean(student), displayName: student?.displayName ?? "" };
      const toolRun2 = createToolRun(tool, student ? "used" : "blocked", student ? `\u5DF2\u8BFB\u53D6 ${student.displayName} \u7684\u5B66\u751F\u6863\u6848\u3002` : "\u5B66\u751F\u4E0D\u5B58\u5728\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "student_profile",
        title: student?.displayName ?? "\u5B66\u751F\u4E0D\u5B58\u5728",
        type: "\u5B66\u751F\u6863\u6848",
        detail: student ? "\u9636\u6BB5\u76EE\u6807\u3001\u5F53\u524D\u95EE\u9898\u3001\u5BB6\u957F\u5173\u6CE8\u70B9\u548C\u6807\u7B7E\u5DF2\u7EB3\u5165\u3002" : "\u672A\u8BFB\u53D6\u5230\u5B66\u751F\u6863\u6848\u3002",
        count: student ? "\u5DF2\u8BFB\u53D6" : "\u672A\u547D\u4E2D"
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({ ok: Boolean(student), student: student ? summarizeStudent(student) : null }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "get_review_queue") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "").trim();
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u590D\u4E60\u961F\u5217\u3002", inputSummary, { reason: "missing_student_id" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const student = (await store.listStudents("")).find((item) => item.id === studentId);
      if (!student) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5B66\u751F\u4E0D\u5B58\u5728\uFF0C\u62D2\u7EDD\u8BFB\u53D6\u590D\u4E60\u961F\u5217\u3002", inputSummary, { reason: "student_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_not_found" } };
      }
      const snapshot = await buildMasterySnapshot(store, studentId);
      const policy = buildMasteryPolicy(snapshot);
      const limitRaw = Number(args.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.floor(limitRaw))) : 20;
      const timezone = String(args.timezone ?? "UTC").trim().slice(0, 80) || "UTC";
      const queue = policy.dueReviews.slice(0, limit).map((item) => ({
        id: `review_${item.id}`,
        knowledgePointId: item.id,
        name: item.name,
        moduleId: item.moduleId,
        moduleName: item.moduleName,
        type: item.type,
        dueAt: item.nextReviewAt
      }));
      const outputSummary = {
        ok: true,
        schemaVersion: "omni.review.queue.v1",
        studentId,
        timezone,
        timezoneInvariant: true,
        queue,
        dueReviewCount: queue.length,
        source: "omni_edu_learning_records",
        rawRecordsIncluded: false,
        requiresTeacherReview: true
      };
      const toolRun2 = createToolRun(tool, "used", queue.length ? `\u5DF2\u8BFB\u53D6 ${queue.length} \u4E2A\u5230\u671F\u590D\u4E60\u4EFB\u52A1\u3002` : "\u5F53\u524D\u6CA1\u6709\u5230\u671F\u590D\u4E60\u4EFB\u52A1\u3002", inputSummary, {
        studentId,
        dueReviewCount: queue.length,
        timezone,
        rawRecordsIncluded: false
      });
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "review_queue",
        title: `${student.displayName} \u95F4\u9694\u590D\u4E60\u961F\u5217`,
        type: "DeepTutor deterministic scheduler",
        detail: "epoch due \u5224\u65AD\u4E0D\u53D7\u672C\u5730\u65F6\u533A\u5207\u6362\u5F71\u54CD\uFF1B\u53EA\u8FD4\u56DE\u77E5\u8BC6\u70B9\u6458\u8981\uFF0C\u4E0D\u542B\u539F\u59CB\u5B66\u4E60\u8BB0\u5F55\u3002",
        count: queue.length
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "mastery_status") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u638C\u63E1\u5EA6\u72B6\u6001\u3002", inputSummary, { found: false });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const snapshot = await buildMasterySnapshot(store, studentId);
      const policy = buildMasteryPolicy(snapshot);
      const pendingQuestions = await store.getPendingAiMasteryQuestions(studentId, 20);
      const pendingQuestion = pendingQuestions[0] ?? null;
      const attemptsByPoint = /* @__PURE__ */ new Map();
      for (const attempt of snapshot.attempts) {
        const current = attemptsByPoint.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
        current.total += 1;
        if (attempt.isCorrect) current.correct += 1;
        attemptsByPoint.set(attempt.knowledgePointId, current);
      }
      const points = snapshot.modules.flatMap((module) => module.knowledge_points.map((point) => {
        const counts = attemptsByPoint.get(point.id) ?? { correct: 0, total: 0 };
        return {
          id: point.id,
          name: point.name,
          module: module.name,
          attempts: counts.total,
          correct: counts.correct,
          accuracy: counts.total ? Math.round(counts.correct / counts.total * 100) / 100 : null,
          evidence: counts.total ? "explicit_attempts" : "no_attempts"
        };
      }));
      const outputSummary = {
        ok: true,
        source: "omni_edu_learning_records",
        studentId,
        points,
        evidence: snapshot.evidence,
        policy: {
          version: policy.policyVersion,
          next: policy.next,
          dueReviews: policy.dueReviews
        },
        pendingQuestion: pendingQuestion ? {
          id: pendingQuestion.id,
          knowledgePointId: pendingQuestion.knowledgePointId,
          knowledgePointName: pendingQuestion.knowledgePointName,
          stem: pendingQuestion.stem,
          options: pendingQuestion.options.slice(0, 8),
          status: pendingQuestion.status,
          answerSubmitted: pendingQuestion.status === "answered"
        } : null,
        pendingQuestionCount: pendingQuestions.length,
        rawRecordsIncluded: false
      };
      const toolRun2 = createToolRun(tool, "used", `\u5DF2\u8BFB\u53D6 ${points.length} \u4E2A\u77E5\u8BC6\u70B9\u7684\u663E\u5F0F\u638C\u63E1\u5EA6\u6458\u8981\uFF1B\u672A\u8BFB\u53D6\u539F\u59CB\u8BB0\u5F55\u6B63\u6587\u3002`, inputSummary, {
        pointCount: points.length,
        attemptCount: snapshot.evidence.attemptCount,
        unknownEvidence: snapshot.evidence.unknownEvidence
      });
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "mastery_status",
        title: "\u77E5\u8BC6\u70B9\u638C\u63E1\u5EA6",
        type: "SQLite learning records",
        detail: "\u4EC5\u57FA\u4E8E\u663E\u5F0F\u6B63\u786E/\u9519\u8BEF\u8BC1\u636E\u8BA1\u7B97\uFF1B\u81EA\u7531\u6587\u672C\u4E0D\u4F1A\u88AB\u5F53\u4F5C\u638C\u63E1\u5EA6\u8BC1\u636E\u3002",
        count: points.length
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "analyze_learning_progress") {
      const requestedStudentId = String(args.studentId ?? "").trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u8BF7\u6C42\u7684\u5B66\u751F\u4E0E\u672C\u8F6E\u5DF2\u7ED1\u5B9A\u5B66\u751F\u4E0D\u4E00\u81F4\uFF0C\u62D2\u7EDD\u8DE8\u5B66\u751F\u5206\u6790\u3002", inputSummary, { reason: "student_scope_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_scope_mismatch" } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u751F\u6210\u5B66\u60C5\u7EDF\u8BA1\u3002", inputSummary, { reason: "missing_student_id" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const student = (await store.listStudents("")).find((item) => item.id === studentId);
      if (!student) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5B66\u751F\u4E0D\u5B58\u5728\uFF0C\u62D2\u7EDD\u751F\u6210\u5B66\u60C5\u7EDF\u8BA1\u3002", inputSummary, { reason: "student_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_not_found" } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      const analytics = buildLearningAnalytics({
        studentId,
        records,
        startDate: String(args.startDate ?? "").trim() || void 0,
        endDate: String(args.endDate ?? "").trim() || void 0,
        subject: String(args.subject ?? "").trim() || void 0
      });
      state.records = records;
      state.learningAnalytics = analytics;
      const outputSummary = {
        ok: true,
        source: "omni_edu_learning_records",
        studentId,
        analytics,
        reportDraftMarkdown: buildLearningAnalyticsMarkdown(analytics, student.displayName),
        rawRecordsIncluded: false
      };
      const toolRun2 = createToolRun(tool, "used", analytics.metrics.recordCount ? `\u5DF2\u5B8C\u6210 ${analytics.window.startDate} \u81F3 ${analytics.window.endDate} \u7684\u5B66\u60C5\u7EDF\u8BA1\u3002` : "\u7EDF\u8BA1\u6210\u529F\uFF0C\u4F46\u5F53\u524D\u7B5B\u9009\u8303\u56F4\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55\u3002", inputSummary, {
        studentId,
        recordCount: analytics.metrics.recordCount,
        activeDays: analytics.metrics.activeDays,
        sourceRecordCount: analytics.evidence.sourceRecordIds.length,
        rawRecordsIncluded: false
      });
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "learning_analytics",
        title: `${student.displayName} \u5B66\u60C5\u7EDF\u8BA1`,
        type: "SQLite learning_records",
        detail: `\u7EDF\u8BA1\u8303\u56F4 ${analytics.window.startDate} \u81F3 ${analytics.window.endDate}\uFF1B\u53EF\u7531 ${analytics.evidence.sourceRecordIds.length} \u6761\u6765\u6E90\u8BB0\u5F55\u91CD\u7B97\u3002`,
        count: analytics.metrics.recordCount
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "classify_error_patterns") {
      const requestedStudentId = String(args.studentId ?? "").trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u8BF7\u6C42\u7684\u5B66\u751F\u4E0E\u672C\u8F6E\u5DF2\u7ED1\u5B9A\u5B66\u751F\u4E0D\u4E00\u81F4\uFF0C\u62D2\u7EDD\u8DE8\u5B66\u751F\u9519\u56E0\u5206\u6790\u3002", inputSummary, { reason: "student_scope_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_scope_mismatch" } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u8FDB\u884C\u9519\u56E0\u5206\u7C7B\u3002", inputSummary, { reason: "missing_student_id" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const student = (await store.listStudents("")).find((item) => item.id === studentId);
      if (!student) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5B66\u751F\u4E0D\u5B58\u5728\uFF0C\u62D2\u7EDD\u751F\u6210\u9519\u56E0\u5206\u7C7B\u3002", inputSummary, { reason: "student_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_not_found" } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      let analysis;
      try {
        analysis = buildErrorTaxonomyAnalysis({
          studentId,
          records,
          startDate: String(args.startDate ?? "").trim() || void 0,
          endDate: String(args.endDate ?? "").trim() || void 0,
          subject: String(args.subject ?? "").trim() || void 0
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "invalid_error_taxonomy_window";
        const toolRun3 = createToolRun(tool, "failed", `\u9519\u56E0\u5206\u7C7B\u53C2\u6570\u6821\u9A8C\u5931\u8D25\uFF1A${reason}`, inputSummary, { reason: "invalid_error_taxonomy_window" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason } };
      }
      state.records = records;
      const outputSummary = {
        ok: true,
        source: "omni_edu_learning_records",
        studentId,
        analysis,
        reportDraftMarkdown: buildErrorTaxonomyMarkdown(analysis, student.displayName),
        rawRecordsIncluded: false
      };
      const toolRun2 = createToolRun(tool, "used", analysis.evidence.includedRecordCount ? `\u5DF2\u5B8C\u6210 ${analysis.window.startDate} \u81F3 ${analysis.window.endDate} \u7684\u9519\u56E0\u5206\u7C7B\uFF1B\u672A\u77E5\u9879\u9700\u8001\u5E08\u590D\u6838\u3002` : "\u5206\u7C7B\u5B8C\u6210\uFF0C\u4F46\u5F53\u524D\u7B5B\u9009\u8303\u56F4\u6CA1\u6709\u53EF\u8BC6\u522B\u7684\u9519\u9898/\u8BA2\u6B63\u8BB0\u5F55\u3002", inputSummary, {
        studentId,
        includedRecordCount: analysis.evidence.includedRecordCount,
        unknownCount: analysis.evidence.unknownRecordIds.length,
        sourceRecordCount: analysis.evidence.sourceRecordIds.length,
        rawRecordsIncluded: false
      });
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "error_taxonomy",
        title: `${student.displayName} \u9519\u56E0\u5206\u7C7B`,
        type: "SQLite learning_records",
        detail: `\u5206\u7C7B\u8303\u56F4 ${analysis.window.startDate} \u81F3 ${analysis.window.endDate}\uFF1B\u672A\u77E5\u9879\u4E0D\u81EA\u52A8\u5199\u5165\u5B66\u751F\u6863\u6848\u3002`,
        count: analysis.evidence.sourceRecordIds.length
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "mastery_quiz") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u521B\u5EFA\u638C\u63E1\u5EA6\u5C0F\u6D4B\u3002", inputSummary, { found: false });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const existingPending = await store.getPendingAiMasteryQuestions(studentId, 1);
      if (existingPending.length) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5F53\u524D\u5B66\u751F\u5DF2\u6709\u672A\u5B8C\u6210\u638C\u63E1\u5EA6\u5C0F\u6D4B\uFF0C\u8BF7\u5148\u56DE\u7B54\u5E76\u8BC4\u5206\u540E\u518D\u521B\u5EFA\u4E0B\u4E00\u7EC4\u3002", inputSummary, { reason: "pending_question_exists", questionId: existingPending[0].id });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "pending_question_exists" } };
      }
      const { snapshot, points: masteryPoints } = await getMasteryKnowledgePoints(studentId);
      const attemptsByPoint = /* @__PURE__ */ new Map();
      for (const attempt of snapshot.attempts) {
        const current = attemptsByPoint.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
        current.total += 1;
        if (attempt.isCorrect) current.correct += 1;
        attemptsByPoint.set(attempt.knowledgePointId, current);
      }
      const requestedPointId = String(args.knowledgePointId ?? "");
      const candidatePoints = masteryPoints;
      const sortedPoints = [...candidatePoints].sort((a, b) => {
        const left = attemptsByPoint.get(a.id) ?? { correct: 0, total: 0 };
        const right = attemptsByPoint.get(b.id) ?? { correct: 0, total: 0 };
        const leftAccuracy = left.total ? left.correct / left.total : 0;
        const rightAccuracy = right.total ? right.correct / right.total : 0;
        return leftAccuracy - rightAccuracy || left.total - right.total;
      });
      const requestedPoint = sortedPoints.find((item) => item.id === requestedPointId);
      const orderedPoints = requestedPoint ? [requestedPoint, ...sortedPoints.filter((item) => item.id !== requestedPoint.id)] : sortedPoints;
      const requestedCount = Number(args.questionCount);
      const questionCount = Number.isFinite(requestedCount) ? Math.min(5, Math.max(1, Math.trunc(requestedCount))) : 1;
      const pointsForQuiz = orderedPoints.slice(0, questionCount);
      if (!pointsForQuiz.length) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5F53\u524D\u6CA1\u6709\u660E\u786E\u77E5\u8BC6\u70B9\u8BC1\u636E\uFF0C\u4E0D\u80FD\u51ED\u7A7A\u751F\u6210\u638C\u63E1\u5EA6\u5C0F\u6D4B\u3002", inputSummary, { pointCount: 0, unknownEvidence: snapshot.evidence.unknownEvidence });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "no_explicit_knowledge_point" } };
      }
      if (!params.executionContext?.runId || !params.executionContext.turnId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u7F3A\u5C11\u5BBF\u4E3B\u8FD0\u884C\u7ED1\u5B9A\uFF0C\u62D2\u7EDD\u521B\u5EFA\u4E0D\u53EF\u8FFD\u8E2A\u7684\u638C\u63E1\u5EA6\u9898\u76EE\u3002", inputSummary, { reason: "missing_run_binding" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_run_binding" } };
      }
      const options = ["A. \u80FD\u8BF4\u660E\u5B9A\u4E49\u3001\u9002\u7528\u6761\u4EF6\uFF0C\u5E76\u7ED9\u51FA\u4E00\u4E2A\u6B63\u786E\u4F8B\u5B50\u3002", "B. \u53EA\u8BB0\u4F4F\u4E00\u4E2A\u7ED3\u8BBA\uFF0C\u4F46\u4E0D\u80FD\u8BF4\u660E\u9002\u7528\u6761\u4EF6\u3002", "C. \u76EE\u524D\u8FD8\u4E0D\u80FD\u5224\u65AD\u3002"];
      const questions = await store.createAiMasteryQuestions({
        runId: params.executionContext?.runId ?? "",
        turnId: params.executionContext?.turnId ?? "",
        studentId,
        questions: pointsForQuiz.map((point) => ({
          knowledgePointId: point.id,
          knowledgePointName: point.name,
          stem: `\u5173\u4E8E\u201C${point.name}\u201D\uFF0C\u54EA\u4E00\u9879\u6700\u80FD\u8BF4\u660E\u5DF2\u7ECF\u8FBE\u5230\u53EF\u5E94\u7528\u7684\u638C\u63E1\u6807\u51C6\uFF1F`,
          options,
          expectedAnswer: "A"
        }))
      });
      const question = questions[0];
      const outputSummary = {
        ok: true,
        questionId: question.id,
        knowledgePointId: pointsForQuiz[0].id,
        knowledgePoint: pointsForQuiz[0].name,
        stem: question.stem,
        options,
        questionIndex: 1,
        questionCount: questions.length,
        remainingQuestionCount: Math.max(0, questions.length - 1),
        requiresUserInput: true,
        expectedAnswerIncluded: false
      };
      const toolRun2 = createToolRun(tool, "used", `\u5DF2\u521B\u5EFA ${questions.length} \u9053\u8FDE\u7EED\u638C\u63E1\u5EA6\u5C0F\u6D4B\uFF0C\u5F53\u524D\u9898\u4E3A ${pointsForQuiz[0].name}\uFF1B\u6B63\u786E\u7B54\u6848\u7559\u5728\u4E3B\u8FDB\u7A0B\u3002`, inputSummary, { questionId: question.id, knowledgePointId: pointsForQuiz[0].id, questionCount: questions.length, expectedAnswerIncluded: false });
      state.toolRuns.push(toolRun2);
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "mastery_grade") {
      const questionId = String(args.questionId ?? "");
      const answer = String(args.answer ?? "").trim().slice(0, 2e3);
      const question = questionId ? await store.getAiMasteryQuestion(questionId) : state.resolvedStudentId ? await store.getPendingAiMasteryQuestion(state.resolvedStudentId) : null;
      if (question && state.resolvedStudentId && question.studentId !== state.resolvedStudentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u9898\u76EE\u4E0D\u5C5E\u4E8E\u672C\u8F6E\u7ED1\u5B9A\u5B66\u751F\uFF0C\u62D2\u7EDD\u8DE8\u5B66\u751F\u8BC4\u5206\u3002", inputSummary, { questionId: question.id, reason: "student_scope_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_scope_mismatch" } };
      }
      if (!question || question.status !== "answered") {
        const toolRun3 = createToolRun(tool, "blocked", "\u9898\u76EE\u4E0D\u5B58\u5728\u3001\u5C1A\u672A\u5B8C\u6210\u7B54\u9898\u6216\u5DF2\u8BC4\u5206\uFF0C\u62D2\u7EDD\u91CD\u590D\u5199\u56DE\u3002", inputSummary, { questionId, status: question?.status ?? "missing" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "question_not_answerable" } };
      }
      if (answer && answer !== question.answer) {
        const toolRun3 = createToolRun(tool, "blocked", "\u8BC4\u5206\u7B54\u6848\u4E0E\u5DF2\u63D0\u4EA4\u7684 checkpoint \u4E0D\u4E00\u81F4\uFF0C\u62D2\u7EDD\u8D8A\u6743\u5199\u56DE\u3002", inputSummary, { questionId, reason: "answer_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "answer_mismatch" } };
      }
      const pendingQueue = await store.getPendingAiMasteryQuestions(question.studentId, 20);
      if (pendingQueue[0] && pendingQueue[0].id !== question.id) {
        const toolRun3 = createToolRun(tool, "blocked", "\u8FDE\u7EED\u5C0F\u6D4B\u5FC5\u987B\u6309\u9898\u76EE\u987A\u5E8F\u8BC4\u5206\uFF0C\u62D2\u7EDD\u8DF3\u8FC7\u524D\u7F6E\u9898\u76EE\u3002", inputSummary, { questionId: question.id, reason: "question_order_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "question_order_mismatch" } };
      }
      const isCorrect = question.answer.trim().toUpperCase().startsWith(question.expectedAnswer.toUpperCase());
      const graded = await store.gradeAiMasteryQuestion(question.id, isCorrect);
      if (!graded) {
        const toolRun3 = createToolRun(tool, "failed", "\u638C\u63E1\u5EA6\u9898\u76EE\u8BC4\u5206\u5199\u56DE\u5931\u8D25\u3002", inputSummary, { questionId });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "grade_write_failed" } };
      }
      const gradedMastery = await getMasteryKnowledgePoints(question.studentId);
      const gradedPoint = gradedMastery.points.find((point) => point.id === question.knowledgePointId);
      const gradedKnowledgeType = gradedPoint?.type ?? "concept";
      await store.createRecord({
        studentId: question.studentId,
        recordType: "mastery_attempt",
        subject: "\u638C\u63E1\u5EA6\u7EC3\u4E60",
        title: `\u638C\u63E1\u5EA6\u5C0F\u6D4B\uFF1A${question.knowledgePointName}`,
        content: JSON.stringify({ knowledgePoint: question.knowledgePointName, knowledgeType: gradedKnowledgeType, isCorrect, questionId: question.id }),
        tags: [question.knowledgePointName, "mastery_attempt"]
      });
      const outputSummary = { ok: true, questionId: question.id, knowledgePoint: question.knowledgePointName, knowledgeType: gradedKnowledgeType, isCorrect, writeback: "learning_records", expectedAnswerIncluded: false };
      const toolRun2 = createToolRun(tool, "used", `\u5DF2\u8BC4\u5206\u5E76\u5199\u56DE\u4E00\u6761\u663E\u5F0F\u638C\u63E1\u5EA6\u8BB0\u5F55\uFF1A${isCorrect ? "\u6B63\u786E" : "\u5F85\u52A0\u5F3A"}\u3002`, inputSummary, { questionId: question.id, isCorrect, writeback: "learning_records" });
      state.toolRuns.push(toolRun2);
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "mastery_assess") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      const pointId = String(args.knowledgePointId ?? "");
      const passed = args.passed === true;
      const feedback = String(args.feedback ?? "").slice(0, 600);
      const studentExists = studentId ? (await store.listStudents("")).some((student) => student.id === studentId) : false;
      const mastery = studentId ? await getMasteryKnowledgePoints(studentId) : void 0;
      const point = mastery?.points.find((candidate) => candidate.id === pointId);
      if (!studentExists || !studentId || !pointId || !point) {
        const toolRun2 = createToolRun(tool, "blocked", "\u5B66\u751F\u6216\u77E5\u8BC6\u70B9\u4E0D\u5B58\u5728\uFF0C\u4E0D\u80FD\u8BB0\u5F55\u6982\u5FF5\u638C\u63E1\u5224\u65AD\u3002", inputSummary, { studentId, knowledgePointId: pointId, reason: "unknown_knowledge_point" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "unknown_knowledge_point" } };
      }
      if (!["concept", "design"].includes(point.type)) {
        const toolRun2 = createToolRun(tool, "blocked", `\u77E5\u8BC6\u70B9\u7C7B\u578B\u4E3A ${point.type}\uFF0C\u5E94\u4F7F\u7528 mastery_quiz + mastery_grade\u3002`, inputSummary, { knowledgePointId: pointId, type: point.type, reason: "wrong_gate" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "wrong_gate", type: point.type } };
      }
      const pendingAssessment = { ok: true, knowledgePointId: pointId, knowledgePoint: point.name, knowledgeType: point.type, passed, writeback: "teacher_confirmation", pendingConfirmation: { actionType: "save_mastery_state", operation: "assess" }, expectedAnswerIncluded: false };
      const pendingAssessmentRun = createToolRun(tool, "used", "Mastery assessment draft is awaiting teacher confirmation.", inputSummary, { knowledgePointId: pointId, passed, writeback: "teacher_confirmation" });
      state.toolRuns.push(pendingAssessmentRun);
      return { review, toolRun: pendingAssessmentRun, modelResult: boundedPayload(pendingAssessment, tool.maxOutputChars).payload };
    }
    if (tool.name === "mastery_build") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      const mode = String(args.mode ?? "replace") === "append" ? "append" : "replace";
      const rawModules = Array.isArray(args.modules) ? args.modules : [];
      const studentExists = studentId ? (await store.listStudents("")).some((student) => student.id === studentId) : false;
      if (!studentExists || !studentId || !rawModules.length || rawModules.length > 12) {
        const toolRun2 = createToolRun(tool, "blocked", "\u5B66\u4E60\u8DEF\u5F84\u5FC5\u987B\u5305\u542B 1-12 \u4E2A\u6A21\u5757\uFF0C\u5E76\u7ED1\u5B9A\u5B66\u751F\u3002", inputSummary, { reason: "invalid_modules" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "invalid_modules" } };
      }
      const modules = [];
      let invalidModule = false;
      for (let moduleIndex = 0; moduleIndex < rawModules.length; moduleIndex += 1) {
        const rawModule = rawModules[moduleIndex] && typeof rawModules[moduleIndex] === "object" ? rawModules[moduleIndex] : {};
        const name = String(rawModule.name ?? "").trim().slice(0, 200);
        const rawPoints = Array.isArray(rawModule.knowledgePoints) ? rawModule.knowledgePoints : Array.isArray(rawModule.knowledge_points) ? rawModule.knowledge_points : [];
        if (!name || rawPoints.length < 1 || rawPoints.length > 20) {
          invalidModule = true;
          continue;
        }
        const knowledgePoints = [];
        for (let pointIndex = 0; pointIndex < rawPoints.length; pointIndex += 1) {
          const rawPoint = rawPoints[pointIndex] && typeof rawPoints[pointIndex] === "object" ? rawPoints[pointIndex] : {};
          const pointName = String(rawPoint.name ?? "").trim().slice(0, 160);
          const rawType = String(rawPoint.type ?? "concept").toLowerCase();
          if (!pointName || !["memory", "procedure", "concept", "design"].includes(rawType)) {
            invalidModule = true;
            continue;
          }
          knowledgePoints.push({ id: `mastery_m${moduleIndex}_kp${pointIndex}`, name: pointName, type: rawType });
        }
        if (knowledgePoints.length) modules.push({ id: `mastery_m${moduleIndex}`, name, order: moduleIndex, knowledgePoints });
      }
      if (invalidModule || modules.length !== rawModules.length || !modules.length) {
        const toolRun2 = createToolRun(tool, "blocked", "\u6CA1\u6709\u6709\u6548\u6A21\u5757\uFF1A\u6BCF\u4E2A\u6A21\u5757\u9700\u8981\u540D\u79F0\u548C\u81F3\u5C11\u4E00\u4E2A\u5408\u6CD5\u77E5\u8BC6\u70B9\u7C7B\u578B\u3002", inputSummary, { reason: "no_valid_modules" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "no_valid_modules" } };
      }
      const pendingBuild = { ok: true, mode, modules: modules.map((module) => ({ id: module.id, name: module.name, order: module.order, knowledgePointCount: module.knowledgePoints.length })), writeback: "teacher_confirmation", pendingConfirmation: { actionType: "save_mastery_state", operation: "build" } };
      const pendingBuildRun = createToolRun(tool, "used", "Mastery path draft is awaiting teacher confirmation.", inputSummary, { moduleCount: modules.length, writeback: "teacher_confirmation" });
      state.toolRuns.push(pendingBuildRun);
      return { review, toolRun: pendingBuildRun, modelResult: boundedPayload(pendingBuild, tool.maxOutputChars).payload };
    }
    if (tool.name === "search_learning_records") {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? "");
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u53EF\u7528\u5B66\u751F ID\uFF0C\u65E0\u6CD5\u68C0\u7D22\u5B66\u4E60\u8BB0\u5F55\u3002", inputSummary, { count: 0 });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const limit = capLimit(args.limit, router.contextPolicy.recordLimit, router.contextPolicy.recordLimit || 8);
      const records = limit ? await store.listRecords(studentId, { keyword: String(args.keyword ?? ""), limit }) : [];
      state.records = records;
      const outputSummary = { count: records.length, limit, keyword: String(args.keyword ?? "") };
      const toolRun2 = createToolRun(tool, records.length ? "used" : "blocked", records.length ? `\u6309 route \u8BFB\u53D6 ${records.length} \u6761\u5B66\u4E60\u8BB0\u5F55\u3002` : "\u5F53\u524D\u5B66\u751F\u6CA1\u6709\u53EF\u7528\u5B66\u4E60\u8BB0\u5F55\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "learning_records",
        title: "\u5B66\u4E60\u8BB0\u5F55",
        type: "SQLite",
        detail: `\u6309 ${router.route} \u8DEF\u7531\u8BFB\u53D6\uFF0C\u6700\u591A ${limit} \u6761\u3002`,
        count: records.length
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({ ok: records.length > 0, records: summarizeRecords(records), ...outputSummary }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "list_attachment_metadata") {
      const attachmentCount = state.records.reduce((count, record) => count + record.attachments.length, 0);
      const attachmentTypes = /* @__PURE__ */ new Map();
      for (const record of state.records) {
        for (const attachment of record.attachments) {
          attachmentTypes.set(attachment.fileType, (attachmentTypes.get(attachment.fileType) ?? 0) + 1);
        }
      }
      const outputSummary = {
        count: attachmentCount,
        types: Object.fromEntries(attachmentTypes),
        rawFilesUploaded: false
      };
      const toolRun2 = createToolRun(tool, "used", `\u7EDF\u8BA1 ${attachmentCount} \u4E2A\u9644\u4EF6\uFF1B\u539F\u59CB\u6587\u4EF6\u4E0D\u4E0A\u4E91\u3002`, inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "attachment_metadata",
        title: "\u9644\u4EF6\u5143\u6570\u636E",
        type: "\u672C\u5730\u6587\u4EF6\u7CFB\u7EDF",
        detail: "\u53EA\u7EB3\u5165\u6570\u91CF\u548C\u5143\u6570\u636E\uFF0C\u4E0D\u8BFB\u53D6\u6216\u4E0A\u4F20\u539F\u59CB\u9644\u4EF6\u3002",
        count: attachmentCount
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "explore_attached_sources") {
      const requestedStudentId = String(args.studentId ?? "").trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u8BF7\u6C42\u7684\u5B66\u751F\u4E0E\u672C\u8F6E\u7ED1\u5B9A\u5B66\u751F\u4E0D\u4E00\u81F4\uFF0C\u62D2\u7EDD\u63A2\u7D22\u9644\u4EF6\u6765\u6E90\u3002", inputSummary, { reason: "student_scope_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_scope_mismatch" } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u7ED1\u5B9A\u5B66\u751F\uFF0C\u65E0\u6CD5\u786E\u5B9A\u9644\u4EF6\u6765\u6E90\u8FB9\u754C\u3002", inputSummary, { reason: "missing_student_id" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const student = (await store.listStudents("")).find((item) => item.id === studentId);
      if (!student) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5B66\u751F\u4E0D\u5B58\u5728\uFF0C\u62D2\u7EDD\u63A2\u7D22\u9644\u4EF6\u6765\u6E90\u3002", inputSummary, { reason: "student_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "student_not_found" } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      const attached = /* @__PURE__ */ new Map();
      for (const record of records) {
        for (const attachment of record.attachments) {
          attached.set(attachment.id, { recordId: record.id, fileName: attachment.fileName, fileType: attachment.fileType });
        }
      }
      const requestedIds = Array.isArray(args.attachmentIds) ? args.attachmentIds.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [];
      const selectedIds = requestedIds.length ? requestedIds.filter((id) => attached.has(id)) : [...attached.keys()];
      if (requestedIds.some((id) => !attached.has(id))) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u9644\u4EF6\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5B66\u751F\u5DF2\u6388\u6743\u8BB0\u5F55\u3002", inputSummary, { reason: "attachment_scope_mismatch" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "attachment_scope_mismatch" } };
      }
      if (!selectedIds.length) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5F53\u524D\u6CA1\u6709\u53EF\u63A2\u7D22\u7684\u9644\u4EF6\u6765\u6E90\uFF1B\u4E0D\u4F1A\u8BFB\u53D6\u4EFB\u610F\u672C\u5730\u8DEF\u5F84\u3002", inputSummary, { reason: "no_attached_sources" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "no_attached_sources" } };
      }
      const analyses = await store.listMistakeImageAnalyses(studentId);
      const analysisByAttachment = new Map(analyses.filter((analysis) => analysis.attachmentId).map((analysis) => [analysis.attachmentId, analysis]));
      const query = String(args.query ?? "").trim().slice(0, 800);
      const normalizedQuery = query.toLocaleLowerCase();
      const terms = normalizedQuery.split(/\s+/u).filter((term) => term.length > 1).slice(0, 12);
      const limitRaw = Number(args.limit ?? 5);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5, Math.trunc(limitRaw))) : 5;
      const candidates = selectedIds.map((attachmentId) => {
        const metadata = attached.get(attachmentId);
        const analysis = analysisByAttachment.get(attachmentId);
        const text2 = String(analysis?.sanitizedText ?? "").replace(/\s+/gu, " ").trim().slice(0, 12e3);
        const lowerText = text2.toLocaleLowerCase();
        const score = !normalizedQuery ? text2 ? 1 : 0 : normalizedQuery && lowerText.includes(normalizedQuery) ? 3 : terms.filter((term) => lowerText.includes(term)).length;
        const matchIndex = normalizedQuery ? lowerText.indexOf(normalizedQuery) : 0;
        const start = matchIndex > 80 ? matchIndex - 80 : 0;
        const snippet = text2 ? text2.slice(start, start + 600) : "";
        return {
          sourceHandle: `attachment:${attachmentId}`,
          attachmentId,
          recordId: metadata.recordId,
          fileName: metadata.fileName,
          fileType: metadata.fileType,
          analysisId: analysis?.id ?? null,
          ocrStatus: analysis?.ocrStatus ?? "needs_ocr",
          score,
          snippet,
          readable: Boolean(text2)
        };
      }).sort((left, right) => right.score - left.score || left.attachmentId.localeCompare(right.attachmentId));
      const sources = candidates.filter((item) => item.score > 0 || !normalizedQuery).slice(0, limit);
      const unreadableCount = candidates.filter((item) => !item.readable).length;
      const outputSummary = {
        ok: sources.length > 0,
        schemaVersion: "omni.attached.sources.exploration.v1",
        studentId,
        query,
        sources,
        sourceCount: sources.length,
        authorizedSourceCount: selectedIds.length,
        unreadableCount,
        sourceHandlesOnly: true,
        rawFilesIncluded: false,
        localPathsIncluded: false,
        requiresTeacherReview: true,
        unknowns: unreadableCount ? [`${unreadableCount} \u4E2A\u9644\u4EF6\u6CA1\u6709\u53EF\u7528\u8131\u654F OCR \u6587\u672C\uFF0C\u672A\u8BFB\u53D6\u539F\u59CB\u6587\u4EF6\u3002`] : []
      };
      const toolRun2 = createToolRun(tool, sources.length ? "used" : "blocked", sources.length ? `\u5DF2\u6309\u67E5\u8BE2\u63A2\u7D22 ${sources.length} \u4E2A\u8131\u654F\u9644\u4EF6\u7247\u6BB5\uFF1B\u672A\u8BFB\u53D6\u539F\u59CB\u6587\u4EF6\u3002` : "\u5DF2\u68C0\u67E5\u6388\u6743\u9644\u4EF6\uFF0C\u4F46\u6CA1\u6709\u5339\u914D\u7684\u8131\u654F OCR \u7247\u6BB5\u3002", inputSummary, {
        sourceCount: sources.length,
        authorizedSourceCount: selectedIds.length,
        unreadableCount,
        rawFilesIncluded: false
      });
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "attached_source_exploration",
        title: `${student.displayName} \u9644\u4EF6\u6765\u6E90\u63A2\u7D22`,
        type: "SQLite sanitized OCR source handles",
        detail: "\u53EA\u8BFB\u53D6\u5F53\u524D\u5B66\u751F\u6388\u6743\u9644\u4EF6\u7684\u8131\u654F\u7247\u6BB5\uFF1B\u4E0D\u8FD4\u56DE\u539F\u59CB\u8DEF\u5F84\uFF0C\u4E0D\u628A\u5168\u6587\u6CE8\u5165\u4E0A\u4E0B\u6587\u3002",
        count: sources.length
      });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }
    if (tool.name === "analyze_geometry_figure") {
      const studentId = String(state.resolvedStudentId ?? "").trim();
      if (!studentId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6CA1\u6709\u7ED1\u5B9A\u5B66\u751F\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u9519\u9898\u56FE\u7247\u5206\u6790\u3002", inputSummary, { reason: "missing_student_id" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "missing_student_id" } };
      }
      const analyses = await store.listMistakeImageAnalyses(studentId);
      const requestedId = String(args.analysisId ?? "").trim();
      const analysis = requestedId ? analyses.find((item) => item.id === requestedId) : analyses[0];
      if (requestedId && !analysis) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u7684\u9519\u9898\u56FE\u7247\u5206\u6790\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5B66\u751F\u3002", inputSummary, { reason: "analysis_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "analysis_not_found" } };
      }
      const draft = buildVisionSolverDraft({
        analysis,
        questionText: String(args.questionText ?? "").trim() || analysis?.sanitizedText || prompt,
        commands: args.commands,
        constraints: args.constraints,
        geometricRelations: args.geometricRelations
      });
      const outputSummary = {
        status: draft.status,
        hasImage: draft.hasImage,
        analysisId: draft.analysisId,
        validCommandCount: draft.commands.filter((item) => item.valid).length,
        rejectedCommandCount: draft.commands.filter((item) => !item.valid).length,
        originalImageUploaded: false,
        requiresTeacherReview: true
      };
      const toolRun2 = createToolRun(tool, "used", draft.status === "ready" ? "\u5DF2\u751F\u6210\u7ECF\u767D\u540D\u5355\u6821\u9A8C\u7684 GeoGebra \u8349\u7A3F\uFF1B\u539F\u56FE\u672A\u4E0A\u4F20\uFF0C\u9700\u8001\u5E08\u9884\u89C8\u3002" : draft.status === "no_image" ? "\u5F53\u524D\u6CA1\u6709\u672C\u5730\u9519\u9898\u56FE\u7247\uFF0C\u89C6\u89C9\u6C42\u89E3\u6B63\u5E38\u7ED3\u675F\u3002" : "\u5DF2\u8BFB\u53D6\u672C\u5730\u56FE\u7247\u5143\u6570\u636E\uFF0C\u4F46\u6CA1\u6709\u53EF\u6267\u884C\u547D\u4EE4\uFF1B\u9700\u5148\u5B8C\u6210\u8131\u654F OCR \u6216\u6559\u5E08\u4FEE\u6B63\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "vision_solver",
        title: "DeepTutor Vision Solver / GeoGebra \u8349\u7A3F",
        type: "\u672C\u5730\u9519\u9898\u56FE\u7247\u5206\u6790",
        detail: `\u72B6\u6001 ${draft.status}\uFF1B\u539F\u56FE\u672A\u4E0A\u4F20\uFF1B\u547D\u4EE4\u9700\u8001\u5E08\u9884\u89C8\u3002`,
        count: draft.commands.filter((item) => item.valid).length
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({ ok: true, draft, previewMarkdown: buildVisionSolverMarkdown(draft), rawImageIncluded: false }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "analyze_notebook_context") {
      const requestedNotebookId = String(args.notebookId ?? "").trim();
      const requestedRecordId = String(args.recordId ?? "").trim();
      const mode = args.mode === "record_summary" ? "record_summary" : "context";
      const requestedQuery = String(args.query ?? prompt).trim();
      const notebooks = await store.listTeacherNotebooks(false);
      const scopedNotebooks = requestedNotebookId ? notebooks.filter((notebook) => notebook.id === requestedNotebookId) : notebooks;
      if (requestedNotebookId && scopedNotebooks.length === 0) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u7684\u5907\u8BFE\u672C\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "notebook_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "notebook_not_found" } };
      }
      const recordGroups = await Promise.all(scopedNotebooks.map(async (notebook) => ({
        notebook,
        records: await store.listTeacherNotebookRecords(notebook.id, false)
      })));
      if (mode === "record_summary" && requestedRecordId && !recordGroups.some(({ records }) => records.some((record) => record.id === requestedRecordId))) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u7684\u5907\u8BFE\u672C\u8BB0\u5F55\u4E0D\u5B58\u5728\u3001\u5DF2\u5220\u9664\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u53EF\u89C1\u8303\u56F4\u3002", inputSummary, { reason: "record_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "record_not_found" } };
      }
      const analysis = await buildNotebookAnalysis({
        notebooks: scopedNotebooks,
        records: recordGroups,
        query: requestedQuery,
        mode,
        recordId: requestedRecordId || void 0,
        sanitize: async (text2) => {
          const sanitized = await store.sanitizeProblemText(text2);
          return { sanitizedText: sanitized.sanitizedText, redactions: sanitized.redactions };
        }
      });
      const outputSummary = {
        mode: analysis.mode,
        catalogCount: analysis.coverage.catalogCount,
        selectedCount: analysis.coverage.selectedCount,
        detailCount: analysis.coverage.detailCount,
        omittedCount: analysis.coverage.omittedCount,
        requiresTeacherReview: Boolean(analysis.summaryDraft),
        rawNotebookFilesUploaded: false
      };
      const toolRun2 = createToolRun(tool, analysis.coverage.catalogCount ? "used" : "blocked", analysis.coverage.catalogCount ? `\u5DF2\u6309\u9700\u626B\u63CF ${analysis.coverage.catalogCount} \u6761\u5907\u8BFE\u672C\u76EE\u5F55\uFF0C\u8BFB\u53D6 ${analysis.coverage.detailCount} \u6761\u6709\u9650\u7EC6\u8282\u3002` : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u5907\u8BFE\u672C\u8BB0\u5F55\uFF0C\u672A\u8BFB\u53D6\u4EFB\u4F55\u7B14\u8BB0\u6B63\u6587\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "teacher_notebook",
        title: "\u6559\u5E08\u5907\u8BFE\u672C\uFF08DeepTutor Notebook Analysis/Summarize\uFF09",
        type: "SQLite / \u672C\u5730\u5907\u8BFE\u672C",
        detail: analysis.coverage.catalogCount ? "\u4EC5\u6309\u67E5\u8BE2\u9009\u62E9\u6709\u9650\u8BB0\u5F55\u7EC6\u8282\uFF1B\u539F\u59CB\u7B14\u8BB0\u6587\u4EF6\u4E0D\u4E0A\u4F20\uFF0C\u6458\u8981\u8349\u7A3F\u9700\u8001\u5E08\u590D\u6838\u3002" : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u5907\u8BFE\u672C\u8BB0\u5F55\u3002",
        count: analysis.coverage.catalogCount
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({ ok: analysis.coverage.catalogCount > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "search_question_notebook") {
      const sanitizeQuery = await store.sanitizeProblemText(String(args.query ?? prompt));
      const sourceKind = args.sourceKind === "local_bank" || args.sourceKind === "teacher_resource" || args.sourceKind === "generated" ? args.sourceKind : void 0;
      const filters = {
        query: sanitizeQuery.sanitizedText,
        categoryId: String(args.categoryId ?? "").trim() || void 0,
        bookmarked: typeof args.bookmarked === "boolean" ? args.bookmarked : void 0,
        sourceKind,
        limit: capLimit(args.limit, 20, 20),
        offset: Math.max(0, Math.min(Math.trunc(Number(args.offset ?? 0) || 0), 1e4))
      };
      const result = await store.listQuestionNotebook(filters);
      const analysis = await buildQuestionNotebookAnalysis({
        result,
        filters,
        sanitize: async (text2) => {
          const sanitized = await store.sanitizeProblemText(text2);
          return { sanitizedText: sanitized.sanitizedText };
        }
      });
      const notebookInputSummary = { ...inputSummary, args: { ...inputSummary.args, query: filters.query } };
      const outputSummary = {
        total: analysis.coverage.total,
        selected: analysis.coverage.selected,
        hasMore: analysis.coverage.hasMore,
        rawQuestionFilesUploaded: false
      };
      const toolRun2 = createToolRun(tool, result.total ? "used" : "blocked", result.total ? `\u4ECE\u73B0\u6709\u9898\u5E93 Question Notebook \u7D22\u5F15\u547D\u4E2D ${result.total} \u9053\u9898\u76EE\u3002` : "\u9898\u76EE\u6536\u85CF/\u5206\u7C7B\u7D22\u5F15\u6CA1\u6709\u547D\u4E2D\u9898\u76EE\u3002", notebookInputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "question_notebook",
        title: "Question Notebook \u9898\u76EE\u6536\u85CF\u4E0E\u5206\u7C7B",
        type: "SQLite / question_bank overlay",
        detail: result.total ? "\u5DF2\u4ECE\u73B0\u6709 canonical \u9898\u5E93\u8BFB\u53D6\u6536\u85CF\u3001\u5206\u7C7B\u548C\u5386\u53F2\u5F15\u7528\u7D22\u5F15\uFF1B\u6CA1\u6709\u590D\u5236\u9898\u76EE\u6B63\u6587\u3002" : "\u5F53\u524D\u6CA1\u6709\u547D\u4E2D\u9898\u76EE\u6536\u85CF/\u5206\u7C7B\u7D22\u5F15\u3002",
        count: result.total
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({ ok: result.total > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "inspect_teaching_book") {
      const query = String(args.query ?? "").trim().slice(0, 240);
      const requestedBookId = String(args.bookId ?? "").trim().slice(0, 160);
      let detail = requestedBookId ? await store.getTeachingBook(requestedBookId) : void 0;
      if (!detail && !requestedBookId) {
        const books = await store.listTeachingBooks(false);
        const match = books.find((book) => !query || `${book.title} ${book.description}`.toLowerCase().includes(query.toLowerCase())) ?? books[0];
        if (match) detail = await store.getTeachingBook(match.id);
      }
      const inspection = buildTeachingBookInspection(detail, query);
      const outputSummary = { ok: inspection.ok, status: inspection.health?.status ?? "not_found", chapterCount: inspection.coverage?.chapterCount ?? 0, pageCount: inspection.coverage?.pageCount ?? 0, blockCount: inspection.coverage?.blockCount ?? 0, stalePageCount: inspection.health?.stalePageIds?.length ?? 0, missingSourceCount: inspection.health?.missingSourceRefs?.length ?? 0 };
      const toolRun2 = createToolRun(tool, inspection.ok ? "used" : "blocked", inspection.ok ? `\u5DF2\u8BFB\u53D6\u8BB2\u4E49\u76EE\u5F55\u3001${outputSummary.pageCount} \u4E2A\u9875\u9762\u53CA\u6765\u6E90\u5065\u5EB7\u72B6\u6001 ${outputSummary.status}\u3002` : "\u6CA1\u6709\u627E\u5230\u53EF\u8BFB\u53D6\u7684\u4E13\u9898\u8BB2\u4E49\u3002", { ...inputSummary, args: { bookId: requestedBookId, query } }, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: detail?.book.id ?? "teaching_book", title: "\u4E13\u9898\u8BB2\u4E49 / \u5355\u5143\u5907\u8BFE\u5305", type: "SQLite / DeepTutor Book Workspace adapter", detail: inspection.ok ? "\u5DF2\u8BFB\u53D6\u7ED3\u6784\u5316\u7AE0\u8282\u3001\u9875\u9762\u3001\u5185\u5BB9\u5757\u548C\u6765\u6E90\u6307\u7EB9\uFF1B\u672A\u8BFB\u53D6\u5B66\u751F\u6570\u636E\u6216\u539F\u59CB\u6587\u4EF6\u3002" : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u8BB2\u4E49\u3002", count: outputSummary.pageCount });
      return { review, toolRun: toolRun2, modelResult: boundedPayload(inspection, tool.maxOutputChars).payload };
    }
    if (tool.name === "refresh_teaching_book_health") {
      const bookId = String(args.bookId ?? "").trim();
      if (!bookId) {
        const toolRun3 = createToolRun(tool, "blocked", "\u5237\u65B0\u6765\u6E90\u5065\u5EB7\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A bookId\uFF0C\u907F\u514D\u8DE8\u8BB2\u4E49\u5199\u5165\u5931\u6548\u72B6\u6001\u3002", inputSummary, { reason: "book_id_required" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "book_id_required" } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "book_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "book_not_found" } };
      }
      const health = await store.refreshTeachingBookHealth(bookId);
      const invalidations = await store.listTeachingBookInvalidations(bookId);
      const outputSummary = {
        bookId,
        status: health.status,
        sourceCount: health.sourceCount,
        staleSourceCount: health.staleSourceRefs.length,
        missingSourceCount: health.missingSourceRefs.length,
        stalePageCount: health.stalePageIds.length,
        staleBlockCount: health.staleBlockIds.length,
        openInvalidationCount: invalidations.length,
        writesContent: false,
        requiresTeacherReview: health.status !== "healthy"
      };
      const toolRun2 = createToolRun(tool, "used", health.status === "healthy" ? "\u6765\u6E90 fingerprint \u5DF2\u5237\u65B0\uFF0C\u5F53\u524D\u8BB2\u4E49\u5065\u5EB7\uFF1B\u672A\u4FEE\u6539\u6B63\u6587\u3002" : "\u5DF2\u5B9A\u4F4D\u6765\u6E90\u6F02\u79FB/\u7F3A\u5931\u5E76\u5199\u5165\u5C40\u90E8\u5931\u6548\u961F\u5217\uFF1B\u8BF7\u8001\u5E08\u590D\u6838\u540E\u6309\u5757\u6216\u6309\u9875\u91CD\u751F\u6210\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: bookId, title: "\u4E13\u9898\u8BB2\u4E49\u6765\u6E90\u5065\u5EB7", type: "SQLite / fingerprint invalidation queue", detail: "\u4EC5\u66F4\u65B0\u6765\u6E90\u72B6\u6001\u548C\u5C40\u90E8\u5931\u6548\u7D22\u5F15\uFF0C\u4E0D\u4FEE\u6539\u6B63\u6587\u3001\u4E0D\u89E6\u53D1\u6574\u672C\u91CD\u751F\u6210\u3002", count: outputSummary.staleBlockCount + outputSummary.missingSourceCount });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, health, invalidations, writesContent: false, requiresTeacherReview: health.status !== "healthy" }, tool.maxOutputChars).payload };
    }
    if (tool.name === "draft_teaching_book_patch") {
      const bookId = String(args.bookId ?? "").trim();
      const blockId = String(args.blockId ?? "").trim();
      const baseVersion = Number(args.baseVersion);
      if (!bookId || !blockId || !Number.isInteger(baseVersion) || baseVersion < 1) {
        const toolRun2 = createToolRun(tool, "blocked", "\u751F\u6210 patch \u5FC5\u987B\u663E\u5F0F\u6307\u5B9A bookId\u3001blockId \u548C\u6709\u6548 baseVersion\u3002", inputSummary, { reason: "patch_scope_required" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "patch_scope_required" } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun2 = createToolRun(tool, "blocked", "\u6307\u5B9A\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "book_not_found" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "book_not_found" } };
      }
      try {
        const patch = await store.proposeTeachingBookBlockPatch({ bookId, blockId, baseVersion, title: args.title == null ? void 0 : String(args.title), payload: args.payload && typeof args.payload === "object" && !Array.isArray(args.payload) ? args.payload : void 0, reason: args.reason == null ? void 0 : String(args.reason) });
        const outputSummary = { patchId: patch.id, bookId, blockId, baseVersion: patch.baseVersion, status: patch.status, changed: patch.beforeTitle !== patch.afterTitle || JSON.stringify(patch.beforePayload) !== JSON.stringify(patch.afterPayload), writesContent: false, requiresTeacherReview: true };
        const toolRun2 = createToolRun(tool, "used", "\u5DF2\u751F\u6210\u53EF\u5BA1\u9605 patch\uFF1B\u5C1A\u672A\u8986\u76D6\u8BB2\u4E49\u6B63\u6587\uFF0C\u5E94\u7528\u6216\u64A4\u9500\u9700\u6559\u5E08\u786E\u8BA4\u3002", inputSummary, outputSummary);
        state.toolRuns.push(toolRun2);
        addSource(state.sources, { id: bookId, title: "\u4E13\u9898\u8BB2\u4E49 patch \u8349\u7A3F", type: "SQLite / CoWriter patch history", detail: "\u4FDD\u7559 before/after \u4E0E baseVersion\uFF1B\u672A\u5199\u5165\u5185\u5BB9\u5757\u6B63\u6587\u3002", count: 1 });
        return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, patch, ...outputSummary }, tool.maxOutputChars).payload };
      } catch (error) {
        const toolRun2 = createToolRun(tool, "blocked", error instanceof Error ? error.message : "patch \u751F\u6210\u5931\u8D25", inputSummary, { reason: "patch_conflict" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "patch_conflict" } };
      }
    }
    if (tool.name === "draft_teaching_book_selection_patch") {
      const bookId = String(args.bookId ?? "").trim();
      const blockId = String(args.blockId ?? "").trim();
      const baseVersion = Number(args.baseVersion);
      const selectionStart = Number(args.selectionStart);
      const selectionEnd = Number(args.selectionEnd);
      const selectedText = String(args.selectedText ?? "");
      const replacementText = String(args.replacementText ?? "");
      if (!bookId || !blockId || !Number.isInteger(baseVersion) || baseVersion < 1 || !Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) || selectionStart < 0 || selectionEnd <= selectionStart || !selectedText || !replacementText) {
        const toolRun2 = createToolRun(tool, "blocked", "\u9009\u533A patch \u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u8BB2\u4E49\u3001\u5185\u5BB9\u5757\u3001\u7248\u672C\u3001\u9009\u533A\u8FB9\u754C\u3001\u539F\u6587\u548C\u5019\u9009\u66FF\u6362\u6587\u672C\u3002", inputSummary, { reason: "selection_scope_required" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "selection_scope_required" } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun2 = createToolRun(tool, "blocked", "\u6307\u5B9A\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "book_not_found" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "book_not_found" } };
      }
      try {
        const patch = await store.proposeTeachingBookSelectionPatch({ bookId, blockId, baseVersion, selectionStart, selectionEnd, selectedText, replacementText, mode: args.mode === "automark" ? "automark" : "react_edit", reason: args.reason == null ? void 0 : String(args.reason) });
        const chunks = replacementText.match(/.{1,80}/gu) ?? [replacementText];
        const streamEvents = [
          { type: "draft_started", mode: patch.operation === "automark_selection" ? "automark" : "react_edit", selectionStart, selectionEnd },
          ...chunks.map((content) => ({ type: "draft_delta", content })),
          { type: "draft_ready", chars: replacementText.length }
        ];
        const outputSummary = { patchId: patch.id, operation: patch.operation, selectionStart, selectionEnd, selectedTextHash: patch.selectedTextHash, status: patch.status, streamEventCount: streamEvents.length, writesContent: false, requiresTeacherReview: true };
        const toolRun2 = createToolRun(tool, "used", "\u5DF2\u751F\u6210\u9009\u533A\u7F16\u8F91\u8349\u7A3F\u548C\u6D41\u5F0F\u4E8B\u4EF6\uFF1B\u5C1A\u672A\u8986\u76D6\u8BB2\u4E49\u6B63\u6587\uFF0C\u5E94\u7528\u9700\u6559\u5E08\u786E\u8BA4\u5E76\u518D\u6B21\u6821\u9A8C\u7248\u672C/\u9009\u533A\u6307\u7EB9\u3002", inputSummary, outputSummary);
        state.toolRuns.push(toolRun2);
        addSource(state.sources, { id: bookId, title: "\u4E13\u9898\u8BB2\u4E49\u9009\u533A CoWriter \u8349\u7A3F", type: "SQLite / bounded selection patch", detail: "\u590D\u7528 react-edit/automark \u7684\u9009\u533A\u8BED\u4E49\uFF1B\u4FDD\u5B58 before/after\u3001\u7406\u7531\u3001\u9009\u533A\u54C8\u5E0C\u548C\u8349\u7A3F\u4E8B\u4EF6\u3002", count: 1 });
        return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, patch, streamEvents, ...outputSummary }, tool.maxOutputChars).payload };
      } catch (error) {
        const toolRun2 = createToolRun(tool, "blocked", error instanceof Error ? error.message : "\u9009\u533A patch \u751F\u6210\u5931\u8D25", inputSummary, { reason: "selection_drift_or_conflict" });
        state.toolRuns.push(toolRun2);
        return { review, toolRun: toolRun2, modelResult: { ok: false, reason: "selection_drift_or_conflict" } };
      }
    }
    if (tool.name === "draft_teaching_book_markdown") {
      const bookId = String(args.bookId ?? "").trim();
      const detail = bookId ? await store.getTeachingBook(bookId) : void 0;
      if (!detail) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "book_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "book_not_found" } };
      }
      const rendered = renderTeachingBookMarkdown(detail);
      const outputSummary = { bookId, blockCount: rendered.blockCount, fallbackCount: rendered.fallbackCount, sourceRefCount: rendered.sourceRefs.length, markdownChars: rendered.markdown.length, requiresTeacherReview: true, writesFile: false };
      const toolRun2 = createToolRun(tool, "used", rendered.fallbackCount ? `\u5DF2\u751F\u6210 Markdown \u9884\u89C8\uFF0C${rendered.fallbackCount} \u4E2A\u5757\u4F7F\u7528\u517C\u5BB9 fallback\uFF1B\u5BFC\u51FA\u524D\u9700\u8001\u5E08\u590D\u6838\u3002` : "\u5DF2\u751F\u6210 Markdown \u9884\u89C8\uFF1B\u672A\u5199\u5165\u6587\u4EF6\uFF0C\u9700\u8001\u5E08\u786E\u8BA4\u540E\u5BFC\u51FA\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: bookId, title: "\u4E13\u9898\u8BB2\u4E49 Markdown \u9884\u89C8", type: "SQLite / local draft compiler", detail: "\u4EC5\u7F16\u8BD1\u5DF2\u4FDD\u5B58\u7684 block payload\uFF1B\u5BFC\u51FA\u548C\u53D1\u5E03\u4ECD\u9700\u6559\u5E08\u786E\u8BA4\u3002", count: rendered.blockCount });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, analysis: rendered, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "plan_teaching_book") {
      const bookId = String(args.bookId ?? "").trim();
      const detail = bookId ? await store.getTeachingBook(bookId) : void 0;
      if (!detail) {
        const toolRun3 = createToolRun(tool, "blocked", "\u6307\u5B9A\u8BB2\u4E49\u4E0D\u5B58\u5728\u3001\u5DF2\u5F52\u6863\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u672C\u5730\u5DE5\u4F5C\u533A\u3002", inputSummary, { reason: "book_not_found" });
        state.toolRuns.push(toolRun3);
        return { review, toolRun: toolRun3, modelResult: { ok: false, reason: "book_not_found" } };
      }
      const querySanitized = await store.sanitizeProblemText(String(args.query ?? detail.book.title));
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit || 6, 6);
      const chunks = await store.searchKnowledge(querySanitized.sanitizedText, limit);
      const plan = buildTeachingBookPlan(detail, chunks, querySanitized.sanitizedText);
      const outputSummary = { bookId, sourceChunks: chunks.length, proposedChapters: plan.coverage.proposedChapters, selectedSources: plan.coverage.selectedSources, requiresTeacherReview: true, writesBook: false };
      const toolRun2 = createToolRun(tool, "used", chunks.length ? `\u5DF2\u63A2\u7D22 ${chunks.length} \u6761\u672C\u5730\u77E5\u8BC6\u7247\u6BB5\uFF0C\u751F\u6210 ${plan.coverage.proposedChapters} \u4E2A\u7AE0\u8282\u5019\u9009\uFF1B\u7B49\u5F85\u8001\u5E08\u786E\u8BA4\u3002` : "\u6CA1\u6709\u547D\u4E2D\u77E5\u8BC6\u7247\u6BB5\uFF0C\u5DF2\u4F7F\u7528\u5B89\u5168\u7AE0\u8282\u6A21\u677F\u751F\u6210\u8349\u6848\uFF1B\u7B49\u5F85\u8001\u5E08\u8865\u5145\u6765\u6E90\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: bookId, title: "\u8BB2\u4E49\u7AE0\u8282\u89C4\u5212 / \u6765\u6E90\u63A2\u7D22", type: "SQLite / bounded knowledge chunks", detail: "\u53EA\u8BFB\u53D6\u77E5\u8BC6\u7247\u6BB5\u4E3B\u9898\u548C\u6765\u6E90\u5143\u6570\u636E\uFF0C\u4E0D\u5199\u5165 book/chapter/page\u3002", count: chunks.length });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: true, analysis: plan, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "generate_research_outline") {
      const querySanitized = await store.sanitizeProblemText(String(args.query ?? prompt));
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit || 6, 6);
      const chunks = await store.searchKnowledge(querySanitized.sanitizedText, limit);
      const analysis = buildResearchOutline(querySanitized.sanitizedText, chunks, limit);
      const outputSummary = {
        sourceCount: analysis.sourceRefs.length,
        outlineCount: analysis.outline.length,
        unknownCount: analysis.unknowns.length,
        evidenceBoundary: analysis.evidenceBoundary,
        requiresTeacherReview: true,
        writesFile: false
      };
      const toolRun2 = createToolRun(tool, analysis.sourceRefs.length ? "used" : "blocked", analysis.sourceRefs.length ? "\u5DF2\u57FA\u4E8E\u672C\u5730\u6559\u5E08\u77E5\u8BC6\u5207\u7247\u751F\u6210\u7814\u7A76\u63D0\u7EB2\u8349\u6848\uFF0C\u672A\u8054\u7F51\u3001\u672A\u5199\u6587\u4EF6\u3002" : "\u672C\u5730\u6559\u5E08\u77E5\u8BC6\u5E93\u6CA1\u6709\u547D\u4E2D\uFF0C\u5DF2\u8FD4\u56DE\u660E\u786E\u672A\u77E5\u9879\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: "research_outline", title: "\u672C\u5730\u7814\u7A76\u63D0\u7EB2\u8349\u6848", type: "SQLite / teacher knowledge", detail: "\u4EC5\u4F7F\u7528\u8131\u654F\u540E\u7684\u672C\u5730\u77E5\u8BC6\u5207\u7247\uFF1B\u6765\u6E90\u3001\u672A\u77E5\u9879\u548C\u6559\u5E08\u590D\u6838\u8FB9\u754C\u968F\u7ED3\u679C\u8FD4\u56DE\u3002", count: analysis.sourceRefs.length });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: analysis.sourceRefs.length > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "render_learning_mermaid") {
      const overview = await store.getKnowledgeOverview();
      const limit = capLimit(args.limit, router.contextPolicy.graphNodeLimit || 12, 12);
      const analysis = buildMermaidVisualization(String(args.title ?? prompt), overview.nodes, overview.edges, limit);
      state.graphNodes = overview.nodes.slice(0, limit);
      const outputSummary = {
        nodeCount: analysis.nodeCount,
        edgeCount: analysis.edgeCount,
        safe: true,
        requiresTeacherReview: true,
        writesFile: false
      };
      const toolRun2 = createToolRun(tool, analysis.nodeCount ? "used" : "blocked", analysis.nodeCount ? "\u5DF2\u751F\u6210\u53D7\u9650 Mermaid \u5173\u7CFB\u56FE\uFF1B\u8F93\u51FA\u4E0D\u6267\u884C\u811A\u672C\u3001\u4E0D\u52A0\u8F7D\u5916\u94FE\u3002" : "\u77E5\u8BC6\u56FE\u8C31\u6682\u65E0\u53EF\u89C6\u5316\u8282\u70B9\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, { id: "learning_visualization", title: "\u5B66\u4E60\u77E5\u8BC6\u5173\u7CFB\u56FE", type: "SQLite / knowledge graph", detail: "\u8282\u70B9\u548C\u8FB9\u4EC5\u4F5C\u4E3A\u672C\u5730\u56FE\u8C31\u80CC\u666F\uFF0C\u56FE\u8868\u9700\u6559\u5E08\u590D\u6838\u540E\u518D\u5C55\u793A\u6216\u5BFC\u51FA\u3002", count: analysis.nodeCount });
      return { review, toolRun: toolRun2, modelResult: boundedPayload({ ok: analysis.nodeCount > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload };
    }
    if (tool.name === "search_teacher_knowledge") {
      const query = String(args.query ?? prompt);
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit, router.contextPolicy.knowledgeLimit || 6);
      const snippets = limit ? await store.searchKnowledge(query, limit) : [];
      state.knowledgeSnippets = snippets;
      const outputSummary = {
        count: snippets.length,
        limit,
        query,
        directEvidence: snippets.filter((chunk) => chunk.evidenceStrength === "direct").length,
        indirectEvidence: snippets.filter((chunk) => chunk.evidenceStrength === "indirect").length,
        backgroundOnly: snippets.filter((chunk) => chunk.evidenceStrength === "background").length,
        personalDataHidden: snippets.filter((chunk) => chunk.containsPersonalData).length
      };
      const toolRun2 = createToolRun(tool, snippets.length ? "used" : "blocked", snippets.length ? `\u547D\u4E2D ${snippets.length} \u4E2A\u8001\u5E08\u77E5\u8BC6\u5E93\u7247\u6BB5\u3002` : "\u6CA1\u6709\u547D\u4E2D\u53EF\u7528\u8001\u5E08\u77E5\u8BC6\u5E93\u7247\u6BB5\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "teacher_knowledge",
        title: "\u8001\u5E08\u77E5\u8BC6\u5E93",
        type: "SQLite / \u672C\u5730\u5207\u7247",
        detail: snippets.length ? "\u5DF2\u7EB3\u5165\u547D\u4E2D\u7684\u8001\u5E08\u77E5\u8BC6\u5E93\u7247\u6BB5\uFF1B\u542B\u4E2A\u4EBA\u4FE1\u606F\u7247\u6BB5\u53EA\u8FD4\u56DE\u5143\u6570\u636E\uFF0C\u4E0D\u8FD4\u56DE\u6B63\u6587\u9884\u89C8\u3002" : "\u5F53\u524D\u6CA1\u6709\u547D\u4E2D\u53EF\u7528\u77E5\u8BC6\u5E93\u6587\u672C\u7247\u6BB5\u3002",
        count: snippets.length
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({
          ok: snippets.length > 0,
          snippets: snippets.map((chunk) => ({
            id: chunk.id,
            resourceId: chunk.resourceId,
            resourceTitle: chunk.resourceTitle,
            heading: chunk.heading,
            subject: chunk.subject,
            grade: chunk.grade,
            knowledgePoint: chunk.knowledgePoint,
            questionType: chunk.questionType,
            difficulty: chunk.difficulty,
            sourceTrust: chunk.sourceTrust,
            evidenceStrength: chunk.evidenceStrength,
            qualityScore: chunk.qualityScore,
            containsPersonalData: chunk.containsPersonalData,
            contentPreview: chunk.containsPersonalData ? "[\u542B\u4E2A\u4EBA\u4FE1\u606F\uFF0C\u6B63\u6587\u9884\u89C8\u5DF2\u9690\u85CF]" : chunk.contentMd.slice(0, 800)
          })),
          ...outputSummary
        }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "query_knowledge_graph") {
      const overview = await store.getKnowledgeOverview();
      const limit = capLimit(args.limit, router.contextPolicy.graphNodeLimit, router.contextPolicy.graphNodeLimit || 8);
      const graphNodes = overview.nodes.slice(0, limit);
      state.graphNodes = graphNodes;
      const graphEdges = overview.edges.filter((edge) => graphNodes.some((node) => node.id === edge.sourceNodeId || node.id === edge.targetNodeId)).slice(0, Math.max(0, limit * 2));
      const outputSummary = {
        selectedNodes: graphNodes.length,
        selectedEdges: graphEdges.length,
        totalNodes: overview.counts.nodes,
        totalEdges: overview.counts.edges,
        graphEvidenceBoundary: "graph_nodes_are_background_not_direct_text_evidence"
      };
      const toolRun2 = createToolRun(tool, graphNodes.length ? "used" : "blocked", graphNodes.length ? `\u8BFB\u53D6 ${graphNodes.length} \u4E2A\u77E5\u8BC6\u56FE\u8C31\u8282\u70B9\u6458\u8981\u3002` : "\u77E5\u8BC6\u56FE\u8C31\u6682\u65E0\u8282\u70B9\u3002", inputSummary, outputSummary);
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "knowledge_graph",
        title: "\u77E5\u8BC6\u56FE\u8C31",
        type: "SQLite nodes / edges",
        detail: graphNodes.length ? "\u5DF2\u7EB3\u5165\u77E5\u8BC6\u56FE\u8C31\u8282\u70B9/\u8FB9\u6458\u8981\uFF1B\u56FE\u8C31\u53EA\u4F5C\u4E3A\u5173\u7CFB\u80CC\u666F\uFF0C\u4E0D\u80FD\u5192\u5145\u6B63\u6587\u76F4\u63A5\u8BC1\u636E\u3002" : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u56FE\u8C31\u8282\u70B9\u3002",
        count: `${overview.counts.nodes} \u8282\u70B9 / ${overview.counts.edges} \u8FB9`
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({
          ok: graphNodes.length > 0,
          nodes: graphNodes.map((node) => ({
            id: node.id,
            nodeType: node.nodeType,
            name: node.name,
            summary: node.summary,
            sourceKind: node.sourceKind,
            sourceId: node.sourceId,
            confidence: node.confidence,
            evidenceStrength: node.evidenceStrength
          })),
          edges: graphEdges.map((edge) => ({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationType: edge.relationType,
            evidenceSourceId: edge.evidenceSourceId,
            evidenceText: edge.evidenceText,
            confidence: edge.confidence,
            evidenceStrength: edge.evidenceStrength,
            evidenceKind: edge.evidenceKind
          })),
          ...outputSummary
        }, tool.maxOutputChars).payload
      };
    }
    if (tool.name === "search_similar_questions") {
      const limit = capLimit(args.limit, 12, 6);
      const subject = String(args.subject ?? router.slots.subject ?? "");
      const knowledgePoint = String(args.knowledgePoint ?? router.slots.knowledgePoint ?? "");
      const query = String(args.query ?? (knowledgePoint || prompt));
      const matches = await store.searchQuestionBank({
        query,
        subject,
        knowledgePoint,
        limit
      });
      state.similarQuestions = matches;
      const outputSummary = {
        count: matches.length,
        query,
        subject,
        knowledgePoint,
        localBankHits: matches.filter((item) => item.sourceKind === "local_bank").length
      };
      const toolRun2 = createToolRun(
        tool,
        matches.length ? "used" : "blocked",
        matches.length ? `\u4ECE\u672C\u5730\u9898\u5E93\u53EC\u56DE ${matches.length} \u9053\u76F8\u4F3C\u9898\u3002` : "\u672C\u5730\u9898\u5E93\u6CA1\u6709\u547D\u4E2D\u53EF\u7528\u76F8\u4F3C\u9898\u3002",
        inputSummary,
        outputSummary
      );
      state.toolRuns.push(toolRun2);
      addSource(state.sources, {
        id: "question_bank",
        title: "\u672C\u5730\u9898\u5E93",
        type: "SQLite question_bank_items",
        detail: matches.length ? "\u5DF2\u7EB3\u5165\u672C\u5730\u9898\u5E93\u76F8\u4F3C\u9898\u5019\u9009\uFF1B\u751F\u6210\u9898\u4E0D\u5F97\u5192\u5145\u9898\u5E93\u547D\u4E2D\u3002" : "\u5F53\u524D\u9898\u5E93\u6CA1\u6709\u547D\u4E2D\u76F8\u4F3C\u9898\u3002",
        count: matches.length
      });
      return {
        review,
        toolRun: toolRun2,
        modelResult: boundedPayload({
          ok: matches.length > 0,
          matches: matches.map((item) => ({
            id: item.id,
            subject: item.subject,
            grade: item.grade,
            knowledgePoint: item.knowledgePoint,
            questionType: item.questionType,
            difficulty: item.difficulty,
            stem: item.stem,
            answer: item.answer,
            analysis: item.analysis,
            sourceKind: item.sourceKind,
            sourceTitle: item.sourceTitle,
            matchReason: item.matchReason
          })),
          ...outputSummary
        }, tool.maxOutputChars).payload
      };
    }
    const toolRun = createToolRun(tool, "failed", "\u5DE5\u5177\u6267\u884C\u5668\u672A\u5B9E\u73B0\u8BE5\u5DE5\u5177\u3002", inputSummary, { implemented: false });
    state.toolRuns.push(toolRun);
    return { review, toolRun, modelResult: { ok: false, reason: "executor_not_implemented" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u5DE5\u5177\u6267\u884C\u5931\u8D25\u3002";
    const toolRun = createToolRun(safeTool, "failed", message, inputSummary, { error: message });
    state.toolRuns.push(toolRun);
    return { review, toolRun, modelResult: { ok: false, reason: message } };
  }
}

// <stdin>
async function runMemorySynthesisSmoke(dataRoot) {
  const store = new OmniEduStore(dataRoot);
  await store.init();
  try {
    const router = routeAiPrompt("inspect the L3 cross-surface profile memory", { hasStudent: true });
    assert.equal(router.subIntent, "memory_synthesis");
    assert.deepEqual(router.contextPolicy.include, ["memory_synthesis"]);
    assert.ok(router.allowedTools.includes("inspect_memory_synthesis"));
    assert.ok(!router.allowedTools.includes("get_student_profile"));
    const runId = await store.startAiAgentRun({ sessionId: "memory_synthesis_smoke", prompt: "secret", route: "general_qa", subIntent: "memory_summary", model: "smoke" });
    await store.recordAiAgentEvent(runId, { phase: "route", status: "succeeded", label: "route", detail: "hidden", inputSummary: { prompt: "secret" }, outputSummary: { ok: true } });
    await store.completeAiAgentRun(runId, "succeeded");
    const eventId = (await store.listAiAgentEvents(runId))[0].id;
    await store.createAiMemoryEntry({ surface: "chat", section: "Activity", text: "Teacher confirmed a recent algebra review.", refs: ["ai_agent_event:" + eventId], origin: "teacher" });
    const draft = await store.draftAiMemoryL3("profile", 8);
    assert.equal(draft.layer, "L3");
    assert.equal(draft.entries.length, 1);
    assert.equal(draft.entries[0].requiresTeacherReview, true);
    assert.ok(!JSON.stringify(draft).includes("secret"));
    const tool = await executeAiToolCall({ store, prompt: "draft a recent memory synthesis from confirmed L2 entries", router, state: createAiToolExecutionState(router), call: { name: "draft_memory_synthesis", arguments: { slot: "profile", limit: 8 } } });
    assert.equal(tool.toolRun.status, "used");
    assert.equal(tool.modelResult.writesMemory, false);
    assert.equal(await store.getAiMemoryL3Document("profile"), null);
    const entry = await store.createAiMemoryL3Entry({ slot: "profile", text: draft.entries[0].text, sourceDocuments: draft.entries[0].sourceDocuments });
    assert.equal(entry.version, 1);
    const graph = await store.getAiMemoryEvidenceGraph(200);
    assert.ok(graph.nodes.some((node) => node.kind === "l3_entry"));
    assert.ok(graph.edges.some((edge) => edge.kind === "derived_from"));
    assert.equal(graph.rawPromptIncluded, false);
    const inspectedGraph = await executeAiToolCall({ store, prompt: "inspect the L3 cross-surface profile memory", router, state: createAiToolExecutionState(router), call: { name: "inspect_memory_graph", arguments: { limit: 200 } } });
    assert.equal(inspectedGraph.toolRun.status, "used");
    assert.equal(inspectedGraph.modelResult.graph.rawPromptIncluded, false);
    const governance = await store.getAiMemoryGovernanceReport();
    assert.equal(governance.policyVersion, "memory-governance.v1");
    assert.equal(governance.danglingEvidenceRefs, 0);
    assert.equal(governance.writableByAi, false);
    const governanceTool = await executeAiToolCall({ store, prompt: "inspect memory governance", router, state: createAiToolExecutionState(router), call: { name: "inspect_memory_governance", arguments: {} } });
    assert.equal(governanceTool.toolRun.status, "used");
    assert.equal(governanceTool.modelResult.governance.danglingEvidenceRefs, 0);
    const inspected = await executeAiToolCall({ store, prompt: "inspect the L3 cross-surface profile memory", router, state: createAiToolExecutionState(router), call: { name: "inspect_memory_synthesis", arguments: { slot: "profile" } } });
    assert.equal(inspected.toolRun.status, "used");
    assert.equal(inspected.modelResult.detail.entries.length, 1);
    assert.equal(inspected.modelResult.rawPromptIncluded, false);
    await assert.rejects(() => store.updateAiMemoryL3Entry(entry.id, { version: 0, text: "stale" }), /version conflict/);
    const updated = await store.updateAiMemoryL3Entry(entry.id, { version: 1, text: "Teacher revised the cross-surface profile." });
    assert.equal(updated.version, 2);
    return { ok: true, cases: 30, routeAware: true, draftNoWrite: true, evidenceBound: true, graphBound: true, governanceBound: true, optimisticLock: true, noSensitiveLeak: true };
  } finally {
    await store.close();
  }
}
export {
  runMemorySynthesisSmoke
};
