import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import JSZip from 'jszip';
import {fingerprint, sha256} from './evidence.mjs';
import {readClassroomExport} from './classroom-export-readback.mjs';

export const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};
export function originalEvidence(root, original) {
  const tree = fingerprint(root); // File reads only; NEVER open original SQLite.
  const file = path.resolve(root, original.export.path);
  assert(inside(root, file));
  const hash = sha256(fs.readFileSync(file));
  assert.equal(hash, original.export.sha256);
  return {treeSha256: tree.sha256, files: tree.files.length,
    reportSha256: sha256(fs.readFileSync(path.join(root, 'report.json'))), exportSha256: hash};
}
export function copyFixture(source, output) {
  // A byte copy, including WAL/SHM if present. The parent must keep the original
  // closed. No backup API may connect to the original DB; no path rewriting.
  const copy = (from, to) => {
    const stat = fs.lstatSync(from);
    assert(!stat.isSymbolicLink(), 'Fixture copy cannot cross links');
    if (stat.isDirectory()) {
      fs.mkdirSync(to);
      for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name));
    } else {
      assert(stat.isFile(), 'Unsupported fixture entry');
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      assert.equal(fs.lstatSync(to).nlink, 1, 'Copied files must be independent');
    }
  };
  for (const name of ['data', 'profile', 'exports', 'XiaozhiOutputs']) {
    if (fs.existsSync(path.join(source, name))) copy(path.join(source, name), path.join(output, name));
  }
  for (const name of ['data', 'profile']) assert(fs.statSync(path.join(output, name)).isDirectory());
}
export function copiedSql(runRoot, query, values = []) {
  const db = new DatabaseSync(path.join(runRoot, 'data/app.db'), {readOnly: true});
  try {return db.prepare(query).all(...values);} finally {db.close();}
}
export function copiedFacts(runRoot) {
  const sql = (query, values) => copiedSql(runRoot, query, values);
  const digest = rows => sha256(JSON.stringify(rows));
  const tables = sql("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
    .map(row => row.name).filter(name => /^(students?$|student_|learning_records$|mistake_|mastery_|practice_|training_|question_attempt)/.test(name));
  assert(tables.includes('learning_records'));
  const studentFacts = tables.map(name => {
    const rows = sql(`SELECT * FROM "${name.replaceAll('"', '""')}"`).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return {table: name, rows: rows.length, sha256: digest(rows)};
  });
  const runs = sql('SELECT * FROM ai_agent_runs ORDER BY id');
  assert(!runs.some(row => ['running', 'queued', 'inProgress'].includes(row.status)), 'Original fixture must have no active run to resume');
  return {runs: runs.length, runLedgerSha256: digest(runs), studentFacts,
    classroomLedgerSha256: digest(sql("SELECT id,session_id,status,payload_json,result_json FROM ai_confirmation_items WHERE action_type IN ('pi_classroom_plan','pi_classroom_candidate') ORDER BY id")),
    officeReceiptsSha256: digest(sql('SELECT id,conversation_id,state,artifact_id,relative_path,result_path,output_hash,workspace_hash,draft_json FROM xiaozhi_pi_office_drafts ORDER BY id'))};
}
export function copiedBinding(runRoot) {
  const sql = (query, values) => copiedSql(runRoot, query, values);
  const plans = sql("SELECT id,session_id,status,payload_json,result_json FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'");
  assert.equal(plans.length, 1);
  const plan = plans[0], result = JSON.parse(plan.result_json), document = JSON.parse(plan.payload_json).document;
  assert.equal(plan.status, 'confirmed');assert.equal(result.state, 'ready');assert.equal(result.checkpoints.length, 3);
  const classroom = sql("SELECT id,status,payload_json,result_json FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type='pi_classroom_candidate'", [result.classroomId, plan.session_id])[0];
  assert(classroom);assert.equal(classroom.status, 'confirmed');
  const version = sha256(JSON.stringify({id: classroom.id, status: classroom.status, payload: classroom.payload_json, result: classroom.result_json}));
  const drafts = sql("SELECT id,artifact_id,result_path FROM xiaozhi_pi_office_drafts WHERE conversation_id=? AND state='saved'", [plan.session_id]);
  assert.equal(drafts.length, 1);
  return {planId: plan.id, sessionId: plan.session_id, classroomId: classroom.id, classroomVersion: version,
    draftId: drafts[0].id, artifactId: drafts[0].artifact_id, authorityInsideCopy: inside(runRoot, drafts[0].result_path),
    planDocumentSha256: sha256(JSON.stringify(document)), checkpointsSha256: sha256(JSON.stringify(result.checkpoints))};
}
export async function copiedExport(runRoot, original, binding) {
  const file = path.resolve(runRoot, original.export.path);
  assert(inside(runRoot, file));assert.equal(fs.realpathSync(file), file);
  const stat = fs.lstatSync(file);assert(stat.isFile() && stat.nlink === 1 && stat.size <= 16 * 1024 * 1024);
  const bytes = fs.readFileSync(file), hash = sha256(bytes);
  assert.equal(hash, original.export.sha256);assert.equal(bytes.length, original.export.bytes);
  const zip = await JSZip.loadAsync(bytes, {checkCRC32: true});
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
  assert.equal(slides, original.export.slides);
  let receipt;
  if (binding.authorityInsideCopy) {
    receipt = {verified: true, proof: await readClassroomExport({runRoot, ...binding})};
  } else receipt = {verified: false, boundary: 'absolute_receipt_authority_outside_copy_preserved_without_rewrite'};
  return {sha256: hash, bytes: bytes.length, slides, zipCRC: true, receipt};
}
