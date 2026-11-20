import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";
const files = JSON.parse(process.env.EDU_STRUCTURE_FILES || "[]");
const root = process.env.EDU_STRUCTURE_TEST_ROOT;
assert(
  root &&
    path.isAbsolute(root) &&
    files.length &&
    files.every((f) => path.isAbsolute(f) && fs.statSync(f).isFile()),
  "Explicit isolated root and authorized input files are required",
);
fs.mkdirSync(root, { recursive: true });
const officeSource = process.env.EDU_STRUCTURE_OFFICE_COMPONENT;
if (officeSource) {
  assert(
    path.isAbsolute(officeSource) && fs.statSync(officeSource).isDirectory(),
  );
  const target = path.join(
    root,
    "profile",
    "managed-components",
    path.basename(officeSource),
  );
  if (!fs.existsSync(target))
    fs.cpSync(officeSource, target, { recursive: true });
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
function treeIdentity(directory){
 const files=[];
 function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  const file=path.join(folder,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected runtime link');
  if(entry.isDirectory())walk(file);else if(entry.isFile())files.push({path:path.relative(directory,file).replaceAll('\\','/'),sha256:hash(fs.readFileSync(file))});
 }}
 walk(directory);return {sha256:hash(Buffer.from(JSON.stringify(files))),files};
}
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const originalTree=treeIdentity(buildRoot);
const data=path.join(root,'data'),runtime=path.resolve('test-results','document-structure-runtime-'+originalTree.sha256.slice(0,24));
if (!fs.existsSync(runtime))
  fs.cpSync(buildRoot, runtime, { recursive: true });
