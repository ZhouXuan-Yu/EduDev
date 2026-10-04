import fs from 'node:fs';
import path from 'node:path';
import type { AgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { assertHanaModelSwitchContext } from './vendor/hana/core/model-switch-context';
import { validateNativeAuthorityEntries } from './native-authority-epoch';
import { validModelIdentity, type createModelSwitchState, type ModelIdentity, type ModelTransition } from './model-switch-state';

const PROVIDER = 'xiaozhi_deepseek';
const INTENT = 'xiaozhi.model-switch.intent.v1', RECEIPT = 'xiaozhi.model-switch.commit.v1';
const RESTORE = 'xiaozhi.model-restore.intent.v1', RESTORED = 'xiaozhi.model-restore.commit.v1';
type State = ReturnType<typeof createModelSwitchState>;
type Entry = ReturnType<SessionManager['getEntries']>[number];
const same = (a: unknown, b: Record<string, unknown>) => Boolean(a && typeof a === 'object' && !Array.isArray(a)
  && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([key,value]) => (a as Record<string, unknown>)[key] === value));
function data(value: ModelTransition) {
  return { schema: 1, id: value.id, conversationId: value.sessionId, revision: value.revision,
    origin: value.originModel, source: value.model, target: value.target, nativeSessionId: value.nativeSessionId };
}
function assertIdentity(manager: SessionManager, value: ModelIdentity, root: string) {
  if (!validModelIdentity(value) || !path.isAbsolute(root) || manager.getSessionId() !== value.nativeSessionId) throw new Error('configuration');
  const owned = fs.realpathSync(root), relativeFile = value.sessionFile.replace(/\\/g,'/'), expected = path.resolve(owned, ...relativeFile.split('/'));
  const file = manager.getSessionFile();
  if (!file || !fs.statSync(file).isFile() || path.resolve(file).toLowerCase() !== expected.toLowerCase()) throw new Error('configuration');
  const relative = path.relative(owned, fs.realpathSync(file));
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.replace(/\\/g,'/').toLowerCase() !== relativeFile.toLowerCase()) throw new Error('configuration');
  // Pi's loader tolerates damaged lines. A durable identity mutation must not
  // adopt an incomplete file or a stale cached manager, even if its model matches.
  if (fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('configuration');
  let rows: Record<string, unknown>[];
  try { rows = fs.readFileSync(file,'utf8').trimEnd().split('\n').map(line => JSON.parse(line)); }
  catch { throw new Error('configuration'); }
  const header = rows.shift();
  if (header?.type !== 'session' || header.version !== 3 || JSON.stringify(header) !== JSON.stringify(manager.getHeader())
    || JSON.stringify(rows) !== JSON.stringify(manager.getEntries())) throw new Error('configuration');
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || !/^[a-f0-9]{8}$/i.test(row.id) || seen.has(row.id)
      || row.parentId !== null && (typeof row.parentId !== 'string' || !seen.has(row.parentId))) throw new Error('configuration');
    seen.add(row.id);
  }
}
/** Exact ancestry proof. Never infer a committed switch from a matching model string. */
function proof(manager: SessionManager, value: ModelTransition): { intent: Entry; change: Extract<Entry,{ type: 'model_change' }> | null; receipt: Entry | null } | null {
  const all = manager.getEntries();
  const matches = (kind: string) => all.filter(entry => entry.type === 'custom' && entry.customType === kind
    && (entry.data as Record<string, unknown> | undefined)?.id === value.id);
  const intents = matches(INTENT), receipts = matches(RECEIPT);
  if (intents.length > 1 || receipts.length > 1 || receipts.length && !intents.length) throw new Error('configuration');
  const intent = intents[0], receipt = receipts[0];
  if (!intent) {
    if (value.status === 'committed') throw new Error('configuration');
    return null;
  }
  if (intent.type !== 'custom' || !same(intent.data, data(value))) throw new Error('configuration');
  if (value.status === 'aborted') {
    if (receipt) throw new Error('configuration');
    // Later turns/switches can follow an aborted pre-native intent. Their model
    // entries still need their own exact durable receipts in the global audit.
    return { intent, change: null, receipt: null };
  }
  const branch = manager.getBranch(receipt?.id);
  const index = branch.findIndex(entry => entry.id === intent.id);
  if (index < 0) throw new Error('configuration');
  const tail = branch.slice(index + 1, receipt ? branch.length - 1 : undefined);
  // Idle mutation cannot contain a reply, compaction, tool or authority epoch.
  if (tail.some(entry => entry.type !== 'model_change' && entry.type !== 'thinking_level_change')) throw new Error('configuration');
  const changes = tail.filter(entry => entry.type === 'model_change');
  if (changes.length > 1) throw new Error('configuration');
  const change = changes[0];
  if (!change) {
    if (receipt || value.status === 'committed') throw new Error('configuration');
    return { intent, change: null, receipt: null };
  }
  if (change.type !== 'model_change' || change.provider !== PROVIDER || change.modelId !== value.target) throw new Error('configuration');
  if (receipt && (receipt.type !== 'custom' || !same(receipt.data, { ...data(value), modelEntryId: change.id }))) throw new Error('configuration');
  if (value.status === 'committed' && (value.modelEntryId !== change.id || value.receiptEntryId !== receipt?.id)) throw new Error('configuration');
  return { intent, change, receipt };
}
function isolation(manager: SessionManager, leaf?: string) {
  const branch = manager.getBranch(leaf);
  const anchor = [...branch].reverse().find(entry => entry.type === 'custom' && ['xiaozhi.memory.isolation.v1','xiaozhi.skills.isolation.v1'].includes(entry.customType));
  if (!anchor) return null;
  const tail = branch.slice(branch.indexOf(anchor)+1);
  if (tail.some(entry => !['custom','thinking_level_change','model_change'].includes(entry.type))) throw new Error('configuration');
  return anchor;
}
function verifiedIsolation(manager: SessionManager, authorities: { memory?: string; skills?: string }) {
  const anchor=isolation(manager); if (!anchor || anchor.type!=='custom') throw new Error('configuration');
  const namespace=anchor.customType==='xiaozhi.memory.isolation.v1'?'memory':'skills';
  if (!authorities[namespace] || manager.getBranch().some(entry=>entry.type==='custom' && ['xiaozhi.memory.taint.v1','xiaozhi.skills.taint.v1'].includes(entry.customType)
    && (entry.data as {authority:string}).authority!==authorities[entry.customType==='xiaozhi.memory.taint.v1'?'memory':'skills'])) throw new Error('configuration');
  return anchor;
}
function restores(manager: SessionManager, current: ModelIdentity, rows: ModelTransition[], allowed: Set<string>) {
  validateNativeAuthorityEntries(manager);
  const entries=manager.getEntries(), base=current.revision-rows.filter(row=>row.status==='committed').length;
  const models=new Map<number,string>([[base,current.originModel]]);
  for (const row of rows.filter(row=>row.status==='committed')) models.set(row.revision+1,row.target);
  const knownReceipts=new Set<string>();
  const pending: { intent: Entry; data: Record<string,unknown>; change: Extract<Entry,{type:'model_change'}> | null }[]=[];
  for (const entry of entries.filter(item=>item.type==='custom' && item.customType.startsWith('xiaozhi.model-restore.'))) {
    if (entry.type!=='custom' || ![RESTORE,RESTORED].includes(entry.customType)) throw new Error('configuration');
    if (entry.customType!==RESTORE) continue;
    const value=entry.data as Record<string,unknown>;
    if (!value || !Number.isSafeInteger(value.revision) || models.get(Number(value.revision))!==value.model
      || !same(value,{schema:1,revision:value.revision,model:value.model,nativeSessionId:current.nativeSessionId,isolationId:value.isolationId})) throw new Error('configuration');
    const receipts=entries.filter(item=>item.type==='custom' && item.customType===RESTORED && (item.data as Record<string,unknown> | undefined)?.intentEntryId===entry.id);
    if (receipts.length>1) throw new Error('configuration');
    const receipt=receipts[0], anchor=isolation(manager,receipt?.id);
    if (!anchor || anchor.id!==value.isolationId) throw new Error('configuration');
    const branch=manager.getBranch(receipt?.id), index=branch.findIndex(item=>item.id===entry.id);
    if (index<0) throw new Error('configuration');
    const tail=branch.slice(index+1,receipt?branch.length-1:undefined);
    if (tail.some(item=>item.type!=='model_change' && item.type!=='thinking_level_change')) throw new Error('configuration');
    const changes=tail.filter(item=>item.type==='model_change');
    if (changes.length>1) throw new Error('configuration');
    const change=changes[0] || null;
    if (change && (change.provider!==PROVIDER || change.modelId!==value.model)) throw new Error('configuration');
    if (receipt) {
      if (!change || receipt.type!=='custom' || !same(receipt.data,{...value,intentEntryId:entry.id,modelEntryId:change.id})) throw new Error('configuration');
      knownReceipts.add(receipt.id);
    } else {
      if (value.revision!==current.revision || value.model!==current.model) throw new Error('configuration');
      pending.push({intent:entry,data:value,change});
    }
    if (change) allowed.add(change.id);
  }
  if (pending.length>1 || entries.some(entry=>entry.type==='custom' && entry.customType===RESTORED && !knownReceipts.has(entry.id))) throw new Error('configuration');
  return pending[0];
}
function audit(manager: SessionManager, current: ModelIdentity, rows: ModelTransition[], allowIsolation=false, baseline: string[] = []) {
  const allowed = new Set<string>();
  const committed = rows.filter(row => row.status === 'committed');
  let expectedModel = current.originModel, expectedRevision = current.revision - committed.length;
  if (expectedRevision < 0) throw new Error('configuration');
  for (const row of committed) {
    if (row.originModel !== current.originModel || row.model !== expectedModel || row.revision !== expectedRevision
      || row.sessionFile !== current.sessionFile || row.nativeSessionId !== current.nativeSessionId) throw new Error('configuration');
    const native = proof(manager,row);
    if (!native?.change || !native.receipt) throw new Error('configuration');
    allowed.add(native.change.id); expectedModel = row.target; expectedRevision++;
  }
  if (expectedModel !== current.model || expectedRevision !== current.revision) throw new Error('configuration');
  const pending = rows.filter(row => row.status === 'prepared');
  if (pending.length > 1) throw new Error('configuration');
  for (const row of rows.filter(row => row.status !== 'committed')) {
    if (row.sessionFile !== current.sessionFile || row.nativeSessionId !== current.nativeSessionId || row.originModel !== current.originModel) throw new Error('configuration');
    if (row.status === 'prepared' && (row.revision !== current.revision || row.model !== current.model)) throw new Error('configuration');
    const native = proof(manager,row); if (native?.change) allowed.add(native.change.id);
  }
  const entries = manager.getEntries(), changes = entries.filter(entry => entry.type === 'model_change');
  restores(manager,current,rows,allowed);
  const first = changes[0];
  if (!first || first.type !== 'model_change' || first.provider !== PROVIDER || first.modelId !== current.originModel) throw new Error('configuration');
  allowed.add(first.id);
  for (const id of baseline) {
    const entry=manager.getEntry(id);
    if (!entry || entry.type!=='model_change' || entry.provider!==PROVIDER || entry.modelId!==current.originModel) throw new Error('configuration');
    allowed.add(id);
  }
  if (changes.some(entry => !allowed.has(entry.id))) throw new Error('configuration');
  const known = new Set(rows.map(row => row.id));
  if (entries.some(entry => entry.type === 'custom' && [INTENT,RECEIPT].includes(entry.customType)
    && !known.has(String((entry.data as Record<string, unknown> | undefined)?.id)))) throw new Error('configuration');
  const branchModel = manager.getBranch().filter(entry => entry.type === 'model_change').at(-1);
  const pendingNative = pending[0] ? proof(manager,pending[0]) : undefined;
  const expected = pendingNative?.change ? pending[0].target : current.model;
  if (!branchModel || branchModel.type !== 'model_change' || branchModel.provider !== PROVIDER || branchModel.modelId !== expected) {
    if (!allowIsolation || pending.length || !isolation(manager)) throw new Error('configuration');
  }
  return pending[0];
}
export type ModelSwitchStage = 'prepared' | 'intent' | 'native' | 'receipt' | 'committed';
/** Main-only seam. B1 has no IPC exposure; B2 must own host lock and origin identity admission. */
export function createNativeModelSwitch(options: { state: State; root: string;
  assertIdle: () => void; assertAuthorized: (id: string) => Promise<void>;
  afterStage?: (stage: ModelSwitchStage) => Promise<void> }) {
  async function recover(manager: SessionManager, sessionId: string, allowIsolation=false) {
    options.assertIdle();
    const current = await options.state.current(sessionId);
    if (!current) throw new Error('configuration');
    assertIdentity(manager,current,options.root);
    const rows=await options.state.transitions(sessionId);
    const pending = audit(manager,current,rows,allowIsolation,await options.state.baseline(sessionId));
    const restore=restores(manager,current,rows,new Set());
    if (restore?.change) {
      await options.assertAuthorized(sessionId); options.assertIdle(); assertIdentity(manager,current,options.root);
      manager.appendCustomEntry(RESTORED,{...restore.data,intentEntryId:restore.intent.id,modelEntryId:restore.change.id});
    }
    if (!pending) return current;
    await options.assertAuthorized(sessionId); options.assertIdle();
    assertIdentity(manager,current,options.root);
    const native = proof(manager,pending);
    if (!native?.change) {
      await options.state.abort(pending);
      return current;
    }
    const receipt = native.receipt || manager.getEntry(manager.appendCustomEntry(RECEIPT, { ...data(pending), modelEntryId: native.change.id }));
    if (!receipt) throw new Error('configuration');
    await options.state.commit(pending,native.change.id,receipt.id);
    const next = await options.state.current(sessionId); if (!next) throw new Error('configuration');
    return next;
  }
  return {
    recover,
    authorize: (manager: SessionManager,id: string) => recover(manager,id,true),
    async beforeAuthorityLoad(manager: SessionManager,current: ModelIdentity,authorities: {memory?:string;skills?:string}) {
      options.assertIdle(); assertIdentity(manager,current,options.root);
      const rows=await options.state.transitions(current.sessionId);
      audit(manager,current,rows,true,await options.state.baseline(current.sessionId));
      if (manager.buildSessionContext().messages.length || restores(manager,current,rows,new Set())) return;
      const anchor=verifiedIsolation(manager,authorities);
      await options.assertAuthorized(current.sessionId); options.assertIdle(); assertIdentity(manager,current,options.root);
      manager.appendCustomEntry(RESTORE,{schema:1,revision:current.revision,model:current.model,nativeSessionId:current.nativeSessionId,isolationId:anchor.id});
    },
    async initialize(manager: SessionManager,value: ModelIdentity, allowLegacyBootstrap=false) {
      options.assertIdle(); assertIdentity(manager,value,options.root);
      const changes=manager.getEntries().filter(entry=>entry.type==='model_change');
      if (!changes.length || !allowLegacyBootstrap && changes.length!==1 || changes.some(entry=>entry.provider!==PROVIDER || entry.modelId!==value.originModel)) throw new Error('configuration');
      await options.assertAuthorized(value.sessionId); options.assertIdle();
      const baseline=allowLegacyBootstrap ? changes.map(entry=>entry.id) : [];
      await options.state.seed(value,baseline); audit(manager,value,await options.state.transitions(value.sessionId),false,baseline);
      return value;
    },
    async alignAuthorityBranch(session: AgentSession, current: ModelIdentity, authorities: { memory?: string; skills?: string }) {
      options.assertIdle(); const manager=session.sessionManager; assertIdentity(manager,current,options.root);
      const rows=await options.state.transitions(current.sessionId), baseline=await options.state.baseline(current.sessionId); audit(manager,current,rows,true,baseline);
      let pending=restores(manager,current,rows,new Set());
      const last=manager.getBranch().filter(entry=>entry.type==='model_change').at(-1);
      if (!pending && last?.modelId===current.model && last.provider===PROVIDER) return;
      const anchor=verifiedIsolation(manager,authorities);
      await options.assertAuthorized(current.sessionId); options.assertIdle(); assertIdentity(manager,current,options.root);
      if (!pending) {
        const value={schema:1,revision:current.revision,model:current.model,nativeSessionId:current.nativeSessionId,isolationId:anchor.id};
        const intent=manager.getEntry(manager.appendCustomEntry(RESTORE,value)); if (!intent) throw new Error('configuration');
        pending={intent,data:value,change:null};
      }
      if (!pending.change) {
        if (session.model?.provider!==PROVIDER || session.model.id!==current.model) throw new Error('configuration');
        await session.setModel(session.model);
        pending=restores(manager,current,rows,new Set());
      }
      if (!pending?.change) throw new Error('configuration');
      manager.appendCustomEntry(RESTORED,{...pending.data,intentEntryId:pending.intent.id,modelEntryId:pending.change.id});
      audit(manager,current,rows,false,baseline);
    },
    async switch(session: AgentSession, expected: ModelIdentity, target: Parameters<AgentSession['setModel']>[0]) {
      options.assertIdle();
      if (session.isStreaming || session.isCompacting) throw new Error('busy');
      if (target.provider !== PROVIDER || !Number.isSafeInteger(target.contextWindow) || target.contextWindow <= 0) throw new Error('configuration');
      const manager = session.sessionManager, current = await recover(manager,expected.sessionId);
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('conflict');
      if (session.model?.provider !== PROVIDER || session.model.id !== current.model) throw new Error('configuration');
      if (target.id === current.model) return current;
      assertHanaModelSwitchContext(session,target);
      await options.assertAuthorized(current.sessionId); options.assertIdle();
      assertIdentity(manager,current,options.root);
      const intent = await options.state.prepare(current,target.id);
      await options.afterStage?.('prepared');
      assertIdentity(manager,current,options.root);
      manager.appendCustomEntry(INTENT,data(intent));
      await options.afterStage?.('intent');
      // Pi owns in-memory model, thinking normalization, model_change and extension event.
      await session.setModel(target);
      await options.afterStage?.('native');
      assertIdentity(manager,current,options.root);
      const native = proof(manager,intent); if (!native?.change) throw new Error('configuration');
      const receiptId = manager.appendCustomEntry(RECEIPT,{ ...data(intent), modelEntryId: native.change.id });
      await options.afterStage?.('receipt');
      await options.assertAuthorized(current.sessionId); options.assertIdle();
      assertIdentity(manager,current,options.root);
      await options.state.commit(intent,native.change.id,receiptId);
      await options.afterStage?.('committed');
      const next = await options.state.current(current.sessionId); if (!next) throw new Error('configuration');
      return next;
    },
  };
}
