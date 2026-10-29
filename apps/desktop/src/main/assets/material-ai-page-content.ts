import {extractMaterialQuestions} from './material-question-extract';
import type {MaterialPageSource} from '../../shared/material-ai-page';
/** Reuse the deterministic parser on the AI transcript. Adapter body refs never leave this function. */
export function restoredPageQuestions(text:string,source:MaterialPageSource){
 const candidates=extractMaterialQuestions([{resourceId:source.resourceId,version:source.version,title:'原页AI还原',offset:0,chunk:{id:'chunk_'+source.generation,resourceId:source.resourceId,resourceTitle:'原页AI还原',chunkIndex:0,heading:'',contentMd:text,containsPersonalData:false,pageNumber:source.page,subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceTrust:'machine_extracted',qualityScore:0,evidenceStrength:'background',embeddingStatus:'not_indexed',createdAt:''}}],'local-text-v1');
 return candidates.map(c=>({fields:c.fields,number:c.archive.number,risks:c.archive.sourceRisks}));
}
