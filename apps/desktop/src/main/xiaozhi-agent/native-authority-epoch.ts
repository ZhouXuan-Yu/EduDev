import type { SessionManager } from '@earendil-works/pi-coding-agent';

export type NativeAuthorityManager = Pick<SessionManager, 'getBranch' | 'getEntries' | 'getEntry' | 'getLeafId' | 'branch' | 'appendCustomEntry' | 'buildSessionContext'>;
const RUN = 'xiaozhi.memory.run.v1';
const prefixes = ['xiaozhi.memory.', 'xiaozhi.skills.'];
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validAuthority = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)));
const validRunIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 4096 && value.every(validId) && new Set(value).size === value.length;

/** Validate both namespaces before any native migration or branch mutation. */
export function validateNativeAuthorityEntries(manager: NativeAuthorityManager) {
  // Unknown metadata must not become permission merely because it is off the current branch.
  for (const entry of manager.getEntries()) {
    if (entry.type !== 'custom' || !prefixes.some(candidate => entry.customType.startsWith(candidate))) continue;
    const data = entry.data;
    const valid = entry.customType === RUN ? exact(data, ['runId']) && validId(data.runId)
      : prefixes.some(candidate => entry.customType === `${candidate}taint.v1`) ? exact(data, ['authority', 'safeLeaf', 'runId']) && validAuthority(data.authority) && validId(data.safeLeaf) && validId(data.runId)
      : prefixes.some(candidate => entry.customType === `${candidate}isolation.v1`) && exact(data, ['authority', 'fromLeaf', 'blockedRunIds']) && validAuthority(data.authority) && validId(data.fromLeaf) && validRunIds(data.blockedRunIds);
    if (!valid) throw new Error('configuration');
  }
  const branch = manager.getBranch();
  for (let index = 0; index < branch.length; index++) {
    const entry = branch[index];
    if (entry.type !== 'custom' || !prefixes.some(candidate => entry.customType === `${candidate}taint.v1`)) continue;
    const data = entry.data as { safeLeaf: string; runId: string };
    const safeIndex = branch.findIndex(item => item.id === data.safeLeaf);
    const start = branch[safeIndex + 1];
    if (safeIndex < 0 || safeIndex >= index || start?.type !== 'custom' || start.customType !== RUN
      || (start.data as { runId: string }).runId !== data.runId) throw new Error('configuration');
  }
}

