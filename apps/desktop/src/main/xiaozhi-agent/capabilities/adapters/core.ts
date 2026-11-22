import {ADAPTER_CONTRACT} from './contract';
import type {AdapterRegistry} from './registry';
import {protocolHash} from '../validation';
import {NATIVE_STAT_CAPABILITY, validStatInput, validStatOutput} from '../native-stat-contract';

export const nativeStatAdapterSchemas = {input:NATIVE_STAT_CAPABILITY.inputSchemaRef, output:NATIVE_STAT_CAPABILITY.outputSchemaRef,
    validateInput:validStatInput, validateOutput:validStatOutput};

export const CORE_ADAPTER_VERSION = '1.0.0';

export async function registerCoreAdapters(registry: AdapterRegistry, selected: string) {
    for (const [type, transport] of [['native','native'],['mcp','managed_mcp']] as const) {
        const id = 'edu.adapter.' + type;
        if (selected !== id || transport === 'managed_mcp' && process.platform !== 'win32' || registry.find(id, CORE_ADAPTER_VERSION)) continue;
        await registry.admit({id, version:CORE_ADAPTER_VERSION, contractVersion:ADAPTER_CONTRACT, publisher:'edudev',
            artifactHash:protocolHash([id, CORE_ADAPTER_VERSION, transport]), kind:'core', transport}, async () => true);
    }
}
