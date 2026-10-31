import {extractMaterialQuestions} from './material-question-extract';
import type {MaterialPageSource} from '../../shared/material-ai-page';
/** Reuse the deterministic parser on the AI transcript. Adapter body refs never leave this function. */
export function restoredPageQuestions(text:string,source:MaterialPageSource,declaredNumbers:readonly string[]=[]){
 // The structured response already declares these question numbers. Change only the
 // ephemeral parser marker, preserving every original body character and raw receipt.
 // This lets the existing strict parser see MCQs/fill-ins without an interrogative cue.
 const declared=new Set(declaredNumbers.filter(n=>/^\d{1,5}$/.test(n)));
 const body=text.replace(/^([ \t]{0,3})(\d{1,5})[.、．](?!\d)[ \t]*/gm,(raw,space:string,number:string)=>declared.has(number)?space+'第'+number+'题 ':raw);
 const candidates=extractMaterialQuestions([{resourceId:source.resourceId,version:source.version,title:'原页AI还原',offset:0,chunk:{id:'chunk_'+source.generation,resourceId:source.resourceId,resourceTitle:'原页AI还原',chunkIndex:0,heading:'',contentMd:body,containsPersonalData:false,pageNumber:source.page,subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceTrust:'machine_extracted',qualityScore:0,evidenceStrength:'background',embeddingStatus:'not_indexed',createdAt:''}}],'local-text-v1');
 return candidates.map(c=>({fields:c.fields,number:c.archive.number,risks:c.archive.sourceRisks}));
}
