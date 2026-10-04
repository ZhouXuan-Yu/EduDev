import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const {createPiBudgetState}=await import('../../src/main/xiaozhi-agent/budget-state.ts');
const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=fs.realpathSync(path.resolve(appRoot,process.argv[2])),testRoot=fs.realpathSync(path.join(appRoot,'test-results/xiaozhi-agent'));
const relative=path.relative(testRoot,root);
assert(!relative.startsWith('..')&&!path.isAbsolute(relative),'Only explicitly named isolated test results may be read');
const acceptance=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
assert(acceptance.success&&acceptance.suite==='pi-budget-formal-ui');
const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
try{
  const state=createPiBudgetState({all:async(sql,args=[])=>db.prepare(sql).all(...args),run:async()=>{throw new Error('Read-only verifier');}});
  const rows=db.prepare('SELECT * FROM xiaozhi_pi_usage').all();assert(rows.length>0);
  for(const row of rows){const projected=(await state.usage(row.conversation_id)).find(item=>item.runId===row.run_id);assert.deepEqual(projected,JSON.parse(row.payload_json));}
  const result={suite:'pi-budget-final-public-projection',success:true,persistedRuns:rows.length,source:'Real budget acceptance data; read-only latest source projection'};
  fs.writeFileSync(path.join(root,'projection-readback.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{db.close();}