fs.writeFileSync(path.join(root,'runtime-files.json'),JSON.stringify(originalTree,null,2));
const entry = path.join(runtime, "main", "index.js");
const runtimeSha = hash(fs.readFileSync(entry));
const query = (sql, args = []) => {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
};
const report = {
  ok: false,
  root,
  runtimeSha,
  runtimeTreeSha256:originalTree.sha256,
  runtimeFiles:originalTree.files.length,
  checks: [],
  errors: [],
  files: files.map((f) => ({
    name: path.basename(f),
    sha256: hash(fs.readFileSync(f)),
  })),
  officeComponent: officeSource
    ? "Existing managed tree copied; production verifies its pinned manifest before use"
    : "First-use managed installation",
};
const save = () =>
  fs.writeFileSync(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
let app, page;
async function launch() {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_REPO_ROOT: path.resolve("../.."),
    OMNI_EDU_E2E_DIALOG_MODE: "1",
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
    args: [entry, "--user-data-dir=" + path.join(root, "profile")],
    cwd: process.cwd(),
    env,
    timeout: 90000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => report.errors.push(e.message));
}
const check = (name) => {
  report.checks.push(name);
  save();
  console.log("PASS " + name);
};
async function until(action, ms = 120000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await action();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error("Timed out waiting for real background processing");
}
async function open(resource) {
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
  await launch();
  await productEntry(page, "materials").click();
  await app.evaluate(({ dialog }, files) => {
    const old = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => {
      dialog.showOpenDialog = old;
      return { canceled: false, filePaths: files };
    };
  }, files);
  const start = Date.now();
  await page.getByTestId("materials-import").click();
  await until(
    () =>
      query("SELECT COUNT(*) n FROM material_structure_jobs")[0].n >=
      files.length,
  );
  check("Original import action starts default local structure jobs");
  await until(() => {
    const jobs = query("SELECT * FROM material_structure_jobs");
    report.jobs = jobs.map((j) => ({
      id: j.resource_id,
      status: j.status,
      processed: j.processed,
      pages: j.pages,
      questions: j.questions,
      held: j.held,
      error: j.error,
    }));
    save();
    const failed = jobs.filter((j) => j.status === "failed");
    if (failed.length)
      throw Error(
        JSON.stringify(
          failed.map((j) => ({ id: j.resource_id, error: j.error })),
        ),
      );
    return (
      jobs.length >= files.length &&
      jobs.every((j) => ["complete", "partial"].includes(j.status))
    );
  }, 1800000);
  report.backgroundMs = Date.now() - start;
  await until(
    () =>
      query(
        "SELECT COUNT(*) n FROM material_question_jobs WHERE status IN ('pending','failed')",
      )[0].n === 0,
  );
  const resources = query("SELECT * FROM teacher_resources");
  report.counts = {
    resources: resources.length,
    chunks: query("SELECT COUNT(*) n FROM resource_chunks")[0].n,
    bank: query("SELECT COUNT(*) n FROM question_bank_items")[0].n,
  };
  assert(report.counts.bank > 0);
  const paragraphs = [],
    pages = query("SELECT * FROM material_structure_pages");
  for (const row of pages) {
    const p = JSON.parse(row.body_json);
    assert.equal(hash(Buffer.from(JSON.stringify(p))), row.sha256);
    assert.equal(p.rawText, p.lines.filter(l=>!l.origin).map((l) => l.text).join("\n"));
    const ids = p.paragraphs.flatMap((p) => p.lineIds);
    assert.equal(ids.length, p.lines.length);
    assert.equal(new Set(ids).size, ids.length);
    for (const paragraph of p.paragraphs)
      assert.equal(
        paragraph.rawText,
        paragraph.lineIds
          .map((id) => p.lines.find((l) => l.id === id).text)
          .join("\n"),
      );
    paragraphs.push({
      page: p.page,
      lines: p.lines.length,
      paragraphs: p.paragraphs.length,
      merged: p.paragraphs.filter((p) => p.lineIds.length > 1).length,
      columns: p.columns.length,
    });
  }
  report.pages = paragraphs;
  assert(paragraphs.some((p) => p.merged > 0));
  check(
    "Every real OCR line survives exactly once with original text, quadrilateral and paragraph links",
  );
  const candidates = query("SELECT * FROM material_structure_questions");
  for (const row of candidates) {
    const q = JSON.parse(row.body_json);
    const doc = row.document_json ? JSON.parse(row.document_json) : undefined;
    assert.equal(
      hash(
        Buffer.from(
          JSON.stringify({ question: q, ...(doc ? { document: doc } : {}) }),
        ),
      ),
      row.sha256,
    );
    if (q.status === "needs_review")
      assert.equal(
        query(
          "SELECT COUNT(*) n FROM question_bank_items WHERE json_extract(archive_json,'$.structure.candidateId')=?",
          [q.id],
        )[0].n,
        0,
      );
  }
  const bank = query(
    "SELECT * FROM question_bank_items WHERE json_extract(archive_json,'$.schemaVersion')='xiaozhi.question-archive.structure.v1'",
  );
  assert(bank.length > 0);
  for (const q of bank) {
    const archive = JSON.parse(q.archive_json),
      doc = JSON.parse(q.document_json);
    assert.equal(archive.sourceChecked, false);
    assert.equal(archive.state, "rule_extracted");
    assert.equal(doc.blocks.find((b) => b.id === "transcription").text, q.stem);
    for (const image of doc.blocks.filter((b) => b.kind === "image"))
      assert.equal(
        hash(
          fs.readFileSync(
            path.join(data, "question-assets", "v1", image.assetId + ".png"),
          ),
        ),
        image.sha256,
      );
  }
  check(
    "Only structurally admissible candidates enter the bank with immutable cropped sources and unverified teacher status",
  );
  for (const r of resources)
    assert.equal(hash(fs.readFileSync(r.local_path)), r.content_hash);
  const selected = resources.find((r) => /\.pdf$/i.test(r.original_file_name));
  let panel = await open({ id: selected.id, title: selected.title });
  await panel.getByTestId("structure-page").waitFor();
  if (process.env.EDU_STRUCTURE_REQUIRE_PRINTED === "1") {
    const printed = panel.getByTestId("structure-printed-recovery");
    await printed.filter({hasText:/原页补识 1 行/}).waitFor();
    assert(Number(/恢复 (\d+) 处印刷填空/u.exec(await printed.innerText())?.[1]) >= 2);
  }
  assert(
    (await panel.getByTestId("structure-paragraphs").innerText()).length > 30,
  );
  await panel.getByRole("button", { name: "对照原始页图" }).click();
  await panel.getByTestId("structure-source-image").waitFor();
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await panel.getByTestId("structure-status").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(root, "structure-" + width + ".png"),
    });
    assert(await panel.getByTestId("structure-rebuild").isEnabled());
  }
  check(
    "Original materials navigation exposes raw OCR, recovered paragraphs, question ownership and original page in both desktop sizes",
  );
  const before = JSON.stringify(
    query("SELECT * FROM material_structure_jobs ORDER BY resource_id"),
  );
  await app.close();
  app = undefined;
  await launch();
  panel = await open({ id: selected.id, title: selected.title });
  await panel.getByTestId("structure-page").waitFor();
  assert.equal(
    JSON.stringify(
      query("SELECT * FROM material_structure_jobs ORDER BY resource_id"),
    ),
    before,
  );
  assert.equal(hash(fs.readFileSync(entry)), runtimeSha);
  assert.equal(treeIdentity(runtime).sha256,originalTree.sha256);
  assert.equal(report.errors.length, 0);
  check(
    "Cold restart preserves source snapshots, question provenance and runtime identity",
  );
  report.ok = true;
  save();
  console.log(
    JSON.stringify({
      ok: true,
      root,
      backgroundMs: report.backgroundMs,
      counts: report.counts,
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
