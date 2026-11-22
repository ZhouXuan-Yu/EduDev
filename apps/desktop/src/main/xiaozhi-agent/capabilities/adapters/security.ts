import type {AdapterDefinition, AdapterTarget} from './contract';

export type AdapterIsolation = {
    tier: 'T0'|'T1'|'T2'|'T3';
    isolation: 'core'|'process'|'appcontainer'|'blocked';
    filesystem: 'host_scoped'|'verified_projection'|'none';
    network: 'host_policy'|'denied';
};

export function adapterIsolation(adapter: AdapterDefinition, platform: NodeJS.Platform): AdapterIsolation {
    if (adapter.kind === 'core' && adapter.transport === 'native') {
        return {tier:'T0', isolation:'core', filesystem:'host_scoped', network:'host_policy'};
    }
    if (adapter.kind === 'core' && adapter.transport === 'worker') {
        return {tier:'T1', isolation:'process', filesystem:'none', network:'denied'};
    }
    if (platform === 'win32' && (adapter.kind === 'core' && adapter.transport === 'managed_mcp'
        || adapter.kind === 'community' && adapter.transport === 'extension_rpc')) {
        return {tier:'T2', isolation:'appcontainer', filesystem:'verified_projection', network:'denied'};
    }
    return {tier:'T3', isolation:'blocked', filesystem:'none', network:'denied'};
}

export function assertDeveloperAdapterPolicy(adapter: AdapterDefinition, isolation: AdapterIsolation, target: AdapterTarget) {
    const {provider, definition, binding, instance} = target;
    if (isolation.tier === 'T3' || provider.adapterId !== adapter.id || binding.adapterVersion !== adapter.contractVersion
        || provider.source.verification !== 'verified' || definition.constraints.networkRequired && isolation.network === 'denied'
        || binding.capabilityId !== definition.id || binding.providerId !== provider.id || instance.providerId !== provider.id) {
        throw Error('permission_denied');
    }
    const permitsResource = (values: readonly string[]) => provider.permissions.every(permission => values.includes(permission));
    if (adapter.transport === 'native' && (provider.type !== 'native' || provider.runtime !== 'main_native'
        || !provider.publisher.official || !permitsResource(['workspace.file.metadata']))) throw Error('permission_denied');
    if (adapter.transport === 'managed_mcp' && (provider.type !== 'mcp' || provider.runtime !== 'isolated'
        || !permitsResource(['workspace.file.read','process.appcontainer','mcp.tool.call']))) throw Error('permission_denied');
    if (adapter.transport === 'extension_rpc' && (provider.type !== 'extension' || provider.runtime !== 'isolated'
        || provider.source.packageHash !== adapter.artifactHash || provider.publisher.id !== adapter.publisher
        || !permitsResource(['extension.run','process.appcontainer','dependency.artifact']))) throw Error('permission_denied');
    if (adapter.transport === 'worker' && (adapter.kind !== 'core' || provider.permissions.length)) throw Error('permission_denied');
}
