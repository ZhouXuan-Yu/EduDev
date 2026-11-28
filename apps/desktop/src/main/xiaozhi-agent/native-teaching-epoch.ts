import { createHash } from 'node:crypto';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { validateNativeAuthorityEntries, type NativeAuthorityManager } from './native-authority-epoch';

const RUN = 'xiaozhi.memory.run.v1';
const TARGET = 'xiaozhi.teaching.target.v1';
export const TEACHING_DEPARTURE = 'xiaozhi.teaching.departure.v1';
export const TEACHING_ISOLATION = 'xiaozhi.teaching.isolation.v1';
const isContext = (entry: SessionEntry) => ['message', 'custom_message', 'branch_summary', 'compaction'].includes(entry.type);
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

type TargetStamp = { authority: string; scoped: boolean };
type TargetEntry = TargetStamp & { safeLeaf: string };
type IsolationEntry = TargetEntry & { fromLeaf: string; blockedRunIds: string[] };
export const teachingAuthority = (folderId: string | undefined, term: string | undefined): TargetStamp => ({
  authority: createHash('sha256').update(JSON.stringify([folderId ?? null, term ?? null])).digest('hex'),
  scoped: Boolean(term),
});

export function validTeachingDeparture(value: unknown): value is TargetEntry {
  if (!value || typeof value !== 'object') return false;
  const data = value as TargetEntry;
  return Object.keys(value).length === 3 && hash(data.authority) && id(data.safeLeaf) && typeof data.scoped === 'boolean';
}

export function validTeachingIsolation(value: unknown): value is IsolationEntry {
  if (!value || typeof value !== 'object') return false;
  const data = value as IsolationEntry;
  return Object.keys(value).length === 5 && hash(data.authority) && id(data.safeLeaf) && typeof data.scoped === 'boolean'
    && id(data.fromLeaf) && Array.isArray(data.blockedRunIds) && data.blockedRunIds.length <= 4096
    && data.blockedRunIds.every(id) && new Set(data.blockedRunIds).size === data.blockedRunIds.length;
}

/** Seal native model history at a confirmed teaching-space change. Original entries
 * stay in Pi, including summaries and tool results that predate memory delivery. */
export function createPiTeachingEpoch(manager: NativeAuthorityManager, target: TargetStamp) {
  validateNativeAuthorityEntries(manager);
  for (const entry of manager.getEntries()) {
    if (entry.type !== 'custom' || !entry.customType.startsWith('xiaozhi.teaching.')) continue;
    if (entry.customType === TEACHING_ISOLATION) {
      if (!validTeachingIsolation(entry.data) || entry.parentId !== entry.data.safeLeaf) throw Error('configuration');
      const departure = manager.getEntry(entry.data.fromLeaf);
      if (departure?.type !== 'custom' || departure.customType !== TEACHING_DEPARTURE || !validTeachingDeparture(departure.data)
        || departure.data.authority !== entry.data.authority || departure.data.scoped !== entry.data.scoped
        || departure.data.safeLeaf !== entry.data.safeLeaf) throw Error('configuration');
    } else if (![TARGET, TEACHING_DEPARTURE].includes(entry.customType) || !validTeachingDeparture(entry.data)) {
      throw Error('configuration');
    }
  }
  const branch = manager.getBranch();
  const stamp = branch.findLast(entry => entry.type === 'custom' && [TARGET, TEACHING_ISOLATION].includes(entry.customType));
  const prior = stamp?.type === 'custom' ? stamp.data as TargetEntry : undefined;
  const first = branch.findIndex(entry => isContext(entry) || entry.type === 'custom' && entry.customType === RUN);
  const legacyContext = branch.some(isContext);
  const safeLeaf = prior?.safeLeaf ?? (first >= 0 ? branch[first].parentId : manager.getLeafId());
  const safeIndex = branch.findIndex(entry => entry.id === safeLeaf);
  if (!safeLeaf || safeIndex < 0 || branch.slice(0, safeIndex + 1).some(isContext)) throw Error('configuration');

  const isolated = prior ? prior.authority !== target.authority : target.scoped && legacyContext;
  const alreadySealed = stamp?.type === 'custom' && stamp.customType === TEACHING_ISOLATION;
  const blocked = new Set<string>();
  if (isolated) {
    for (const entry of branch.slice(safeIndex + 1)) {
      if (entry.type !== 'custom') continue;
      if (entry.customType === RUN) blocked.add((entry.data as { runId: string }).runId);
      if (entry.customType.endsWith('.isolation.v1') && /^xiaozhi\.(teaching|skills|memory)\./.test(entry.customType)) {
        for (const runId of (entry.data as IsolationEntry).blockedRunIds) blocked.add(runId);
      }
    }
    if (blocked.size > 4096) throw Error('configuration');
    const fromLeaf = manager.appendCustomEntry(TEACHING_DEPARTURE, { ...target, safeLeaf });
    manager.branch(safeLeaf);
    manager.appendCustomEntry(TEACHING_ISOLATION, { ...target, safeLeaf, fromLeaf, blockedRunIds: [...blocked] });
  } else if (!stamp) {
    manager.appendCustomEntry(TARGET, { ...target, safeLeaf });
  }

  // SQLite records without proof of membership may still exist in a legacy or
  // detached branch. Keep this gate independent of the usual Task-anchor override.
  const allowedRuns = target.scoped || isolated || alreadySealed
    ? () => new Set(manager.getBranch().flatMap(entry => entry.type === 'custom' && entry.customType === RUN
      ? [(entry.data as { runId: string }).runId] : []))
    : undefined;
  return { isolated, excludedRuns: blocked.size, allowedRuns };
}
