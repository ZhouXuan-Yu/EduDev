import { createHash } from 'node:crypto';
import { createPiAuthorityEpoch, validateNativeAuthorityEntries, type NativeAuthorityManager } from './native-authority-epoch';
import { LEGACY_EDUCATION_SKILLS, legacySkillDocument } from './education-skills-legacy-v1';
import { SKILL_LIMITS, validSkillName, exactSkillObject } from './skill-catalog-state';

export type SkillAuthorityIdentity = { name: string; sha256: string };
export const skillAuthority = (identity: readonly SkillAuthorityIdentity[]) => createHash('sha256')
  .update(JSON.stringify([...identity].sort((a, b) => a.name.localeCompare(b.name)))).digest('hex');
function validIdentity(value: unknown): value is SkillAuthorityIdentity[] {
  return Array.isArray(value) && value.length <= SKILL_LIMITS.skills && value.every(item => exactSkillObject(item, ['name', 'sha256'])
    && validSkillName(item.name) && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256))
    && new Set(value.map(item => item.name)).size === value.length;
}
export const legacySkillIdentity = () => LEGACY_EDUCATION_SKILLS.map(item => ({ name: item.name, sha256: createHash('sha256').update(legacySkillDocument(item)).digest('hex') }));
/** Upgrade only provable main-run boundaries; no inferred model history or summaries. */
export function createPiSkillEpoch(manager: NativeAuthorityManager, identity: SkillAuthorityIdentity[]) {
  if (!validIdentity(identity)) throw new Error('configuration');
  validateNativeAuthorityEntries(manager);
  const authority = skillAuthority(identity), snapshots = manager.getEntries().filter(entry => entry.type === 'custom' && entry.customType.startsWith('xiaozhi.education.skills.'));
  for (const entry of snapshots) {
    if (entry.type !== 'custom') throw new Error('configuration');
    const data = entry.data;
    if (entry.customType === 'xiaozhi.education.skills.v1') {
      if (JSON.stringify(data) !== JSON.stringify({ version: 1, identity: legacySkillIdentity() })) throw new Error('configuration');
    } else if (entry.customType !== 'xiaozhi.education.skills.v2' || !exactSkillObject(data, ['version', 'authority', 'identity'])
      || data.version !== 2 || !validIdentity(data.identity) || data.authority !== skillAuthority(data.identity)) throw new Error('configuration');
  }
  const branch = manager.getBranch(), oldIndex = branch.findIndex(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.education.skills.v1');
  if (oldIndex >= 0 && !branch.some(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.education.skills.v2')
    && !branch.some(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.skills.taint.v1')) {
    const firstRun = branch.slice(oldIndex + 1).find(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.memory.run.v1');
    const hasMessages = branch.slice(oldIndex + 1).some(entry => entry.type === 'message' || entry.type === 'compaction' || entry.type === 'branch_summary');
    if (hasMessages && (!firstRun || !firstRun.parentId || firstRun.type !== 'custom'
      || !exactSkillObject(firstRun.data, ['runId']) || typeof firstRun.data.runId !== 'string'
      || !branch.slice(0, branch.indexOf(firstRun)).some(entry => entry.id === firstRun.parentId))) throw new Error('configuration');
    if (hasMessages && firstRun && branch.slice(oldIndex + 1, branch.indexOf(firstRun)).some(entry => entry.type === 'message' || entry.type === 'compaction' || entry.type === 'branch_summary')) throw new Error('configuration');
    if (firstRun && firstRun.type === 'custom' && firstRun.parentId) manager.appendCustomEntry('xiaozhi.skills.taint.v1', {
      authority: skillAuthority(legacySkillIdentity()), safeLeaf: firstRun.parentId, runId: (firstRun.data as { runId: string }).runId,
    });
  }
  const epoch = createPiAuthorityEpoch(manager, authority, 'skills');
  const latest = [...manager.getBranch()].reverse().find(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.education.skills.v2');
  if (latest?.type !== 'custom' || (latest.data as { authority: string }).authority !== authority) manager.appendCustomEntry('xiaozhi.education.skills.v2', { version: 2, authority, identity: [...identity].sort((a, b) => a.name.localeCompare(b.name)) });
  return { ...epoch, authority, isolationReason: epoch.isolationReason as 'skill_authority' | 'interrupted_tool' | undefined };
}
