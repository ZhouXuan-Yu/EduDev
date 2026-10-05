import type {MistakeImageAnalysis} from './contracts';
import {plainStudentInput,validStudentId} from './student-context';
import {LOCAL_OCR_ENGINE,LOCAL_OCR_SCHEMA} from './xiaozhi-ocr';
export const MISTAKE_OCR_SCHEMA='xiaozhi.education.mistake-ocr.v1' as const;
export type MistakeOcrProvenance={schemaVersion:typeof LOCAL_OCR_SCHEMA;engine:typeof LOCAL_OCR_ENGINE;sourceSha256:string;sourceVersion:string;original:string};
export type MistakeOcrInput={schemaVersion:typeof MISTAKE_OCR_SCHEMA;studentId:string;analysisId:string;version:string;requestId:string};
export type MistakeOcrCorrection=MistakeOcrInput&{text:string};
export const MISTAKE_OCR_ERRORS={invalid_input:'请重新选择错题图片。',permission_denied:'学生或图片不可用，请重新选择。',source_changed:'图片或校正记录已变化，请刷新后核对。',busy:'识别正在进行，请等待或取消。',cancelled:'已取消识别，没有保存识别结果。',timeout:'识别超时，请重试。',too_large:'图片超过本地识别大小限制（4 MB）。',unsupported:'图片格式不支持，请使用 PNG、JPG 或 WebP。',unavailable:'本地识别引擎不可用，请检查安装后重试。',configuration:'本地识别引擎校验失败，请重新安装。',parse_failed:'没有完成图片识别，请重试或手动校正。',empty:'未识别出文字，请手动校正。',conflict:'已保存教师校正，不能覆盖。'} as const;
export type MistakeOcrError=keyof typeof MISTAKE_OCR_ERRORS;
export type MistakeOcrResult={ok:true;schemaVersion:typeof MISTAKE_OCR_SCHEMA;analysis:MistakeImageAnalysis}|{ok:false;schemaVersion:typeof MISTAKE_OCR_SCHEMA;error:MistakeOcrError};
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function validMistakeOcrInput(v:unknown,correction=false):v is MistakeOcrCorrection{
 const fields=['schemaVersion','studentId','analysisId','version','requestId',...(correction?['text']:[])];
 return plainStudentInput(v,fields)&&Object.keys(v).length===fields.length&&v.schemaVersion===MISTAKE_OCR_SCHEMA&&validStudentId(v.studentId)&&typeof v.analysisId==='string'&&v.analysisId.startsWith('mistake_image_')&&uuid(v.analysisId.slice(14))&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&uuid(v.requestId)&&(!correction||typeof v.text==='string'&&Boolean(v.text.trim())&&v.text.length<=128000&&!v.text.includes('\0'));
}
export function validMistakeOcrProvenance(v:unknown):v is MistakeOcrProvenance{
 return plainStudentInput(v,['schemaVersion','engine','sourceSha256','sourceVersion','original'])&&Object.keys(v).length===5&&v.schemaVersion===LOCAL_OCR_SCHEMA&&v.engine===LOCAL_OCR_ENGINE&&typeof v.sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(v.sourceSha256)&&typeof v.sourceVersion==='string'&&v.sourceVersion.length>0&&v.sourceVersion.length<=200&&typeof v.original==='string'&&v.original.length>0&&v.original.length<=128000;
}
