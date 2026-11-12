import { createHash } from "node:crypto";
import {
  MATERIAL_AI_RESPONSE_RECEIPT,
  type AiResponseFormat,
  type AiResponsePhase,
  type AiResponseQuery,
  type AiResponseView,
} from "../../shared/material-ai-response";

type Row = Record<string, unknown>;
type Host = {
  all: (sql: string, values?: (string | number | null)[]) => Promise<Row[]>;
  run: (sql: string, values?: (string | number | null)[]) => Promise<void>;
};
const table = "material_ai_response_receipts";
const limit = 1048576;
const sha = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

/** Local received evidence, independent from acceptance into the question bank. */
export class MaterialAiResponses {
  constructor(private host: Host) {}

  async migrate() {
    await this.host.run(`CREATE TABLE IF NOT EXISTS ${table}(
      id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,lease TEXT NOT NULL,
      input_sha TEXT NOT NULL,phase TEXT NOT NULL,model TEXT NOT NULL,requested_at TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT '',format TEXT NOT NULL DEFAULT '',body_base64 TEXT NOT NULL DEFAULT '',
      body_bytes INTEGER NOT NULL DEFAULT 0 CHECK(body_bytes BETWEEN 0 AND 1048576),body_sha TEXT NOT NULL DEFAULT '',
      UNIQUE(batch_id,ordinal,lease),CHECK(length(body_base64)<=1398104),
      FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`);
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_ai_response_recoveries(
      response_id TEXT PRIMARY KEY REFERENCES material_ai_response_receipts(id),
      input_sha TEXT NOT NULL,body_sha TEXT NOT NULL,policy TEXT NOT NULL,
      normalized_sha TEXT NOT NULL,error TEXT NOT NULL,changes_json TEXT NOT NULL,
      created_at TEXT NOT NULL)`);
  }

  async latest(batchId: string, ordinal: number) {
    const row = (await this.host.all(`SELECT r.* FROM ${table} r
      JOIN material_ai_units u ON u.batch_id=r.batch_id AND u.ordinal=r.ordinal
      WHERE r.batch_id=? AND r.ordinal=? ORDER BY r.rowid DESC LIMIT 1`, [batchId, ordinal]))[0];
    if (!row?.received_at || !['provider-envelope.v1', 'completion-content.v1'].includes(String(row.format)))
      return;
    const unit = (await this.host.all('SELECT input_json,dispatched_at FROM material_ai_units WHERE batch_id=? AND ordinal=?', [batchId, ordinal]))[0];
    if (unit && Date.parse(String(row.requested_at)) < Number(unit.dispatched_at)) return;
    const bytes = Buffer.from(String(row.body_base64), 'base64');
    if (!unit || row.input_sha !== sha(String(unit.input_json)) || bytes.length > limit ||
        bytes.length !== Number(row.body_bytes) || bytes.toString('base64') !== row.body_base64 || sha(bytes) !== row.body_sha)
      throw Error('source_changed');
    return {id: String(row.id), inputSha: String(row.input_sha), bodySha: String(row.body_sha),
      model: String(row.model), phase: String(row.phase),
      format: row.format as 'provider-envelope.v1' | 'completion-content.v1', bytes};
  }

  async recordRecovery(receipt: NonNullable<Awaited<ReturnType<MaterialAiResponses['latest']>>>,
    policy: string, normalized: string, error: string, changes: string[]) {
    await this.host.run(`INSERT OR IGNORE INTO material_ai_response_recoveries
      (response_id,input_sha,body_sha,policy,normalized_sha,error,changes_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
      [receipt.id, receipt.inputSha, receipt.bodySha, policy, normalized ? sha(normalized) : '', error,
        JSON.stringify(changes), new Date().toISOString()]);
    const row = (await this.host.all('SELECT * FROM material_ai_response_recoveries WHERE response_id=?', [receipt.id]))[0];
    if (row?.input_sha !== receipt.inputSha || row.body_sha !== receipt.bodySha || row.policy !== policy ||
        row.normalized_sha !== (normalized ? sha(normalized) : '') || row.error !== error || row.changes_json !== JSON.stringify(changes))
      throw Error('conflict');
  }

