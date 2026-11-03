import {PAPER_ADAPTATION_SCHEMA, type PaperAdaptationRead} from '../../shared/paper-basket-adaptation';
import type {BasketHost} from './paper-basket-repository';
import type {PaperSql} from './paper-sql';
import {adaptationOperation, type AdaptationRecord} from './paper-basket-adaptation-ledger';

export type AdaptationRunInput = {sessionId: string; studentId: string; runId: string; prompt: string};

/** Reserved, server-produced envelope. Ordinary teaching messages are unaffected. */
export function adaptationIntentFromPrompt(prompt: string): string | undefined {
  return /^指定题改编意图 ([A-Za-z0-9_-]{8,100})。/.exec(prompt)?.[1];
}

/** Called only after actual Pi admission, before the provider or any tool runs.
 * The persisted intent is bound once to a real run; prompt equality alone never
 * authorizes a candidate. Uses the existing basket transaction and operation row.
 */
export function createAdaptationRunBinder(
  host: BasketHost,
  readRecord: (sql: PaperSql, input: PaperAdaptationRead) => Promise<AdaptationRecord>,
  exact: (sql: PaperSql, record: AdaptationRecord) => Promise<unknown>,
) {
  return async function bindRun(input: AdaptationRunInput,
    signal: AbortSignal = new AbortController().signal, current: () => boolean = () => true): Promise<boolean> {
    const intentId = adaptationIntentFromPrompt(input.prompt);
    if (!intentId) return false;
    if (!/^run_[a-f0-9-]{36}$/i.test(input.runId)) throw new Error('invalid_input');
    const lease = () => {signal.throwIfAborted(); if (!current()) throw new Error('cancelled');};
    return host.transaction(async sql => {
      lease();
      const row = await adaptationOperation(sql, input.sessionId, intentId);
      if (!row || row.operation_kind !== 'domain:adaptation-prepare') throw new Error('permission_denied');
      const record = await readRecord(sql, {schemaVersion: PAPER_ADAPTATION_SCHEMA,
        sessionId: input.sessionId, studentId: input.studentId, basketId: String(row.basket_id), intentId});
      if (record.status !== 'prepared' || record.prompt !== input.prompt) throw new Error('conflict');
      if (record.runId && record.runId !== input.runId) throw new Error('conflict');
      await exact(sql, record);
      const run = (await sql.all(
        'SELECT id,prompt,student_id,route,sub_intent,status FROM ai_agent_runs WHERE id=? AND session_id=?',
        [input.runId, input.sessionId],
      ))[0];
      if (!run || run.prompt !== record.prompt || String(run.student_id || '') !== input.studentId ||
          run.route !== 'knowledge_retrieval' || run.sub_intent !== 'pi_education' ||
          !['running', 'completed'].includes(String(run.status))) throw new Error('permission_denied');
      lease();
      if (record.runId === input.runId) return true;
      if (run.status !== 'running') throw new Error('conflict');
      record.runId = input.runId;
      await sql.run('UPDATE paper_basket_operations SET adaptation_json=? WHERE session_id=? AND request_id=?',
        [JSON.stringify(record), input.sessionId, intentId]);
      lease();
      return true;
    });
  };
}
