import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const root = process.env.EDU_STRUCTURE_TEST_ROOT;
assert(root && path.isAbsolute(root));
const previous = JSON.parse(fs.readFileSync(path.join(root, "report.json")));
assert(previous.ok, "A successful real import report is required");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function identity(directory) {
  const files = [];
  function walk(folder) {
    for (const entry of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const file = path.join(folder, entry.name);
      assert(!entry.isSymbolicLink());
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile())
        files.push({
          path: path.relative(directory, file).replaceAll("\\", "/"),
          sha256: sha(fs.readFileSync(file)),
        });
    }
  }
  walk(directory);
  return { sha256: sha(Buffer.from(JSON.stringify(files))), files };
}
const tree = identity(path.resolve("out")),
  runtime = path.resolve(
    "test-results",
    "document-structure-runtime-" + tree.sha256.slice(0, 24),
  );
if (!fs.existsSync(runtime)) fs.cpSync("out", runtime, { recursive: true });
assert.equal(identity(runtime).sha256, tree.sha256);
const entry = path.join(runtime, "main", "index.js");
const report = {
  ok: false,
  root,
  runtime,
  mainSha256: sha(fs.readFileSync(entry)),
  runtimeTreeSha256: tree.sha256,
  runtimeFiles: tree.files.length,
  importEvidence: {
    runtimeTreeSha256: previous.runtimeTreeSha256,
    backgroundMs: previous.backgroundMs,
  },
  checks: [],
  errors: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(root, "native-real-pdf-final.json"),
    JSON.stringify(report, null, 2),
  );
