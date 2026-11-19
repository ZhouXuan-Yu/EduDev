import type {Sql} from '../../session-state';
import {serializeStateWrites} from '../../serialized-state-sql';
import {protocolHash} from '../validation';
import type {CapabilityCandidate, AcquisitionOperationView, AcquisitionArtifactView} from '../../../../shared/xiaozhi-acquisition';
import type {PermissionOwner} from '../../../../shared/xiaozhi-permissions';
import type {PreparedStdioBinding} from '../../mcp-controlled-service';
import type {LockedNpmPackage} from './npm-source';

export type AcquisitionOperation = AcquisitionOperationView & {
  owner: PermissionOwner;
  candidateHash: string;
  requirementsVersion: number;
  plan?: {artifactId: string; digest: string; directory: string; lock: LockedNpmPackage[]};
};
export type AcquisitionArtifact = AcquisitionArtifactView & {
  sourceHash: string;
  ownerTaskId: string;
  recipeId: string;
  serverId: string | null;
  filesHash: string;
  binding: PreparedStdioBinding;
  installedFiles: {path: string; bytes: number; sha256: string}[];
  validationRefs: string[];
  attestation: {signature: 'verified' | 'unavailable' | 'untrusted'; provenance: 'verified' | 'unavailable' | 'untrusted'};
};
const tables = {candidate: 'xiaozhi_acquisition_candidates_v1', operation: 'xiaozhi_acquisition_operations_v1', artifact: 'xiaozhi_acquisition_artifacts_v1'} as const;

export function readAcquisitionRow<T>(row: Record<string, unknown> | undefined): T | null {
  if (!row) return null;
  const value = JSON.parse(String(row.payload_json));
  if (protocolHash(value) !== row.document_hash || value.id !== row.id
      || value.revision !== undefined && value.revision !== Number(row.revision)) throw Error('acquisition_state_corrupt');
  return value as T;
}

/** Acquisition facts reuse the original Sql transaction/writer and immutable package files. */
export function createAcquisitionState(source: Sql) {
  const sql = serializeStateWrites(source);
  let migrated: Promise<void> | undefined;
  const migrate = () => migrated ||= (async () => {
    for (const table of Object.values(tables)) await sql.run(`CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload_json TEXT NOT NULL, document_hash TEXT NOT NULL)`);
  })().catch(error => {migrated = undefined; throw error;});
  function read<T>(row: Record<string, unknown> | undefined): T | null {
    return readAcquisitionRow<T>(row);
  }
  async function get<T>(table: string, id: string) {await migrate(); return read<T>((await sql.all(`SELECT * FROM ${table} WHERE id=?`, [id]))[0]);}
  async function list<T>(table: string) {await migrate(); return (await sql.all(`SELECT * FROM ${table} ORDER BY id`)).map(row => read<T>(row)!);}
  async function save<T extends {id: string; revision: number}>(table: string, value: T, expected: number) {
    const frozen = structuredClone(value);
    await migrate();
    if (frozen.revision !== expected + 1) throw Error('conflict');
    return sql.transaction!(async work => {
      const prior = (await work.all(`SELECT revision FROM ${table} WHERE id=?`, [frozen.id]))[0];
      if (Number(prior?.revision || 0) !== expected) throw Error('conflict');
      await work.run(`INSERT INTO ${table}(id,revision,payload_json,document_hash) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json,document_hash=excluded.document_hash`,
      [frozen.id, frozen.revision, JSON.stringify(frozen), protocolHash(frozen)]);
      return frozen;
    });
  }
  return {
    migrate,
    async cache(candidates: CapabilityCandidate[]) {
      const frozen = structuredClone(candidates);
      await migrate();
      await sql.transaction!(async work => {
        for (const candidate of frozen) {
          if (candidate.id !== 'xicandidate_' + protocolHash({source: candidate.source, externalId: candidate.externalId, version: candidate.version})) throw Error('invalid_input');
          const prior = read<CapabilityCandidate>((await work.all(`SELECT * FROM ${tables.candidate} WHERE id=?`, [candidate.id]))[0]);
          if (prior && prior.sourceHash !== candidate.sourceHash) throw Error('source_changed');
          await work.run(`INSERT INTO ${tables.candidate}(id,revision,payload_json,document_hash) VALUES(?,1,?,?)
            ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,document_hash=excluded.document_hash`,
          [candidate.id, JSON.stringify(candidate), protocolHash(candidate)]);
        }
      });
    },
    candidate: (id: string) => get<CapabilityCandidate>(tables.candidate, id),
    candidates: () => list<CapabilityCandidate>(tables.candidate),
    operation: (id: string) => get<AcquisitionOperation>(tables.operation, id),
    operations: () => list<AcquisitionOperation>(tables.operation),
    artifact: (id: string) => get<AcquisitionArtifact>(tables.artifact, id),
    artifacts: () => list<AcquisitionArtifact>(tables.artifact),
    async artifactBySource(sourceHash: string) {
      await migrate();
      return read<AcquisitionArtifact>((await sql.all(`SELECT * FROM ${tables.artifact} WHERE json_extract(payload_json,'$.sourceHash')=?`, [sourceHash]))[0]);
    },
    saveOperation: (value: AcquisitionOperation, expected: number) => save(tables.operation, value, expected),
    saveArtifact: (value: AcquisitionArtifact, expected: number) => save(tables.artifact, value, expected),
  };
}
export type AcquisitionState = ReturnType<typeof createAcquisitionState>;
