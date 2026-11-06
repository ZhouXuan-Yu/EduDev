import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const desktop = process.cwd();
const retained = process.argv[2] ? fs.realpathSync(process.argv[2]) : undefined;
const seed = retained
  ? undefined
  : execFileSync(
      process.execPath,
      [
        "--experimental-transform-types",
        "scripts/education/kb-source-content-journey.mjs",
        "--partition-whitespace",
      ],
      { encoding: "utf8", maxBuffer: 4 * 1048576, windowsHide: true },
    );
const output = retained || seed?.match(/^OUTPUT (.+)$/m)?.[1].trim();
assert(
  output &&
    path.dirname(output).toLowerCase() ===
      fs.realpathSync(os.tmpdir()).toLowerCase(),
);
assert(path.basename(output).startsWith("omni-source-content-ui-"));
assert(JSON.parse(fs.readFileSync(path.join(output, "report.json"))).success);
if (seed) fs.writeFileSync(path.join(output, "receipt-seed.log"), seed);
if (retained && fs.existsSync(path.join(output, "receipt-report.json")))
  fs.copyFileSync(
    path.join(output, "receipt-report.json"),
    path.join(output, "receipt-prior-" + Date.now() + ".json"),
  );
const data = path.join(output, "data");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sql = (query, args = []) => {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true });
  try {
    return db.prepare(query).all(...args);
  } finally {
    db.close();
  }
};
const until = async (action) => {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const result = await action();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Inspect retained response-receipt fixture");
};
const report = {
  output,
  buildSha256: hash(fs.readFileSync("out/main/index.js")),
  checks: [],
  rendererErrors: [],
  cloudCalls: 0,
};
const invalidBody =
  "RECEIVED_INVALID_BODY <script>globalThis.receiptXssExecuted=true</script>";
const requestFile = path.join(output, "receipt-invalid-calls.json");
const goodBatch = sql("SELECT id FROM material_ai_batches ORDER BY rowid")[0]
  .id;
