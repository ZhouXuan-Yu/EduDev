import type {PermissionDecision} from '../../../shared/xiaozhi-permissions';
import type {TaskView} from '../../../shared/xiaozhi-task';
import type {TaskCapabilityRequirement, TaskPlanning} from '../../../shared/xiaozhi-task-planning';
import type {CapabilityResolution} from '../capabilities/types';
import type {ToolGovernanceRecord} from '../capabilities/core-governance';
import {protocolHash} from '../capabilities/validation';
import type {Sql} from '../session-state';
import type {createEventPublisher} from '../events/publisher';
import {createTaskState} from './task-state';
import {evaluateTaskPlanning, type PlanningCheck} from './planning-policy';
import {TaskAdmissionError} from './admission-error';

type Proposal = {steps: TaskView['steps']; planningLevel?: 1 | 2 | 3; capabilityRequirements?: TaskCapabilityRequirement[]};
export function createTaskPlanningRuntime(options: {
  sql: Sql;
  publisher: ReturnType<typeof createEventPublisher>;
  taskId: string;
  current: () => boolean;
  resolve: (requirement: TaskCapabilityRequirement) => Promise<CapabilityResolution>;
  permission: (callId: string, tool: string, input: unknown) => Promise<PermissionDecision | null>;
  tool: (name: string) => ToolGovernanceRecord | undefined;
  dependencies: (tool: string, input: unknown) => Promise<PlanningCheck>;
  workspace: () => Promise<{version: string}>;
}) {
  const tasks = createTaskState(options.sql, {sanitize: async () => {throw Error('invalid_input');}});
  function fence() {if (!options.current()) throw Error('task_owner_stale');}
  async function inspect(task: TaskView, proposal?: Proposal, invocation?: {callId: string; tool: string; input: unknown}): Promise<TaskPlanning> {
    fence();
    const requirements = proposal?.capabilityRequirements || task.planning?.capabilityRequirements || [];
    const resolutions = await Promise.all(requirements.map(options.resolve));
    const selected = resolutions.flatMap(resolution => resolution.selectedProviders.map(provider => provider.providerId));
    const missing = resolutions.filter(resolution => resolution.selectedProviders.length === 0 || resolution.blockedReasons.length > 0);
    const tools = [...new Set([...(task.planning?.observedTools || []), ...(invocation ? [invocation.tool] : [])])];
    const steps = proposal?.steps || task.steps;
    const raw = invocation?.input && typeof invocation.input === 'object' && !Array.isArray(invocation.input)
      ? invocation.input as Record<string, unknown> : {};
    const longRunning = invocation?.tool === 'exec_command' && (raw.tty === true || raw.background === true)
      || task.planning?.reasons.includes('long_running') === true;
    const record = invocation ? options.tool(invocation.tool) : undefined;
    let permission: PermissionDecision | null = null;
    if (invocation) {
      try {permission = await options.permission(invocation.callId, invocation.tool, invocation.input);}
      catch (error) {
        if (error instanceof Error && ['permission_denied', 'closed', 'source_changed'].includes(error.message)) throw new TaskAdmissionError('task_resource_unavailable');
        throw error;
      }
    }
    const dependencies = invocation ? await options.dependencies(invocation.tool, invocation.input)
      : {state: missing.some(resolution => resolution.excludedProviders.some(provider => provider.reasons.includes('missing_dependency'))) ? 'blocked' as const : 'ready' as const,
        references: [...new Set(resolutions.map(resolution => 'registry:' + resolution.registryRevision))]};
    const workspace = await options.workspace().catch(error => {
      if (error instanceof Error && error.message === 'permission_denied') {
        throw new TaskAdmissionError('permission_denied');
      }
      throw error;
    });
    const checkpoint = await tasks.checkpoint(task.id);
    const effects = await options.sql.all(`SELECT effect_id FROM xiaozhi_effects_v1 WHERE session_id=? AND task_id=? AND state='unknown'
      AND json_extract(document_json,'$.contract.effect') IN ('local_write','external_effect')
      AND (? IS NULL OR json_extract(document_json,'$.contract.capabilityId')=?) ORDER BY effect_id LIMIT 128`,
      [task.sessionId, task.id, record?.capabilityId || null, record?.capabilityId || null]);
    const permissionBlocked = permission && permission.state !== 'allow'
      || resolutions.some(resolution => resolution.status === 'blocked_permission');
    const facts = {
      stepCount: Math.max(steps.length, tools.length), dependencyEdges: steps.reduce((sum, step) => sum + step.dependsOn.length, 0),
      longRunning, requiredCapabilities: requirements.length, unresolvedCapabilities: missing.length,
      selectedProviders: new Set(selected).size,
      requestedLevel: proposal?.planningLevel ?? (task.planning?.reasons.includes('requested_level_3') ? 3
        : task.planning?.reasons.includes('requested_level_2') ? 2 : undefined),
      preflight: {
        capabilities: {state: missing.length ? 'blocked' as const : record || requirements.length ? 'ready' as const : 'unknown' as const,
          references: [...new Set([...resolutions.map(resolution => 'registry:' + resolution.registryRevision), ...(record ? ['provider:' + record.providerId + ':' + record.providerHash] : [])])]},
        dependencies,
        permissions: {state: permissionBlocked ? 'blocked' as const : 'ready' as const,
          references: permission ? ['permission:' + permission.requestDigest, ...permission.grantRefs.map(ref => ref.grantId + ':' + ref.revision)] : ['task:' + task.id]},
        risk: {state: 'ready' as const, references: [record ? 'effect:' + record.effect + ':' + record.scopePolicy : 'task-plan:' + task.planRevision]},
        artifacts: {state: 'ready' as const, references: ['workspace:' + workspace.version]},
        recovery: {state: effects.length || !checkpoint ? 'blocked' as const : 'ready' as const,
          references: [...(checkpoint ? [checkpoint.id] : []), ...effects.map(row => String(row.effect_id))]},
      },
    };
    const decision = evaluateTaskPlanning(facts);
    fence();
    return {schemaVersion: 1, ...decision, observedTools: tools, capabilityRequirements: structuredClone(requirements),
      requirementsVersion: task.requirementsVersion, planRevision: proposal ? task.planRevision + 1 : task.planRevision, checkedAt: new Date().toISOString()};
  }
  let lane: Promise<unknown> = Promise.resolve();
  return {
    proposal: (task: TaskView, value: Proposal) => inspect(task, value),
    before(callId: string, tool: string, input: unknown, enforce = false) {
      const pending = lane.then(async () => {
      const task = await tasks.get(options.taskId);
      if (!task) throw Error('task_missing');
      const planning = await inspect(task, undefined, {callId, tool, input});
      const comparable = (value: TaskPlanning) => ({...value, checkedAt: '', preflight: {...value.preflight,
        checks: {...value.preflight.checks, recovery: {...value.preflight.checks.recovery,
          references: value.preflight.checks.recovery.references.filter(reference => !reference.startsWith('xitcp_'))}}}});
      if (!task.planning || protocolHash(comparable(task.planning)) !== protocolHash(comparable(planning))) {
        await options.publisher.checkpointTask(async work => {
          fence();
          const state = createTaskState({...work, transaction: action => action(work)}, {sanitize: async () => {throw Error('invalid_input');}});
          const latest = await state.get(task.id);
          if (!latest || latest.revision !== task.revision) throw Error('task_revision_conflict');
          return state.recordPlanning(options.publisher.owner, task.id, task.revision, planning);
        });
      }
      // Discovery, inspection and trusted preparation remain available to repair a blocked preflight.
      const preparation = ['capability_resolve', 'capability_prepare', 'environment_repair', 'extension_prepare', 'update_task_plan', 'close_terminal'].includes(tool);
      const effect = options.tool(tool)?.effect;
      if (enforce && planning.level === 3 && planning.preflight.state === 'blocked' && !preparation && ['local_write', 'external_effect'].includes(effect || ''))
        throw new TaskAdmissionError('task_preflight_blocked');
      return planning;
      });
      lane = pending.catch(() => undefined);
      return pending;
    },
  };
}
