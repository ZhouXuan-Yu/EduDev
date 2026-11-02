import {createHash} from 'node:crypto';
import type {FileCheckRules} from '../../../shared/xiaozhi-delivery-checks';
/** Preserve the original hash for unaffected Office/static checks; invalidate former synthetic HTML input. */
export const hasHtmlInteractions=(files:{path:string;rules?:FileCheckRules}[])=>files.some(f=>/\.html?$/i.test(f.path)&&f.rules?.interactions?.length);
export function inspectionPolicy(files:{path:string;rules?:FileCheckRules}[],requirements:number|null,requirementDigest?:string){
 const inspector=hasHtmlInteractions(files)?'teacher-rules.2-native-input':'teacher-rules.1';
 return createHash('sha256').update(JSON.stringify({inspector,requirementDigest,files:files.map(f=>({path:f.path,rules:f.rules||{}})),requirements})).digest('hex');
}
