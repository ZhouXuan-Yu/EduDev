import type {CapabilityExecutionResult, ProviderExecutionContext} from '../provider-contract';
import type {CapabilityBinding, CapabilityDefinition, ProviderDefinition, ProviderInstance} from '../types';

export const ADAPTER_CONTRACT = '1.0.0';
export type AdapterState = 'discovered'|'validated'|'installed'|'registered'|'activated'|'available'|'suspended'|'revoked'|'uninstalled';
export type AdapterDefinition = {
    id: string;
    version: string;
    contractVersion: typeof ADAPTER_CONTRACT;
    publisher: string;
    artifactHash: string;
    kind: 'core'|'community';
    transport: 'native'|'managed_mcp'|'extension_rpc'|'worker';
};
export type AdapterTarget = {definition: CapabilityDefinition; provider: ProviderDefinition; instance: ProviderInstance; binding: CapabilityBinding};

/** The implementation is injected by trusted host composition. An external artifact supplies data/RPC only. */
export type AdapterExecution<T> = {
    context: ProviderExecutionContext;
    input: T;
    schemas: {input: string; output: string; validateInput: (input: unknown) => boolean; validateOutput: (output: unknown) => boolean};
    authorize: () => Promise<void>;
    connect: (context: ProviderExecutionContext, instance: Readonly<ProviderInstance>) => Promise<{
        execute: (input: T) => Promise<CapabilityExecutionResult>;
        close?: () => Promise<void>;
    }>;
};
