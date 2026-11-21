import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const GOAL = 'GOAL_XIAOZHI_HARNESS';
const MAXIMUM = 200;
const contextKeys = new Set(['task', 'version', 'round', 'runId', 'attempt', 'evidenceRef']);
const terminalStates = new Set(['completed', 'http_error', 'failed', 'timed_out', 'client_cancelled', 'redirect_rejected']);
const errorCodes = new Set(['upstream_error', 'upstream_timeout', 'client_cancelled', 'redirect_rejected', 'proxy_closed', 'proxy_error']);

export function budgetError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function plainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Reflect.ownKeys(value).every(key => typeof key === 'string'
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function safeLabel(value, maximum = 128) {
  return typeof value === 'string' && value.length <= maximum
    && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)
    && !/(?:sk-|bearer|api[_-]?key|password|secret|1[3-9]\d{9})/i.test(value);
}

export function validateBudgetContext(value = {}) {
  if (!plainRecord(value) || Object.keys(value).some(key => !contextKeys.has(key))) {
    throw budgetError('budget_invalid_context');
  }
  const context = {...value};
  for (const key of ['task', 'version', 'runId']) {
    if (context[key] !== undefined && !safeLabel(context[key])) throw budgetError('budget_invalid_context');
  }
  for (const key of ['round', 'attempt']) {
    if (context[key] !== undefined && (!Number.isSafeInteger(context[key]) || context[key] < 1 || context[key] > 10000)) {
      throw budgetError('budget_invalid_context');
    }
  }
  if (context.evidenceRef !== undefined && (typeof context.evidenceRef !== 'string'
      || context.evidenceRef.length > 240 || !/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(context.evidenceRef)
      || context.evidenceRef.split('/').some(part => !safeLabel(part, 128) || part === '.' || part === '..'))) {
    throw budgetError('budget_invalid_context');
  }
  return Object.freeze(context);
}

function configuration(options) {
  if (!plainRecord(options) || Object.keys(options).some(key => !['databasePath', 'limit', 'initialUsed', 'goalId'].includes(key))
      || typeof options.databasePath !== 'string' || !path.isAbsolute(options.databasePath)
      || options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > MAXIMUM)
      || options.initialUsed !== undefined && (!Number.isSafeInteger(options.initialUsed) || options.initialUsed < 0 || options.initialUsed > MAXIMUM)
      || options.goalId !== undefined && !safeLabel(options.goalId)) {
    throw budgetError('budget_invalid_configuration');
  }
}

