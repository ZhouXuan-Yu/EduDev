import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
const retained = process.argv[2] ? fs.realpathSync(process.argv[2]) : undefined;
if (retained)
  assert(
    path.dirname(retained).toLowerCase() ===
      fs.realpathSync(os.tmpdir()).toLowerCase() &&
      path.basename(retained).startsWith("omni-search-statistics-ui-"),
  );
const desktop = process.cwd(),
  output =
    retained ||
    fs.mkdtempSync(path.join(os.tmpdir(), "omni-search-statistics-ui-")),
  folder = path.join(output, "资料"),
  data = path.join(output, "data"),
  profile = path.join(output, "profile");
for (const name of ["物理", "其他"])
  fs.mkdirSync(path.join(folder, name), { recursive: true });
if (!retained)
  for (let i = 0; i < 64; i++)
    fs.writeFileSync(
      path.join(folder, i === 0 ? "物理" : "其他", "资料" + i + ".md"),
      i === 0
        ? "# 沸点资料\n\n稀有沸点标记。标准大气压下水的沸点为100℃，原始出处保存在本地。"
        : "# 教学资料" + i + "\n\n普通教学内容，资料编号" + i + "。",
    );
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  originals = () =>
    fs
      .readdirSync(folder, { recursive: true })
      .filter((n) => n.endsWith(".md"))
      .map((n) => [n, hash(fs.readFileSync(path.join(folder, n)))]),
  beforeOriginals = originals();
