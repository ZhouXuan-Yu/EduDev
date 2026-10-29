import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {parseDeepSeekCapabilities,readDeepSeekCatalogue} from '../../src/main/xiaozhi-agent/model-capabilities.ts';
import {resolveAnswerPolicy,resolveThinkingPolicy,applyThinkingPayload} from '../../src/main/xiaozhi-agent/answer-quality.ts';
import {createModelSettingsState} from '../../src/main/xiaozhi-agent/model-settings-state.ts';
const output=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-thinking-'));
const report={ok:false,checks:[],boundary:'Source policy, official-format metadata/cache and real SQLite. Synthetic only; no model-quality or paid-provider acceptance.'};
const check=(name)=>{report.checks.push(name);console.log('PASS '+name);};
const now=new Date().toISOString();
const raw={object:'list',data:[{id:'deepseek-flash',name:'DeepSeek Flash',context_window:65536,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]};
const db=new DatabaseSync(path.join(output,'settings.db'));
try{
 const catalogue=parseDeepSeekCapabilities(raw,now),capacity=catalogue.models[0];
 await fs.writeFile(path.join(output,'deepseek-capabilities.v1.json'),JSON.stringify(catalogue));
 assert.deepEqual((await readDeepSeekCatalogue(output)).models[0].effort,capacity.effort);
 assert.throws(()=>parseDeepSeekCapabilities({...raw,data:[{...raw.data[0],effort:{supported_levels:['ultra']}}]},now));
 check('Official effort levels round-trip through existing cache; fabricated Ultra rejected');
 for(const [choice,type,effort,tokens] of [['off','disabled','none',4096],['low','enabled','low',8192],['high','enabled','high',16384],['max','enabled','max',32768]]){
  const policy=resolveThinkingPolicy('你好',capacity,choice,'session');
  const wire=applyThinkingPayload({reasoning_effort:'medium',thinking:{type:'enabled'},max_tokens:999999},policy);
  assert.deepEqual([wire.thinking.type,wire.reasoning_effort,wire.max_tokens],[type,effort,tokens]);
 }
 check('All four manual choices override greeting heuristics and final wire fields without model changes');
 assert.equal(resolveThinkingPolicy('你好',capacity).effective,'off');
 assert.equal(resolveThinkingPolicy('继续',capacity,'auto','global','逐步推导并证明浮力公式').effective,'high');
 assert.equal(resolveThinkingPolicy('可以',capacity,'auto','global','完整对比三份教案').mode,'deep');
 check('Auto keeps unfinished deep task for short continuation and greeting remains light');
 const unknown={...capacity,effort:undefined},stale={...capacity,stale:true},unsupported={...capacity,effort:{supportedLevels:['low'],defaultLevel:'low'}};
 for(const metadata of [unknown,stale]){const value=resolveThinkingPolicy('详细证明',metadata,'max','session');assert.equal(value.reason,'capability_unknown');assert.equal(value.effort,undefined);assert(!('reasoning_effort' in applyThinkingPayload({reasoning_effort:'max'},value)));}
 assert.equal(resolveThinkingPolicy('你好',unsupported,'max','session').reason,'unsupported_choice');
 assert.equal(resolveThinkingPolicy('证明',unsupported,'max','session').effort,'low');
 assert.equal(resolveThinkingPolicy('证明',{...capacity,effort:{supportedLevels:[]}},'max','session').effort,'none');
 check('Missing/stale capabilities do not invent levels; unsupported saved choice falls back visibly');
 assert.equal(resolveThinkingPolicy('证明',{...capacity,contextWindow:8192,maxOutputTokens:4096},'max').maxOutputTokens,4096);
 assert.equal(resolveThinkingPolicy('证明',stale,'max').maxOutputTokens,4096);
 check('Highest effort stays within trusted output and context limits');
 db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
 const sql={all:async(s,v=[])=>db.prepare(s).all(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)};
 const state=createModelSettingsState(sql);
 await state.saveThinking(undefined,0,'high');await state.saveThinking('session-a',0,'max');
 await assert.rejects(()=>state.saveThinking('session-a',0,'off'),/conflict/);
 assert.deepEqual(await state.thinking('session-b'),{version:0,choice:null});
 const reopened=createModelSettingsState(sql);
 assert.equal((await reopened.thinking()).choice,'high');assert.equal((await reopened.thinking('session-a')).choice,'max');
 await reopened.saveThinking('session-a',1,null);assert.equal((await reopened.thinking('session-a')).choice,null);
 check('SQLite CAS, session isolation, global default, inherit reset and service reopen');
 const last={...resolveThinkingPolicy('证明',capacity,'max','session'),runId:'run-fixture',model:capacity.id};
 await reopened.saveThinkingRun('session-a',last);assert.deepEqual(await state.thinkingRun('session-a'),last);
 assert.equal(await state.thinkingRun('session-b'),undefined);
 check('Frozen last-run configuration persists without keys or cross-session leakage');
 const benchmark=fn=>{for(let i=0;i<1000;i++)fn();const start=performance.now();for(let i=0;i<10000;i++)fn();return Number((performance.now()-start).toFixed(3));};
 report.policyBenchmark={iterations:10000,legacyMs:benchmark(()=>resolveAnswerPolicy('继续',capacity)),enhancedMs:benchmark(()=>resolveThinkingPolicy('继续',capacity,'auto','global','完整推导并生成课件')),scope:'Local routing only, not model latency, rendering speed or quality.'};
 report.ok=true;
}finally{db.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
