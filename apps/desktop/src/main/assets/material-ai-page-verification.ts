import {createHash} from 'node:crypto';
import {MATERIAL_CROP_CORRECTION_POLICY,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT} from '../../shared/material-ai-page-fragments';
import {parseAiPageResponse,pageResponseMatchesPolicy,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const correctionReviewEnabled=(prompt?:AiPagePrompt)=>prompt?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.cropReviewPolicy===MATERIAL_CROP_CORRECTION_POLICY;
export const PAGE_VERIFICATION_TABLE=`CREATE TABLE IF NOT EXISTS material_ai_page_verifications(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,policy TEXT NOT NULL,first_sha TEXT NOT NULL,review_sha TEXT NOT NULL,review_json TEXT NOT NULL,image_sha TEXT NOT NULL,source_json TEXT NOT NULL,final_sha TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,ordinal),FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`;
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
export type CorrectionVerification={schemaVersion:'xiaozhi.material-ai-correction.v1';originalFirst:AiPageResponse;originalDraftSha256:string;reviewDraftSha256:string};
export function correctionVerification(originalFirst:AiPageResponse,review:AiPageResponse):CorrectionVerification{
 return{schemaVersion:'xiaozhi.material-ai-correction.v1',originalFirst,originalDraftSha256:hash(JSON.stringify(originalFirst)),reviewDraftSha256:hash(JSON.stringify(review))};
}
export function validCorrectionVerification(value:CorrectionVerification,review:AiPageResponse,prompt?:AiPagePrompt){
 try{return correctionReviewEnabled(prompt)&&!!value&&Object.keys(value).sort().join(',')==='originalDraftSha256,originalFirst,reviewDraftSha256,schemaVersion'&&value.schemaVersion==='xiaozhi.material-ai-correction.v1'&&value.originalDraftSha256===hash(JSON.stringify(value.originalFirst))&&value.reviewDraftSha256===hash(JSON.stringify(review))&&pageResponseMatchesPolicy(parseAiPageResponse(JSON.stringify(value.originalFirst)),undefined,false,prompt)&&pageResponseMatchesPolicy(parseAiPageResponse(JSON.stringify(review)),undefined,false,prompt);}catch{return false;}
}
/** Original raw receipts, source and raster stay authoritative; no caller-supplied draft can replace them. */
export async function readPageVerification(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,prompt:AiPagePrompt|undefined,firstRaw:string,imageSha:string,finalRaw?:string){
 if(!correctionReviewEnabled(prompt))return;
 const row=(await host.all('SELECT * FROM material_ai_page_verifications WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
 if(!row){if(finalRaw!==undefined)throw Error('source_changed');return;}
 if(row.policy!==MATERIAL_CROP_CORRECTION_POLICY||row.first_sha!==hash(firstRaw)||row.image_sha!==imageSha||row.source_json!==JSON.stringify(source)||typeof row.review_json!=='string'||Buffer.byteLength(row.review_json)>128*1024||row.review_sha!==hash(row.review_json)||row.final_sha!==(finalRaw===undefined?'':hash(finalRaw)))throw Error('source_changed');
 const review=parseAiPageResponse(row.review_json);if(!pageResponseMatchesPolicy(review,undefined,false,prompt))throw Error('source_changed');
 return{review,raw:row.review_json};
}
