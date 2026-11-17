import {randomUUID} from 'node:crypto';
import {parseFrontmatter} from '@earendil-works/pi-coding-agent';
import {readPackage} from '../managed-skills';
import {activePackages, canReadSkill, commitSkillProjection} from './catalog';
import {packageHash, versionKey, type SkillRecord, type VersionRecord} from './state';
import type {SkillGovernance} from './service';

/** Existing management names and integer versions remain available to original callers. */
export function createLegacySkillAdapter(service: SkillGovernance) {
  const {state} = service;
  async function catalog() {
    const actor = await service.actor();
    const current = await service.managed.catalog();
    const active = await activePackages(state, actor.id);
    return {revision: current.revision, skills: active.map(({skill, version}) => ({
      ...version.package, enabled: skill.enabled, archived: skill.archived,
    }))};
  }
  async function named(name: string) {
    const actor = await service.actor();
    const skill = (await state.list('skills')).find(item => item.legacyName === name);
    if (!skill || !await canReadSkill(state, skill, actor.id)) throw new Error('permission_denied');
    return {actor, skill};
  }
  async function expected(revision: number) {
    if (!Number.isSafeInteger(revision) || (await service.managed.catalog()).revision !== revision) throw new Error('stale_version');
  }
  async function preview(name: string) {
    const {skill} = await named(name);
    if (!skill.activeVersion || skill.archived) throw new Error('invalid_input');
    const version = await service.exactVersion(skill, skill.activeVersion);
    return {revision: (await catalog()).revision, name, version: version.package.version,
      document: service.managed.verifyItem(version.package).document};
  }
  async function setEnabled(name: string, revision: number, enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new Error('invalid_input');
    const {actor, skill} = await named(name);
    await expected(revision);
    if (skill.archived || !skill.activeVersion) throw new Error('invalid_input');
    if (enabled) {
      const version = await service.exactVersion(skill, skill.activeVersion);
      if (version.state !== 'published') throw new Error('permission_denied');
      if (version.provenance.kind !== 'legacy') await service.checkVersion(version);
    }
    await service.transaction(async work => {
      await expected(revision);
      await state.save('skills', {...skill, enabled, revision: skill.revision + 1}, skill.revision, work);
      await commitSkillProjection(state, actor.id, work);
    });
    return catalog();
  }
  async function archive(name: string, revision: number) {
    const {actor, skill} = await named(name);
    await service.owned(skill.id, actor.id);
    await expected(revision);
    await service.transaction(async work => {
      await expected(revision);
      await state.save('skills', {...skill, enabled: false, archived: true, autoActivate: null,
        revision: skill.revision + 1}, skill.revision, work);
      await commitSkillProjection(state, actor.id, work);
    });
    return catalog();
  }
  async function edit(name: string, revision: number, document: string) {
    const {actor, skill} = await named(name);
    await service.owned(skill.id, actor.id);
    await expected(revision);
    if (skill.scope !== 'personal' || !skill.activeVersion) throw new Error('permission_denied');
    const parsed = parseFrontmatter<{name: string; description: string}>(document);
    if (parsed.frontmatter.name !== name) throw new Error('invalid_input');
    const old = await service.exactVersion(skill, skill.activeVersion);
    const major = Math.max(...(await state.list('versions')).filter(item => item.skillId === skill.id).map(item => Number(item.version.split('.')[0]))) + 1;
    const bytes = new Map(service.managed.verifyItem(old.package).bytes);
    bytes.set('SKILL.md', Buffer.from(document));
    const validation = await service.validate(bytes, old.dependencies, old.permissionRequirements);
    if (!validation.passed) throw new Error('validation_failed');
    const number = Math.max(...(await state.list('versions')).filter(version => version.skillId === skill.id)
      .map(version => version.package.version)) + 1;
    const item = service.managed.stagePackage(bytes, number);
    const version = `${major}.0.0`;
    const record: VersionRecord = {...old, id: versionKey(skill.id, version), version, package: item,
      sha256: packageHash(item), state: 'published', validation, provenance: {kind: 'teacher'},
      createdAt: new Date().toISOString(), revision: 1};
    await service.transaction(async work => {
      await expected(revision);
      await service.owned(skill.id, actor.id, work);
      await state.save('versions', record, 0, work);
      await state.save('skills', {...skill, activeVersion: version, autoActivate: null,
        enabled: false, revision: skill.revision + 1}, skill.revision, work);
      await commitSkillProjection(state, actor.id, work);
    });
    return catalog();
  }
  async function importDirectory(directory: string, revision: number) {
    await expected(revision);
    const actor = await service.actor();
    const bytes = readPackage(directory);
    const validation = await service.validate(bytes, [], []);
    if (!validation.passed) throw new Error('validation_failed');
    const parsed = parseFrontmatter<{name: string}>(bytes.get('SKILL.md')!.toString('utf8'));
    const previous = (await state.list('skills')).find(skill => skill.legacyName === parsed.frontmatter.name);
    if (previous && (!previous.archived || previous.scope !== 'personal' || previous.ownerId !== actor.id)) throw new Error('skill_exists');
    const number = previous ? (await state.list('versions')).filter(version => version.skillId === previous.id).length + 1 : 1;
    const item = service.managed.stagePackage(bytes, number);
    const currentBytes = readPackage(directory);
    if (currentBytes.size !== bytes.size || [...bytes].some(([name, content]) => !currentBytes.get(name)?.equals(content))) {
      throw new Error('skill_source_changed');
    }
    const id = previous?.id || `skill_${randomUUID()}`;
    const version = `${number}.0.0`;
    const record: VersionRecord = {id: versionKey(id, version), skillId: id, version, sha256: packageHash(item), package: item,
      state: 'published', validation, dependencies: [], permissionRequirements: [], provenance: {kind: 'teacher'},
      createdAt: new Date().toISOString(), revision: 1};
    const skill: SkillRecord = {id, name: item.name, legacyName: item.name, title: item.title, scope: 'personal', ownerId: actor.id,
      activeVersion: version, autoActivate: null, enabled: false, archived: false, revision: (previous?.revision || 0) + 1};
    await service.transaction(async work => {
      await expected(revision);
      await state.save('versions', record, 0, work);
      await state.save('skills', skill, previous?.revision || 0, work);
      await commitSkillProjection(state, actor.id, work);
    });
    return catalog();
  }
  return {catalog, preview, setEnabled, archive, edit, importDirectory};
}
