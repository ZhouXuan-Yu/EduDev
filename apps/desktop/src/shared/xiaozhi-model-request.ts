/** Public request diagnostics. HTTP acceptance does not certify a complete answer. */
export type XiaozhiModelRequest={schemaVersion:1;request:number;attempt:1|2|3;state:'sending'|'retry_wait'|'retried'|'accepted'|'rejected'|'interrupted';at:number;status?:number;waitMs?:number};
export const MAX_MODEL_REQUEST_RECORDS=64;
export function validModelRequest(raw:unknown):raw is XiaozhiModelRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['schemaVersion','request','attempt','state','at','status','waitMs'].includes(k))||v.schemaVersion!==1||!Number.isSafeInteger(v.request)||Number(v.request)<1||Number(v.request)>1000000||![1,2,3].includes(Number(v.attempt))||typeof v.attempt!=='number'||!Number.isSafeInteger(v.at)||Number(v.at)<=0||typeof v.state!=='string'||!['sending','retry_wait','retried','accepted','rejected','interrupted'].includes(v.state))return false;
 if(v.status!==undefined&&(!Number.isSafeInteger(v.status)||Number(v.status)<100||Number(v.status)>599))return false;
 if(v.waitMs!==undefined&&(!Number.isFinite(v.waitMs)||typeof v.waitMs!=='number'||v.waitMs<0||v.waitMs>5000))return false;
 if(['retry_wait','retried'].includes(String(v.state)))return Number(v.attempt)<3&&[429,500,502,503,504].includes(Number(v.status))&&v.waitMs!==undefined;
 if(v.waitMs!==undefined)return false;
 return v.state==='accepted'?Number(v.status)>=200&&Number(v.status)<300:v.state==='rejected'?v.status!==undefined&&(Number(v.status)<200||Number(v.status)>=300):v.state==='sending'?v.status===undefined:true;
}
export function modelHttpError(status?:number){
 return status===401||status===403?'authentication':status===402?'insufficient_balance':status===429?'rate_limited':status!==undefined&&status>=500?'provider_unavailable':undefined;
}
