import type { IpcMain } from 'electron';
import type { createXiaozhiProductionHost } from './production-host';
import { validSkillName, exactSkillObject, SKILL_LIMITS, type PrivateSkillCatalog } from './skill-catalog-state';
import type { XiaozhiSkillCatalog, XiaozhiSkillError, XiaozhiSkillResult, XiaozhiSkillPreview, XiaozhiSkillMutation, XiaozhiSkillMutationResult } from '../../shared/xiaozhi-skills';
type Host = Pick<ReturnType<typeof createXiaozhiProductionHost>, 'skillCatalog' | 'skillPreview' | 'setSkillEnabled' | 'editSkill' | 'archiveSkill' | 'importSkill' | 'skillManagementBusy'>;
export function validSkillMutation(value: unknown): value is XiaozhiSkillMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as XiaozhiSkillMutation;
  if (!Number.isSafeInteger(input.revision) || input.revision < 1 || input.revision >= Number.MAX_SAFE_INTEGER) return false;
  if (input.action === 'import') return exactSkillObject(input, ['action', 'revision']);
  if (!('name' in input) || !validSkillName(input.name)) return false;
  if (input.action === 'enable') return exactSkillObject(input, ['action', 'revision', 'name', 'enabled']) && typeof input.enabled === 'boolean';
  if (input.action === 'archive') return exactSkillObject(input, ['action', 'revision', 'name']);
  return input.action === 'edit' && exactSkillObject(input, ['action', 'revision', 'name', 'document'])
    && typeof input.document === 'string' && !input.document.includes('\0') && Buffer.byteLength(input.document) <= SKILL_LIMITS.instructionBytes;
}
const safeError = (error: unknown): XiaozhiSkillError => {
  const message = error instanceof Error ? error.message : '';
  return ['invalid_input', 'permission_denied', 'busy', 'stale_version', 'skill_exists', 'skill_source_changed'].includes(message) ? message as XiaozhiSkillError : 'configuration';
};
export function createSkillManagementApi(host: Host, choose: () => Promise<string | undefined>) {
  const project = (catalog: PrivateSkillCatalog): XiaozhiSkillCatalog => ({ revision: catalog.revision, locked: host.skillManagementBusy(),
    skills: catalog.skills.map(({ name, title, description, origin, version, enabled, archived }) => ({ name, title, description, origin, version, enabled, archived })) });
  return {
    async catalog(input?: unknown): Promise<XiaozhiSkillResult<XiaozhiSkillCatalog>> {
      if (input !== undefined) return { ok: false, error: 'invalid_input' };
      try { return { ok: true, value: project(await host.skillCatalog()) }; } catch (error) { return { ok: false, error: safeError(error) }; }
    },
    async preview(input: unknown): Promise<XiaozhiSkillResult<XiaozhiSkillPreview>> {
      if (!exactSkillObject(input, ['name']) || !validSkillName(input.name)) return { ok: false, error: 'invalid_input' };
      try { const { revision, name, version, document } = await host.skillPreview(input.name); return { ok: true, value: { revision, name, version, document } }; }
      catch (error) { return { ok: false, error: safeError(error) }; }
    },
    async mutate(input: unknown): Promise<XiaozhiSkillMutationResult> {
      if (!validSkillMutation(input)) return { ok: false, error: 'invalid_input' };
      try {
        const catalog = input.action === 'import' ? await host.importSkill(input.revision, choose)
          : input.action === 'enable' ? await host.setSkillEnabled(input.name, input.revision, input.enabled)
          : input.action === 'edit' ? await host.editSkill(input.name, input.revision, input.document)
          : await host.archiveSkill(input.name, input.revision);
        return { ok: true, value: { catalog: project(catalog || await host.skillCatalog()), cancelled: catalog === null } };
      } catch (error) { return { ok: false, error: safeError(error) }; }
    },
  };
}
export function registerSkillManagementIpc(options: { ipcMain: IpcMain; allowed: (event: Electron.IpcMainInvokeEvent) => boolean; host: Host; choose: () => Promise<string | undefined> }) {
  const api = createSkillManagementApi(options.host, options.choose);
  for (const [channel, method] of [['xiaozhi:skill-catalog', api.catalog], ['xiaozhi:skill-preview', api.preview], ['xiaozhi:skill-mutate', api.mutate]] as const) {
    options.ipcMain.handle(channel, (event, input) => options.allowed(event) ? method(input) : { ok: false, error: 'permission_denied' });
  }
}
