import {build} from 'esbuild';
import {createHash} from 'node:crypto';
export async function buildBuoyancyDemo(){
 const result=await build({entryPoints:['src/renderer/src/buoyancy-demo.ts'],bundle:true,platform:'browser',target:'es2022',format:'iife',minify:true,write:false,logLevel:'warning'});
 const script=result.outputFiles[0].text;
 if(Buffer.byteLength(script)>32768)throw Error('Buoyancy demonstration script exceeds limit');
 return{schemaVersion:1,script,sha256:createHash('sha256').update(script).digest('hex')};
}
