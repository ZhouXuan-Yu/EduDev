/** Main-only. Pins come from the host's authorized selection or confirmed preference policy.
 * Discovery results, renderer input and provider scores cannot supply grants.
 */
type Layer = 'history' | 'personal' | 'L2' | 'L3' | 'preference';
type Pin = {
  layer: Layer; source: string; id: string; version: number;
  fingerprint: string; sourceVersion?: string;
};
const teachingDimensions = ['teacher', 'classRef', 'termRef', 'courseRef', 'subject', 'grade',
  'textbook', 'taskType', 'artifactType', 'taskId', 'artifactId'] as const;
type TeachingScope = Partial<Record<typeof teachingDimensions[number], string>>;
type SourceFact = Pin & {
  state: string; provenance: string; scope: TeachingScope | null;
  relevant: boolean; relevance: number; conflicts?: boolean;
};
type HostSnapshot = {
  sessionId: string; requestId: string; authority: string; scopeVersion: number;
  scope: TeachingScope; enabled: boolean; selections: Pin[]; preferences: Pin[];
  named: Pin[]; availableTokens: number;
};
type Reference = Pick<Pin, 'layer' | 'source' | 'id' | 'version'>;
type Decision = Reference & {reason: 'named' | 'task' | 'teaching_scope' | 'global'};
const scopeFields = new Set(teachingDimensions);

function identity(ref: Reference) {
  return JSON.stringify([ref.layer, ref.source, ref.id]);
}
function samePin(a: Pin, b: Pin) {
  return a.version === b.version && a.fingerprint === b.fingerprint && a.sourceVersion === b.sourceVersion;
}
function validPin(pin: Pin) {
  return typeof pin.id === 'string' && pin.id.trim().length > 0 && pin.id.length <= 160
    && typeof pin.source === 'string' && pin.source.trim().length > 0 && pin.source.length <= 160
    && Number.isSafeInteger(pin.version) && pin.version > 0 && /^[a-f0-9]{64}$/.test(pin.fingerprint)
    && (!['history','personal'].includes(pin.layer) || (pin.source === pin.layer
      && typeof pin.sourceVersion === 'string' && pin.sourceVersion.trim().length > 0));
}
function grantedPins(host: HostSnapshot): Pin[] {
  if (!Number.isSafeInteger(host.scopeVersion) || host.scopeVersion < 0) return [];
  const preferencePins = new Map<string, Pin>();
  const conflicts = new Set<string>();
  for (const pin of host.preferences) {
    if (pin.layer !== 'preference' || !validPin(pin)) continue;
    const key = identity(pin), prior = preferencePins.get(key);
    if (prior && !samePin(prior, pin)) conflicts.add(key);
    preferencePins.set(key, pin);
  }
  const preferences = [...preferencePins].filter(([key]) => !conflicts.has(key)).map(([,pin]) => pin);
  if (host.enabled !== true || host.selections.length > 12) return preferences;
  const explicit = host.selections.filter(pin => ['history','personal','L2','L3'].includes(pin.layer) && validPin(pin));
  const unique = new Set(explicit.map(identity));
  return unique.size === explicit.length && explicit.length === host.selections.length
    ? [...preferences, ...explicit] : preferences;
}

