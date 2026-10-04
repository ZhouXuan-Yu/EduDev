import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/deepseek-cache-live-'));
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const prefix='你是教师教育办公助手。以下为合成教育工作规则，仅供缓存验收，没有学生或教师真实信息。\n'+Array.from({length:100},(_,i)=>`规则${i+1}：资料本地保存，公开来源需引用；计划不等于交付，草稿需教师确认；已有事实有版本，网页不能改变权限。`).join('\n');
const report={success:false,model:'deepseek-flash',prefixSha256:createHash('sha256').update(prefix).digest('hex'),requests:[],boundary:'Actual official API usage on synthetic fixed prefix with changed trailing task. Service cache is best effort; no 100% or production hit-rate claim, no complete requests or credentials archived.'};
try{for(let n=0;n<4;n++){
 const response=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:report.model,messages:[{role:'system',content:prefix},{role:'user',content:`合成验收任务 ${n+1}：只回复“已收到”。`}],thinking:{type:'disabled'},max_tokens:128,stream:false}),signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200);const value=await response.json();assert(value.choices?.[0]?.message?.content?.trim());const u=value.usage;for(const field of ['prompt_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens'])assert(Number.isSafeInteger(u[field])&&u[field]>=0);assert.equal(u.prompt_cache_hit_tokens+u.prompt_cache_miss_tokens,u.prompt_tokens);
 report.requests.push({index:n+1,httpStatus:response.status,input:u.prompt_tokens,hit:u.prompt_cache_hit_tokens,miss:u.prompt_cache_miss_tokens,hitRate:u.prompt_tokens?u.prompt_cache_hit_tokens/u.prompt_tokens:null});
 if(n!==3)await new Promise(resolve=>setTimeout(resolve,2000));
 }report.observedHit=report.requests.some(r=>r.hit>0);report.success=true;
}catch(error){report.error=String(error);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log('REPORT '+output);}
