export const OFFICE_VERSIONS_SCHEMA='xiaozhi.office-versions.v1' as const;
type Address={schemaVersion:typeof OFFICE_VERSIONS_SCHEMA;sessionId:string;artifactId:string};
export type OfficeVersionInput=Address&({action:'view'|'open'|'locate'}|{action:'restore';currentArtifactId:string;commandId:string});
export type OfficeVersion={artifactId:string;path:string;title:string;format:string;number:number;savedAt:string;parentArtifactId:string|null;size:number;change:string};
export type OfficeVersionView={schemaVersion:typeof OFFICE_VERSIONS_SCHEMA;sessionId:string;selectedArtifactId:string;currentArtifactId:string;versions:OfficeVersion[];integrity:'same'|'missing'|'changed';canRestore:boolean};
export type OfficeVersionError='invalid_input'|'permission_denied'|'busy'|'changed'|'missing'|'conflict'|'unsupported'|'file_writes_disabled'|'open_failed'|'configuration';
export type OfficeVersionResult={ok:true;value:OfficeVersionView}|{ok:false;error:OfficeVersionError};
export const OFFICE_VERSION_ERRORS:Record<OfficeVersionError,string>={invalid_input:'版本请求无效，请重新读取。',permission_denied:'此会话或文件目录已不可用，请返回来源对话检查。',busy:'有任务正在运行，请结束后再操作版本。',changed:'此文件已被外部修改，保留原记录；请在来源对话中重新读取后处理。',missing:'此版本的文件已移走或删除，历史记录仍保留；不会自动重建。',conflict:'当前版本或目标文件已变化，请刷新历史后重新选择；没有覆盖已有文件。',unsupported:'此文件来自已确认的试卷或课堂，请返回对应页面修改并重新导出。',file_writes_disabled:'当前已暂停小智文件写入，仍可查看和打开已有版本。',open_failed:'系统未能打开或定位文件，请检查关联程序及文件位置。',configuration:'未能确认版本操作结果，请刷新历史；不要重复创建文件。'};
const artifact=(v:unknown):v is string=>typeof v==='string'&&/^artifact_[a-f0-9-]{36}$/i.test(v);
export function validOfficeVersionInput(raw:unknown):raw is OfficeVersionInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const v=raw as Record<string,unknown>;
 if(v.schemaVersion!==OFFICE_VERSIONS_SCHEMA||typeof v.sessionId!=='string'||!/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)||!artifact(v.artifactId))return false;
 const restore=v.action==='restore';return (restore||['view','open','locate'].includes(String(v.action)))&&Object.keys(v).every(k=>['schemaVersion','sessionId','artifactId','action',...(restore?['currentArtifactId','commandId']:[])].includes(k))
  &&(!restore||artifact(v.currentArtifactId)&&typeof v.commandId==='string'&&/^xicmd_[a-f0-9-]{36}$/i.test(v.commandId));
}
