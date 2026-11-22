import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

assert(process.argv.includes('--real-deepseek'),'Explicitly authorize this eight-request synthetic DeepSeek benchmark');
const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const apiKey=process.env.DEEPSEEK_API_KEY;
assert(root && apiKey,'Acceptance output and DeepSeek credentials are required');
const model='deepseek-flash';
const run=randomUUID();
const common=Array.from({length:48},(_,i)=>
  `示例${i+1}。比较分数时先确认单位“1”一致，再把分母转化为相同的单位，比较分子后说明理由。说明材料为合成例题。`).join('\n');
const stat=(rows,key)=>rows.length?rows.reduce((sum,row)=>sum+row[key],0)/rows.length:null;
const observed=[];
const output=path.join(root,'deepseek-prefix-benchmark.json');
try {
  for(let i=0;i<4;i++){
    for(const variant of ['dynamicPrefix','stablePrefix']){
      const system=variant==='stablePrefix'?run+' 同一课堂说明\n'+common:run+` 本轮任务${i}，可变条件\n`+common;
      const start=performance.now();
      const response=await fetch('https://api.deepseek.com/v1/chat/completions',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
        headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model,max_tokens:40,temperature:0,thinking:{type:'disabled'},
          messages:[{role:'system',content:system},{role:'user',content:`第${i+1}题，只回复“收到”。`}]})
      });
      assert(response.ok,'DeepSeek status '+response.status);
      const result=await response.json();
      const usage=result.usage;
      assert([usage?.prompt_tokens,usage?.prompt_cache_hit_tokens,usage?.prompt_cache_miss_tokens].every(Number.isSafeInteger));
      observed.push({variant,iteration:i+1,latencyMs:performance.now()-start,input:usage.prompt_tokens,
        hit:usage.prompt_cache_hit_tokens,miss:usage.prompt_cache_miss_tokens});
    }
  }
}finally{
  const variants=Object.fromEntries(['dynamicPrefix','stablePrefix'].map(variant=>{
    const rows=observed.filter(row=>row.variant===variant);
    return [variant,{requests:rows.length,meanMs:stat(rows,'latencyMs'),meanInput:stat(rows,'input'),
      meanHit:stat(rows,'hit'),meanMiss:stat(rows,'miss')}];
  }));
  fs.writeFileSync(output,JSON.stringify({model,completed:observed.length===8,boundary:'Official DeepSeek HTTP, synthetic prompts. This compares prefix order only, not whole Electron performance.',observed,variants},null,2));
}
