import {validOfficeDraft,officeOutputFormat,type OfficeDraft,type OfficeOutputFormat} from './xiaozhi-office-draft';
export const OFFICE_ARTIFACT_SCHEMA='xiaozhi.office-artifact.v1' as const;
export type OfficeArtifactState='pending'|'approved'|'generating'|'prepared'|'committing'|'saved'|'rejected'|'interrupted'|'uncertain'|'conflict'|'failed';
export type OfficeArtifactProposal={path:string;format:OfficeOutputFormat;draft:OfficeDraft;sources:{path:string;version:string}[];parentArtifactId?:string};
export type OfficeArtifactSummary={schemaVersion:typeof OFFICE_ARTIFACT_SCHEMA;id:string;runId:string;callId:string;path:string;format:OfficeOutputFormat;state:OfficeArtifactState;revision:number;artifactId:string|null;sourceCount:number};
export type OfficeArtifactReview=OfficeArtifactSummary & {draft:OfficeDraft;sources:OfficeArtifactSource[];parentArtifactId:string|null};
export type OfficeArtifactSource={kind:'workspace_file'|'parent_artifact';sourceId:string;path:string;version:string;sha256:string};
export type OfficeArtifactDecision={schemaVersion:typeof OFFICE_ARTIFACT_SCHEMA;sessionId:string;draftId:string;revision:number;action:'approve'|'reject'|'verify'};
export type OfficeArtifactReviewInput={schemaVersion:typeof OFFICE_ARTIFACT_SCHEMA;sessionId:string;draftId:string};
export type OfficeArtifactReviseInput=OfficeArtifactReviewInput&{revision:number;draft:OfficeDraft};
export type OfficeArtifactError='invalid_input'|'permission_denied'|'conflict'|'busy'|'configuration';
export type OfficeArtifactResult<T>={ok:true;value:T}|{ok:false;error:OfficeArtifactError};
export const OFFICE_ARTIFACT_ERRORS:Record<OfficeArtifactError,string>={invalid_input:'拟内容或操作格式不正确，请检查后重试。',permission_denied:'会话、确认或工作目录授权已失效，请刷新后检查。',conflict:'拟内容、来源或目标文件已变化，请刷新后检查；没有覆盖原文件。',busy:'有任务正在运行，请结束后再操作。',configuration:'暂时无法读取或提交文档，请刷新状态后重试。'};
export const officeHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const officeRelativePath=(v:unknown):v is string=>typeof v==='string'&&!!v&&v.length<=500
 &&!/[\\:<>"|?*\x00-\x1f]/.test(v)&&!v.startsWith('/')&&v.split('/').length<=8
 &&v.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)
 &&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part)
 &&!/^(\.pi|\.ssh|\.aws|\.azure)$/i.test(part));
export function validOfficeProposal(v:unknown):v is OfficeArtifactProposal {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as Record<string,unknown>;
 return Object.keys(x).every(k=>['path','format','draft','sources','parentArtifactId'].includes(k))
  &&officeRelativePath(x.path)&&officeOutputFormat(x.format)&&x.path.toLowerCase().endsWith('.'+x.format)
  &&validOfficeDraft(x.draft)&&Array.isArray(x.sources)&&x.sources.length<=16
  &&Array.from(x.sources).every(s=>!!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['path','version'].includes(k))&&officeRelativePath(s.path)&&officeHash(s.version))
  &&new Set(x.sources.map(s=>s.path.toLowerCase())).size===x.sources.length
  &&(x.parentArtifactId===undefined||typeof x.parentArtifactId==='string'&&/^artifact_[a-f0-9-]{36}$/i.test(x.parentArtifactId));
}
