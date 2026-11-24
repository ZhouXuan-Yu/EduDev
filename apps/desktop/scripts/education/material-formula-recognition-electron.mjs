import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { assertIsolatedPiMain, testMain } from "../acceptance/build-root.mjs";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const baseline = process.argv.includes("--baseline");
const root = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const fixture = process.env.OMNI_EDU_SYNTHETIC_FORMULA_PDF;
const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert(root && fixture && sha(fixture) === process.env.OMNI_EDU_SYNTHETIC_FORMULA_SHA);
const output = fs.mkdtempSync(path.join(root, "formula-desktop-"));
const data = path.join(output, "data"), profile = path.join(output, "profile");
const desktop = path.resolve(import.meta.dirname, "../.."), main = testMain(desktop);
const report = { mainSha256: sha(main), fixtureSha256: sha(fixture), checks: [] };
const check = message => { report.checks.push(message); console.log("PASS " + message); };
let app;
function sql(statement) {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true, timeout: 5000 });
  try { return db.prepare(statement).all(); } finally { db.close(); }
}
async function open(withRuntime) {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_XIAOZHI_PI: "1",
    OMNI_EDU_SKIP_DOTENV: "1", OMNI_EDU_REPO_ROOT: path.resolve(desktop, "../..") };
  for (const key of ["NODE_OPTIONS", "ELECTRON_RUN_AS_NODE", "ELECTRON_RENDERER_URL"]) delete env[key];
  if (!withRuntime) for (const key of ["OMNI_EDU_FORMULA_PYTHON", "OMNI_EDU_FORMULA_MODEL_DIR"]) delete env[key];
  app = await _electron.launch({ args: [main, "--user-data-dir=" + profile], cwd: desktop, env, timeout: 60000 });
  await assertIsolatedPiMain(app, main, profile);
  await app.evaluate(({ net, dialog }, source) => {
    net.fetch = async () => { throw Error("External fetch forbidden in this local scenario"); };
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  }, fixture);
  const page = await app.firstWindow();
  await productEntry(page, "materials").click();
  return page;
}
async function openResource(page, resource) {
  await page.getByTestId("materials-search").fill(resource.title);
  await page.getByTestId("material-" + resource.id).getByRole("button").click();
  await page.getByTestId("materials-section-questions").click();
  const panel = page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(panel);
  return panel;
}

