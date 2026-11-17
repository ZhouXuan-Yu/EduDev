import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const { MaterialStructureRepository } = await import(
  "../../src/main/assets/material-structure-repository.ts"
);
const { DOCUMENT_STRUCTURE_ENGINE } = await import(
  "../../src/shared/material-document-structure.ts"
);
const { validQuestionArchive, QUESTION_STRUCTURE_ARCHIVE_SCHEMA } =
  await import("../../src/shared/question-archive.ts");
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE ai_tasks(task_type TEXT,input_hash TEXT,status TEXT)");
const results = [];
async function check(name, action) {
  await action();
  results.push(name);
  console.log("PASS " + name);
}
const id = "resource_12345678-1234-1234-1234-123456789abc",
  version = "a".repeat(64);
let resource = {
  id,
  contentHash: version,
  originalFileName: "exam.pdf",
  chunkCount: 0,
  parseStatus: "pending",
};
let currentLease = { taskId: "t", payload: "immutable-claim" },
  pageCalls = 0,
  published = 0,
  enqueued = 0,
  failPage = 0,
  failPublish = false;
function input(page) {
  const texts =
    page === 1
      ? ["1. 已知物理条件，", "（1）计算第一问。"]
      : [
          "（2）计算跨页的第二问。",
          "2. 求下一题的结果。",
          "A. 甲 B. 乙 C. 丙 D. 丁",
        ];
  const lines = texts.map((text, i) => {
    const quad = [
      [0.1, 0.1 + i * 0.04],
      [0.85, 0.1 + i * 0.04],
      [0.85, 0.12 + i * 0.04],
      [0.1, 0.12 + i * 0.04],
    ];
    return {
      id: "line-" + (i + 1),
      kind: "text",
      text,
      score: page === 2 && i === 2 ? 0.7 : 0.99,
      normalizedQuad: quad,
      quad,
      needsReview: true,
    };
  });
  return {
    resourceId: id,
    version,
    page,
    totalPages: 2,
    rasterSha256: "b".repeat(64),
    sourceEngine: "fixture-ocr",
    layoutEngine: "fixture-layout",
    lines,
    regions: [
      {
        id: "block-1",
        kind: "text",
        score: 0.99,
        box: [0, 0, 1, 1],
        needsReview: true,
      },
    ],
  };
}
function document(r, q) {
  return {
    schemaVersion: "xiaozhi.question-document.v1",
    source: {
      resourceId: r.id,
      resourceVersion: r.contentHash,
      parserVersion: DOCUMENT_STRUCTURE_ENGINE,
      ocrVersion: "fixture",
    },
    blocks: [
      {
        id: "transcription",
        kind: "text",
        text: q.stem,
        anchors: [q.anchors[0]],
      },
    ],
    answer: { origin: "missing", text: "", anchors: [] },
    analysis: { origin: "missing", text: "", anchors: [] },
  };
}
const host = {
  all: async (sql, values = []) => db.prepare(sql).all(...values),
  run: async (sql, values = []) => {
    db.prepare(sql).run(...values);
  },
  resource: async () => resource,
  verify: async (i, v) => {
    if (resource.id !== i || resource.contentHash !== v)
      throw Error("source_changed");
  },
  lease: async (l) => JSON.stringify(l) === JSON.stringify(currentLease),
  page: async (r, page) => {
    pageCalls++;
    if (page === failPage) throw Error("timeout");
    return { input: input(page), image: { sha256: "b".repeat(64) } };
  },
  document: async (r, q) => document(r, q),
  publish: async () => {
    if (failPublish) throw Error("disk_full");
    published++;
  },
  enqueue: async () => {
    enqueued++;
  },
  writer: async (action) => {
    db.exec("BEGIN");
    try {
      const result = await action(repo);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};
const repo = new MaterialStructureRepository(host),
  signal = new AbortController().signal;
const query = { resourceId: id, version, page: 1 };
await repo.migrate();
await repo.migrate();
await check(
  "Fresh import is gated before raw parsing and no legacy fallback is returned",
  async () => {
    assert.equal(await repo.begin(resource, signal, currentLease), true);
    assert.equal(await repo.required(id), true);
    await assert.rejects(
      () => repo.candidates(id, version, 0),
      /source_incomplete/,
    );
  },
);
await check(
  "A failed second page keeps a durable first-page snapshot and publishes nothing",
  async () => {
    failPage = 2;
    await assert.rejects(
      () => repo.complete(resource, signal, currentLease),
      /timeout/,
    );
    await repo.fail(id, Error("timeout"), currentLease);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM material_structure_pages").get().n,
      1,
    );
    assert.equal(published, 0);
    assert.equal((await repo.view(query)).summary.status, "failed");
  },
);
await check(
  "Restart/retry resumes cached pages and reconstructs one complete cross-page question",
  async () => {
    currentLease = { taskId: "t", payload: "new-immutable-claim" };
    failPage = 0;
    await repo.begin(resource, signal, currentLease);
    await repo.complete(resource, signal, currentLease);
    assert.equal(pageCalls, 3);
    assert.equal(published, 1);
    assert.equal(enqueued, 1);
    assert.equal(await repo.required(id), false);
    const view = await repo.view(query);
    assert.equal(view.summary.status, "partial");
    assert.equal(view.summary.questions, 2);
    assert.equal(view.summary.held, 1);
    assert.deepEqual(view.questions[0].pageRange, [1, 2]);
    assert.equal(view.questions[0].subquestions.length, 2);
  },
);
let reference, original;
await check(
  "Low-confidence candidate is retained with source geometry and excluded from searchable chunks",
  async () => {
    const page = await repo.candidates(id, version, 0);
    assert.equal(page.items.length, 2);
    assert.equal(
      page.items.filter((x) => x.question.status === "candidate").length,
      1,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM material_structure_chunks").get().n,
      1,
    );
    reference = page.items[0].reference;
    original = await repo.authenticate(reference, signal);
    assert(original.document);
    assert.equal((await repo.view(query)).page.lines[0].quad.length, 4);
  },
);
await check(
  "Structure references require the versioned strict archive schema",
  () => {
    const source = {};
    const minimal = {
      schemaVersion: QUESTION_STRUCTURE_ARCHIVE_SCHEMA,
      extractor: "layout-question.v1",
      state: "rule_extracted",
      number: "1",
      sources: [source],
      issues: [],
      sourceRisks: [],
      sourceChecked: false,
      answerOrigin: "missing",
      analysisOrigin: "missing",
      structure: reference,
    };
    assert.equal(validQuestionArchive(minimal), false);
    assert.equal(
      validQuestionArchive({
        ...minimal,
        structure: { ...reference, sha256: "bad" },
      }),
      false,
    );
  },
);
await check(
  "Rebuild creates a new generation and retains authenticatable original provenance",
  async () => {
    resource = { ...resource, chunkCount: 5, parseStatus: "ready" };
    await repo.request(query);
    await repo.begin(resource, signal, currentLease);
    await repo.complete(resource, signal, currentLease);
    assert.notEqual(
      (await repo.view(query)).summary.generation,
      reference.generation,
    );
    assert.deepEqual(await repo.authenticate(reference, signal), original);
  },
);
await check(
  "Cancelled lease cannot write or publish a generation",
  async () => {
    await repo.request(query);
    await repo.begin(resource, signal, currentLease);
    const old = { ...currentLease };
    currentLease = { taskId: "t", payload: "revoked" };
    await assert.rejects(
      () => repo.complete(resource, signal, old),
      /cancelled/,
    );
    assert.equal(published, 2);
  },
);
await check(
  "Final publication failure rolls back chunks and terminal state",
  async () => {
    await repo.begin(resource, signal, currentLease);
    failPublish = true;
    await assert.rejects(
      () => repo.complete(resource, signal, currentLease),
      /disk_full/,
    );
    assert.equal((await repo.view(query)).summary.status, "running");
    const generation = (await repo.view(query)).summary.generation;
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM material_structure_chunks WHERE generation=?",
        )
        .get(generation).n,
      0,
    );
    failPublish = false;
    await repo.complete(resource, signal, currentLease);
    assert.equal((await repo.view(query)).summary.status, "partial");
  },
);
await check(
  "Changed originals and tampered snapshots fail authentication",
  async () => {
    resource = { ...resource, contentHash: "c".repeat(64) };
    await assert.rejects(
      () => repo.authenticate(reference, signal),
      /source_changed/,
    );
    resource = { ...resource, contentHash: version };
    db.prepare(
      "UPDATE material_structure_questions SET body_json='{}' WHERE generation=? AND id=?",
    ).run(reference.generation, reference.candidateId);
    await assert.rejects(
      () => repo.authenticate(reference, signal),
      /source_changed/,
    );
  },
);
await check(
  "Legacy ready resources retain existing data until explicitly requested",
  async () => {
    resource = {
      ...resource,
      id: "resource_22345678-1234-1234-1234-123456789abc",
    };
    assert.equal(await repo.begin(resource, signal, currentLease), false);
    assert.equal(await repo.candidates(resource.id, version, 0), undefined);
  },
);
db.close();
console.log(JSON.stringify({ success: true, count: results.length, results }));
