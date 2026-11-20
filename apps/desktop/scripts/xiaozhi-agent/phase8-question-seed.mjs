import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {question, sha256} from './phase8-real-model-plan.mjs';

const expectedActions = ['createQuestionBankItem', 'getArchivedQuestionVersion', 'editArchivedQuestion', 'getArchivedQuestionVersion'];
const expectedAnswer = '重力12 N；静止时漂浮；浸入水中体积1.2 L。';
const expectedAnalysis = '2 L=0.002 m³，质量600×0.002=1.2 kg，重力为12 N。物体漂浮，浸入体积12/(1000×10)=0.0012 m³=1.2 L。';
const digest = /^[a-f0-9]{64}$/;

export function readFrozenQuestionSeed(manifest) {
  const evidencePath = manifest.questionSeedEvidence;
  const stat = fs.lstatSync(evidencePath, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.size > 8192) throw Error('phase8_question_seed_evidence_invalid');

  const bytes = fs.readFileSync(evidencePath);
  let evidence;
  try {evidence = JSON.parse(bytes);} catch {throw Error('phase8_question_seed_evidence_invalid');}
  if (evidence?.schemaVersion !== 1 || evidence.commit !== manifest.versions.A.commit
      || typeof evidence.questionId !== 'string' || !/^question_[a-f0-9-]{36}$/.test(evidence.questionId)
      || evidence.stemSha256 !== sha256(question) || evidence.sourceKind !== 'local_bank' || evidence.modelRequests !== 0
      || !digest.test(evidence.beforeVersion) || !digest.test(evidence.afterVersion) || evidence.beforeVersion === evidence.afterVersion
      || JSON.stringify(evidence.actions) !== JSON.stringify(expectedActions)) {
    throw Error('phase8_question_seed_evidence_invalid');
  }

  for (const {dataSnapshot} of Object.values(manifest.versions)) {
    const filename = path.join(dataSnapshot, 'app.db');
    if (!fs.lstatSync(filename, {throwIfNoEntry: false})?.isFile()
        || ['-wal', '-shm', '-journal'].some(suffix => fs.existsSync(filename + suffix))) {
      throw Error('phase8_question_seed_snapshot_not_closed');
    }
    // A frozen standalone file must never acquire journal sidecars from this verifier.
    const database = new DatabaseSync(pathToFileURL(filename).href + '?mode=ro&immutable=1', {readOnly: true});
    try {
      const row = database.prepare('SELECT stem, source_kind, answer, analysis FROM question_bank_items WHERE id = ?').get(evidence.questionId);
      if (row?.stem !== question || row.source_kind !== evidence.sourceKind || row.answer !== expectedAnswer || row.analysis !== expectedAnalysis) {
        throw Error('phase8_question_seed_snapshot_mismatch');
      }
    } finally {database.close();}
  }
  return {questionId: evidence.questionId, sourceKind: evidence.sourceKind, stemSha256: evidence.stemSha256,
    answerSha256: sha256(expectedAnswer), analysisSha256: sha256(expectedAnalysis), seedVersion: evidence.afterVersion,
    receiptSha256: sha256(bytes)};
}
