import {officeRelativePath} from './xiaozhi-office-artifacts';
export const PAPER_EXPORT_TOOL='education_export_paper' as const;
export const PAPER_OUTPUT_SCHEMA='xiaozhi.paper-output.v1' as const;
export type PaperOutputInput={schemaVersion:typeof PAPER_OUTPUT_SCHEMA;sessionId:string};
export const PAPER_OFFICE_SCHEMA='xiaozhi.office-paper-draft.v2' as const;
export const PAPER_RICH_OFFICE_SCHEMA='xiaozhi.office-paper-draft.v3' as const;
export const PAPER_MATH_OFFICE_SCHEMA='xiaozhi.office-paper-draft.v4' as const;
export const PAPER_TABLE_OFFICE_SCHEMA='xiaozhi.office-paper-draft.v5' as const;
export const isMathPaperOfficeSchema=(v:unknown)=>v===PAPER_MATH_OFFICE_SCHEMA||v===PAPER_TABLE_OFFICE_SCHEMA;
export const isRichPaperOfficeSchema=(v:unknown)=>v===PAPER_RICH_OFFICE_SCHEMA||isMathPaperOfficeSchema(v);
export type PaperOfficeFigure={questionId:string;version:string;blockId:string;role:'question'|'answer'|'analysis';assetId:string;sha256:string;width:number;height:number;afterParagraph:number};
export const isPaperOfficeSchema=(v:unknown)=>v===PAPER_OFFICE_SCHEMA||isRichPaperOfficeSchema(v);
export type PaperExportInput={format:'docx'|'pdf';audience:'student'|'teacher';path:string};
export type PaperOfficeSource={paperId:string;digest:string;audience:PaperExportInput['audience']};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);
 return names.length===keys.length&&names.every(k=>typeof k==='string'&&keys.includes(k)&&'value' in descriptors[k]&&descriptors[k].enumerable);
};
export function validPaperExport(v:unknown):v is PaperExportInput{
 return exact(v,['format','audience','path'])&&['docx','pdf'].includes(String(v.format))&&['student','teacher'].includes(String(v.audience))
  &&officeRelativePath(v.path)&&v.path.toLowerCase().endsWith('.'+v.format);
}
export function validPaperOutput(v:unknown):v is PaperOutputInput{
 return exact(v,['schemaVersion','sessionId'])&&v.schemaVersion===PAPER_OUTPUT_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId);
}
export function validPaperOfficeSource(v:unknown):v is PaperOfficeSource{
 return exact(v,['paperId','digest','audience'])&&typeof v.paperId==='string'&&/^xipaper_[a-f0-9-]{36}$/i.test(v.paperId)
  &&typeof v.digest==='string'&&/^[a-f0-9]{64}$/.test(v.digest)&&['student','teacher'].includes(String(v.audience));
}
export function validPaperOfficeFigure(v:unknown,paragraphs:number):v is PaperOfficeFigure{
 return exact(v,['questionId','version','blockId','role','assetId','sha256','width','height','afterParagraph'])
  &&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/i.test(v.questionId)
  &&typeof v.assetId==='string'&&/^asset_[a-f0-9-]{36}$/i.test(v.assetId)
  &&typeof v.blockId==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v.blockId)
  &&[v.version,v.sha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))
  &&['question','answer','analysis'].includes(String(v.role))
  &&[v.width,v.height].every(x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0&&x<=16000)
  &&Number(v.width)*Number(v.height)<=16000000
  &&typeof v.afterParagraph==='number'&&Number.isSafeInteger(v.afterParagraph)&&v.afterParagraph>=0&&v.afterParagraph<=paragraphs;
}
