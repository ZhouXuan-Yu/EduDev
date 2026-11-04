import type {DocumentFailure,OfficeDocumentFormat} from './xiaozhi-documents';

/** Identity only: no caller-supplied paths, hashes, parser options or permissions. */
export type SavedArtifactPreviewInput={sessionId:string;artifactId:string;requestId:string};
export type SavedArtifactPreviewError=DocumentFailure|'invalid_input'|'permission_denied'|'changed'|'not_found'|'read_failed';
export type SavedArtifactPreviewResult={ok:true;requestId:string;value:{artifactId:string;name:string;format:OfficeDocumentFormat;
  sha256:string;fileVersion:string;markdown:string;parser:'hana-anydoc-0.1.2';warnings:string[]}}
  |{ok:false;requestId:string;error:SavedArtifactPreviewError};
export const SAVED_ARTIFACT_PREVIEW_ERRORS:Record<SavedArtifactPreviewError,string>={
  invalid_input:'预览请求无效，请重新选择文件。',permission_denied:'缺少匹配的保存回执或输出目录授权，请回来源对话检查。',
  changed:'文件或保存授权已变化，请重新选择文件后检查。',not_found:'已保存文件已移走或删除，保存记录仍保留。',
  unsupported:'此保存记录不支持试卷预览。',too_large:'文件过大，暂不能在这里预览。',empty:'文件没有可预览的文字。',
  needs_ocr:'文件需要文字识别，请使用资料处理入口。',parse_failed:'文件解析失败，原文件保持不变。',
  text_unreadable:'文件文字无法可靠读取，请定位原文件检查。',unavailable:'本地解析器暂不可用，请稍后重试。',
  busy:'本地预览繁忙，请稍后重试。',cancelled:'已停止预览，原文件保持不变。',timeout:'读取超时，原文件保持不变。',
  read_failed:'暂时无法读取保存文件，请稍后重试。',
};
export function validSavedArtifactPreviewInput(value:unknown):value is SavedArtifactPreviewInput{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===3&&Object.keys(v).every(k=>['sessionId','artifactId','requestId'].includes(k))
    &&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)
    &&typeof v.artifactId==='string'&&/^artifact_[a-f0-9-]{36}$/i.test(v.artifactId)
    &&typeof v.requestId==='string'&&/^xifile_[a-f0-9-]{36}$/i.test(v.requestId);
}
