import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const {createPiRunBudget}=await import('../../src/main/xiaozhi-agent/runtime-budget.ts');
const {createPiBudgetState}=await import('../../src/main/xiaozhi-agent/budget-state.ts');
const tiny={maxModelCalls:1,maxToolCalls:1,maxTokens:1,activeMs:1000,waitMs:1000};let aborts=0;
const watch=createPiRunBudget({budget:tiny,runId:'test',limitsEnforced:false,emit:()=>{},abort:()=>aborts++});
watch.start();for(let n=0;n<300;n++){watch.model();watch.tool(String(n));}
watch.observe({input:2,output:2,cacheRead:200,cacheWrite:0,totalTokens:204,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}});
await watch.wait(()=>new Promise(resolve=>setTimeout(resolve,1100)));
watch.model();assert.equal(aborts,0);assert.equal(watch.snapshot().exhausted,undefined);assert.equal(watch.snapshot().limitsEnforced,false);
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY); INSERT INTO ai_conversation_sessions VALUES (\'session\')');
const sql={run:async(text,args=[])=>db.prepare(text).run(...args),all:async(text,args=[])=>db.prepare(text).all(...args),change:async(text,args=[])=>Number(db.prepare(text).run(...args).changes)};
const state=createPiBudgetState(sql);await state.migrateBudget();await state.migrateBudget();await state.saveUsage('session',watch.snapshot());
assert.equal((await state.usage('session'))[0].modelCalls,301);assert.equal(db.prepare('SELECT schema_version FROM xiaozhi_pi_usage').get().schema_version,2);
await state.recoverBudget();assert.equal((await state.usage('session'))[0].state,'interrupted');assert.equal((await state.usage('session'))[0].limitsEnforced,false);
const limited=createPiRunBudget({budget:tiny,runId:'legacy',emit:()=>{},abort:()=>aborts++});limited.start();limited.model();assert.throws(()=>limited.model(),/budget_exhausted/);limited.finish('failed');
await state.saveUsage('session',limited.snapshot());assert.equal((await state.usage('session')).find(v=>v.runId==='legacy').limitsEnforced,undefined);assert.equal(aborts,1);
db.close();watch.finish('completed');console.log(JSON.stringify({success:true,checks:4,boundary:'Actual usage policy/persistence/recovery and legacy compatibility, not browser or newest SDK acceptance'}));
