import {validMaterialPageSource,MATERIAL_PAGE_SOURCE,type MaterialPageSource} from './material-ai-page';
import {plainStudentInput} from './student-context';
import {aiBatchId} from './material-ai';

export const QUESTION_BOOK_DOCUMENT_EVIDENCE='xiaozhi.question-book-document-evidence.v1' as const;
/** Independent answer-PDF provenance. It never uses primary-question image anchors. */
export type BookDocumentProof={schemaVersion:typeof QUESTION_BOOK_DOCUMENT_EVIDENCE;candidateId:string;source:MaterialPageSource;batchId:string;ordinal:number;firstSha:string;finalSha:string;imageSha:string;section:string;number:string;quoteSha:string};
export function validBookDocumentProof(v:unknown):v is BookDocumentProof{
 const keys=['schemaVersion','candidateId','source','batchId','ordinal','firstSha','finalSha','imageSha','section','number','quoteSha'];
 if(!plainStudentInput(v,keys)||Object.keys(v).length!==keys.length)return false;
 return v.schemaVersion===QUESTION_BOOK_DOCUMENT_EVIDENCE&&typeof v.candidateId==='string'&&/^bookanswer_[a-f0-9-]{36}$/.test(v.candidateId)&&validMaterialPageSource(v.source)&&v.source.schemaVersion===MATERIAL_PAGE_SOURCE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>0&&Number(v.ordinal)<=100&&[v.firstSha,v.finalSha,v.imageSha,v.quoteSha].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s))&&typeof v.section==='string'&&v.section.length>0&&v.section.length<=200&&typeof v.number==='string'&&/^\d{1,5}$/.test(v.number);
}
