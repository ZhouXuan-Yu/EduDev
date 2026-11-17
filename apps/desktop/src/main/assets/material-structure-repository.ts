import { createHash, randomUUID } from "node:crypto";
import type { TeacherResource, QuestionBankItem } from "../../shared/contracts";
import {
  DOCUMENT_STRUCTURE_ENGINE,
  DOCUMENT_STRUCTURE_SCHEMA,
  validStructureQuery,
  type DocumentStructureQuery,
  type DocumentStructureSummary,
  type DocumentStructureView,
  type DocumentStructureReference,
  type StructurePage,
  type StructurePageInput,
  type StructureQuestion,
} from "../../shared/material-document-structure";
import {
  recoverStructurePage,
  StructureQuestionAssembler,
} from "./material-document-structure";
import type { MaterialParseLease } from "./material-parse-queue";
import type { OriginalImage } from "./question-assets";
import type { QuestionDocument } from "../../shared/question-document";
import { validQuestionDocument } from "../../shared/question-document";
import type { ArchiveFields } from "../../shared/question-archive";

type Value = string | number | null;
type Row = Record<string, unknown>;
export type StructurePageReceipt = {
  input: StructurePageInput;
  image: OriginalImage;
};
export type StructureCandidate = {
  question: StructureQuestion;
  document?: QuestionDocument;
};
type Host = {
  all: (sql: string, values?: Value[]) => Promise<Row[]>;
  run: (sql: string, values?: Value[]) => Promise<void>;
  resource: (id: string) => Promise<TeacherResource>;
  verify: (id: string, version: string, signal: AbortSignal) => Promise<void>;
  lease: (lease: MaterialParseLease) => Promise<boolean>;
  page: (
    resource: TeacherResource,
    page: number,
    signal: AbortSignal,
  ) => Promise<StructurePageReceipt>;
  document: (
    resource: TeacherResource,
    question: StructureQuestion,
    pages: { page: StructurePage; image: OriginalImage }[],
    signal: AbortSignal,
  ) => Promise<QuestionDocument>;
  enqueue: (id: string, version: string, token: string) => Promise<void>;
  publish: (resource: TeacherResource, generation: string) => Promise<void>;
  writer: <T>(
    action: (target: MaterialStructureRepository) => Promise<T>,
  ) => Promise<T>;
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = () => new Date().toISOString();
const supported = (r: TeacherResource) =>
  /\.(pdf|docx|png|jpe?g|webp)$/i.test(r.originalFileName);

/** Versioned source derivatives. A parse lease owns writes, published generations remain immutable. */
export class MaterialStructureRepository {
  private host: Host;
  constructor(host: Host) {
    this.host = host;
  }

  async migrate() {
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS material_structure_jobs(resource_id TEXT PRIMARY KEY,version TEXT NOT NULL,engine TEXT NOT NULL,generation TEXT NOT NULL,status TEXT NOT NULL,pages INTEGER NOT NULL DEFAULT 0,processed INTEGER NOT NULL DEFAULT 0,paragraphs INTEGER NOT NULL DEFAULT 0,questions INTEGER NOT NULL DEFAULT 0,held INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',lease TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS material_structure_pages(generation TEXT NOT NULL,page INTEGER NOT NULL,body_json TEXT NOT NULL,image_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(generation,page))`,
      `CREATE TABLE IF NOT EXISTS material_structure_questions(generation TEXT NOT NULL,id TEXT NOT NULL,first_page INTEGER NOT NULL,last_page INTEGER NOT NULL,status TEXT NOT NULL,body_json TEXT NOT NULL,document_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(generation,id))`,
      `CREATE INDEX IF NOT EXISTS material_structure_question_pages ON material_structure_questions(generation,first_page,last_page)`,
      `CREATE TABLE IF NOT EXISTS material_structure_chunks(generation TEXT NOT NULL,id TEXT NOT NULL,page INTEGER NOT NULL,body_json TEXT NOT NULL,PRIMARY KEY(generation,id))`,
    ])
      await this.host.run(sql);
  }

  private async job(id: string) {
    return (
      await this.host.all(
        "SELECT * FROM material_structure_jobs WHERE resource_id=?",
        [id],
      )
    )[0];
  }

  async required(id: string) {
    const row = await this.job(id);
    return !!row && !["complete", "partial"].includes(String(row.status));
  }
  async published(resource: TeacherResource) {
    const row = await this.job(resource.id);
    return (
      !!row &&
      row.version === resource.contentHash &&
      row.engine === DOCUMENT_STRUCTURE_ENGINE &&
      ["complete", "partial"].includes(String(row.status))
    );
  }

  /** Legacy data is preserved until an explicit rebuild. New imports always enter the structure gate. */
  async begin(
    resource: TeacherResource,
    signal: AbortSignal,
    lease?: MaterialParseLease,
  ) {
    if (!supported(resource)) return false;
    signal.throwIfAborted();
    return this.host.writer(async (target) => {
      const old = await target.job(resource.id);
      if (!old && resource.chunkCount > 0) return false;
      if (
        old?.version === resource.contentHash &&
        old.engine === DOCUMENT_STRUCTURE_ENGINE &&
        ["complete", "partial"].includes(String(old.status))
      )
        return false;
      const same =
        old?.version === resource.contentHash &&
        old.engine === DOCUMENT_STRUCTURE_ENGINE;
      if (lease && !(await target.host.lease(lease))) throw Error("cancelled");
      await target.host.run(
        `INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,lease,updated_at) VALUES(?,?,?,?,'running',?,?) ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,engine=excluded.engine,generation=excluded.generation,status='running',error='',lease=excluded.lease,updated_at=excluded.updated_at`,
        [
          resource.id,
          resource.contentHash,
          DOCUMENT_STRUCTURE_ENGINE,
          same ? String(old.generation) : randomUUID(),
          JSON.stringify(lease ?? null),
          now(),
        ],
      );
      return true;
    });
  }

  async request(input: DocumentStructureQuery) {
    if (!validStructureQuery(input)) throw Error("invalid_input");
    const resource = await this.host.resource(input.resourceId);
    if (resource.contentHash !== input.version) throw Error("source_changed");
    if (!supported(resource)) throw Error("unsupported");
    await this.host.writer(async (target) => {
      const running = await target.host.all(
        `SELECT 1 FROM ai_tasks WHERE task_type='resource_parse' AND input_hash=? AND status='running'`,
        [createHash("sha256").update(resource.id).digest("hex")],
      );
      if (running.length) throw Error("busy");
      await target.host.run(
        `INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,updated_at) VALUES(?,?,?,?,'pending',?) ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,engine=excluded.engine,generation=excluded.generation,status='pending',pages=0,processed=0,paragraphs=0,questions=0,held=0,error='',lease='',updated_at=excluded.updated_at`,
        [
          resource.id,
          input.version,
          DOCUMENT_STRUCTURE_ENGINE,
          randomUUID(),
          now(),
        ],
      );
    });
  }

  private async guard(
    resource: TeacherResource,
    generation: string,
    signal: AbortSignal,
    lease?: MaterialParseLease,
  ) {
    signal.throwIfAborted();
    const current = await this.host.resource(resource.id),
      job = await this.job(resource.id);
    if (
      current.contentHash !== resource.contentHash ||
      !job ||
      job.generation !== generation ||
      job.version !== resource.contentHash
    )
      throw Error("source_changed");
    if (
      lease &&
      (job.lease !== JSON.stringify(lease) || !(await this.host.lease(lease)))
    )
      throw Error("cancelled");
  }

  async fail(id: string, error: unknown, lease?: MaterialParseLease) {
    const job = await this.job(id);
    if (!job || (lease && job.lease !== JSON.stringify(lease))) return;
    const code = error instanceof Error ? error.message : "parse_failed";
    await this.host.run(
      `UPDATE material_structure_jobs SET status=?,error=?,updated_at=? WHERE resource_id=? AND generation=? AND lease=?`,
      [
        code === "cancelled" ? "cancelled" : "failed",
        code.slice(0, 100),
        now(),
        id,
        String(job.generation),
        String(job.lease),
      ],
    );
  }

  async cancel(id: string, version: string) {
    await this.host.run(
      "UPDATE material_structure_jobs SET status='cancelled',error='cancelled',updated_at=? WHERE resource_id=? AND version=? AND status IN ('pending','running')",
      [now(), id, version],
    );
  }

  async complete(
    resource: TeacherResource,
    signal: AbortSignal,
    lease?: MaterialParseLease,
  ) {
    const job = await this.job(resource.id);
    if (!job || ["complete", "partial"].includes(String(job.status))) return;
    const generation = String(job.generation),
      assembler = new StructureQuestionAssembler();
    let total = Number(job.pages) || 1,
      paragraphs = 0,
      count = 0,
      held = 0;
    const save = async (question: StructureQuestion) => {
      signal.throwIfAborted();
      const rows = await this.host.all(
        "SELECT body_json,image_json FROM material_structure_pages WHERE generation=? AND page BETWEEN ? AND ? ORDER BY page",
        [generation, question.pageRange[0], question.pageRange[1]],
      );
      const pages = rows.map((row) => ({
        page: JSON.parse(String(row.body_json)) as StructurePage,
        image: JSON.parse(String(row.image_json)) as OriginalImage,
      }));
      // Bounded source documents are quarantined instead of truncating their source or silently admitting them.
      let document: QuestionDocument | undefined;
      if (question.status === "candidate" && question.kind === "question") {
        try {
          document = await this.host.document(
            resource,
            question,
            pages,
            signal,
          );
        } catch (error) {
          signal.throwIfAborted();
          if (
            !(error instanceof Error) ||
            !["question_too_large", "structure_document_invalid"].includes(
              error.message,
            )
          )
            throw error;
          question.status = "needs_review";
          question.issues.push("oversized_question");
        }
      }
      if (question.status === "needs_review") held++;
      count++;
      const body = { question, ...(document ? { document } : {}) };
      await this.host.writer(async (target) => {
        await target.guard(resource, generation, signal, lease);
        await target.host.run(
          `INSERT INTO material_structure_questions(generation,id,first_page,last_page,status,body_json,document_json,sha256) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(generation,id) DO NOTHING`,
          [
            generation,
            question.id,
            question.pageRange[0],
            question.pageRange[1],
            question.status,
            JSON.stringify(question),
            document ? JSON.stringify(document) : "",
            hash(body),
          ],
        );
      });
    };
    await this.host.verify(resource.id, resource.contentHash, signal);
    for (let page = 1; page <= total; page++) {
      await this.guard(resource, generation, signal, lease);
      const cached = (
        await this.host.all(
          "SELECT * FROM material_structure_pages WHERE generation=? AND page=?",
          [generation, page],
        )
      )[0];
      let structure: StructurePage;
      if (cached) {
        structure = JSON.parse(String(cached.body_json));
        if (
          hash(structure) !== cached.sha256 ||
          structure.engine !== DOCUMENT_STRUCTURE_ENGINE ||
          structure.resourceId !== resource.id ||
          structure.version !== resource.contentHash
        )
          throw Error("source_changed");
      } else {
        const receipt = await this.host.page(resource, page, signal);
        structure = recoverStructurePage(receipt.input);
        await this.host.writer(async (target) => {
          await target.guard(resource, generation, signal, lease);
          await target.host.run(
            "INSERT INTO material_structure_pages(generation,page,body_json,image_json,sha256) VALUES(?,?,?,?,?)",
            [
              generation,
              page,
              JSON.stringify(structure),
              JSON.stringify(receipt.image),
              hash(structure),
            ],
          );
        });
      }
      total = structure.totalPages;
      paragraphs += structure.paragraphs.length;
      for (const question of assembler.push(structure)) await save(question);
      await this.host.run(
        `UPDATE material_structure_jobs SET pages=?,processed=?,paragraphs=?,questions=?,held=?,updated_at=? WHERE resource_id=? AND generation=? AND lease=?`,
        [
          total,
          page,
          paragraphs,
          count,
          held,
          now(),
          resource.id,
          generation,
          JSON.stringify(lease ?? null),
        ],
      );
    }
    for (const question of assembler.end()) await save(question);
    await this.host.verify(resource.id, resource.contentHash, signal);
    await this.host.writer(async (target) => {
      await target.guard(resource, generation, signal, lease);
      await target.host.run(
        "DELETE FROM material_structure_chunks WHERE generation=?",
        [generation],
      );
      await target.host.run(
        `INSERT INTO material_structure_chunks(generation,id,page,body_json)
        SELECT generation,id,first_page,json_object('heading',CASE WHEN status='needs_review' THEN '待核原始资料 · ' ELSE '' END||CASE WHEN json_extract(body_json,'$.kind')='answer' THEN '答案 ' ELSE '题 ' END||json_extract(body_json,'$.number'),'qualityScore',CASE WHEN status='needs_review' THEN min(49,CAST(json_extract(body_json,'$.confidence')*100 AS INTEGER)) ELSE CAST(json_extract(body_json,'$.confidence')*100 AS INTEGER) END,'content',json_extract(body_json,'$.stem')||CASE WHEN json_extract(body_json,'$.answer')<>'' THEN char(10)||'【答案】'||json_extract(body_json,'$.answer') ELSE '' END||CASE WHEN json_extract(body_json,'$.analysis')<>'' THEN char(10)||'【解析】'||json_extract(body_json,'$.analysis') ELSE '' END,'pageNumber',first_page,'box',json(json_extract(body_json,'$.anchors[0].box')))
        FROM material_structure_questions WHERE generation=?`,
        [generation],
      );
      // Document retrieval retains recovered source text. Question-bank admission is gated separately.
      await target.host.run(
        `INSERT INTO material_structure_chunks(generation,id,page,body_json)
        SELECT p.generation,json_extract(a.value,'$.id'),p.page,json_object('heading',CASE WHEN json_array_length(a.value,'$.issues')>0 THEN '待核原始资料' ELSE '' END,'qualityScore',CASE WHEN json_array_length(a.value,'$.issues')>0 THEN min(49,CAST(json_extract(a.value,'$.confidence')*100 AS INTEGER)) ELSE CAST(json_extract(a.value,'$.confidence')*100 AS INTEGER) END,'content',json_extract(a.value,'$.text'),'pageNumber',p.page,'box',json(json_extract(a.value,'$.anchor.box')))
        FROM material_structure_pages p,json_each(p.body_json,'$.paragraphs') a WHERE p.generation=?
        AND json_extract(a.value,'$.role') NOT IN ('header','footer') AND length(trim(json_extract(a.value,'$.text')))>0
        AND NOT EXISTS (SELECT 1 FROM material_structure_questions q,json_each(q.body_json,'$.paragraphIds') b WHERE q.generation=p.generation AND b.value=json_extract(a.value,'$.id'))
        AND NOT EXISTS (SELECT 1 FROM material_structure_questions q,json_each(q.body_json,'$.sharedMaterialIds') b WHERE q.generation=p.generation AND b.value=json_extract(a.value,'$.id'))`,
        [generation],
      );
      await target.host.publish(resource, generation);
      await target.host.run(
        `UPDATE material_structure_jobs SET status=?,questions=?,held=?,error='',updated_at=? WHERE resource_id=? AND generation=?`,
        [
          held ? "partial" : "complete",
          count,
          held,
          now(),
          resource.id,
          generation,
        ],
      );
      await target.host.enqueue(
        resource.id,
        resource.contentHash,
        DOCUMENT_STRUCTURE_ENGINE + ":" + generation,
      );
      signal.throwIfAborted();
    });
  }

  async view(input: DocumentStructureQuery): Promise<DocumentStructureView> {
    if (!validStructureQuery(input)) throw Error("invalid_input");
    const resource = await this.host.resource(input.resourceId);
    if (resource.contentHash !== input.version) throw Error("source_changed");
    const job = await this.job(resource.id);
    if (!job) return { questions: [] };
    const summary: DocumentStructureSummary = {
      resourceId: resource.id,
      version: String(job.version),
      engine: String(job.engine),
      generation: String(job.generation),
      status: job.status as DocumentStructureSummary["status"],
      pages: Number(job.pages),
      processed: Number(job.processed),
      paragraphs: Number(job.paragraphs),
      questions: Number(job.questions),
      held: Number(job.held),
      error: String(job.error),
    };
    const page = (
      await this.host.all(
        "SELECT body_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?",
        [summary.generation, input.page],
      )
    )[0];
    if (page && hash(JSON.parse(String(page.body_json))) !== page.sha256)
      throw Error("source_changed");
    const questions = await this.host.all(
      "SELECT body_json FROM material_structure_questions WHERE generation=? AND first_page<=? AND last_page>=? ORDER BY rowid LIMIT 100",
      [summary.generation, input.page, input.page],
    );
    return {
      summary,
      ...(page ? { page: JSON.parse(String(page.body_json)) } : {}),
      questions: questions.map((row) => JSON.parse(String(row.body_json))),
    };
  }

  async image(input: DocumentStructureQuery): Promise<OriginalImage> {
    const view = await this.view(input);
    if (!view.page || !view.summary) throw Error("source_incomplete");
    const row = (
      await this.host.all(
        "SELECT image_json FROM material_structure_pages WHERE generation=? AND page=?",
        [view.summary.generation, input.page],
      )
    )[0];
    const image = JSON.parse(String(row.image_json)) as OriginalImage;
    if (
      image.resourceId !== input.resourceId ||
      image.version !== input.version ||
      image.sha256 !== view.page.rasterSha256
    )
      throw Error("source_changed");
    return image;
  }

  /** Undefined means legacy extraction. Managed incomplete generations never fall back to numbered text. */
  async candidates(id: string, version: string, offset: number) {
    const job = await this.job(id);
    if (!job) return;
    if (job.version !== version) throw Error("source_changed");
    if (!["complete", "partial"].includes(String(job.status)))
      throw Error("source_incomplete");
    const rows = await this.host.all(
      "SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid LIMIT 17 OFFSET ?",
      [String(job.generation), offset],
    );
    return {
      generation: String(job.generation),
      hasMore: rows.length > 16,
      items: rows.slice(0, 16).map((row) => ({
        question: JSON.parse(String(row.body_json)) as StructureQuestion,
        document: row.document_json
          ? (JSON.parse(String(row.document_json)) as QuestionDocument)
          : undefined,
        reference: {
          schemaVersion: DOCUMENT_STRUCTURE_SCHEMA,
          resourceId: id,
          version,
          generation: String(job.generation),
          candidateId: String(row.id),
          sha256: String(row.sha256),
        } as DocumentStructureReference,
      })),
    };
  }

  async authenticate(
    reference: DocumentStructureReference,
    signal: AbortSignal,
  ): Promise<StructureCandidate> {
    const row = (
      await this.host.all(
        "SELECT * FROM material_structure_questions WHERE generation=? AND id=?",
        [reference.generation, reference.candidateId],
      )
    )[0];
    if (!row || row.sha256 !== reference.sha256) throw Error("source_changed");
    const question = JSON.parse(String(row.body_json)) as StructureQuestion;
    const document = row.document_json
      ? (JSON.parse(String(row.document_json)) as QuestionDocument)
      : undefined;
    if (
      hash({ question, ...(document ? { document } : {}) }) !==
        reference.sha256 ||
      document?.source.resourceId !== reference.resourceId ||
      document.source.resourceVersion !== reference.version ||
      question.status !== "candidate"
    )
      throw Error("source_changed");
    await this.host.verify(reference.resourceId, reference.version, signal);
    return { question, document };
  }

  async validate(q: QuestionBankItem, signal = new AbortController().signal) {
    if (!q.archive?.structure) throw Error("source_changed");
    const candidate = await this.authenticate(q.archive.structure, signal);
    if (!q.document || !candidate.document) throw Error("source_changed");
    const expected =
      q.archive.state === "teacher_edited"
        ? reviseStructureDocument(candidate.document, q)
        : candidate.document;
    if (q.archive.state === "teacher_edited") {
      for (const role of ["answer", "analysis"] as const)
        if (q.archive[`${role}Origin`] === "teacher")
          expected[role] = { origin: "teacher", text: q[role], anchors: [] };
    }
    if (
      JSON.stringify(q.document) !== JSON.stringify(expected) ||
      q.document.blocks.find(
        (b) =>
          b.id === "transcription" && b.kind === "text" && b.text === q.stem,
      ) === undefined ||
      q.document.answer.text !== q.answer ||
      q.document.analysis.text !== q.analysis ||
      expected.answer.origin !== q.archive.answerOrigin ||
      expected.analysis.origin !== q.archive.analysisOrigin
    )
      throw Error("source_changed");
    return candidate;
  }
}

export function reviseStructureDocument(
  document: QuestionDocument,
  fields: ArchiveFields,
): QuestionDocument {
  const next = structuredClone(document);
  next.blocks = next.blocks.map((block) =>
    block.id === "transcription" && block.kind === "text"
      ? { ...block, text: fields.stem }
      : block,
  );
  for (const role of ["answer", "analysis"] as const)
    if (next[role].text !== fields[role])
      next[role] = {
        origin: fields[role] ? "teacher" : "missing",
        text: fields[role],
        anchors: [],
      };
  if (!validQuestionDocument(next)) throw Error("invalid_input");
  return next;
}
