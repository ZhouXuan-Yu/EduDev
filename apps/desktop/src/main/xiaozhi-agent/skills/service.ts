import {createHash, randomUUID} from 'node:crypto';
import type {createManagedEducationSkills} from '../managed-skills';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {SkillDependency, SkillGovernanceView, SkillValidation} from '../../../shared/xiaozhi-skill-governance';
import type {Sql} from '../session-state';
import {packageHash, versionKey, type SkillGovernanceState, type SkillRecord, type VersionRecord} from './state';
import {canReadSkill, commitSkillProjection} from './catalog';
import {containsSkillSensitiveMetadata, createSkillValidator, draftDocument, validDraft, validSemver, type SkillValidator} from './validation';
import type {SkillPrivateContext} from './private-context';
import {snapshotToolInvocationInput} from '../../ai-harness/vendor/openhanako-tool-input-snapshot';
import {SKILL_LIMITS} from '../skill-catalog-state';

type Managed = ReturnType<typeof createManagedEducationSkills>;
export type SkillGovernanceOptions = {
  state: SkillGovernanceState;
  managed: Managed;
  sanitize: (text: string) => Promise<string>;
  dependency: (dependency: SkillDependency, owner?: PermissionOwner) => Promise<boolean>;
  permission?: (requirement: string, owner?: PermissionOwner) => Promise<boolean>;
  privateContext?: (owner?: PermissionOwner) => Promise<SkillPrivateContext | undefined>;
  actor?: () => Promise<{id: string; displayName: string}>;
  current: (owner: PermissionOwner) => Promise<boolean>;
  open?: () => boolean;
  /** Trusted local review adapter, supplied by main, never read from package/IPC. */
  officialReviewers?: () => Promise<ReadonlySet<string>>;
};
const legacyValidation = (): SkillValidation => ({version: 1, passed: true, checkedAt: new Date().toISOString(),
  checks: [{kind: 'structure', passed: true, reasons: []}]});
