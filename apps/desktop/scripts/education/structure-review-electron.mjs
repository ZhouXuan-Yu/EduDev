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
    path.join(root, "structure-review-final.json"),
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
async function checkFormLayout(form) {
  for (const key of [
    "subject",
    "grade",
    "knowledgePoint",
    "questionType",
    "stem",
    "answer",
    "analysis",
  ]) {
    const control = form.getByTestId("structure-review-" + key);
    await control.scrollIntoViewIfNeeded();
    const layout = await control.evaluate((node) => {
      const label = node.parentElement;
      const parent = label.parentElement;
      return {
        width: node.getBoundingClientRect().width,
        parentWidth: parent.getBoundingClientRect().width,
        direction: getComputedStyle(label).flexDirection,
        border: getComputedStyle(node).borderTopWidth,
      };
    });
    assert.equal(layout.direction, "column");
    assert(layout.width >= layout.parentWidth - 4);
    assert(parseFloat(layout.border) > 0);
  }
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
  actual.forEach((bytes, index) =>
    assert.equal(sha(Buffer.from(bytes, "base64")), expected[index].sha256),
  );
  return card;
}
function write(sql, args = []) {
  const db = new DatabaseSync(path.join(root, "data", "app.db"));
  try {
    db.exec("PRAGMA busy_timeout=5000");
    db.prepare(sql).run(...args);
  } finally {
    db.close();
  }
}
let restoreStatus;
try {
  const resource = query(
    "SELECT * FROM teacher_resources WHERE original_file_name='synthetic-two-column.pdf'",
  )[0];
  assert(resource);
  const originalJob = query(
    "SELECT * FROM material_structure_jobs WHERE resource_id=?",
    [resource.id],
  )[0];
  const rawRow = query(
    "SELECT * FROM material_structure_questions WHERE generation=? AND json_extract(body_json,'$.number')='1'",
    [originalJob.generation],
  )[0];
  const raw = JSON.parse(rawRow.body_json);
  assert.equal(raw.status, "needs_review");
  assert.equal(raw.options.length, 3);
  const bankBefore = query("SELECT * FROM question_bank_items ORDER BY id");
  const rawBefore = query(
    "SELECT * FROM material_structure_questions ORDER BY generation,id",
  );
  const originalHash = sha(fs.readFileSync(resource.local_path));
  await launch();
  let panel = await openStructure(resource);
  const review = panel.getByTestId("structure-review-" + raw.id);
  const already = query(
    "SELECT * FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=?",
    [resource.id, resource.content_hash, raw.id],
  )[0];
  let saved;
  if (!already) {
    await panel
      .getByRole("button", { name: "对照原始页图", exact: true })
      .click();
    await until(async () => {
      const image = panel.getByTestId("structure-source-image");
      return (
        (await image.count()) &&
        (await image.evaluate((node) => node.complete && node.naturalWidth > 0))
      );
    });
    await review.getByTestId("structure-review-open").click();
    let form = review.getByTestId("structure-review-form");
    await form
      .getByTestId("structure-review-stem")
      .fill(raw.stem + " 未保存输入");
    await form.getByTestId("structure-review-cancel").click();
    assert.equal(
      query("SELECT COUNT(*) n FROM material_structure_reviews")[0].n,
      0,
    );
    check(
      "Cancel discards only the local correction and writes no bank item or review receipt",
    );
    await review.getByTestId("structure-review-open").click();
    form = review.getByTestId("structure-review-form");
    const corrected = raw.stem.replace(/(^|\n)D[.．]/u, "$1C. 六米\nD.");
    assert.notEqual(corrected, raw.stem);
    assert(corrected.includes("C. 六米"));
    const fields = {
      stem: corrected,
      answer: "D",
      analysis: "匀速直线运动的路程等于速度乘时间，二乘五等于十米。",
      subject: "物理",
      grade: "初三",
      knowledgePoint: "匀速直线运动",
      questionType: "选择题",
      difficulty: "easy",
    };
    for (const [key, value] of Object.entries(fields)) {
      const control = form.getByTestId("structure-review-" + key);
      if (key === "difficulty") await control.selectOption(value);
      else await control.fill(value);
    }
    assert(await panel.getByTestId("structure-next").isDisabled());
    assert(await panel.getByTestId("structure-rebuild").isDisabled());
    await productEntry(page, "teaching").click();
    assert(await form.isVisible());
    assert.equal(
      await form.getByTestId("structure-review-stem").inputValue(),
      corrected,
    );
    assert(await form.getByTestId("structure-review-save").isDisabled());
    await form.getByTestId("structure-review-checked").check();
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await checkFormLayout(form);
      await form.getByTestId("structure-review-save").scrollIntoViewIfNeeded();
      const box = await form.getByTestId("structure-review-save").boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= viewport.height);
      await page.screenshot({
        path: path.join(root, `structure-review-${viewport.width}.png`),
        fullPage: true,
      });
    }
    check(
      "Original materials UI restores the omitted printed option, requires source check and preserves the draft across navigation attempts at both desktop sizes",
    );
    // Fault injection changes only the derivative job status, then restores its exact prior value.
    restoreStatus = { id: resource.id, status: originalJob.status };
    write(
      "UPDATE material_structure_jobs SET status='running' WHERE resource_id=?",
      [resource.id],
    );
    await form.getByTestId("structure-review-save").click();
    await review.getByRole("alert").waitFor();
    assert.equal(
      await form.getByTestId("structure-review-stem").inputValue(),
      corrected,
    );
    assert.equal(
      query("SELECT COUNT(*) n FROM material_structure_reviews")[0].n,
      0,
    );
    write("UPDATE material_structure_jobs SET status=? WHERE resource_id=?", [
      originalJob.status,
      resource.id,
    ]);
    restoreStatus = undefined;
    check(
      "A stale/background-changing source rejects publication and retains all teacher input for retry",
    );
    const started = Date.now();
    await form.getByTestId("structure-review-save").click();
    await until(
      () =>
        query(
          "SELECT * FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=?",
          [resource.id, resource.content_hash, raw.id],
        )[0],
    );
    report.saveMs = Date.now() - started;
    await panel.getByTestId("structure-reviewed-" + raw.id).waitFor();
    const receipt = query(
      "SELECT * FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=?",
      [resource.id, resource.content_hash, raw.id],
    )[0];
    saved = query("SELECT * FROM question_bank_items WHERE id=?", [
      receipt.question_id,
    ])[0];
    assert.equal(saved.stem, corrected);
    const archive = JSON.parse(saved.archive_json);
    assert.equal(archive.sourceChecked, true);
    assert.equal(archive.state, "teacher_edited");
    assert(archive.structureReview);
    assert.deepEqual(archive.issues, []);
    const results = await page.evaluate(
      async (input) =>
        Promise.all([
          window.omniEdu.reviewMaterialStructure(input),
          window.omniEdu.reviewMaterialStructure(input),
        ]),
      {
        schemaVersion: "xiaozhi.structure-review.v1",
        reference: archive.structure,
        fields,
        sourceChecked: true,
      },
    );
    assert(results.every((q) => q.id === saved.id));
    assert.equal(
      query("SELECT COUNT(*) n FROM material_structure_reviews")[0].n,
      1,
    );
    check(
      "Teacher correction and immutable receipt commit atomically; identical concurrent retries return the same question",
    );
  } else {
    saved = query("SELECT * FROM question_bank_items WHERE id=?", [
      already.question_id,
    ])[0];
    await panel.getByTestId("structure-reviewed-" + raw.id).waitFor();
    report.reusedExistingReview = true;
    const other = query(
      "SELECT r.*,q.id candidate_id FROM material_structure_questions q JOIN material_structure_jobs j ON j.generation=q.generation JOIN teacher_resources r ON r.id=j.resource_id WHERE q.status='needs_review' AND json_extract(q.body_json,'$.kind')='question' AND NOT EXISTS(SELECT 1 FROM json_each(q.body_json,'$.issues') i WHERE i.value IN ('missing_figure','missing_question_start','oversized_question')) AND NOT EXISTS(SELECT 1 FROM material_structure_reviews v WHERE v.resource_id=r.id AND v.version=r.content_hash AND v.candidate_id=q.id) LIMIT 1",
    )[0];
    assert(
      other,
      "An unreviewed source remains available for final layout checks",
    );
    const otherPanel = await openStructure(other);
    // The selected fixture can start later in its source. Navigate using the original page controls.
    const first = query(
      "SELECT first_page FROM material_structure_questions WHERE id=? ORDER BY rowid DESC LIMIT 1",
      [other.candidate_id],
    )[0].first_page;
    for (let index = 1; index < first; index++) {
      await otherPanel.getByTestId("structure-next").click();
      await until(
        async () =>
          await otherPanel
            .getByText("第 " + (index + 1) + " 页", { exact: true })
            .count(),
      );
    }
    const otherReview = otherPanel.getByTestId(
      "structure-review-" + other.candidate_id,
    );
    await otherReview.getByTestId("structure-review-open").click();
    const form = otherReview.getByTestId("structure-review-form");
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await checkFormLayout(form);
      await form.getByTestId("structure-review-stem").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(
          root,
          `structure-review-layout-final-${viewport.width}.png`,
        ),
        fullPage: true,
      });
    }
    await form.getByTestId("structure-review-cancel").click();
    check(
      "Final layout stacks labels and full-width bordered controls at both desktop sizes; cancel preserves the source",
    );
  }
  let card = await gallery(saved);
  await card.getByTestId("question-archive-edit-" + saved.id).click();
  let edit = card.getByTestId("question-archive-form");
  const originalAnswer = saved.answer;
  await edit
    .getByTestId("question-archive-answer")
    .fill(originalAnswer + "（教师复查）");
  await edit.getByTestId("question-archive-save").click();
  await until(
    async () => !(await card.getByTestId("question-archive-form").count()),
  );
  await card.getByTestId("question-archive-edit-" + saved.id).click();
  edit = card.getByTestId("question-archive-form");
  await edit.getByTestId("question-archive-answer").fill(originalAnswer);
  await edit.getByTestId("question-archive-save").click();
  await until(
    async () => !(await card.getByTestId("question-archive-form").count()),
  );
  saved = query("SELECT * FROM question_bank_items WHERE id=?", [saved.id])[0];
  await gallery(saved);
  check(
    "The existing notebook editor saves and restores the corrected question while every source crop matches its stored PNG hash",
  );
  await app.close();
  app = undefined;
  await launch();
  panel = await openStructure(resource);
  await panel.getByTestId("structure-reviewed-" + raw.id).waitFor();
  saved = query("SELECT * FROM question_bank_items WHERE id=?", [saved.id])[0];
  await gallery(saved);
  assert.equal(JSON.parse(saved.archive_json).sourceChecked, true);
  assert(saved.stem.includes("C. 六米"));
  assert.deepEqual(
    query("SELECT * FROM material_structure_questions ORDER BY generation,id"),
    rawBefore,
  );
  for (const before of bankBefore.filter((q) => q.id !== saved.id))
    assert.deepEqual(
      query("SELECT * FROM question_bank_items WHERE id=?", [before.id])[0],
      before,
    );
  assert.equal(sha(fs.readFileSync(resource.local_path)), originalHash);
  assert.equal(identity(runtime).sha256, tree.sha256);
  assert.equal(report.errors.length, 0);
  report.originalCandidateSha256 = rawRow.sha256;
  report.reviewReceiptSha256 = query(
    "SELECT sha256 FROM material_structure_reviews WHERE question_id=?",
    [saved.id],
  )[0].sha256;
  report.bankBefore = bankBefore.length;
  report.bankAfter = query("SELECT COUNT(*) n FROM question_bank_items")[0].n;
  check(
    "Cold launch retains the teacher correction and source gallery while original OCR candidates, prior bank rows and the PDF remain identical",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: report.checks.length,
      runtimeTreeSha256: tree.sha256,
      saveMs: report.saveMs,
    }),
  );
} catch (error) {
  report.failure = String(error.stack || error);
  save();
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  if (restoreStatus)
    write("UPDATE material_structure_jobs SET status=? WHERE resource_id=?", [
      restoreStatus.status,
      restoreStatus.id,
    ]);
  await app?.close().catch(() => {});
}
