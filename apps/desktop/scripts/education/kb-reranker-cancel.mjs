import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';const {RerankerClient}=await import('../../src/main/retrieval/reranker-client.ts');
let entered,release;const began=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let settled=false;
const client=new RerankerClient(async signal=>{entered();await gate;signal.throwIfAborted();throw Error('Must never launch');}),warming=client.warm();warming.then(()=>settled=true,()=>settled=true);
try{await began;client.close();await new Promise(r=>setImmediate(r));const promptly=settled;release();await assert.rejects(warming);assert(promptly,'Close must settle preparation without waiting for a stalled filesystem/verifier callback');console.log(JSON.stringify({success:true,checks:1,scope:'Real client lifecycle with a deliberately stalled verification callback; shutdown promise must settle before that callback is released'}));}
finally{release();client.close();}
