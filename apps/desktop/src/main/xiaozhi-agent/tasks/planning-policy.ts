export type PlanningLevel = 1 | 2 | 3;
export type PlanningFacet = 'capabilities' | 'dependencies' | 'permissions' | 'risk' | 'artifacts' | 'recovery';
export type PlanningCheck = {state: 'ready' | 'blocked' | 'unknown'; references: string[]};
export type PlanningFacts = {
  stepCount: number;
  dependencyEdges: number;
  longRunning: boolean;
  requiredCapabilities: number;
  unresolvedCapabilities: number;
  selectedProviders: number;
  requestedLevel?: PlanningLevel;
  preflight?: Partial<Record<PlanningFacet, PlanningCheck>>;
};
export type PlanningReason = 'simple_task' | 'multiple_steps' | 'dependency_edges' | 'multiple_required_capabilities'
  | 'requested_level_2' | 'long_running' | 'unresolved_capabilities' | 'multiple_providers' | 'requested_level_3';
export type PlanningDecision = {
  level: PlanningLevel;
  reasons: PlanningReason[];
  preflight: {state: 'ready' | 'blocked'; checks: Record<PlanningFacet, PlanningCheck>; blockers: PlanningFacet[]};
};

/** Main supplies verified facts. The original Permission Engine supplies execution authority independently. */
export function evaluateTaskPlanning(facts: PlanningFacts): PlanningDecision {
  const facets: PlanningFacet[] = ['capabilities', 'dependencies', 'permissions', 'risk', 'artifacts', 'recovery'];
  const required = ['stepCount', 'dependencyEdges', 'longRunning', 'requiredCapabilities', 'unresolvedCapabilities', 'selectedProviders'];
  function dataObject(value: unknown, allowed: string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
  }
  if (!dataObject(facts, [...required, 'requestedLevel', 'preflight']) || !required.every(key => Object.hasOwn(facts, key)))
    throw Error('invalid_input');
  const counts = [facts.stepCount, facts.dependencyEdges, facts.requiredCapabilities, facts.unresolvedCapabilities, facts.selectedProviders];
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0) || typeof facts.longRunning !== 'boolean'
      || facts.requestedLevel !== undefined && ![1, 2, 3].includes(facts.requestedLevel)) throw Error('invalid_input');
  if (facts.preflight !== undefined && !dataObject(facts.preflight, facets)) throw Error('invalid_input');

  const checks = Object.fromEntries(facets.map(facet => {
    const check = facts.preflight?.[facet];
    if (check === undefined) return [facet, {state: 'unknown', references: []} satisfies PlanningCheck];
    if (!dataObject(check, ['state', 'references']) || !Object.hasOwn(check, 'state') || !Object.hasOwn(check, 'references')
        || !['ready', 'blocked', 'unknown'].includes(check.state) || !Array.isArray(check.references)
        || Object.getPrototypeOf(check.references) !== Array.prototype || check.references.length > 128
        || Reflect.ownKeys(check.references).length !== check.references.length + 1) throw Error('invalid_input');
    const references: string[] = [];
    for (let index = 0; index < check.references.length; index++) {
      const entry = Object.getOwnPropertyDescriptor(check.references, String(index));
      const reference: unknown = entry && Object.hasOwn(entry, 'value') ? entry.value : undefined;
      if (typeof reference !== 'string' || reference.trim().length === 0 || reference.length > 2048 || /[\x00-\x1f]/u.test(reference))
        throw Error('invalid_input');
      references.push(reference);
    }
    return [facet, {state: check.state, references}];
  })) as Record<PlanningFacet, PlanningCheck>;

  const thirdLevel: [PlanningReason, boolean][] = [
    ['long_running', facts.longRunning],
    ['unresolved_capabilities', facts.unresolvedCapabilities > 0],
    ['multiple_providers', facts.selectedProviders > 1],
    ['requested_level_3', facts.requestedLevel === 3],
  ];
  const secondLevel: [PlanningReason, boolean][] = [
    ['multiple_steps', facts.stepCount > 1],
    ['dependency_edges', facts.dependencyEdges > 0],
    ['multiple_required_capabilities', facts.requiredCapabilities > 1],
    ['requested_level_2', facts.requestedLevel === 2],
  ];
  const thirdReasons = thirdLevel.filter(([, applies]) => applies).map(([reason]) => reason);
  const secondReasons = secondLevel.filter(([, applies]) => applies).map(([reason]) => reason);
  let level: PlanningLevel = 1;
  let reasons: PlanningReason[] = ['simple_task'];
  if (thirdReasons.length) {level = 3; reasons = thirdReasons;}
  else if (secondReasons.length) {level = 2; reasons = secondReasons;}
  const blockers = level === 3 ? facets.filter(facet => checks[facet].state !== 'ready') : [];
  return {level, reasons, preflight: {state: blockers.length ? 'blocked' : 'ready', checks, blockers}};
}
