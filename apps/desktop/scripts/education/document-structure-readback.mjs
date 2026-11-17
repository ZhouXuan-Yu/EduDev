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
    path.join(root, "readback-final.json"),
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
async function gallery(q) {
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
  for (let index = 0; index < actual.length; index++)
    assert.equal(
      sha(Buffer.from(actual[index], "base64")),
      expected[index].sha256,
    );
  return card;
}
try {
  await launch();
  const image = query(
    "SELECT * FROM teacher_resources WHERE original_file_name LIKE '%.png'",
  )[0];
  assert(image);
  const bankBefore = query(
    "SELECT id,archive_json,document_json FROM question_bank_items ORDER BY id",
  );
  const recoveryStarted = Date.now();
  const chunksBefore = query(
    "SELECT id,resource_id,chunk_index,content_md,page_number FROM resource_chunks ORDER BY id",
  );
  for (const resource of query(
    "SELECT * FROM teacher_resources ORDER BY rowid",
  )) {
    const oldJob = query(
      "SELECT generation FROM material_structure_jobs WHERE resource_id=?",
      [resource.id],
    )[0];
    const sourcePanel = await openStructure(resource);
    await sourcePanel.getByTestId("structure-rebuild").click();
    await until(() => {
      const job = query(
        "SELECT generation,status FROM material_structure_jobs WHERE resource_id=?",
        [resource.id],
      )[0];
      return (
        job.generation !== oldJob.generation &&
        ["complete", "partial"].includes(job.status)
      );
    });
    const rows = query(
      "SELECT c.id FROM material_structure_chunks c JOIN material_structure_jobs j ON j.generation=c.generation WHERE j.resource_id=?",
      [resource.id],
    );
    if (!/\.docx$/i.test(resource.original_file_name)) {
      const missing = query(
        "SELECT c.id FROM material_structure_chunks c JOIN material_structure_jobs j ON j.generation=c.generation WHERE j.resource_id=? AND NOT EXISTS(SELECT 1 FROM resource_chunks r WHERE r.resource_id=j.resource_id AND r.page_number=c.page AND r.content_md=json_extract(c.body_json,'$.content'))",
        [resource.id],
      );
      assert.equal(
        missing.length,
        0,
        "Every recovered source unit remains document-searchable",
      );
      assert(rows.length > 0);
    }
  }
  const chunksAfter = new Map(
    query(
      "SELECT id,resource_id,chunk_index,content_md,page_number FROM resource_chunks",
    ).map((row) => [row.id, row]),
  );
  for (const before of chunksBefore)
    assert.deepEqual(chunksAfter.get(before.id), before);
  assert.deepEqual(
    query(
      "SELECT id,archive_json,document_json FROM question_bank_items ORDER BY id",
    ),
    bankBefore,
  );
  const heldSource = query(
    "SELECT r.* FROM resource_chunks r WHERE r.heading LIKE '待核原始资料%' ORDER BY r.rowid LIMIT 1",
  )[0];
  assert(heldSource);
  assert(heldSource.quality_score <= 49);
  assert.equal(heldSource.source_trust, "machine_extracted");
  const sourceBody = await page.evaluate(
    async (id) =>
      window.omniEdu.getMaterialBody({
        schemaVersion: "xiaozhi.materials.v1",
        resourceId: id,
        offset: 0,
      }),
    heldSource.resource_id,
  );
  assert(sourceBody.total > 0);
  report.sourceRetention = {
    beforeChunks: chunksBefore.length,
    afterChunks: chunksAfter.size,
    bankCandidates: bankBefore.length,
    rebuildMs: Date.now() - recoveryStarted,
  };
  check(
    "Explicit rebuild retains held document source for retrieval, keeps native Word paragraphs and preserves historical chunk offsets and bank facts",
  );
  let panel = await openStructure(image);
  await panel.getByTestId("structure-rebuild").click();
  await panel.getByTestId("structure-cancel").waitFor();
  await panel.getByTestId("structure-cancel").click();
  await until(
    () =>
      query("SELECT status FROM material_structure_jobs WHERE resource_id=?", [
        image.id,
      ])[0].status === "cancelled",
  );
  assert.deepEqual(
    query(
      "SELECT id,archive_json,document_json FROM question_bank_items ORDER BY id",
    ),
    bankBefore,
  );
  await panel.getByTestId("structure-retry").click();
  await until(() =>
    ["complete", "partial"].includes(
      query("SELECT status FROM material_structure_jobs WHERE resource_id=?", [
        image.id,
      ])[0].status,
    ),
  );
  check(
    "Original structure controls cancel and resume a rebuild without losing question facts or source documents",
  );
  await panel.getByRole("button", { name: "刷新", exact: true }).click();
  await panel.getByTestId("structure-rebuild").click();
  await panel.getByTestId("structure-cancel").waitFor();
  await app.close();
  app = undefined;
  await launch();
  await until(() =>
    ["complete", "partial"].includes(
      query("SELECT status FROM material_structure_jobs WHERE resource_id=?", [
        image.id,
      ])[0].status,
    ),
  );
  const restored = query(
    "SELECT parse_status,parse_engine FROM teacher_resources WHERE id=?",
    [image.id],
  )[0];
  assert.equal(restored.parse_status, "ready");
  assert(!/:(cancelled|parse_failed|timeout)$/.test(restored.parse_engine));
  assert.equal(
    query("SELECT COUNT(*) n FROM question_bank_items")[0].n,
    bankBefore.length,
  );
  check(
    "Graceful exit and restart resume the pending generation and clear stale parser failure state",
  );
  await productEntry(page, "teaching").click();
  await page.getByRole("button", { name: "题本", exact: true }).click();
  const bank = query(
    "SELECT q.* FROM question_bank_items q WHERE json_extract(q.archive_json,'$.schemaVersion')='xiaozhi.question-archive.structure.v1' ORDER BY q.rowid",
  );
  const selected = [
    ...new Map(
      bank.map((q) => [JSON.parse(q.archive_json).structure.resourceId, q]),
    ).values(),
  ];
  for (const q of selected) await gallery(q);
  check(
    "Real PDF, image and Word question crops remain readable through the original notebook gallery after rebuild and cold launch",
  );
  const q = selected[0];
  let card = await gallery(q);
  const edit = async (answer) => {
    await card.getByTestId("question-archive-edit-" + q.id).click();
    const form = card.getByTestId("question-archive-form");
    await form.waitFor();
    await form.getByTestId("question-archive-answer").fill(answer);
    await form.locator("select").selectOption(q.difficulty);
    await form.getByTestId("question-archive-save").click();
    await until(
      async () => !(await card.getByTestId("question-archive-form").count()),
    );
  };
  await edit("本地验收教师补充答案");
  await edit(q.answer);
  const edited = query("SELECT * FROM question_bank_items WHERE id=?", [
      q.id,
    ])[0],
    archive = JSON.parse(edited.archive_json),
    document = JSON.parse(edited.document_json);
  assert.equal(archive.sourceChecked, false);
  assert.equal(archive.state, "teacher_edited");
  assert.equal(document.answer.text, q.answer);
  assert.deepEqual(
    document.blocks.filter((b) => b.kind === "image"),
    JSON.parse(q.document_json).blocks.filter((b) => b.kind === "image"),
  );
  await page.getByTestId("question-notebook-search").fill("");
  await gallery(edited);
  check(
    "Original teacher editor saves and restores an answer while keeping unverified status and authentic source images",
  );
  for (const resource of query(
    "SELECT local_path,content_hash FROM teacher_resources",
  ))
    assert.equal(
      sha(fs.readFileSync(resource.local_path)),
      resource.content_hash,
    );
  assert.equal(identity(runtime).sha256, tree.sha256);
  assert.equal(report.errors.length, 0);
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      runtimeTreeSha256: tree.sha256,
      checks: report.checks.length,
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