const query = (sql, args = []) => {
  const db = new DatabaseSync(path.join(root, "data", "app.db"), {
    readOnly: true,
  });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
};
let app, page;
async function launch() {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: path.join(root, "data"),
    OMNI_EDU_REPO_ROOT: path.resolve("../.."),
    OMNI_EDU_E2E_DIALOG_MODE: "1",
    OMNI_EDU_E2E_VISIBLE: "0",
    OMNI_EDU_XIAOZHI_PI: "1",
  };
  for (const key of [
    "ELECTRON_RUN_AS_NODE",
    "NODE_OPTIONS",
    "ELECTRON_RENDERER_URL",
    "DEEPSEEK_API_KEY",
  ])
    delete env[key];
  app = await _electron.launch({
    args: [entry, "--user-data-dir=" + path.join(root, "profile")],
    env,
    cwd: process.cwd(),
    timeout: 90000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => report.errors.push(error.message));
}
async function until(action, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await action();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Readback timed out");
}
function check(name) {
  report.checks.push(name);
  save();
  console.log("PASS " + name);
}
async function openStructure(resource) {
  await productEntry(page, "materials").click();
  await page.getByTestId("materials-search").fill(resource.title);
  await page.getByTestId("materials-refresh").click();
  await page
    .getByTestId("material-" + resource.id)
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "题目与校正", exact: true }).click();
  const panel = page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(panel);
  return panel;
}
async function waitJob(resourceId, oldGeneration) {
  return until(() => {
    const job = query(
      "SELECT * FROM material_structure_jobs WHERE resource_id=?",
      [resourceId],
    )[0];
    return job &&
      job.generation !== oldGeneration &&
      ["complete", "partial", "failed"].includes(job.status)
      ? job
      : undefined;
  }, 240000);
}
async function waitBank(resourceId) {
  await until(() => {
    const job = query(
      "SELECT status FROM material_question_jobs WHERE resource_id=?",
      [resourceId],
    )[0];
    return job && ["complete", "failed"].includes(job.status);
  });
  const status = query(
    "SELECT status,error FROM material_question_jobs WHERE resource_id=?",
    [resourceId],
  )[0];
  assert.equal(status.status, "complete", status.error);
}
async function gallery(q) {
  await productEntry(page, "teaching").click();
  await page.getByRole("button", { name: "题本", exact: true }).click();
  await page.getByTestId("question-notebook-search").fill(q.stem.slice(0, 32));
  const card = page.getByTestId("question-notebook-card-" + q.id);
  await card.waitFor();
  if (await card.getByTestId("question-original-open").count())
    await card.getByTestId("question-original-open").click();
  const images = card.getByTestId("question-original-image");
  await until(
    async () =>
      (await images.count()) &&
      (await images.evaluateAll((nodes) =>
        nodes.every((i) => i.complete && i.naturalWidth > 0),
      )),
  );
  const actual = await images.evaluateAll((nodes) =>
    nodes.map((i) => i.src.split(",")[1]),
  );
  const expected = JSON.parse(q.document_json).blocks.filter(
    (b) => b.kind === "image",
  );
  assert.equal(actual.length, expected.length);
  actual.forEach((bytes, i) =>
    assert.equal(sha(Buffer.from(bytes, "base64")), expected[i].sha256),
  );
}
try {
  const resource = query(
    "SELECT * FROM teacher_resources WHERE original_file_name=?",
    [previous.files.find((file) => file.name.endsWith(".pdf")).name],
  )[0];
  assert(
    resource,
    "Previously authorized natural PDF must already be imported",
  );
  const before = query("SELECT * FROM question_bank_items ORDER BY id");
  const originalSha256 = sha(fs.readFileSync(resource.local_path));
  const oldJob = query(
    "SELECT * FROM material_structure_jobs WHERE resource_id=?",
    [resource.id],
  )[0];
  const oldPages = query(
    "SELECT page,body_json FROM material_structure_pages WHERE generation=? ORDER BY page",
    [oldJob.generation],
  ).map((row) => ({ page: row.page, body: JSON.parse(row.body_json) }));
  const oldSnapshots = query(
    "SELECT * FROM material_structure_questions ORDER BY generation,id",
  );
  await launch();
  const panel = await openStructure(resource);
  const started = Date.now();
  await panel.getByTestId("structure-rebuild").click();
  const job = await waitJob(resource.id, oldJob.generation);
  assert(["complete", "partial"].includes(job.status), job.error);
  await waitBank(resource.id);
  const pages = query(
    "SELECT body_json FROM material_structure_pages WHERE generation=? ORDER BY page",
    [job.generation],
  ).map((row) => JSON.parse(row.body_json));
  assert.equal(pages.length, oldPages.length);
  for (const page of pages) {
    assert.equal(page.engine, "layout-paragraph-question.v4");
    assert.equal(
      page.rawText,
      oldPages.find((old) => old.page === page.page).body.rawText,
    );
    const ids = page.paragraphs.flatMap((paragraph) => paragraph.lineIds);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual([...ids].sort(), page.lines.map((line) => line.id).sort());
    assert(page.nativeRecovery && page.nativeRecovery.native.ok);
    for (const accepted of page.nativeRecovery.accepted) {
      const attempt = page.nativeRecovery.attempts[accepted.attempt];
      assert.equal(accepted.line.text, attempt.ocr.text);
      assert(attempt.ocr.scores.every((score) => score >= 0.85));
      const crop = fs.readFileSync(
        path.join(
          root,
          "data",
          "question-assets",
          "v1",
          attempt.image.assetId + ".png",
        ),
      );
      assert.equal(sha(crop), attempt.image.sha256);
    }
  }
  const after = new Map(
    query("SELECT * FROM question_bank_items ORDER BY id").map((row) => [
      row.id,
      row,
    ]),
  );
  for (const row of before) assert.deepEqual(after.get(row.id), row);
  const snapshotMap = new Map(
    query(
      "SELECT * FROM material_structure_questions ORDER BY generation,id",
    ).map((row) => [row.generation + ":" + row.id, row]),
  );
  for (const row of oldSnapshots)
    assert.deepEqual(snapshotMap.get(row.generation + ":" + row.id), row);
  assert.equal(sha(fs.readFileSync(resource.local_path)), originalSha256);
  report.naturalPdf = {
    sourceSha256: originalSha256,
    pages: pages.length,
    elapsedMs: Date.now() - started,
    bankBefore: before.length,
    bankAfter: after.size,
    nativeItems: pages.map((page) => page.nativeRecovery.native.items.length),
    readBytes: pages.map((page) => page.nativeRecovery.native.readBytes),
    accepted: pages.reduce(
      (sum, page) => sum + page.nativeRecovery.accepted.length,
      0,
    ),
    unresolved: pages.reduce(
      (sum, page) => sum + page.nativeRecovery.unresolved.length,
      0,
    ),
    status: job.status,
  };
  check(
    "A natural six-page PDF rebuilds through the current default pipeline with exact original OCR, one-to-one paragraph line coverage and preserved historical questions",
  );
  await openStructure(resource);
  const owner = before.find(
    (row) =>
      JSON.parse(row.archive_json || "{}").structure?.resourceId ===
      resource.id,
  );
  assert(owner);
  await gallery(owner);
  check(
    "The original natural-PDF question gallery authenticates after the new generation",
  );
  await app.close();
  app = undefined;
  await launch();
  await openStructure(resource);
  await gallery(owner);
  assert.equal(sha(fs.readFileSync(resource.local_path)), originalSha256);
  for (const row of before)
    assert.deepEqual(
      query("SELECT * FROM question_bank_items WHERE id=?", [row.id])[0],
      row,
    );
  assert.equal(report.errors.length, 0);
  assert.equal(identity(runtime).sha256, tree.sha256);
  check(
    "Cold restart retains the natural PDF generation, original crops and all earlier teacher/bank facts",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: report.checks.length,
      ...report.naturalPdf,
    }),
  );
} catch (error) {
  report.failure = String(error.stack || error);
  save();
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => {});
}
