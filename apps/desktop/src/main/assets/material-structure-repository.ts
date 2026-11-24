import { TABLE_VISION_SCHEMA, type TableVisionCandidate, type TableVisionCell } from "../../shared/material-table-vision";
import { parseSavedTableVision, visionHash } from "./material-table-vision-provider";
import { structureOcrSourceKey } from "./material-structure-identity";
import { readStructureReviewOverview } from "./material-structure-review-overview";
import { planChoiceRecheck, type ChoiceRecheckPlan } from "./material-structure-choice-recheck";
import { createHash, randomUUID } from "node:crypto";
import type { TeacherResource, QuestionBankItem } from "../../shared/contracts";
import {
  STRUCTURE_REVIEW_SCHEMA,
  validStructureReference,
  type StructureReviewReceipt,
  DOCUMENT_STRUCTURE_ENGINE,
  validDocumentStructureEngine,
  DOCUMENT_STRUCTURE_SCHEMA,
  validStructureQuery,
  missingChoiceLabels,
  type DocumentStructureQuery,
  type DocumentStructureSummary,
  type DocumentStructureView,
  type DocumentStructureReference,
  type StructurePage,
  type StructurePageInput,
  type StructureQuestion,
  type StructureChoiceRecheck,
} from "../../shared/material-document-structure";
import {
  recoverStructurePage,
  StructureQuestionAssembler,
} from "./material-document-structure";
import type { MaterialParseLease } from "./material-parse-queue";
import type { OriginalImage } from "./question-assets";
import type { QuestionDocument } from "../../shared/question-document";
import { QUESTION_DOCUMENT_SCHEMA, QUESTION_STRUCTURE_ILLUSTRATIONS_SCHEMA, type CompleteQuestionDocument, detachedSourceAnswer, isCompleteQuestionDocument, questionDocumentSchemaForRoles, validQuestionDocument } from "../../shared/question-document";
import { validQuestionContextEdit, type QuestionContextEditInput } from "../../shared/question-context-edit";
import { QUESTION_CONTEXT_SCHEMA, validQuestionContextSource, type QuestionContextSource } from "../../shared/question-context";
import { projectionFormulasInQuestion } from "../../shared/question-projection";
import { completeQuestion } from "../education/question-context-revision";
import type { ArchiveFields } from "../../shared/question-archive";
import { PDF_LAYOUT_ENGINE } from "../../shared/material-layout";
import { MATERIAL_PREVIEW_SCHEMA, PDF_PAGE_ENGINE, pageSha, type PageBox } from "../../shared/material-page-preview";
import { validPdfFilePage } from "../../shared/material-pdf-file";
import { localizedPdfMarkProof, verifiedQuestionBeforeNativeSection, verifiedQuestionInPdfConflict } from "./material-pdf-question-conflict";
import { BOOK_SECTION_LOOKBACK } from "./material-book-question-section";
import { structureBookScope } from "./material-structure-book-scope";
import {
  assertStructureIllustrationPlan, attachStructureIllustrations, planStructureIllustrations,
  structureIllustrationAssets, validStructureIllustrationProof,
  type StructureIllustrationPage, type StructureIllustrationPlan, type StructureIllustrationProof,
} from './material-structure-illustrations';
import { checkedStructureArchive, STRUCTURE_BANK_REVISION } from "./material-structure-bank";
import {
  alignPdfChoiceAnswers, isPrintedAnswerCoverPart, literalPrintedChoiceProjection, pdfChoiceHeadings, pdfPrintedAnswers,
  type PdfChoiceHeading, type PdfPrintedAnswers,
} from "./material-pdf-printed-answers";

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
export type PreparedStructureReview = {
  reference: DocumentStructureReference;
  question: StructureQuestion;
  document: QuestionDocument;
};
type StructureReviewRecord = {
  schemaVersion: typeof STRUCTURE_REVIEW_SCHEMA;
  reference: DocumentStructureReference;
  questionId: string;
  fields: ArchiveFields;
  document: QuestionDocument;
  createdAt: string;
};
type StructureContextReceipt = {
  input: QuestionContextEditInput;
  reference: DocumentStructureReference;
  contextSha: string;
  saved: QuestionContextSource;
  illustrations?: StructureIllustrationProof[];
};
type Host = {
  all: (sql: string, values?: Value[]) => Promise<Row[]>;
  run: (sql: string, values?: Value[]) => Promise<void>;
  resource: (id: string) => Promise<TeacherResource>;
  verify: (id: string, version: string, signal: AbortSignal) => Promise<void>;
  verifyBookOriginal?: (id: string, version: string, signal: AbortSignal) => Promise<void>;
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
  cropIllustration?: (plan:StructureIllustrationPlan, signal:AbortSignal)=>Promise<StructureIllustrationProof>;
  recheckChoiceRow?: (image: OriginalImage, plan: ChoiceRecheckPlan, signal: AbortSignal) => Promise<StructureChoiceRecheck | undefined>;
  verifyPdfMarks?: (
    image: OriginalImage, marks: PageBox[], slices: PageBox[], signal: AbortSignal,
  ) => Promise<boolean>;
  enqueue: (id: string, version: string, token: string) => Promise<void>;
  publish: (resource: TeacherResource, generation: string) => Promise<void>;
  unwrapWeb?: (q: QuestionBankItem) => Promise<QuestionDocument | undefined>;
  unwrapBook?: (q: QuestionBankItem) => Promise<QuestionDocument | undefined>;
  writer: <T>(
    action: (target: MaterialStructureRepository) => Promise<T>,
  ) => Promise<T>;
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = () => new Date().toISOString();
export const MATERIAL_STRUCTURE_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"] as const;
const supported = (r: TeacherResource) =>
  MATERIAL_STRUCTURE_EXTENSIONS.some(extension => r.originalFileName.toLowerCase().endsWith(extension));

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
      `CREATE TABLE IF NOT EXISTS material_structure_reviews(id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,candidate_id TEXT NOT NULL,question_id TEXT NOT NULL UNIQUE,body_json TEXT NOT NULL,sha256 TEXT NOT NULL,UNIQUE(resource_id,version,candidate_id))`,
      `CREATE TABLE IF NOT EXISTS material_structure_context_edits(question_id TEXT NOT NULL,request_id TEXT NOT NULL,context_sha TEXT NOT NULL,body_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(question_id,request_id))`,
      `CREATE TABLE IF NOT EXISTS material_table_vision_candidates(resource_id TEXT NOT NULL REFERENCES teacher_resources(id) ON DELETE CASCADE,generation TEXT NOT NULL,cell_key TEXT NOT NULL,body_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(resource_id,generation,cell_key))`,
      `CREATE INDEX IF NOT EXISTS material_structure_context_hash ON material_structure_context_edits(question_id,context_sha)`,
      `CREATE TABLE IF NOT EXISTS material_structure_chunks(generation TEXT NOT NULL,id TEXT NOT NULL,page INTEGER NOT NULL,body_json TEXT NOT NULL,PRIMARY KEY(generation,id))`,
      `CREATE INDEX IF NOT EXISTS material_structure_chunk_pages ON material_structure_chunks(generation,page)`,
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
      (validDocumentStructureEngine(row.engine) ||
        row.engine === "layout-paragraph-question.v1") &&
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
        (validDocumentStructureEngine(old.engine) ||
          old.engine === "layout-paragraph-question.v1") &&
        ["complete", "partial"].includes(String(old.status))
      )
        return false;
      const same =
        old?.version === resource.contentHash &&
        old.engine === DOCUMENT_STRUCTURE_ENGINE;
      if (lease && !(await target.host.lease(lease))) throw Error("cancelled");
      await target.host.run(
        `INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,lease,updated_at) VALUES(?,?,?,?,'running',?,?)
         ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,engine=excluded.engine,generation=excluded.generation,
         pages=CASE WHEN generation=excluded.generation THEN pages ELSE 0 END,
         processed=CASE WHEN generation=excluded.generation THEN processed ELSE 0 END,
         paragraphs=CASE WHEN generation=excluded.generation THEN paragraphs ELSE 0 END,
         questions=CASE WHEN generation=excluded.generation THEN questions ELSE 0 END,
         held=CASE WHEN generation=excluded.generation THEN held ELSE 0 END,
         status='running',error='',lease=excluded.lease,updated_at=excluded.updated_at`,
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

  /** Called by the folder coordinator on its writer connection, before it enqueues the parser. */
  async prepareFolderRecovery(id: string, version: string, upgradeLegacy = false) {
    const resource = await this.host.resource(id);
    if (resource.contentHash !== version) throw Error("source_changed");
    if (!supported(resource)) throw Error("unsupported");
    const old = await this.job(id);
    const knownEngine = validDocumentStructureEngine(old?.engine) || old?.engine === "layout-paragraph-question.v1";
    if (upgradeLegacy && old?.version === version && !knownEngine) throw Error("unsupported");
    if (old?.version === version && knownEngine &&
        (old.status === "complete" || old.status === "partial") &&
        (!upgradeLegacy || old.engine === DOCUMENT_STRUCTURE_ENGINE)) {
      return { state: old.status, generation: String(old.generation) } as const;
    }
    const same = old?.version === version && old.engine === DOCUMENT_STRUCTURE_ENGINE;
    if (same && ["pending", "running"].includes(String(old.status))) {
      return { state: "pending", generation: String(old.generation) } as const;
    }
    const running = await this.host.all(
      "SELECT 1 FROM ai_tasks WHERE task_type='resource_parse' AND input_hash=? AND status='running' LIMIT 1",
      [createHash("sha256").update(id).digest("hex")],
    );
    if (running.length) throw Error("busy");
    const generation = same ? String(old.generation) : randomUUID();
    if (same) {
      await this.host.run(
        "UPDATE material_structure_jobs SET status='pending',lease='',error='',updated_at=? WHERE resource_id=?",
        [now(), id],
      );
    } else {
      await this.replaceJob(id, version, generation);
    }
    return { state: "pending", generation } as const;
  }

  private replaceJob(id: string, version: string, generation: string) {
    return this.host.run(
      `INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,updated_at) VALUES(?,?,?,?,'pending',?)
       ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,engine=excluded.engine,generation=excluded.generation,status='pending',
         pages=0,processed=0,paragraphs=0,questions=0,held=0,error='',lease='',updated_at=excluded.updated_at`,
      [id, version, DOCUMENT_STRUCTURE_ENGINE, generation, now()],
    );
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
      await target.replaceJob(resource.id, input.version, randomUUID());
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

  /** The layout pass must not silently overrule conflicts from the same PDF
   * version. Recheck at admission to cover previously staged candidates. */
  async permitsPdfQuestion(resource: TeacherResource, question: StructureQuestion, generation: string, signal: AbortSignal) {
    const admitted = await this.pdfQuestionAdmission(resource, question, generation, signal);
    if (admitted === false) return false;
    return Array.isArray(admitted)
      ? JSON.stringify(admitted) === JSON.stringify(question.pdfSourceSlices)
      : !question.pdfSourceSlices;
  }

  private async pdfQuestionAdmission(
    resource: TeacherResource, question: StructureQuestion, generation: string, signal: AbortSignal,
  ): Promise<boolean | PageBox[]> {
    if (!/\.pdf$/i.test(resource.originalFileName)) return true;
    const [first, last] = question.pageRange;
    const [job] = await this.host.all(
      "SELECT generation,version,state,total FROM material_pdf_jobs WHERE resource_id=?",
      [resource.id],
    );
    if (!job) return true; // Historical resources may predate the paged parser.
    if (job.version !== resource.contentHash ||
      !["complete", "partial"].includes(String(job.state)) ||
      !Number.isSafeInteger(first) || !Number.isSafeInteger(last) ||
      first < 1 || last < first || last > Number(job.total) || last - first >= 8) return false;
    const pages = await this.host.all(
      `SELECT page,status,error,CASE WHEN status='needs_review' AND error='text_conflict' THEN result_json END AS result_json
       FROM material_pdf_pages WHERE generation=? AND page BETWEEN ? AND ? ORDER BY page`,
      [String(job.generation), first, last],
    );
    if (pages.length !== last - first + 1) return false;
    if (pages.every(row => row.status === "complete" ||
      row.status === "blank" && !question.anchors.some(anchor => anchor.page === row.page))) return true;
    if (pages.length !== 1) return false;
    const [row] = pages;
    if (row.status !== "needs_review" || row.error !== "text_conflict") return false;
    let receipt: unknown;
    try {
      receipt = JSON.parse(String(row.result_json));
    } catch {
      return false;
    }
    if (!validPdfFilePage(receipt) || receipt.status !== "needs_review" || receipt.error !== "text_conflict") return false;
    if (verifiedQuestionInPdfConflict(receipt.nativeText, question, Number(row.page))) return true;
    if (typeof generation !== "string" || !generation) return false;
    const [stored] = await this.host.all(
      "SELECT body_json,image_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?",
      [generation, first],
    );
    if (!stored) return false;
    const structure = JSON.parse(String(stored.body_json)) as StructurePage;
    const image = JSON.parse(String(stored.image_json)) as OriginalImage;
    if (hash(structure) !== stored.sha256 || structure.engine !== DOCUMENT_STRUCTURE_ENGINE ||
        structure.resourceId !== resource.id || structure.version !== resource.contentHash ||
        structure.page !== first || structure.totalPages !== Number(job.total) ||
        structure.sourceEngine !== PDF_LAYOUT_ENGINE ||
        structure.rasterSource?.resourceId !== resource.id || structure.rasterSource.version !== resource.contentHash ||
        image.resourceId !== resource.id || image.version !== resource.contentHash ||
        image.page !== first || image.total !== structure.totalPages || image.sha256 !== structure.rasterSha256 ||
        JSON.stringify(image.box) !== "[0,0,1,1]" ||
        image.width !== receipt.width || image.height !== receipt.height) return false;
    if (!question.pdfSourceSlices && verifiedQuestionBeforeNativeSection(receipt, question, structure)) return true;
    if (!this.host.verifyPdfMarks) return false;
    const proof = localizedPdfMarkProof(receipt, question, structure);
    if (!proof || !await this.host.verifyPdfMarks(image, proof.marks, proof.slices, signal)) return false;
    return proof.slices;
  }

  private async readPrintedAnswers(resource: TeacherResource, page: StructurePage, image: OriginalImage) {
    if (page.sourceEngine !== PDF_LAYOUT_ENGINE || page.rasterSource?.resourceId !== resource.id ||
        page.rasterSource.version !== resource.contentHash || page.resourceId !== resource.id ||
        page.version !== resource.contentHash || image.resourceId !== resource.id ||
        image.version !== resource.contentHash || image.page !== page.page || image.total !== page.totalPages ||
        image.sha256 !== page.rasterSha256 || JSON.stringify(image.box) !== "[0,0,1,1]") return;
    const [stored] = await this.host.all(
      `SELECT p.result_json FROM material_pdf_jobs j JOIN material_pdf_pages p ON p.generation=j.generation
       WHERE j.resource_id=? AND j.version=? AND j.total=? AND j.state IN ('partial','complete') AND p.page=?`,
      [resource.id, resource.contentHash, page.totalPages, page.page],
    );
    if (!stored || typeof stored.result_json !== "string") return;
    const receipt: unknown = JSON.parse(stored.result_json);
    if (validPdfFilePage(receipt) && receipt.width === image.width && receipt.height === image.height)
      return pdfPrintedAnswers(page, receipt);
  }

  private async bindPrintedAnswers(
    generation: string, key: PdfPrintedAnswers, headings: Map<string, PdfChoiceHeading | null>, signal: AbortSignal,
  ) {
    for (const section of key.sections) {
      signal.throwIfAborted();
      const heading = headings.get(section.scope.ordinal);
      const boundary = key.cover.anchor;
      if (!heading || heading.page > boundary.page) continue;
      const rows = await this.host.all(
        `SELECT id,body_json,document_json,sha256 FROM material_structure_questions
         WHERE generation=? AND first_page>=? AND last_page<=?
           AND json_extract(body_json,'$.kind')='question' AND json_extract(body_json,'$.section')=?
         ORDER BY first_page,rowid LIMIT 201`,
        [generation, heading.page, boundary.page, heading.text],
      );
      const questions = rows.map(row => JSON.parse(String(row.body_json)) as StructureQuestion);
      if (questions.some(question => question.anchors.some(anchor => anchor.page === boundary.page &&
          anchor.box[3] >= boundary.box[1]))) continue;
      const aligned = alignPdfChoiceAnswers(heading, section, questions);
      for (const [index, question] of questions.entries()) {
        const source = aligned.get(question.id), row = rows[index];
        if (!source || !row.document_json) continue;
        const document = JSON.parse(String(row.document_json)) as QuestionDocument;
        if (document.answer.origin !== "missing" || document.answer.text ||
            hash({ question, document }) !== row.sha256) throw Error("source_changed");
        document.answer = { origin: "source", text: source.text, anchors: [source.anchor] };
        if (!validQuestionDocument(document)) throw Error("structure_document_invalid");
        await this.host.run(
          "UPDATE material_structure_questions SET document_json=?,sha256=? WHERE generation=? AND id=? AND sha256=?",
          [JSON.stringify(document), hash({ question, document }), generation, question.id, String(row.sha256)],
        );
      }
    }
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
    const printedHeadings = new Map<string, PdfChoiceHeading | null>();
    const choiceRecheckedPages = new Set<number>();
    const printedPdf = /\.pdf$/i.test(resource.originalFileName);
    let coverCount = 0, printedAnswers: PdfPrintedAnswers | undefined;
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
      question.ocrSourceKey = structureOcrSourceKey(
        question,
        pages.map((item) => item.page),
      );
      const source = pages[0];
      if (this.host.recheckChoiceRow && source && pages.length === 1 && !choiceRecheckedPages.has(source.page.page)) {
        const plan = planChoiceRecheck(question, source.page);
        if (plan) {
          choiceRecheckedPages.add(source.page.page);
          const [stored] = await this.host.all("SELECT 1 FROM material_structure_questions WHERE generation=? AND id=?", [generation, question.id]);
          if (!stored) {
            await this.guard(resource, generation, signal, lease);
            const recheck = await this.host.recheckChoiceRow(source.image, plan, signal);
            if (recheck?.rasterSha256 === source.page.rasterSha256) question.choiceRecheck = recheck;
          }
        }
      }
      const admitted = question.status === "candidate"
        ? await this.pdfQuestionAdmission(resource, question, generation, signal) : true;
      const pdfConflict = admitted === false;
      if (Array.isArray(admitted)) question.pdfSourceSlices = admitted;
      if (pdfConflict) {
        question.status = "needs_review";
        question.issues.push("pdf_text_conflict");
      }
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
          `INSERT INTO material_structure_questions(generation,id,first_page,last_page,status,body_json,document_json,sha256) VALUES(?,?,?,?,?,?,?,?)
           ON CONFLICT(generation,id) DO UPDATE SET status=excluded.status,body_json=excluded.body_json,
             document_json=excluded.document_json,sha256=excluded.sha256
           WHERE ?=1 AND material_structure_questions.status='candidate'`,
          [
            generation,
            question.id,
            question.pageRange[0],
            question.pageRange[1],
            question.status,
            JSON.stringify(question),
            document ? JSON.stringify(document) : "",
            hash(body),
            Number(pdfConflict),
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
      let structure: StructurePage, image: OriginalImage;
      if (cached) {
        structure = JSON.parse(String(cached.body_json));
        image = JSON.parse(String(cached.image_json));
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
        image = receipt.image;
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
      let localAnswers: PdfPrintedAnswers | undefined;
      if (printedPdf) {
        const cover = structure.paragraphs.findIndex(isPrintedAnswerCoverPart);
        for (const heading of pdfChoiceHeadings(structure, cover < 0 ? structure.paragraphs.length : cover)) {
          if (printedHeadings.size >= 200 && !printedHeadings.has(heading.scope.ordinal)) break;
          printedHeadings.set(heading.scope.ordinal, printedHeadings.has(heading.scope.ordinal) ? null : heading);
        }
        if (cover >= 0) {
          coverCount += structure.paragraphs.filter(isPrintedAnswerCoverPart).length;
          localAnswers = await this.readPrintedAnswers(resource, structure, image);
          if (coverCount === 1) printedAnswers = localAnswers;
        }
      }
      for (const question of assembler.push(structure, localAnswers?.cover.id)) await save(question);
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
      if (coverCount === 1 && printedAnswers)
        await target.bindPrintedAnswers(generation, printedAnswers, printedHeadings, signal);
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
        DOCUMENT_STRUCTURE_ENGINE + ":" + generation + STRUCTURE_BANK_REVISION,
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
      "SELECT body_json,sha256 FROM material_structure_questions WHERE generation=? AND first_page<=? AND last_page>=? ORDER BY rowid LIMIT 100",
      [summary.generation, input.page, input.page],
    );
    const reviewed = await this.host.all(
      "SELECT candidate_id,question_id FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id IN (SELECT id FROM material_structure_questions WHERE first_page<=? AND last_page>=?) LIMIT 100",
      [resource.id, resource.contentHash, input.page, input.page],
    );
    const reviewedMap = Object.fromEntries(
      reviewed.map((row) => [
        String(row.candidate_id),
        String(row.question_id),
      ]),
    );
    {
      for (const row of questions) {
        const q = JSON.parse(String(row.body_json)) as StructureQuestion;
        if (q.status === "needs_review" && q.ocrSourceKey && !reviewedMap[q.id]) {
          const owner = await this.archivedOwner(
            {
              schemaVersion: DOCUMENT_STRUCTURE_SCHEMA,
              resourceId: resource.id,
              version: resource.contentHash,
              generation: summary.generation,
              candidateId: q.id,
              sha256: String(row.sha256),
            },
            q,
            true,
          );
          if (owner) reviewedMap[q.id] = owner;
        }
      }
    }
    return {
      summary,
      ...(page ? { page: JSON.parse(String(page.body_json)) } : {}),
      questions: questions.map((row) => JSON.parse(String(row.body_json))),
      references: Object.fromEntries(
        questions.map((row) => {
          const q = JSON.parse(String(row.body_json));
          return [
            q.id,
            {
              schemaVersion: DOCUMENT_STRUCTURE_SCHEMA,
              resourceId: resource.id,
              version: resource.contentHash,
              generation: summary.generation,
              candidateId: q.id,
              sha256: String(row.sha256),
            },
          ];
        }),
      ),
      reviewed: reviewedMap,
    };
  }

  async reviewOverview(input: DocumentStructureQuery) {
    if (!validStructureQuery(input)) throw Error("invalid_input");
    const resource = await this.host.resource(input.resourceId);
    if (resource.contentHash !== input.version) throw Error("source_changed");
    const job = await this.job(resource.id);
    if (!job || job.version !== input.version || !["complete", "partial"].includes(String(job.status))) return;
    return readStructureReviewOverview((sql, values) => this.host.all(sql, values), String(job.generation), input.page);
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
    // Frozen older structures remain readable and reviewable. Automatic
    // publishing uses the current ownership rules after an explicit rebuild.
    if (job.engine !== DOCUMENT_STRUCTURE_ENGINE)
      return { generation: String(job.generation), archiveable: false, hasMore: false, items: [] };
    const rows = await this.host.all(
      "SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid LIMIT 17 OFFSET ?",
      [String(job.generation), offset],
    );
    return {
      generation: String(job.generation),
      archiveable: true,
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

  async currentPublication(id: string, version: string, generation: string) {
    const job = await this.job(id);
    return job?.version === version && job.generation === generation &&
      job.engine === DOCUMENT_STRUCTURE_ENGINE && ["complete", "partial"].includes(String(job.status));
  }

  async archivedOwner(
    reference: DocumentStructureReference,
    question: StructureQuestion,
    teacherOnly = false,
  ): Promise<string | undefined> {
    if (!question.ocrSourceKey) return;
    const pages = new Map<string, StructurePage>();
    const readPage = async (generation: string, page: number) => {
      const key = generation + ":" + page;
      let result = pages.get(key);
      if (result) return result;
      const row = (
        await this.host.all(
          "SELECT body_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?",
          [generation, page],
        )
      )[0];
      if (!row) throw Error("source_changed");
      result = JSON.parse(String(row.body_json));
      if (
        !result ||
        hash(result) !== row.sha256 ||
        result.resourceId !== reference.resourceId ||
        result.version !== reference.version
      )
        throw Error("source_changed");
      if (pages.size >= 32) pages.delete(pages.keys().next().value!);
      pages.set(key, result);
      return result;
    };
    let cursor = 0;
    for (;;) {
      const rows = await this.host.all(
        `SELECT m.rowid cursor,b.id,b.archive_json,q.generation,q.body_json,q.document_json,q.sha256
          FROM material_question_members m JOIN question_bank_items b ON b.id=m.question_id
          JOIN material_structure_questions q ON q.generation=json_extract(b.archive_json,'$.structure.generation')
            AND q.id=json_extract(b.archive_json,'$.structure.candidateId')
          WHERE m.resource_id=? AND m.rowid>? AND json_extract(b.archive_json,'$.structure.version')=?
            AND json_extract(q.body_json,'$.number')=? AND q.first_page=? AND q.last_page=?
            AND ((?=0 AND q.generation=?) OR ${checkedStructureArchive("b.archive_json")})
          ORDER BY m.rowid LIMIT 32`,
        [
          reference.resourceId,
          cursor,
          reference.version,
          question.number,
          ...question.pageRange,
          teacherOnly ? 1 : 0,
          reference.generation,
        ],
      );
      if (!rows.length) return;
      for (const row of rows) {
        cursor = Number(row.cursor);
        const original = JSON.parse(String(row.body_json)) as StructureQuestion;
        const document = row.document_json
          ? JSON.parse(String(row.document_json))
          : undefined;
        const archive = JSON.parse(String(row.archive_json));
        if (
          hash({ question: original, ...(document ? { document } : {}) }) !==
            row.sha256 ||
          archive.structure?.sha256 !== row.sha256
        )
          throw Error("source_changed");
        const sourcePages: StructurePage[] = [];
        for (
          let page = original.pageRange[0];
          page <= original.pageRange[1];
          page++
        )
          sourcePages.push(await readPage(String(row.generation), page));
        if (
          structureOcrSourceKey(original, sourcePages) === question.ocrSourceKey ||
          structureOcrSourceKey(original, sourcePages, true) === question.ocrSourceKey
        )
          return String(row.id);
      }
    }
  }

  async assertReviewCurrent(reference: DocumentStructureReference) {
    if (!validStructureReference(reference)) throw Error("invalid_input");
    const job = await this.job(reference.resourceId);
    const resource = await this.host.resource(reference.resourceId);
    if (
      !job ||
      job.generation !== reference.generation ||
      job.version !== reference.version ||
      resource.contentHash !== reference.version ||
      !["complete", "partial"].includes(String(job.status))
    )
      throw Error("source_changed");
  }

  private async sourceCandidate(
    reference: DocumentStructureReference,
    signal: AbortSignal,
    verifyOriginal = true,
  ): Promise<StructureCandidate> {
    if (!validStructureReference(reference)) throw Error("invalid_input");
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
      hash({ question, ...(document ? { document } : {}) }) !== reference.sha256
    )
      throw Error("source_changed");
    const source = (
      await this.host.all(
        "SELECT body_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?",
        [reference.generation, question.pageRange[0]],
      )
    )[0];
    if (!source) throw Error("source_changed");
    const page = JSON.parse(String(source.body_json));
    if (
      hash(page) !== source.sha256 ||
      page.resourceId !== reference.resourceId ||
      page.version !== reference.version
    )
      throw Error("source_changed");
    if (verifyOriginal) await this.host.verify(reference.resourceId, reference.version, signal);
    return { question, document };
  }

  private tableVisionKey(input: TableVisionCell) {
    return visionHash(JSON.stringify([TABLE_VISION_SCHEMA, input.reference.sha256, input.reference.candidateId, input.page, input.regionId, input.row, input.column]));
  }

  async assertTableVisionCurrent(input: TableVisionCell) {
    await this.assertReviewCurrent(input.reference);
    const privateRows = await this.host.all(
      "SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data=1 LIMIT 1", [input.reference.resourceId],
    );
    if (privateRows.length) throw Error("privacy_blocked");
    if ((await this.host.all(
      "SELECT 1 FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=? LIMIT 1",
      [input.reference.resourceId, input.reference.version, input.reference.candidateId],
    )).length) throw Error("source_changed");
  }

  async tableVisionSource(input: TableVisionCell, signal: AbortSignal) {
    await this.assertTableVisionCurrent(input);
    const { question } = await this.sourceCandidate(input.reference, signal);
    const table = question.tableSources?.find(source => source.page === input.page && source.regionId === input.regionId);
    if (question.kind !== "question" || question.status !== "needs_review" ||
        !table?.rows[input.row]?.[input.column]?.needsReview) throw Error("source_incomplete");
    const image = await this.image({ resourceId: input.reference.resourceId, version: input.reference.version, page: input.page });
    if (image.sha256 !== table.rasterSha256) throw Error("source_changed");
    await this.assertReviewCurrent(input.reference);
    return { table, image };
  }

  async readTableVision(input: TableVisionCell) {
    await this.assertReviewCurrent(input.reference);
    const { resourceId, generation } = input.reference;
    const [row] = await this.host.all(
      "SELECT body_json,sha256 FROM material_table_vision_candidates WHERE resource_id=? AND generation=? AND cell_key=?",
      [resourceId, generation, this.tableVisionKey(input)],
    );
    if (!row) return;
    if (typeof row.body_json !== "string" || visionHash(row.body_json) !== row.sha256) throw Error("source_changed");
    return parseSavedTableVision(row.body_json);
  }

  async saveTableVision(input: TableVisionCell, candidate: TableVisionCandidate, signal: AbortSignal) {
    const body = JSON.stringify(candidate);
    parseSavedTableVision(body);
    const {resourceId, generation, version} = input.reference;
    signal.throwIfAborted();
    await this.host.run(
      `INSERT OR IGNORE INTO material_table_vision_candidates(resource_id,generation,cell_key,body_json,sha256)
       SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM material_structure_jobs
       WHERE resource_id=? AND generation=? AND version=? AND status IN ('complete','partial'))
       AND NOT EXISTS (SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data=1)
       AND NOT EXISTS (SELECT 1 FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=?)`,
      [resourceId, generation, this.tableVisionKey(input), body, visionHash(body),
        resourceId, generation, version, resourceId, resourceId, version, input.reference.candidateId],
    );
    const result = await this.readTableVision(input);
    if (!result) throw Error("source_changed");
    return result;
  }

  async prepareReview(
    reference: DocumentStructureReference,
    signal: AbortSignal,
  ): Promise<PreparedStructureReview> {
    await this.assertReviewCurrent(reference);
    const candidate = await this.sourceCandidate(reference, signal);
    const q = candidate.question;
    if (q.kind !== "question" || q.status !== "needs_review")
      throw Error("structure_not_held");
    if (
      q.issues.some((issue) =>
        [
          "missing_figure",
          "missing_question_start",
          "oversized_question",
        ].includes(issue),
      )
    )
      throw Error("structure_source_incomplete");
    if (q.pageRange[1] - q.pageRange[0] >= 8) throw Error("question_too_large");
    const pages: { page: StructurePage; image: OriginalImage }[] = [];
    for (let page = q.pageRange[0]; page <= q.pageRange[1]; page++) {
      const row = (
        await this.host.all(
          "SELECT * FROM material_structure_pages WHERE generation=? AND page=?",
          [reference.generation, page],
        )
      )[0];
      if (!row) throw Error("source_changed");
      const structure = JSON.parse(String(row.body_json)) as StructurePage;
      const image = JSON.parse(String(row.image_json)) as OriginalImage;
      if (
        hash(structure) !== row.sha256 ||
        structure.resourceId !== reference.resourceId ||
        structure.version !== reference.version ||
        image.sha256 !== structure.rasterSha256 ||
        image.resourceId !== reference.resourceId ||
        image.version !== reference.version
      )
        throw Error("source_changed");
      pages.push({ page: structure, image });
    }
    const resource = await this.host.resource(reference.resourceId);
    const document = await this.host.document(resource, q, pages, signal);
    await this.assertReviewCurrent(reference);
    return { reference, question: q, document };
  }

  private reviewRecord(row: Row | undefined) {
    if (!row) return;
    const body = JSON.parse(String(row.body_json)) as StructureReviewRecord;
    if (
      hash(body) !== row.sha256 ||
      body.schemaVersion !== STRUCTURE_REVIEW_SCHEMA ||
      body.questionId !== row.question_id ||
      body.reference.resourceId !== row.resource_id ||
      body.reference.version !== row.version ||
      body.reference.candidateId !== row.candidate_id
    )
      throw Error("source_changed");
    return {
      body,
      receipt: {
        schemaVersion: STRUCTURE_REVIEW_SCHEMA,
        id: String(row.id),
        sha256: String(row.sha256),
      } as StructureReviewReceipt,
    };
  }

  async reviewed(reference: DocumentStructureReference) {
    return this.reviewRecord(
      (
        await this.host.all(
          "SELECT * FROM material_structure_reviews WHERE resource_id=? AND version=? AND candidate_id=?",
          [reference.resourceId, reference.version, reference.candidateId],
        )
      )[0],
    );
  }

  async recordReview(
    prepared: PreparedStructureReview,
    fields: ArchiveFields,
    questionId: string,
  ) {
    await this.assertReviewCurrent(prepared.reference);
    // This method is called inside the archive writer, after the source check and question creation.
    const body: StructureReviewRecord = {
      schemaVersion: STRUCTURE_REVIEW_SCHEMA,
      reference: prepared.reference,
      questionId,
      fields,
      document: prepared.document,
      createdAt: now(),
    };
    const receipt: StructureReviewReceipt = {
      schemaVersion: STRUCTURE_REVIEW_SCHEMA,
      id: "structure_review_" + randomUUID(),
      sha256: hash(body),
    };
    await this.host.run(
      "INSERT INTO material_structure_reviews(id,resource_id,version,candidate_id,question_id,body_json,sha256) VALUES(?,?,?,?,?,?,?)",
      [
        receipt.id,
        body.reference.resourceId,
        body.reference.version,
        body.reference.candidateId,
        questionId,
        JSON.stringify(body),
        receipt.sha256,
      ],
    );
    return receipt;
  }

  private async authenticateReview(q: QuestionBankItem, signal: AbortSignal, verifyOriginal: boolean) {
    const receipt = q.archive?.structureReview;
    if (!receipt || !q.archive?.structure) throw Error("source_changed");
    const saved = this.reviewRecord(
      (
        await this.host.all(
          "SELECT * FROM material_structure_reviews WHERE id=?",
          [receipt.id],
        )
      )[0],
    );
    if (
      !saved ||
      saved.receipt.sha256 !== receipt.sha256 ||
      saved.body.questionId !== q.id ||
      JSON.stringify(saved.body.reference) !==
        JSON.stringify(q.archive.structure) ||
      !validQuestionDocument(saved.body.document)
    )
      throw Error("source_changed");
    const candidate = await this.sourceCandidate(saved.body.reference, signal, verifyOriginal);
    if (
      candidate.question.status !== "needs_review" ||
      candidate.question.kind !== "question" ||
      saved.body.document.source.resourceId !==
        saved.body.reference.resourceId ||
      saved.body.document.source.resourceVersion !==
        saved.body.reference.version
    )
      throw Error("source_changed");
    return { question: candidate.question, document: saved.body.document };
  }

  async authenticate(
    reference: DocumentStructureReference,
    signal: AbortSignal,
    verifyOriginal = true,
  ): Promise<StructureCandidate> {
    const candidate = await this.sourceCandidate(reference, signal, verifyOriginal);
    if (
      !candidate.document ||
      candidate.question.status !== "candidate" ||
      candidate.document.source.resourceId !== reference.resourceId ||
      candidate.document.source.resourceVersion !== reference.version
    )
      throw Error("source_changed");
    return candidate;
  }

  private readContextReceipt(row: Row | undefined): StructureContextReceipt | undefined {
    if (!row) return;
    const body = JSON.parse(String(row.body_json)) as StructureContextReceipt;
    if (hash(body) !== row.sha256 || !validQuestionContextEdit(body.input) ||
        !validStructureReference(body.reference) || !validQuestionContextSource(body.saved) ||
        body.input.questionId !== row.question_id || body.saved.questionId !== row.question_id ||
        body.input.requestId !== row.request_id || body.contextSha !== row.context_sha ||
        body.illustrations !== undefined && !validStructureIllustrationProof(body.illustrations))
      throw Error("source_changed");
    return body;
  }

  async contextRequest(id: string, requestId: string) {
    const [row] = await this.host.all(
      "SELECT * FROM material_structure_context_edits WHERE question_id=? AND request_id=?",
      [id, requestId],
    );
    return this.readContextReceipt(row);
  }

  private async contextReceipt(questionId: string, context: CompleteQuestionDocument['context']) {
    const [row] = await this.host.all(
      'SELECT * FROM material_structure_context_edits WHERE question_id=? AND context_sha=? ORDER BY rowid DESC LIMIT 1',
      [questionId, hash(context)],
    );
    return this.readContextReceipt(row);
  }

  async recordContext(input: QuestionContextEditInput, q: QuestionBankItem, version: string, illustrations?:StructureIllustrationProof[]) {
    if (!q.archive?.structure || !isCompleteQuestionDocument(q.document)) throw Error("source_changed");
    const contextSha = hash(q.document.context);
    const body: StructureContextReceipt = {
      input,
      reference: q.archive.structure,
      contextSha,
      saved: { schemaVersion: QUESTION_CONTEXT_SCHEMA, questionId: q.id, version },
      ...(illustrations ? {illustrations} : {}),
    };
    await this.host.run(
      "INSERT INTO material_structure_context_edits(question_id,request_id,context_sha,body_json,sha256) VALUES(?,?,?,?,?)",
      [q.id, input.requestId, contextSha, JSON.stringify(body), hash(body)],
    );
    return body.saved;
  }

  private async illustrationPlan(
    reference:DocumentStructureReference, q:StructureQuestion, document:CompleteQuestionDocument, signal:AbortSignal,
  ) {
    const assets = structureIllustrationAssets(q);
    if(!assets.length || assets.length>8 || document.context.projection.figures.state!=='provided') return;
    const pages = new Map<number,StructureIllustrationPage>();
    for(const number of new Set(assets.map(asset=>asset.page))){
      signal.throwIfAborted();
      const [row] = await this.host.all(
        'SELECT body_json,image_json,sha256 FROM material_structure_pages WHERE generation=? AND page=?',
        [reference.generation, number],
      );
      if(!row || typeof row.body_json!=='string' || Buffer.byteLength(row.body_json)>4*1048576 ||
          typeof row.image_json!=='string' || Buffer.byteLength(row.image_json)>4096 || !pageSha(row.sha256)) throw Error('source_changed');
      const page=JSON.parse(row.body_json) as StructurePage, image=JSON.parse(row.image_json) as OriginalImage;
      if(hash(page)!==row.sha256 || !validDocumentStructureEngine(page.engine) ||
          page.resourceId!==reference.resourceId || page.version!==reference.version || page.page!==number ||
          image.schemaVersion!==MATERIAL_PREVIEW_SCHEMA || image.ok!==true || image.engine!==PDF_PAGE_ENGINE ||
          image.resourceId!==reference.resourceId || image.version!==reference.version || image.page!==number ||
          !pageSha(image.sha256) || image.sha256!==page.rasterSha256 || image.total!==page.totalPages ||
          JSON.stringify(image.box)!=='[0,0,1,1]' ||
          ![image.width,image.height].every(n=>Number.isInteger(n)&&n>=1&&n<=2401)) throw Error('source_changed');
      pages.set(number,{page,image,sha256:row.sha256});
    }
    return planStructureIllustrations(q,document,pages);
  }

  async completeContext(q: QuestionBankItem, input: QuestionContextEditInput, signal: AbortSignal) {
    if (!q.archive?.sourceChecked || q.archive.state !== "teacher_edited") throw Error("permission_denied");
    const { question } = await this.validate(q, signal);
    const p = input.projection;
    if (detachedSourceAnswer(q.document) && !literalPrintedChoiceProjection(question,p.statement.text,p.choices.text))
      throw Error("source_answer_question_changed");
    const frozen = question.stem + "\n" + p.statement.text;
    if (!projectionFormulasInQuestion(p) ||
        ((structureIllustrationAssets(question).length > 0 ||
          /如图|见图|附图|[上下左右]图|图中/u.test(frozen)) && p.figures.state !== "provided") ||
        ((question.assets.some(a => a.kind === "table") ||
          /如表|见表|[上下]表|表中/u.test(frozen)) && p.tables.state !== "provided") ||
        ((question.formulaSources?.length || question.assets.some(a => a.kind === "inline_formula" || a.kind === "display_formula")) &&
          p.formulas.state !== "provided") ||
        ((question.options.length || question.expectedChoiceCount) && p.choices.state !== "provided") ||
        (question.subquestions.length && p.subquestions.state !== "provided"))
      throw Error("invalid_input");
    const labels = [...p.choices.text.matchAll(/(?:^|\s)(?:[（(]([A-H])[）)]|([A-H])[.．、])/gu)]
      .map(match => match[1] || match[2]);
    const expectedLabels = question.options.map(option => option.label);
    const missingChoices = question.issues.includes("missing_choice_options");
    if (missingChoices) {
      expectedLabels.push(...missingChoiceLabels(question.options, question.expectedChoiceCount));
      expectedLabels.sort();
    }
    const allowsUnobservedSuffix = missingChoices && !question.expectedChoiceCount;
    if (expectedLabels.length && (allowsUnobservedSuffix
      ? labels.length < expectedLabels.length || labels.some((label, index) => label !== String.fromCharCode(65 + index))
      : JSON.stringify(labels) !== JSON.stringify(expectedLabels)))
      throw Error("invalid_input");
    // Rebuild from the legacy body even when this is a correction of a
    // previous projection that already has separate diagram blocks.
    const source = q.document;
    const completeSource=isCompleteQuestionDocument(source)?source:undefined;
    const previous=completeSource?.context.illustrations;
    const derived=previous?.schemaVersion===QUESTION_STRUCTURE_ILLUSTRATIONS_SCHEMA ? previous.blockIds : undefined;
    const base=derived&&completeSource
      ? {...q,document:{...completeSource,blocks:completeSource.blocks.filter(b=>!derived.includes(b.id))}} : q;
    const next=completeQuestion(base,p,now());
    if(!isCompleteQuestionDocument(next.document)) throw Error('source_changed');
    let illustrations:StructureIllustrationProof[]|undefined;
    if(q.archive.book||q.archive.web){
      // Supplement receipts freeze the question body and context at their own version.
      if(derived&&completeSource){
        illustrations=(await this.contextReceipt(q.id,completeSource.context))?.illustrations;
        if(!illustrations) throw Error('source_changed');
      }
    }else if(this.host.cropIllustration){
      const plan=await this.illustrationPlan(q.archive.structure!,question,next.document,signal);
      if(plan){
        illustrations=[];
        for(const figure of plan) illustrations.push(await this.host.cropIllustration(figure,signal));
        assertStructureIllustrationPlan(plan,illustrations);
      }
    }
    if(illustrations){
      attachStructureIllustrations(next.document,illustrations);
      if(!validQuestionDocument(next.document)) throw Error('source_changed');
    }
    return {next,illustrations};
  }

  async bookScope(q: QuestionBankItem, signal: AbortSignal, mockTitles = true) {
    const reference = q.archive?.structure;
    if (!reference) throw Error("source_changed");
    await this.host.verifyBookOriginal?.(reference.resourceId,reference.version,signal);
    const { question } = await this.sourceCandidate(reference, signal, !this.host.verifyBookOriginal);
    if (question.number !== q.archive!.number) throw Error("source_changed");
    const first = question.pageRange[0];
    const start = Math.max(1, first - BOOK_SECTION_LOOKBACK);
    const rows = await this.host.all(
      "SELECT page,body_json,sha256 FROM material_structure_pages WHERE generation=? AND page BETWEEN ? AND ? ORDER BY page",
      [reference.generation, start, first],
    );
    if (rows.length !== first - start + 1) throw Error("source_changed");
    return structureBookScope(reference, question, rows.map(row => {
      signal.throwIfAborted();
      const page = JSON.parse(String(row.body_json)) as StructurePage;
      if (page.page !== row.page || page.resourceId !== reference.resourceId ||
          page.version !== reference.version || hash(page) !== row.sha256) throw Error("source_changed");
      return { page, sha: String(row.sha256) };
    }), mockTitles);
  }

  async validateForBook(q: QuestionBankItem, signal: AbortSignal) {
    const reference=q.archive?.structure;
    if(!reference)throw Error("source_changed");
    await this.host.verifyBookOriginal?.(reference.resourceId,reference.version,signal);
    return this.validate(q,signal,!this.host.verifyBookOriginal);
  }

  async validate(q: QuestionBankItem, signal = new AbortController().signal, verifyOriginal = true) {
    if (!q.archive?.structure) throw Error("source_changed");
    const candidate = q.archive.structureReview
      ? await this.authenticateReview(q, signal, verifyOriginal)
      : await this.authenticate(q.archive.structure, signal, verifyOriginal);
    let source = q.archive.web ? await this.host.unwrapWeb?.(q) : q.document;
    if (q.archive.book) source = await this.host.unwrapBook?.({ ...q, document: source });
    if (!q.document || !source || !candidate.document ||
        q.document.answer.text !== q.answer || q.document.analysis.text !== q.analysis ||
        q.document.answer.origin !== q.archive.answerOrigin ||
        q.document.analysis.origin !== q.archive.analysisOrigin) throw Error("source_changed");
    const changed = ["teacher_edited", "web_enriched", "book_enriched"].includes(q.archive.state);
    const expected = changed ? reviseStructureDocument(candidate.document, {
      ...q, answer: source.answer.text, analysis: source.analysis.text,
    }) : candidate.document;
    if (changed) for (const role of ["answer", "analysis"] as const) {
      if (source[role].origin === "teacher") expected[role] = {
        origin: "teacher", text: source[role].text, anchors: [],
      };
    }
    let document = expected;
    if (isCompleteQuestionDocument(source)) {
      const context = source.context;
      const receipt = await this.contextReceipt(q.id,context);
      if (!receipt || JSON.stringify(receipt.reference) !== JSON.stringify(q.archive.structure) ||
          JSON.stringify(receipt.input.projection) !== JSON.stringify(context.projection))
        throw Error("source_changed");
      document = completeQuestion({ ...q, document: expected }, context.projection, q.updatedAt).document!;
      if(receipt.illustrations){
        if(!isCompleteQuestionDocument(document)) throw Error('source_changed');
        const plan=await this.illustrationPlan(q.archive.structure,candidate.question,document,signal);
        if(!plan) throw Error('source_changed');
        assertStructureIllustrationPlan(plan,receipt.illustrations);
        attachStructureIllustrations(document,receipt.illustrations);
      }
    }
    if (JSON.stringify(source) !== JSON.stringify(document) ||
        !q.document.blocks.some(b => b.id === "transcription" && b.kind === "text" && b.text === q.stem))
      throw Error("source_changed");
    return candidate;
  }
}

export function reviseStructureDocument(
  document: QuestionDocument,
  fields: ArchiveFields,
): QuestionDocument {
  let next = structuredClone(document);
  if (isCompleteQuestionDocument(next) && next.context.projection.statement.text !== fields.stem) {
    const { context, ...original } = next;
    const derived=context.illustrations?.schemaVersion===QUESTION_STRUCTURE_ILLUSTRATIONS_SCHEMA
      ? context.illustrations.blockIds : [];
    next = { ...original, blocks:original.blocks.filter(b=>!derived.includes(b.id)), schemaVersion: QUESTION_DOCUMENT_SCHEMA };
  }
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
  if (isCompleteQuestionDocument(next)) next.schemaVersion = questionDocumentSchemaForRoles(next);
  if (!validQuestionDocument(next)) throw Error("invalid_input");
  return next;
}
