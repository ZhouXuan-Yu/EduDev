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
const runtimeReport =
  process.env.EDU_STRUCTURE_RUNTIME_REPORT ||
  (fs.existsSync(path.join(root, "structure-review-final.json"))
    ? "structure-review-final.json"
    : "readback-final.json");
const frozen = JSON.parse(fs.readFileSync(path.join(root, runtimeReport)));
assert(frozen.ok);
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
const questions = [
  [
    "小车沿直线匀速运动，每秒前进两米。根据这些条件，求五秒内小车前进的路程。",
    ["两米", "四米", "六米", "十米"],
  ],
  [
    "一个物体静止在水平桌面上，同时受到重力和支持力作用。请判断这两个力之间的关系。",
    ["方向相同", "方向相反", "大小不同", "没有关系"],
  ],
  [
    "一盏灯接入电路后能够正常发光。断开开关之后灯熄灭，根据实验现象判断电路状态。",
    ["处于通路", "处于断路", "电流增大", "灯泡更亮"],
  ],
  [
    "实验小组用刻度尺测量物体长度，需要先观察刻度尺的零刻度以及最小分度值。请选择正确操作。",
    ["斜着观察", "估计读数", "不看单位", "随意测量"],
  ],
];
const question = (q, index) =>
  `<section><p>${index + 1}．${q[0]}</p><div class="options">${q[1].map((text, i) => `<div>${String.fromCharCode(65 + i)}．${text}</div>`).join("")}</div></section>`;
const html = `<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:'Microsoft YaHei',sans-serif;font-size:15px;line-height:1.7}h1{text-align:center;font-size:22px;margin:0 0 30px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:38px}section{margin-bottom:45px}p{margin:0 0 10px}.options{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px}</style><h1>物理双栏结构回归样本</h1><div class="columns"><div>${questions
  .slice(0, 2)
  .map((q, i) => question(q, i))
  .join("")}</div><div>${questions
  .slice(2)
  .map((q, i) => question(q, i + 2))
  .join("")}</div></div>`;
const report = {
  ok: false,
  runtimeTreeSha256: frozen.runtimeTreeSha256,
  checks: [],
  errors: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(root, "two-column-final.json"),
    JSON.stringify(report, null, 2),
  );
