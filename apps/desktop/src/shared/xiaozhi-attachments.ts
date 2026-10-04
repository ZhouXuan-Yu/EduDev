/** Public local attachment metadata. No original file bytes/path or cloud consent. */
export const XIAOZHI_ATTACHMENTS_SCHEMA='xiaozhi.attachments.v1' as const;
export const MAX_XIAOZHI_ATTACHMENTS=8;
export type XiaozhiAttachmentState='draft'|'submitted'|'removed';
export type XiaozhiAttachmentFormat='text'|'markdown'|'office'|'image';
export type XiaozhiAttachment={schemaVersion:typeof XIAOZHI_ATTACHMENTS_SCHEMA;id:string;name:string;mime:string;size:number;
 format:XiaozhiAttachmentFormat;version:string;state:XiaozhiAttachmentState;revision:number;createdAt:string;updatedAt:string;runId?:string;messageId?:string};
export type XiaozhiAttachmentSelection={id:string;revision:number};
export type XiaozhiAttachmentError='invalid_input'|'permission_denied'|'not_found'|'changed'|'too_large'|'unsupported'|'busy'|'cancelled'|'configuration'|'read_failed'|'timeout'|'parse_failed'|'needs_ocr'|'empty'|'unavailable'|'text_unreadable';
export const validAttachmentSession=(id:unknown):id is string=>typeof id==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(id);
export const validAttachmentId=(id:unknown):id is string=>typeof id==='string'&&/^xiat_[a-f0-9-]{36}$/i.test(id);
export const validAttachmentPath=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=500
 &&!/[\\:\x00-\x1f]/.test(value)&&!value.startsWith('/')&&value.split('/').length<=8&&!value.split('/').some(p=>!p||p==='.'||p==='..');
export function validAttachmentSelection(value:unknown):value is XiaozhiAttachmentSelection{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(Reflect.ownKeys(value).some(key=>typeof key!=='string'||!['id','revision'].includes(key)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(descriptors).sort().join(',')!=='id,revision'||Object.values(descriptors).some(d=>!('value'in d)))return false;
 return validAttachmentId(descriptors.id.value)&&Number.isSafeInteger(descriptors.revision.value)&&descriptors.revision.value>=0&&descriptors.revision.value<Number.MAX_SAFE_INTEGER;
}
export type XiaozhiAttachmentInput={schemaVersion:typeof XIAOZHI_ATTACHMENTS_SCHEMA;sessionId:string;requestId:string};
export type XiaozhiAttachmentSelectedInput=XiaozhiAttachmentInput&{selection:XiaozhiAttachmentSelection};
export type XiaozhiAttachmentPreview=Omit<import('./xiaozhi-files').XiaozhiFilePreview,'path'>;
export type XiaozhiAttachmentChoice={items:XiaozhiAttachment[];failures:{name:string;error:XiaozhiAttachmentError}[]};
export type XiaozhiAttachmentResult<T>={ok:true;schemaVersion:typeof XIAOZHI_ATTACHMENTS_SCHEMA;requestId:string;data:T}
 |{ok:false;schemaVersion:typeof XIAOZHI_ATTACHMENTS_SCHEMA;requestId:string;error:XiaozhiAttachmentError};
export function validAttachmentInput(value:unknown,selected=false):value is XiaozhiAttachmentSelectedInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const keys=selected?['schemaVersion','sessionId','requestId','selection']:['schemaVersion','sessionId','requestId'];
 if(Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!keys.includes(k)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.values(descriptors).some(d=>!('value'in d)))return false;
 return descriptors.schemaVersion.value===XIAOZHI_ATTACHMENTS_SCHEMA&&validAttachmentSession(descriptors.sessionId.value)
  &&typeof descriptors.requestId.value==='string'&&/^xiattach_[a-f0-9-]{36}$/i.test(descriptors.requestId.value)
  &&(!selected||validAttachmentSelection(descriptors.selection.value));
}
export const XIAOZHI_ATTACHMENT_ERRORS:Record<XiaozhiAttachmentError,string>={
 invalid_input:'附件请求无效，请重新选择。',permission_denied:'此附件未获授权或对话已归档。',not_found:'本地附件已不存在。',
 changed:'附件版本已变化，请重新选择。',too_large:'附件超过本地大小或图片尺寸限制。',unsupported:'暂不支持此附件格式。',
 busy:'正在处理其他操作，或待发送附件已达8个。',cancelled:'附件操作已取消。',configuration:'本地附件配置不可用。',
 read_failed:'无法读取此附件，请重试。',timeout:'附件处理超时，请重试。',parse_failed:'此附件损坏或无法解析。',
 needs_ocr:'此文件需要本地 OCR 后才能读取正文。',empty:'此文件没有可提取的正文。',unavailable:'本地预览暂不可用，请重试。',text_unreadable:'文件文字无法正确解码。',
};
