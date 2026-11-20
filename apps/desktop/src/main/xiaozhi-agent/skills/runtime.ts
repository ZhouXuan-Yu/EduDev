import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {ManagedSkillSource} from '../managed-skill-runtime';
import {activePackages, canReadSkill} from './catalog';
import {packageHash, versionKey, type RunSkillSnapshot} from './state';
import type {SkillGovernance} from './service';

/** Run selection is historical. Current withdrawal, membership and source checks still apply. */
export function createGovernedSkillSource(service: SkillGovernance, owner: PermissionOwner,
  sanitize: ManagedSkillSource['sanitize'], current: () => Promise<boolean>): ManagedSkillSource {
  const {state} = service;
  let captured: Promise<RunSkillSnapshot> | undefined;
  async function snapshot(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!await current()) throw new Error('permission_denied');
    const actor = await service.actor();
    const saved = await state.get('snapshots', owner.runId);
    if (saved) {
      if (JSON.stringify(saved.owner) !== JSON.stringify(owner) || saved.actorId !== actor.id) throw new Error('configuration');
      return saved;
    }
    const active = await activePackages(state, actor.id);
    const selected: RunSkillSnapshot['selected'] = [];
    const unavailable: NonNullable<RunSkillSnapshot['unavailable']> = [];
    for (const {skill, version} of active.filter(item => item.skill.enabled && !item.skill.archived)) {
      signal?.throwIfAborted();
      try {
        if (version.provenance.kind === 'legacy') await service.managed.verifyItemAsync(version.package, signal);
        else await service.checkVersion(version, owner, signal);
        signal?.throwIfAborted();
        selected.push({skillId: skill.id, version: version.version, sha256: version.sha256, package: version.package});
      } catch (error) {
        signal?.throwIfAborted();
        const code = error instanceof Error ? error.message : 'validation_failed';
        if (!['validation_failed', 'permission_denied', 'missing_dependency', 'skill_source_changed', 'invalid_input'].includes(code)) throw error;
        unavailable.push({skillId: skill.id, name: skill.name, version: version.version, reason: code});
      }
    }
    for (const skill of await state.list('skills')) {
      signal?.throwIfAborted();
      if (skill.activeVersion || !skill.autoActivate || skill.archived || !await canReadSkill(state, skill, actor.id)) continue;
      const version = await state.get('versions', versionKey(skill.id, skill.autoActivate));
      if (!version || version.state !== 'published') continue;
      let reason = 'activation_pending';
      try { await service.checkVersion(version, owner, signal); }
      catch (error) { signal?.throwIfAborted();reason = error instanceof Error ? error.message : 'validation_failed'; }
      unavailable.push({skillId: skill.id, name: skill.name, version: version.version, reason});
    }
    const record: RunSkillSnapshot = {id: owner.runId, revision: 1, owner, actorId: actor.id, selected, unavailable};
    await service.transaction(async work => {
      signal?.throwIfAborted();
      if (!await current()) throw new Error('permission_denied');
      for (const selection of selected) {
        signal?.throwIfAborted();
        const skill = await state.get('skills', selection.skillId, work);
        const version = await state.get('versions', versionKey(selection.skillId, selection.version), work);
        if (!skill || skill.archived || !skill.enabled || !await canReadSkill(state, skill, actor.id, work)
          || !version || version.state !== 'published' || version.sha256 !== selection.sha256
          || JSON.stringify(version.package) !== JSON.stringify(selection.package)) throw new Error('skill_source_changed');
      }
      signal?.throwIfAborted();
      await state.save('snapshots', record, 0, work);
      signal?.throwIfAborted();
    }, undefined, signal);
    signal?.throwIfAborted();
    return record;
  }
  return {
    sanitize,
    async unavailable() {
      captured ||= snapshot();
      return (await captured).unavailable || [];
    },
    async resources(signal) {
      signal?.throwIfAborted();
      if (!await current()) throw new Error('permission_denied');
      signal?.throwIfAborted();captured ||= snapshot(signal);
      const pinned = await captured;
      signal?.throwIfAborted();
      if ((await service.actor()).id !== pinned.actorId) throw new Error('permission_denied');
      for (const selection of pinned.selected) {
        signal?.throwIfAborted();
        const skill = await state.get('skills', selection.skillId);
        const version = await state.get('versions', versionKey(selection.skillId, selection.version));
        const readable = skill && await canReadSkill(state, skill, pinned.actorId);
        if (!skill || !readable || skill.archived || !skill.enabled || !version || version.state !== 'published') {
          throw new Error('skill_scope_changed');
        }
        if (version.sha256 !== selection.sha256 || packageHash(selection.package) !== selection.sha256
          || JSON.stringify(version.package) !== JSON.stringify(selection.package)) throw new Error('skill_source_changed');
        if (version.provenance.kind !== 'legacy') await service.checkVersion(version, owner, signal);
      }
      const resources = await service.managed.resourcesForItems(pinned.selected.map(selection => ({
        ...selection.package, enabled: true, archived: false,
      })), signal);
      if (!await current()) throw new Error('permission_denied');
      signal?.throwIfAborted();
      return resources;
    },
  };
}
