import type {DeliveryCheckReport} from './xiaozhi-delivery-checks';
export const ARTIFACT_CHECK_SCHEMA='xiaozhi.artifact-check.v1' as const;
export type ArtifactCheckInput={schemaVersion:typeof ARTIFACT_CHECK_SCHEMA;sessionId:string;artifactId:string};
export type ArtifactCheckView={schemaVersion:typeof ARTIFACT_CHECK_SCHEMA;artifactId:string;path:string;sha256:string;current:boolean;
 integrity:'same'|'changed'|'missing'|'unavailable';fileVersion?:string;workspaceVersion:string;report:DeliveryCheckReport|null;applicable:boolean;retainedReports:64};
export type ArtifactCheckResult={ok:true;value:ArtifactCheckView}|{ok:false;error:'invalid_input'|'permission_denied'|'not_found'|'unavailable'};
export function validArtifactCheck(v:unknown):v is ArtifactCheckInput{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;
 return Object.keys(x).length===3&&Object.keys(x).every(k=>['schemaVersion','sessionId','artifactId'].includes(k))&&x.schemaVersion===ARTIFACT_CHECK_SCHEMA
  &&typeof x.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(x.sessionId)&&typeof x.artifactId==='string'&&/^(artifact|xichange)_[a-f0-9-]{36}$/i.test(x.artifactId);
}
