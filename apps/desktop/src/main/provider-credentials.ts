import type {Sql} from './xiaozhi-agent/session-state';
import {createModelSettingsState} from './xiaozhi-agent/model-settings-state';
import type {LegacyCredentialMigrationState,LegacyCredentialMigrationStatus} from '../shared/xiaozhi-settings';

export type SettingsKeyCodec = {
  available: () => boolean;
  seal: (key: string) => string;
  open: (sealed: string) => string;
};
const providers = ['deepseek', 'glm'] as const;
export type CredentialMigrationState = LegacyCredentialMigrationState;
const globalKey = 'xiaozhi.provider.v1';

// Keep this inventory shared by export and verification of portable packages.
export const portableProviderSecretFields = [
  [globalKey, '$.sealedKey'],
  ['deepseek', '$.apiKey'], ['deepseek', '$.sealedKey'],
  ['glm', '$.apiKey'], ['glm', '$.sealedKey'],
  ['xiaozhi.material-ai.v1', '$.sealedKey'],
] as const;

type StoredSetting = {key: string; value_json: string; updated_at: string};
function parsedObject(raw: string): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
}

export function openProviderCredential(codec: SettingsKeyCodec | undefined, sealed: unknown) {
  if (typeof sealed !== 'string' || !sealed || sealed.length > 16384) throw new Error('configuration');
  if (!codec?.available()) throw new Error('storage_unavailable');
  let key: string;
  try { key = codec.open(sealed); }
  catch { throw new Error('configuration'); }
  if (!key || key.length > 4096) throw new Error('configuration');
  return key;
}

export function sealProviderCredential(codec: SettingsKeyCodec, key: string) {
  if (!codec.available()) throw new Error('storage_unavailable');
  if (!key || key.length > 4096) throw new Error('configuration');
  let sealed: string;
  try { sealed = codec.seal(key); }
  catch { throw new Error('storage_unavailable'); }
  if (openProviderCredential(codec,sealed) !== key) throw new Error('configuration');
  return sealed;
}

const statusFrom = (error: unknown): LegacyCredentialMigrationStatus =>
  error instanceof Error && error.message === 'storage_unavailable' ? 'storage_unavailable'
    : error instanceof Error && error.message === 'conflict' ? 'conflict' : 'configuration';

async function readSetting(sql: Sql, key: string) {
  const [row] = await sql.all('SELECT key,value_json,updated_at FROM app_settings WHERE key=?',[key]);
  return row as StoredSetting | undefined;
}

export async function readLegacyProviderSetting(sql:Pick<Sql,'all'>,key:typeof providers[number]) {
  const [row] = await sql.all('SELECT value_json,updated_at FROM app_settings WHERE key=?',[key]);
  let stored:Record<string,unknown>|undefined;
  if(row){try {stored=parsedObject(String(row.value_json));}catch { /* A legacy runtime can still fall back. */ }}
  return {stored:stored??{},updatedAt:String(row?.updated_at??''),invalid:Boolean(row&&!stored)};
}
function sameSetting(a: StoredSetting | undefined, b: StoredSetting | undefined) {
  return a?.value_json === b?.value_json && a?.updated_at === b?.updated_at;
}

export async function migrateLegacyProviderCredentials(sql: Sql, codec?: SettingsKeyCodec): Promise<CredentialMigrationState> {
  const state: CredentialMigrationState = {deepseek:'not_needed',glm:'not_needed'};
  for (const provider of providers) {
    try {
      if (!sql.readTransaction || !sql.transaction) throw new Error('configuration');
      const snapshot = await sql.readTransaction(async read => {
        const legacy = await readSetting(read,provider);
        const config = legacy && parsedObject(legacy.value_json);
        if (!legacy) return;
        if (!config) throw new Error('configuration');
        if (!Object.hasOwn(config,'apiKey')) return;
        const current = provider === 'deepseek' ? await readSetting(read,globalKey) : undefined;
        const saved = provider === 'deepseek' ? await createModelSettingsState(read).configuration() : undefined;
        return {legacy,config,current,saved};
      });
      if (!snapshot) continue;
      const {legacy,config,current,saved} = snapshot;
      if (saved?.sealedKey) openProviderCredential(codec,saved.sealedKey);

      const {apiKey,...next} = config;
      if (Object.hasOwn(next,'sealedKey')) {
        openProviderCredential(codec,next.sealedKey);
      } else if (typeof apiKey === 'string' && apiKey) {
        if (!codec) throw new Error('storage_unavailable');
        next.sealedKey = sealProviderCredential(codec,apiKey);
      } else if (typeof apiKey !== 'string') {
        throw new Error('configuration');
      } else {
        // A previously saved empty key disabled the environment fallback.
        next.legacyCredentialDisabled = true;
      }
      // Seal/readback takes place before acquiring the writer. Both reads are
      // guarded at commit, including the authoritative newer DeepSeek record.
      await sql.transaction(async work => {
        if (!sameSetting(await readSetting(work,provider),legacy) ||
          provider === 'deepseek' && !sameSetting(await readSetting(work,globalKey),current)) {
          throw new Error('conflict');
        }
        const changed = await work.change?.(
          'UPDATE app_settings SET value_json=? WHERE key=? AND value_json=? AND updated_at=?',
          [JSON.stringify(next), provider, legacy.value_json, legacy.updated_at],
        );
        if (changed !== 1) throw new Error('conflict');
      });
      state[provider] = 'migrated';
    } catch (error) {
      state[provider] = statusFrom(error);
    }
  }
  return state;
}
