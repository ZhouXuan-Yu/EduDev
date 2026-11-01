/** Local support metadata only. No free-text, credentials or document fields. */
export const DIAGNOSTIC_SCHEMA = 'xiaozhi.diagnostic.v1' as const;
export type DiagnosticInput = {sessionId:string;runId:string};
export type DiagnosticExportInput = {sessionId:string;previewId:string};
export type DiagnosticError = 'invalid_input'|'permission_denied'|'unavailable'|'expired'|'busy'|'write_failed';
export type DiagnosticResult<T> = {ok:true;value:T}|{ok:false;error:DiagnosticError};
export type DiagnosticReport = {
 schemaVersion:typeof DIAGNOSTIC_SCHEMA;generatedAt:string;
 application:{version:string;runtime:'xiaozhi.pi.education.v1';electron:string;node:string;platform:string;arch:string;packaged:boolean;sourceRevision:null};
 sessionRef:string;runRef:string;state:string;errorCode:string|null;
 cursor:{generation:number;revision:number;sequence:number};
 stages:{stage:'preparing'|'waiting_model'|'responding';at:number}[];stagesOmitted:number;
 requests:{request:number;attempt:number;state:string;at:number;status?:number;waitMs?:number}[];requestsOmitted:number;
 tools:{ref:string;state:string;code:string|null;attempt:number|null;durationMs:number|null}[];toolsOmitted:number;
 elapsedMs:number|null;
 usageRecord:'read'|'missing'|'unavailable';
 usage:{modelCalls:number;toolCalls:number;completeness:'unknown'|'reported'|'partial';tokens:{input:number;output:number;cacheRead:number;cacheWrite:number;total:number}|null;activeMs:number;waitingMs:number;cost:null}|null;
};
export type DiagnosticPreview = {previewId:string;sha256:string;bytes:number;report:DiagnosticReport};
export type DiagnosticSaved = {cancelled:true}|{cancelled:false;bytes:number;sha256:string};
function exact(value:unknown,keys:string[]):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));}
const session=(v:unknown)=>typeof v==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v);
export function validDiagnosticInput(v:unknown):v is DiagnosticInput{return exact(v,['sessionId','runId'])&&session(v.sessionId)&&typeof v.runId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v.runId);}
export function validDiagnosticExportInput(v:unknown):v is DiagnosticExportInput{return exact(v,['sessionId','previewId'])&&session(v.sessionId)&&typeof v.previewId==='string'&&/^diagnostic_[a-f0-9-]{36}$/.test(v.previewId);}
