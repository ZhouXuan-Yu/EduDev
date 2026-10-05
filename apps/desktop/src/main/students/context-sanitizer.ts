import type {OmniEduStore} from '../db';
import {createOfficeDocumentSanitizer} from '../xiaozhi-agent/office-document-tools';
export async function createStudentContextSanitizer(store:OmniEduStore){
 const clean=await createOfficeDocumentSanitizer(store),students=await store.listStudents('');
 const privateWords=[...new Set(students.flatMap(s=>[s.realName,s.displayName,s.school]).filter(Boolean))].sort((a,b)=>b.length-a.length);
 // A Windows drive starts at a token boundary; the final "s:" in https:// is not a drive.
 return async(text:string)=>{let value=await clean(text);for(const word of privateWords)value=value.split(word).join('[个人信息]');return value.replace(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s，。；]+/g,'[本地路径]');};
}