/** Dedicated acceptance ledger. Every committed reservation is permanently counted. */
export function openBudgetLedger(options) {
  configuration(options);
  fs.mkdirSync(path.dirname(options.databasePath), {recursive: true});
  const database = new DatabaseSync(options.databasePath);
  let closed = false;
  function transaction(action) {
    if (closed) throw budgetError('budget_closed');
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  function event(reservationId, kind, details = {}) {
    database.prepare('INSERT INTO phase8_attempt_events(reservation_id,kind,created_at,details_json) VALUES(?,?,?,?)')
      .run(reservationId, kind, new Date().toISOString(), JSON.stringify(details));
  }
  function metadata() {
    const row = database.prepare(`SELECT meta.*, authorization.mode, authorization.authorized_at,
      (SELECT count(*) FROM phase8_http_attempts) AS attempts
      FROM phase8_budget_meta AS meta LEFT JOIN phase8_budget_authorization AS authorization USING(id)
      WHERE meta.id=1`).get();
    if (!row || row.schema_version !== 1 || !safeLabel(row.goal_id)
        || !Number.isInteger(row.allowance) || row.allowance < 1 || row.allowance > MAXIMUM
        || !Number.isInteger(row.initial_used) || row.initial_used < 0 || row.initial_used > row.allowance) {
      throw budgetError('budget_corrupt');
    }
    return row;
  }
  function used(meta) {
    const total = meta.initial_used + meta.attempts;
    if (meta.mode !== 'unlimited' && total > meta.allowance) throw budgetError('budget_corrupt');
    return total;
  }
  function attempt(reservationId) {
    if (typeof reservationId !== 'string' || !/^p8_[a-f0-9-]{36}$/.test(reservationId)) {
      throw budgetError('budget_invalid_reservation');
    }
    const row = database.prepare('SELECT * FROM phase8_http_attempts WHERE reservation_id=?').get(reservationId);
    if (!row) throw budgetError('budget_missing_reservation');
    return row;
  }
  function project(row) {
    return {sequence: row.sequence, reservationId: row.reservation_id, context: JSON.parse(row.context_json),
      state: row.state, reservedAt: row.reserved_at, dispatchAt: row.dispatch_at, responseAt: row.response_at,
      finishedAt: row.finished_at, httpStatus: row.http_status, errorCode: row.error_code,
      elapsedMs: row.elapsed_ms, requestBytes: row.request_bytes, responseBytes: row.response_bytes};
  }
  try {
    database.exec('PRAGMA busy_timeout=10000');
    database.exec('PRAGMA journal_mode=WAL');
    database.exec('PRAGMA synchronous=FULL');
    database.exec('PRAGMA foreign_keys=ON');
    transaction(() => {
      database.exec(`CREATE TABLE IF NOT EXISTS phase8_budget_meta(
        id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL CHECK(schema_version=1),
        goal_id TEXT NOT NULL,allowance INTEGER NOT NULL CHECK(allowance BETWEEN 1 AND 200),
        initial_used INTEGER NOT NULL CHECK(initial_used BETWEEN 0 AND allowance),created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS phase8_http_attempts(
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,reservation_id TEXT UNIQUE NOT NULL,context_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('reserved','dispatching','response','completed','http_error','failed','timed_out','client_cancelled','redirect_rejected')),
        reserved_at TEXT NOT NULL,dispatch_at TEXT,response_at TEXT,finished_at TEXT,http_status INTEGER,error_code TEXT,
        elapsed_ms REAL,request_bytes INTEGER NOT NULL DEFAULT 0,response_bytes INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS phase8_attempt_events(
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,reservation_id TEXT NOT NULL REFERENCES phase8_http_attempts(reservation_id),
        kind TEXT NOT NULL,created_at TEXT NOT NULL,details_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS phase8_budget_authorization(
        id INTEGER PRIMARY KEY CHECK(id=1) REFERENCES phase8_budget_meta(id),
        mode TEXT NOT NULL CHECK(mode='unlimited'),authorized_at TEXT NOT NULL);`);
      const previous = database.prepare('SELECT * FROM phase8_budget_meta WHERE id=1').get();
      if (!previous) {
        if (Number(database.prepare('SELECT count(*) AS count FROM phase8_http_attempts').get().count) !== 0) {
          throw budgetError('budget_corrupt');
        }
        const allowance = options.limit ?? MAXIMUM;
        const initialUsed = options.initialUsed ?? 0;
        if (initialUsed > allowance) throw budgetError('budget_invalid_configuration');
        database.prepare('INSERT INTO phase8_budget_meta VALUES(1,1,?,?,?,?)')
          .run(options.goalId ?? GOAL, allowance, initialUsed, new Date().toISOString());
        database.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES('phase8_http_attempts',?)").run(initialUsed);
      }
      const meta = metadata();
      if (options.limit !== undefined && options.limit !== meta.allowance
          || options.initialUsed !== undefined && options.initialUsed !== meta.initial_used
          || options.goalId !== undefined && options.goalId !== meta.goal_id) {
        throw budgetError('budget_configuration_conflict');
      }
      used(meta);
    });
  } catch (error) {
    database.close();
    throw error;
  }

  return {
    authorizeUnlimited() {
      return transaction(() => {
        const meta = metadata();
        if (meta.goal_id !== GOAL) throw budgetError('budget_configuration_conflict');
        used(meta);
        database.prepare("INSERT INTO phase8_budget_authorization VALUES(1,'unlimited',?) ON CONFLICT(id) DO NOTHING")
          .run(new Date().toISOString());
      });
    },
    reserve(rawContext = {}) {
      const context = validateBudgetContext(rawContext);
      return transaction(() => {
        const meta = metadata();
        const consumed = used(meta);
        if (meta.mode !== 'unlimited' && consumed >= meta.allowance) throw budgetError('budget_exhausted');
        const reservationId = 'p8_' + randomUUID();
        const createdAt = new Date().toISOString();
        const insertion = database.prepare("INSERT INTO phase8_http_attempts(reservation_id,context_json,state,reserved_at) VALUES(?,?,'reserved',?)")
          .run(reservationId, JSON.stringify(context), createdAt);
        const sequence = Number(insertion.lastInsertRowid);
        const recordedContext = {...context, attempt: context.attempt ?? sequence};
        database.prepare('UPDATE phase8_http_attempts SET context_json=? WHERE reservation_id=?')
          .run(JSON.stringify(recordedContext), reservationId);
        event(reservationId, 'reserved');
        return project(attempt(reservationId));
      });
    },
    markDispatching(reservationId, requestBytes = 0) {
      if (!Number.isSafeInteger(requestBytes) || requestBytes < 0) throw budgetError('budget_invalid_outcome');
      return transaction(() => {
        const row = attempt(reservationId);
        if (row.state !== 'reserved') throw budgetError('budget_state_conflict');
        database.prepare("UPDATE phase8_http_attempts SET state='dispatching',dispatch_at=?,request_bytes=? WHERE reservation_id=? AND state='reserved'")
          .run(new Date().toISOString(), requestBytes, reservationId);
        event(reservationId, 'dispatching');
      });
    },
    markResponse(reservationId, httpStatus) {
      if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) throw budgetError('budget_invalid_outcome');
      return transaction(() => {
        if (attempt(reservationId).state !== 'dispatching') throw budgetError('budget_state_conflict');
        database.prepare("UPDATE phase8_http_attempts SET state='response',response_at=?,http_status=? WHERE reservation_id=?")
          .run(new Date().toISOString(), httpStatus, reservationId);
        event(reservationId, 'response', {httpStatus});
      });
    },
    finish(reservationId, outcome) {
      if (!plainRecord(outcome) || Object.keys(outcome).some(key => !['state', 'errorCode', 'elapsedMs', 'responseBytes'].includes(key))
          || !terminalStates.has(outcome.state) || outcome.errorCode !== undefined && !errorCodes.has(outcome.errorCode)
          || !Number.isFinite(outcome.elapsedMs) || outcome.elapsedMs < 0
          || !Number.isSafeInteger(outcome.responseBytes) || outcome.responseBytes < 0) {
        throw budgetError('budget_invalid_outcome');
      }
      return transaction(() => {
        const previous = attempt(reservationId);
        if (terminalStates.has(previous.state)
            || ['completed', 'http_error', 'redirect_rejected'].includes(outcome.state) && previous.state !== 'response'
            || ['timed_out', 'client_cancelled'].includes(outcome.state) && previous.state === 'reserved'
            || outcome.state === 'completed' && (previous.http_status < 200 || previous.http_status > 299)
            || outcome.state === 'http_error' && previous.http_status < 400
            || outcome.state === 'redirect_rejected' && (previous.http_status < 300 || previous.http_status > 399)) {
          throw budgetError('budget_state_conflict');
        }
        database.prepare('UPDATE phase8_http_attempts SET state=?,finished_at=?,error_code=?,elapsed_ms=?,response_bytes=? WHERE reservation_id=?')
          .run(outcome.state, new Date().toISOString(), outcome.errorCode ?? null, outcome.elapsedMs, outcome.responseBytes, reservationId);
        event(reservationId, outcome.state, {errorCode: outcome.errorCode ?? null});
      });
    },
    bindRun(reservationId, runId) {
      validateBudgetContext({runId});
      return transaction(() => {
        const row = attempt(reservationId);
        const context = JSON.parse(row.context_json);
        if (context.runId === runId) return;
        if (context.runId) throw budgetError('budget_context_conflict');
        database.prepare('UPDATE phase8_http_attempts SET context_json=? WHERE reservation_id=? AND context_json=?')
          .run(JSON.stringify({...context, runId}), reservationId, row.context_json);
        event(reservationId, 'run_bound', {runId});
      });
    },
    summary() {
      const meta = metadata();
      const consumed = used(meta);
      const unlimited = meta.mode === 'unlimited';
      return {schemaVersion: 1, goalId: meta.goal_id, limit: unlimited ? null : meta.allowance, initialUsed: meta.initial_used,
        used: consumed, remaining: unlimited ? null : meta.allowance - consumed,
        ...(unlimited ? {authorization: {mode: meta.mode, authorizedAt: meta.authorized_at, previousLimit: meta.allowance}} : {}),
        unresolved: Number(database.prepare("SELECT count(*) AS count FROM phase8_http_attempts WHERE finished_at IS NULL").get().count),
        durability: {journalMode: database.prepare('PRAGMA journal_mode').get().journal_mode,
          synchronous: database.prepare('PRAGMA synchronous').get().synchronous}};
    },
    attempts: () => database.prepare('SELECT * FROM phase8_http_attempts ORDER BY sequence').all().map(project),
    events(reservationId) {
      attempt(reservationId);
      return database.prepare('SELECT * FROM phase8_attempt_events WHERE reservation_id=? ORDER BY sequence').all(reservationId)
        .map(row => ({sequence: row.sequence, kind: row.kind, createdAt: row.created_at, details: JSON.parse(row.details_json)}));
    },
    close() {
      if (!closed) {closed = true; database.close();}
    },
  };
}
