import type { CapabilityRequirement, ProviderSelection } from './types';
import { validStatOutput, type NativeStatOutput, type NativeStatResult } from './native-stat';
import { snapshotProtocolInput } from './validation';
export const PROVIDER_RESULT_SCHEMA = 'xiaozhi.provider-result.v1' as const;
export const PROVIDER_ERROR_CODES = [
    'invalid_input', 'permission_denied', 'missing_dependency', 'provider_unavailable', 'timeout', 'rate_limited', 'invalid_output', 'side_effect_unknown', 'capability_revoked', 'cancelled', 'budget_exceeded', 'not_found', 'source_changed'
] as const;
export type ProviderErrorCode = typeof PROVIDER_ERROR_CODES[number];
export type ProviderSnapshot = {
    schema: 'xiaozhi.capability-snapshot.v1';
    snapshotId: string;
    taskId: string;
    sessionId: string;
    runId: string;
    generation: number;
    capabilityId: string;
    registryRevision: number;
    requirement: CapabilityRequirement;
    selection: ProviderSelection;
    providerHash: string;
    createdAt: string;
    evidenceRefs: string[];
    previousSnapshotId: string | null;
    refreshReason: 'initial' | 'explicit_refresh';
};
/** Constructed by the host after current Task/Journal admission. */
export type ProviderExecutionContext = {
    taskId: string;
    sessionId: string;
    runId: string;
    generation: number;
    stepId: string | null;
    callId: string;
    signal: AbortSignal;
    snapshot: ProviderSnapshot;
    grantRef: string;
    idempotencyKey: string;
    budget: {
        timeoutMs: number;
        resourceUnits: number;
    };
};
export type CapabilityExecutionResult<T = unknown> = {
    schema: typeof PROVIDER_RESULT_SCHEMA;
    executionId: string;
    capabilityId: string;
    providerId: string;
    taskId: string;
    runId: string;
    generation: number;
    snapshotId: string;
    status: 'completed' | 'partial' | 'failed' | 'cancelled' | 'unknown';
    data?: T;
    artifacts: {
        id: string;
        kind: string;
    }[];
    conformance: {
        level: 'full' | 'partial';
        missingRequirements: string[];
    };
    sideEffects: {
        status: 'none' | 'known' | 'unknown';
        references: string[];
    };
    error?: {
        code: ProviderErrorCode;
        message: string;
        retryable: boolean;
    };
    provenance: {
        providerVersion: string;
        providerHash: string;
        contractVersion: string;
        registryRevision: number;
    };
};
const exact = (value: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(key => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key));
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 128 && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 512);
export function validProviderResult(value: unknown, validateData: (data: unknown) => boolean = () => true): value is CapabilityExecutionResult {
    try {
        value = snapshotProtocolInput(value);
    }
    catch {
        return false;
    }
    if (!object(value) || !exact(value, [
        'schema', 'executionId', 'capabilityId', 'providerId', 'taskId', 'runId', 'generation', 'snapshotId', 'status', 'artifacts', 'conformance', 'sideEffects', 'provenance'
    ], ['data', 'error'])) {
        return false;
    }
    if (value.schema !== PROVIDER_RESULT_SCHEMA || ![
        'executionId', 'capabilityId', 'providerId', 'taskId', 'runId', 'snapshotId'
    ].every(key => typeof value[key] === 'string' && String(value[key]).length > 0 && String(value[key]).length <= 160)) {
        return false;
    }
    if (!Number.isSafeInteger(value.generation) || Number(value.generation) < 1 || ![
        'completed', 'partial', 'failed', 'cancelled', 'unknown'
    ].includes(String(value.status))) {
        return false;
    }
    if (!Array.isArray(value.artifacts) || value.artifacts.length > 128 || !value.artifacts.every(item => object(item) && exact(item, ['id', 'kind']) && typeof item.id === 'string' && typeof item.kind === 'string')) {
        return false;
    }
    if (!object(value.conformance) || !exact(value.conformance, ['level', 'missingRequirements']) || !['full', 'partial'].includes(String(value.conformance.level)) || !strings(value.conformance.missingRequirements)) {
        return false;
    }
    if (!object(value.sideEffects) || !exact(value.sideEffects, ['status', 'references']) || !['none', 'known', 'unknown'].includes(String(value.sideEffects.status)) || !strings(value.sideEffects.references)) {
        return false;
    }
    if (!object(value.provenance) || !exact(value.provenance, [
        'providerVersion', 'providerHash', 'contractVersion', 'registryRevision'
    ]) || !/^[a-f0-9]{64}$/u.test(String(value.provenance.providerHash)) || typeof value.provenance.providerVersion !== 'string' || typeof value.provenance.contractVersion !== 'string' || !Number.isSafeInteger(value.provenance.registryRevision) || Number(value.provenance.registryRevision) < 0) {
        return false;
    }
    if (value.error !== undefined && (!object(value.error) || !exact(value.error, ['code', 'message', 'retryable']) || !PROVIDER_ERROR_CODES.includes(value.error.code as ProviderErrorCode) || value.error.message !== value.error.code || typeof value.error.retryable !== 'boolean')) {
        return false;
    }
    if (value.data !== undefined && !validateData(value.data)) {
        return false;
    }
    if (value.status === 'completed' || value.status === 'partial') {
        return value.data !== undefined && value.error === undefined;
    }
    return value.error !== undefined && value.data === undefined;
}
export function providerErrorCode(error: unknown): ProviderErrorCode {
    const code = error instanceof Error ? error.message : String(error);
    if (code === 'changed' || code === 'capability_registry_changed') {
        return 'source_changed';
    }
    if (code === 'conflict') {
        return 'source_changed';
    }
    if (code === 'capability_selection_ineligible' || code.startsWith('capability_provider')) {
        return 'provider_unavailable';
    }
    if (code.startsWith('capability_invalid')) {
        return 'invalid_input';
    }
    return PROVIDER_ERROR_CODES.includes(code as ProviderErrorCode) ? code as ProviderErrorCode : 'provider_unavailable';
}
export function providerResult(context: ProviderExecutionContext, native?: NativeStatResult, error?: unknown): CapabilityExecutionResult<NativeStatOutput> {
    const snapshot = context.snapshot;
    const code = error === undefined && !native?.error ? undefined : providerErrorCode(error ?? new Error(native?.error?.code));
    let status: CapabilityExecutionResult['status'] = native?.status === 'partial' ? 'partial' : 'completed';
    if (code === 'cancelled') {
        status = 'cancelled';
    }
    else if (code === 'side_effect_unknown') {
        status = 'unknown';
    }
    else if (code) {
        status = 'failed';
    }
    const result: CapabilityExecutionResult<NativeStatOutput> = {
        schema: PROVIDER_RESULT_SCHEMA,
        executionId: context.callId,
        capabilityId: snapshot.capabilityId,
        providerId: snapshot.selection.providerId,
        taskId: context.taskId,
        runId: context.runId,
        generation: context.generation,
        snapshotId: snapshot.snapshotId,
        status,
        artifacts: [],
        conformance: native?.conformance || {
            level: snapshot.selection.level,
            missingRequirements: snapshot.selection.missingRequirements
        },
        sideEffects: {
            status: code === 'side_effect_unknown' ? 'unknown' : 'none',
            references: []
        },
        provenance: {
            providerVersion: snapshot.selection.providerVersion,
            providerHash: snapshot.providerHash,
            contractVersion: snapshot.selection.contractVersion,
            registryRevision: snapshot.registryRevision
        }
    };
    if (code) {
        result.error = {
            code,
            message: code,
            retryable: ['source_changed', 'timeout', 'rate_limited'].includes(code)
        };
    }
    else
        result.data = native?.data;
    if (!validProviderResult(result, validStatOutput)) {
        throw Error('invalid_output');
    }
    return result;
}
