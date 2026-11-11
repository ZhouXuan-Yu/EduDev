/** Owned manual reading-note evidence. All SQLite access here is read-only. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import { fingerprint, sha256 } from "./evidence.mjs";
import {
  ownedExact,
  readSql,
  readPersistedFixtureSource,
  safeTree,
} from "./retained-fixture-evidence.mjs";

export const readingSchema = "xiaozhi.qa.manual-reading-source.v1";
export const readingBudget = Object.freeze({
  launches: 1,
  totalMs: 120000,
  models: 0,
  providerRequests: 0,
  http: 0,
});
export const readingParent = (desktop) =>
  path.join(desktop, "test-results/ui-final-workbenches-20261111");
const digest = (value) => sha256(JSON.stringify(value));
const sorted = (rows) =>
  rows
    .map((row) => ({ ...row }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const identifier = (name) => '"' + name.replaceAll('"', '""') + '"';

export function readingSnapshot(data) {
  return readSql(data, (query) => {
    const schema = query(
      "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name",
    ).map((row) => ({ ...row }));
    const tables = Object.fromEntries(
      schema
        .filter((row) => row.type === "table")
        .map(({ name }) => [
          name,
          sorted(query("SELECT * FROM " + identifier(name))),
        ]),
    );
    return { schema, tables };
  });
}

export function readingFiles(data) {
  return fingerprint(data).files.filter(
    ({ file }) => !["app.db", "app.db-wal", "app.db-shm"].includes(file),
  );
}

/** The sole authorized delta includes SQLite's AUTOINCREMENT bookkeeping. */
export function assertReadingDelta(before, after, saved) {
  const expected = structuredClone(before);
  assert(
    !expected.tables.material_reading_entries.some(
      (row) => row.id === saved.id,
    ),
  );
  expected.tables.material_reading_entries = sorted([
    ...expected.tables.material_reading_entries,
    saved,
  ]);
  const sequence = expected.tables.sqlite_sequence.find(
    (row) => row.name === "material_reading_entries",
  );
  assert.equal(saved.sequence, (sequence?.seq || 0) + 1);
  if (sequence) sequence.seq = saved.sequence;
  else
    expected.tables.sqlite_sequence.push({
      name: "material_reading_entries",
      seq: saved.sequence,
    });
  expected.tables.sqlite_sequence = sorted(expected.tables.sqlite_sequence);
  assert.deepEqual(
    after,
    expected,
    "Every SQLite fact/schema conserved except one manual reading entry and its sequence",
  );
}

export function transportSnapshot(before, sourceData, data) {
  const expected = structuredClone(before);
  const files = expected.tables.teacher_resources.map((row) => {
    const original = ownedExact(
      path.resolve(sourceData, row.local_path),
      sourceData,
    );
    const relative = path.relative(sourceData, original);
    assert.equal(path.dirname(relative), "teacher_resources");
    assert.equal(sha256(fs.readFileSync(original)), row.content_hash);
    const file = path.join(data, relative);
    row.local_path = file;
    return {
      resourceId: row.id,
      original,
      file,
      relative,
      sha256: row.content_hash,
    };
  });
  expected.tables.teacher_resources = sorted(expected.tables.teacher_resources);
  return { expected, files };
}

