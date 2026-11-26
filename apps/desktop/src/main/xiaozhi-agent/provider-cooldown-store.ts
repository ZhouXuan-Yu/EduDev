import {randomBytes} from 'node:crypto';
import type {Sql} from './session-state';
import type {ProviderCooldown} from './provider-health';

const KEY = 'xiaozhi.provider-cooldowns.v1';
const MAX_ROWS = 128;
const MAX_BYTES = 64 * 1024;
const identity = /^(?:mcp|deepseek):[a-f0-9]{64}$/u;
type Document = {version: 1; salt: string; cooldowns: ProviderCooldown[]};

function decode(text: unknown): Document {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) throw Error('configuration');
  const doc = JSON.parse(text) as Document;
  if (doc?.version !== 1 || !/^[a-f0-9]{64}$/u.test(doc.salt) || !Array.isArray(doc.cooldowns) || doc.cooldowns.length > MAX_ROWS
      || new Set(doc.cooldowns.map(row => row?.key)).size !== doc.cooldowns.length) throw Error('configuration');
  for (const row of doc.cooldowns) {
    if (!row || !identity.test(row.key) || !Number.isSafeInteger(row.savedAt) || row.savedAt < 0
        || !Number.isSafeInteger(row.until) || row.until <= row.savedAt
        || !Number.isSafeInteger(row.cooldown) || row.cooldown < 0 || row.cooldown > 60_000) throw Error('configuration');
  }
  return doc;
}

/** Only host-observed cooldown deadlines and an opaque domain salt use the existing settings ledger. */
export function createProviderCooldownStore(sql: Sql) {
  let loaded: Promise<Document> | undefined;
  const read = async () => {
    const [row] = await sql.all('SELECT value_json FROM app_settings WHERE key=?', [KEY]);
    return row ? decode(row.value_json) : null;
  };
  const document = () => loaded ??= (async () => {
    const existing = await read();
    if (existing) return existing;
    const empty: Document = {version: 1, salt: randomBytes(32).toString('hex'), cooldowns: []};
    await sql.run('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',
      [KEY, JSON.stringify(empty), new Date().toISOString()]);
    const created = await read();
    if (!created) throw Error('configuration');
    return created;
  })().catch(() => {loaded = undefined; throw Error('configuration');});
  return {
    salt: async () => (await document()).salt,
    load: async () => (await document()).cooldowns,
    async save(cooldowns: readonly ProviderCooldown[]) {
      const prior = await document();
      const next = {...prior, cooldowns};
      const encoded = JSON.stringify(next);
      decode(encoded);
      const update = 'UPDATE app_settings SET value_json=?,updated_at=? WHERE key=?';
      const values = [encoded, new Date().toISOString(), KEY];
      if (sql.change) {
        if (await sql.change(update, values) !== 1) throw Error('configuration');
      } else await sql.run(update, values);
    }
  };
}
