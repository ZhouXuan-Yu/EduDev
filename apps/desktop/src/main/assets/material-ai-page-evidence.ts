import {pageRegionsPolicy,MATERIAL_PAGE_REGIONS_PROMPT} from '../../shared/material-ai-page-regions';
import {createHash} from 'node:crypto';
import {parseAiPageResponse,validMaterialPageSource,validAiPagePrompt,MATERIAL_BOOK_PAGE_POLICY,MATERIAL_QUESTION_PAGE_PROMPT,pageResponseMatchesPolicy} from '../../shared/material-ai-page';
import {validMaterialBookRole} from '../../shared/material-book-pair';
import {validAiBatch,type AiUnitInput} from '../../shared/material-ai';
import {validMaterialSource} from '../../shared/materials';
import {readAiImageInput} from './material-ai-image-files';
type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
/** Reopen persisted receipts and image bytes; callers still validate the current original. */
export async function readAiPageReceipt(host:Host,batchId:string,ordinal:number){
 const row=(await host.all('SELECT u.input_json,u.status,u.first_json,u.final_json,u.image_sha,b.config_json,p.source_json,p.first_sha,p.final_sha,p.image_sha page_image_sha FROM material_ai_page_units p JOIN material_ai_units u ON u.batch_id=p.batch_id AND u.ordinal=p.ordinal JOIN material_ai_batches b ON b.id=p.batch_id WHERE p.batch_id=? AND p.ordinal=?',[batchId,ordinal]))[0];
 if(!row||!['complete','review','no_questions'].includes(String(row.status))||typeof row.input_json!=='string'||Buffer.byteLength(row.input_json)>96*1024||hash(String(row.first_json))!==row.first_sha||hash(String(row.final_json))!==row.final_sha||row.image_sha!==row.page_image_sha||typeof row.image_sha!=='string'||!/^[a-f0-9]{64}$/.test(row.image_sha))throw Error('source_changed');
 let unit:AiUnitInput,config;try{unit=JSON.parse(row.input_json);config=JSON.parse(String(row.config_json));}catch{throw Error('source_changed');}
 if(unit.pagePrompt!==undefined&&!validAiPagePrompt(unit.pagePrompt))throw Error('source_changed');
 if((unit.pagePrompt?.policy===MATERIAL_QUESTION_PAGE_PROMPT||pageRegionsPolicy(unit.pagePrompt?.policy))&&(unit.bookRole?.kind==='answers'||!unit.pageSource||unit.pageSource.page>unit.pagePrompt.totalPages))throw Error('source_changed');
 if(unit.bookPagePolicy!==undefined&&(unit.bookPagePolicy!==MATERIAL_BOOK_PAGE_POLICY||!unit.pagePrompt||unit.bookRole?.kind!=='answers'||!validMaterialBookRole(unit.bookRole)))throw Error('source_changed');
 if(!config||typeof config!=='object')throw Error('source_changed');const {model,...batch}=config;
 if(model!=='deepseek-flash'||!validAiBatch(batch)||!batch.images||ordinal>batch.count||!validMaterialPageSource(unit.pageSource)||unit.native||!Array.isArray(unit.sources)||unit.sources.length>64||!unit.sources.every(s=>validMaterialSource(s)&&s.resourceId===batch.resourceId&&s.version===batch.version)||unit.pageSource.resourceId!==batch.resourceId||unit.pageSource.version!==batch.version||unit.pageSource.page!==batch.start+ordinal-1||unit.page!==unit.pageSource.page||typeof unit.text!=='string'||Buffer.byteLength(unit.text)>64000||typeof unit.stamp!=='string'||JSON.stringify(unit.pageSource)!==row.source_json)throw Error('source_changed');
 const image=(await host.all('SELECT * FROM material_ai_image_inputs WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
 if(!image||image.image_sha!==row.image_sha)throw Error('source_changed');await readAiImageInput(host,image);
 const first=parseAiPageResponse(String(row.first_json)),final=parseAiPageResponse(String(row.final_json));if(![first,final].every(r=>pageResponseMatchesPolicy(r,unit.bookPagePolicy,unit.bookRole?.kind==='answers',unit.pagePrompt)))throw Error('source_changed');
 return{unit,config,first,final,status:String(row.status),imageSha:row.image_sha,firstSha:String(row.first_sha),finalSha:String(row.final_sha)};
}
