// Hana 0.449.0, Apache-2.0. AST-extracted runtime seam; see source-manifest.json.
// Education host owns full-request admission and injects native compaction.
export const MIN_COMPACTION_RESERVE_TOKENS = 16_384;
const COMPACTION_RESERVE_RATIO = 0.1;
const MIDRUN_COMPACTION_INSTALLED = Symbol("hanaMidRunCompaction");

export function computeCompactionReserveTokens(contextWindow: any): number {
  const window = Number(contextWindow);
  if (!Number.isFinite(window) || window <= 0) return MIN_COMPACTION_RESERVE_TOKENS;
  return Math.max(MIN_COMPACTION_RESERVE_TOKENS, Math.ceil(window * COMPACTION_RESERVE_RATIO));
}

export function installMidRunCompaction(session: any, deps: {
  usageLedger?: any;
  buildUsageContext?: ((session: any) => any) | null;
  runCompaction?: (session: any, options: any) => Promise<any>;
} = {}): void {
  const agent = session?.agent;
  if (!agent) return;
  if (agent[MIDRUN_COMPACTION_INSTALLED]) return;

  const resolved = {
    usageLedger: deps.usageLedger ?? null,
    buildUsageContext: deps.buildUsageContext ?? null,
    runCompaction: deps.runCompaction ?? (() => { throw new Error("configuration"); }),
  };

  const previous = agent.prepareNextTurnWithContext
    ?? (agent.prepareNextTurn
      ? async (_turn: any, signal: any) => await agent.prepareNextTurn?.(signal)
      : undefined);

  agent.prepareNextTurnWithContext = async (turn: any, signal: any) => {
    const snapshot = await previous?.(turn, signal);
    const compacted = Boolean(await resolved.runCompaction(session, { turn: { ...turn, context: snapshot?.context ?? turn?.context }, signal }));
    if (!compacted) return snapshot;
    const messages = Array.isArray(session.agent?.state?.messages)
      ? session.agent.state.messages.slice()
      : null;
    if (!messages) return snapshot;
    const base = snapshot?.context ?? turn?.context;
    return { ...snapshot, context: { ...base, messages } };
  };
  agent[MIDRUN_COMPACTION_INSTALLED] = true;
}