let contracts;
export async function readingContracts(desktop) {
  if (!contracts) {
    const { build } = await import("esbuild");
    const result = await build({
      stdin: {
        contents:
          "export {materialBodyVersion} from './src/main/assets/material-source.ts';\n" +
          "export {validMaterialSource} from './src/shared/materials.ts';\n" +
          "export {validStudySave,studyRevision} from './src/shared/material-study.ts';",
        resolveDir: desktop,
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      logLevel: "silent",
    });
    contracts = await import(
      "data:text/javascript;base64," +
        Buffer.from(result.outputFiles[0].text).toString("base64")
    );
  }
  return contracts;
}

export function sourceChunk(row) {
  return {
    id: String(row.id),
    chunkIndex: Number(row.chunk_index ?? 0),
    contentMd: String(row.content_md ?? ""),
    containsPersonalData: Number(row.contains_personal_data ?? 0) === 1,
    pageNumber: row.page_number == null ? null : Number(row.page_number),
  };
}

export async function validateReadingRow(data, row, desktop) {
  const { validStudySave, studyRevision, materialBodyVersion } =
    await readingContracts(desktop);
  assert.deepEqual(
    Object.keys(row).sort(),
    [
      "sequence",
      "id",
      "resource_id",
      "source_json",
      "note",
      "completed",
      "updated_at",
    ].sort(),
  );
  assert(studyRevision(row.id));
  assert(Number.isSafeInteger(row.sequence) && row.sequence > 0);
  assert.equal(row.completed, 0);
  assert(Number.isFinite(Date.parse(row.updated_at)));
  assert(
    row.note.startsWith("人工 QA 阅读笔记（合成测试文字，非 AI 结果）。\n"),
  );
  const source = JSON.parse(row.source_json);
  assert(
    validStudySave({
      schemaVersion: "xiaozhi.material-study.v1",
      source,
      expectedRevision: null,
      note: row.note,
      completed: false,
    }),
  );
  assert.equal(source.resourceId, row.resource_id);
  assert.equal(source.offset, 0);
  const { resource, chunks } = readSql(data, (query) => {
    const resources = query("SELECT * FROM teacher_resources WHERE id=?", [
      row.resource_id,
    ]);
    assert.equal(resources.length, 1);
    return {
      resource: { ...resources[0] },
      chunks: query(
        "SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index ASC,id ASC",
        [row.resource_id],
      ),
    };
  });
  assert.equal(source.version, resource.content_hash);
  const chunk = chunks[source.offset];
  assert(chunk?.content_md?.trim());
  assert.equal(source.chunkId, chunk.id);
  assert.equal(source.bodyVersion, materialBodyVersion(sourceChunk(chunk)));
  const file = ownedExact(path.resolve(data, resource.local_path), data);
  assert.equal(path.extname(file).toLowerCase(), ".pdf");
  assert.equal(sha256(fs.readFileSync(file)), source.version);
  return {
    resource,
    file,
    source,
    chunk: { ...chunk },
    proof: {
      source,
      resource,
      chunk: { ...chunk },
      originalPdfSha256: source.version,
      noteSha256: sha256(row.note),
      rowSha256: digest(row),
    },
  };
}

export function assertReadingGuard(guard) {
  assert.equal(guard.policyProbe, "FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED");
  for (const key of ["networkAttempts", "modelAttempts", "rendererErrors"])
    assert.equal(guard[key], 0);
  assert(guard.formalRegistrations > 0);
}

export function assertReadingReportHeader(report, root) {
  assert.equal(report.schemaVersion, readingSchema);
  assert.equal(report.success, true);
  assert.equal(report.status, "PASS");
  assert.equal(report.output, root);
  assert.deepEqual(report.budget, readingBudget);
  assert.equal(report.launches.length, 1);
  assert.equal(report.launches[0].number, 1);
  assert(
    Number.isSafeInteger(report.launches[0].pid) && report.launches[0].pid > 0,
  );
  assert(report.elapsedMs > 0 && report.elapsedMs <= readingBudget.totalMs);
  assert.deepEqual(report.errors, []);
  assert.equal(report.originalUnchanged, true);
  assert.equal(report.integrityVerified, true);
  assert.equal(report.isolated.data, path.join(root, "data"));
  assert.equal(report.isolated.profile, path.join(root, "profile"));
  assertReadingGuard(report.launches[0].guard);
  assert.equal(report.launches[0].cleanup.closed, true);
  assert(
    !report.launches[0].cleanup.guardError &&
      !report.launches[0].cleanup.closeError,
  );
  assert.equal(report.launches[0].storagePath, report.isolated.profile);
  assert.equal(report.launches[0].visible, true);
  assert(
    Number.isInteger(report.launches[0].exit.code) ||
      typeof report.launches[0].exit.signal === "string",
  );
  assert.deepEqual(report.checks, [
    "QUALIFIED_SOURCE",
    "EXACT_CLONE_TRANSPORT",
    "UI_MANUAL_SAVE",
    "SQLITE_SOURCE_PROOF",
    "FINAL_CONSERVATION",
  ]);
}

/** Optional editor source accepts only this successful owned producer contract. */
export async function readOwnedReadingReport(file, desktop, options = {}) {
  const parent = readingParent(desktop),
    reportFile = ownedExact(file, parent),
    root = path.dirname(reportFile);
  assert.match(path.basename(root), /^reading-source-[A-Za-z0-9]+$/);
  assert.equal(path.dirname(root), parent);
  assert.equal(path.basename(reportFile), "report.json");
  assert(fs.statSync(reportFile).size <= 512 * 1024);
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  assertReadingReportHeader(report, root);
  const scriptFiles = [
    "ui-final-reading-source-live.mjs",
    "acceptance/reading-source-evidence.mjs",
    "acceptance/paper-adaptation-continuation.mjs",
  ];
  if (options.producerCommit) {
    assert.match(options.producerCommit, /^[a-f0-9]{40}$/);
    assert.deepEqual(report.scripts.map(item => item.file), scriptFiles);
    for (const item of report.scripts) {
      const blob = execFileSync('git', ['show', `${options.producerCommit}:apps/desktop/scripts/${item.file}`],
        {cwd:path.resolve(desktop, '../..'),windowsHide:true,maxBuffer:2*1024*1024});
      // Git stores LF. A verified Windows checkout may have captured CRLF bytes.
      const windowsCheckout = Buffer.from(blob.toString('utf8').replace(/\r?\n/g, '\r\n'));
      assert(sha256(blob) === item.sha256 || sha256(windowsCheckout) === item.sha256,
        'Exact historical producer and boundary helper source bytes');
    }
  } else assert.deepEqual(
    report.scripts,
    scriptFiles.map((name) => ({
      file: name,
      sha256: sha256(fs.readFileSync(path.join(desktop, "scripts", name))),
    })),
    "Producer and boundary helper identities",
  );
  const data = ownedExact(report.isolated.data, root);
  ownedExact(report.isolated.profile, root);
  const pinsFile = ownedExact(report.pins.file, parent),
    pins = JSON.parse(fs.readFileSync(pinsFile, "utf8"));
  assert.deepEqual(report.pins, { file: pinsFile, ...pins });
  if (options.producerCommit) {
    const consumerFile = ownedExact(options.consumerPinsFile, path.join(desktop, 'test-results'));
    const consumerPins = JSON.parse(fs.readFileSync(consumerFile, 'utf8'));
    assert.match(consumerPins.source, /^[a-f0-9]{64}$/);
    assert.match(consumerPins.build, /^[a-f0-9]{64}$/);
    assert.equal(fingerprint(path.join(desktop, 'src')).sha256, consumerPins.source);
    const consumerBuild = ownedExact(consumerPins.buildRoot, path.join(desktop, 'test-results'));
    assert.equal(fingerprint(consumerBuild).sha256, consumerPins.build);
  } else assert.equal(fingerprint(path.join(desktop, "src")).sha256, pins.source);
  const build = ownedExact(pins.buildRoot, path.join(desktop, "test-results"));
  assert.equal(fingerprint(build).sha256, pins.build);
  const main = ownedExact(path.join(build, "main/index.js"), build),
    identity = report.launches[0].identity;
  assert.deepEqual(identity.paths, {
    userData: report.isolated.profile,
    sessionData: report.isolated.profile,
  });
  assert(
    identity.modules.some((url) =>
      url.endsWith(main.replaceAll("\\", "/").toLowerCase()),
    ),
  );
  const input = readPersistedFixtureSource(report.input.report, desktop, pins);
  assert.equal(input.reference, report.input.reference);
  assert.deepEqual(input.qualification, report.input.qualification);
  assert.deepEqual(input.cases, report.input.cases);
  const before = readingSnapshot(path.join(input.reference, "data"));
  const transported = transportSnapshot(
    before,
    path.join(input.reference, "data"),
    data,
  );
  assert.deepEqual(transported.files, report.transport.files);
  for (const item of transported.files)
    assert.equal(
      sha256(fs.readFileSync(ownedExact(item.file, data))),
      item.sha256,
    );
  const current = readingSnapshot(data);
  const notes = current.tables.material_reading_entries.filter(
    (row) => row.id === report.savedReading.id,
  );
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0], report.savedReading, "Exact actual UI saved row");
  assertReadingDelta(transported.expected, current, notes[0]);
  assert.equal(digest(current), report.final.sqliteSha256);
  assert.deepEqual(
    readingFiles(data),
    readingFiles(path.join(input.reference, "data")),
    "All native/original/non-SQLite file bytes conserved",
  );
  assert.equal(digest(readingFiles(data)), report.final.filesSha256);
  assert.equal(
    safeTree(input.reference, path.dirname(input.reference)),
    input.qualification.sourceTreeSha256,
  );
  const proof = await validateReadingRow(data, notes[0], desktop);
  assert.deepEqual(proof.proof, report.sourceProof);
  assert.deepEqual(
    report.screens.map((screen) => screen.id),
    ["manual-note-before-save", "manual-note-saved"],
  );
  for (const screen of report.screens) {
    const image = fs.readFileSync(ownedExact(screen.file, root));
    assert.equal(screen.file, path.join(root, screen.id + ".png"));
    assert.equal(sha256(image), screen.sha256);
    assert(
      image
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    );
  }
  return {
    noteReport: report,
    noteReportFile: reportFile,
    noteData: data,
    actualNote: notes[0],
    noteResource: proof.resource,
    noteSourceFile: proof.file,
  };
}
