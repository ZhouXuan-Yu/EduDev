import {protocolHash} from '../capabilities/validation';

export function requestPrefixDigest(raw:unknown) {
    if(!raw||typeof raw!=='object')return null;
    const {model,messages,tools}=raw as {model?:unknown;messages?:unknown[];tools?:unknown};
    const first=Array.isArray(messages)&&messages[0] as {role?:unknown}|undefined;
    return first && first.role==='system' ? protocolHash([model,first,tools??[]]) : null;
}

type NativeUsage = {input:number;output:number;cacheRead:number;cacheWrite:number};
export function contextCacheReceipt(usage:NativeUsage, input:{latencyMs:number;model:string;kind:'reply'|'compaction';prefix:string|null}) {
    const values=[usage.input,usage.output,usage.cacheRead,usage.cacheWrite];
    if(!values.every(value=>Number.isSafeInteger(value)&&value>=0)||values.every(value=>value===0))return null;
    const miss=usage.input+usage.cacheWrite;
    return {schemaVersion:1,model:input.model,requestType:input.kind,prefix:input.prefix,
        inputTokens:miss+usage.cacheRead,outputTokens:usage.output,
        cacheHitTokens:usage.cacheRead,cacheMissTokens:miss,latencyMs:input.latencyMs};
}
