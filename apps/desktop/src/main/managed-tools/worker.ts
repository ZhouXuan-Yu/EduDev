import fs from 'node:fs/promises';
import {QuickJS} from 'quickjs-wasi';
import {createHash} from 'node:crypto';
import {JAVASCRIPT_COMPONENT as recipe} from './manifest';

/** No guest callbacks expose host IO. The parent owns cancellation and process
 * lifetime; the VM also has its own memory, stack and instruction deadline. */
process.once('message',async(raw:unknown)=>{
  let vm:Awaited<ReturnType<typeof QuickJS.create>>|undefined;
  try{
    const value=raw as {schemaVersion?:unknown;wasm?:unknown;code?:unknown;input?:unknown;health?:unknown};
    if(value?.schemaVersion!==1||typeof value.wasm!=='string'||typeof value.code!=='string'||value.code.length>32768)throw Error('invalid_input');
    const bytes=await fs.readFile(value.wasm);if(bytes.length!==recipe.bytes||createHash('sha256').update(bytes).digest('hex')!==recipe.sha256)throw Error('checksum_mismatch');
    const start=Date.now();vm=await QuickJS.create({wasm:bytes,memoryLimit:32*1024*1024,interruptHandler:()=>Date.now()-start>2000});
    const input=vm.hostToHandle(value.input??null);vm.setProp(vm.global,'input',input);input.dispose();
    const result=vm.evalCode(`JSON.stringify((()=>{ "use strict"; ${value.code}\n})(), (_key,value)=>{if(typeof value==="number"&&!Number.isFinite(value))throw new Error("invalid_domain");return value;})`);
    const text=result.toString();result.dispose();
    if(Buffer.byteLength(text)>131072)throw Error('output_limit');
    const data=text==='undefined'?null:JSON.parse(text);
    process.send?.({schemaVersion:1,ok:true,value:{value:data,runtime:recipe.version,elapsedMs:Date.now()-start}});
  }catch(error){
    // Guest exception text may include private input. Only bounded categories
    // cross back to host; never serialize its stack or arbitrary exception.
    const message=error instanceof Error?error.message:'';
    const code=/interrupted/i.test(message)?'timeout':['invalid_input','checksum_mismatch','output_limit','invalid_domain'].includes(message)?message:'worker_failed';
    process.send?.({schemaVersion:1,ok:false,error:code});
    try{if(error&&typeof error==='object'&&'dispose'in error&&typeof error.dispose==='function')error.dispose();}catch{}
  }finally{try{vm?.dispose();}catch{}process.disconnect?.();}
});
