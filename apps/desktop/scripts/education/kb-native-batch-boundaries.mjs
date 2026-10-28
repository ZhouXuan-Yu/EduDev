import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
let api;try{api=await import('../../src/shared/material-ai-native-response.ts');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
assert.equal(typeof api?.parseNativeAiResponse,'function','The production Word AI pipeline needs a bounded single-question projection response, independent of teacher confirmation');
const projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?'计算1+1。':''}]));
const q={number:'1',stem:'计算1+1。',answer:'2',analysis:'两个1相加等于2。',subject:'数学',grade:'一年级',knowledgePoint:'加法',questionType:'计算题',difficulty:'easy',answerOrigin:'source',analysisOrigin:'ai_generated',requiresImage:false,issues:[],projection};
const raw=value=>JSON.stringify({schemaVersion:'xiaozhi.material-ai-native-response.v1',outcome:'questions',questions:[value]});assert.deepEqual(api.parseNativeAiResponse(raw(q)).questions[0],q);
for(const bad of [{...q,path:'C:/private'},{...q,projection:{...projection,statement:{state:'provided',text:'另一题'}}},{...q,answerOrigin:'teacher'},{...q,projection:{...projection,figures:{state:'provided',text:''}}}])assert.throws(()=>api.parseNativeAiResponse(raw(bad)),/invalid_response/);
assert.throws(()=>api.parseNativeAiResponse(JSON.stringify({schemaVersion:'xiaozhi.material-ai-native-response.v1',outcome:'questions',questions:[q,q]})),/invalid_response/);console.log(JSON.stringify({passed:6,scope:'Strict native response, scalar/projection mirrors and one selected Word question per unit; not provider correctness'}));