const source = sql("SELECT id,title FROM teacher_resources")[0];
let app, page, badBatch;
async function launch(cold = false) {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_E2E_VISIBLE: "0",
  };
  for (const key of [
    "ELECTRON_RUN_AS_NODE",
    "NODE_OPTIONS",
    "ELECTRON_RENDERER_URL",
    "DEEPSEEK_API_KEY",
  ])
    delete env[key];
  app = await _electron.launch({
    args: [
      path.join(desktop, "out/main/index.js"),
      "--user-data-dir=" + path.join(output, "profile"),
    ],
    cwd: output,
    env,
    timeout: 60000,
  });
  await app.evaluate(
    ({ net }, { cold, requestFile, invalidBody }) => {
      const fs = process.getBuiltinModule("fs");
      globalThis.receiptNetworkAttempts = 0;
      for (const owner of [net, globalThis])
        owner.fetch = async (url) => {
          globalThis.receiptNetworkAttempts++;
          if (cold) throw Error("Cold response viewing must remain offline");
          if (/\/models$/.test(String(url)))
            return new Response(
              JSON.stringify({
                object: "list",
                data: [
                  {
                    id: "deepseek-flash",
                    input_modalities: ["text", "image"],
                    context_window: 1048576,
                    max_output_tokens: 65536,
                  },
                ],
              }),
            );
          if (!String(url).endsWith("/chat/completions"))
            throw Error("Unexpected controlled endpoint");
          const rows = fs.existsSync(requestFile)
            ? JSON.parse(fs.readFileSync(requestFile))
            : [];
          if (rows.length) throw Error("Unexpected repeated model request");
          rows.push({ received: invalidBody, at: new Date().toISOString() });
          fs.writeFileSync(requestFile, JSON.stringify(rows));
          return new Response(invalidBody);
        };
    },
    { cold, requestFile, invalidBody },
  );
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => report.rendererErrors.push(error.message));
  await productEntry(page, "materials").click();
  await page.getByTestId("materials-search").fill(source.title);
  const open = page.getByTestId("material-" + source.id).getByRole("button");
  await open.waitFor();
  assert.equal(await open.count(), 1);
  await open.click();
  await page.getByTestId("materials-section-questions").click();
  await openMaterialDisclosure(page.getByTestId("material-ai-panel"));
}
async function panel(batchId) {
  const batch = page.locator(
    `[data-testid="material-ai-batch"][data-batch-id="${batchId}"]`,
  );
  await batch.waitFor();
  const view = batch.getByTestId("material-ai-responses");
  const trigger = view.getByRole("button", {
    name: "已收到的AI响应",
    exact: true,
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  return view;
}
async function inspect(batchId, responseId, expected) {
  const view = await panel(batchId);
  const row = view.locator(
    `[data-testid="material-ai-response-record"][data-response-id="${responseId}"]`,
  );
  await row.getByRole("button", { name: "查看此响应", exact: true }).click();
  await until(
    async () =>
      (await view
        .getByTestId("material-ai-response-body")
        .textContent()
        .catch(() => "")) === expected,
  );
  assert.equal(
    await page.evaluate(() => globalThis.receiptXssExecuted),
    undefined,
  );
  return view;
}
try {
  console.log("OUTPUT " + output);
  await launch();
  const good = await page.evaluate(
    (batchId) =>
      window.omniEdu.getMaterialAiResponse({
        schemaVersion: "xiaozhi.material-ai-response-receipt.v1",
        batchId,
        ordinal: 1,
      }),
    goodBatch,
  );
  assert.deepEqual(
    good.receipts.map((row) => row.phase),
    ["first", "source", "final"],
  );
  assert(
    good.receipts.every(
      (row) => row.receivedAt && row.format === "provider-envelope.v1",
    ),
  );
  const chosen = good.receipts[1];
  const original = await page.evaluate(
    (query) => window.omniEdu.getMaterialAiResponse(query),
    {
      schemaVersion: good.schemaVersion,
      batchId: goodBatch,
      ordinal: 1,
      responseId: chosen.id,
    },
  );
  await inspect(goodBatch, chosen.id, original.selected.body);
  report.checks.push(
    "Actual completed source batch exposes all three received envelopes through its original teacher UI",
  );
  const unchangedQuestion = hash(
    JSON.stringify(sql("SELECT * FROM question_bank_items ORDER BY id")),
  );
  badBatch = sql("SELECT id FROM material_ai_batches WHERE id<>?", [
    goodBatch,
  ])[0]?.id;
  if (!badBatch) {
    const ai = page.getByTestId("material-ai-panel");
    await ai.getByTestId("material-ai-start").fill("1");
    await ai.getByTestId("material-ai-count").fill("1");
    await ai.getByTestId("material-ai-budget").fill("2");
    for (const key of ["images", "public", "consent"])
      await ai.getByTestId("material-ai-" + key).check();
    await ai.getByTestId("material-ai-create").click();
    badBatch = await until(
      () =>
        sql("SELECT id FROM material_ai_batches WHERE id<>?", [goodBatch])[0]
          ?.id,
    );
  }
  await until(
    () =>
      sql("SELECT status FROM material_ai_units WHERE batch_id=?", [
        badBatch,
      ])[0]?.status === "outcome_unknown",
  );
  assert.equal(JSON.parse(fs.readFileSync(requestFile)).length, 1);
  assert.equal(
    hash(JSON.stringify(sql("SELECT * FROM question_bank_items ORDER BY id"))),
    unchangedQuestion,
  );
  const bad = await page.evaluate(
    (batchId) =>
      window.omniEdu.getMaterialAiResponse({
        schemaVersion: "xiaozhi.material-ai-response-receipt.v1",
        batchId,
        ordinal: 1,
      }),
    badBatch,
  );
  assert.equal(bad.receipts.length, 1);
  const received = bad.receipts[0];
  assert.equal(received.sha256, hash(invalidBody));
  assert.equal(received.bytes, Buffer.byteLength(invalidBody));
  await inspect(badBatch, received.id, invalidBody);
  report.checks.push(
    "Invalid HTTP body is durably captured before rejection, visible as escaped text, and does not create a question or trigger an automatic resend",
  );
  const foreign = await page.evaluate(
    (query) =>
      window.omniEdu.getMaterialAiResponse(query).then(
        () => false,
        () => true,
      ),
    {
      schemaVersion: bad.schemaVersion,
      batchId: badBatch,
      ordinal: 1,
      responseId: chosen.id,
    },
  );
  assert(foreign);
  // Owned test-only fault, restored before the restart/read-only comparison.
  const corrupt = new DatabaseSync(path.join(data, "app.db"));
  corrupt
    .prepare("UPDATE material_ai_response_receipts SET body_sha=? WHERE id=?")
    .run("0".repeat(64), received.id);
  corrupt.close();
  const badPanel = await panel(badBatch);
  await badPanel.getByRole("button", { name: "刷新记录", exact: true }).click();
  await badPanel.getByRole("alert").waitFor();
  const restore = new DatabaseSync(path.join(data, "app.db"));
  restore
    .prepare("UPDATE material_ai_response_receipts SET body_sha=? WHERE id=?")
    .run(received.sha256, received.id);
  restore.close();
  await badPanel.getByRole("button", { name: "重试读取", exact: true }).click();
  await until(
    async () =>
      (await badPanel
        .getByTestId("material-ai-response-body")
        .textContent()
        .catch(() => "")) === invalidBody,
  );
  report.checks.push(
    "Typed reader rejects a foreign receipt and damaged hash, then the actual retry control recovers after restoring the owned test fault",
  );
  const before = hash(
    JSON.stringify(
      sql("SELECT * FROM material_ai_response_receipts ORDER BY id"),
    ),
  );
  async function capture(cold) {
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
    ]) {
      const win = await app.browserWindow(page);
      await win.evaluate(
        (window, size) => window.setContentSize(size.width, size.height),
        { width, height },
      );
      await page.waitForFunction(
        (size) => innerWidth === size.width && innerHeight === size.height,
        { width, height },
      );
      await page
        .getByTestId("material-ai-response-body")
        .filter({ visible: true })
        .scrollIntoViewIfNeeded();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(
          output,
          (cold ? "receipt-cold-" : "receipt-warm-") + width + ".png",
        ),
      });
    }
  }
  // Collapse the good batch so screenshots have one visible response body.
  const oldPanel = await panel(goodBatch);
  await oldPanel
    .getByRole("button", { name: "已收到的AI响应", exact: true })
    .click();
  await capture(false);
  await app.close();
  app = undefined;
  await launch(true);
  await inspect(badBatch, received.id, invalidBody);
  await capture(true);
  assert.equal(
    hash(
      JSON.stringify(
        sql("SELECT * FROM material_ai_response_receipts ORDER BY id"),
      ),
    ),
    before,
  );
  assert.equal(
    hash(JSON.stringify(sql("SELECT * FROM question_bank_items ORDER BY id"))),
    unchangedQuestion,
  );
  assert.equal(JSON.parse(fs.readFileSync(requestFile)).length, 1);
  assert.equal(await app.evaluate(() => globalThis.receiptNetworkAttempts), 0);
  assert.equal(report.rendererErrors.length, 0);
  report.checks.push(
    "Cold teacher UI preserves exact receipt bytes and business facts at both viewport sizes with zero network requests",
  );
  report.goodBatch = goodBatch;
  report.badBatch = badBatch;
  report.success = true;
} catch (error) {
  report.success = false;
  report.error = String(error.stack || error);
  process.exitCode = 1;
  if (page)
    await page
      .screenshot({ path: path.join(output, "receipt-failure.png") })
      .catch(() => {});
} finally {
  if (app) await app.close();
  fs.writeFileSync(
    path.join(output, "receipt-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
