// Extracted unchanged from mu; MIT. See source-manifest.json.
export const ABSTAIN: unique symbol = Symbol("kyrn.judge.abstain");

/** Batches up to this size record each item's answers in the ledger. */
const MAX_BATCH_ANSWERS = 8;
export type Abstain = typeof ABSTAIN;

/**
 * - `off`: the judge is not called; the fallback is returned.
 * - `shadow`: the judge is called and recorded, but the fallback is returned.
 *   New decision points start here until their verdicts have been compared
 *   with outcomes.
 * - `active`: the judged outcome is returned unless the policy abstains or the call fails.
 */
export type DecisionMode = "off" | "shadow" | "active";

/**
 * What acting on the decision does to the provider prompt cache.
 * `prefix-mutating` decisions rewrite earlier context and should only be
 * applied at cache boundaries (session start, after compaction, cold cache).
 */
export type CacheImpact = "none" | "append-only" | "prefix-mutating";

/** `inline` blocks the agent loop, `parallel` races other work, `background` never blocks. */
export type LatencyClass = "inline" | "parallel" | "background";