let app;
try {
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
    args: [
      path.join(frozen.runtime, "main", "index.js"),
      "--user-data-dir=" + path.join(root, "profile"),
    ],
    cwd: process.cwd(),
    env,
    timeout: 90000,
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  const file = path.join(root, "synthetic-two-column.pdf");
  if (process.env.EDU_STRUCTURE_FIXTURE_REUSE !== "1") {
    const pdf = await app.evaluate(async ({ BrowserWindow }, html) => {
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      try {
        await window.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(html),
        );
        return (
          await window.webContents.printToPDF({
            printBackground: true,
            pageSize: "A4",
          })
        ).toString("base64");
      } finally {
        window.destroy();
      }
    }, html);
    fs.writeFileSync(file, Buffer.from(pdf, "base64"));
  }
  const fileSha = createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  await productEntry(page, "materials").click();
  await app.evaluate(({ dialog }, file) => {
    const old = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => {
      dialog.showOpenDialog = old;
      return { canceled: false, filePaths: [file] };
    };
  }, file);
  await page.getByTestId("materials-import").click();
  const end = Date.now() + 180000;
  let resource, job;
  while (Date.now() < end) {
    resource = query(
      "SELECT * FROM teacher_resources WHERE original_file_name=? AND content_hash=?",
      [path.basename(file), fileSha],
    )[0];
    job =
      resource &&
      query("SELECT * FROM material_structure_jobs WHERE resource_id=?", [
        resource.id,
      ])[0];
    if (job && ["complete", "partial", "failed"].includes(job.status)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(
    job && ["complete", "partial"].includes(job.status),
    JSON.stringify(job),
  );
  assert.equal(job.pages, 1);
  const row = query(
      "SELECT body_json FROM material_structure_pages WHERE generation=? AND page=1",
      [job.generation],
    )[0],
    structure = JSON.parse(row.body_json);
  const candidates = query(
    "SELECT body_json FROM material_structure_questions WHERE generation=? ORDER BY rowid",
    [job.generation],
  ).map((r) => JSON.parse(r.body_json));
  assert.equal(structure.columns.length, 2);
  assert.deepEqual(
    candidates.map((q) => q.number),
    ["1", "2", "3", "4"],
  );
  const rawOptions = structure.lines.flatMap((line) => [
    ...line.text.matchAll(/(?:^|\s)(?:([A-D])[.．、]|[（(]([A-D])[）)])/gu),
  ]);
  assert.equal(
    candidates.reduce((sum, q) => sum + q.options.length, 0),
    rawOptions.length,
  );
  for (const q of candidates) {
    assert.deepEqual(
      q.options.map((o) => o.label),
      [...q.options.map((o) => o.label)].sort(),
    );
    if (q.options.length !== 4) {
      assert.equal(q.status, "needs_review");
      assert(q.issues.includes("uncertain_boundary"));
    }
  }
  report.expectedPrintedOptions = 16;
  report.ocrOptions = rawOptions.length;
  report.missingOcrOptions = 16 - rawOptions.length;
  const ids = structure.paragraphs.flatMap((p) => p.lineIds);
  assert.equal(ids.length, structure.lines.length);
  assert.equal(new Set(ids).size, ids.length);
  await page.getByTestId("materials-search").fill(resource.title);
  await page.getByTestId("materials-refresh").click();
  await page
    .getByTestId("material-" + resource.id)
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "题目与校正", exact: true }).click();
  const panel = page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(panel);
  await panel.getByTestId("structure-page").waitFor();
  assert(
    (await panel.getByTestId("structure-questions").innerText()).includes(
      "题 4",
    ),
  );
  assert.equal(report.errors.length, 0);
  report.checks = [
    "Chromium prints a two-column Chinese fixture with horizontal A-D options",
    "The original PDF import executes actual PDFium, RapidOCR and PP-DocLayoutV3",
    "Four complete questions read down the left column then down the right column",
    "Every OCR-read option retains its question, raw identity and order; missing printed options are quarantined",
    "The original structure UI exposes the reconstructed question relationships",
  ];
  const held = candidates.filter((q) => q.status === "needs_review");
  for (const q of held) {
    const source = query(
      "SELECT body_json FROM material_structure_chunks WHERE generation=? AND id=?",
      [job.generation, q.id],
    )[0];
    assert(source);
    const content = JSON.parse(source.body_json);
    assert(
      query(
        "SELECT id FROM resource_chunks WHERE resource_id=? AND content_md=?",
        [resource.id, content.content],
      ).length,
    );
    const admitted = query(
      "SELECT id,archive_json FROM question_bank_items WHERE json_extract(archive_json,'$.structure.candidateId')=?",
      [q.id],
    );
    for (const item of admitted) {
      const archive = JSON.parse(item.archive_json);
      assert.equal(archive.state, "teacher_edited");
      assert.equal(archive.sourceChecked, true);
      assert(archive.structureReview);
      const receipt = query(
        "SELECT question_id,sha256 FROM material_structure_reviews WHERE id=?",
        [archive.structureReview.id],
      )[0];
      assert.equal(receipt?.question_id, item.id);
      assert.equal(receipt.sha256, archive.structureReview.sha256);
    }
  }
  report.checks.push(
    "Held source text remains indexed; any admitted held candidate has an explicit teacher review receipt",
  );
  // A generated contact header exercises page privacy authority through the real PDF import.
  const privacyFile = path.join(root, "synthetic-privacy-header-v2.pdf");
  if (!fs.existsSync(privacyFile)) {
    const privacyHtml = html.replace(
      "<h1>物理双栏结构回归样本</h1>",
      '<header style="font-size:16px;margin:0 0 15px">测试联系邮箱 teacher@example.test</header><h1>物理结构隐私回归样本</h1>',
    );
    const pdf = await app.evaluate(async ({ BrowserWindow }, html) => {
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      try {
        await window.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(html),
        );
        return (
          await window.webContents.printToPDF({
            printBackground: true,
            pageSize: "A4",
          })
        ).toString("base64");
      } finally {
        window.destroy();
      }
    }, privacyHtml);
    fs.writeFileSync(privacyFile, Buffer.from(pdf, "base64"));
  }
  const privateHash = createHash("sha256")
    .update(fs.readFileSync(privacyFile))
    .digest("hex");
  await productEntry(page, "materials").click();
  await app.evaluate(({ dialog }, file) => {
    const old = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => {
      dialog.showOpenDialog = old;
      return { canceled: false, filePaths: [file] };
    };
  }, privacyFile);
  await page.getByTestId("materials-import").click();
  const privacyEnd = Date.now() + 180000;
  let privacyResource, privacyJob;
  while (Date.now() < privacyEnd) {
    privacyResource = query(
      "SELECT * FROM teacher_resources WHERE original_file_name=? AND content_hash=?",
      [path.basename(privacyFile), privateHash],
    )[0];
    privacyJob =
      privacyResource &&
      query("SELECT * FROM material_structure_jobs WHERE resource_id=?", [
        privacyResource.id,
      ])[0];
    if (
      privacyJob &&
      ["complete", "partial", "failed"].includes(privacyJob.status)
    )
      break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(privacyJob && ["complete", "partial"].includes(privacyJob.status));
  const privatePage = JSON.parse(
    query(
      "SELECT body_json FROM material_structure_pages WHERE generation=? AND page=1",
      [privacyJob.generation],
    )[0].body_json,
  );
  assert(privatePage.rawText.includes("teacher@example.test"));
  const privateChunks = query(
    "SELECT * FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 AND (page_number=1 OR page_number IS NULL OR page_number=0)",
    [privacyResource.id],
  );
  assert(privateChunks.length > 0);
  assert(privateChunks.every((c) => c.source_trust === "unverified"));
  report.privacy = {
    sourceSha256: privateHash,
    pages: privacyJob.pages,
    privateChunks: privateChunks.length,
    headerRole: privatePage.paragraphs
      .filter((p) => p.rawText.includes("teacher@example.test"))
      .map((p) => p.role),
  };
  report.checks.push(
    "Actual OCR header content retains page-level personal-data authority after furniture removal",
  );
  report.sourceSha256 = resource.content_hash;
  report.lines = structure.lines.length;
  report.paragraphs = structure.paragraphs.length;
  report.questionNumbers = candidates.map((q) => q.number);
  report.options = candidates.map((q) => q.options.length);
  report.held = candidates.filter((q) => q.status === "needs_review").length;
  report.ok = true;
  save();
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = String(error.stack || error);
  save();
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => {});
}
