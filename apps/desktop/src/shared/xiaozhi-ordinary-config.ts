import {validThinkingChoice} from './xiaozhi-thinking';

export const ORDINARY_CONFIG_SCHEMA='xiaozhi.config-history.v1' as const;
export type OrdinaryField='default_model'|'global_thinking'|'session_thinking';
export type OrdinaryTarget={field:OrdinaryField;sessionId?:string};
export type OrdinaryCommit=OrdinaryTarget&{
  operationId:string;
  expectedVersion:number;
  value:string|null;
  credentialId?:string;
};
export type OrdinaryUndo=OrdinaryTarget&{operationId:string;changeId:string;changeVersion:number};
export type OrdinaryIntent=OrdinaryCommit|OrdinaryUndo;
export type OrdinaryQuery=OrdinaryTarget&{cursor?:string};
export type OrdinaryReceipt={
  schemaVersion:typeof ORDINARY_CONFIG_SCHEMA;
  operationId:string;
  outcome:'committed'|'no_change';
  version:number;
  changeId:string|null;
  savedAt:string|null;
  effectiveFrom:'next_applicable_run';
};
export type OrdinaryChange={
  changeId:string;
  kind:'save'|'undo';
  previous:string|null;
  value:string|null;
  version:number;
  savedAt:string;
  undone:boolean;
};
export type OrdinaryHistory={
  version:number;
  value:string|null;
  items:OrdinaryChange[];
  undo:{changeId:string;version:number}|null;
  cursor:string|null;
};

export const validOperationId=(id:unknown):id is string=>typeof id==='string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const modelId=(value:unknown)=>typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
const revision=(x:unknown)=>typeof x==='number' && Number.isSafeInteger(x) && x>=0 && x<Number.MAX_SAFE_INTEGER;
const object=(x:unknown):x is Record<string,unknown>=>Boolean(x && typeof x==='object' && !Array.isArray(x));
const only=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).every(key=>keys.includes(key));
function validTarget(x:Record<string,unknown>){
  if(x.field==='session_thinking')return typeof x.sessionId==='string' && /^aisession_[a-f0-9-]{36}$/i.test(x.sessionId);
  return (x.field==='default_model'||x.field==='global_thinking') && x.sessionId===undefined;
}
export function validOrdinaryValue(field:OrdinaryField,value:unknown):value is string|null {
  if(field==='default_model')return value===null||modelId(value);
  return validThinkingChoice(value)||field==='session_thinking'&&value===null;
}
export function validOrdinaryCommit(input:unknown):input is OrdinaryCommit {
  return object(input)&&validTarget(input)&&validOperationId(input.operationId)&&revision(input.expectedVersion) &&
    only(input,['operationId','field','sessionId','expectedVersion','value','credentialId']) &&
    validOrdinaryValue(input.field as OrdinaryField,input.value) &&
    (input.credentialId===undefined||input.field==='default_model'&&validOperationId(input.credentialId));
}
export function validOrdinaryUndo(input:unknown):input is OrdinaryUndo {
  return object(input)&&validTarget(input)&&validOperationId(input.operationId)&&validOperationId(input.changeId) &&
    revision(input.changeVersion)&&Number(input.changeVersion)>0&&only(input,['operationId','field','sessionId','changeId','changeVersion']);
}
export function validOrdinaryQuery(input:unknown):input is OrdinaryQuery {
  return object(input)&&validTarget(input)&&only(input,['field','sessionId','cursor']) &&
    (input.cursor===undefined||typeof input.cursor==='string'&&input.cursor.length<=256);
}
