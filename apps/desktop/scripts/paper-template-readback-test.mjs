import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const output=await mkdtemp(path.resolve('test-results/template-readback-'));
const bundle=path.join(output,'readback.mjs');
await build({entryPoints:['src/renderer/components/paper-ui/paper-template-readback.ts'],bundle:true,platform:'node',format:'esm',outfile:bundle});
const {readPaperTemplateBounded,listPaperTemplatesBounded}=await import(pathToFileURL(bundle));
const input={sessionId:'session_test',basketId:'basket_test',templateId:'template_test',version:1,digest:'a'.repeat(64),requestId:'template_request_test'};
const calls=[],cancels=[];let resolveRead;
const api={readPaperTemplate:r=>{calls.push(r);return new Promise(resolve=>resolveRead=resolve);},
  listPaperTemplates:r=>{calls.push(r);return Promise.resolve({ok:true,value:{versions:[],unavailable:[]}});},
  cancelPaperTemplateOperation:async r=>{assert.deepEqual(Object.keys(r).sort(),['basketId','requestId','sessionId']);cancels.push(r);return {ok:true,value:true};}};
const checks=[];
const timeout=await readPaperTemplateBounded(api,input,undefined,10);
assert.deepEqual(timeout,{ok:false,error:'readback_timeout'});
assert.equal(cancels[0].requestId,input.requestId);assert.equal(cancels[0].basketId,input.basketId);
resolveRead({ok:true,value:{version:999}});await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(timeout,{ok:false,error:'readback_timeout'});
checks.push('Deadline cancels exact request; late read cannot overwrite timeout');
const controller=new AbortController();const reading=readPaperTemplateBounded(api,input,controller.signal,1000);
controller.abort();assert.deepEqual(await reading,{ok:false,error:'cancelled'});
assert.equal(cancels.at(-1).requestId,input.requestId);checks.push('User abort cancels the actual read identity');
const previous=calls.length;const already=new AbortController();already.abort();
assert.deepEqual(await readPaperTemplateBounded(api,input,already.signal),{ok:false,error:'cancelled'});
assert.equal(calls.length,previous);checks.push('Pre-aborted read performs no IPC');
const result=await listPaperTemplatesBounded(api,{sessionId:input.sessionId,basketId:input.basketId},undefined,10);
assert(result.ok);assert.match(calls.at(-1).requestId,/^template_read_/);
assert.equal(cancels.length,2);checks.push('Successful list uses its own request and clears deadline');
const report={success:true,scope:'Production read helper with controlled IPC promises; not Electron acceptance',checks};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,output}));
