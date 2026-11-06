import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import sqlite3 from "sqlite3";
import {
  beginMaterialWrite,
  isSqliteWriteLock,
} from "../../src/main/sqlite-write-lock.ts";

const script = fileURLToPath(import.meta.url);
const mode = process.argv[2];
const root = fs.mkdtempSync(
  path.join(os.tmpdir(), "omni-material-write-lock-"),
);
const connections = [];
async function open() {
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(
      path.join(root, "app.db"),
      (error) => (error ? reject(error) : resolve(connection)),
    );
  });
  connections.push(db);
  db.serialize();
  return {
    exec: (sql) =>
      new Promise((resolve, reject) =>
        db.exec(sql, (error) => (error ? reject(error) : resolve())),
      ),
    all: (sql) =>
      new Promise((resolve, reject) =>
        db.all(sql, (error, rows) => (error ? reject(error) : resolve(rows))),
      ),
  };
}
async function close() {
  for (const db of connections)
    await new Promise((resolve, reject) =>
      db.close((error) => (error ? reject(error) : resolve())),
    );
}

try {
  const owner = await open();
  await owner.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE facts(id INTEGER PRIMARY KEY);",
  );
  if (mode?.startsWith("--pool-")) {
    assert.equal(process.env.UV_THREADPOOL_SIZE, "2");
    const writers = await Promise.all([open(), open()]);
    await owner.exec("BEGIN IMMEDIATE;");
    process.env.OMNI_EDU_MATERIAL_ASYNC_WRITE_LOCK =
      mode === "--pool-original" ? "0" : "1";
    let bodies = 0;
    const started = performance.now();
    const pending = writers.map(async (writer, index) => {
      await beginMaterialWrite(writer.exec);
      bodies++;
      await writer.exec(`INSERT INTO facts VALUES(${index}); COMMIT;`);
    });
    const released = new Promise((resolve, reject) =>
      setTimeout(() => owner.exec("COMMIT;").then(resolve, reject), 150),
    );
    const settled = await Promise.allSettled(pending);
    await released;
    const elapsedMs = performance.now() - started;
    const failures = settled.filter(
      (result) => result.status === "rejected",
    ).length;
    const count = (await owner.all("SELECT COUNT(*) n FROM facts"))[0].n;
    assert.equal(count, bodies);
    console.log(JSON.stringify({ mode, elapsedMs, failures, bodies, count }));
  } else {
    const checks = [];
    const check = async (name, action) => {
      await action();
      checks.push(name);
      console.log("PASS " + name);
    };
    await check(
      "Native SQLite busy classification preserves non-lock failures",
      async () => {
        assert(
          isSqliteWriteLock(
            Object.assign(new Error("locked"), {
              code: "SQLITE_BUSY_SNAPSHOT",
            }),
          ),
        );
        assert(isSqliteWriteLock(new Error("SQLITE_LOCKED: table locked")));
        assert(
          !isSqliteWriteLock(
            Object.assign(new Error("disk full"), { code: "SQLITE_FULL" }),
          ),
        );
        assert(!isSqliteWriteLock(new Error("source_changed")));
        let calls = 0;
        await assert.rejects(
          beginMaterialWrite(async (sql) => {
            if (sql.startsWith("BEGIN")) {
              calls++;
              throw Object.assign(new Error("disk full"), {
                code: "SQLITE_FULL",
              });
            }
          }),
          /disk full/,
        );
        assert.equal(calls, 1);
      },
    );
    await check(
      "Each writer preserves its existing foreign-key policy",
      async () => {
        const writer = await open();
        await beginMaterialWrite(writer.exec, undefined, false);
        assert.equal(
          (await writer.all("PRAGMA foreign_keys"))[0].foreign_keys,
          0,
        );
        await writer.exec("ROLLBACK;");
        await beginMaterialWrite(writer.exec);
        assert.equal(
          (await writer.all("PRAGMA foreign_keys"))[0].foreign_keys,
          1,
        );
        await writer.exec("ROLLBACK;");
      },
    );
    await check(
      "Cancelled lock wait ends promptly without beginning or writing a transaction",
      async () => {
        const writer = await open();
        await owner.exec("BEGIN IMMEDIATE;");
        const controller = new AbortController();
        const started = performance.now();
        const pending = beginMaterialWrite(writer.exec, controller.signal);
        const timer = setTimeout(() => controller.abort(), 60);
        try {
          await assert.rejects(pending, (error) => error.name === "AbortError");
        } finally {
          clearTimeout(timer);
          await owner.exec("ROLLBACK;");
        }
        assert(performance.now() - started < 500);
        await writer.exec("BEGIN IMMEDIATE; ROLLBACK;");
        assert.equal((await owner.all("SELECT COUNT(*) n FROM facts"))[0].n, 0);
      },
    );
    await check(
      "Exhausted real lock wait reports busy and releases its connection without publishing facts",
      async () => {
        const writer = await open();
        await owner.exec("BEGIN IMMEDIATE;");
        const started = performance.now();
        try {
          await assert.rejects(
            beginMaterialWrite(writer.exec),
            (error) => error.message === "busy",
          );
        } finally {
          await owner.exec("ROLLBACK;");
        }
        const elapsed = performance.now() - started;
        assert(elapsed >= 9900 && elapsed < 12000);
        await writer.exec("BEGIN IMMEDIATE; ROLLBACK;");
        assert.equal((await owner.all("SELECT COUNT(*) n FROM facts"))[0].n, 0);
      },
    );
    await check(
      "Transaction errors roll back facts and are never retried by lock acquisition",
      async () => {
        const writer = await open();
        let bodies = 0;
        await beginMaterialWrite(writer.exec);
        try {
          bodies++;
          await writer.exec(
            "INSERT INTO facts VALUES(9); INSERT INTO missing_table VALUES(9);",
          );
          assert.fail("Expected transaction failure");
        } catch (error) {
          await writer.exec("ROLLBACK;");
          assert.match(error.message, /missing_table/);
        }
        assert.equal(bodies, 1);
        assert.equal((await owner.all("SELECT COUNT(*) n FROM facts"))[0].n, 0);
      },
    );
    const runPool = (flag) =>
      new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--experimental-transform-types", script, flag],
          {
            env: { ...process.env, UV_THREADPOOL_SIZE: "2" },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "",
          stderr = "";
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Owned pool test deadline exceeded"));
        }, 20000);
        child.stdout.on("data", (value) => {
          stdout += value;
        });
        child.stderr.on("data", (value) => {
          stderr = (stderr + value).slice(-8000);
        });
        child.on("error", reject);
        child.on("exit", (code) => {
          clearTimeout(timer);
          if (code !== 0) reject(new Error(stderr));
          else resolve(JSON.parse(stdout.trim()));
        });
      });
    const before = await runPool("--pool-original");
    const after = await runPool("--pool-async");
    await check(
      "Two busy writers no longer starve the thread pool needed by the current owner to commit",
      async () => {
        assert(before.failures >= 1);
        assert.equal(after.failures, 0);
        assert.equal(after.bodies, 2);
        assert(after.elapsedMs < 1500);
      },
    );
    console.log(
      JSON.stringify({
        success: true,
        checks: checks.length,
        root,
        before,
        after,
        scope:
          "Native sqlite3 disk/WAL connections, controlled two-thread lock contention, cancellation and bounded failure. Historical material parse failure root cause remains unknown.",
      }),
    );
  }
} finally {
  await close();
}
