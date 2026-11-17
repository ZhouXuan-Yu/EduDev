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
    path.join(root, "ai-structure-live-final.json"),
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
  assert(
    process.env.DEEPSEEK_API_KEY,
    "Existing authorized DeepSeek environment key is required",
  );
  const resource = query(
    "SELECT * FROM teacher_resources WHERE original_file_name='native-recovery-two-column.pdf'",
  )[0];
  assert(resource);
  const oldBank = query("SELECT * FROM question_bank_items ORDER BY id");
  const oldBatches = new Set(
    query("SELECT id FROM material_ai_batches").map((row) => row.id),
  );
  const oldPages = query(
    "SELECT * FROM material_structure_pages ORDER BY generation,page",
  );
  const originalSha = sha(fs.readFileSync(resource.local_path));
  await launch();
  const configuration = query(
    "SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'",
  )[0];
  const settings = await page.evaluate(
    async (input) => window.omniEdu.saveXiaozhiSettings(input),
    {
      schemaVersion: "xiaozhi.settings.v1",
      version: configuration
        ? JSON.parse(configuration.value_json).revision
        : 0,
      defaultModel: "deepseek-flash",
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
  );
  assert(settings.ok, settings.error);
  assert(settings.value.configured);
  await app.evaluate(async ({ net }) => {
    const { createHash } = process.getBuiltinModule("node:crypto");
    const actual = net.fetch.bind(net);
    globalThis.__eduStructureTransport = [];
    net.fetch = async (url, options) => {
      if (
        String(url) === "https://api.deepseek.com/chat/completions" &&
        typeof options?.body === "string"
      ) {
        const request = JSON.parse(options.body);
        const content = request.messages?.find(
          (message) => message.role === "user",
        )?.content;
        const value = JSON.parse(
          content.find((item) => item.type === "text").text,
        );
        const context = value.pageContext?.structureContext;
        globalThis.__eduStructureTransport.push({
          hasContext: !!context,
          literalChoiceFormat: request.messages[0].content.includes(
            "printed-choice-literal-answer.v1",
          ),
          contextSha256: context
            ? createHash("sha256").update(JSON.stringify(context)).digest("hex")
            : null,
          paragraphs: context?.paragraphs.length || 0,
          supplemental: context?.supplemental.length || 0,
          hasBlockHints: !!value.pageContext?.blockTexts,
          hasMaterial: typeof value.material === "string",
          hasSupplementalText: !!context?.supplemental.some((line) =>
            line.text.includes("六米"),
          ),
          imageCount: content.filter((item) => item.type === "image_url")
            .length,
        });
      }
      return actual(url, options);
    };
  });
  await openStructure(resource);
  const ai = page.getByTestId("material-ai-panel");
  await openMaterialDisclosure(ai);
  await ai.getByTestId("material-ai-refresh-settings").click();
  await until(async () =>
    (await ai.getByTestId("material-ai-shared-settings").innerText()).includes(
      "已读取",
    ),
  );
  await ai.getByTestId("material-ai-start").fill("1");
  await ai.getByTestId("material-ai-count").fill("1");
  await ai.getByTestId("material-ai-budget").fill("6");
  await ai.getByTestId("material-ai-images").check();
  await ai.getByTestId("material-ai-public").check();
  await ai.getByTestId("material-ai-consent").check();
  await ai.getByTestId("material-ai-create").click();
  const batch = await until(() =>
    query("SELECT * FROM material_ai_batches ORDER BY rowid DESC").find(
      (row) => !oldBatches.has(row.id),
    ),
  );
  report.batchId = batch.id;
  save();
  const input = query(
    "SELECT input_json FROM material_ai_units WHERE batch_id=? AND ordinal=1",
    [batch.id],
  )[0].input_json;
  const frozen = JSON.parse(input),
    context = frozen.pagePrompt.structureContext;
  assert(context && context.supplemental.length === 1);
  assert(
    frozen.pagePrompt.blockTexts.some((block) => block.text.includes("六米")),
  );
  report.input = {
    sha256: sha(Buffer.from(input)),
    bytes: Buffer.byteLength(input),
    contextBytes: Buffer.byteLength(JSON.stringify(context)),
    paragraphs: context.paragraphs.length,
    supplemental: context.supplemental.length,
  };
  check(
    "Original AI authorization freezes the authenticated local paragraphs and missing-option OCR evidence in the new quality batch",
  );
  const started = Date.now();
  let last = "";
  await until(() => {
    const current = query("SELECT * FROM material_ai_batches WHERE id=?", [
      batch.id,
    ])[0];
    const unit = query(
      "SELECT status,error FROM material_ai_units WHERE batch_id=? AND ordinal=1",
      [batch.id],
    )[0];
    const state = JSON.stringify({
      status: current.status,
      calls: current.calls,
      unit: unit.status,
      error: unit.error,
    });
    if (state !== last) {
      console.log(state);
      last = state;
    }
    return current.status !== "running" ? current : undefined;
  }, 900000);
  const finalBatch = query("SELECT * FROM material_ai_batches WHERE id=?", [
    batch.id,
  ])[0];
  const finalUnit = query(
    "SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=1",
    [batch.id],
  )[0];
  report.result = {
    status: finalBatch.status,
    unitStatus: finalUnit.status,
    error: finalUnit.error,
    calls: finalBatch.calls,
    elapsedMs: Date.now() - started,
  };
  report.transport = await app.evaluate(
    () => globalThis.__eduStructureTransport,
  );
  save();
  assert(["complete", "review"].includes(finalUnit.status), finalUnit.error);
  assert.equal(
    finalUnit.input_json,
    input,
    "Paid input remains byte-identical",
  );
  assert(
    report.transport[0].hasContext && report.transport[0].hasSupplementalText,
  );
  assert.equal(
    report.transport[0].contextSha256,
    sha(Buffer.from(JSON.stringify(context))),
  );
  assert(report.transport.at(-1).literalChoiceFormat);
  assert(
    report.transport
      .slice(1)
      .every(
        (call) => !call.hasContext && !call.hasBlockHints && !call.hasMaterial,
      ),
  );
  check(
    "Real DeepSeek receives restored evidence on the first pass while later independent visual reading omits all OCR and paragraph hints",
  );
  const added = query(
    "SELECT q.* FROM material_ai_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.batch_id=? ORDER BY m.number",
    [batch.id],
  );
  assert.equal(
    added.length,
    4,
    "All four printed questions must remain represented",
  );
  assert(added.some((row) => row.stem.includes("六米")));
  for (const row of added) {
    assert.equal(JSON.parse(row.archive_json).sourceChecked, false);
    assert(
      !JSON.parse(row.archive_json).issues.includes("answer_conflict"),
      "Letter-only answer formatting must not introduce a false answer conflict",
    );
  }
  const after = new Map(
    query("SELECT * FROM question_bank_items ORDER BY id").map((row) => [
      row.id,
      row,
    ]),
  );
  for (const row of oldBank) assert.deepEqual(after.get(row.id), row);
  assert.deepEqual(
    query("SELECT * FROM material_structure_pages ORDER BY generation,page"),
    oldPages,
  );
  assert.equal(sha(fs.readFileSync(resource.local_path)), originalSha);
  report.result.questions = added.length;
  report.result.states = added.map((row) => JSON.parse(row.archive_json).state);
  report.result.issues = added.map(
    (row) => JSON.parse(row.archive_json).issues,
  );
  check(
    "Four real AI results preserve the printed missing option, keep unverified provenance and protect every earlier bank/source row",
  );
  async function show() {
    await openStructure(resource);
    const ai = page.getByTestId("material-ai-panel");
    await openMaterialDisclosure(ai);
    const card = ai.locator(`[data-batch-id="${batch.id}"]`);
    await card.waitFor();
    await card.getByTestId("material-ai-page-open").click();
    await card.getByTestId("material-ai-structure-source").waitFor();
    assert(
      (
        await card.getByTestId("material-ai-structure-source").innerText()
      ).includes("补充识别1行"),
    );
    assert(
      (await card.getByTestId("material-ai-page-text").innerText()).includes(
        "六米",
      ),
    );
    assert.equal(await card.getByTestId("material-ai-page-error").count(), 0);
    return card;
  }
  let card = await show();
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await card
      .getByTestId("material-ai-structure-source")
      .scrollIntoViewIfNeeded();
    const bounds = await card
      .getByTestId("material-ai-structure-source")
      .boundingBox();
    assert(
      bounds &&
        bounds.width > 50 &&
        bounds.x >= 0 &&
        bounds.x + bounds.width <= width,
    );
    await page.screenshot({
      path: path.join(root, `ai-structure-${width}.png`),
    });
  }
  check(
    "Both desktop sizes expose authenticated structure evidence and the actual restored AI transcript through the original materials navigation",
  );
  const receiptRows = query(
    "SELECT * FROM material_ai_response_receipts WHERE batch_id=? ORDER BY rowid",
    [batch.id],
  );
  await app.close();
  app = undefined;
  await launch();
  await show();
  assert.equal(
    query(
      "SELECT input_json FROM material_ai_units WHERE batch_id=? AND ordinal=1",
      [batch.id],
    )[0].input_json,
    input,
  );
  assert.deepEqual(
    query(
      "SELECT * FROM material_ai_response_receipts WHERE batch_id=? ORDER BY rowid",
      [batch.id],
    ),
    receiptRows,
  );
  for (const row of oldBank)
    assert.deepEqual(
      query("SELECT * FROM question_bank_items WHERE id=?", [row.id])[0],
      row,
    );
  assert.equal(report.errors.length, 0);
  assert.equal(identity(runtime).sha256, tree.sha256);
  check(
    "Cold launch authenticates the new frozen structure input and real paid responses without rewriting old teacher facts",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: report.checks.length,
      runtimeTreeSha256: tree.sha256,
      ...report.result,
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
