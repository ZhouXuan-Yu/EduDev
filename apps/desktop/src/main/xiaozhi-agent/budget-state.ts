import type { Sql } from './session-state';
import type { XiaozhiBudget, XiaozhiBudgetSettings, XiaozhiUsage } from '../../shared/xiaozhi-agent';

export const DEFAULT_PI_BUDGET: XiaozhiBudget = { maxModelCalls: 16, maxToolCalls: 64, maxTokens: 100000, activeMs: 90000, waitMs: 300000 };
export function validPiBudget(value: unknown): value is XiaozhiBudget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields: Record<string, [number, number]> = { maxModelCalls:[1,64], maxToolCalls:[1,256], maxTokens:[1,1000000], activeMs:[1000,120000], waitMs:[1000,300000] };
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 5 && Object.keys(record).every(key => key in fields)
    && Object.entries(fields).every(([key,[min,max]]) => Number.isSafeInteger(record[key]) && Number(record[key]) >= min && Number(record[key]) <= max);
}
function settings(row?: Record<string,unknown>): XiaozhiBudgetSettings {
  if (!row) return {version:0,budget:{...DEFAULT_PI_BUDGET}};
  const budget: unknown = JSON.parse(String(row.payload_json));
  if (Number(row.schema_version) !== 1 || !validPiBudget(budget) || !Number.isSafeInteger(row.version) || Number(row.version)<1) throw new Error('configuration');
  return {version:Number(row.version),budget};
}
function publicUsage(row:Record<string,unknown>):XiaozhiUsage {
  const schema=Number(row.schema_version);
  if(schema!==1&&schema!==2)throw new Error('configuration');
  const value=JSON.parse(String(row.payload_json)) as XiaozhiUsage;
  if(schema===2&&value?.limitsEnforced!==false || schema===1&&value?.limitsEnforced!==undefined)throw new Error('configuration');
  const count=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
  const reasons=['model_calls','tool_calls','tokens','active_time','wait_time'];
  if(!value || value.runId!==row.run_id || !validPiBudget(value.budget) || value.cost!==null
    || !count(value.modelCalls) || schema===1&&value.modelCalls>64 || !count(value.toolCalls) || schema===1&&value.toolCalls>256
    || !count(value.activeMs) || !count(value.waitingMs) || !['unknown','partial','reported'].includes(value.completeness)
    || !['running','waiting','completed','interrupted','failed'].includes(value.state) || (value.exhausted && (schema===2||!reasons.includes(value.exhausted))))throw new Error('configuration');
  let tokens:XiaozhiUsage['tokens']=null;
  if(value.tokens!==null) {
    if(!value.tokens || !['input','output','cacheRead','cacheWrite','total'].every(key=>count(value.tokens![key as keyof NonNullable<XiaozhiUsage['tokens']>])))throw new Error('configuration');
    const {input,output,cacheRead,cacheWrite,total}=value.tokens;
    if(total!==input+output+cacheRead+cacheWrite)throw new Error('configuration');
    tokens={input,output,cacheRead,cacheWrite,total};
  }
  // Persistent private rows are data, not trusted renderer objects.
  return {runId:value.runId,budget:{...value.budget},...(schema===2?{limitsEnforced:false}:{}),modelCalls:value.modelCalls,toolCalls:value.toolCalls,tokens,
    completeness:value.completeness,cost:null,activeMs:value.activeMs,waitingMs:value.waitingMs,state:value.state,...(value.exhausted?{exhausted:value.exhausted}:{})};
}
export function createPiBudgetState(sql: Sql) {
  return {
    async migrateBudget() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_budget_settings(conversation_id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL,payload_json TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_usage(run_id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1,
        conversation_id TEXT NOT NULL,payload_json TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run('CREATE INDEX IF NOT EXISTS pi_usage_session ON xiaozhi_pi_usage(conversation_id,updated_at)');
    },
    async budgetSettings(id:string) { return settings((await sql.all('SELECT * FROM xiaozhi_pi_budget_settings WHERE conversation_id=?',[id]))[0]); },
    async saveBudget(id:string,version:number,budget:XiaozhiBudget) {
      if (!validPiBudget(budget) || !Number.isSafeInteger(version) || version<0 || !sql.change) throw new Error('invalid_input');
      const now=new Date().toISOString();
      if (version === 0) return (await sql.change('INSERT OR IGNORE INTO xiaozhi_pi_budget_settings(conversation_id,version,payload_json,updated_at) VALUES(?,1,?,?)',[id,JSON.stringify(budget),now])) === 1;
      return (await sql.change('UPDATE xiaozhi_pi_budget_settings SET version=version+1,payload_json=?,updated_at=? WHERE conversation_id=? AND version=? AND schema_version=1',[JSON.stringify(budget),now,id,version])) === 1;
    },
    async saveUsage(id:string,value:XiaozhiUsage) {
      // Main-owned bounded projection only; never accept this method's value through IPC.
      const schema=value.limitsEnforced===false?2:1;
      publicUsage({run_id:value.runId,schema_version:schema,payload_json:JSON.stringify(value)});
      await sql.run(`INSERT INTO xiaozhi_pi_usage(run_id,schema_version,conversation_id,payload_json,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(run_id) DO UPDATE SET schema_version=excluded.schema_version,payload_json=excluded.payload_json,updated_at=excluded.updated_at WHERE schema_version IN (1,2) AND conversation_id=excluded.conversation_id`,
        [value.runId,schema,id,JSON.stringify(value),new Date().toISOString()]);
    },
    async usage(id:string):Promise<XiaozhiUsage[]> {
      return (await sql.all('SELECT * FROM xiaozhi_pi_usage WHERE conversation_id=? ORDER BY updated_at,rowid',[id])).map(publicUsage);
    },
    async recoverBudget() {
      for(const row of await sql.all('SELECT * FROM xiaozhi_pi_usage WHERE schema_version IN (1,2)')) {
        let value:XiaozhiUsage;try{value=publicUsage(row);}catch{continue;}
        if(!['running','waiting'].includes(value.state))continue;
        // Last committed checkpoint is a lower bound after a crash, never an invented final bill.
        value.state='interrupted';value.completeness=value.tokens?'partial':'unknown';
        await sql.run('UPDATE xiaozhi_pi_usage SET payload_json=? WHERE run_id=? AND schema_version=?',[JSON.stringify(value),String(row.run_id),Number(row.schema_version)]);
      }
    },
  };
}
