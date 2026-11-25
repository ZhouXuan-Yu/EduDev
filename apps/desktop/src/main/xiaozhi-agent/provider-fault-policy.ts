export type ProviderFaultStage =
  | 'before_tool_dispatch' | 'before_response_body' | 'partial_response' | 'after_dispatch'
  | 'safe_local_read' | 'reconnect' | 'pre_dispatch' | 'pre_commit' | 'queued' | 'late_callback'
  | 'probe' | 'verified_readback' | 'preparation' | 'unknown';

export type ProviderEffectEvidence =
  | 'none_proven' | 'explicit_model_http_rejection' | 'no_effect_proven' | 'known' | 'unknown';

const actions = {
  stale: 'discard_for_current',
  cancelled: 'stop',
  security: 'deny',
  bindingChange: 'invalidate_current_binding',
  effect_unknown: 'reconcile_only',
  input: 'correct_input',
  conflict: 'read_current',
  approval: 'existing_approval',
  budget: 'stop',
  resource_wait: 'bounded_wait',
  configuration: 'needs_teacher',
  missingDependency: 'verified_recipe_or_needs_teacher',
  modelRejection: 'existing_model_retry',
  transient: 'probe_or_retry_safe',
  safeRead: 'retry_if_budget',
  ambiguous: 'stop_or_explicit_continue',
  health_only: 'revalidate_before_ready',
  success: 'continue',
  unknown: 'conservative_readback',
} as const;

type Rule = keyof typeof actions;
type InternalRule = 'bindingChange' | 'missingDependency' | 'modelRejection' | 'safeRead';
export type ProviderFaultCategory = Exclude<Rule, InternalRule>;

function decide(rule: Rule, countsDependencyFailure = false) {
  const category: ProviderFaultCategory = rule === 'bindingChange' ? 'security' : rule === 'missingDependency' ? 'configuration'
    : rule === 'modelRejection' || rule === 'safeRead' ? 'transient' : rule;
  return {category, action: actions[rule], countsDependencyFailure};
}

const nonDependencyRules: readonly (readonly [Rule, readonly string[]])[] = [
  ['input', ['invalid_input']],
  ['conflict', ['source_changed', 'conflict', 'cas_conflict']],
  ['approval', ['permission_pending', 'approval_rejected']],
  ['budget', ['budget_exceeded']],
  ['resource_wait', ['resource_busy', 'resource_wait']],
  ['configuration', ['authentication', 'configuration', 'storage_unavailable', 'unsupported_constraint']],
  ['missingDependency', ['dependency_missing', 'missing_dependency']],
];

const retryableHttpStatuses = new Set([429, 500, 502, 503, 504]);

export function isTemporaryProviderHttpStatus(status: number) {
  return retryableHttpStatuses.has(status);
}

/** Host-normalized facts only. Provider payloads cannot authorize replay or certify an effect. */
export function classifyProviderFault(fact: {
  origin: 'host' | 'provider';
  signals: readonly string[];
  stage: ProviderFaultStage;
  effect: ProviderEffectEvidence;
}) {
  if (fact.origin !== 'host') return decide('unknown');
  const includes = (...signals: string[]) => signals.some(signal => fact.signals.includes(signal));
  if (fact.stage === 'late_callback' || includes('old_epoch_success', 'stale_callback')) return decide('stale');
  if (includes('cancelled', 'expired', 'closed_by_host')) return decide('cancelled');
  if (includes('capability_revoked', 'binding_revoked', 'permission_denied')) return decide('security');
  if (includes('schema_changed', 'identity_changed', 'hash_changed', 'credential_changed', 'binding_changed')) return decide('bindingChange');

  const connectionFailure = includes('connect_failed', 'transport_lost', 'stream_interrupted', 'timeout');
  if (fact.stage === 'after_dispatch' && fact.effect !== 'known' && fact.effect !== 'no_effect_proven') {
    return decide('effect_unknown', connectionFailure);
  }
  const nonDependency = nonDependencyRules.find(([, signals]) => includes(...signals));
  if (nonDependency) return decide(nonDependency[0]);
  if (fact.stage === 'partial_response' && includes('stream_interrupted', 'transport_lost', 'timeout')) {
    return decide('ambiguous', true);
  }
  if (fact.stage === 'before_response_body' && fact.effect === 'explicit_model_http_rejection'
      && [...retryableHttpStatuses].some(status => includes('http_' + status))) return decide('modelRejection', true);
  if (fact.stage === 'safe_local_read' && fact.effect === 'no_effect_proven' && connectionFailure) return decide('safeRead', true);
  if (['before_tool_dispatch', 'reconnect', 'preparation'].includes(fact.stage) && connectionFailure) {
    return decide('transient', true);
  }
  if (fact.stage === 'probe' && includes('connection_recovered')) return decide('health_only');
  if (fact.stage === 'verified_readback' && fact.effect === 'known' && fact.signals.length === 1 && includes('success')) return decide('success');
  return decide('unknown');
}
