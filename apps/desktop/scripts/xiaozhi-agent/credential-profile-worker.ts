import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { app, safeStorage } from 'electron';
import sqlite3 from 'sqlite3';
import { createModelSettings } from '../../src/main/xiaozhi-agent/model-settings';
import { createModelSettingsState } from '../../src/main/xiaozhi-agent/model-settings-state';
import type { OmniEduStore } from '../../src/main/db';

type Job = { mode: 'inspect' | 'replace' | 'probe-write' | 'probe-read'; expectedProfile: string;
  output: string; dataRoot?: string; probe?: string; model?: string };
const equalPath = (a: string, b: string) => fs.realpathSync(a).toLowerCase() === fs.realpathSync(b).toLowerCase();
const safeErrors = new Set(['profile_mismatch', 'configuration', 'busy', 'authentication', 'transport', 'timeout',
  'conflict', 'storage_unavailable', 'model_unavailable', 'decryption_failed', 'other_settings_changed']);

// Main-only maintenance/acceptance helper. It never initializes the application Store.
export async function runCredentialProfileJob(job: Job) {
  let db: sqlite3.Database | undefined;
  const result: Record<string, unknown> = { success: false, mode: job.mode, readOnly: job.mode === 'inspect' };
  try {
    // An isolated Electron profile must never seal a replacement for another profile's DB.
    if (!equalPath(app.getPath('userData'), job.expectedProfile)) throw new Error('profile_mismatch');
    result.targetProfileMatched = true;
    if (!safeStorage.isEncryptionAvailable()) throw new Error('storage_unavailable');
    if (job.mode === 'probe-write' || job.mode === 'probe-read') {
      if (!job.probe) throw new Error('configuration');
      if (job.mode === 'probe-write') {
        const synthetic = 'owned-profile-probe-' + randomUUID();
        fs.writeFileSync(job.probe, JSON.stringify({ synthetic, sealed: safeStorage.encryptString(synthetic).toString('base64') }), { flag: 'wx' });
        result.decryptionSucceeded = safeStorage.decryptString(Buffer.from(JSON.parse(fs.readFileSync(job.probe, 'utf8')).sealed, 'base64')) === synthetic;
      } else {
        const probe = JSON.parse(fs.readFileSync(job.probe, 'utf8'));
        try { result.decryptionSucceeded = safeStorage.decryptString(Buffer.from(probe.sealed, 'base64')) === probe.synthetic; }
        catch { result.decryptionSucceeded = false; }
      }
      result.success = true;
      return result;
    }
    if (!job.dataRoot || !equalPath(path.dirname(job.dataRoot), job.expectedProfile)) throw new Error('profile_mismatch');
    const file = path.join(job.dataRoot, 'app.db');
    if (!fs.existsSync(file)) throw new Error('configuration');
    db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const handle = new sqlite3.Database(file, job.mode === 'inspect' ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE,
        error => error ? reject(error) : resolve(handle));
    });
    db.configure('busyTimeout', 3000);
    const all = (sql: string, args: unknown[] = []) => new Promise<any[]>((resolve, reject) => db!.all(sql, args, (error, rows) => error ? reject(error) : resolve(rows)));
    const change = (sql: string, args: unknown[] = []) => new Promise<number>((resolve, reject) => db!.run(sql, args, function (error) { error ? reject(error) : resolve(this.changes); }));
    const state = createModelSettingsState({ all, change, run: async (sql, args) => { await change(sql, args); } });
    const idle = async () => {
      const count = Number((await all("SELECT count(*) n FROM ai_agent_runs WHERE status='running'"))[0].n);
      result.recordedRunningCount = count;
      if (count) throw new Error('busy');
    };
    const digestOtherSettings = async () => createHash('sha256').update(JSON.stringify(await all("SELECT key,value_json,updated_at FROM app_settings WHERE key != 'xiaozhi.provider.v1' ORDER BY key"))).digest('hex');
    const localKey = fs.readFileSync(path.resolve('.env.local'), 'utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim();
    if (!localKey || !/^[\x21-\x7e]{8,4096}$/.test(localKey)) throw new Error('configuration');
    if (job.mode === 'replace') {
      await idle();
      const before = await digestOtherSettings(), previous = await state.configuration();
      const originalSave = state.saveConfiguration.bind(state);
      state.saveConfiguration = async (...args) => { await idle(); return originalSave(...args); };
      const store = { xiaozhiState: { modelSettings: state }, getDeepSeekRuntimeSettings: async () => {
        const row = (await all("SELECT value_json FROM app_settings WHERE key='deepseek'"))[0];
        const legacy = row ? JSON.parse(row.value_json) : {};
        return { provider: 'deepseek', model: legacy.model || 'deepseek-flash', apiKey: legacy.apiKey };
      } } as unknown as OmniEduStore;
      const service = createModelSettings({ store, root: path.join(job.dataRoot, 'xiaozhi-pi'), busy: () => false,
        codec: { available: () => safeStorage.isEncryptionAvailable(), seal: key => safeStorage.encryptString(key).toString('base64'),
          open: sealed => safeStorage.decryptString(Buffer.from(sealed, 'base64')) } });
      await service.save({ schemaVersion: 'xiaozhi.settings.v1', version: previous.revision,
        defaultModel: job.model || previous.defaultModel || 'deepseek-flash', apiKey: localKey });
      result.configurationSaved = true;
      if (before !== await digestOtherSettings()) throw new Error('other_settings_changed');
      result.legacyAndOtherSettingsUnchanged = true;
    }
    const saved = await state.configuration();
    if (!saved.sealedKey || !saved.defaultModel) throw new Error('configuration');
    let key: string;
    try { key = safeStorage.decryptString(Buffer.from(saved.sealedKey, 'base64')); }
    catch { throw new Error('decryption_failed'); }
    result.version = saved.revision; result.defaultModel = saved.defaultModel; result.encrypted = true;
    result.matchesAuthorizedLocalKey = key === localKey;
    if (!result.matchesAuthorizedLocalKey) throw new Error('configuration');
    await idle();
    await new Promise<void>((resolve, reject) => db!.close(error => error ? reject(error) : resolve())); db = undefined;
    // Inspect must not write the official cache or any configuration row.
    const catalogue = await fetch('https://api.deepseek.com/v1/models', { headers: { Authorization: 'Bearer ' + key }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    result.catalogueHttpStatus = catalogue.status;
    if (!catalogue.ok) throw new Error(catalogue.status === 401 || catalogue.status === 403 ? 'authentication' : 'transport');
    const body = await catalogue.json() as { data?: { id?: unknown }[] };
    const models = body.data?.map(item => item.id).filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(id)).slice(0, 32) || [];
    result.availableModelIds = models; result.defaultInOfficialCatalogue = models.includes(saved.defaultModel);
    if (!result.defaultInOfficialCatalogue) throw new Error('model_unavailable');
    const reply = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: saved.defaultModel, messages: [{ role: 'user', content: '请只回复连接正常。' }], max_tokens: 128, thinking: { type: 'disabled' }, stream: false }), signal: AbortSignal.timeout(30000) });
    result.completionHttpStatus = reply.status;
    const answer = reply.ok ? await reply.json() as { choices?: { message?: { content?: string } }[] } : undefined;
    result.completionTextPresent = Boolean(answer?.choices?.[0]?.message?.content);
    result.success = reply.ok && result.completionTextPresent;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    result.error = safeErrors.has(code) ? code : 'verification_failed';
  } finally {
    if (db) await new Promise<void>(resolve => db!.close(() => resolve()));
    result.observedAt = new Date().toISOString();
    fs.writeFileSync(path.join(job.output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}
