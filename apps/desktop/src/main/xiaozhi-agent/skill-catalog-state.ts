import type { Sql } from './session-state';

export const SKILL_LIMITS = { skills: 32, files: 64, nodes: 128, depth: 4, bytes: 8 * 1024 * 1024, fileBytes: 1024 * 1024, instructionBytes: 32768 } as const;
export type SkillPackageFile = { relative: string; size: number; sha256: string };
export type PrivateManagedSkill = { name: string; title: string; description: string; origin: 'builtin' | 'teacher'; version: number;
  directory: string; enabled: boolean; archived: boolean; files: SkillPackageFile[] };
export type PrivateSkillCatalog = { revision: number; skills: PrivateManagedSkill[] };
export const validSkillName = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function validSkillRelative(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 && value.split('/').length <= SKILL_LIMITS.depth + 1
    && value.split('/').every(part => part.length > 0 && part.length <= 128 && part !== '.' && part !== '..'
      && !/[\\:\x00-\x1f<>"|?*]/.test(part) && !/[ .]$/.test(part) && !reserved.test(part));
}
export const exactSkillObject = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)));
const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
export function validManagedSkills(value: unknown): value is PrivateManagedSkill[] {
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.skills) return false;
  if (new Set(value.map(item => item?.name)).size !== value.length) return false;
  return value.every(item => {
    if (!exactSkillObject(item, ['name', 'title', 'description', 'origin', 'version', 'directory', 'enabled', 'archived', 'files'])
      || !validSkillName(item.name) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120
      || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 1024
      || !['builtin', 'teacher'].includes(String(item.origin)) || !Number.isSafeInteger(item.version) || Number(item.version) < 1
      || typeof item.directory !== 'string' || !new RegExp(`^versions/${item.name}/${uuid}/${item.name}$`).test(item.directory)
      || typeof item.enabled !== 'boolean' || typeof item.archived !== 'boolean' || (item.archived && (item.enabled || item.origin === 'builtin'))
      || !Array.isArray(item.files) || !item.files.length || item.files.length > SKILL_LIMITS.files) return false;
    const files = item.files as SkillPackageFile[];
    return files.every(file => exactSkillObject(file, ['relative', 'size', 'sha256']) && validSkillRelative(file.relative)
      && Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= SKILL_LIMITS.fileBytes && validHash(file.sha256))
      && new Set(files.map(file => file.relative.toLowerCase())).size === files.length
      && files.reduce((sum, file) => sum + file.size, 0) <= SKILL_LIMITS.bytes
      && files.filter(file => file.relative === 'SKILL.md' && file.size > 0 && file.size <= SKILL_LIMITS.instructionBytes).length === 1;
  });
}
/** One atomic metadata revision; texts/files are immutable version resources. */
export function createPiSkillCatalogState(sql: Sql) {
  return {
    async migrateSkillCatalog() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_skill_catalog (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version INTEGER NOT NULL DEFAULT 1,
        revision INTEGER NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    },
    async skillCatalog(): Promise<PrivateSkillCatalog> {
      const rows = await sql.all('SELECT * FROM xiaozhi_pi_skill_catalog');
      if (!rows.length) return { revision: 0, skills: [] };
      const row = rows[0];
      if (rows.length !== 1 || row.singleton !== 1 || row.schema_version !== 1 || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1
        || typeof row.payload_json !== 'string' || row.payload_json.length > 1024 * 1024) throw new Error('configuration');
      let value: unknown;
      try { value = JSON.parse(row.payload_json); } catch { throw new Error('configuration'); }
      if (!exactSkillObject(value, ['skills']) || !validManagedSkills(value.skills)) throw new Error('configuration');
      return { revision: Number(row.revision), skills: value.skills };
    },
    async saveSkillCatalog(revision: number, skills: PrivateManagedSkill[]) {
      if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER || !validManagedSkills(skills)) throw new Error('invalid_input');
      if (!sql.change) throw new Error('configuration');
      await this.skillCatalog(); // Future schema must not be silently replaced.
      const payload = JSON.stringify({ skills }), timestamp = new Date().toISOString();
      if (revision === 0) return (await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_skill_catalog
        (singleton,revision,payload_json,updated_at) VALUES(1,1,?,?)`, [payload, timestamp])) === 1;
      return (await sql.change(`UPDATE xiaozhi_pi_skill_catalog SET revision=revision+1,payload_json=?,updated_at=?
        WHERE singleton=1 AND schema_version=1 AND revision=?`, [payload, timestamp, revision])) === 1;
    },
  };
}
