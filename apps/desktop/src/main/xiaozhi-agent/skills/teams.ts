import {randomUUID} from 'node:crypto';
import {parseFrontmatter} from '@earendil-works/pi-coding-agent';
import type {SkillDraftInput, SkillReview} from '../../../shared/xiaozhi-skill-governance';
import type {SkillGovernance} from './service';
import {packageHash, versionKey, type SkillRecord, type VersionRecord} from './state';
import {commitSkillProjection} from './catalog';
import {containsSkillSensitiveText, draftDocument, validDraft} from './validation';

export function createSkillTeamService(service: SkillGovernance) {
  const {state} = service;
  async function admin(actorId: string, work = state.sql) {
    const membership = await state.get('memberships', actorId, work);
    if (!membership || membership.revoked || membership.role !== 'admin') throw new Error('permission_denied');
    const team = await state.get('teams', membership.teamId, work);
    if (!team || team.archived) throw new Error('permission_denied');
    return {membership, team};
  }
  async function create(name: string) {
    if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('invalid_input');
    const actor = await service.actor();
    await service.transaction(async work => {
      const previous = await state.get('memberships', actor.id, work);
      if (previous && !previous.revoked) throw new Error('permission_denied');
      const id = `team_${randomUUID()}`;
      await state.save('teams', {id, name: name.trim(), revision: 1, archived: false}, 0, work);
      await state.save('memberships', {id: actor.id, userId: actor.id, teamId: id, role: 'admin', revoked: false,
        revision: (previous?.revision || 0) + 1}, previous?.revision || 0, work);
    });
  }
  async function add(userId: string, role: 'member' | 'maintainer' | 'admin', revision: number) {
    if (!['member', 'maintainer', 'admin'].includes(role) || typeof userId !== 'string') throw new Error('invalid_input');
    const actor = await service.actor();
    await service.transaction(async work => {
      const {team} = await admin(actor.id, work);
      if (team.revision !== revision) throw new Error('stale_version');
      const users = await work.all("SELECT id FROM users WHERE id=? AND status='active'", [userId]);
      if (users.length !== 1) throw new Error('identity_unavailable');
      const previous = await state.get('memberships', userId, work);
      if (previous && !previous.revoked && previous.teamId !== team.id) throw new Error('permission_denied');
      await state.save('memberships', {id: userId, userId, teamId: team.id, role, revoked: false,
        revision: (previous?.revision || 0) + 1}, previous?.revision || 0, work);
      await state.save('teams', {...team, revision: team.revision + 1}, revision, work);
    });
  }
  async function leave(revision: number) {
    const actor = await service.actor();
    await service.transaction(async work => {
      const membership = await state.get('memberships', actor.id, work);
      if (!membership || membership.revoked) throw new Error('permission_denied');
      if (membership.revision !== revision) throw new Error('stale_version');
      await state.save('memberships', {...membership, revoked: true, revision: revision + 1}, revision, work);
      await commitSkillProjection(state, actor.id, work);
    });
  }
  async function submit(skillId: string, versionName: string, revision: number,
    officialMetadata?: SkillReview['metadata']) {
    const actor = await service.actor();
    const source = await service.owned(skillId, actor.id);
    if (source.scope !== 'personal' || source.revision !== revision) throw new Error('stale_version');
    const original = await service.exactVersion(source, versionName);
    if (original.state !== 'published') throw new Error('permission_denied');
    const validation = await service.checkVersion(original);
    const membership = await state.get('memberships', actor.id);
    if (!officialMetadata && (!membership || membership.revoked)) throw new Error('permission_denied');
    if (officialMetadata && (!officialMetadata.source.trim() || !officialMetadata.license.trim()
      || !officialMetadata.compatibility.trim() || !officialMetadata.testReferences.length)) throw new Error('invalid_input');
    if (officialMetadata) {
      const metadata = JSON.stringify(officialMetadata);
      if (containsSkillSensitiveText(metadata) || await service.sanitize(metadata) !== metadata) throw new Error('validation_failed');
    }
    const scope = officialMetadata ? 'official' : 'team';
    const id = `skill_${randomUUID()}`;
    const name = `${source.name.slice(0, 38)}-${scope}-${id.slice(-12)}`;
    const verified = service.managed.verifyItem(original.package);
    const originalDocument = verified.document;
    const parsed = parseFrontmatter<{description: string}>(originalDocument);
    const document = `---\nname: ${name}\ndescription: ${JSON.stringify(parsed.frontmatter.description)}\n---\n${parsed.body}`;
    const copied = new Map(verified.bytes);
    copied.set('SKILL.md', Buffer.from(document));
    const item = service.managed.stagePackage(copied, 1);
    const hash = packageHash(item);
    const skill: SkillRecord = {id, name: source.name, legacyName: name, title: source.title, scope, ownerId: actor.id,
      ...(scope === 'team' ? {teamId: membership!.teamId} : {}), activeVersion: null, autoActivate: null,
      enabled: false, archived: false, revision: 1};
    const version: VersionRecord = {...original, id: versionKey(id, versionName), skillId: id, package: item, sha256: hash,
      state: 'pending_review', validation, provenance: {kind: officialMetadata ? 'official_review' : 'team_copy',
        sourceSkillId: source.id, sourceVersion: versionName, sourceHash: original.sha256}, createdAt: new Date().toISOString(), revision: 1};
    const review: SkillReview = {id: `skillreview_${randomUUID()}`, skillId: id, version: versionName, sha256: hash, scope,
      ...(scope === 'team' ? {teamId: membership!.teamId} : {}), applicantId: actor.id, status: 'pending', revision: 1,
      metadata: officialMetadata || {source: `personal:${source.id}@${versionName}`, license: 'private-team-copy',
        compatibility: 'xiaozhi.skill.v1', testReferences: [`validation:${original.sha256}`]}};
    await service.transaction(async work => {
      const latest = await service.owned(skillId, actor.id, work);
      const currentMembership = await state.get('memberships', actor.id, work);
      if (latest.revision !== revision) throw new Error('stale_version');
      if (scope === 'team' && (!currentMembership || currentMembership.revoked || currentMembership.teamId !== membership!.teamId)) throw new Error('permission_denied');
      const currentVersion = await service.exactVersion(latest, versionName, work);
      if (currentVersion.state !== 'published' || currentVersion.sha256 !== original.sha256) throw new Error('stale_version');
      await state.save('skills', skill, 0, work);
      await state.save('versions', version, 0, work);
      await state.save('reviews', review, 0, work);
    });
  }
  async function decide(reviewId: string, revision: number, approve: boolean) {
    const actor = await service.actor();
    const review = await state.get('reviews', reviewId);
    if (!review || review.status !== 'pending') throw new Error('stale_version');
    const skill = await state.get('skills', review.skillId);
    if (!skill) throw new Error('configuration');
    const version = await service.exactVersion(skill, review.version);
    if (approve) await service.checkVersion(version);
    await service.transaction(async work => {
      const current = await state.get('reviews', reviewId, work);
      if (!current || current.revision !== revision || current.status !== 'pending') throw new Error('stale_version');
      if (current.scope === 'team') {
        const {team} = await admin(actor.id, work);
        if (team.id !== current.teamId) throw new Error('permission_denied');
      } else if (!(await service.officialReviewers()).has(actor.id)) throw new Error('permission_denied');
      const currentVersion = await state.get('versions', versionKey(current.skillId, current.version), work);
      const currentSkill = await state.get('skills', current.skillId, work);
      if (!currentVersion || !currentSkill || currentVersion.sha256 !== current.sha256 || currentVersion.state !== 'pending_review') {
        throw new Error('stale_version');
      }
      await state.save('reviews', {...current, status: approve ? 'approved' : 'rejected', reviewerId: actor.id,
        revision: revision + 1}, revision, work);
      await state.save('versions', {...currentVersion, state: approve ? 'published' : 'rejected',
        revision: currentVersion.revision + 1}, currentVersion.revision, work);
      await state.save('skills', {...currentSkill, activeVersion: approve ? current.version : null,
        enabled: approve, revision: currentSkill.revision + 1}, currentSkill.revision, work);
      await commitSkillProjection(state, actor.id, work);
    });
  }
  async function edit(skillId: string, revision: number, draft: SkillDraftInput) {
    if (!validDraft(draft)) throw new Error('invalid_input');
    const actor = await service.actor();
    const skill = await service.owned(skillId, actor.id);
    if (skill.scope !== 'team' || skill.revision !== revision || draft.name !== skill.name) throw new Error('permission_denied');
    if (await state.get('versions', versionKey(skill.id, draft.version))) throw new Error('version_conflict');
    const document = draftDocument(draft, skill.legacyName);
    const validation = await service.validate(new Map([['SKILL.md', Buffer.from(document)]]), draft.dependencies, draft.permissionRequirements);
    if (!validation.passed) throw new Error('validation_failed');
    const number = (await state.list('versions')).filter(version => version.skillId === skill.id).length + 1;
    const item = service.managed.stageDocument(document, number);
    const sha256 = packageHash(item);
    const version: VersionRecord = {id: versionKey(skill.id, draft.version), skillId: skill.id, version: draft.version,
      sha256, package: item, state: 'pending_review', validation, dependencies: draft.dependencies,
      permissionRequirements: draft.permissionRequirements, provenance: {kind: 'team_copy', sourceSkillId: skill.id,
        sourceVersion: skill.activeVersion || undefined}, createdAt: new Date().toISOString(), revision: 1};
    const review: SkillReview = {id: `skillreview_${randomUUID()}`, skillId: skill.id, version: draft.version, sha256,
      scope: 'team', teamId: skill.teamId, applicantId: actor.id, status: 'pending', revision: 1,
      metadata: {source: `team:${skill.id}`, license: 'private-team-copy', compatibility: 'xiaozhi.skill.v1',
        testReferences: [`validation:${sha256}`]}};
    await service.transaction(async work => {
      const current = await service.owned(skill.id, actor.id, work);
      if (current.revision !== revision) throw new Error('stale_version');
      await state.save('versions', version, 0, work);
      await state.save('reviews', review, 0, work);
      await state.save('skills', {...current, revision: revision + 1}, revision, work);
    });
  }
  return {create, add, leave, submit, decide, edit};
}
