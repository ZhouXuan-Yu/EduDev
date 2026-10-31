import {createHash,randomUUID} from 'node:crypto';
import {LOCAL_OCR_ENGINE,validLocalOcrReceipt,type LocalOcrReceipt} from '../../shared/xiaozhi-ocr';
import type {MaterialParseLease} from './material-parse-queue';

type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Record<string,unknown>[]>;change:(sql:string,p?:Value[])=>Promise<number>};
export const IMAGE_OCR_VERSION='xiaozhi.material-image-ocr.v1';
const errors=['empty','parse_failed','configuration','too_large','invalid_input','timeout','unavailable'] as const;
/** One local recognition attempt, including failures with no worker receipt. No fabricated body. */
export async function migrateImageOcr(host:{run:(sql:string)=>Promise<unknown>}){
 await host.run(`CREATE TABLE IF NOT EXISTS material_image_ocr_receipts(resource_id TEXT PRIMARY KEY REFERENCES teacher_resources(id),version TEXT NOT NULL,generation TEXT NOT NULL,schema_version TEXT NOT NULL,engine TEXT NOT NULL,status TEXT NOT NULL,receipt_json TEXT NOT NULL,error TEXT NOT NULL)`);
 await host.run(`CREATE TABLE IF NOT EXISTS material_image_ocr_history(resource_id TEXT NOT NULL REFERENCES teacher_resources(id),version TEXT NOT NULL,generation TEXT PRIMARY KEY,schema_version TEXT NOT NULL,engine TEXT NOT NULL,status TEXT NOT NULL,receipt_json TEXT NOT NULL,error TEXT NOT NULL)`);
 await host.run('CREATE INDEX IF NOT EXISTS material_image_ocr_history_owner ON material_image_ocr_history(resource_id,version)');
 await host.run(`CREATE TRIGGER IF NOT EXISTS material_image_ocr_keep_v1 BEFORE UPDATE ON material_image_ocr_receipts BEGIN
 INSERT INTO material_image_ocr_history SELECT old.resource_id,old.version,old.generation,old.schema_version,old.engine,old.status,old.receipt_json,old.error WHERE NOT EXISTS(SELECT 1 FROM material_image_ocr_history WHERE generation=old.generation); END`);
 // Also works for an existing receipt table whose foreign key did not cascade.
 await host.run(`CREATE TRIGGER IF NOT EXISTS material_image_ocr_remove_v1 BEFORE DELETE ON teacher_resources BEGIN
 DELETE FROM material_image_ocr_history WHERE resource_id=old.id; DELETE FROM material_image_ocr_receipts WHERE resource_id=old.id; END`);
}
export async function saveImageOcr(host:Host,resourceId:string,version:string,result:Extract<LocalOcrReceipt,{ok:true}>|Error,signal:AbortSignal,lease?:MaterialParseLease){
 signal.throwIfAborted();const failed=result instanceof Error,error=failed?result.message:'';
 if(failed?!errors.includes(error as typeof errors[number]):!validLocalOcrReceipt(result)||!result.ok)throw Error('parse_failed');
 const changed=await host.change(`INSERT INTO material_image_ocr_receipts(resource_id,version,generation,schema_version,engine,status,receipt_json,error)
 SELECT id,?,?,?,?,?,?,? FROM teacher_resources WHERE id=? AND content_hash=? ${lease?"AND EXISTS(SELECT 1 FROM ai_tasks WHERE id=? AND task_type='resource_parse' AND status='running' AND payload_json=?)":''}
 ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,generation=excluded.generation,schema_version=excluded.schema_version,engine=excluded.engine,status=excluded.status,receipt_json=excluded.receipt_json,error=excluded.error`,
 [version,randomUUID(),IMAGE_OCR_VERSION,LOCAL_OCR_ENGINE,failed?error==='empty'?'blank':'failed':'complete',failed?'':JSON.stringify(result),error,resourceId,version,...(lease?[lease.taskId,lease.payload]:[])]);
 signal.throwIfAborted();if(changed!==1)throw Error(lease?'cancelled':'source_changed');
}
export async function readImageOcr(host:Pick<Host,'all'>,resourceId:string,version:string){
 const row=(await host.all('SELECT * FROM material_image_ocr_receipts WHERE resource_id=? AND version=?',[resourceId,version]))[0];
 if(!row||row.schema_version!==IMAGE_OCR_VERSION||row.engine!==LOCAL_OCR_ENGINE||typeof row.generation!=='string'||!/^[a-f0-9-]{36}$/i.test(row.generation)||typeof row.receipt_json!=='string'||Buffer.byteLength(row.receipt_json)>1048576)throw Error('source_incomplete');
 let text='';
 if(row.status==='complete'){
  let receipt;try{receipt=JSON.parse(row.receipt_json);}catch{throw Error('source_changed');}
  if(row.error!==''||!validLocalOcrReceipt(receipt)||!receipt.ok)throw Error('source_changed');text=receipt.text;
 }else if(!['blank','failed'].includes(String(row.status))||row.receipt_json!==''||!errors.includes(row.error as typeof errors[number])||(row.status==='blank')!==(row.error==='empty'))throw Error('source_changed');
 if(Buffer.byteLength(text)>64000)throw Error('unit_too_large');
 return{generation:row.generation,text,receiptSha:createHash('sha256').update(JSON.stringify([row.schema_version,row.engine,row.generation,row.status,row.receipt_json,row.error])).digest('hex')};
}
