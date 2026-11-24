export const acquisitionTables = {
  candidate: 'xiaozhi_acquisition_candidates_v1',
  operation: 'xiaozhi_acquisition_operations_v1',
  artifact: 'xiaozhi_acquisition_artifacts_v1',
} as const;

const definitions = Object.values(acquisitionTables).map(table => ({
  table,
  // Keep the historical SQLite spelling so existing tables can be admitted by exact schema.
  sql: `CREATE TABLE ${table} (
      id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload_json TEXT NOT NULL, document_hash TEXT NOT NULL)`,
}));
export const acquisitionTableStatements = definitions.map(({sql}) => sql.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
export const acquisitionSchema = acquisitionTableStatements.map(sql => sql + ';').join('\n');
export const legacyAcquisitionDefinitions: ReadonlyMap<string, string> = new Map(definitions.map(({table, sql}) => [table, sql]));
