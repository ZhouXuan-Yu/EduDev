import type {XiaozhiAttachmentError} from './xiaozhi-attachments';

export type TeachingArtifactReferenceInput = {sourceSessionId:string; artifactId:string; contentHash:string};
export type TeachingArtifactOrigin = TeachingArtifactReferenceInput & {fileVersion:string};
export type TeachingArtifactReferenceResult = {ok:true; sessionId:string} | {ok:false; error:XiaozhiAttachmentError};

const hash = (value:unknown): value is string => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);

export function validTeachingArtifactReference(value:unknown): value is TeachingArtifactReferenceInput {
  return validFields(value,false);
}

export function validTeachingArtifactOrigin(value:unknown): value is TeachingArtifactOrigin {
  return validFields(value,true);
}

function validFields(value:unknown,origin:boolean):boolean {
  if (!value || typeof value!=='object' || Array.isArray(value)) return false;
  const keys = origin ? ['sourceSessionId','artifactId','contentHash','fileVersion'] : ['sourceSessionId','artifactId','contentHash'];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length!==keys.length || keys.some(key=>!descriptors[key] || !('value' in descriptors[key]))) return false;
  return typeof descriptors.sourceSessionId.value==='string' && /^aisession_[a-f0-9-]{36}$/i.test(descriptors.sourceSessionId.value)
    && typeof descriptors.artifactId.value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(descriptors.artifactId.value)
    && hash(descriptors.contentHash.value) && (!origin || hash(descriptors.fileVersion.value));
}
