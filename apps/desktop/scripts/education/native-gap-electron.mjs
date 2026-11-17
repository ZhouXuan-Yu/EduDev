import { twoColumnHtml } from "./two-column-fixture.mjs";
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
    path.join(root, "native-gap-final.json"),
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
function structure(job) {
  const page = JSON.parse(
    query(
      "SELECT body_json FROM material_structure_pages WHERE generation=? AND page=1",
      [job.generation],
    )[0].body_json,
  );
  const questions = query(
    "SELECT body_json FROM material_structure_questions WHERE generation=? ORDER BY rowid",
    [job.generation],
  ).map((row) => JSON.parse(row.body_json));
  return { page, questions };
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
  const legacy = query(
    "SELECT * FROM teacher_resources WHERE original_file_name='synthetic-two-column.pdf'",
  )[0];
  assert(legacy);
  const oldJob = query(
    "SELECT * FROM material_structure_jobs WHERE resource_id=?",
    [legacy.id],
  )[0];
  const before = query("SELECT * FROM question_bank_items ORDER BY id");
  const snapshots = query(
    "SELECT * FROM material_structure_questions ORDER BY generation,id",
  );
  const oldSourceHash = sha(fs.readFileSync(legacy.local_path));
  await launch();
  let panel = await openStructure(legacy);
  await panel.getByTestId("structure-rebuild").click();
  const rebuilt = await waitJob(legacy.id, oldJob.generation);
  assert.notEqual(rebuilt.status, "failed", rebuilt.error);
  await waitBank(legacy.id);
  const recovered = structure(rebuilt);
  assert.deepEqual(
    recovered.questions.map((q) => q.number),
    ["1", "2", "3", "4"],
  );
  assert(recovered.questions.every((q) => q.options.length === 4));
  assert(recovered.page.nativeRecovery.native.ok);
  assert(
    recovered.page.nativeRecovery.accepted.some((item) =>
      item.line.text.includes("六米"),
    ),
  );
  const rawOptions = recovered.page.lines
    .filter((line) => !line.origin)
    .flatMap((line) => [
      ...line.text.matchAll(/(?:^|\s)(?:([A-D])[.．、]|[（(]([A-D])[）)])/gu),
    ]).length;
  assert.equal(rawOptions, 15);
  assert.equal(
    recovered.questions.reduce((sum, q) => sum + q.options.length, 0),
    16,
  );
  assert.equal(
    recovered.page.rawText,
    recovered.page.lines
      .filter((line) => !line.origin)
      .map((line) => line.text)
      .join("\n"),
  );
  assert.deepEqual(
    query("SELECT * FROM question_bank_items ORDER BY id"),
    before,
  );
  const afterSnapshots = new Map(
    query("SELECT * FROM material_structure_questions").map((row) => [
      row.generation + row.id,
      row,
    ]),
  );
  for (const row of snapshots)
    assert.deepEqual(afterSnapshots.get(row.generation + row.id), row);
  report.legacy = {
    rawOptions,
    restoredOptions: 16,
    accepted: recovered.page.nativeRecovery.accepted.length,
    unresolved: recovered.page.nativeRecovery.unresolved.length,
    readBytes: recovered.page.nativeRecovery.native.readBytes,
    protectedBankRows: before.length,
  };
  check(
    "Original rebuild restores the omitted native C option through actual crop OCR while preserving all prior bank rows and source snapshots",
  );
  await panel.getByRole("button", { name: "刷新", exact: true }).click();
  await panel.getByTestId("structure-native-recovery").waitFor();
  assert(
    (await panel.getByTestId("structure-native-recovery").innerText()).includes(
      "补充 1 行",
    ),
  );
  const teacher = query(
    "SELECT * FROM question_bank_items WHERE json_type(archive_json,'$.structureReview')='object'",
  )[0];
  assert(teacher);
  await gallery(teacher);
  check(
    "Physical OCR-source identity links rebuilt candidates to the original teacher correction and its crop gallery without duplicating questions",
  );
  const file = path.join(root, "native-recovery-two-column.pdf");
  if (!fs.existsSync(file)) {
    const encoded = await app.evaluate(async ({ BrowserWindow }, html) => {
      const child = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      try {
        await child.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(html),
        );
        return (
          await child.webContents.printToPDF({
            printBackground: true,
            pageSize: "A4",
          })
        ).toString("base64");
      } finally {
        child.destroy();
      }
    }, twoColumnHtml);
    fs.writeFileSync(file, Buffer.from(encoded, "base64"));
  }
  const fileSha = sha(fs.readFileSync(file));
  assert.notEqual(fileSha, legacy.content_hash);
  await productEntry(page, "materials").click();
  await app.evaluate(({ dialog }, file) => {
    const old = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => {
      dialog.showOpenDialog = old;
      return { canceled: false, filePaths: [file] };
    };
  }, file);
  await page.getByTestId("materials-import").click();
  const resource = await until(
    () =>
      query("SELECT * FROM teacher_resources WHERE content_hash=?", [
        fileSha,
      ])[0],
  );
  const job = await waitJob(resource.id, "");
  assert.notEqual(job.status, "failed", job.error);
  await waitBank(resource.id);
  const fresh = structure(job);
  assert.deepEqual(
    fresh.questions.map((q) => q.number),
    ["1", "2", "3", "4"],
  );
  assert(
    fresh.questions.every(
      (q) => q.options.length === 4 && q.status === "candidate",
    ),
  );
  const newQuestions = query(
    "SELECT * FROM question_bank_items WHERE json_extract(archive_json,'$.structure.resourceId')=?",
    [resource.id],
  );
  assert.equal(newQuestions.length, 4);
  assert(
    newQuestions.every(
      (q) => JSON.parse(q.archive_json).sourceChecked === false,
    ),
  );
  report.fresh = {
    sourceSha256: fileSha,
    questions: newQuestions.length,
    accepted: fresh.page.nativeRecovery.accepted.length,
    unresolved: fresh.page.nativeRecovery.unresolved.length,
    options: fresh.questions.map((q) => q.options.length),
  };
  check(
    "A fresh PDF imported from the original materials action runs native localization and crop concordance by default and archives four unverified complete questions",
  );
  panel = await openStructure(resource);
  await panel.getByTestId("structure-native-recovery").waitFor();
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await panel
      .getByTestId("structure-native-recovery")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(root, `native-gap-${viewport.width}.png`),
      fullPage: true,
    });
  }
  for (const evidence of fresh.page.nativeRecovery.accepted) {
    const attempt = fresh.page.nativeRecovery.attempts[evidence.attempt];
    const bytes = fs.readFileSync(
      path.join(
        root,
        "data",
        "question-assets",
        "v1",
        attempt.image.assetId + ".png",
      ),
    );
    assert.equal(sha(bytes), attempt.image.sha256);
    assert.equal(
      attempt.ocr.engine,
      "rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1",
    );
  }
  await gallery(newQuestions[0]);
  check(
    "Both desktop sizes expose the supplementary reading status and authenticated crop/source images",
  );
  panel = await openStructure(resource);
  const bankBeforeCancel = query(
    "SELECT * FROM question_bank_items ORDER BY id",
  );
  await panel.getByTestId("structure-rebuild").click();
  await panel.getByTestId("structure-cancel").waitFor();
  await panel.getByTestId("structure-cancel").click();
  await until(
    () =>
      query("SELECT status FROM material_structure_jobs WHERE resource_id=?", [
        resource.id,
      ])[0].status === "cancelled",
  );
  assert.deepEqual(
    query("SELECT * FROM question_bank_items ORDER BY id"),
    bankBeforeCancel,
  );
  await panel.getByRole("button", { name: "刷新", exact: true }).click();
  await panel.getByTestId("structure-retry").click();
  const resumed = await waitJob(resource.id, "");
  assert.notEqual(resumed.status, "failed", resumed.error);
  await waitBank(resource.id);
  assert.deepEqual(
    query("SELECT * FROM question_bank_items ORDER BY id"),
    bankBeforeCancel,
  );
  check(
    "Cancel and retry cover the new native/crop stage without committing late results or duplicating archived questions",
  );

  const privateFile = path.join(root, "native-private-text.pdf");
  if (!fs.existsSync(privateFile)) {
    const html = twoColumnHtml.replace(
      "<h1>",
      '<div style="position:absolute;top:0;color:white;font-size:10px">teacher@example.test</div><h1>',
    );
    const encoded = await app.evaluate(async ({ BrowserWindow }, html) => {
      const child = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      try {
        await child.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(html),
        );
        return (
          await child.webContents.printToPDF({
            printBackground: true,
            pageSize: "A4",
          })
        ).toString("base64");
      } finally {
        child.destroy();
      }
    }, html);
    fs.writeFileSync(privateFile, Buffer.from(encoded, "base64"));
  }
  const privateHash = sha(fs.readFileSync(privateFile));
  await productEntry(page, "materials").click();
  await app.evaluate(({ dialog }, file) => {
    const old = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => {
      dialog.showOpenDialog = old;
      return { canceled: false, filePaths: [file] };
    };
  }, privateFile);
  await page.getByTestId("materials-import").click();
  const privateResource = await until(
    () =>
      query("SELECT * FROM teacher_resources WHERE content_hash=?", [
        privateHash,
      ])[0],
  );
  const privateJob = await waitJob(privateResource.id, "");
  assert.notEqual(privateJob.status, "failed", privateJob.error);
  await waitBank(privateResource.id);
  const privateStructure = structure(privateJob).page;
  assert(!privateStructure.rawText.includes("teacher@example.test"));
  assert(
    privateStructure.nativeRecovery.native.lines.some((line) =>
      line.text.includes("teacher@example.test"),
    ),
  );
  assert(
    query(
      "SELECT id FROM resource_chunks WHERE resource_id=? AND page_number=1 AND contains_personal_data<>0",
      [privateResource.id],
    ).length > 0,
  );
  report.nativePrivacy = {
    rawOcrContainsContact: false,
    nativeContainsContact: true,
    privatePage: true,
  };
  check(
    "Contact text found only in the native PDF layer retains page-level privacy authority while the original OCR stays unchanged",
  );
  await app.close();
  app = undefined;
  await launch();
  await gallery(
    query("SELECT * FROM question_bank_items WHERE id=?", [
      newQuestions[0].id,
    ])[0],
  );
  await gallery(
    query("SELECT * FROM question_bank_items WHERE id=?", [teacher.id])[0],
  );
  assert.equal(sha(fs.readFileSync(legacy.local_path)), oldSourceHash);
  for (const row of before)
    assert.deepEqual(
      query("SELECT * FROM question_bank_items WHERE id=?", [row.id])[0],
      row,
    );
  assert.equal(identity(runtime).sha256, tree.sha256);
  assert.equal(report.errors.length, 0);
  check(
    "Cold restart authenticates both the new native-assisted source and the earlier teacher source while historical facts remain unchanged",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: report.checks.length,
      runtimeTreeSha256: tree.sha256,
      legacy: report.legacy,
      fresh: report.fresh,
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
