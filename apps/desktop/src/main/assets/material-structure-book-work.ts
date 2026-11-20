import { QUESTION_DOCUMENT_BOOK_SCHEMA, QUESTION_DOCUMENT_COMPLETE_SCHEMA, QUESTION_DOCUMENT_WEB_SCHEMA } from "../../shared/question-document";
import { checkedStructureArchive, migrateStructureBank, structureDraftHidden } from "./material-structure-bank";

type Value = string | number | null;
type Host = {
  all: (sql: string, values?: Value[]) => Promise<Record<string, unknown>[]>;
  run: (sql: string, values?: Value[]) => Promise<void>;
};

export type StructureBookJob = {
  questionId: string;
  resourceId: string;
  version: string;
  pairRevision: number;
  ticket: string;
};

const archive = (prefix: string) => `CASE WHEN json_valid(${prefix}archive_json) THEN ${prefix}archive_json ELSE '{}' END`;
const resourceOf = (prefix: string) => `json_extract(${archive(prefix)},'$.structure.resourceId')`;
const versionOf = (prefix: string) => `json_extract(${archive(prefix)},'$.structure.version')`;
const numberOf = `json_extract(${archive("")},'$.number')`;
const documentOf = (prefix: string) => `CASE WHEN json_valid(${prefix}document_json) THEN ${prefix}document_json ELSE '{}' END`;
const documentSchemas = [QUESTION_DOCUMENT_COMPLETE_SCHEMA, QUESTION_DOCUMENT_BOOK_SCHEMA, QUESTION_DOCUMENT_WEB_SCHEMA]
  .map(schema => `'${schema}'`).join(",");
const canQueue = (prefix: string) => `${checkedStructureArchive(archive(prefix))}
  AND json_extract(${documentOf(prefix)},'$.schemaVersion') IN (${documentSchemas})
  AND json_array_length(${archive(prefix)},'$.sourceRisks')=0
  AND NOT EXISTS(SELECT 1 FROM json_each(${archive(prefix)},'$.issues') i
    WHERE i.value NOT IN ('missing_answer','missing_analysis','missing_subject','missing_grade','missing_knowledge','missing_type','missing_difficulty'))
  AND ((length(trim(${prefix}answer))=0 AND json_extract(${archive(prefix)},'$.answerOrigin')='missing')
    OR (length(trim(${prefix}analysis))=0 AND json_extract(${archive(prefix)},'$.analysisOrigin')='missing'))`;
const ticket = "lower(hex(randomblob(16)))";
const queueQuestion = `INSERT INTO material_structure_book_work_v1(question_id,resource_id,version,pair_revision,ticket)`;
const replaceQuestion = `ON CONFLICT(question_id) DO UPDATE SET resource_id=excluded.resource_id,
  version=excluded.version,pair_revision=excluded.pair_revision,ticket=excluded.ticket,error=''`;
const queueSweep = "INSERT INTO material_structure_book_sweeps_v1(resource_id,number,version,pair_revision,cursor,ticket)";
const replaceSweep = `ON CONFLICT(resource_id,number) DO UPDATE SET version=excluded.version,pair_revision=excluded.pair_revision,
  cursor='',ticket=excluded.ticket`;

/** Durable discovery by paired question book. The existing local book matcher drains these records. */
export class MaterialStructureBookWork {
  constructor(private host: Host) {}

