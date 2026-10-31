import {materialId} from './materials';
import {plainStudentInput} from './student-context';
export const MATERIAL_BOOK_PAIR_SCHEMA='xiaozhi.material-book-pair.v1' as const;
export type MaterialBookPairInput={schemaVersion:typeof MATERIAL_BOOK_PAIR_SCHEMA;action:'link'|'unlink';resourceId:string;version:string;revision:number;answerId?:string;answerVersion?:string};
export type MaterialBookRole={kind:'questions'|'answers';questionId:string;questionVersion:string;answerId:string;answerVersion:string;revision:number};
export type MaterialBookPairView={schemaVersion:typeof MATERIAL_BOOK_PAIR_SCHEMA;resourceId:string;revision:number;role:MaterialBookRole|null;questionTitle?:string;answerTitle?:string;current:boolean};
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validMaterialBookRole(v:unknown):v is MaterialBookRole{
 return plainStudentInput(v,['kind','questionId','questionVersion','answerId','answerVersion','revision'])&&Object.keys(v).length===6&&['questions','answers'].includes(String(v.kind))&&materialId(v.questionId)&&materialId(v.answerId)&&v.questionId!==v.answerId&&sha(v.questionVersion)&&sha(v.answerVersion)&&Number.isSafeInteger(v.revision)&&Number(v.revision)>0&&Number(v.revision)<Number.MAX_SAFE_INTEGER;
}
/** Reopening a saved receipt may survive an unlink/restore of the exact same source identities. */
export function sameMaterialBookIdentity(a:unknown,b:unknown){return validMaterialBookRole(a)&&validMaterialBookRole(b)&&a.kind===b.kind&&a.questionId===b.questionId&&a.questionVersion===b.questionVersion&&a.answerId===b.answerId&&a.answerVersion===b.answerVersion;}
export function validMaterialBookPairInput(v:unknown):v is MaterialBookPairInput{
 return plainStudentInput(v,['schemaVersion','action','resourceId','version','revision','answerId','answerVersion'])&&v.schemaVersion===MATERIAL_BOOK_PAIR_SCHEMA&&['link','unlink'].includes(String(v.action))&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.revision)&&Number(v.revision)>=0&&Number(v.revision)<Number.MAX_SAFE_INTEGER
  &&(v.action==='link'?Object.keys(v).length===7&&materialId(v.answerId)&&v.answerId!==v.resourceId&&sha(v.answerVersion):Object.keys(v).length===5);
}
