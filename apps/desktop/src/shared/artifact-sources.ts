import type {XiaozhiPublicSource} from './xiaozhi-web';
import type {OfficeArtifactSource} from './xiaozhi-office-artifacts';
export const ARTIFACT_SOURCES_SCHEMA='xiaozhi.artifact-sources.v1' as const;
export type ArtifactSourcesInput={schemaVersion:typeof ARTIFACT_SOURCES_SCHEMA;sessionId:string;artifactId:string;offset?:number};
export type ArtifactSourceItem={relation:'declared'|'read'|'paper'|'classroom';source?:XiaozhiPublicSource;file?:(OfficeArtifactSource&{workspaceVersion:string;availability:'same'|'changed'|'missing'|'unavailable'})};
export type ArtifactSourcesView={schemaVersion:typeof ARTIFACT_SOURCES_SCHEMA;sessionId:string;artifactId:string;title:string;items:ArtifactSourceItem[];offset:number;total:number;nextOffset:number|null;readHistory:'available'|'unavailable';origin?:string;inheritedFrom?:string};
export type ArtifactSourcesResult={ok:true;value:ArtifactSourcesView}|{ok:false;error:'invalid_input'|'permission_denied'|'busy'|'configuration'};
export function validArtifactSourcesInput(raw:unknown):raw is ArtifactSourcesInput {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const v=raw as Record<string,unknown>;
 return Object.keys(v).every(key=>['schemaVersion','sessionId','artifactId','offset'].includes(key))&&v.schemaVersion===ARTIFACT_SOURCES_SCHEMA
  &&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.artifactId==='string'&&/^(artifact|xichange)_[a-f0-9-]{36}$/i.test(v.artifactId)
  &&(v.offset===undefined||Number.isSafeInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=1000000);
}
