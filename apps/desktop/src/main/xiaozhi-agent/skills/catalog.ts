import {createPiSkillCatalogState, SKILL_LIMITS, type PrivateManagedSkill} from '../skill-catalog-state';
import type {Sql} from '../session-state';
import type {SkillGovernanceState, SkillRecord, VersionRecord} from './state';
import {versionKey} from './state';

export async function canReadSkill(state: SkillGovernanceState, skill: SkillRecord, actorId: string, work = state.sql) {
  if (skill.scope === 'official') return true;
  if (skill.scope === 'personal') return skill.ownerId === actorId;
  const membership = await state.get('memberships', actorId, work);
  return Boolean(membership && !membership.revoked && membership.teamId === skill.teamId);
}
export async function activePackages(state: SkillGovernanceState, actorId: string, work = state.sql) {
  const selected: {skill: SkillRecord; version: VersionRecord}[] = [];
  for (const skill of await state.list('skills', work)) {
    if (!skill.activeVersion || !await canReadSkill(state, skill, actorId, work)) continue;
    const version = await state.get('versions', versionKey(skill.id, skill.activeVersion), work);
    if (!version || version.state !== 'published') continue;
    selected.push({skill, version});
  }
  return selected;
}
/** The original catalog remains an atomic compatibility projection of active versions. */
export async function commitSkillProjection(state: SkillGovernanceState, actorId: string, work: Sql) {
  const catalog = createPiSkillCatalogState(work);
  const current = await catalog.skillCatalog();
  const active = await activePackages(state, actorId, work);
  const packages: PrivateManagedSkill[] = active.map(({skill, version}) => ({
    ...version.package, enabled: skill.enabled, archived: skill.archived,
  }));
  if (packages.length > SKILL_LIMITS.skills) throw new Error('invalid_input');
  if (JSON.stringify(current.skills) === JSON.stringify(packages)) return current;
  if (!await catalog.saveSkillCatalog(current.revision, packages)) throw new Error('stale_version');
  return {revision: current.revision + 1, skills: packages};
}
