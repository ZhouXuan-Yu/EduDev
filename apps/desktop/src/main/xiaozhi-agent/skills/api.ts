import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import type {SkillGovernanceMutation, SkillGovernanceResult, SkillGovernanceView} from '../../../shared/xiaozhi-skill-governance';
import {SKILL_GOVERNANCE_ERRORS} from '../../../shared/xiaozhi-skill-governance';
import {exactSkillObject} from '../skill-catalog-state';
import {validDraft, validSemver} from './validation';
import {snapshotToolInvocationInput} from '../../ai-harness/vendor/openhanako-tool-input-snapshot';

const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.@-]{1,160}$/.test(value);
const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 1;
function validGovernanceShape(value: unknown): value is SkillGovernanceMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (input.action === 'create') return exactSkillObject(input, ['action', 'draft']) && validDraft(input.draft);
  if (input.action === 'team_create') return exactSkillObject(input, ['action', 'name'])
    && typeof input.name === 'string' && Boolean(input.name.trim()) && input.name.length <= 80;
  if (input.action === 'team_leave') return exactSkillObject(input, ['action', 'revision']) && revision(input.revision);
  if (input.action === 'team_edit') return exactSkillObject(input, ['action', 'skillId', 'revision', 'draft'])
    && id(input.skillId) && revision(input.revision) && validDraft(input.draft);
  if (input.action === 'team_add') return exactSkillObject(input, ['action', 'userId', 'role', 'revision'])
    && id(input.userId) && ['member', 'maintainer', 'admin'].includes(String(input.role)) && revision(input.revision);
  if (input.action === 'review') return exactSkillObject(input, ['action', 'reviewId', 'revision', 'approve'])
    && id(input.reviewId) && revision(input.revision) && typeof input.approve === 'boolean';
  if (['activate', 'withdraw', 'share'].includes(String(input.action))) return exactSkillObject(input, ['action', 'skillId', 'version', 'revision'])
    && id(input.skillId) && validSemver(input.version) && revision(input.revision);
  if (input.action !== 'official_submit' || !exactSkillObject(input, ['action', 'skillId', 'version', 'revision', 'metadata'])
    || !id(input.skillId) || !validSemver(input.version) || !revision(input.revision)
    || !exactSkillObject(input.metadata, ['source', 'license', 'compatibility', 'testReferences'])) return false;
  const metadata = input.metadata;
  return ['source', 'license', 'compatibility'].every(key => typeof metadata[key] === 'string'
    && Boolean(String(metadata[key]).trim()) && String(metadata[key]).length <= 1024)
    && Array.isArray(metadata.testReferences) && metadata.testReferences.length > 0 && metadata.testReferences.length <= 32
    && metadata.testReferences.every(reference => typeof reference === 'string' && reference.length > 0 && reference.length <= 512);
}
export function snapshotSkillMutation(value: unknown): SkillGovernanceMutation | null {
  const snapshot = snapshotToolInvocationInput(value);
  return snapshot.ok && validGovernanceShape(snapshot.value) ? snapshot.value : null;
}
export function validGovernanceMutation(value: unknown): value is SkillGovernanceMutation {
  return snapshotSkillMutation(value) !== null;
}
export async function skillGovernanceResult<T>(action: () => Promise<T>): Promise<SkillGovernanceResult<T>> {
  try { return {ok: true, value: await action()}; }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = Object.hasOwn(SKILL_GOVERNANCE_ERRORS, message) ? message as keyof typeof SKILL_GOVERNANCE_ERRORS : 'configuration';
    return {ok: false, error: code};
  }
}
export function registerSkillGovernanceIpc(options: {
  ipcMain: IpcMain;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  view: () => Promise<SkillGovernanceView>;
  mutate: (input: SkillGovernanceMutation) => Promise<SkillGovernanceView>;
}) {
  options.ipcMain.handle('xiaozhi:skill-governance', (event, input) => options.allowed(event) && input === undefined
    ? skillGovernanceResult(options.view) : {ok: false, error: 'permission_denied'});
  options.ipcMain.handle('xiaozhi:skill-governance-mutate', (event, input) => {
    if (!options.allowed(event)) return {ok: false, error: 'permission_denied'};
    const frozen = snapshotSkillMutation(input);
    return frozen ? skillGovernanceResult(() => options.mutate(frozen)) : {ok: false, error: 'invalid_input'};
  });
}