const expected = [
  { number: 10, page: 1, latex: "y=\\sqrt{x^{2}+9}" },
  { number: 12, page: 2, latex: "E_{k}=\\frac{1}{2}mv^{2}" },
  { number: 14, page: 3, latex: "\\frac{-3x+2}{5x-7}" },
];
try {
  const page = await open(!baseline);
  await page.getByTestId("materials-import").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="materials-search"]'), null);
  const deadline = Date.now() + 180000;
  let job;
  while (Date.now() < deadline) {
    [job] = sql("SELECT * FROM material_structure_jobs");
    assert.notEqual(job?.status, "failed");
    if (["complete", "partial"].includes(job?.status)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(job.engine, "layout-paragraph-question.v" + (baseline ? "28" : "29"));
  assert.equal(job.processed, 3);
  const [resource] = sql("SELECT id,title,local_path FROM teacher_resources");
  const initialRows = sql("SELECT * FROM material_structure_questions ORDER BY id");
  const panel = await openResource(page, resource);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async text => { window.testFormulaCopy = text; } });
  });
  for (const item of expected) {
    const { id, body_json } = initialRows.find(row => Number(JSON.parse(row.body_json).number) === item.number);
    const question = JSON.parse(body_json);
    const asset = question.assets.find(asset => asset.kind === "display_formula");
    assert.equal(asset.page, item.page);
    const source = question.formulaSources?.find(source => source.regionId === asset.regionId);
    if (item.page > 1) await panel.getByTestId("structure-next").click();
    const review = panel.getByTestId("structure-review-" + id);
    if (baseline) {
      assert(!source);
      await panel.getByText(new RegExp(`^题 ${item.number} · 第 ${item.page}`)).waitFor();
      assert.equal(await panel.getByTestId("structure-review-formula-0").count(), 0);
    } else {
      assert(source && question.issues.includes("formula_text_unconfirmed"));
      await review.getByTestId("structure-review-open").click();
      await review.getByTestId("structure-review-formula-0").click();
      const dialog = page.getByTestId("structure-formula-dialog");
      await dialog.getByTestId("structure-formula-image").waitFor();
      assert.equal(await dialog.getByTestId("structure-formula-local-candidate").count(), 0);
      if (item.page === 1) {
        await dialog.getByTestId("structure-formula-local-run").click();
        await dialog.getByRole("button", { name: "停止识别" }).click();
        await dialog.getByText("已停止本机识别。").waitFor();
        assert.equal(await dialog.getByTestId("structure-formula-local-candidate").count(), 0);
        const stale = await page.evaluate(async ({ resource, id }) => {
          const view = await window.omniEdu.getMaterialStructure({ resourceId: resource.id, version: resource.version, page: 1 });
          return window.omniEdu.recognizeMaterialFormula({
            reference: { ...view.references[id], sha256: "0".repeat(64) },
            page: 1, regionId: "block-4", requestId: crypto.randomUUID(), action: "run",
          });
        }, { resource: { id: resource.id, version: job.version }, id });
        assert.equal(stale.state, "source_changed");
        check("Cancelling a local request leaves the original visible, and an invalid source digest is rejected.");
      }
      const start = performance.now();
      await dialog.getByTestId("structure-formula-local-run").click();
      const input = dialog.getByTestId("structure-formula-local-candidate");
      const noCandidate = dialog.getByText(/未得到可预览|暂不可用|识别失败|识别超时|原页或结构版本有变化/u);
      await input.or(noCandidate).waitFor({ timeout: 60000 });
      if (await noCandidate.isVisible()) throw Error(await noCandidate.innerText());
      const latex = await input.inputValue();
      assert.equal(latex.replace(/\s+/gu, "").replace(/\\textstyle\{(\\frac\{[^}]+\}\{[^}]+\})\}/gu, "$1"), item.latex);
      assert(await dialog.getByTestId("structure-formula-local-preview").locator("math").count());
      report.checks.push({ page: item.page, latex, elapsedMs: Math.round(performance.now() - start) });
      await input.fill("x+1");
      await dialog.getByTestId("structure-formula-local-copy").click();
      assert.equal(await page.evaluate(() => window.testFormulaCopy), "$x+1$");
      await page.setViewportSize(item.page === 1 ? { width: 1366, height: 768 } : { width: 1920, height: 1080 });
      await input.fill(latex);
      await page.screenshot({ path: path.join(output, `formula-${item.page}.png`), animations: "disabled" });
      await dialog.getByTestId("structure-formula-close").click();
      await review.getByTestId("structure-review-cancel").click();
    }
  }
  assert.equal(sha(resource.local_path), report.fixtureSha256);
  assert.deepEqual(sql("SELECT * FROM material_structure_questions ORDER BY id"), initialRows);
  assert.equal(sql("SELECT count(*) AS total FROM material_structure_reviews")[0].total, 0);
  await app.close();
  app = undefined;
  if (!baseline) {
    const cold = await open(false);
    const panel = await openResource(cold, resource);
    const q1 = JSON.parse(initialRows.find(row => JSON.parse(row.body_json).number === "10").body_json);
    const review = panel.getByTestId("structure-review-" + q1.id);
    await review.getByTestId("structure-review-open").click();
    await review.getByTestId("structure-review-formula-0").click();
    const dialog = cold.getByTestId("structure-formula-dialog");
    await dialog.getByTestId("structure-formula-image").waitFor();
    await dialog.getByText(/本机公式识别组件暂不可用/u).waitFor();
    assert(await dialog.getByTestId("structure-formula-local-run").isDisabled());
    assert.deepEqual(sql("SELECT * FROM material_structure_questions ORDER BY id"), initialRows);
    check("Cold restart without the configured runtime retains exact source and read-only review.");
  }
  check(baseline ? "Three independently detected formula areas have no review entry in v28."
    : "Three formulas use the real offline worker, render locally and copy an edited candidate without changing question records.");
  report.ok = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(output);
  await app?.close();
}
