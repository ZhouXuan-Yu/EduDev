import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';
import type {PrivateManagedSkill} from '../skill-catalog-state';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {GovernedSkill, GovernedSkillVersion, SkillMembership, SkillReview, SkillTeam} from '../../../shared/xiaozhi-skill-governance';
import {createOfficialSkillAuthority} from './official-authority';

export type SkillRecord = GovernedSkill & {legacyName: string};
export type VersionRecord = GovernedSkillVersion & {id: string; revision: number; package: PrivateManagedSkill};
export type TeamRecord = SkillTeam;
export type MembershipRecord = SkillMembership & {id: string};
export type ReviewRecord = SkillReview;
export type RunSkillSnapshot = {
  id: string;
  revision: number;
  actorId: string;
  owner: PermissionOwner;
  selected: {skillId: string; version: string; sha256: string; package: PrivateManagedSkill}[];
  unavailable?: {skillId: string; name: string; version: string; reason: string}[];
};
type Records = {
  skills: SkillRecord;
  versions: VersionRecord;
  teams: TeamRecord;
  memberships: MembershipRecord;
  reviews: ReviewRecord;
  snapshots: RunSkillSnapshot;
};
const tables = {
  skills: 'xiaozhi_skill_governance_v1',
  versions: 'xiaozhi_skill_versions_v1',
  teams: 'xiaozhi_skill_teams_v1',
  memberships: 'xiaozhi_skill_memberships_v1',
  reviews: 'xiaozhi_skill_reviews_v1',
  snapshots: 'xiaozhi_skill_run_snapshots_v1',
} as const;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const versionKey = (skillId: string, version: string) => `${skillId}@${version}`;
export const packageHash = (item: PrivateManagedSkill) => hash(JSON.stringify(item.files));

/** Auxiliary Skill facts share the original SQLite writer and transaction queue. */
export function createSkillGovernanceState(sql: Sql) {
  const officialAuthority = createOfficialSkillAuthority(sql);
  async function list<K extends keyof Records>(kind: K, work = sql): Promise<Records[K][]> {
    const rows = await work.all(`SELECT id,revision,payload_json,payload_hash FROM ${tables[kind]} ORDER BY id`);
    return rows.map(row => {
      if (typeof row.payload_json !== 'string' || row.payload_json.length > 1024 * 1024
        || hash(row.payload_json) !== row.payload_hash) throw new Error('configuration');
      const value = JSON.parse(row.payload_json) as Records[K];
      if (!value || typeof value !== 'object' || value.id !== row.id || value.revision !== row.revision
        || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('configuration');
      if (kind === 'versions') {
        const version = value as VersionRecord;
        if (version.id !== versionKey(version.skillId, version.version)
          || version.sha256 !== packageHash(version.package)) throw new Error('configuration');
      }
      if (kind === 'memberships' && (value as MembershipRecord).userId !== row.id) throw new Error('configuration');
      if (kind === 'snapshots' && (value as RunSkillSnapshot).owner.runId !== row.id) throw new Error('configuration');
      return value;
    });
  }
  async function get<K extends keyof Records>(kind: K, id: string, work = sql) {
    return (await list(kind, work)).find(value => value.id === id) || null;
  }
  async function save<K extends keyof Records>(kind: K, record: Records[K], expected: number, work = sql) {
    if (!work.change || record.revision !== expected + 1) throw new Error('configuration');
    const previous = await get(kind, record.id, work);
    if ((previous?.revision || 0) !== expected) throw new Error('stale_version');
    if (kind === 'versions' && previous && (previous as VersionRecord).state !== 'draft') {
      const oldVersion = previous as VersionRecord;
      const nextVersion = record as VersionRecord;
      const immutable = (value: VersionRecord) => JSON.stringify({
        skillId: value.skillId, version: value.version, sha256: value.sha256, package: value.package,
        dependencies: value.dependencies, permissionRequirements: value.permissionRequirements, provenance: value.provenance,
      });
      if (immutable(oldVersion) !== immutable(nextVersion)) throw new Error('version_conflict');
    }
    if (kind === 'snapshots' && previous) throw new Error('version_conflict');
    const payload = JSON.stringify(record);
    const changed = expected === 0
      ? await work.change(`INSERT OR IGNORE INTO ${tables[kind]} (id,revision,payload_json,payload_hash) VALUES(?,?,?,?)`,
        [record.id, record.revision, payload, hash(payload)])
      : await work.change(`UPDATE ${tables[kind]} SET revision=?,payload_json=?,payload_hash=? WHERE id=? AND revision=?`,
        [record.revision, payload, hash(payload), record.id, expected]);
    if (changed !== 1) throw new Error('stale_version');
  }
  return {
    sql, list, get, save, officialAuthority,
    async migrate() {
      for (const table of Object.values(tables)) {
        await sql.run(`CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>0),
          payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL)`);
      }
      await officialAuthority.migrate();
    },
    transaction<T>(action: (work: Sql) => Promise<T>): Promise<T> {
      if (!sql.transaction) throw new Error('configuration');
      return sql.transaction(action);
    },
    async actor() {
      const users = await sql.all("SELECT id,display_name FROM users WHERE status='active' AND role='owner'");
      if (users.length !== 1 || typeof users[0].id !== 'string' || typeof users[0].display_name !== 'string') {
        throw new Error('identity_unavailable');
      }
      return {id: users[0].id, displayName: users[0].display_name};
    },
  };
}
export type SkillGovernanceState = ReturnType<typeof createSkillGovernanceState>;
