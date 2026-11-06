import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import type {KnowledgeImportResult} from '../../shared/contracts';
import {MATERIAL_PASTE_SCHEMA, MATERIAL_PASTE_MAX_QUESTIONS, validMaterialPaste,
  type MaterialPasteInput, type MaterialPasteImport, type MaterialPastePreview} from '../../shared/material-paste';
import {extractMaterialQuestions} from './material-question-extract';

type Host = {
  importKnowledgeResources: (paths: string[], signal: AbortSignal, background: boolean,
    guard?: () => Promise<void>) => Promise<KnowledgeImportResult>;
};

/** Local parser preview only. Temporary source identities never cross IPC or enter storage. */
export function previewPastedMaterial(input: MaterialPasteInput): MaterialPastePreview {
  if (!validMaterialPaste(input)) throw Error('invalid_input');
  const digest = createHash('sha256').update(input.text).digest('hex');
  const resourceId = 'resource_' + randomUUID();
  const extracted = extractMaterialQuestions([{resourceId, version: digest,
    title: '教师粘贴原文', offset: 0, chunk: {id: 'chunk_' + randomUUID(), resourceId,
      resourceTitle: '教师粘贴原文', chunkIndex: 0, heading: '', contentMd: input.text,
      pageNumber: null, subject: '', grade: '', knowledgePoint: '', questionType: '', difficulty: '',
      sourceTrust: 'unverified', containsPersonalData: false, qualityScore: 0,
      evidenceStrength: 'background', embeddingStatus: 'not_indexed', createdAt: ''}}], 'local-text-v1');
  if (!extracted.length) throw Error('no_questions');
  if (extracted.length > MATERIAL_PASTE_MAX_QUESTIONS) throw Error('too_many_questions');
  return {schemaVersion: MATERIAL_PASTE_SCHEMA, digest, questions: extracted.map(question => ({
    number: question.archive.number, fields: question.fields, issues: question.archive.issues,
  }))};
}

/** Explicit import reuses the actual immutable-file importer and its same-name/hash retry identity. */
export async function importPastedMaterial(host: Host, input: MaterialPasteImport,
  signal: AbortSignal, guard: () => Promise<void>): Promise<KnowledgeImportResult> {
  if (!validMaterialPaste(input, true)) throw Error('invalid_input');
  const {expectedDigest, ...previewInput} = input;
  const preview = previewPastedMaterial(previewInput);
  if (preview.digest !== expectedDigest) throw Error('source_changed');
  await guard(); signal.throwIfAborted();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'edudev-paste-'));
  const file = path.join(directory, '粘贴题目.txt');
  try {
    await fs.writeFile(file, input.text, {flag: 'wx', encoding: 'utf8'});
    await guard(); signal.throwIfAborted();
    const result = await host.importKnowledgeResources([file], signal, true, guard);
    return {...result, items: result.items.map(item => ({...item, sourcePath: item.fileName}))};
  } finally {
    await fs.unlink(file).catch(() => undefined);
    await fs.rmdir(directory).catch(() => undefined);
  }
}
