import '../office-agent/register-source.mjs';
import path from 'node:path';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import assert from 'node:assert/strict';
const children=[],spawn=cp.spawn;cp.spawn=function(...args){const child=spawn.apply(this,args);children.push(child);return child;};syncBuiltinESMExports();
const {RerankerClient}=await import('../../src/main/retrieval/reranker-client.ts'),{verifyRerankerRuntime}=await import('../../src/main/retrieval/reranker-runtime.ts');
let verified=0;const client=new RerankerClient(signal=>{verified++;return verifyRerankerRuntime(path.resolve('.local-reranker/dist/omni-edu-reranker'),signal);}),report={scope:'Actual verified Windows cross encoder process; intentionally tiny caller deadline cancels owned inference, then a new uncached query recovers; synthetic only',checks:[]};
try{
 await client.warm();assert.equal(children.length,1);const first=children[0],exited=new Promise(resolve=>first.once('exit',resolve)),began=performance.now();
 await assert.rejects(client.rerank('比较长题的条件',Array.from({length:20},(_,i)=>({id:'long_'+i,text:'已知直角三角形两条直角边分别为六厘米和八厘米，要求第三边的长度。'.repeat(26),complete:true})),10),/reranker_timeout/);
 report.rejectionMs=performance.now()-began;
 let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('owned child did not exit')),2000);})]);}finally{clearTimeout(timer);}assert(report.rejectionMs<1000);report.checks.push('Caller deadline interrupts actual in-flight native inference and the owned process exits');
 const result=await client.rerank('阳光为何通过三棱镜出现多种颜色',[{id:'optics',text:'太阳光通过三棱镜分解为多种色光。',complete:true},{id:'math',text:'已知直角三角形两直角边长求斜边。',complete:true}]);assert.equal(verified,2);assert.equal(children.length,2);assert(result.scores[0].score>result.scores[1].score);report.checks.push('Next uncached query reverifies and starts a new actual native model with valid Chinese scores');report.success=true;
}finally{client.close();cp.spawn=spawn;syncBuiltinESMExports();console.log(JSON.stringify(report));}