const report = {
  output,
  resumed: !!retained,
  checks: [],
  rendererErrors: [],
  networkAttempts: 0,
  cloudCalls: 0,
  buildSha256: hash(fs.readFileSync("out/main/index.js")),
  scope:
    "Production recursive Markdown import/background parser/FTS and derived statistics, keyword search/open source/typed read/SQLite/dual viewports/cold startup. 64 small generated files. Million-row SQL benchmark is separate; no real 40GiB, semantic recall or natural OCR acceptance.",
};
let app, page;
const sql = (s, p = []) => {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true });
  try {
    return db.prepare(s).all(...p);
  } finally {
    db.close();
  }
};
const until = async (fn, ms = 180000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw Error("Inspect retained search-statistics UI state");
};
async function launch() {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_E2E_VISIBLE: "0",
    OMNI_EDU_XIAOZHI_PI: "1",
  };
  for (const k of [
    "ELECTRON_RUN_AS_NODE",
    "NODE_OPTIONS",
    "ELECTRON_RENDERER_URL",
    "DEEPSEEK_API_KEY",
  ])
    delete env[k];
  app = await _electron.launch({
    args: [
      path.join(desktop, "out/main/index.js"),
      "--user-data-dir=" + profile,
    ],
    env,
    cwd: output,
    timeout: 60000,
  });
  await app.evaluate(({ net }) => {
    globalThis.searchStatisticsNetworkAttempts = 0;
    for (const owner of [net, globalThis])
      owner.fetch = async () => {
        globalThis.searchStatisticsNetworkAttempts++;
        throw Error("Network disabled in local statistics acceptance");
      };
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => report.rendererErrors.push(e.message));
  await productEntry(page, "materials").click();
}
async function search(cold) {
  if (!(await page.getByTestId("materials-search-mode").isVisible()))
    await page.getByRole("button", { name: "检索正文", exact: true }).click();
  await page.getByTestId("materials-search-mode").selectOption("keyword");
  await page.getByTestId("materials-text-query").fill("稀有沸点");
  await page.getByTestId("materials-text-submit").click();
  const found = await page.evaluate(() =>
    window.omniEdu.searchMaterialText({
      schemaVersion: "xiaozhi.material-search.v1",
      query: "稀有沸点",
      offset: 0,
      mode: "keyword",
    }),
  );
  assert.equal(found.hits.length, 1);
  const result = page.getByTestId(
    "material-text-hit-" + found.hits[0].source.chunkId,
  );
  await result.waitFor();
  assert.equal(await result.count(), 1);
  assert.equal(
    found.index.indexed,
    sql("SELECT COUNT(*) n FROM material_body_fts_v1")[0].n,
  );
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    const win = await app.browserWindow(page);
    await win.evaluate((w, s) => w.setContentSize(s.width, s.height), {
      width,
      height,
    });
    await page.waitForFunction(
      (s) => innerWidth === s.width && innerHeight === s.height,
      { width, height },
    );
    await page.getByTestId("materials-text-results").scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(output, (cold ? "cold-" : "warm-") + width + ".png"),
    });
  }
  const hit = found.hits[0];
  await page.getByTestId("material-text-hit-" + hit.source.chunkId).click();
  await page.getByTestId("materials-detail").waitFor();
  const source = await page.evaluate(
    (s) => window.omniEdu.getMaterialSource(s),
    hit.source,
  );
  assert(source.body.chunks.some((c) => c.contentMd.includes("稀有沸点")));
  return found;
}
try {
  console.log("OUTPUT " + output);
  await launch();
  if (!retained) {
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, folder);
    await page.getByTestId("materials-import-folder").click();
    await until(
      () =>
        sql(
          "SELECT COUNT(*) n FROM material_import_entries WHERE kind='file' AND status='saved'",
        )[0].n === 64,
    );
  }
  await until(
    () =>
      sql(
        "SELECT COUNT(*) n FROM teacher_resources WHERE parse_status IN ('ready','parsed','chunked','indexed','graph_extracted','failed')",
      )[0].n === 64,
  );
  const failed = sql(
    "SELECT id,original_file_name FROM teacher_resources WHERE parse_status='failed'",
  );
  report.parserRetries = failed.map((r) => r.original_file_name);
  for (const r of failed) {
    await page.getByTestId("materials-search").fill(r.original_file_name);
    const open = page.getByTestId("material-" + r.id).getByRole("button");
    assert.equal(await open.count(), 1);
    await open.click();
    await page.getByTestId("materials-retry").click();
    await until(
      () =>
        sql("SELECT COUNT(*) n FROM resource_chunks WHERE resource_id=?", [
          r.id,
        ])[0].n > 0,
    );
  }
  await page.getByTestId("materials-search").fill("");
  await until(
    () =>
      sql("SELECT COUNT(*) n FROM resource_chunks")[0].n >= 64 &&
      sql("SELECT COUNT(*) n FROM material_body_dirty_v1")[0].n === 0 &&
      sql("SELECT index_ready FROM material_search_count_control_v1")[0]
        .index_ready === 1 &&
      sql(
        "SELECT COUNT(*) n FROM material_search_resource_counts_v1 WHERE ready=1",
      )[0].n >= 64,
  );
  const first = await search(false);
  report.checks.push(
    "Real folder import processes 64 nested files in the background and keyword search opens the original source at both viewport sizes",
  );
  const counts = sql(
    "SELECT * FROM material_search_resource_counts_v1 ORDER BY resource_id",
  );
  for (const row of counts) {
    const exact = sql(
      "SELECT COUNT(*) total,COALESCE(SUM(contains_personal_data<>0),0) private FROM resource_chunks WHERE resource_id=?",
      [row.resource_id],
    )[0];
    assert.equal(row.total, exact.total);
    assert.equal(row.private, exact.private);
  }
  report.checks.push(
    "Persisted resource and FTS counters equal direct authoritative SQLite counts after real background parsing and indexing",
  );
  await app.close();
  app = undefined;
  await launch();
  const cold = await search(true);
  assert.deepEqual(
    cold.hits.map((h) => h.source),
    first.hits.map((h) => h.source),
  );
  assert.deepEqual(
    sql(
      "SELECT * FROM material_search_resource_counts_v1 ORDER BY resource_id",
    ),
    counts,
  );
  assert.deepEqual(originals(), beforeOriginals);
  assert.equal(report.rendererErrors.length, 0);
  report.networkAttempts = await app.evaluate(
    () => globalThis.searchStatisticsNetworkAttempts,
  );
  report.checks.push(
    "Cold application launch preserves exact counters, hit identities and original files, with typed source reading and dual-viewport controls available",
  );
  report.success = true;
} catch (e) {
  report.success = false;
  report.error = String(e.stack || e);
  process.exitCode = 1;
  if (page)
    await page
      .screenshot({ path: path.join(output, "failure.png") })
      .catch(() => {});
} finally {
  if (app) await app.close();
  fs.writeFileSync(
    path.join(output, retained ? "resume-report.json" : "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