  async prepare(
    batchId: string,
    ordinal: number,
    lease: string,
    inputSha: string,
    phase: AiResponsePhase,
    model: string,
  ) {
    const id = "airesponse_" + lease;
    await this.host.run(
      `INSERT OR IGNORE INTO ${table}(id,batch_id,ordinal,lease,input_sha,phase,model,requested_at)
      VALUES(?,?,?,?,?,?,?,?)`,
      [
        id,
        batchId,
        ordinal,
        lease,
        inputSha,
        phase,
        model,
        new Date().toISOString(),
      ],
    );
    const row = (
      await this.host.all(`SELECT * FROM ${table} WHERE id=?`, [id])
    )[0];
    if (
      !row ||
      row.batch_id !== batchId ||
      Number(row.ordinal) !== ordinal ||
      row.lease !== lease ||
      row.input_sha !== inputSha ||
      row.phase !== phase ||
      row.model !== model
    )
      throw Error("conflict");
    return id;
  }

  async receive(
    id: string,
    bytes: Uint8Array,
    format: Exclude<AiResponseFormat, "">,
  ) {
    if (bytes.byteLength > limit) throw Error("unit_too_large");
    const body = Buffer.from(bytes).toString("base64"),
      digest = sha(bytes);
    await this.host.run(
      `UPDATE ${table} SET received_at=?,format=?,body_base64=?,body_bytes=?,body_sha=?
      WHERE id=? AND received_at=''`,
      [new Date().toISOString(), format, body, bytes.byteLength, digest, id],
    );
    const row = (
      await this.host.all(
        `SELECT format,body_base64,body_bytes,body_sha,received_at FROM ${table} WHERE id=?`,
        [id],
      )
    )[0];
    if (
      !row?.received_at ||
      row.format !== format ||
      row.body_base64 !== body ||
      Number(row.body_bytes) !== bytes.byteLength ||
      row.body_sha !== digest
    )
      throw Error("conflict");
  }

  async view(query: AiResponseQuery): Promise<AiResponseView> {
    const unit = (
      await this.host.all(
        "SELECT input_json FROM material_ai_units WHERE batch_id=? AND ordinal=?",
        [query.batchId, query.ordinal],
      )
    )[0];
    if (!unit) throw Error("invalid_input");
    const inputSha = sha(String(unit.input_json));
    const rows = await this.host.all(
      `SELECT id,input_sha,phase,model,requested_at,received_at,format,body_bytes,body_sha
      FROM ${table} WHERE batch_id=? AND ordinal=? ORDER BY rowid LIMIT 400`,
      [query.batchId, query.ordinal],
    );
    if (rows.some((row) => row.input_sha !== inputSha))
      throw Error("source_changed");
    const view: AiResponseView = {
      schemaVersion: MATERIAL_AI_RESPONSE_RECEIPT,
      batchId: query.batchId,
      ordinal: query.ordinal,
      receipts: rows.map((row) => ({
        id: String(row.id),
        phase: row.phase as AiResponsePhase,
        model: String(row.model),
        requestedAt: String(row.requested_at),
        receivedAt: String(row.received_at),
        format: row.format as AiResponseFormat,
        bytes: Number(row.body_bytes),
        sha256: String(row.body_sha),
      })),
    };
    if (query.responseId) {
      if (
        !view.receipts.some(
          (row) => row.id === query.responseId && row.receivedAt,
        )
      )
        throw Error("invalid_input");
      const row = (
        await this.host.all(
          `SELECT body_base64,body_bytes,body_sha FROM ${table} WHERE id=? AND batch_id=? AND ordinal=?`,
          [query.responseId, query.batchId, query.ordinal],
        )
      )[0];
      const bytes = Buffer.from(String(row.body_base64), "base64");
      if (
        bytes.length > limit ||
        bytes.length !== Number(row.body_bytes) ||
        bytes.toString("base64") !== row.body_base64 ||
        sha(bytes) !== row.body_sha
      )
        throw Error("source_changed");
      let body: string,
        encoding: "utf8" | "base64" = "utf8";
      try {
        body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        body = String(row.body_base64);
        encoding = "base64";
      }
      view.selected = { id: query.responseId, body, encoding };
    }
    return view;
  }
}
