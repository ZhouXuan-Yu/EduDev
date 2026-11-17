import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import {
  MaterialStructureRepository,
  reviseStructureDocument,
} from "../../src/main/assets/material-structure-repository.ts";
import { MaterialQuestionArchive } from "../../src/main/assets/material-question-archive.ts";
import {
  validQuestionArchive,
  readQuestionArchive,
  archiveEligible,
} from "../../src/shared/question-archive.ts";
import { validStructureReviewInput } from "../../src/shared/material-structure-review.ts";
import {
  STRUCTURE_REVIEW_SCHEMA,
  DOCUMENT_STRUCTURE_ENGINE,
} from "../../src/shared/material-document-structure.ts";
import { questionVersion } from "../../src/main/education/question-context-provider.ts";
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const checks = [];
async function check(name, action) {
  await action();
  checks.push(name);
  console.log("PASS " + name);
}
async function fixture(options = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ai_tasks(task_type TEXT,input_hash TEXT,status TEXT);
 CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,page_number INTEGER,content_md TEXT);
 CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,subject TEXT,grade TEXT,knowledge_point TEXT,question_type TEXT,difficulty TEXT,stem TEXT,answer TEXT,analysis TEXT,source_kind TEXT,source_title TEXT,archive_json TEXT DEFAULT '',document_json TEXT DEFAULT '',updated_at TEXT);
 CREATE TABLE material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT,question_id TEXT UNIQUE,needs_attention INTEGER);`);
  const resource = {
    id: "resource_" + randomUUID(),
    contentHash: "a".repeat(64),
    title: "结构核对试卷",
    originalFileName: "exam.pdf",
    parseStatus: "pending",
    chunkCount: 0,
  };
  let sourceChanged = false,
    failWrite = false,
    tail = Promise.resolve();
  const all = async (sql, args = []) => db.prepare(sql).all(...args);
  const run = async (sql, args = []) => {
    if (
      failWrite &&
      sql.startsWith("UPDATE question_bank_items SET archive_json")
    )
      throw Error("disk_full");
    db.prepare(sql).run(...args);
  };
  const write = (action) => {
    const pending = tail.then(async () => {
      db.exec("BEGIN");
      try {
        const result = await action();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    });
    tail = pending.catch(() => {});
    return pending;
  };
  const verify = async (id, version) => {
    if (sourceChanged || id !== resource.id || version !== resource.contentHash)
      throw Error("source_changed");
  };
  const sourceText = options.missingFigure
    ? "1. 如图所示，求电流。"
    : "1. 小车每秒前进两米，求五秒内的路程。 A. 两米 B. 四米 C. 六米 D. 十米";
  const materials = {
    resource: async () => resource,
    verify,
    readingWindow: async () => ({
      units: [
        {
          resourceId: resource.id,
          version: resource.contentHash,
          title: resource.title,
          offset: 0,
          chunk: {
            id: "chunk_00000000-0000-0000-0000-000000000001",
            chunkIndex: 0,
            contentMd: sourceText,
            containsPersonalData: false,
            pageNumber: 1,
          },
        },
      ],
    }),
  };
  const document = (r, q) => ({
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
  });
  let structures, archive;
  const structureHost = {
    all,
    run,
    resource: async () => resource,
    verify,
    lease: async () => true,
    page: async () => ({
      input: {
        resourceId: resource.id,
        version: resource.contentHash,
        page: 1,
        totalPages: 1,
        rasterSha256: "b".repeat(64),
        sourceEngine: "fixture",
        layoutEngine: "fixture",
        lines: [
          {
            id: "line-1",
            kind: "text",
            text: sourceText,
            score: 0.7,
            normalizedQuad: [
              [0.1, 0.1],
              [0.9, 0.1],
              [0.9, 0.14],
              [0.1, 0.14],
            ],
            quad: [
              [0.1, 0.1],
              [0.9, 0.1],
              [0.9, 0.14],
              [0.1, 0.14],
            ],
            needsReview: true,
          },
        ],
        regions: [],
      },
      image: {
        resourceId: resource.id,
        version: resource.contentHash,
        sha256: "b".repeat(64),
      },
    }),
    document: async (r, q) => document(r, q),
    enqueue: async () => {},
    publish: async () => {
      db.prepare("INSERT OR IGNORE INTO resource_chunks VALUES(?,?,?,?,?)").run(
        "chunk_00000000-0000-0000-0000-000000000001",
        resource.id,
        0,
        1,
        sourceText,
      );
      resource.chunkCount = 1;
      resource.parseStatus = "ready";
    },
    writer: (action) => write(() => action(structures)),
  };
  structures = new MaterialStructureRepository(structureHost);
  const read = async (id) => {
    const row = db
      .prepare("SELECT * FROM question_bank_items WHERE id=?")
      .get(id);
    if (!row) return;
    return {
      id: row.id,
      stem: row.stem,
      answer: row.answer,
      analysis: row.analysis,
      subject: row.subject,
      grade: row.grade,
      knowledgePoint: row.knowledge_point,
      questionType: row.question_type,
      difficulty: row.difficulty,
      sourceKind: row.source_kind,
      sourceTitle: row.source_title,
      tags: [],
      archive: readQuestionArchive(row.archive_json),
      document: row.document_json ? JSON.parse(row.document_json) : undefined,
      updatedAt: row.updated_at,
    };
  };
  const archiveHost = {
    all,
    run,
    materials: () => materials,
    create: async (fields) => {
      const id = "question_" + randomUUID();
      db.prepare(
        "INSERT INTO question_bank_items(id,subject,grade,knowledge_point,question_type,difficulty,stem,answer,analysis,source_kind,source_title,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        fields.subject,
        fields.grade,
        fields.knowledgePoint,
        fields.questionType,
        fields.difficulty,
        fields.stem,
        fields.answer,
        fields.analysis,
        fields.sourceKind,
        fields.sourceTitle,
        new Date().toISOString(),
      );
      return read(id);
    },
    read,
    revisePage: async (q, fields) =>
      reviseStructureDocument(q.document, fields),
    withWriter: (action) => write(() => action(archive)),
  };
  archive = new MaterialQuestionArchive(archiveHost);
  archive.configureStructures(() => structures);
  await structures.migrate();
  await structures.migrate();
  await structures.begin(resource, new AbortController().signal);
  await structures.complete(resource, new AbortController().signal);
  const page = await structures.view({
    resourceId: resource.id,
    version: resource.contentHash,
    page: 1,
  });
  assert.equal(page.questions.length, 1);
  assert.equal(page.questions[0].status, "needs_review");
  const input = {
    schemaVersion: STRUCTURE_REVIEW_SCHEMA,
    reference: page.references[page.questions[0].id],
    fields: {
      stem: page.questions[0].stem,
      answer: "D",
      analysis: "路程等于速度乘时间，为十米。",
      subject: "物理",
      grade: "初三",
      knowledgePoint: "匀速直线运动",
      questionType: "选择题",
      difficulty: "easy",
    },
    sourceChecked: true,
  };
  const originals = () =>
    db
      .prepare(
        "SELECT generation,id,body_json,document_json,sha256 FROM material_structure_questions ORDER BY rowid",
      )
      .all();
  return {
    db,
    archive,
    structures,
    input,
    resource,
    read,
    originals,
    setSourceChanged: (value) => (sourceChanged = value),
    setFailWrite: (value) => (failWrite = value),
    close: () => db.close(),
  };
}
await check(
  "Request validation requires explicit teacher source check and strict bounded fields",
  async () => {
    const f = await fixture();
    try {
      assert(validStructureReviewInput(f.input));
      for (const invalid of [
        { ...f.input, sourceChecked: false },
        { ...f.input, extra: true },
        { ...f.input, fields: { ...f.input.fields, stem: "" } },
        { ...f.input, fields: { ...f.input.fields, stem: "x".repeat(12001) } },
        { ...f.input, reference: { ...f.input.reference, sha256: "bad" } },
      ]) {
        assert(!validStructureReviewInput(invalid));
        await assert.rejects(
          () => f.archive.reviewStructure(invalid),
          /invalid_input/,
        );
      }
    } finally {
      f.close();
    }
  },
);
await check(
  "Held candidates stay blocked from automatic admission and preparing a teacher review writes no question",
  async () => {
    const f = await fixture();
    try {
      await assert.rejects(
        () =>
          f.structures.authenticate(
            f.input.reference,
            new AbortController().signal,
          ),
        /source_changed/,
      );
      await f.structures.prepareReview(
        f.input.reference,
        new AbortController().signal,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM question_bank_items").get().n,
        0,
      );
    } finally {
      f.close();
    }
  },
);
await check(
  "Teacher correction saves through the archive writer with immutable original structure and source evidence",
  async () => {
    const f = await fixture();
    try {
      const before = f.originals();
      const q = await f.archive.reviewStructure(f.input);
      assert(validQuestionArchive(q.archive));
      assert.equal(q.archive.state, "teacher_edited");
      assert.equal(q.archive.sourceChecked, true);
      assert.equal(q.archive.answerOrigin, "teacher");
      assert(archiveEligible(q));
      assert.deepEqual(f.originals(), before);
      await f.archive.validate(q);
      const view = await f.structures.view({
        resourceId: f.resource.id,
        version: f.resource.contentHash,
        page: 1,
      });
      assert.equal(view.reviewed[f.input.reference.candidateId], q.id);
      assert.equal(view.questions[0].status, "needs_review");
    } finally {
      f.close();
    }
  },
);
await check(
  "Concurrent and repeated identical submissions return one durable question and review receipt",
  async () => {
    const f = await fixture();
    try {
      const results = await Promise.all([
        f.archive.reviewStructure(f.input),
        f.archive.reviewStructure(structuredClone(f.input)),
        f.archive.reviewStructure(f.input),
      ]);
      assert.equal(new Set(results.map((q) => q.id)).size, 1);
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM material_structure_reviews").get()
          .n,
        1,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM question_bank_items").get().n,
        1,
      );
    } finally {
      f.close();
    }
  },
);
await check(
  "A different retry cannot overwrite an already saved teacher correction",
  async () => {
    const f = await fixture();
    try {
      const q = await f.archive.reviewStructure(f.input);
      await assert.rejects(
        () =>
          f.archive.reviewStructure({
            ...f.input,
            fields: { ...f.input.fields, answer: "A" },
          }),
        /structure_already_reviewed/,
      );
      assert.equal((await f.read(q.id)).answer, "D");
    } finally {
      f.close();
    }
  },
);
await check(
  "Source changes reject initial writes and idempotent retries",
  async () => {
    const f = await fixture();
    try {
      f.setSourceChanged(true);
      await assert.rejects(
        () => f.archive.reviewStructure(f.input),
        /source_changed/,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM question_bank_items").get().n,
        0,
      );
      f.setSourceChanged(false);
      await f.archive.reviewStructure(f.input);
      f.setSourceChanged(true);
      await assert.rejects(
        () => f.archive.reviewStructure(f.input),
        /source_changed/,
      );
    } finally {
      f.close();
    }
  },
);
await check(
  "A rebuild started before submission rejects the stale page without writing a question",
  async () => {
    const f = await fixture();
    try {
      f.db.prepare("UPDATE material_structure_jobs SET status='running'").run();
      await assert.rejects(
        () => f.archive.reviewStructure(f.input),
        /source_changed/,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM material_structure_reviews").get()
          .n,
        0,
      );
    } finally {
      f.close();
    }
  },
);
await check(
  "Publication failure rolls back the question, review receipt and membership together",
  async () => {
    const f = await fixture();
    try {
      f.setFailWrite(true);
      await assert.rejects(
        () => f.archive.reviewStructure(f.input),
        /disk_full/,
      );
      for (const table of [
        "question_bank_items",
        "material_structure_reviews",
        "material_question_members",
      ])
        assert.equal(
          f.db.prepare("SELECT COUNT(*) n FROM " + table).get().n,
          0,
        );
      f.setFailWrite(false);
      await f.archive.reviewStructure(f.input);
    } finally {
      f.close();
    }
  },
);
await check(
  "A missing source diagram remains held and cannot be cleared by the review checkbox",
  async () => {
    const f = await fixture({ missingFigure: true });
    try {
      await assert.rejects(
        () => f.archive.reviewStructure(f.input),
        /structure_source_incomplete/,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM question_bank_items").get().n,
        0,
      );
    } finally {
      f.close();
    }
  },
);
await check(
  "Missing metadata and answers stay visibly incomplete after a teacher source check",
  async () => {
    const f = await fixture();
    try {
      const q = await f.archive.reviewStructure({
        ...f.input,
        fields: {
          ...f.input.fields,
          answer: "",
          analysis: "",
          knowledgePoint: "",
        },
      });
      assert(!archiveEligible(q));
      assert(q.archive.issues.includes("missing_answer"));
      assert(q.archive.issues.includes("missing_knowledge"));
    } finally {
      f.close();
    }
  },
);
await check(
  "Existing teacher editor revises a reviewed question using the original version check",
  async () => {
    const f = await fixture();
    try {
      const q = await f.archive.reviewStructure(f.input);
      const fields = { ...f.input.fields, stem: q.stem + " 请写出计算步骤。" };
      const edited = await f.archive.edit({
        questionId: q.id,
        version: questionVersion(q),
        fields,
        sourceChecked: true,
      });
      assert.equal(
        edited.document.blocks.find((b) => b.id === "transcription").text,
        fields.stem,
      );
      await f.archive.validate(edited);
      await assert.rejects(
        () =>
          f.archive.edit({
            questionId: q.id,
            version: questionVersion(q),
            fields,
            sourceChecked: true,
          }),
        /source_changed/,
      );
      const unchecked = await f.archive.edit({
        questionId: q.id,
        version: questionVersion(edited),
        fields,
        sourceChecked: false,
      });
      assert(!archiveEligible(unchecked));
      await f.archive.validate(unchecked);
    } finally {
      f.close();
    }
  },
);
await check(
  "Rebuilding derivatives preserves authentication of historical teacher review sources",
  async () => {
    const f = await fixture();
    try {
      const q = await f.archive.reviewStructure(f.input);
      f.db
        .prepare("UPDATE material_structure_jobs SET generation=?")
        .run(randomUUID());
      await f.archive.validate(q);
    } finally {
      f.close();
    }
  },
);
await check(
  "Review receipt, canonical document and original snapshot tampering are rejected",
  async () => {
    const f = await fixture();
    try {
      const q = await f.archive.reviewStructure(f.input);
      await assert.rejects(
        () =>
          f.archive.validate({
            ...q,
            archive: {
              ...q.archive,
              structureReview: {
                ...q.archive.structureReview,
                sha256: "c".repeat(64),
              },
            },
          }),
        /source_changed/,
      );
      const changed = structuredClone(q);
      changed.document.blocks[0].text = "篡改内容";
      await assert.rejects(() => f.archive.validate(changed), /source_changed/);
      f.db
        .prepare("UPDATE material_structure_reviews SET body_json='{}'")
        .run();
      await assert.rejects(() => f.archive.validate(q), /source_changed/);
    } finally {
      f.close();
    }
  },
);
await check('A resource assigned as an answer book cannot be admitted as a question by the review action',async()=>{
 const f=await fixture();try{
  f.archive.configureBooks(async()=>({kind:'answers'}));
  await assert.rejects(()=>f.archive.reviewStructure(f.input),/structure_source_incomplete/);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n,0);
 }finally{f.close();}
});
console.log(JSON.stringify({ success: true, count: checks.length, checks }));
