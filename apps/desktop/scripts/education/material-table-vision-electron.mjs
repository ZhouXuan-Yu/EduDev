import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
import { assertIsolatedPiMain, testMain } from "../acceptance/build-root.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const root = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const fixture = process.env.OMNI_EDU_SYNTHETIC_VISION_PDF;
const useLive = process.env.OMNI_EDU_TABLE_VISION_LIVE === "1";
const mergedCase = process.argv.includes("--merged-grid");
const continuedCase = process.argv.includes("--continued-grid");
const splitBaseline = process.argv.includes("--baseline-split-grid");
const borderlessCase = process.argv.includes("--borderless-grid");
const borderlessBaseline = process.argv.includes("--baseline-borderless-grid");
const fusedCase = process.argv.includes("--fused-grid");
const key = useLive ? process.env.DEEPSEEK_API_KEY : "fake-deepseek-table-vision-test";
assert(root && fixture && path.basename(fixture) === "synthetic-table-vision.pdf" && key);
const fixtureSha = createHash("sha256").update(fs.readFileSync(fixture)).digest("hex");
assert.equal(fixtureSha, process.env.OMNI_EDU_SYNTHETIC_VISION_SHA, "Confirm the exact synthetic PDF before any network requests");
const output = fs.mkdtempSync(path.join(root, "desktop-vision-"));
const data = path.join(output, "data");
const profile = path.join(output, "profile");
const desktop = path.resolve(import.meta.dirname, "../..");
const main = testMain(desktop);
const report = { mainSha: createHash("sha256").update(fs.readFileSync(main)).digest("hex"), fixtureSha, useLive, checks: [] };
let app;
const check = statement => {
  report.checks.push(statement);
  console.log("PASS " + statement);
};
function query(sql, ...args) {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true, timeout: 5000 });
  try { return db.prepare(sql).all(...args); }
  finally { db.close(); }
}
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, "../.."),
    OMNI_EDU_E2E_VISIBLE: "0", OMNI_EDU_SKIP_DOTENV: "1", OMNI_EDU_XIAOZHI_PI: "1", DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: "deepseek-flash" };
  for (const name of ["NODE_OPTIONS", "ELECTRON_RUN_AS_NODE", "ELECTRON_RENDERER_URL"]) delete env[name];
  app = await _electron.launch({ args: [main, "--user-data-dir=" + profile], cwd: desktop, env, timeout: 60000 });
  await assertIsolatedPiMain(app, main, profile);
  await app.evaluate(({ net, dialog }, options) => {
    globalThis.tableVisionAudit = { calls: [], accept: false, mode: "invalid" };
    const fetch = net.fetch.bind(net);
    dialog.showMessageBox = async (...args) => {
      if (args.at(-1)?.title !== "视觉回查") throw Error("Unexpected native dialog");
      return { response: Number(globalThis.tableVisionAudit.accept) };
    };
    net.fetch = async (input, options2) => {
      const url = new URL(typeof input === "string" ? input : input.url ?? input.href);
      if (url.hostname !== "api.deepseek.com") return fetch(input, options2);
      if (url.pathname !== "/chat/completions") return Response.json({ object: "list", data: [] });
      const request = JSON.parse(options2.body);
      const images = request.messages[1].content.filter(part => part.type === "image_url");
      globalThis.tableVisionAudit.calls.push({ count: images.length, model: request.model });
      if (images.length < 2 || images.length > 5 || request.model !== "deepseek-flash") throw Error("Out-of-scope provider call");
      if (globalThis.tableVisionAudit.mode === "invalid") return Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          state: "unreadable", text: "456", columnLabel: null, unit: null,
        }) } }],
      });
      if (options.live) {
        const response = await fetch(input, options2);
        const envelope = await response.clone().json();
        globalThis.tableVisionAudit.calls.at(-1).modelReading = JSON.parse(envelope.choices[0].message.content);
        return response;
      }
      return Response.json({ choices: [{ finish_reason: "stop", message: {
        content: JSON.stringify({ state: "unreadable", text: null, columnLabel: "第二天", unit: null }),
      } }] });
    };
  }, { live: useLive });
  const page = await app.firstWindow();
  await productEntry(page, "materials").click();
  return page;
}