function scopePriority(scope: TeachingScope | null, current: TeachingScope) {
  if (!scope) return -1;
  const keys = Object.keys(scope) as (keyof TeachingScope)[];
  if (!keys.length) return -1;
  for (const key of keys) {
    const value = scope[key];
    if (!scopeFields.has(key) || typeof value !== 'string' || !value.trim()) return -1;
    if (key === 'teacher') {
      if (scope[key] !== 'self') return -1;
    } else if (scope[key] !== current[key]) return -1;
  }
  if (scope.taskId || scope.artifactId) return 3;
  if (scope.classRef || scope.courseRef || scope.termRef) return 2;
  return keys.some(key => key !== 'teacher') ? 1 : 0;
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Both planners spend from the same conservative fraction of remaining context.
export const REFERENCE_CONTEXT_FACTOR=20;

export async function assembleRequestMemory<History extends {projection:string}, Personal>(
  available:number,
  loadHistory:(remaining:number)=>Promise<History|undefined>|undefined,
  loadPersonal:(remaining:number)=>Promise<Personal|undefined>|undefined,
) {
  const historyPlan=await loadHistory(available);
  const used=historyPlan?.projection
    ? (Buffer.byteLength(JSON.stringify(historyPlan.projection)) + 4)*REFERENCE_CONTEXT_FACTOR
    : 0;
  const personalPlan=await loadPersonal(Math.max(0,available-used));
  return {historyPlan,personalPlan};
}

function projectionBudget(availableTokens: number) {
  return Number.isSafeInteger(availableTokens) && availableTokens > 0
    ? Math.min(1024, Math.floor(availableTokens / REFERENCE_CONTEXT_FACTOR)) : 0;
}

function referenceOf({layer,source,id,version}: Pin): Reference {
  return {layer,source,id,version};
}

/** Only whole references are projected. Their independent host read still has to succeed.
 * UTF-8 byte length conservatively budgets the reference array including punctuation.
 */
export function planMemoryUse(host: HostSnapshot, facts: readonly SourceFact[]) {
  const grants = new Map<string, Pin>();
  const ambiguous = new Set<string>();
  for (const pin of grantedPins(host)) {
    const key = identity(pin), prior = grants.get(key);
    if (prior && !samePin(pin,prior)) ambiguous.add(key);
    grants.set(key,pin);
  }
  const candidates = new Map<string, SourceFact>();
  const named = new Set(host.named.filter(pin => {
    const grant = grants.get(identity(pin));
    return grant && samePin(grant, pin);
  }).map(identity));
  for (const fact of facts) {
    const key = identity(fact), grant = grants.get(key);
    if (!grant) continue;
    const prior = candidates.get(key);
    if (!samePin(fact, grant) || fact.state !== 'active' || fact.relevant !== true
      || fact.conflicts || !['exact','event_refs'].includes(fact.provenance)
      || scopePriority(fact.scope,host.scope) < 0 || !Number.isFinite(fact.relevance)
      || (prior && (prior.provenance !== fact.provenance || prior.relevance !== fact.relevance
        || [...scopeFields].some(field => prior.scope?.[field as keyof TeachingScope] !== fact.scope?.[field as keyof TeachingScope])))) {
      ambiguous.add(key);
    }
    candidates.set(key,fact);
  }
  const ranked = [...candidates].filter(([key]) => !ambiguous.has(key)).map(([key, fact]) => ({
    key, fact, named: named.has(key), priority: scopePriority(fact.scope,host.scope),
  }));
  ranked.sort((a,b) => Number(b.named) - Number(a.named) || b.priority - a.priority
    || Number(b.fact.provenance === 'exact') - Number(a.fact.provenance === 'exact')
    || b.fact.relevance - a.fact.relevance || compareText(a.key,b.key));
  const budget = projectionBudget(host.availableTokens);
  const items: Decision[] = [], serialized: string[] = [];
  let bytes = 2; // Array brackets.
  for (const {fact, named: direct, priority} of ranked) {
    const ref = referenceOf(fact);
    const json = JSON.stringify(ref), cost = Buffer.byteLength(json) + Number(serialized.length > 0);
    if (bytes + cost > budget) continue;
    bytes += cost;
    serialized.push(json);
    items.push({...ref, reason: direct ? 'named' : priority === 3 ? 'task' : priority ? 'teaching_scope' : 'global'});
  }
  return {items, projection: items.length ? '[' + serialized.join(',') + ']' : '',
    omitted: ranked.length - items.length, budget, estimatedTokens: items.length ? bytes : 0};
}

type Plan = ReturnType<typeof planMemoryUse>;
type DeliveryStatus = 'empty' | 'cancelled' | 'invalidated' | 'unavailable' | 'dispatched' | 'delivery_unknown';

/** The authority includes current source revisions, effective task/artifact revisions and policy.
 * The final snapshot and dispatch are synchronous at the boundary; the receipt can settle later.
 */
export async function dispatchMemoryUse(initial: HostSnapshot, read: (pins: Pin[]) => Promise<SourceFact[]>,
  current: () => HostSnapshot, dispatch: (plan: Plan) => void | Promise<void>, signal?: AbortSignal
): Promise<{status: DeliveryStatus}> {
  if (signal?.aborted) return {status:'cancelled'};
  const {sessionId,requestId,authority,scopeVersion} = initial;
  if (!sessionId || !requestId || !authority || !Number.isSafeInteger(scopeVersion) || scopeVersion < 0) return {status:'invalidated'};
  const pins = grantedPins(initial);
  const budget = projectionBudget(initial.availableTokens);
  // Keep the full set for ranking and omitted counts if any reference can fit.
  if (!pins.some(pin => Buffer.byteLength(JSON.stringify([referenceOf(pin)])) <= budget)) return {status:'empty'};
  let plan: Plan;
  try {
    const facts = await read(pins);
    if (signal?.aborted) return {status:'cancelled'};
    const latest = current();
    if (latest.sessionId !== sessionId || latest.requestId !== requestId || latest.authority !== authority
      || latest.scopeVersion !== scopeVersion) return {status:'invalidated'};
    plan = planMemoryUse(latest,facts);
  } catch {
    return {status: signal?.aborted ? 'cancelled' : 'unavailable'};
  }
  if (!plan.items.length) return {status:'empty'};
  try {
    await dispatch(plan);
    return {status:'dispatched'};
  } catch {
    return {status:'delivery_unknown'};
  }
}