  async migrate() {
    await migrateStructureBank(this.host);
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_structure_book_work_v1(
      question_id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,
      pair_revision INTEGER NOT NULL,ticket TEXT NOT NULL,error TEXT NOT NULL DEFAULT ''
    )`);
    await this.host.run(`CREATE INDEX IF NOT EXISTS material_structure_book_work_due ON material_structure_book_work_v1(error)`);
    await this.host.run(`CREATE INDEX IF NOT EXISTS material_structure_book_work_pair ON material_structure_book_work_v1(resource_id,pair_revision)`);
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_structure_book_sweeps_v1(
      resource_id TEXT NOT NULL,number TEXT NOT NULL,version TEXT NOT NULL,pair_revision INTEGER NOT NULL,
      cursor TEXT NOT NULL,ticket TEXT NOT NULL,PRIMARY KEY(resource_id,number)
    )`);
    await this.host.run(`CREATE INDEX IF NOT EXISTS material_structure_book_lookup ON question_bank_items(${resourceOf("")},id)
      WHERE ${resourceOf("")} IS NOT NULL`);
    await this.host.run(`CREATE INDEX IF NOT EXISTS material_structure_book_number_lookup ON question_bank_items(${resourceOf("")},${numberOf},id)
      WHERE ${resourceOf("")} IS NOT NULL`);
    for (const event of ["INSERT", "UPDATE OF archive_json,document_json,answer,analysis"]) {
      const label = event === "INSERT" ? "insert" : "update";
      await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_structure_book_question_${label}_v1
        AFTER ${event} ON question_bank_items
        WHEN ${resourceOf("new.")} IS NOT NULL AND ${canQueue("new.")}
        BEGIN ${queueQuestion}
          SELECT new.id,p.question_id,p.question_version,p.revision,${ticket} FROM material_book_pairs p
          WHERE p.active=1 AND p.question_id=${resourceOf("new.")} AND p.question_version=${versionOf("new.")}
            AND NOT EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=new.id)
          ${replaceQuestion}; END`);
    }
    for (const event of ["INSERT", "UPDATE"]) {
      await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_structure_book_pair_${event.toLowerCase()}_v1
        AFTER ${event} ON material_book_pairs WHEN new.active=1
        BEGIN ${queueSweep} VALUES(new.question_id,'',new.question_version,new.revision,'',${ticket}) ${replaceSweep}; END`);
    }
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_structure_book_pair_inactive_v1
      AFTER UPDATE ON material_book_pairs WHEN new.active=0 BEGIN
        DELETE FROM material_structure_book_sweeps_v1 WHERE resource_id=new.question_id;
        DELETE FROM material_structure_book_work_v1 WHERE resource_id=new.question_id;
      END`);
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_structure_book_pair_replace_v1
      AFTER UPDATE ON material_book_pairs WHEN new.active=1 AND old.revision<>new.revision BEGIN
        DELETE FROM material_structure_book_sweeps_v1 WHERE resource_id=new.question_id AND pair_revision<>new.revision;
        DELETE FROM material_structure_book_work_v1 WHERE resource_id=new.question_id AND pair_revision<>new.revision;
      END`);
    // Older libraries receive a bounded sweep per pair, using their existing local receipts.
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_structure_book_control_v1(id INTEGER PRIMARY KEY CHECK(id=1))`);
    await this.host.run(`${queueSweep}
      SELECT question_id,'',question_version,revision,'',${ticket} FROM material_book_pairs
      WHERE active=1 AND NOT EXISTS(SELECT 1 FROM material_structure_book_control_v1 WHERE id=1)
      ON CONFLICT(resource_id,number) DO NOTHING`);
    await this.host.run("INSERT OR IGNORE INTO material_structure_book_control_v1 VALUES(1)");
  }

  async answerChanged(resourceId: string, version: string, numbers?: string[]) {
    if (numbers && !numbers.length) return;
    await this.host.run(`${queueSweep}
      SELECT p.question_id,n.value,p.question_version,p.revision,'',${ticket}
      FROM material_book_pairs p CROSS JOIN json_each(?) n
      WHERE p.active=1 AND p.answer_id=? AND p.answer_version=?
        AND NOT EXISTS(SELECT 1 FROM material_structure_book_sweeps_v1 s WHERE s.resource_id=p.question_id
          AND s.number='' AND s.pair_revision=p.revision AND s.cursor='')
      ${replaceSweep}`, [JSON.stringify(numbers??[""]),resourceId,version]);
  }

  async discover() {
    const [sweep] = await this.host.all(`SELECT s.* FROM material_structure_book_sweeps_v1 s
      JOIN material_book_pairs p ON p.question_id=s.resource_id AND p.question_version=s.version
        AND p.revision=s.pair_revision AND p.active=1 ORDER BY s.rowid LIMIT 1`);
    if (!sweep) return false;
    const resourceId = String(sweep.resource_id), version = String(sweep.version), revision = Number(sweep.pair_revision);
    const number = String(sweep.number);
    const ids = (await this.host.all(`SELECT id FROM question_bank_items
      WHERE ${resourceOf("")}=? ${number?`AND ${numberOf}=?`:""} AND id>? ORDER BY id LIMIT 64`,
      [resourceId,...(number?[number]:[]),String(sweep.cursor)])).map(row => String(row.id));
    if (ids.length) {
      await this.host.run(`${queueQuestion}
        SELECT q.id,?,?,?,${ticket} FROM question_bank_items q
        WHERE q.id IN (${ids.map(() => "?").join(",")}) AND ${versionOf("q.")}=?
          AND ${canQueue("q.")} AND NOT ${structureDraftHidden} ${replaceQuestion}`,
       [resourceId,version,revision,...ids,version]);
    }
    const scope = [resourceId,number,String(sweep.ticket)];
    if (ids.length < 64) await this.host.run("DELETE FROM material_structure_book_sweeps_v1 WHERE resource_id=? AND number=? AND ticket=?",scope);
    else await this.host.run("UPDATE material_structure_book_sweeps_v1 SET cursor=? WHERE resource_id=? AND number=? AND ticket=?", [ids.at(-1)!,...scope]);
    return true;
  }

  async discoveryPending() {
    return (await this.host.all(`SELECT 1 FROM material_structure_book_sweeps_v1 s
      JOIN material_book_pairs p ON p.question_id=s.resource_id AND p.question_version=s.version
        AND p.revision=s.pair_revision AND p.active=1 LIMIT 1`)).length > 0;
  }

  async next(): Promise<StructureBookJob | undefined> {
    const [row] = await this.host.all(`SELECT w.* FROM material_structure_book_work_v1 w
      JOIN material_book_pairs p ON p.question_id=w.resource_id AND p.question_version=w.version
        AND p.revision=w.pair_revision AND p.active=1 WHERE w.error='' ORDER BY w.rowid LIMIT 1`);
    if (row) return {
      questionId:String(row.question_id), resourceId:String(row.resource_id), version:String(row.version),
      pairRevision:Number(row.pair_revision), ticket:String(row.ticket),
    };
  }

  async current(job: StructureBookJob) {
    return (await this.host.all(`SELECT 1 FROM material_structure_book_work_v1 w
      JOIN question_bank_items q ON q.id=w.question_id
      JOIN material_book_pairs p ON p.question_id=w.resource_id AND p.question_version=w.version
        AND p.revision=w.pair_revision AND p.active=1
      WHERE w.question_id=? AND w.ticket=? AND w.error='' AND ${resourceOf("q.")}=w.resource_id
        AND ${versionOf("q.")}=w.version AND ${canQueue("q.")} AND NOT ${structureDraftHidden}`, [job.questionId,job.ticket])).length > 0;
  }

  async finish(job: StructureBookJob, error?: string) {
    if (error) await this.host.run("UPDATE material_structure_book_work_v1 SET error=? WHERE question_id=? AND ticket=?", [error,job.questionId,job.ticket]);
    else await this.host.run("DELETE FROM material_structure_book_work_v1 WHERE question_id=? AND ticket=?", [job.questionId,job.ticket]);
  }

  async state(questionId: string) {
    return (await this.host.all(`SELECT w.error FROM material_structure_book_work_v1 w
      JOIN material_book_pairs p ON p.question_id=w.resource_id AND p.question_version=w.version
      AND p.revision=w.pair_revision AND p.active=1 WHERE w.question_id=?`, [questionId]))[0];
  }
}