async function waitResource() {
  const end = Date.now() + 360000;
  while (Date.now() < end) {
    const [job] = query("SELECT * FROM material_structure_jobs");
    if (job?.status === "failed") throw Error(JSON.stringify(job));
    if (["complete", "partial"].includes(job?.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Synthetic fixture did not publish a structure");
}

async function openTables(page, resource) {
  await page.getByTestId("materials-search").fill(resource.title);
  await page.getByTestId("material-" + resource.id).getByRole("button").click();
  await page.getByTestId("materials-section-questions").click();
  const panel = page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(panel);
  return panel.getByTestId("structure-table-evidence");
}

async function openTable(page, resource, vision = true) {
  const table = await openTables(page, resource);
  await openMaterialDisclosure(table);
  if (!vision) return table;
  await table.getByTestId("table-vision-cell-1-1").click();
  await table.getByRole("button", { name: "用 DeepSeek 回查" }).waitFor({ timeout: 25_000 })
    .catch(async () => table.getByTestId("table-vision-candidate").waitFor({ timeout: 5000 }));
  return table;
}

async function checkMergedTable(page, resource, candidate, snapshot, before) {
  const rows = candidate.tableSources?.[0]?.rows;
  assert(rows, "Expected the actual raster table to publish a local merged grid");
  assert.equal(rows[0][1].columnSpan, 2);
  assert.equal(rows[1][0].rowSpan, 2);
  assert(rows[0][2].covered && rows[2][0].covered);
  assert.deepEqual(rows.slice(1).map(row => row.slice(1).map(cell => cell.text)), [["22.5", "30.0"], ["18.5", "24.0"]]);
  for(const [phase,screen] of [["first",page],["cold",undefined]]){
    const current=screen??await launch();
    await current.setViewportSize({width:phase==="first"?1366:1920,height:phase==="first"?768:1080});
    const table=await openTable(current,resource,false);
    const grid=table.getByTestId("structure-table-grid");
    assert.equal(await grid.locator('td[colspan="2"]').count(),1);
    assert.equal(await grid.locator('td[rowspan="2"]').count(),1);
    assert.equal(await grid.getByRole("cell").count(),7);
    await table.getByTestId("structure-table-original").click();
    await table.getByTestId("structure-table-original-image").waitFor();
    await table.scrollIntoViewIfNeeded();
    await current.screenshot({path:path.join(output,`merged-${phase}.png`)});
    assert.deepEqual(snapshot(),before);
    assert.equal(query("SELECT count(*) AS n FROM material_structure_reviews")[0].n,0);
    assert.equal(await app.evaluate(()=>globalThis.tableVisionAudit.calls.length),0);
    await app.close();app=undefined;
  }
  report.cells=rows.map(row=>row.filter(cell=>!cell.covered).map(({text,rowSpan,columnSpan})=>({text,rowSpan,columnSpan})));
  check("The merged raster keeps seven cells, four numeric values and one span in each direction.");
  check("Native preview and cold restart retain the original image without teacher edits or requests.");
}

async function checkContinuedTable(page, resource, candidate, snapshot, before) {
  const sources = candidate.tableSources;
  report.fragments = sources?.map(({ page, regionId, continuesFrom }) => ({ page, regionId, continuesFrom }));
  assert.deepEqual(sources?.map(source => source.page), [1, 2]);
  assert.deepEqual(sources[1].continuesFrom, { page: 1, regionId: sources[0].regionId });
  for (const [width, height, screen] of [[1366, 768, page], [1920, 1080, undefined]]) {
    const current = screen ?? await launch();
    await current.setViewportSize({ width, height });
    const table = await openTable(current, resource, false);
    const grid = table.getByTestId("structure-table-grid");
    const pendingHeader = sources[1].rows[0].some(cell => cell.needsReview);
    assert.equal(await grid.getByRole("cell", { name: "测量组", exact: true }).count(), pendingHeader ? 2 : 1);
    if (pendingHeader) {
      assert.equal(await grid.getByRole("button", { name: /回查第 2 页第 1 行/ }).count(),
        sources[1].rows[0].filter(cell => cell.needsReview).length);
    }
    const values = await grid.getByRole("cell").allTextContents();
    assert.deepEqual(values.filter(value => /^\d+\.\d+$/.test(value)),
      ["22.5", "30.0", "18.5", "24.0", "42.5", "51.0", "39.5", "48.0"]);
    for (const source of sources) {
      await table.getByRole("button", { name: `查看第 ${source.page} 页表格原图` }).click();
      await table.getByRole("img", { name: `第 ${source.page} 页的原始表格` }).waitFor();
    }
    await table.getByTestId("structure-table-grid").scrollIntoViewIfNeeded();
    await current.screenshot({ path: path.join(output, `continued-${width}.png`) });
    assert.deepEqual(snapshot(), before);
    assert.equal(query("SELECT count(*) AS n FROM material_structure_reviews")[0].n, 0);
    assert.equal(await app.evaluate(() => globalThis.tableVisionAudit.calls.length), 0);
    await app.close();
    app = undefined;
  }
  check("One table with eight numeric values and the same pending cells, with images anchored to both pages after restart.");
  check("Opening the combined table preserves the local structure and makes no model calls.");
}

async function checkSplitBaseline(page, resource, candidate) {
  assert.deepEqual(candidate.tableSources.map(source => source.page), [1, 2]);
  assert(candidate.tableSources.every(source => !source.continuesFrom));
  const tables = await openTables(page, resource);
  assert.equal(await tables.count(), 2);
  for (const card of await tables.all()) await openMaterialDisclosure(card);
  assert.equal(await page.getByTestId("structure-table-grid").count(), 2);
  check("The same input in the previous build requires two table disclosures.");
}

async function checkBorderlessTables(page, resource, questionRows, snapshot, before) {
  const expected = fusedCase ? [
    { page: 1, question: "10", values: ["23.1", "12.3", "123.4", "29.5", "19.8", "17.4", "21.2", "15.8"],
      fused: "123.4 29.5" },
    { page: 2, question: "12", values: ["23.1", "12.3", "-84.6", "13.75", "19.8", "17.4", "21.2", "15.8"],
      fused: "-84.613.75" },
  ] : [
    { page: 1, question: "10", values: ["2.50", "0.20", "3.75", "0.30", "5.00", "0.40"] },
    { page: 2, question: "12", values: ["20.5", "12", "23.8", "24", "27.0", "36"] },
  ];
  for (const item of expected) {
    const question = questionRows.find(question => question.number === item.question);
    assert(question.assets.some(asset => asset.page === item.page && asset.kind === "table"));
    const sourcePage = JSON.parse(query("SELECT body_json FROM material_structure_pages WHERE page=?", item.page)[0].body_json);
    const originalLine = item.fused && sourcePage.lines.find(line => line.text === item.fused);
    if (item.fused) assert(originalLine, "The production full-page OCR must reproduce the fused source line");
    if (borderlessBaseline) assert.equal(question.tableSources?.length ?? 0, 0);
    else {
      assert.equal(question.tableSources.length, 1);
      const [source] = question.tableSources;
      assert.equal(source.page, item.page);
      assert.equal(source.layout, "aligned_text");
      assert.deepEqual(source.rows.slice(1).flatMap(row => row.slice(1).map(cell => cell.text)), item.values);
      if (originalLine) {
        assert.equal(source.numericRecheck.lineId, originalLine.id);
        assert.deepEqual(source.numericRecheck.parts.map(part => part.text), item.values.slice(2, 4));
        assert(source.numericRecheck.parts.every(part => /^[a-f0-9]{64}$/.test(part.cropSha256)));
        assert(source.rows[2].slice(1).every(cell => !cell.needsReview && cell.lineIds.includes(originalLine.id)));
      }
    }
  }
  assert(questionRows.filter(question => !expected.some(item => item.question === question.number))
    .every(question => !question.tableSources?.length));

  const sizes = borderlessBaseline ? [[1366, 768, page]] : [[1366, 768, page], [1920, 1080, undefined]];
  for (const [width, height, screen] of sizes) {
    const current = screen ?? await launch();
    await current.setViewportSize({ width, height });
    const cards = await openTables(current, resource);
    const panel = current.getByTestId("material-structure-panel");
    for (const item of expected) {
      if (item.page !== 1) await panel.getByTestId("structure-next").click();
      await panel.getByText(new RegExp(`^题 ${item.question} · 第 ${item.page}`)).waitFor();
      assert.equal(await cards.count(), borderlessBaseline ? 0 : 1);
      if (borderlessBaseline) continue;
      await openMaterialDisclosure(cards);
      const grid = cards.getByTestId("structure-table-grid");
      assert.equal(await grid.getByRole("row").count(), item.fused ? 5 : 4);
      const cells = await grid.getByRole("cell").allTextContents();
      assert.deepEqual(cells.filter(value => /^-?\d+(?:\.\d+)?$/.test(value)), item.values);
      await cards.getByText("按原文位置还原的表格，可对照原图").waitFor();
      if (item.fused) await cards.getByTestId("structure-table-numeric-recheck").waitFor();
      await cards.getByTestId("structure-table-original").click();
      await cards.getByRole("img", { name: `第 ${item.page} 页的原始表格` }).waitFor();
      await grid.scrollIntoViewIfNeeded();
      await current.screenshot({ path: path.join(output, `aligned-${item.page}-${width}.png`) });
    }
    assert.deepEqual(snapshot(), before);
    assert.equal(query("SELECT count(*) AS n FROM material_structure_reviews")[0].n, 0);
    assert.equal(await app.evaluate(() => globalThis.tableVisionAudit.calls.length), 0);
    await app.close();
    app = undefined;
  }
  check(borderlessBaseline ? "Both baseline pages are recognized as table regions but produce no reviewable cells."
    : fusedCase ? "Two real OCR fusions are separated into four numeric cells, with unchanged raw lines and local crop evidence after restart."
    : "Tables without rules and with horizontal rules only each retain twelve OCR cells and the original crop after restart.");
}

async function run() {
  const page = await launch();
  await app.evaluate(({dialog}, value) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [value] });
  }, fixture);
  await page.getByTestId("materials-import").click();
  const job = await waitResource();
  const [resource] = query("SELECT id,title FROM teacher_resources");
  const snapshot = () => query("SELECT id,status,sha256 FROM material_structure_questions ORDER BY id");
  const before = snapshot();
  if (borderlessCase || borderlessBaseline || fusedCase) {
    const questions = query("SELECT body_json FROM material_structure_questions WHERE generation=?", job.generation)
      .map(record => JSON.parse(record.body_json));
    await checkBorderlessTables(page, resource, questions, snapshot, before);
    return;
  }
  const [record] = query("SELECT id,sha256,body_json FROM material_structure_questions WHERE generation=? AND json_extract(body_json,'$.number')='10'", job.generation);
  const candidate = JSON.parse(record.body_json);
  if (splitBaseline) {
    await checkSplitBaseline(page, resource, candidate);
    return;
  }
  if (continuedCase) {
    await checkContinuedTable(page, resource, candidate, snapshot, before);
    return;
  }
  if (mergedCase) {
    await checkMergedTable(page,resource,candidate,snapshot,before);
    return;
  }
  assert.equal(job.engine, "layout-paragraph-question.v28");
  assert.equal(candidate.tableSources[0].rows[1][1].needsReview, true);
  assert.equal(candidate.tableSources[0].rows[1][1].text, "");
  if (process.env.OMNI_EDU_TABLE_VISION_POSITIVE === "1") {
    const held = candidate.tableSources[0].rows[1][2];
    assert(held.suspectedOverprint && held.needsReview && !held.text, "The faint original cell must be held by the local structure");
  }
  assert.equal(await app.evaluate(() => globalThis.tableVisionAudit.calls.length), 0);
  check("Public-import entry completes locally and leaves the covered cell pending");


  await page.setViewportSize({ width: 1366, height: 768 });
  const table = await openTable(page, resource);
  await table.getByText("查看拟发送的局部").click();
  await table.getByRole("img", { name: "待核单元格原图" }).waitFor();
  await table.getByRole("img", { name: "关联行列原图" }).waitFor();
  const select = { reference: { schemaVersion: "xiaozhi.document-structure.v1", resourceId: resource.id, version: job.version,
    generation: job.generation, candidateId: record.id, sha256: record.sha256 }, page: candidate.tableSources[0].page,
    regionId: candidate.tableSources[0].regionId, row: 1, column: 1, action: "run" };
  await table.getByRole("button", { name: "用 DeepSeek 回查" }).click();
  await table.getByText("已取消回查。").waitFor();
  assert.equal(await app.evaluate(() => globalThis.tableVisionAudit.calls.length), 0);
  await assert.rejects(page.evaluate(input => window.omniEdu.recheckMaterialTable(input), {...select, column: 99}), /invalid_input/);
  await assert.rejects(page.evaluate(input => window.omniEdu.recheckMaterialTable(input), {...select, reference: {...select.reference, generation: "a".repeat(64)}}), /source_changed|invalid_input/);
  check("Preview is local, declining dispatch makes zero provider calls, and invalid targets are denied");

  await app.evaluate(() => { globalThis.tableVisionAudit.accept = true; });
  await table.getByRole("button", { name: "用 DeepSeek 回查" }).click();
  await table.getByText("模型返回的格式无法核验，可重试或查看原图。").waitFor({ timeout: 85000 });
  assert.equal(query("SELECT count(*) AS n FROM material_table_vision_candidates")[0].n, 0);
  check("A result with an unreadable state and a fabricated value is rejected");

  await app.evaluate(() => { globalThis.tableVisionAudit.mode = "valid"; });
  await table.getByRole("button", { name: "用 DeepSeek 回查" }).click();
  await table.getByTestId("table-vision-candidate").waitFor({ timeout: 85000 });
  const [saved] = query("SELECT body_json FROM material_table_vision_candidates");
  const reading = JSON.parse(saved.body_json);
  assert.equal(reading.text, null);
  assert.equal(reading.state, "unreadable");
  assert.deepEqual(snapshot(), before);
  assert.equal(query("SELECT count(*) AS n FROM material_structure_reviews")[0].n, 0);
  report.calls = await app.evaluate(() => globalThis.tableVisionAudit.calls);
  assert.deepEqual(report.calls.map(call => ({ count: call.count, model: call.model })),
    [{ count: 2, model: "deepseek-flash" }, { count: 2, model: "deepseek-flash" }]);
  report.reading = reading;
  await page.screenshot({ path: path.join(output, "review-1366.png") });
  check("The authorized context request returns a held reading and does not change questions or reviews");

  if (process.env.OMNI_EDU_TABLE_VISION_POSITIVE === "1") {
    assert(useLive, "The faint original cell is graded against the live model");
    await table.getByTestId("table-vision-cell-1-2").click();
    await table.getByTestId("table-vision-run").click({ timeout: 15000 });
    await table.getByTestId("table-vision-candidate").waitFor({ timeout: 85000 });
    const details = table.getByTestId("table-vision-review").locator("details");
    const alts = await details.locator("img").evaluateAll(images => images.map(image => image.alt));
    report.positivePreviews = alts;
    assert(alts.includes("去浅色叠印对照图"));
    if (await details.getAttribute("open") === null) await details.locator("summary").click();
    await details.getByRole("img", { name: "去浅色叠印对照图" }).waitFor();
    const receipts = query("SELECT body_json FROM material_table_vision_candidates").map(row => JSON.parse(row.body_json));
    assert.equal(receipts.length, 2);
    const recovered = receipts.find(receipt => receipt.columnLabel === "第三天");
    assert(recovered, "The overprint receipt must retain the correct column");
    if (recovered.text !== null) assert.equal(recovered.text.normalize("NFKC").replace(/−/g, "-"), "-0.10");
    else assert(["conflict", "unreadable"].includes(recovered.state));
    assert.equal(recovered.columnLabel, "第三天");
    assert.deepEqual(snapshot(), before);
    report.recovered = recovered;
    report.calls = await app.evaluate(() => globalThis.tableVisionAudit.calls);
    assert.deepEqual(report.calls.map(call => call.count), [2, 2, 4]);
    await page.screenshot({ path: path.join(output, "review-overprint-1366.png") });
    check(recovered.text === null
      ? "Live recovery binds the column and holds the conflicting or unreadable signed value"
      : "Live recovery reads the faint signed decimal and binds its column while retaining the original pending cell");
  }
  await app.close();
  app = undefined;
  const cold = await launch();
  await cold.setViewportSize({ width: 1920, height: 1080 });
  const coldTable = await openTable(cold, resource);
  await coldTable.getByTestId("table-vision-candidate").waitFor();
  await cold.screenshot({ path: path.join(output, "review-1920.png") });
  assert.equal(await app.evaluate(() => globalThis.tableVisionAudit.calls.length), 0);
  check("Cold start reads the same candidate without resending");
}

try {
  await run();
  report.ok = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(output);
  await app?.close();
}
