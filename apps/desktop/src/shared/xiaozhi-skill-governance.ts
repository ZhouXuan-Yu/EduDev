/** Skill declarations are requirements. They never create execution grants. */
export type SkillScope = 'personal' | 'team' | 'official';
export type SkillDependency = {
  capabilityId: string;
  contractVersion: string;
  required: boolean;
  conditions?: string[];
};
export type SkillValidation = {
  version: 1;
  passed: boolean;
  checks: {kind: 'structure' | 'privacy' | 'instructions' | 'dependencies' | 'permissions' | 'parser'; passed: boolean; reasons: string[]}[];
  checkedAt: string;
};
export type SkillDraftInput = {
  name: string;
  description: string;
  document: string;
  version: string;
  dependencies: SkillDependency[];
  permissionRequirements: string[];
};
export type SkillProvenance = {
  kind: 'legacy' | 'creator' | 'teacher' | 'team_copy' | 'official_review';
  sourceSkillId?: string;
  sourceVersion?: string;
  sourceHash?: string;
  taskId?: string;
  runId?: string;
};
export type GovernedSkillVersion = {
  skillId: string;
  version: string;
  sha256: string;
  state: 'draft' | 'published' | 'pending_review' | 'rejected' | 'withdrawn';
  validation: SkillValidation;
  dependencies: SkillDependency[];
  permissionRequirements: string[];
  provenance: SkillProvenance;
  createdAt: string;
};
export type GovernedSkill = {
  id: string;
  name: string;
  title: string;
  scope: SkillScope;
  ownerId: string;
  teamId?: string;
  activeVersion: string | null;
  autoActivate: string | null;
  enabled: boolean;
  archived: boolean;
  revision: number;
};
export type SkillTeam = {id: string; name: string; revision: number; archived: boolean};
export type SkillMembership = {userId: string; teamId: string; role: 'member' | 'maintainer' | 'admin'; revision: number; revoked: boolean};
export type SkillReview = {
  id: string;
  skillId: string;
  version: string;
  sha256: string;
  scope: 'team' | 'official';
  teamId?: string;
  applicantId: string;
  reviewerId?: string;
  status: 'pending' | 'approved' | 'rejected';
  revision: number;
  metadata: {source: string; license: string; compatibility: string; testReferences: string[]};
};
export type SkillGovernanceView = {
  actor: {id: string; displayName: string};
  skills: GovernedSkill[];
  versions: GovernedSkillVersion[];
  team: SkillTeam | null;
  membership: SkillMembership | null;
  reviews: SkillReview[];
  officialReviewer: boolean;
};
export type SkillGovernanceMutation =
  | {action: 'create'; draft: SkillDraftInput}
  | {action: 'activate'; skillId: string; version: string; revision: number}
  | {action: 'withdraw'; skillId: string; version: string; revision: number}
  | {action: 'share'; skillId: string; version: string; revision: number}
  | {action: 'team_create'; name: string}
  | {action: 'team_add'; userId: string; role: SkillMembership['role']; revision: number}
  | {action: 'team_leave'; revision: number}
  | {action: 'team_edit'; skillId: string; revision: number; draft: SkillDraftInput}
  | {action: 'review'; reviewId: string; revision: number; approve: boolean}
  | {action: 'official_submit'; skillId: string; version: string; revision: number; metadata: SkillReview['metadata']};
export type SkillGovernanceError = 'invalid_input' | 'identity_unavailable' | 'permission_denied' | 'stale_version'
  | 'validation_failed' | 'missing_dependency' | 'version_conflict' | 'skill_source_changed' | 'busy' | 'configuration';
export type SkillGovernanceResult<T> = {ok: true; value: T} | {ok: false; error: SkillGovernanceError};
export const SKILL_GOVERNANCE_ERRORS: Record<SkillGovernanceError, string> = {
  invalid_input: '技能信息不完整，请核对后重试。',
  identity_unavailable: '本地教师身份存在缺失或歧义，请先核对本地用户配置。',
  permission_denied: '当前教师没有这项操作的权限。',
  stale_version: '记录已更新，请刷新后核对。',
  validation_failed: '技能验证未通过，请查看检查结果。',
  missing_dependency: '必要能力当前不可用，请先准备依赖。',
  version_conflict: '同一版本已有其他内容，请使用新版本号。',
  skill_source_changed: '版本资源已变更或不可用，请核对来源。',
  busy: '任务或技能操作尚未结束，请稍后重试。',
  configuration: '技能治理数据暂时不可用，请重试。',
};
