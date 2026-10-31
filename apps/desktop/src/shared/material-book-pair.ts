import {materialId} from './materials';
import {plainStudentInput} from './student-context';
export const MATERIAL_BOOK_PAIR_SCHEMA='xiaozhi.material-book-pair.v1' as const;
export type MaterialBookPairInput={schemaVersion:typeof MATERIAL_BOOK_PAIR_SCHEMA;action:'link'|'unlink';resourceId:string;version:string;revision:number;answerId?:string;answerVersion?:string};
export type MaterialBookRole={kind:'questions'|'answers';questionId:string;questionVersion:string;answerId:string;answerVersion:string;revision:number};
export type MaterialBookPairView={schemaVersion:typeof MATERIAL_BOOK_PAIR_SCHEMA;resourceId:string;revision:number;role:MaterialBookRole|null;questionTitle?:string;answerTitle?:string;current:boolean};
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validMaterialBookPairInput(v:unknown):v is MaterialBookPairInput{
 return plainStudentInput(v,['schemaVersion','action','resourceId','version','revision','answerId','answerVersion'])&&v.schemaVersion===MATERIAL_BOOK_PAIR_SCHEMA&&['link','unlink'].includes(String(v.action))&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.revision)&&Number(v.revision)>=0&&Number(v.revision)<Number.MAX_SAFE_INTEGER
  &&(v.action==='link'?Object.keys(v).length===7&&materialId(v.answerId)&&v.answerId!==v.resourceId&&sha(v.answerVersion):Object.keys(v).length===5);
}