const publicVersion = ({id: _id, revision: _revision, package: _package, ...version}: VersionRecord) => version;
export function createSkillGovernance(options: SkillGovernanceOptions) {
  const {state, managed} = options;
  const actor = options.actor || state.actor;
  const validate: SkillValidator = createSkillValidator({...options, permission: undefined});
  const validatorFor = (owner?: PermissionOwner, execution = false, signal?: AbortSignal) => {
    const checked = async <T>(action: () => Promise<T>) => {signal?.throwIfAborted();const value = await action();signal?.throwIfAborted();return value;};
    return createSkillValidator({...options,
      sanitize: text => checked(() => options.sanitize(text)),
      privateContext: () => checked(() => options.privateContext?.(owner) || Promise.resolve(undefined)),
      permission: execution ? requirement => checked(() => options.permission?.(requirement, owner) || Promise.resolve(false)) : undefined,
      dependency: dependency => checked(() => options.dependency(dependency, execution ? owner : undefined))});
  };
  const officialReviewers = options.officialReviewers || state.officialAuthority.reviewers;
  const assertCurrent = async (owner: PermissionOwner) => {
    if (!await options.current(owner)) throw new Error('permission_denied');
  };
  async function transaction<T>(action: (work: Sql) => Promise<T>, owner?: PermissionOwner, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    return state.transaction(async work => {
      signal?.throwIfAborted();
      if (options.open?.() === false) throw new Error('busy');
      if (owner) await assertCurrent(owner);
      signal?.throwIfAborted();
      const result = await action(work);
      if (options.open?.() === false) throw new Error('busy');
      if (owner) await assertCurrent(owner);
      signal?.throwIfAborted();
      return result;
    });
  }
  async function owned(id: string, actorId: string, work = state.sql) {
    const skill = await state.get('skills', id, work);
    if (!skill || skill.archived) throw new Error('invalid_input');
    if (skill.scope === 'personal' && skill.ownerId === actorId) return skill;
    const membership = await state.get('memberships', actorId, work);
    if (skill.scope === 'team' && membership && !membership.revoked && membership.teamId === skill.teamId
      && ['admin', 'maintainer'].includes(membership.role)) return skill;
    if (skill.scope === 'official' && (await officialReviewers()).has(actorId)) return skill;
    throw new Error('permission_denied');
  }
  async function exactVersion(skill: SkillRecord, version: string, work = state.sql) {
    if (!validSemver(version)) throw new Error('invalid_input');
    const record = await state.get('versions', versionKey(skill.id, version), work);
    if (!record) throw new Error('invalid_input');
    managed.verifyItem(record.package);
    return record;
  }
  async function checkVersion(version: VersionRecord, owner?: PermissionOwner, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const {bytes} = await managed.verifyItemAsync(version.package, signal);
    signal?.throwIfAborted();
    const result = await validatorFor(owner, Boolean(owner), signal)(bytes, version.dependencies, version.permissionRequirements);
    signal?.throwIfAborted();
    if (!result.passed) {
      if (result.checks.some(check => check.kind === 'dependencies' && !check.passed)) throw new Error('missing_dependency');
      if (result.checks.some(check => check.kind === 'permissions' && !check.passed)) throw new Error('permission_denied');
      throw new Error('validation_failed');
    }
    return result;
  }
  async function initialize() {
    const currentActor = await actor();
    const catalog = await managed.catalog();
    await transaction(async work => {
      for (const item of catalog.skills) {
        const id = `skill_legacy_${item.name}`;
        const previous = await state.get('skills', id, work);
        // New governed entries have different stable IDs and must never be re-adopted.
        if ((await state.list('skills', work)).some(skill => skill.legacyName === item.name && skill.id !== id)) continue;
        const version = `${item.version}.0.0`;
        if (previous && await state.get('versions', versionKey(id, version), work)) continue;
        managed.verifyItem(item);
        const skill: SkillRecord = previous || {id, name: item.name, legacyName: item.name, title: item.title,
          scope: item.origin === 'builtin' ? 'official' : 'personal', ownerId: item.origin === 'builtin' ? 'application' : currentActor.id,
          activeVersion: version, autoActivate: null, enabled: item.enabled, archived: item.archived, revision: 1};
        const record: VersionRecord = {id: versionKey(id, version), skillId: id, version, sha256: packageHash(item), package: item,
          state: 'published', validation: legacyValidation(), dependencies: [], permissionRequirements: [],
          provenance: {kind: 'legacy'}, createdAt: new Date().toISOString(), revision: 1};
        await state.save('versions', record, 0, work);
        if (item.origin === 'builtin') {
          const reviewId = `skillreview_builtin_${item.name}_${item.version}`;
          if (!await state.get('reviews', reviewId, work)) await state.save('reviews', {
            id: reviewId, skillId: id, version, sha256: record.sha256, scope: 'official', applicantId: 'application',
            reviewerId: 'application', status: 'approved', revision: 1,
            metadata: {source: `app-reviewed:${item.name}`, license: 'application-distribution',
              compatibility: 'pi-coding-agent@1.0.2', testReferences: [`builtin-manifest:${record.sha256}`]},
          }, 0, work);
        }
        if (!previous) await state.save('skills', skill, 0, work);
        else await state.save('skills', {...skill, revision: skill.revision + 1, activeVersion: version}, skill.revision, work);
      }
    });
  }
  async function view(): Promise<SkillGovernanceView> {
    const currentActor = await actor();
    const membership = await state.get('memberships', currentActor.id);
    const activeMembership = membership && !membership.revoked ? membership : null;
    const skills: SkillRecord[] = [];
    for (const skill of await state.list('skills')) {
      if (await canReadSkill(state, skill, currentActor.id)) skills.push(skill);
    }
    const ids = new Set(skills.map(skill => skill.id));
    const allVersions = await state.list('versions');
    const reviewer = (await officialReviewers()).has(currentActor.id);
    const reviews = (await state.list('reviews')).filter(review => review.applicantId === currentActor.id
      || review.scope === 'official' && reviewer || review.teamId === activeMembership?.teamId && activeMembership?.role === 'admin');
    const pendingIds = new Set(reviews.map(review => review.skillId));
    const pendingVersions = new Set(reviews.map(review => versionKey(review.skillId, review.version)));
    const visibleSkills = skills.filter(skill => skill.scope === 'personal'
      || allVersions.some(version => version.skillId === skill.id && version.state === 'published') || pendingIds.has(skill.id));
    const visibleIds = new Set(visibleSkills.map(skill => skill.id));
    return {actor: currentActor, skills: visibleSkills, versions: allVersions.filter(version => ids.has(version.skillId)
      && visibleIds.has(version.skillId) && (version.state === 'published' || version.state === 'withdrawn'
        || skills.find(skill => skill.id === version.skillId)?.scope === 'personal'
        && skills.find(skill => skill.id === version.skillId)?.ownerId === currentActor.id
        || pendingVersions.has(versionKey(version.skillId, version.version)))).map(publicVersion),
    team: activeMembership ? await state.get('teams', activeMembership.teamId) : null,
    membership: activeMembership, reviews, officialReviewer: reviewer};
  }
  async function publish(input: unknown, owner?: PermissionOwner) {
    const frozen = snapshotToolInvocationInput(input);
    if (!frozen.ok) throw new Error('invalid_input');
    input = frozen.value;
    if (!validDraft(input)) throw new Error('invalid_input');
    if (owner) await assertCurrent(owner);
    const currentActor = await actor();
    const privateContext = await options.privateContext?.(owner);
    const sensitiveName = containsSkillSensitiveMetadata(input.name) || await options.sanitize(input.name) !== input.name
      || privateContext?.contains(input.name);
    const safeName = sensitiveName ? `draft-${createHash('sha256').update(input.name).digest('hex').slice(0, 24)}` : input.name;
    const prior = (await state.list('skills')).find(skill => skill.scope === 'personal' && skill.ownerId === currentActor.id && skill.name === safeName);
    const visible = (await view()).skills.filter(skill => !skill.archived);
    if (!prior && visible.length >= SKILL_LIMITS.skills) throw new Error('invalid_input');
    const previousVersions = (await state.list('versions')).filter(version => version.skillId === prior?.id);
    if (previousVersions.length >= 128 && !previousVersions.some(version => version.version === input.version)) throw new Error('invalid_input');
    const id = prior?.id || `skill_${randomUUID()}`;
    const catalog = await managed.catalog();
    if (catalog.skills.some(item => item.name === safeName && item.origin === 'builtin')) throw new Error('permission_denied');
    const name = prior?.legacyName || (catalog.skills.some(item => item.name === safeName) ? `${safeName.slice(0, 43)}-${id.slice(-16)}` : safeName);
    const document = draftDocument(input, name);
    const bytes = new Map([['SKILL.md', Buffer.from(draftDocument(input))]]);
    const assessed = await validatorFor(owner)(bytes, input.dependencies, input.permissionRequirements);
    const privacyFailed = sensitiveName || assessed.checks.some(check => check.kind === 'privacy' && !check.passed);
    const validation: SkillValidation = privacyFailed ? {...assessed, passed: false,
      checks: assessed.checks.map(check => ({...check,
        passed: check.kind === 'privacy' ? false : check.passed,
        reasons: check.kind === 'dependencies' ? check.reasons.map(() => 'dependency_needs_review')
          : check.kind === 'permissions' ? check.reasons.map(() => 'permission_needs_review')
            : check.kind === 'privacy' ? [...new Set([...check.reasons, 'sensitive_content'])] : check.reasons}))} : assessed;
    const previousVersion = await state.get('versions', versionKey(id, input.version));
    if (previousVersion && previousVersion.state !== 'draft') {
      if (privacyFailed) throw new Error('validation_failed');
      const unchanged = managed.verifyItem(previousVersion.package).document === document;
      if (!unchanged || JSON.stringify(previousVersion.dependencies) !== JSON.stringify(input.dependencies)
        || JSON.stringify(previousVersion.permissionRequirements) !== JSON.stringify(input.permissionRequirements)) throw new Error('version_conflict');
      return {skillId: id, version: publicVersion(previousVersion), activated: prior?.activeVersion === input.version};
    }
    // Failed raw input is never written into a package or ordinary persistent data.
    const storedDocument = validation.passed ? document : `---\nname: ${name}\ndescription: 待修正的技能草稿\n---\n# 验证未通过\n请按检查结果重新创建新版本。\n`;
    const number = (await state.list('versions')).filter(version => version.skillId === id).length + 1;
    const item = managed.stageDocument(storedDocument, number);
    const record: VersionRecord = {id: versionKey(id, input.version), skillId: id, version: input.version, sha256: packageHash(item), package: item,
      state: validation.passed ? 'published' : 'draft', validation, dependencies: privacyFailed ? [] : input.dependencies,
      permissionRequirements: privacyFailed ? [] : input.permissionRequirements, provenance: {kind: owner ? 'creator' : 'teacher',
        ...(owner ? {taskId: owner.taskId, runId: owner.runId} : {})},
      createdAt: previousVersion?.createdAt || new Date().toISOString(), revision: (previousVersion?.revision || 0) + 1};
    await transaction(async work => {
      if (owner) await assertCurrent(owner);
      const sameName = (await state.list('skills', work)).find(skill => skill.scope === 'personal'
        && skill.ownerId === currentActor.id && skill.name === safeName);
      if (sameName && sameName.id !== id) throw new Error('stale_version');
      const skill = await state.get('skills', id, work);
      await state.save('versions', record, previousVersion?.revision || 0, work);
      const next: SkillRecord = skill ? {...skill, revision: skill.revision + 1,
        autoActivate: validation.passed ? input.version : skill.autoActivate}
        : {id, name: safeName, legacyName: name, title: item.title, scope: 'personal', ownerId: currentActor.id,
          activeVersion: null, autoActivate: validation.passed ? input.version : null, enabled: true, archived: false, revision: 1};
      await state.save('skills', next, skill?.revision || 0, work);
    }, owner);
    return {skillId: id, version: publicVersion(record), activated: false};
  }
  async function activate(skillId: string, version: string, revision: number, owner?: PermissionOwner) {
    const currentActor = await actor();
    const skill = await owned(skillId, currentActor.id);
    if (skill.revision !== revision) throw new Error('stale_version');
    const record = await exactVersion(skill, version);
    if (record.state !== 'published') throw new Error('permission_denied');
    if (record.provenance.kind !== 'legacy') await checkVersion(record, owner);
    await transaction(async work => {
      const latest = await owned(skillId, currentActor.id, work);
      if (latest.revision !== revision) throw new Error('stale_version');
      const currentVersion = await exactVersion(latest, version, work);
      if (currentVersion.state !== 'published') throw new Error('permission_denied');
      await state.save('skills', {...latest, activeVersion: version, autoActivate: null, enabled: true, revision: revision + 1}, revision, work);
      await commitSkillProjection(state, currentActor.id, work);
    });
  }
  async function activatePending(owner?: PermissionOwner) {
    if (owner) await assertCurrent(owner);
    const currentActor = await actor();
    for (const skill of await state.list('skills')) {
      if (skill.scope === 'personal' && skill.ownerId === currentActor.id && skill.autoActivate && !skill.archived) {
        try { await activate(skill.id, skill.autoActivate, skill.revision); }
        catch (error) { if (!(error instanceof Error) || !['validation_failed', 'missing_dependency', 'permission_denied', 'stale_version', 'invalid_input'].includes(error.message)) throw error; }
      }
    }
  }
  async function withdraw(skillId: string, version: string, revision: number) {
    const currentActor = await actor();
    await transaction(async work => {
      const skill = await owned(skillId, currentActor.id, work);
      if (skill.revision !== revision) throw new Error('stale_version');
      const record = await exactVersion(skill, version, work);
      await state.save('versions', {...record, state: 'withdrawn', revision: record.revision + 1}, record.revision, work);
      await state.save('skills', {...skill, revision: revision + 1,
        activeVersion: skill.activeVersion === version ? null : skill.activeVersion,
        autoActivate: skill.autoActivate === version ? null : skill.autoActivate}, revision, work);
      await commitSkillProjection(state, currentActor.id, work);
    });
  }
  return {state, actor, managed, transaction, validate, sanitize: options.sanitize, isCurrent: options.current, officialReviewers, owned, exactVersion, checkVersion,
    initialize, view, publish, activate, activatePending, withdraw};
}
export type SkillGovernance = ReturnType<typeof createSkillGovernance>;
