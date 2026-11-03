import {randomUUID, createHash} from 'node:crypto';
import type {PaperTemplateVersion, PaperTemplateReceipt} from '../../shared/paper-template';
import {PAPER_TEMPLATE_SCHEMA} from '../../shared/paper-template';
import {authorizePaperOwner, canonicalBasketJson} from './paper-basket-state';
import type {PaperSql} from './paper-sql';

export type VersionContent = Omit<PaperTemplateVersion, 'templateId' | 'version' | 'digest' | 'schemaVersion' | 'studentId'>;
type Host = {transaction<T>(work: (sql: PaperSql) => Promise<T>): Promise<T>};
export const templateHash = (v: unknown) => createHash('sha256').update(canonicalBasketJson(v)).digest('hex');
/** Internal trusted persistence boundary. IPC must never expose this host-content method directly.
 * Caller must hold the resource lease across this transaction; verify is called before commit.
 */
export class PaperTemplateRepository {
  constructor(private readonly host: Host) {}
  async save(input: {sessionId: string; requestId: string; expectedHeadVersion: number; templateId?: string;
    intent: unknown; content: VersionContent}, verify: (replay?:boolean) => Promise<void>, current: () => boolean) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId) || !Number.isSafeInteger(input.expectedHeadVersion)
      || input.expectedHeadVersion < 0 || input.expectedHeadVersion >= 1000000
      || !input.content.name.trim() || input.content.name.length > 160
      || (input.templateId !== undefined && !/^xitemplate_[a-f0-9-]{36}$/.test(input.templateId))) throw Error('invalid_input');
    const lease = () => {if (!current()) throw Error('cancelled');};
    const inputDigest = templateHash(input.intent);
    return this.host.transaction(async sql => {
      lease();
      const studentId = await authorizePaperOwner(sql, input.sessionId);
      const prior = (await sql.all('SELECT * FROM paper_template_receipts WHERE session_id=? AND request_id=?',
        [input.sessionId, input.requestId]))[0];
      if (prior) {
        if (prior.student_id !== studentId) throw Error('permission_denied');
        if (prior.input_digest !== inputDigest) throw Error('idempotency_conflict');
        lease();
        return JSON.parse(String(prior.result_json)) as PaperTemplateReceipt;
      }
      const templateId = input.templateId ?? 'xitemplate_' + randomUUID();
      const head = (await sql.all('SELECT * FROM paper_template_heads WHERE template_id=?', [templateId]))[0];
      if (head && head.student_id !== studentId) throw Error('permission_denied');
      if (Number(head?.head_version ?? 0) !== input.expectedHeadVersion || (!head && input.templateId)) throw Error('conflict');
      if(head){const latest=(await sql.all('SELECT data_json FROM paper_template_versions WHERE template_id=? AND version=?',[templateId,input.expectedHeadVersion]))[0];
        if(!latest || JSON.parse(String(latest.data_json)).kind!==input.content.kind)throw Error('invalid_input');}
      const version = input.expectedHeadVersion + 1;
      const base = {...input.content, schemaVersion: PAPER_TEMPLATE_SCHEMA, studentId, templateId, version};
      const value: PaperTemplateVersion = {...base, digest: templateHash(base)};
      if (!head) await sql.run('INSERT INTO paper_template_heads(template_id,student_id,head_version) VALUES (?,?,?)', [templateId, studentId, version]);
      else {
        await sql.run('UPDATE paper_template_heads SET head_version=? WHERE template_id=? AND head_version=?', [version, templateId, input.expectedHeadVersion]);
        const changed = (await sql.all('SELECT changes() AS count'))[0];
        if (Number(changed?.count) !== 1) throw Error('conflict');
      }
      await sql.run('INSERT INTO paper_template_versions(template_id,version,digest,name,data_json,created_at) VALUES (?,?,?,?,?,?)',
        [templateId, version, value.digest, value.name, canonicalBasketJson(value), new Date().toISOString()]);
      const receipt: PaperTemplateReceipt = {requestId: input.requestId, operation: 'save', template: {templateId, version, digest: value.digest}};
      await sql.run('INSERT INTO paper_template_receipts(session_id,request_id,student_id,input_digest,result_json) VALUES (?,?,?,?,?)',
        [input.sessionId, input.requestId, studentId, inputDigest, canonicalBasketJson(receipt)]);
      await verify();
      await authorizePaperOwner(sql, input.sessionId, studentId); lease();
      return receipt;
    });
  }
}