/** Private native branch bookkeeping. No summaries, model text or second history store. */
export function createPiAuthorityEpoch(manager: NativeAuthorityManager, authority: string, namespace: 'memory' | 'skills') {
  const prefix = `xiaozhi.${namespace}.`, TAINT = `${prefix}taint.v1`, ISOLATION = `${prefix}isolation.v1`;
  if (!validAuthority(authority)) throw new Error('configuration');
  validateNativeAuthorityEntries(manager);
  const branch = manager.getBranch(), blocked = new Set<string>();
  for (const entry of branch) if (entry.type === 'custom' && prefixes.some(candidate => entry.customType === `${candidate}isolation.v1`)) {
    for (const id of (entry.data as { blockedRunIds: string[] }).blockedRunIds) blocked.add(id);
  }
  const taintIndex = branch.findIndex(entry => entry.type === 'custom' && entry.customType === TAINT && (entry.data as { authority: string }).authority !== authority);
  let isolated = false;
  let isolationReason: 'memory_authority' | 'skill_authority' | 'interrupted_tool' | undefined;
  if (taintIndex >= 0) {
    const entry = branch[taintIndex];
    if (entry.type !== 'custom') throw new Error('configuration');
    const data = entry.data as { safeLeaf: string; runId: string };
    const safeIndex = branch.findIndex(item => item.id === data.safeLeaf);
    if (safeIndex < 0 || safeIndex >= taintIndex) throw new Error('configuration');
    // A safe anchor cannot itself retain earlier deliveries under another authority.
    if (branch.slice(0, safeIndex + 1).some(item => item.type === 'custom' && item.customType === TAINT
      && (item.data as { authority: string }).authority !== authority)) throw new Error('configuration');
    blocked.add(data.runId);
    for (const item of branch.slice(safeIndex + 1)) if (item.type === 'custom' && item.customType === RUN) blocked.add((item.data as { runId: string }).runId);
    if (blocked.size > 4096) throw new Error('configuration');
    const fromLeaf = manager.getLeafId();
    if (!fromLeaf || !manager.getEntry(data.safeLeaf)) throw new Error('configuration');
    manager.branch(data.safeLeaf);
    // Appending makes the leaf durable without carrying a branch summary of revoked text.
    manager.appendCustomEntry(ISOLATION, { authority, fromLeaf, blockedRunIds: [...blocked] });
    isolated = true;
    isolationReason = namespace === 'memory' ? 'memory_authority' : 'skill_authority';
  }
  // A crashed native tool turn has no result to replay. Recover only a host-marked
  // run boundary; legacy or malformed unpaired calls remain closed.
  const currentBranch = manager.getBranch(), pending = new Map<string, number>();
  for (let index = 0; index < currentBranch.length; index++) {
    const entry = currentBranch[index];
    if (entry.type !== 'message') continue;
    if (entry.message.role === 'assistant') for (const part of entry.message.content) if (part.type === 'toolCall') pending.set(part.id, index);
    if (entry.message.role === 'toolResult') pending.delete(entry.message.toolCallId);
  }
  if (pending.size) {
    const first = Math.min(...pending.values());
    let startIndex = -1;
    for (let index = 0; index < first; index++) if (currentBranch[index].type === 'custom' && (currentBranch[index] as { customType?: string }).customType === RUN) startIndex = index;
    const start = currentBranch[startIndex], safeLeaf = start?.parentId;
    if (startIndex < 0 || !safeLeaf || !currentBranch.slice(0, startIndex).some(entry => entry.id === safeLeaf)) throw new Error('configuration');
    for (const entry of currentBranch.slice(startIndex)) if (entry.type === 'custom' && entry.customType === RUN) blocked.add((entry.data as { runId: string }).runId);
    if (blocked.size > 4096) throw new Error('configuration');
    const fromLeaf = manager.getLeafId();
    if (!fromLeaf) throw new Error('configuration');
    manager.branch(safeLeaf);
    manager.appendCustomEntry(ISOLATION, { authority, fromLeaf, blockedRunIds: [...blocked] });
    isolated = true;
    isolationReason = 'interrupted_tool';
  }
  let run: { id: string; safeLeaf: string } | undefined;
  return {
    isolated,
    isolationReason,
    blockedRunIds: () => [...blocked],
    hasDelivery: () => manager.getBranch().some(entry => entry.type === 'custom' && entry.customType === TAINT),
    check(currentAuthority: string) {
      if (!validAuthority(currentAuthority)) throw new Error('configuration');
      if (currentAuthority !== authority) throw new Error(namespace === 'memory' ? 'memory_scope_changed' : 'skill_scope_changed');
    },
    beginRun(runId: string, reuseSharedBoundary = false) {
      if (!validId(runId) || run) throw new Error('configuration');
      const leaf = manager.getLeafId(), shared = leaf ? manager.getEntry(leaf) : undefined;
      if (reuseSharedBoundary && (shared?.type !== 'custom' || shared.customType !== RUN || (shared.data as { runId: string }).runId !== runId)) throw new Error('configuration');
      const safeLeaf = reuseSharedBoundary ? shared?.parentId : leaf;
      if (!safeLeaf) throw new Error('configuration');
      const pendingCalls = new Set<string>();
      for (const message of manager.buildSessionContext().messages) {
        if (message.role === 'assistant') for (const part of message.content) if (part.type === 'toolCall') pendingCalls.add(part.id);
        if (message.role === 'toolResult') pendingCalls.delete(message.toolCallId);
      }
      if (pendingCalls.size) throw new Error('configuration');
      run = { id: runId, safeLeaf };
      if (!reuseSharedBoundary) manager.appendCustomEntry(RUN, { runId });
    },
    beforeDelivery() {
      if (!run) throw new Error('configuration');
      if (manager.getBranch().some(entry => entry.type === 'custom' && entry.customType === TAINT)) return;
      const branchNow = manager.getBranch();
      if (!branchNow.some(entry => entry.id === run!.safeLeaf)) throw new Error('configuration');
      manager.appendCustomEntry(TAINT, { authority, safeLeaf: run.safeLeaf, runId: run.id });
    },
    endRun() { run = undefined; },
  };
}
