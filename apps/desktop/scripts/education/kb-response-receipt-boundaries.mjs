import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { MaterialAiResponses } from "../../src/main/assets/material-ai-responses.ts";
import { completeMaterialAi } from "../../src/main/assets/material-ai-provider.ts";
import {
  MATERIAL_AI_RESPONSE_RECEIPT as schemaVersion,
  validAiResponseQuery,
} from "../../src/shared/material-ai-response.ts";

export async function runResponseReceiptChecks({
  check,
  sourceContentFixtures,
}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "omni-response-receipts-"),
  );
  const file = path.join(root, "app.db");
  let db = new DatabaseSync(file);
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,input_json TEXT,status TEXT,lease TEXT,PRIMARY KEY(batch_id,ordinal));",
  );
  const batchId = "aibatch_" + randomUUID(),
    input = "{}";
  const inputSha = createHash("sha256").update(input).digest("hex");
  db.prepare("INSERT INTO material_ai_units VALUES(?,?,?,?,?)").run(
    batchId,
    1,
    input,
    "dispatched",
    "",
  );
  db.prepare("INSERT INTO material_ai_units VALUES(?,?,?,?,?)").run(
    batchId,
    2,
    input,
    "pending",
    "",
  );
  const host = {
    all: async (sql, values = []) => db.prepare(sql).all(...values),
    run: async (sql, values = []) => {
      db.prepare(sql).run(...values);
    },
  };
  const receipts = new MaterialAiResponses(host),
    query = { schemaVersion, batchId, ordinal: 1 };
  try {
    await check(
      "Response migration is idempotent and legacy units have no invented receipts",
      async () => {
        await receipts.migrate();
        await receipts.migrate();
        assert.deepEqual((await receipts.view(query)).receipts, []);
      },
    );
    const lease = randomUUID();
    let id;
    const body = Buffer.from(
      '{"broken":"原文 <script>forbidden()</script>',
      "utf8",
    );
    await check(
      "Prepared request receives exact malformed bytes after its old lease is cancelled, without publishing source facts",
      async () => {
        id = await receipts.prepare(
          batchId,
          1,
          lease,
          inputSha,
          "source",
          "deepseek-flash",
        );
        assert.equal((await receipts.view(query)).receipts[0].receivedAt, "");
        db.prepare(
          "UPDATE material_ai_units SET status='cancelled',lease='' WHERE ordinal=1",
        ).run();
        await receipts.receive(id, body, "provider-envelope.v1");
        const result = await receipts.view({ ...query, responseId: id });
        assert.equal(result.selected.body, body.toString("utf8"));
        assert.equal(result.receipts[0].bytes, body.length);
        assert.equal(
          db
            .prepare("SELECT status FROM material_ai_units WHERE ordinal=1")
            .get().status,
          "cancelled",
        );
      },
    );
    await check(
      "Identical delivery is idempotent and conflicting bytes cannot overwrite a received response",
      async () => {
        const before = db
          .prepare("SELECT * FROM material_ai_response_receipts")
          .all();
        await receipts.receive(id, body, "provider-envelope.v1");
        await assert.rejects(
          receipts.receive(id, Buffer.from("changed"), "provider-envelope.v1"),
          /conflict/,
        );
        await assert.rejects(
          receipts.prepare(
            batchId,
            1,
            lease,
            inputSha,
            "final",
            "deepseek-flash",
          ),
          /conflict/,
        );
        assert.deepEqual(
          db.prepare("SELECT * FROM material_ai_response_receipts").all(),
          before,
        );
      },
    );
    await check(
      "Cold reads preserve original bytes, reject tampering and keep receipt identities scoped to their unit",
      async () => {
        db.close();
        db = new DatabaseSync(file);
        assert.equal(
          (await receipts.view({ ...query, responseId: id })).selected.body,
          body.toString("utf8"),
        );
        await assert.rejects(
          receipts.view({ ...query, ordinal: 2, responseId: id }),
          /invalid_input/,
        );
        const encoded = body.toString("base64");
        db.prepare(
          "UPDATE material_ai_response_receipts SET body_base64='YQ==' WHERE id=?",
        ).run(id);
        await assert.rejects(
          receipts.view({ ...query, responseId: id }),
          /source_changed/,
        );
        db.prepare(
          "UPDATE material_ai_response_receipts SET body_base64=? WHERE id=?",
        ).run(encoded, id);
        db.prepare(
          "UPDATE material_ai_units SET input_json='changed' WHERE ordinal=1",
        ).run();
        await assert.rejects(receipts.view(query), /source_changed/);
        db.prepare(
          "UPDATE material_ai_units SET input_json=? WHERE ordinal=1",
        ).run(input);
      },
    );
    await check(
      "Binary and empty received bodies retain hashes and the one MiB bound excludes partial oversized saves",
      async () => {
        const binaryId = await receipts.prepare(
          batchId,
          1,
          randomUUID(),
          inputSha,
          "first",
          "deepseek-flash",
        );
        await receipts.receive(
          binaryId,
          Buffer.from([0xff, 0xfe, 0x00]),
          "provider-envelope.v1",
        );
        assert.equal(
          (await receipts.view({ ...query, responseId: binaryId })).selected
            .encoding,
          "base64",
        );
        const bomId = await receipts.prepare(
          batchId,
          1,
          randomUUID(),
          inputSha,
          "source",
          "deepseek-flash",
        );
        const bomBody = "\uFEFF原始响应";
        await receipts.receive(
          bomId,
          Buffer.from(bomBody),
          "provider-envelope.v1",
        );
        assert.equal(
          (await receipts.view({ ...query, responseId: bomId })).selected.body,
          bomBody,
        );
        const emptyId = await receipts.prepare(
          batchId,
          1,
          randomUUID(),
          inputSha,
          "final",
          "deepseek-flash",
        );
        await assert.rejects(
          receipts.receive(
            emptyId,
            Buffer.alloc(1048577),
            "provider-envelope.v1",
          ),
          /unit_too_large/,
        );
        await receipts.receive(
          emptyId,
          Buffer.alloc(0),
          "provider-envelope.v1",
        );
        const result = await receipts.view({ ...query, responseId: emptyId });
        assert.equal(result.selected.body, "");
        assert.equal(
          result.receipts.at(-1).sha256,
          createHash("sha256").update("").digest("hex"),
        );
      },
    );
    await check(
      "Response queries reject unknown keys, wrong units, malformed receipt IDs and getters",
      () => {
        assert(validAiResponseQuery(query));
        let accessed = 0;
        const getter = { ...query };
        Object.defineProperty(getter, "responseId", {
          enumerable: true,
          get() {
            accessed++;
            return id;
          },
        });
        for (const value of [
          { ...query, extra: 1 },
          { ...query, ordinal: 0 },
          { ...query, ordinal: "1" },
          { ...query, responseId: "arbitrary" },
          getter,
        ])
          assert(!validAiResponseQuery(value));
        assert.equal(accessed, 0);
      },
    );
    await check(
      "SQLite backup restores exact received evidence without external file paths",
      async () => {
        const target = path.join(root, "backup.db");
        db.prepare("VACUUM INTO ?").run(target);
        const original = db;
        db = new DatabaseSync(target);
        try {
          const restored = await receipts.view({ ...query, responseId: id });
          assert.equal(restored.selected.body, body.toString("utf8"));
          assert.equal(
            restored.receipts[0].sha256,
            createHash("sha256").update(body).digest("hex"),
          );
        } finally {
          db.close();
          db = original;
        }
      },
    );
  } finally {
    db.close();
  }
  await check(
    "Actual executor retains malformed completion content before rejection and never silently resubmits it",
    () =>
      sourceContentFixtures.enabled(async () => {
        const f = await sourceContentFixtures.fixture();
        try {
          f.repo.runtime.complete = async () => '{"invalid":';
          const batch = await f.repo.create(f.input);
          await f.repo.drain();
          const saved = await f.repo.responses.view({
            schemaVersion,
            batchId: batch,
            ordinal: 1,
          });
          assert.equal(saved.receipts.length, 1);
          assert.equal(saved.receipts[0].phase, "first");
          const raw = await f.repo.responses.view({
            schemaVersion,
            batchId: batch,
            ordinal: 1,
            responseId: saved.receipts[0].id,
          });
          assert.equal(raw.selected.body, '{"invalid":');
          assert.equal(raw.receipts[0].format, "completion-content.v1");
          assert.equal(
            f.db.prepare("SELECT status FROM material_ai_units").get().status,
            "failed",
          );
          assert.equal(f.db.prepare("SELECT error FROM material_ai_units").get().error, "invalid_response");
          assert.equal(
            f.db.prepare("SELECT COUNT(*) n FROM material_ai_members").get().n,
            0,
          );
          await f.repo.drain();
          assert.equal(
            f.db
              .prepare("SELECT COUNT(*) n FROM material_ai_response_receipts")
              .get().n,
            1,
          );
        } finally {
          await f.dispose();
        }
      }),
  );
  await check(
    "Stopping new receipt capture retains existing readers and permits the original validated question path",
    () =>
      sourceContentFixtures.enabled(async () => {
        const previous = process.env.OMNI_EDU_AI_RESPONSE_RECEIPTS;
        process.env.OMNI_EDU_AI_RESPONSE_RECEIPTS = "0";
        const f = await sourceContentFixtures.fixture();
        try {
          await f.run();
          assert((await f.question()).document);
          assert.equal(
            f.db
              .prepare("SELECT COUNT(*) n FROM material_ai_response_receipts")
              .get().n,
            0,
          );
        } finally {
          if (previous === undefined)
            delete process.env.OMNI_EDU_AI_RESPONSE_RECEIPTS;
          else process.env.OMNI_EDU_AI_RESPONSE_RECEIPTS = previous;
          await f.dispose();
        }
      }),
  );
  await check(
    "Production provider persists complete envelopes before JSON, finish-reason or question validation, and propagates storage failure",
    () =>
      sourceContentFixtures.enabled(async () => {
        const f = await sourceContentFixtures.fixture(),
          previous = globalThis.fetch;
        try {
          await f.run();
          const input = f.inputs[0];
          for (const envelope of [
            "not JSON",
            JSON.stringify({
              choices: [{ finish_reason: "length", message: { content: "{" } }],
            }),
          ]) {
            let saved;
            globalThis.fetch = async () => new Response(envelope);
            await assert.rejects(
              completeMaterialAi(
                {
                  ...input,
                  onResponse: async (bytes) => {
                    saved = Buffer.from(bytes);
                  },
                },
                new AbortController().signal,
              ),
              /invalid_response/,
            );
            assert.equal(saved.toString(), envelope);
          }
          globalThis.fetch = async () => new Response("not JSON");
          await assert.rejects(
            completeMaterialAi(
              {
                ...input,
                onResponse: async () => {
                  throw Error("storage_unavailable");
                },
              },
              new AbortController().signal,
            ),
            /storage_unavailable/,
          );
        } finally {
          globalThis.fetch = previous;
          await f.dispose();
        }
      }),
  );
}
