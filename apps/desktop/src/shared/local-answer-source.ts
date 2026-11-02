import {validAttachmentId,validAttachmentPath} from './xiaozhi-attachments';
import {isOfficeDocument} from './xiaozhi-documents';
type Lines={startLine:number;endLine:number;partialLine?:boolean};
export type LocalAnswerSource = Lines&(
  {kind:'workspace';path:string;version:string;locator:'text_lines'|'extracted_lines'}
  |{kind:'attachment';id:string;revision:number;version:string;locator:'text_lines'|'extracted_lines'|'ocr_lines';ocrRevision?:number});
export function validLocalAnswerSource(value:unknown):value is LocalAnswerSource {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as LocalAnswerSource;
  const keys=v.kind==='workspace'?['kind','path','version','locator','startLine','endLine','partialLine']
    :['kind','id','revision','version','locator','startLine','endLine','partialLine','ocrRevision'];
  if(Object.keys(v).some(key=>!keys.includes(key))||typeof v.version!=='string'||!/^[a-f0-9]{64}$/.test(v.version)
    ||!Number.isSafeInteger(v.startLine)||!Number.isSafeInteger(v.endLine)||v.startLine<1||v.endLine<v.startLine||v.endLine>1000000
    ||(v.partialLine!==undefined&&typeof v.partialLine!=='boolean'))return false;
  return v.kind==='workspace'?validAttachmentPath(v.path)&&(v.locator==='text_lines'||v.locator==='extracted_lines'&&isOfficeDocument(v.path))
    :v.kind==='attachment'&&validAttachmentId(v.id)&&Number.isSafeInteger(v.revision)&&v.revision>=0
      &&['text_lines','extracted_lines','ocr_lines'].includes(v.locator)
      &&(v.locator==='ocr_lines'?Number.isSafeInteger(v.ocrRevision)&&v.ocrRevision!>=0:v.ocrRevision===undefined);
}
