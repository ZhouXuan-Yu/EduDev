export const historyMemorySchema = `
CREATE TABLE memory_source_access (
  source_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('history_request','history_control')),
  session_id TEXT NOT NULL, record_id TEXT NOT NULL, source_version TEXT NOT NULL,
  access_revision INTEGER NOT NULL CHECK(access_revision>0), generation INTEGER NOT NULL CHECK(generation>0),
  index_allowed INTEGER NOT NULL CHECK(index_allowed IN (0,1)),
  discover_allowed INTEGER NOT NULL CHECK(discover_allowed IN (0,1)),
  memory_state TEXT NOT NULL CHECK(memory_state IN ('active','disabled','forgotten')),
  updated_at TEXT NOT NULL, UNIQUE(kind,session_id,record_id)
);
CREATE INDEX memory_source_discovery ON memory_source_access(discover_allowed,memory_state,source_id);
CREATE TABLE memory_index_catalog (
  document_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES memory_source_access(source_id),
  source_version TEXT NOT NULL, generation INTEGER NOT NULL, index_generation INTEGER NOT NULL,
  index_namespace TEXT NOT NULL, content_hash TEXT NOT NULL, projection_version INTEGER NOT NULL,
  sanitizer_version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('ready','obsolete')),
  verified_at TEXT NOT NULL
);
CREATE TABLE memory_index_jobs (
  job_id TEXT PRIMARY KEY, action TEXT NOT NULL CHECK(action IN ('upsert','delete')),
  document_id TEXT NOT NULL, source_id TEXT NOT NULL REFERENCES memory_source_access(source_id),
  source_version TEXT NOT NULL, generation INTEGER NOT NULL, index_generation INTEGER NOT NULL,
  index_namespace TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','running','retry','succeeded','cancelled','failed')),
  attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, next_attempt_at INTEGER NOT NULL DEFAULT 0,
  operation_id TEXT, last_error TEXT
);
CREATE INDEX memory_index_jobs_work ON memory_index_jobs(state,next_attempt_at,job_id);
CREATE INDEX memory_index_jobs_source ON memory_index_jobs(source_id,generation,action);
CREATE TABLE memory_history_index_state (
  id INTEGER PRIMARY KEY CHECK(id=1), active_generation INTEGER NOT NULL CHECK(active_generation>0),
  rebuild_generation INTEGER CHECK(rebuild_generation>active_generation)
);
INSERT INTO memory_history_index_state(id,active_generation) VALUES(1,1);
`;
