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
export function createProviderHealth(options: {now?: () => number; random?: () => number; maxDomains?: number} = {}) {
  const now = options.now ?? (() => performance.now());
  const random = options.random ?? Math.random;
  const maxDomains = options.maxDomains ?? DOMAIN_LIMIT;
  const entries = new Map<string, Entry>();
  let lastNow = 0;
  const time = () => lastNow = Math.max(lastNow, now());
  const trim = (entry: Entry, at: number) => {
    entry.failures = entry.failures.filter(observed => at - observed <= FAILURE_WINDOW_MS);
  };

  function entryFor(key: string, at: number): Entry {
    const cached = entries.get(key);
    if (cached) return cached;
    if (entries.size >= maxDomains) {
      let eviction: [string, Entry] | undefined;
      for (const [id, entry] of entries) {
        trim(entry, at);
        if (entry.active || entry.failures.length || at < entry.retryAt || entry.phase === 'open' || entry.phase === 'half_open') continue;
        if (!eviction || entry.lastUsed < eviction[1].lastUsed) eviction = [id, entry];
      }
      if (!eviction) throw new ProviderHealthBlocked('capacity');
      entries.delete(eviction[0]);
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
          if (entry.retryAt <= finishedAt) entry.retryAt = 0;
          if (probe) entry.generation++;
          return;
        }
        if (outcome.kind === 'dependency_failure') {
          trim(entry, finishedAt);
          entry.failures.push(finishedAt);
          const retryAfter = Math.max(0, outcome.retryAfterMs ?? 0);
          if (probe || entry.failures.length >= FAILURE_LIMIT || retryAfter > 0 && !outcome.retryAfterOnly) reopen(entry, finishedAt, retryAfter);
          else if (retryAfter > 0) entry.retryAt = Math.max(entry.retryAt, finishedAt + retryAfter);
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
