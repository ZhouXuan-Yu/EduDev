import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const { MaterialStructureRepository, reviseStructureDocument } = await import(
  "../../src/main/assets/material-structure-repository.ts"
);
const { DOCUMENT_STRUCTURE_ENGINE } = await import(
  "../../src/shared/material-document-structure.ts"
);
const { validQuestionArchive, QUESTION_STRUCTURE_ARCHIVE_SCHEMA } =
  await import("../../src/shared/question-archive.ts");
const { QUESTION_BOOK_ARCHIVE_SCHEMA } = await import(
  "../../src/shared/question-book-answer.ts"
);
assert.notEqual(
  QUESTION_STRUCTURE_ARCHIVE_SCHEMA,
  QUESTION_BOOK_ARCHIVE_SCHEMA,
);
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE ai_tasks(task_type TEXT,input_hash TEXT,status TEXT)");
db.exec("CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,generation TEXT,state TEXT,total INTEGER); CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,error TEXT,result_json TEXT)");
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
          "【答案】源答案",
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
    answer: q.answer
      ? { origin: "source", text: q.answer, anchors: [q.anchors.at(-1)] }
      : { origin: "missing", text: "", anchors: [] },
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
await check("PDF admission rechecks staged questions and fails closed during retry", async () => {
  const stem = "已知电阻 R1 = 5Ω，保持电流不变，求两端的电压。";
  const q = { kind: "question", number: "3", pageRange: [1, 1], sharedMaterialIds: [], subquestions: [], assets: [], options: [], anchors: [], stem, answer: "", analysis: "" };
  const nativeText = "3. " + stem + "\n4. 计算另一题。";
  const receipt = { status: "needs_review", error: "text_conflict", method: "ocr", text: stem, nativeText, ocrText: stem, width: 100, height: 100, imageArea: 0, nativeBoxes: [] };
  db.prepare("INSERT INTO material_pdf_jobs VALUES (?,?,?,?,?)").run(id, version, "pdf-stage", "partial", 1);
  db.prepare("INSERT INTO material_pdf_pages VALUES (?,?,?,?,?)").run("pdf-stage", 1, receipt.status, receipt.error, JSON.stringify(receipt));
  try {
    assert(await repo.permitsPdfQuestion(resource, q));
    assert(!await repo.permitsPdfQuestion(resource, { ...q, stem: stem.replace("5Ω", "15Ω") }));
    db.exec("UPDATE material_pdf_pages SET status='pending',error='',result_json=''");
    assert(!await repo.permitsPdfQuestion(resource, q));
    db.exec("UPDATE material_pdf_pages SET status='failed',error='page_timeout'");
    assert(!await repo.permitsPdfQuestion(resource, q));
    db.exec("UPDATE material_pdf_pages SET status='needs_review',error='ocr_empty'");
    assert(!await repo.permitsPdfQuestion(resource, q));
    db.exec("UPDATE material_pdf_pages SET status='complete',error=''; UPDATE material_pdf_jobs SET generation='pdf-next'");
    assert(!await repo.permitsPdfQuestion(resource, q));
  } finally {
    db.exec("DELETE FROM material_pdf_pages WHERE generation='pdf-stage'; DELETE FROM material_pdf_jobs WHERE generation IN ('pdf-stage','pdf-next')");
  }
});
await check(
  "Published v2 through v11 generations remain readable, while interrupted older work restarts with the current engine",
  async () => {
    const legacy = {...resource,id:"resource_22345678-1234-1234-1234-123456789abc"};
    const id=legacy.id;
    for (const engine of ["layout-paragraph-question.v2", "layout-paragraph-question.v3", "layout-paragraph-question.v4", "layout-paragraph-question.v5", "layout-paragraph-question.v6",
      "layout-paragraph-question.v7", "layout-paragraph-question.v8", "layout-paragraph-question.v9", "layout-paragraph-question.v10", "layout-paragraph-question.v11"]) {
      const generation = "legacy-" + engine;
      db.prepare("INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,pages,processed,updated_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(id,version,engine,generation,"partial",2,2,new Date().toISOString());
      db.prepare("INSERT INTO material_structure_questions(generation,id,first_page,last_page,status,body_json,document_json,sha256) VALUES(?,?,?,?,?,?,?,?)")
        .run(generation,"legacy-candidate",1,1,"candidate",JSON.stringify({id:"legacy-candidate",status:"candidate"}),"{}","c".repeat(64));
      try {
        assert(await repo.published(legacy));
        assert.equal(await repo.begin(legacy,signal),false);
        assert.equal(db.prepare("SELECT generation FROM material_structure_jobs WHERE resource_id=?").get(id).generation,generation);
        assert.equal((await repo.candidates(id,version,0)).items.length,0);
        assert(!await repo.currentPublication(id,version,generation));
        db.prepare("UPDATE material_structure_jobs SET status='cancelled' WHERE resource_id=?").run(id);
        assert(await repo.begin(legacy,signal));
        const job=db.prepare("SELECT engine,generation,processed FROM material_structure_jobs WHERE resource_id=?").get(id);
        assert.equal(job.engine,DOCUMENT_STRUCTURE_ENGINE);
        assert.notEqual(job.generation,generation);
        assert.equal(job.processed,0);
      } finally {
        db.prepare("DELETE FROM material_structure_questions WHERE generation=?").run(generation);
        db.prepare("DELETE FROM material_structure_jobs WHERE resource_id=?").run(id);
      }
    }
  },
);
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
  "Low-confidence source remains searchable and marked pending while question-bank eligibility stays gated",
  async () => {
    const page = await repo.candidates(id, version, 0);
    assert.equal(page.items.length, 2);
    assert.equal(
      page.items.filter((x) => x.question.status === "candidate").length,
      1,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM material_structure_chunks").get().n,
      2,
    );
    const heldChunk = JSON.parse(
      db
        .prepare(
          "SELECT body_json FROM material_structure_chunks WHERE json_extract(body_json,'$.heading') LIKE '待核%' LIMIT 1",
        )
        .get().body_json,
    );
    assert(heldChunk.content.includes("求下一题"));
    assert(heldChunk.qualityScore <= 49);
    reference = page.items[0].reference;
    original = await repo.authenticate(reference, signal);
    assert(original.document);
    assert.equal((await repo.view(query)).page.lines[0].quad.length, 4);
  },
);
await check(
  "Teacher restoration of a source-equivalent answer keeps valid teacher attribution",
  async () => {
    const fields = {
      stem: original.question.stem,
      answer: "教师答案",
      analysis: "",
    };
    const edited = reviseStructureDocument(original.document, fields);
    const archive = {
      structure: reference,
      state: "teacher_edited",
      answerOrigin: "teacher",
      analysisOrigin: "missing",
    };
    await repo.validate({ ...fields, archive, document: edited });
    const restoredFields = { ...fields, answer: original.question.answer };
    const restored = reviseStructureDocument(edited, restoredFields);
    assert.equal(restored.answer.origin, "teacher");
    await repo.validate({ ...restoredFields, archive, document: restored });
    await assert.rejects(
      () =>
        repo.validate({
          ...restoredFields,
          archive: { ...archive, answerOrigin: "source" },
          document: restored,
        }),
      /source_changed/,
    );
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
await check(
  "Answer-book entries remain in the source index and cannot become question-bank candidates",
  async () => {
    resource = {
      ...resource,
      id: "resource_32345678-1234-1234-1234-123456789abc",
      chunkCount: 0,
      parseStatus: "pending",
    };
    const originalPage = host.page;
    host.page = async (r, page) => {
      const source = input(1);
      source.resourceId = r.id;
      source.totalPages = 1;
      source.lines[0].text = "参考答案";
      source.lines[1].text = "1. A";
      source.regions.push({
        id: "answer-title",
        kind: "doc_title",
        score: 0.99,
        box: [0.09, 0.09, 0.86, 0.13],
        needsReview: true,
      });
      return { input: source, image: { sha256: "b".repeat(64) } };
    };
    try {
      await repo.begin(resource, signal, currentLease);
      await repo.complete(resource, signal, currentLease);
      const candidates = await repo.candidates(resource.id, version, 0);
      assert.equal(candidates.items.length, 1);
      assert.equal(candidates.items[0].question.kind, "answer");
      const generation = (
        await repo.view({ ...query, resourceId: resource.id })
      ).summary.generation;
      const chunks = db
        .prepare(
          "SELECT body_json FROM material_structure_chunks WHERE generation=?",
        )
        .all(generation)
        .map((r) => JSON.parse(r.body_json));
      assert(chunks.some((c) => c.content.includes("A")));
    } finally {
      host.page = originalPage;
    }
  },
);
const { fixture: queueFixture, materialQueueBoundaries } = await import(
  "./material-queue-boundaries.mjs"
);
await check(
  "A completed all-held structure remains readable even if a source has zero indexable text",
  async () => {
    const f = queueFixture();
    try {
      const r = f.add();
      let published = false,
        calls = 0,
        status = "ready";
      const original = f.host.resource;
      f.host.resource = async (id) => ({
        ...(await original(id)),
        chunkCount: 0,
        parseStatus: status,
        parseEngine: "image-test.v1",
      });
      f.host.structureReady = async () => published;
      f.host.ingest = async (id) => {
        calls++;
        published = true;
        return f.host.resource(id);
      };
      await f.queue.enqueue(r.id, r.version);
      await f.queue.start();
      const until = async (predicate) => {
        for (let i = 0; i < 200; i++) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw Error("Queue did not settle");
      };
      await until(() => f.row(r.id).status === "succeeded");
      assert.equal(calls, 1);
      await f.queue.enqueue(r.id, r.version, 0, true);
      assert.equal(f.row(r.id).status, "succeeded");
      assert.equal(calls, 1);
      status = "failed";
      await f.queue.enqueue(r.id, r.version, 0, true);
      await until(() => f.row(r.id).status === "failed");
      assert.equal(calls, 2);
    } finally {
      await f.close();
    }
  },
);
await materialQueueBoundaries(check);
db.close();
console.log(JSON.stringify({ success: true, count: results.length, results }));
