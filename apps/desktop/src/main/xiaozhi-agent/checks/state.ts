import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';
import {DELIVERY_CHECK_SCHEMA,CHECK_CLASSES,type DeliveryCheckReport,type DeliveryCheckInput} from '../../../shared/xiaozhi-delivery-checks';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
function parse(row:Record<string,unknown>):DeliveryCheckReport{
 const text=String(row.report_json);if(text.length>512000||hash(text)!==row.report_sha256)throw Error('configuration');const value=JSON.parse(text) as DeliveryCheckReport;
 if(Number(row.schema_version)!==1||value.schemaVersion!==DELIVERY_CHECK_SCHEMA||value.id!==row.id||value.sessionId!==row.conversation_id||!Array.isArray(value.files)||value.files.length>8
  ||!['passed','failed','partial','cancelled'].includes(value.state)||value.files.some(f=>!Array.isArray(f.checks)||f.checks.some(c=>!CHECK_CLASSES.includes(c.kind)||!['passed','failed','unchecked','not_applicable'].includes(c.state))))throw Error('configuration');
 return value;
}
/** Rebuildable inspection receipts in the existing SQLite. Never a file-effect authority. */
export function createInspectionState(sql:Sql){
 return{
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_delivery_inspections (
    id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, conversation_id TEXT NOT NULL,
    run_id TEXT, call_id TEXT, scope TEXT NOT NULL, created_at TEXT NOT NULL,
    policy_json TEXT NOT NULL, report_json TEXT NOT NULL, report_sha256 TEXT NOT NULL)`);
   await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_delivery_inspections_session_time ON xiaozhi_delivery_inspections(conversation_id,created_at DESC)');
   await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_delivery_inspections_scope_time ON xiaozhi_delivery_inspections(scope,created_at DESC)');
  },
  async put(report:DeliveryCheckReport,policy:DeliveryCheckInput){
   const text=JSON.stringify(report);if(text.length>512000)throw Error('too_large');
   await sql.run('INSERT INTO xiaozhi_delivery_inspections(id,conversation_id,run_id,call_id,scope,created_at,policy_json,report_json,report_sha256) VALUES(?,?,?,?,?,?,?,?,?)',
    [report.id,report.sessionId,report.runId,report.callId,report.scope,report.createdAt,JSON.stringify(policy),text,hash(text)]);
   await sql.run('DELETE FROM xiaozhi_delivery_inspections WHERE conversation_id=? AND id IN (SELECT id FROM xiaozhi_delivery_inspections WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET 64)',[report.sessionId,report.sessionId]);
  },
  async cancel(report:DeliveryCheckReport,policy:DeliveryCheckInput){
   const value={...report,state:'cancelled' as const},text=JSON.stringify(value);
   await sql.run(`INSERT INTO xiaozhi_delivery_inspections(id,conversation_id,run_id,call_id,scope,created_at,policy_json,report_json,report_sha256) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET report_json=excluded.report_json,report_sha256=excluded.report_sha256
    WHERE conversation_id=excluded.conversation_id AND scope=excluded.scope`,[value.id,value.sessionId,value.runId,value.callId,value.scope,value.createdAt,JSON.stringify(policy),text,hash(text)]);
  },
  async get(sessionId:string,id:string){const row=(await sql.all('SELECT * FROM xiaozhi_delivery_inspections WHERE conversation_id=? AND id=?',[sessionId,id]))[0];return row?{report:parse(row),policy:JSON.parse(String(row.policy_json)) as DeliveryCheckInput}:null;},
  async list(sessionId:string){return(await sql.all('SELECT * FROM xiaozhi_delivery_inspections WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 12',[sessionId])).map(parse);},
  async latest(scope:string){const row=(await sql.all('SELECT * FROM xiaozhi_delivery_inspections WHERE scope=? ORDER BY created_at DESC,id DESC LIMIT 1',[scope]))[0];return row?parse(row):null;},
  async call(sessionId:string,runId:string,callId:string){const row=(await sql.all('SELECT * FROM xiaozhi_delivery_inspections WHERE conversation_id=? AND run_id=? AND call_id=? ORDER BY created_at DESC,id DESC LIMIT 1',[sessionId,runId,callId]))[0];return row?parse(row):null;},
  async candidate(scope:string){const row=(await sql.all("SELECT * FROM xiaozhi_delivery_inspections WHERE scope=? AND json_extract(report_json,'$.candidate')=1 AND json_extract(report_json,'$.state')!='cancelled' ORDER BY created_at DESC,id DESC LIMIT 1",[scope]))[0];return row?{report:parse(row),policy:JSON.parse(String(row.policy_json)) as DeliveryCheckInput}:null;},
 };
}
