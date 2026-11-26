import {ADAPTER_CONTRACT,type AdapterDefinition} from './contract';
import type {AdapterRegistry} from './registry';
import {protocolHash} from '../validation';
import {NATIVE_STAT_CAPABILITY, validStatInput, validStatOutput} from '../native-stat-contract';

export const nativeStatAdapterSchemas = {input:NATIVE_STAT_CAPABILITY.inputSchemaRef, output:NATIVE_STAT_CAPABILITY.outputSchemaRef,
    validateInput:validStatInput, validateOutput:validStatOutput};

export const CORE_ADAPTER_VERSION = '1.0.0';
export function coreAdapterDefinition(id:string):AdapterDefinition|null {
    const transport=id==='edu.adapter.native'?'native':id==='edu.adapter.mcp'?'managed_mcp':null;
    return transport ? {id,version:CORE_ADAPTER_VERSION,contractVersion:ADAPTER_CONTRACT,publisher:'edudev',
        artifactHash:protocolHash([id,CORE_ADAPTER_VERSION,transport]),kind:'core',transport} : null;
}

export async function registerCoreAdapters(registry: AdapterRegistry, selected: string) {
    const definition=coreAdapterDefinition(selected);
    if(!definition || definition.transport==='managed_mcp' && process.platform!=='win32'||registry.find(selected,CORE_ADAPTER_VERSION))return;
    await registry.admit(definition,async()=>true);
}
