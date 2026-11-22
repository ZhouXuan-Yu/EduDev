export type TaskCapabilityRequirement = {
  capabilityId: string; contractVersion: string; required: string[]; optional: string[]; conditions: string[];
  dependsOn?: string[];
};
export const TASK_PREFLIGHT_FACETS = ['capabilities', 'dependencies', 'permissions', 'risk', 'artifacts', 'recovery'] as const;
export type TaskPreflightFacet = typeof TASK_PREFLIGHT_FACETS[number];
export type TaskPlanning = {
  schemaVersion: 1;
  level: 1 | 2 | 3;
  reasons: string[];
  observedTools: string[];
  capabilityRequirements: TaskCapabilityRequirement[];
  preflight: {
    state: 'ready' | 'blocked';
    checks: Record<TaskPreflightFacet, {state: 'ready' | 'blocked' | 'unknown'; references: string[]}>;
    blockers: TaskPreflightFacet[];
  };
  requirementsVersion: number;
  planRevision: number;
  checkedAt: string;
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(',') === names.sort().join(',');
const strings = (value: unknown, count: number, length: number): value is string[] => Array.isArray(value) && value.length <= count
  && value.every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= length && !/[\x00-\x1f]/u.test(text))
  && new Set(value).size === value.length;
export function validTaskCapabilityRequirements(value: unknown): value is TaskCapabilityRequirement[] {
  if (!Array.isArray(value) || value.length > 32 || !value.every(row => object(row)
    && keys(row, ['capabilityId', 'contractVersion', 'required', 'optional', 'conditions', ...(Object.hasOwn(row,'dependsOn')?['dependsOn']:[])])
    && typeof row.capabilityId === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/u.test(row.capabilityId)
    && typeof row.contractVersion === 'string' && /^[A-Za-z0-9_.-]{1,80}$/u.test(row.contractVersion)
    && strings(row.required, 128, 128) && strings(row.optional, 128, 128) && strings(row.conditions, 128, 128)
    && (!Object.hasOwn(row,'dependsOn') || strings(row.dependsOn,31,160)))) return false;
  const requirements = value as TaskCapabilityRequirement[];
  const edges = new Map(requirements.map(row=>[row.capabilityId,row.dependsOn??[]]));
  if(edges.size!==requirements.length||requirements.reduce((count,row)=>count+(row.dependsOn?.length??0),0)>64)return false;
  const active=new Set<string>(), complete=new Set<string>();
  function visit(id:string):boolean {
    if(complete.has(id))return true;
    const dependencies=edges.get(id);
    if(!dependencies||active.has(id))return false;
    active.add(id);
    if(!dependencies.every(visit))return false;
    active.delete(id);
    complete.add(id);
    return true;
  }
  return requirements.every(row=>visit(row.capabilityId));
}
export function validTaskPlanning(value: unknown): value is TaskPlanning {
  if (!object(value) || !keys(value, ['schemaVersion', 'level', 'reasons', 'observedTools', 'capabilityRequirements', 'preflight', 'requirementsVersion', 'planRevision', 'checkedAt'])
      || value.schemaVersion !== 1 || ![1, 2, 3].includes(Number(value.level)) || typeof value.level !== 'number'
      || !strings(value.reasons, 16, 80) || value.reasons.length === 0 || !strings(value.observedTools, 128, 160)
      || !validTaskCapabilityRequirements(value.capabilityRequirements)
      || !Number.isSafeInteger(value.requirementsVersion) || Number(value.requirementsVersion) < 1
      || !Number.isSafeInteger(value.planRevision) || Number(value.planRevision) < 0
      || typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt))) return false;
  const preflight = value.preflight;
  if (!object(preflight) || !keys(preflight, ['state', 'checks', 'blockers']) || !['ready', 'blocked'].includes(String(preflight.state))
      || !object(preflight.checks) || !keys(preflight.checks, [...TASK_PREFLIGHT_FACETS])
      || !strings(preflight.blockers, 6, 32) || preflight.blockers.some(facet => !TASK_PREFLIGHT_FACETS.includes(facet as TaskPreflightFacet))) return false;
  if (!Object.values(preflight.checks).every(check => object(check) && keys(check, ['state', 'references'])
    && ['ready', 'blocked', 'unknown'].includes(String(check.state)) && strings(check.references, 128, 2048))) return false;
  const blockers = value.level === 3 ? TASK_PREFLIGHT_FACETS.filter(facet => (preflight.checks as TaskPlanning['preflight']['checks'])[facet].state !== 'ready') : [];
  return JSON.stringify(preflight.blockers) === JSON.stringify(blockers) && preflight.state === (blockers.length ? 'blocked' : 'ready');
}
