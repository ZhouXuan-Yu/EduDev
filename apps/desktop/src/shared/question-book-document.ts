import {validMaterialPageSource,MATERIAL_PAGE_SOURCE,type MaterialPageSource} from './material-ai-page';
import {plainStudentInput} from './student-context';
import {aiBatchId} from './material-ai';

export const QUESTION_BOOK_DOCUMENT_EVIDENCE='xiaozhi.question-book-document-evidence.v1' as const;
export const LOCAL_BOOK_DOCUMENT_EVIDENCE='xiaozhi.question-book-local-evidence.v1' as const;
/** Independent answer-PDF provenance. It never uses primary-question image anchors. */
type BookDocumentSource={candidateId:string;source:MaterialPageSource;section:string;number:string;quoteSha:string};
export type BookDocumentProof=BookDocumentSource&(
 {schemaVersion:typeof QUESTION_BOOK_DOCUMENT_EVIDENCE;batchId:string;ordinal:number;firstSha:string;finalSha:string;imageSha:string}|
 {schemaVersion:typeof LOCAL_BOOK_DOCUMENT_EVIDENCE;proofSha:string}
);
export function validBookDocumentProof(v:unknown):v is BookDocumentProof{
 const common=['schemaVersion','candidateId','source','section','number','quoteSha'];
 const local=!!v&&typeof v==='object'&&Object.getOwnPropertyDescriptor(v,'schemaVersion')?.value===LOCAL_BOOK_DOCUMENT_EVIDENCE;
 const keys=[...common,...(local?['proofSha']:['batchId','ordinal','firstSha','finalSha','imageSha'])];
 const sha=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(!plainStudentInput(v,keys)||Object.keys(v).length!==keys.length||typeof v.candidateId!=='string'||
  !/^bookanswer_[a-f0-9-]{36}$/.test(v.candidateId)||!validMaterialPageSource(v.source)||v.source.schemaVersion!==MATERIAL_PAGE_SOURCE||
  !sha(v.quoteSha)||typeof v.section!=='string'||v.section.length<1||v.section.length>200||
  typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number))return false;
 if(local)return sha(v.proofSha);
 return v.schemaVersion===QUESTION_BOOK_DOCUMENT_EVIDENCE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&
  Number(v.ordinal)>0&&Number(v.ordinal)<=100&&[v.firstSha,v.finalSha,v.imageSha].every(sha);
}
