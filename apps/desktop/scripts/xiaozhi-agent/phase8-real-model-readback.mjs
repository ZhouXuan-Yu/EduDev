import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from './phase8-real-model-plan.mjs';

export function readOriginalRecords(databasePath, sessionId, runId) {
  const database = new DatabaseSync(databasePath, {readOnly: true});
  try {
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    if (!tables.has('ai_agent_runs')) throw Error('phase8_original_runs_missing');
    const runs = database.prepare('SELECT id,session_id,status,model FROM ai_agent_runs WHERE session_id=? AND id=?').all(sessionId, runId);
    const taskViews = [];
    if (tables.has('app_settings')) {
      const rows = database.prepare("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%'").all();
      for (const row of rows) {
        const view = JSON.parse(row.value_json).view;
        if (view?.sessionId === sessionId && (view.binding?.runId === runId || view.lastRunId === runId || view.origin?.runId === runId)) {
          taskViews.push({id: view.id, sessionId: view.sessionId, binding: view.binding, lastRunId: view.lastRunId, state: view.state});
        }
      }
    }
    const receipts = [];
    if (tables.has('xiaozhi_tool_receipts')) {
      const columns = new Set(database.prepare('PRAGMA table_info(xiaozhi_tool_receipts)').all().map(row => row.name));
      const selected = ['tool', 'contract_json', 'success'].filter(name => columns.has(name));
      if (columns.has('run_id') && selected.length) {
        for (const row of database.prepare(`SELECT ${selected.join(',')} FROM xiaozhi_tool_receipts WHERE run_id=?`).all(runId)) {
          const contract = row.contract_json ? JSON.parse(row.contract_json) : null;
          receipts.push({tool: row.tool, success: row.success, taskId: contract?.taskId || null,
            runId: contract?.runId || null, generation: contract?.generation || null});
        }
      }
    }
    return {runs, taskViews, receipts};
  } finally {database.close();}
}

export function verifiedRunBinding({sessionId, runId, snapshot, records}) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(runId)
      || !snapshot?.projection?.turns?.some(turn => turn.id === runId)
      || records.runs.length !== 1 || records.runs[0].id !== runId || records.runs[0].session_id !== sessionId) {
    throw Error('phase8_run_binding_unverified');
  }
  const taskIds = new Set(records.taskViews.map(view => view.id));
  if (records.receipts.some(row => row.runId && row.runId !== runId)) throw Error('phase8_receipt_binding_conflict');
  for (const row of records.receipts) if (row.taskId && (!row.runId || row.runId === runId)) taskIds.add(row.taskId);
  if (snapshot.task?.id) {
    if (!taskIds.has(snapshot.task.id)) throw Error('phase8_task_binding_unverified');
    taskIds.add(snapshot.task.id);
  }
  if (taskIds.size > 1) throw Error('phase8_task_binding_ambiguous');
  return {sessionId, runId, taskId: [...taskIds][0] || null,
    taskEvidence: taskIds.size ? 'original_task_or_receipt' : 'unavailable_legacy_or_no_task'};
}

export function collectFiles(directory) {
  const files = [];
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const child = path.join(relative, name), target = path.join(directory, child), stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {files.push({relativePath: child.replaceAll('\\', '/'), unsupported: 'symlink'}); continue;}
      if (stat.isDirectory()) visit(child);
      else if (stat.isFile()) files.push({path: target, relativePath: child.replaceAll('\\', '/'), bytes: stat.size, sha256: sha256(fs.readFileSync(target))});
    }
  }
  visit(''); return files;
}

export function exportBlindBundle(directory, rows) {
  fs.mkdirSync(directory, {recursive: true});
  const samples = [], identities = [];
  for (const row of rows) {
    const id = 'sample-' + randomUUID(), target = path.join(directory, id); fs.mkdirSync(target);
    const artifacts = [];
    for (const file of row.artifacts) {
      if (!file.path || file.unsupported) continue;
      const relative = file.relativePath.replaceAll('\\', '/');
      if (relative.startsWith('/') || relative.split('/').some(part => part === '..' || part === '') || path.isAbsolute(relative)) throw Error('phase8_blind_path_invalid');
      const dest = path.join(target, 'artifacts', relative); fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(file.path, dest);
      artifacts.push({relativePath: 'artifacts/' + relative, sha256: sha256(fs.readFileSync(dest))});
    }
    fs.writeFileSync(path.join(target, 'sample.json'), JSON.stringify({id, task: row.task, answer: row.answer, artifacts,
      scoringStatus: 'NOT_TESTED', limitation: 'Artifact bytes are preserved. Embedded identifying content can limit blinding and must be disclosed by the reviewer.'}, null, 2));
    samples.push({id, task: row.task}); identities.push({sampleId: id, executionId: row.id, version: row.version, round: row.round});
  }
  fs.writeFileSync(path.join(path.dirname(directory), 'blind-identity-map.json'), JSON.stringify(identities, null, 2));
  return {samples, identities};
}

export async function inspectOfficeArtifacts(files, desktopRoot) {
  const require = createRequire(path.join(desktopRoot, 'package.json'));
  const inspected = [];
  for (const file of files) {
    if (!file.path) continue;
    if (/\.pptx$/i.test(file.path)) {
      const JSZip = require('jszip');
      const archive = await JSZip.loadAsync(fs.readFileSync(file.path), {checkCRC32: true});
      const slideNames = Object.keys(archive.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
      const slides = [];
      for (const name of slideNames) {
        const xml = await archive.file(name).async('string');
        slides.push({name, texts: [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(match => match[1])});
      }
      inspected.push({relativePath: file.relativePath, format: 'pptx', slides, exactlyFourSlides: slides.length === 4,
        substantiveAndCorrect: 'NOT_TESTED_INDEPENDENT_REVIEW'});
    }
    if (/\.html?$/i.test(file.path)) inspected.push({relativePath: file.relativePath, format: 'html',
      bytes: file.bytes, interactiveCorrectWrongReset: 'NOT_TESTED_INDEPENDENT_BROWSER_REVIEW'});
  }
  return inspected;
}
