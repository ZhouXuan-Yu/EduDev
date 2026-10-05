import type { OmniEduStore } from '../db';
import {queryDeepSeekBalance} from './vendor/pi-packages/usage-query.js';
import packageManifest from './vendor/pi-packages/source-manifest.json' with {type:'json'};
import type {XiaozhiProviderBalance} from '../../shared/xiaozhi-settings';
import type { XiaozhiModelCapabilities } from '../../shared/xiaozhi-agent';
import { fetchDeepSeekCatalogue, readDeepSeekCatalogue } from './model-capabilities';
import { XIAOZHI_SETTINGS_SCHEMA, type XiaozhiSettingsInput, type XiaozhiSettingsView, type XiaozhiSessionModelInput, type XiaozhiSessionModel, type XiaozhiCredentialInput, type XiaozhiCredentialView } from '../../shared/xiaozhi-settings';

// The codec is injected by Electron main; this service never imports it in Node/Worker.
export type SettingsKeyCodec = { available: () => boolean; seal: (key: string) => string; open: (sealed: string) => string };
const modelId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER;
export const validSessionId = (id: unknown): id is string => typeof id === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(id);
const exact = (value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && required.every(key => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)));
export function validSettingsInput(value: unknown): value is XiaozhiSettingsInput {
  return exact(value, ['schemaVersion','version','defaultModel'], ['apiKey']) && value.schemaVersion === XIAOZHI_SETTINGS_SCHEMA && revision(value.version) && modelId(value.defaultModel)
    && (value.apiKey === undefined || typeof value.apiKey === 'string' && value.apiKey.length<=4096 && /^[\x21-\x7e]{8,4096}$/.test(value.apiKey.trim()));
}
export function validCredentialInput(value:unknown):value is XiaozhiCredentialInput {
  return exact(value,['schemaVersion','apiKey'])&&value.schemaVersion===XIAOZHI_SETTINGS_SCHEMA&&typeof value.apiKey==='string'&&value.apiKey.length<=4096&&/^[\x21-\x7e]{8,4096}$/.test(value.apiKey.trim());
}
export function validSessionModelInput(value: unknown): value is XiaozhiSessionModelInput {
  return exact(value, ['schemaVersion','sessionId','version','model']) && value.schemaVersion === XIAOZHI_SETTINGS_SCHEMA
    && validSessionId(value.sessionId) && revision(value.version) && modelId(value.model);
}
export function validSettingsQuery(value: unknown): value is { refresh?: boolean; sessionId?: string } | undefined {
  return value === undefined || exact(value, [], ['refresh','sessionId']) && (value.refresh === undefined || typeof value.refresh === 'boolean')
    && (value.sessionId === undefined || validSessionId(value.sessionId));
}
export function createModelSettings(options: { store: OmniEduStore; root: string; codec?: SettingsKeyCodec; busy: () => boolean; assertMutation?: () => void;
  switchBound?: (input:XiaozhiSessionModelInput,target:XiaozhiModelCapabilities) => Promise<void> }) {
  const { store, root, codec } = options;
  async function model(id?: string) {
    const saved = await store.xiaozhiState.modelSettings.configuration(), legacy = await store.getDeepSeekRuntimeSettings('deepseek');
    const binding = id ? await store.xiaozhiState.getBinding(id) : undefined;
    const selection = id ? await store.xiaozhiState.modelSettings.session(id) : undefined;
    return binding?.model || selection?.model || saved.defaultModel || (legacy.apiKey ? legacy.model : 'deepseek-flash');
  }
  async function runtime(id?: string) {
    const saved = await store.xiaozhiState.modelSettings.configuration();
    const legacy = await store.getDeepSeekRuntimeSettings('deepseek');
    let apiKey = legacy.apiKey;
    if (saved.sealedKey) {
      if (!codec?.available()) throw new Error('storage_unavailable');
      try { apiKey = codec.open(saved.sealedKey); } catch { throw new Error('configuration'); }
      if (!apiKey || apiKey.length > 4096) throw new Error('configuration');
    }
    const binding = id ? await store.xiaozhiState.getBinding(id) : undefined;
    const selection = id ? await store.xiaozhiState.modelSettings.session(id) : undefined;
    return { provider: 'deepseek' as const, apiKey, model: binding?.model || selection?.model || saved.defaultModel || (legacy.apiKey ? legacy.model : 'deepseek-flash') };
  }
  async function sessionModel(id: string, includeBusy = true): Promise<XiaozhiSessionModel> {
    const detail = await store.getAiConversationSession(id);
    if (detail.session.archivedAt) throw new Error('permission_denied');
    const selection = await store.xiaozhiState.modelSettings.session(id);
    const binding=await store.xiaozhiState.getBinding(id), ledger=await store.xiaozhiState.modelSwitch?.current(id);
    return { version: ledger?.revision ?? selection.revision, model: await model(id),
      locked: includeBusy && options.busy() || Boolean(binding) && !options.switchBound || !binding && detail.messages.length > 0 };
  }
  async function view(query?: { refresh?: boolean; sessionId?: string }): Promise<XiaozhiSettingsView> {
    const selection = query?.sessionId ? await sessionModel(query.sessionId) : undefined;
    const saved = await store.xiaozhiState.modelSettings.configuration();
    let settings: { model: string; apiKey?: string }, credentialError: XiaozhiSettingsView['credentialError'];
    try { settings = await runtime(); }
    catch (error) {
      // A readable configuration with an undecryptable credential is recoverable by
      // explicitly replacing the key. Never fall back to another credential for runs.
      if (!saved.sealedKey) throw error;
      credentialError = error instanceof Error && error.message === 'storage_unavailable' ? 'storage_unavailable' : 'configuration';
      settings = { model: await model() };
    }
    let catalogue = await readDeepSeekCatalogue(root);
    let catalogueError: XiaozhiSettingsView['catalogueError'];
    if (query?.refresh || !catalogue && settings.apiKey) {
      try { if (!settings.apiKey) throw new Error('authentication'); catalogue = await fetchDeepSeekCatalogue(root, settings.apiKey); }
      catch (error) { const code = error instanceof Error ? error.message : ''; catalogueError = ['authentication','transport','timeout'].includes(code) ? code as typeof catalogueError : 'configuration'; }
    }
    // No credential, encrypted blob, private path or provider response is projected.
    return { schemaVersion: XIAOZHI_SETTINGS_SCHEMA, version: saved.revision, provider: 'deepseek', configured: Boolean(settings.apiKey),
      maskedApiKey: settings.apiKey ? '••••••••' + settings.apiKey.slice(-4) : '', defaultModel: settings.model,
      web: await store.xiaozhiState.modelSettings.web(), locked: options.busy(), models: catalogue?.models || [], catalogue: catalogue ? catalogue.models[0].source : 'unavailable',
      packages:packageManifest.packages.map(item=>({name:item.name,version:item.version,label:item.name==='pi-web-access'?'联网资料定位':item.name==='pi-goal-x'?'长任务目标增强':'模型账户余额',state:item.name==='pi-goal-x'?'staged' as const:'active' as const,scope:item.name==='pi-web-access'?'已接入网页关键词定位；其他搜索供应商与视频能力待接入。':item.name==='pi-goal-x'?'已安装；现有目标功能继续使用，增强能力正在适配。':'已接入当前已保存DeepSeek账户的官方余额查询。'})),
      ...(catalogueError ? { catalogueError } : {}), ...(credentialError ? { credentialError } : {}), ...(selection ? { sessionModel: { ...selection, locked: selection.locked || options.busy() } } : {}) };
  }
  return {
    runtime, model, sessionModel, view,
    async balance(signal:AbortSignal):Promise<XiaozhiProviderBalance>{
      const saved=await store.xiaozhiState.modelSettings.configuration(),current=await runtime();
      if(!current.apiKey)throw new Error('authentication');
      const guard=async()=>{signal.throwIfAborted();if((await store.xiaozhiState.modelSettings.configuration()).revision!==saved.revision||(await runtime()).apiKey!==current.apiKey)throw new Error('conflict');};
      try{
        const report=await queryDeepSeekBalance(current.apiKey,signal,guard);await guard();
        const metric=(id:string)=>String(report.metrics.find(m=>m.id===id)?.value??'');
        return{provider:'deepseek',source:'official',engine:'@narumitw/pi-usage@0.62.0',observedAt:new Date(report.capturedAt).toISOString(),available:metric('api-availability')==='available',balances:(['CNY','USD'] as const).filter(currency=>metric(currency.toLowerCase()+'-total')!=='').map(currency=>({currency,total:metric(currency.toLowerCase()+'-total'),granted:metric(currency.toLowerCase()+'-granted'),toppedUp:metric(currency.toLowerCase()+'-topped-up')}))};
      }catch(error){const message=error instanceof Error?error.message:'';throw new Error(message==='conflict'?'conflict':/\b(401|403)\b/.test(message)?'authentication':/timed out|timeout/i.test(message)?'timeout':signal.aborted?'busy':'transport');}
    },
    async verify(input:XiaozhiCredentialInput):Promise<XiaozhiCredentialView> {
      const catalogue=await fetchDeepSeekCatalogue(root,input.apiKey.trim());
      options.assertMutation?.();
      return {schemaVersion:XIAOZHI_SETTINGS_SCHEMA,provider:'deepseek',models:catalogue.models};
    },
    async save(input: XiaozhiSettingsInput) {
      const previous = await store.xiaozhiState.modelSettings.configuration();
      if (previous.revision !== input.version) throw new Error('conflict');
      const key = input.apiKey?.trim() || (await runtime()).apiKey;
      if (!key) throw new Error('authentication');
      if (input.apiKey && !codec?.available()) throw new Error('storage_unavailable');
      const catalogue = await fetchDeepSeekCatalogue(root, key);
      if (!catalogue.models.some(item => item.id === input.defaultModel)) throw new Error('model_unavailable');
      options.assertMutation?.();
      let sealedKey = previous.sealedKey;
      if (codec?.available()) { try { sealedKey = codec.seal(key); } catch { throw new Error('storage_unavailable'); } }
      await store.xiaozhiState.modelSettings.saveConfiguration(input.version, { schema: 1, defaultModel: input.defaultModel, ...(sealedKey ? { sealedKey } : {}) });
      return view();
    },
    async select(input: XiaozhiSessionModelInput) {
      const selection = await sessionModel(input.sessionId, false);
      if (selection.locked) throw new Error('busy');
      if (selection.version !== input.version) throw new Error('conflict');
      const { apiKey } = await runtime(); if (!apiKey) throw new Error('authentication');
      const catalogue = await fetchDeepSeekCatalogue(root, apiKey);
      const target=catalogue.models.find(item=>item.id===input.model); if (!target) throw new Error('model_unavailable');
      const detail = await store.getAiConversationSession(input.sessionId);
      if (detail.session.archivedAt) throw new Error('permission_denied');
      options.assertMutation?.();
      if (await store.xiaozhiState.getBinding(input.sessionId)) {
        if (!options.switchBound) throw new Error('busy');
        await options.switchBound(input,target);
        return sessionModel(input.sessionId,false);
      }
      if (detail.messages.length) throw new Error('busy');
      await store.xiaozhiState.modelSettings.saveSession(input.sessionId, input.version, input.model);
      return sessionModel(input.sessionId, false);
    },
  };
}
