import {createHash} from 'node:crypto';

type Row=Record<string,unknown>;
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Row[]>};
export const CROP_RECHECK_TABLES=[
 `CREATE TABLE IF NOT EXISTS material_ai_crop_rechecks(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',snapshot_json TEXT NOT NULL,created_at TEXT NOT NULL,owner_pid INTEGER NOT NULL DEFAULT 0,lease TEXT NOT NULL DEFAULT '',FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`,
 `CREATE UNIQUE INDEX IF NOT EXISTS material_ai_crop_rechecks_active ON material_ai_crop_rechecks(batch_id,ordinal) WHERE status IN ('pending','running','paused')`,
 `CREATE INDEX IF NOT EXISTS material_ai_crop_rechecks_queue ON material_ai_crop_rechecks(status,created_at,id)`,
 `CREATE TABLE IF NOT EXISTS material_ai_crop_recheck_results(check_id TEXT NOT NULL REFERENCES material_ai_crop_rechecks(id),batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,number TEXT NOT NULL,base_sha TEXT NOT NULL,first_sha TEXT NOT NULL,page_image_sha TEXT NOT NULL,source_json TEXT NOT NULL,image_json TEXT NOT NULL,quality_json TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,PRIMARY KEY(check_id,number))`,
 `CREATE INDEX IF NOT EXISTS material_ai_crop_recheck_results_source ON material_ai_crop_recheck_results(batch_id,ordinal,number)`
];
export const failedCrop=(row:Row)=>typeof row.image_json==='string'&&row.image_json.includes('"schemaVersion":"xiaozhi.material-ai-fragment-crops.failed.v1"');
export const cropRowHash=(row:Row)=>createHash('sha256').update(JSON.stringify(['batch_id','ordinal','number','first_sha','page_image_sha','source_json','image_json','quality_json'].map(k=>row[k]))).digest('hex');
/** The old negative receipt remains immutable. Only committed, source-bound checks overlay it. */
export async function recheckedCropRows(host:Host,batchId:string,ordinal:number,base:Row[]){
 if(!base.some(failedCrop))return base;
 const checked=await host.all(`SELECT r.* FROM material_ai_crop_recheck_results r JOIN material_ai_crop_rechecks j ON j.id=r.check_id WHERE r.rowid IN (SELECT MAX(x.rowid) FROM material_ai_crop_recheck_results x JOIN material_ai_crop_rechecks y ON y.id=x.check_id WHERE x.batch_id=? AND x.ordinal=? AND y.status IN ('complete','partial') GROUP BY x.number)`,[batchId,ordinal]);
 const latest=new Map<string,Row>();for(const row of checked)if(!latest.has(String(row.number)))latest.set(String(row.number),row);
 if(latest.size>20)throw Error('source_changed');
 return base.map(row=>{const result=latest.get(String(row.number));if(!result)return row;
  if(!failedCrop(row)||result.base_sha!==cropRowHash(row)||['first_sha','page_image_sha','source_json'].some(k=>result[k]!==row[k]))throw Error('source_changed');
  return{...row,image_json:result.image_json,quality_json:result.quality_json};
 });
}
