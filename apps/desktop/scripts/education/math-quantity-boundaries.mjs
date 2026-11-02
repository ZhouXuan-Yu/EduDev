import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {quantityCases,q,op,input,r} from './math-quantity-fixtures.mjs';
const {checkQuantity,checkMath}=await import('../../src/main/education/math-host.ts');
const {validMathQuantityInput,validMathQuantityResult}=await import('../../src/shared/math-quantity.ts');
const {createQuantityTools}=await import('../../src/main/education/quantity-tools.ts');
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const {toolManifest}=await import('../../src/main/xiaozhi-agent/tools/manifest.ts');
const toolsOnly=process.argv.includes('--tool-only');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-quantity-source-')),report={ok:false,selection:toolsOnly?'tool-only':'all',checks:[],cases:[],boundary:'Actual pinned source SymPy SI worker, no provider or natural-language modeling/complete S02 AT acceptance'};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
try{
 const good=quantityCases[0].input;
 if(!toolsOnly){for(const sample of quantityCases){const result=await checkQuantity(sample.input,new AbortController().signal);report.cases.push({id:sample.id,input:sample.input,result});assert(validMathQuantityResult(result));assert.equal(result.conditionsVerified,false);assert.equal(result.state,sample.state,sample.id);if(sample.exact)assert.equal(result.actual?.exact,sample.exact,sample.id);if(sample.reason)assert.equal(result.reason,sample.reason,sample.id);check(sample.id);}
 for(const bad of [{...good,verified:true},{...good,expected:r(1,0)},{...good,targetUnit:'m;process.exit()'},{...good,expression:{op:'eval',args:['x']}},{...good,expression:{op:'power',args:[q(2,'m')],exponent:5}},input(op('add',q(1,'m')),'m')]){assert(!validMathQuantityInput(bad));await assert.rejects(()=>checkQuantity(bad,new AbortController().signal),/invalid_input/);}assert(!validMathQuantityResult({state:'matched',actual:null,conditionsVerified:true}));check('Typed contract refuses malformed AST/units, missing operands and fabricated authority');
 await assert.rejects(()=>checkMath(good,new AbortController().signal),/invalid_input/);assert.equal((await checkMath({kind:'expression',left:{op:'number',...r(2)},right:{op:'number',...r(2)}},new AbortController().signal)).state,'matched');check('Original dimensionless v1 cannot validate quantities and remains compatible');
 }
 let current=true;const tool=createQuantityTools(()=>current)[0],call=(value,signal=new AbortController().signal)=>tool.execute('local-quantity-call',value,signal);
 const actual=JSON.parse((await call(quantityCases.find(c=>c.id==='wrong-area-scale-not-silently-matched').input)).content[0].text);assert(actual.success);assert.equal(actual.state,'mismatch');assert.equal(actual.actual.exact,'5000');assert.match(actual.message,/修正/);assert.equal(toolManifest(tool.name).effect,'safe_read');check('Actual local tool preserves failed number and deterministic SI correction without approval');
 const catalog=createEducationToolCatalog('',[tool,...Array.from({length:25},(_,i)=>({name:'unrelated_'+i,description:'other '+i,parameters:{type:'object'},execute:async()=>({content:[]})}))]);catalog.reset('物理压强速度单位换算 质量重力量纲');assert(catalog.exposed(tool.name));check('Hana discovers actual quantity tool from its domain description');
 const abort=new AbortController();abort.abort();await assert.rejects(()=>call(good,abort.signal));current=false;await assert.rejects(()=>call(good),/cancelled/);current=true;const stopped=new AbortController(),pending=checkQuantity(good,stopped.signal);stopped.abort();await assert.rejects(()=>pending);await new Promise(resolve=>setTimeout(resolve,200));assert.equal((await checkQuantity(good,new AbortController().signal)).state,'matched');check('Stop and superseded run cannot publish stale success; original worker recovers');
 report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));}
