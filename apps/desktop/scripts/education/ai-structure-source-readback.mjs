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
    path.join(root, "ai-structure-readback-final.json"),
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

try {
  const live = JSON.parse(
    fs.readFileSync(path.join(root, "ai-structure-live-final.json")),
  );
  assert(live.ok);
  report.featureInputRuntimeTreeSha256 = live.runtimeTreeSha256;
  const resource = query(
    "SELECT * FROM teacher_resources WHERE original_file_name='native-recovery-two-column.pdf'",
  )[0];
  const before = query(
    "SELECT * FROM material_ai_response_receipts ORDER BY rowid",
  );
  const paidBefore = query("SELECT SUM(calls) n FROM material_ai_batches")[0].n;
  await launch();
  await openStructure(resource);
  const ai = page.getByTestId("material-ai-panel");
  await openMaterialDisclosure(ai);
  const card = ai.locator(`[data-batch-id="${live.batchId}"]`);
  await card.waitFor();
  await until(
    async () => (await card.getAttribute("data-status")) !== "running",
  );
  await card.getByTestId("material-ai-page-open").click();
  await card.getByTestId("material-ai-structure-source").waitFor();
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await card
      .getByTestId("material-ai-structure-source")
      .scrollIntoViewIfNeeded();
    assert(
      (await card.getByTestId("material-ai-summary").innerText()).includes(
        "调用3/6",
      ),
    );
    assert(
      (
        await card.getByTestId("material-ai-structure-source").innerText()
      ).includes("补充识别1行"),
    );
    await page.screenshot({
      path: path.join(root, `ai-structure-final-${width}.png`),
    });
  }
  check(
    "Final terminal batch status and structure provenance remain visible at both desktop sizes without new provider calls",
  );
  await productEntry(page, "teaching").click();
  await page.getByRole("button", { name: "题本", exact: true }).click();
  const questions = query(
    "SELECT q.* FROM material_ai_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.batch_id=? ORDER BY m.number",
    [live.batchId],
  );
  for (const q of questions) {
    await page
      .getByTestId("question-notebook-search")
      .fill(q.stem.slice(0, 32));
    const item = page.getByTestId("question-notebook-card-" + q.id);
    await item.waitFor();
    if (await item.getByTestId("question-original-open").count())
      await item.getByTestId("question-original-open").click();
    const images = item.getByTestId("question-original-image");
    await until(
      async () =>
        (await images.count()) > 0 &&
        (await images.evaluateAll((nodes) =>
          nodes.every((node) => node.complete && node.naturalWidth > 0),
        )),
    );
    const actual = await images.evaluateAll((nodes) =>
      nodes.map((node) => node.src.split(",")[1]),
    );
    const number = JSON.parse(q.archive_json).number;
    const saved = JSON.parse(
      query(
        "SELECT image_json FROM material_ai_page_crops WHERE batch_id=? AND ordinal=1 AND number=?",
        [live.batchId, number],
      )[0].image_json,
    );
    const expected = saved.fragments
      ? saved.fragments.map((fragment) => fragment.image.sha256)
      : [(saved.image || saved).sha256];
    assert.equal(actual.length, expected.length);
    actual.forEach((bytes, index) =>
      assert.equal(sha(Buffer.from(bytes, "base64")), expected[index]),
    );
  }
  check(
    "All four current AI questions reopen their exact saved pending source crops through the existing notebook gallery",
  );
  const prior = JSON.parse(
    fs.readFileSync(path.join(root, "ai-structure-old-paid-before-final.json")),
  );
  const rows = Object.fromEntries(
    Object.keys(prior.rows).map((table) => [
      table,
      query("SELECT * FROM " + table + " WHERE batch_id=? ORDER BY rowid", [
        prior.batchId,
      ]),
    ]),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), prior.rows);
  assert.deepEqual(
    query("SELECT * FROM material_ai_response_receipts ORDER BY rowid"),
    before,
  );
  assert.equal(
    query("SELECT SUM(calls) n FROM material_ai_batches")[0].n,
    paidBefore,
  );
  assert.equal(report.errors.length, 0);
  report.paidCalls = paidBefore;
  report.questions = questions.length;
  check(
    "Earlier paid inputs/responses, current receipts and call counters remain byte-identical during source readback",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: report.checks.length,
      questions: questions.length,
      addedCalls: 0,
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
