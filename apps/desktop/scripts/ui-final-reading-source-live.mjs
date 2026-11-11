/** One visible manual note on a new full genuine clone. Parent schedules the UI run. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fingerprint, sha256 } from "./acceptance/evidence.mjs";
import {
  ownedExact,
  readPersistedFixtureSource,
  safeTree,
} from "./acceptance/retained-fixture-evidence.mjs";
import {
  readingSchema,
  readingBudget,
  readingParent,
  readingSnapshot,
  readingFiles,
  transportSnapshot,
  assertReadingDelta,
  validateReadingRow,
  assertReadingGuard,
  readOwnedReadingReport,
} from "./acceptance/reading-source-evidence.mjs";
import { assertIsolatedPiMain } from "./acceptance/build-root.mjs";
import {
  continuationBootstrap,
  continuationGuardRead,
  waitContinuationBootstrap,
  readContinuationBootstrapFile,
  closeContinuationRuntime,
} from "./acceptance/paper-adaptation-continuation.mjs";
import { productEntry } from "./product-navigation.mjs";

const started = Date.now(),
  desktop = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2),
  value = (name) =>
    args
      .find((arg) => arg.startsWith("--" + name + "="))
      ?.slice(name.length + 3);
assert(
  args.every(
    (arg) =>
      ["--inspect-only", "--run-ui"].includes(arg) ||
      ["pins", "from"].some((name) => arg.startsWith("--" + name + "=")),
  ),
);
assert.equal(
  new Set(args.map((arg) => arg.split("=")[0])).size,
  args.length,
  "Duplicate arguments rejected",
);
assert.equal(
  Number(args.includes("--inspect-only")) + Number(args.includes("--run-ui")),
  1,
  "Choose one explicit mode",
);
assert(value("pins") && value("from"), "Explicit --pins and --from required");
const parent = readingParent(desktop),
  pinsFile = ownedExact(path.resolve(desktop, value("pins")), parent);
const pins = JSON.parse(fs.readFileSync(pinsFile, "utf8"));
const build = ownedExact(pins.buildRoot, path.join(desktop, "test-results"));
const main = ownedExact(path.join(build, "main/index.js"), build);
function verifyPins() {
  assert.equal(fingerprint(path.join(desktop, "src")).sha256, pins.source);
  assert.equal(fingerprint(build).sha256, pins.build);
}
verifyPins();
const input = readPersistedFixtureSource(
  path.resolve(desktop, value("from")),
  desktop,
  pins,
);
const sourceData = ownedExact(
  path.join(input.reference, "data"),
  input.reference,
);
const originalBefore = input.qualification.sourceTreeSha256,
  sourceBefore = readingSnapshot(sourceData);
assert.equal(
  sourceBefore.tables.material_reading_entries.length,
  0,
  "Explicit genuine fixture has no prior note",
);
assert.equal(sourceBefore.tables.teacher_resources.length, 1);
const resource = sourceBefore.tables.teacher_resources[0];
assert.equal(path.extname(resource.local_path).toLowerCase(), ".pdf");
assert.equal(resource.parse_status, "ready");
assert(
  sourceBefore.tables.resource_chunks.some(
    (row) => row.resource_id === resource.id && row.content_md?.trim(),
  ),
);
const output = fs.mkdtempSync(path.join(parent, "reading-source-"));
const data = path.join(output, "data"),
  profile = path.join(output, "profile");
const reportFile = path.join(output, "report.json"),
  digest = (value) => sha256(JSON.stringify(value));
const report = {
  schemaVersion: readingSchema,
  success: false,
  status: "PREFLIGHT",
  output,
  budget: readingBudget,
  pins: { file: pinsFile, ...pins },
  isolated: { data, profile },
  launches: [],
  errors: [],
  screens: [],
  checks: ["QUALIFIED_SOURCE"],
  input: {
    report: input.producerReportFile,
    reference: input.reference,
    qualification: input.qualification,
    cases: input.cases,
  },
  authorship:
    "Synthetic manual QA text entered through MaterialStudyPanel. Zero AI/OCR/model generation.",
  scripts: [
    "ui-final-reading-source-live.mjs",
    "acceptance/reading-source-evidence.mjs",
    "acceptance/paper-adaptation-continuation.mjs",
  ].map((file) => ({
    file,
    sha256: sha256(fs.readFileSync(path.join(desktop, "scripts", file))),
  })),
};
const flush = () =>
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
flush();
if (args.includes("--inspect-only")) {
  const transport = transportSnapshot(sourceBefore, sourceData, data);
  assert.equal(transport.files.length, 1);
  assert.equal(
    safeTree(input.reference, path.dirname(input.reference)),
    originalBefore,
  );
  verifyPins();
  report.status = "PREFLIGHT_READY";
  report.originalUnchanged = true;
  report.preflight = {
    qualifiedCases: input.cases.map((row) => ({
      role: row.role,
      questionId: row.questionId,
    })),
    sqliteTables: Object.keys(sourceBefore.tables).length,
    resourceId: resource.id,
    sourceVersion: resource.content_hash,
    sourceSnapshotSha256: digest(sourceBefore),
    launches: 0,
    models: 0,
    cloneCreated: false,
  };
  report.elapsedMs = Date.now() - started;
  flush();
  console.log(
    JSON.stringify({ status: report.status, output, launches: 0, models: 0 }),
  );
} else await run();

function prepareClone() {
  fs.cpSync(sourceData, data, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  fs.mkdirSync(profile);
  assert.equal(
    fingerprint(data).sha256,
    fingerprint(sourceData).sha256,
    "Full genuine data copied byte-for-byte",
  );
  const { expected, files } = transportSnapshot(sourceBefore, sourceData, data);
  for (const item of files)
    assert.equal(
      sha256(fs.readFileSync(ownedExact(item.file, data))),
      item.sha256,
    );
  const db = new DatabaseSync(ownedExact(path.join(data, "app.db"), data));
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const item of files) {
      const old = sourceBefore.tables.teacher_resources.find(
        (row) => row.id === item.resourceId,
      );
      const changed = db
        .prepare(
          "UPDATE teacher_resources SET local_path=? WHERE id=? AND content_hash=? AND local_path=?",
        )
        .run(item.file, item.resourceId, item.sha256, old.local_path);
      assert.equal(changed.changes, 1);
    }
    db.exec("COMMIT");
  } finally {
    db.close();
  }
  assert.deepEqual(
    readingSnapshot(data),
    expected,
    "Only clone resource.local_path transport SQL",
  );
  assert.deepEqual(
    readingFiles(data),
    readingFiles(sourceData),
    "Native, assets and originals copied exactly",
  );
  report.transport = {
    onlyField: "teacher_resources.local_path",
    files,
    sqliteSha256: digest(expected),
  };
  report.checks.push("EXACT_CLONE_TRANSPORT");
  flush();
  return expected;
}

async function run() {
  let app,
    page,
    child,
    phase = "CLONE",
    before;
  const deadlineAt = started + readingBudget.totalMs;
  const time = (cap) => {
    const left = deadlineAt - Date.now() - 9000;
    assert(left > 0, "Reading source work deadline");
    return Math.min(cap, left);
  };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (fn, label) => {
    const end = Date.now() + time(10000);
    while (Date.now() < end) {
      if (await fn()) return;
      await pause(80);
    }
    throw Error("WAIT_" + label);
  };
  const bounded = async (work) => {
    let timer;
    try {
      return await Promise.race([
        work(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error("READ_OBSERVATION_DEADLINE")),
            time(15000),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const tid = (id) => page.getByTestId(id);
  const control = async (locator) => {
    await locator.waitFor({ state: "visible", timeout: time(10000) });
    assert.equal(await locator.count(), 1);
    await wait(() => locator.isEnabled(), "CONTROL_ENABLED");
    return locator;
  };
  const click = async (locator) => {
    await control(locator);
    await locator.click({ timeout: time(10000) });
  };
  const capture = async (id) => {
    const file = path.join(output, id + ".png");
    await page.screenshot({
      path: file,
      animations: "disabled",
      timeout: time(10000),
    });
    report.screens.push({ id, file, sha256: sha256(fs.readFileSync(file)) });
    flush();
  };
  const guard = async () => {
    const state = await bounded(() =>
      app.evaluate(continuationGuardRead, true),
    );
    assertReadingGuard(state);
    report.launches[0].guard = state;
    return state;
  };
  const kill = () =>
    new Promise((resolve, reject) => {
      if (!child || child.exitCode !== null || child.signalCode !== null)
        return resolve();
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.once("error", reject);
      killer.once("close", resolve);
    });
  const conserve = () => {
    const after = readingSnapshot(data);
    if (report.savedReading)
      assertReadingDelta(before, after, report.savedReading);
    else
      assert.deepEqual(
        after,
        before,
        "No business mutation before the explicit note save",
      );
    assert.deepEqual(
      readingFiles(data),
      readingFiles(sourceData),
      "Every non-SQLite data file unchanged",
    );
    assert.equal(
      safeTree(input.reference, path.dirname(input.reference)),
      originalBefore,
    );
    assert.deepEqual(
      readPersistedFixtureSource(input.producerReportFile, desktop, pins)
        .qualification,
      input.qualification,
    );
    verifyPins();
    return {
      sqliteSha256: digest(after),
      filesSha256: digest(readingFiles(data)),
    };
  };
  try {
    before = prepareClone();
    phase = "BOOTSTRAP";
    const stateFile = path.join(output, "bootstrap-state.json"),
      bootstrap = path.join(output, "owned-bootstrap.cjs");
    fs.writeFileSync(
      bootstrap,
      continuationBootstrap({ main, profile, diagnosticFile: stateFile }),
      { flag: "wx" },
    );
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (
        /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) ||
        key.startsWith("OMNI_EDU_") ||
        [
          "NODE_OPTIONS",
          "ELECTRON_RUN_AS_NODE",
          "ELECTRON_RENDERER_URL",
        ].includes(key)
      )
        delete env[key];
    Object.assign(env, {
      NODE_ENV: "development",
      OMNI_EDU_E2E_VISIBLE: "1",
      OMNI_EDU_DATA_ROOT: data,
      OMNI_EDU_REPO_ROOT: path.resolve(desktop, "../.."),
      OMNI_EDU_XIAOZHI_PI: "1",
    });
    const { _electron: electron } = await import("playwright");
    report.launches.push({ number: 1 });
    flush();
    app = await electron.launch({
      args: [
        bootstrap,
        "--user-data-dir=" + profile,
        "--force-device-scale-factor=1",
      ],
      cwd: data,
      env,
      timeout: time(25000),
    });
    child = app.process();
    report.launches[0].pid = child.pid;
    for (const stream of [child.stdout, child.stderr])
      stream?.on("data", (bytes) => {
        if (
          /uncaught|unhandled rejection|unhandledrejection/i.test(String(bytes))
        )
          report.errors.push({
            code: "MAIN_RUNTIME_FATAL",
            phase,
            hash: sha256(bytes),
          });
      });
    await waitContinuationBootstrap(app, {
      timeout: time(25000),
      observeWindow: true,
      readState: () => readContinuationBootstrapFile(stateFile, child),
      onWindow: (window) => {
        page = window;
        page.setDefaultTimeout(8000);
        page.on("pageerror", (error) =>
          report.errors.push({
            code: "PAGE_ERROR",
            phase,
            hash: sha256(error.stack || String(error)),
          }),
        );
        page.on("console", (message) => {
          if (message.type() === "error")
            report.errors.push({
              code: "CONSOLE_ERROR",
              phase,
              hash: sha256(message.text()),
            });
        });
      },
    });
    report.launches[0].identity = await bounded(() =>
      assertIsolatedPiMain(app, main, profile),
    );
    report.launches[0].storagePath = await bounded(() =>
      app.evaluate(({ session }) => session.defaultSession.storagePath),
    );
    assert.equal(report.launches[0].storagePath, profile);
    report.launches[0].visible = await bounded(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    );
    assert.equal(report.launches[0].visible, true);
    await guard();
    await tid("xiaozhi-pi-workspace").waitFor({ timeout: time(15000) });
    assert.equal(
      path.resolve(
        await bounded(() => page.evaluate(() => window.omniEdu.getDataRoot())),
      ),
      data,
    );
    await page.emulateMedia({ colorScheme: "light" });
    report.viewport = await bounded(() =>
      page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        theme: "light",
      })),
    );
    phase = "VISIBLE_NOTE";
    await click(productEntry(page, "materials"));
    await tid("materials-workspace").waitFor({ timeout: time(10000) });
    await click(tid("materials-mode-catalog"));
    await click(tid("material-" + resource.id));
    await wait(
      async () =>
        (await tid("materials-detail").getAttribute("data-resource-id")) ===
        resource.id,
      "ACTUAL_PDF_SELECTED",
    );
    assert.equal(
      await tid("materials-detail").getAttribute("data-resource-version"),
      resource.content_hash,
    );
    await click(tid("materials-section-notes"));
    await control(tid("material-study-note"));
    assert.equal(await tid("material-study-note").inputValue(), "");
    conserve();
    const note =
      "人工 QA 阅读笔记（合成测试文字，非 AI 结果）。\n" +
      "手工检查当前 PDF 第一段的阅读位置与保存操作。来源正文和题目保留原样。\n" +
      path.basename(output);
    report.manualText = note;
    await tid("material-study-note").fill(note, { timeout: time(8000) });
    assert.equal(
      readingSnapshot(data).tables.material_reading_entries.length,
      0,
    );
    await capture("manual-note-before-save");
    await click(tid("material-study-save"));
    await wait(
      () => readingSnapshot(data).tables.material_reading_entries.length === 1,
      "ACTUAL_UI_NOTE_SAVED",
    );
    report.savedReading =
      readingSnapshot(data).tables.material_reading_entries[0];
    assert.equal(report.savedReading.note, note);
    await wait(
      async () =>
        (await tid("material-study-notice").innerText()).includes(
          "已保存当前阅读位置和笔记",
        ),
      "UI_SAVE_ACKNOWLEDGED",
    );
    assert.equal(await tid("material-study-note").inputValue(), note);
    assert.equal(await tid("material-study-error").count(), 0);
    await capture("manual-note-saved");
    report.checks.push("UI_MANUAL_SAVE");
    const validated = await validateReadingRow(
      data,
      report.savedReading,
      desktop,
    );
    report.sourceProof = validated.proof;
    report.checks.push("SQLITE_SOURCE_PROOF");
    conserve();
    await guard();
    assert.deepEqual(report.errors, []);
  } catch (error) {
    fs.writeFileSync(
      path.join(output, "local-failure.json"),
      JSON.stringify(
        { phase, name: error.name, message: error.message, stack: error.stack },
        null,
        2,
      ) + "\n",
    );
    report.status = "FAIL";
    report.failure = {
      code: "READING_SOURCE_FAILED",
      phase,
      hash: sha256(error.stack || String(error)),
    };
  } finally {
    phase = "CLOSE";
    if (app) {
      try {
        const cleanup = await closeContinuationRuntime({
          observeGuard: guard,
          close: () => app.close(),
          forceClose: () => {
            void kill().catch(() => {});
          },
          deadlineAt,
          cap: 4000,
        });
        report.launches[0].cleanup = cleanup;
        assert(
          cleanup.closed && !cleanup.guardError && !cleanup.closeError,
          "Owned runtime close verified",
        );
        const end = Math.min(deadlineAt, Date.now() + 2000);
        while (
          child.exitCode === null &&
          child.signalCode === null &&
          Date.now() < end
        )
          await pause(30);
        assert(
          child.exitCode !== null || child.signalCode !== null,
          "Owned process exited",
        );
        report.launches[0].exit = {
          code: child.exitCode,
          signal: child.signalCode,
        };
      } catch (error) {
        await kill();
        report.errors.push({
          code: "OWNED_CLEANUP_FAILED",
          hash: sha256(String(error)),
        });
      }
    }
    try {
      assert(before, "Clone preparation completed");
      report.final = conserve();
      report.originalUnchanged = true;
      report.integrityVerified = true;
      if (
        !report.failure &&
        report.errors.length === 0 &&
        report.savedReading
      ) {
        report.checks.push("FINAL_CONSERVATION");
        report.success = true;
        report.status = "PASS";
        report.elapsedMs = Date.now() - started;
        flush();
        await readOwnedReadingReport(reportFile, desktop);
      }
    } catch (error) {
      report.success = false;
      report.status = "FAIL";
      report.errors.push({
        code: "FINAL_INTEGRITY_FAILED",
        hash: sha256(error.stack || String(error)),
      });
    }
    report.elapsedMs = Date.now() - started;
    if (report.elapsedMs > readingBudget.totalMs) {
      report.success = false;
      report.status = "FAIL";
      report.errors.push({ code: "TOTAL_DEADLINE" });
    }
    if (!report.success) report.status = "FAIL";
    flush();
    console.log(
      JSON.stringify({
        success: report.success,
        status: report.status,
        output,
        report: reportFile,
      }),
    );
    process.exitCode = report.success ? 0 : 1;
  }
}
