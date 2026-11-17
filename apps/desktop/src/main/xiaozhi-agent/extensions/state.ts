import type {Sql} from '../session-state';
import type {ExtensionView} from './types';
import {validView} from './validation';
import {permissionHash} from '../permissions/validation';

const prefix = 'xiaozhi.extension.v1.';
export function createExtensionState(sql: Sql) {
  async function read(work: Sql, extensionId: string): Promise<ExtensionView> {
    if (!/^[a-z][a-z0-9_.-]{0,79}$/u.test(extensionId)) throw Error('invalid_input');
    const row = (await work.all('SELECT value_json FROM app_settings WHERE key=?', [prefix + extensionId]))[0];
    if (!row) return {schemaVersion: 1, extensionId, revision: 0, enabled: false, activeVersion: null, versions: []};
    const stored = JSON.parse(String(row.value_json));
    if (!stored || !validView(stored.document) || stored.document.extensionId !== extensionId
        || permissionHash(stored.document) !== stored.hash) throw Error('extension_state_corrupt');
    return stored.document;
  }
  return {
    read: (extensionId: string) => read(sql, extensionId),
    async list() {
      const rows = await sql.all('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY key', [prefix + '%']);
      return Promise.all(rows.map(row => read(sql, String(row.key).slice(prefix.length))));
    },
    async update(extensionId: string, revision: number, mutate: (previous: ExtensionView) => ExtensionView) {
      if (!sql.transaction) throw Error('configuration');
      return sql.transaction(async work => {
        const previous = await read(work, extensionId);
        if (previous.revision !== revision) throw Error('extension_revision_conflict');
        const next = mutate(structuredClone(previous));
        if (!validView(next) || next.extensionId !== extensionId || next.revision !== revision + 1) throw Error('invalid_input');
        const stored = JSON.stringify({document: next, hash: permissionHash(next)});
        await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
          [prefix + extensionId, stored, new Date().toISOString()]);
        return next;
      });
    },
  };
}
