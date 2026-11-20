import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import {
  MaterialStructureRepository,
  reviseStructureDocument,
} from "../../src/main/assets/material-structure-repository.ts";
import { MaterialQuestionArchive } from "../../src/main/assets/material-question-archive.ts";
import { migrateStructureBank, publishStructureDrafts, structureDraftHidden, structureDraftStaged } from "../../src/main/assets/material-structure-bank.ts";
import { migrateWordPageSources } from "../../src/main/assets/material-word-page-source.ts";
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
 CREATE TABLE material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT,question_id TEXT UNIQUE,needs_attention INTEGER);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,parse_status TEXT);`);
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
    originalStamp: async () => "controlled original",
    verify,
    publishedPageSources: async () => (await materials.readingWindow()).units,
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
        ...(options.nativeUnconfirmed
          ? {
              nativeRecovery: {
                policy: 'pdf-native-crop-concordance.v1',
                rasterSha256: 'b'.repeat(64),
                native: {schemaVersion: 'xiaozhi.pdf-native-text.v1', ok: false, error: 'unavailable'},
                attempts: [],
                accepted: [],
                unresolved: ['native-line-1'],
              },
            }
          : {}),
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
  await migrateStructureBank(archiveHost);
  await archive.migrate();
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
    archiveHost,
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
  "Unconfirmed native gaps stay held for automatic admission while an explicit teacher source review remains usable",
  async () => {
    const f = await fixture({nativeUnconfirmed: true});
    try {
      const reference = {resourceId: f.resource.id, version: f.resource.contentHash, page: 1};
      const view = await f.structures.view(reference);
      assert(view.questions[0].issues.includes('native_unconfirmed'));
      assert.equal(view.questions[0].status, 'needs_review');
      await assert.rejects(
        () => f.structures.authenticate(f.input.reference, new AbortController().signal),
        /source_changed/,
      );
      const before = f.originals();
      const q = await f.archive.reviewStructure(f.input);
      assert.equal(q.archive.state, 'teacher_edited');
      assert.equal(q.archive.sourceChecked, true);
      await f.archive.validate(q);
      assert.deepEqual(f.originals(), before);
      const after = await f.structures.view(reference);
      assert(after.questions[0].issues.includes('native_unconfirmed'));
      assert.equal(after.questions[0].status, 'needs_review');
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
await check("Publishing the last structure batch atomically changes visibility and protects historical facts", async () => {
  const f = await fixture();
  try {
    const { db, archive, archiveHost } = f;
    await migrateWordPageSources(archiveHost);
    const id = f.resource.id, version = f.resource.contentHash, generation = f.input.reference.generation;
    const oldGeneration = randomUUID();
    const oldFields = {...f.input.fields,sourceKind:"teacher_resource",sourceTitle:f.resource.title};
    const oldDraft = await archiveHost.create(oldFields);
    const confirmed = await archiveHost.create(oldFields);
    const oldStructure = { ...f.input.reference, generation: oldGeneration };
    for (const [item, state, sourceChecked] of [[oldDraft,"rule_extracted",false],[confirmed,"book_enriched",true]]) {
      db.prepare("UPDATE question_bank_items SET archive_json=? WHERE id=?").run(
        JSON.stringify({ structure:oldStructure, state, sourceChecked }), item.id);
      db.prepare("INSERT INTO material_question_members VALUES(?,?,?,1)").run("legacy:"+item.id,id,item.id);
    }
    const facts = id => db.prepare("SELECT * FROM question_bank_items WHERE id=?").get(id);
    const oldFacts = facts(oldDraft.id), confirmedFacts = facts(confirmed.id);
    const visible = (predicate = structureDraftHidden) =>
      new Set(db.prepare(`SELECT q.id FROM question_bank_items q WHERE NOT ${predicate}`).all().map(row=>row.id));
    const [question] = (await f.structures.view({resourceId:id,version,page:1})).questions;
    let current = true, failPublication = false, missingSource = false;
    const materials = archiveHost.materials();
    const originalWindow = materials.readingWindow;
    materials.readingWindow = async () => missingSource ? {units:[]} : originalWindow();
    const writerRun = archiveHost.run;
    archiveHost.run = async (sql, params) => {
      if (failPublication && sql.startsWith("DELETE FROM material_structure_hidden_questions")) throw Error("disk_full");
      await writerRun(sql,params);
    };
    archive.configureStructures(() => ({
      candidates: async (_id,_version,offset) => ({
        generation,archiveable:true,hasMore:offset===0,
        items:offset===0?[{
          question:{...question,status:"candidate",stem:"新版题面 ____"},
          reference:f.input.reference,
          document:{schemaVersion:"controlled"},
        }]:missingSource?[{
          question:{...question,id:"extra-question",status:"candidate",stem:"缺少来源"},
          reference:f.input.reference,
          document:{schemaVersion:"controlled"},
        }]:[],
      }),
      currentPublication:async()=>current,
      authenticate:async()=>{},
      archivedOwner:async()=>undefined,
      permitsPdfQuestion:async()=>true,
    }));
    await archive.enqueue(id,version,DOCUMENT_STRUCTURE_ENGINE+":"+generation);
    const job = () => db.prepare("SELECT * FROM material_question_jobs WHERE resource_id=?").get(id);
    await archive.requeueLegacyStructureArchives();
    assert.match(job().parse_token, /:archive\.v2$/);
    await archive.drain();
    const newId = db.prepare("SELECT id FROM question_bank_items WHERE stem='新版题面 ____'").get().id;
    assert.deepEqual(visible(),new Set([oldDraft.id,confirmed.id]));
    assert(!visible(structureDraftStaged).has(newId));
    await archive.requeueLegacyStructureArchives();
    assert.equal(job().cursor,1,"a restart resumes the migration cursor");
    current = false;
    await archive.drain();
    assert.deepEqual(visible(),new Set([oldDraft.id,confirmed.id]));
    assert.equal(job().status,"pending","a stale writer cannot publish even an empty final batch");
    current = true;
    failPublication = true;
    await archive.drain();
    assert.equal(job().status,"failed");
    assert.deepEqual(visible(),new Set([oldDraft.id,confirmed.id]));
    failPublication = false;
    missingSource = true;
    await archive.retry();
    await archive.drain();
    assert.equal(job().status,"failed");
    assert.equal(job().error,"source_changed");
    assert.deepEqual(visible(),new Set([oldDraft.id,confirmed.id]));
    missingSource = false;
    await archive.retry();
    await archive.drain();
    assert.equal(job().status,"complete");
    assert.equal(job().question_count,2);
    assert.deepEqual(visible(),new Set([confirmed.id,newId]));
    assert(visible(structureDraftStaged).has(oldDraft.id));
    assert.deepEqual(facts(oldDraft.id),oldFacts);
    assert.deepEqual(facts(confirmed.id),confirmedFacts);
  } finally {
    f.close();
  }
});
await check("Identical drafts retain one stable owner and never publish staged answer-book drafts", async () => {
  const f = await fixture();
  try {
    const { db, archiveHost, input } = f;
    const reference = input.reference;
    db.prepare("UPDATE material_structure_questions SET status='candidate',document_json='{}' WHERE generation=?").run(reference.generation);
    const old = await archiveHost.create({...input.fields,sourceKind:"teacher_resource",sourceTitle:"exam.pdf"});
    const duplicate = await archiveHost.create({...input.fields,sourceKind:"teacher_resource",sourceTitle:"exam.pdf"});
    for (const item of [old,duplicate]) {
      db.prepare("UPDATE question_bank_items SET archive_json=? WHERE id=?").run(
        JSON.stringify({structure:{...reference,generation:randomUUID()},state:"rule_extracted",sourceChecked:false}),item.id);
      db.prepare("INSERT INTO material_question_members VALUES(?,?,?,1)").run(item.id,reference.resourceId,item.id);
    }
    await publishStructureDrafts(archiveHost,reference.resourceId,reference.generation,true);
    const visible = db.prepare(`SELECT q.id FROM question_bank_items q WHERE NOT ${structureDraftHidden}`).all().map(row=>row.id);
    assert.deepEqual(visible,[old.id]);
    db.prepare("INSERT INTO material_structure_hidden_questions VALUES(?,?,?,'staged')").run(old.id,reference.resourceId,reference.generation);
    await publishStructureDrafts(archiveHost,reference.resourceId,reference.generation,false);
    assert.equal(db.prepare("SELECT state FROM material_structure_hidden_questions WHERE question_id=?").get(old.id).state,"staged");
  } finally {
    f.close();
  }
});
await check("Withdrawing confirmation on an older owner requeues the current generation for replacement", async () => {
  const f = await fixture();
  try {
    const checked = await f.archive.reviewStructure(f.input);
    const resource = f.resource;
    const token = DOCUMENT_STRUCTURE_ENGINE+":"+randomUUID()+":archive.v2";
    await f.archive.enqueue(resource.id,resource.contentHash,token);
    f.db.exec("UPDATE material_question_jobs SET status='complete',cursor=20");
    const saved = await f.archive.edit({questionId:checked.id,version:questionVersion(checked),fields:f.input.fields,sourceChecked:false});
    assert.equal(saved.archive.sourceChecked,false);
    const job = f.db.prepare("SELECT status,cursor,parse_token FROM material_question_jobs").get();
    assert.deepEqual({...job},{status:"pending",cursor:0,parse_token:token});
  } finally {
    f.close();
  }
});
console.log(JSON.stringify({ success: true, count: checks.length, checks }));
