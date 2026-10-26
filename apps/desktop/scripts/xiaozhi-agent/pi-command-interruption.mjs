import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {createPiPersistentState} from '../../src/main/xiaozhi-agent/persistent-state.ts';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-command-interruption-')),db=new DatabaseSync(path.join(output,'app.db')),report={success:false,checks:[],scope:'Current command state adapter against actual SQLite, no provider or UI claim.'};
db.exec('CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,schema_version INTEGER DEFAULT 1,conversation_id TEXT,request_hash TEXT,run_id TEXT DEFAULT "",status TEXT,created_at TEXT,updated_at TEXT)');
const state=createPiPersistentState({run:async(sql,args=[])=>{db.prepare(sql).run(...args);},all:async(sql,args=[])=>db.prepare(sql).all(...args),change:async(sql,args=[])=>Number(db.prepare(sql).run(...args).changes)});
const check=name=>report.checks.push({name,pass:true});
try{
 await state.claimCommand('owned','teacher','hash');await state.interruptCommand('owned','other','hash');await state.interruptCommand('owned','teacher','wrong');assert.equal((await state.command('owned')).status,'starting');check('Conversation and request hash mismatch cannot interrupt another admission');
 await state.interruptCommand('owned','teacher','hash');assert.equal((await state.command('owned')).status,'interrupted');await assert.rejects(state.bindCommand('owned','late-run'),/configuration/);assert.equal((await state.command('owned')).run_id,'');check('Interrupted claim cannot regain run binding after a late continuation');
 await state.claimCommand('finished','teacher','hash');await state.bindCommand('finished','run');await state.finishCommand('finished');await state.interruptCommand('finished','teacher','hash');const row=await state.command('finished');assert.equal(row.status,'finished');assert.equal(row.run_id,'run');check('A committed terminal command retains its original facts');report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
