const FAILURE_LIMIT = 3;
const FAILURE_WINDOW_MS = 60_000;
const INITIAL_COOLDOWN_MS = 10_000;
const MAX_COOLDOWN_MS = 60_000;
const DOMAIN_LIMIT = 128;

export class ProviderHealthBlocked extends Error {
  readonly reason: 'cooldown' | 'active' | 'capacity';
  readonly retryAt?: number;
  constructor(reason: ProviderHealthBlocked['reason'], retryAt?: number) {
    super('provider_unavailable');
    this.reason = reason;
    this.retryAt = retryAt;
  }
}

export type ProviderHealthOutcome =
  | {kind: 'verified' | 'ignored'}
  | {kind: 'dependency_failure'; retryAfterMs?: number; retryAfterOnly?: boolean};

export type ProviderCooldown = {key: string; savedAt: number; until: number; cooldown: number};
type Persistence = {load: () => Promise<readonly ProviderCooldown[]>; save: (rows: readonly ProviderCooldown[]) => Promise<void>};

type Entry = {
  failures: number[];
  active: number;
  phase: 'unknown' | 'closed' | 'open' | 'half_open' | 'retired';
  generation: number;
  retryAt: number;
  cooldown: number;
  lastUsed: number;
};

/** Shared within the desktop host. A token is settled by the physical owner. */
export function createProviderHealth(options: {now?: () => number; wallNow?: () => number; random?: () => number;
  maxDomains?: number; persistence?: Persistence} = {}) {
  const now = options.now ?? (() => performance.now());
  const wallNow = options.wallNow ?? Date.now;
  const random = options.random ?? Math.random;
  const maxDomains = options.maxDomains ?? DOMAIN_LIMIT;
  const entries = new Map<string, Entry>();
  const saved = new Map<string, ProviderCooldown>();
  let restored: Promise<void> | undefined;
  let pendingWrite = Promise.resolve();
  let lastNow = 0;
  const time = () => lastNow = Math.max(lastNow, now());
  const trim = (entry: Entry, at: number) => {
    entry.failures = entry.failures.filter(observed => at - observed <= FAILURE_WINDOW_MS);
  };

  async function ready() {
    if (!options.persistence) return;
    restored ??= (async () => {
      const rows = await options.persistence!.load(), at = time(), wall = wallNow();
      for (const row of rows) {
        if (wall - row.until > FAILURE_WINDOW_MS) continue;
        const remaining = Math.max(0, row.until - Math.max(row.savedAt, wall));
        entries.set(row.key, {failures: [], active: 0, phase: row.cooldown ? 'open' : 'unknown',
          generation: 0, retryAt: at + remaining, cooldown: row.cooldown, lastUsed: at});
        saved.set(row.key, row);
      }
    })();
    await restored;
    await pendingWrite;
  }

  function saveCooldown(key: string, entry?: Entry) {
    if (!options.persistence) return;
    const remaining = entry ? entry.retryAt - time() : 0;
    if (entry && remaining > 0) {
      const previous = saved.get(key);
      const savedAt = Math.max(previous?.savedAt ?? 0, Math.floor(wallNow()));
      const until = Math.max(previous?.until ?? 0, Math.min(Number.MAX_SAFE_INTEGER, savedAt + Math.ceil(remaining)));
      saved.set(key, {key, savedAt, until, cooldown: entry.cooldown});
    } else if (!saved.delete(key)) return;
    const rows = [...saved.values()];
    pendingWrite = pendingWrite.then(() => options.persistence!.save(rows));
    // Admissions and the original owner await persistence. Keep detached callers observed too.
    void pendingWrite.catch(() => undefined);
    return pendingWrite;
  }

  function entryFor(key: string, at: number): Entry {
    const cached = entries.get(key);
    if (cached) return cached;
    if (entries.size >= maxDomains) {
      let eviction: [string, Entry] | undefined;
      for (const [id, entry] of entries) {
        trim(entry, at);
        if (entry.active || entry.failures.length || at < entry.retryAt || entry.phase === 'half_open'
            || entry.phase === 'open' && at - entry.lastUsed <= FAILURE_WINDOW_MS) continue;
        if (!eviction || entry.lastUsed < eviction[1].lastUsed) eviction = [id, entry];
      }
      if (!eviction) throw new ProviderHealthBlocked('capacity');
      entries.delete(eviction[0]);
      saveCooldown(eviction[0]);
    }
    const entry: Entry = {failures: [], active: 0, phase: 'unknown', generation: 0, retryAt: 0, cooldown: 0, lastUsed: at};
    entries.set(key, entry);
    return entry;
  }

  function reopen(entry: Entry, at: number, retryAfterMs: number) {
    const unjittered = Math.min(MAX_COOLDOWN_MS, entry.cooldown ? 2 * entry.cooldown : INITIAL_COOLDOWN_MS);
    const local = Math.min(MAX_COOLDOWN_MS, unjittered * (1 + 0.2 * Math.min(1, Math.max(0, random()))));
    entry.cooldown = unjittered;
    entry.retryAt = Math.max(entry.retryAt, at + Math.max(local, retryAfterMs));
    entry.phase = 'open';
    entry.generation++;
  }

  return {
    ready,
    async revalidateAfterResume() {
      await ready();
      const at = time();
      for (const entry of entries.values()) {
        if (entry.phase === 'retired') continue;
        entry.phase = 'open';
        entry.retryAt = Math.max(entry.retryAt, at);
        entry.generation++;
      }
    },
    begin(key: string, allowsVerification: boolean) {
      const at = time(), entry = entryFor(key, at);
      const probe = entry.phase === 'open';
      if (entry.phase === 'retired' || entry.phase === 'half_open') throw new ProviderHealthBlocked('active');
      if (!probe && at < entry.retryAt) throw new ProviderHealthBlocked('cooldown', entry.retryAt);
      if (probe && (!allowsVerification || at < entry.retryAt)) throw new ProviderHealthBlocked('cooldown', entry.retryAt);
      if (probe && entry.active) throw new ProviderHealthBlocked('active');
      if (probe) entry.phase = 'half_open';
      trim(entry, at);
      entry.lastUsed = at;
      entry.active++;
      const generation = entry.generation;
      let settled = false;
      return {complete(outcome: ProviderHealthOutcome) {
        if (settled) return;
        settled = true;
        entry.active--;
        if (entry.phase === 'retired') {
          if (!entry.active) entries.delete(key);
          return;
        }
        if (entry.generation !== generation) return;
        const finishedAt = time();
        entry.lastUsed = finishedAt;
        if (outcome.kind === 'verified') {
          entry.phase = 'closed';
          entry.failures.length = 0;
          entry.cooldown = 0;
          const waiting = entry.retryAt > finishedAt;
          if (!waiting) entry.retryAt = 0;
          if (probe) entry.generation++;
          if (!waiting) return saveCooldown(key);
          return;
        }
        if (outcome.kind === 'dependency_failure') {
          trim(entry, finishedAt);
          entry.failures.push(finishedAt);
          const retryAfter = Math.max(0, outcome.retryAfterMs ?? 0);
          if (probe || entry.failures.length >= FAILURE_LIMIT || retryAfter > 0 && !outcome.retryAfterOnly) reopen(entry, finishedAt, retryAfter);
          else if (retryAfter > 0) entry.retryAt = Math.max(entry.retryAt, finishedAt + retryAfter);
          if (entry.retryAt > finishedAt) return saveCooldown(key, entry);
          return;
        }
        if (probe) entry.phase = 'open';
      }};
    },
    retire(key: string) {
      const entry = entries.get(key);
      if (!entry) return;
      if (entry.active) entry.phase = 'retired';
      else entries.delete(key);
      return saveCooldown(key);
    },
    snapshot(key: string) {
      const entry = entries.get(key);
      if (!entry) return {phase: 'unknown', failures: 0, active: 0, retryAt: 0};
      trim(entry, time());
      return {phase: entry.phase, failures: entry.failures.length, active: entry.active, retryAt: entry.retryAt};
    }
  };
}

export type ProviderHealth = ReturnType<typeof createProviderHealth>;
export type ProviderHealthAttempt = ReturnType<ProviderHealth['begin']>;
