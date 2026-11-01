import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {PAGE_BLOCKS_SCHEMA,PAGE_BLOCKS_ENGINE,validPageBlocks,pageBlocksMatch} from '../../src/shared/material-page-blocks.ts';
import {MATERIAL_LAYOUT_SCHEMA,validLayoutQuery} from '../../src/shared/material-layout.ts';
import {withMaterialPageBlocks} from '../../src/main/assets/material-page-blocks.ts';
import {readMaterialOriginal} from '../../src/main/assets/material-original.ts';
const output=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-page-block-boundaries-')),source=path.join(output,'source.pdf'),original=Buffer.from('%PDF-owned block test'),hash=b=>createHash('sha256').update(b).digest('hex'),version=hash(original),raster=Buffer.from('owned raster'),resourceId='resource_'+randomUUID();await fs.writeFile(source,original);
const receipt={schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:hash(raster),width:100,height:100,blocks:[{id:'block-1',kind:'image',score:.9,box:[.1,.2,.8,.9],needsReview:true}]};
const result={schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:true,resourceId,version,requestId:randomUUID(),cached:true,layout:{png:raster.toString('base64'),rasterSha256:hash(raster),width:100,height:100,page:1}};
const repository={originalStamp:async()=>{const s=await fs.stat(source);return `${s.size}:${s.mtimeMs}`;},verify:async(_id,v,signal)=>readMaterialOriginal(output,source,v,signal,1024)};
let calls=0,checks=0;const signal=()=>new AbortController().signal,recognize=async bytes=>{calls++;assert.equal(hash(bytes),hash(raster));return structuredClone(receipt);};
const read=(refresh=false,s=signal(),r=result,engine=recognize)=>withMaterialPageBlocks(repository,output,r,refresh,s,engine);
async function check(name,f){await f();checks++;console.log('PASS '+name);}
await check('Strict version/engine, finite normalized geometry, dense arrays, unreviewed provenance and bounded elements',()=>{
 assert(validPageBlocks(receipt));assert(validPageBlocks({...receipt,blocks:[]}));assert(pageBlocksMatch(receipt,result.layout));
 for(const v of [{...receipt,engine:'guessed'},{...receipt,extra:true},{...receipt,width:2402},{...receipt,blocks:new Array(1)},{...receipt,blocks:Array(257).fill(receipt.blocks[0])},...[{kind:'question'},{needsReview:false},{score:NaN},{score:.2},{box:[0,0,Infinity,1]},{box:[.8,.2,.1,.9]},{box:[0,0,.001,1]},{id:'block-2'}].map(b=>({...receipt,blocks:[{...receipt.blocks[0],...b}]}))])assert(!validPageBlocks(v));
 assert(!pageBlocksMatch(receipt,{...result.layout,rasterSha256:'a'.repeat(64)}));assert(!pageBlocksMatch(receipt,{...result.layout,height:99}));
});
await check('Accessors and custom coercion never execute during receipt validation',()=>{
 let reads=0;const v={...receipt};Object.defineProperty(v,'blocks',{enumerable:true,get(){reads++;return[];}});assert(!validPageBlocks(v));
 const b={...receipt.blocks[0]};Object.defineProperty(b,'box',{enumerable:true,get(){reads++;return[];}});assert(!validPageBlocks({...receipt,blocks:[b]}));
 assert(!validPageBlocks({schemaVersion:PAGE_BLOCKS_SCHEMA,ok:false,error:{toString(){reads++;return 'configuration';}}}));assert.equal(reads,0);
});
await check('Additive includeBlocks query is explicit; old query remains valid and arbitrary fields/false are denied',()=>{
 const q={schemaVersion:MATERIAL_LAYOUT_SCHEMA,resourceId,version,page:1,refresh:false,requestId:randomUUID()};assert(validLayoutQuery(q));assert(validLayoutQuery({...q,includeBlocks:true}));for(const v of [{...q,includeBlocks:false},{...q,includeBlocks:'true'},{...q,includeBlocks:true,path:source}])assert(!validLayoutQuery(v));
});
await check('Cold service authenticates original and caches only geometry; second process-style read avoids inference',async()=>{
 const a=await read(),b=await read();assert(!a.pageBlocks.cached);assert(b.pageBlocks.cached);assert.deepEqual(a.pageBlocks.receipt,b.pageBlocks.receipt);assert.equal(calls,1);assert.equal(hash(await fs.readFile(source)),version);
});
await check('Cache hit still refuses a physically changed original',async()=>{
 await fs.appendFile(source,'changed');await assert.rejects(read(),/source_changed/);await fs.writeFile(source,original);assert.equal(calls,1);
});
await check('Changed raster cannot borrow prior block geometry',async()=>{
 await assert.rejects(read(false,signal(),{...result,layout:{...result.layout,rasterSha256:'b'.repeat(64)}}),/source_changed/);assert.equal(calls,1);
});
await check('Unknown/tampered cached receipt fails visibly, explicit refresh rebuilds',async()=>{
 const dir=path.join(output,'cache/material-page-blocks/v1'),file=path.join(dir,(await fs.readdir(dir))[0]);await fs.writeFile(file,'broken');await assert.rejects(read(),/cache_invalid/);assert.equal(calls,1);assert(!(await read(true)).pageBlocks.cached);assert.equal(calls,2);
});
await check('Cancelled late inference cannot publish or replace a cache fact',async()=>{
 const dir=path.join(output,'cache/material-page-blocks/v1'),file=path.join(dir,(await fs.readdir(dir))[0]),before=await fs.readFile(file),controller=new AbortController();await assert.rejects(read(true,controller.signal,result,async()=>{controller.abort();return receipt;}));assert.deepEqual(await fs.readFile(file),before);assert(!(await fs.readdir(dir)).some(f=>f.startsWith('.pending-')));
});
await check('Source mutation during actual inference fails before cache publication',async()=>{
 await assert.rejects(read(true,signal(),result,async()=>{await fs.appendFile(source,'changed');return receipt;}),/source_changed/);await fs.writeFile(source,original);
});
await check('Wrong model result SHA/dimensions and missing component cannot become valid cached geometry',async()=>{
 for(const v of [{...receipt,width:99},{...receipt,rasterSha256:'f'.repeat(64)},{...receipt,blocks:[{...receipt.blocks[0],needsReview:false}]}])await assert.rejects(read(true,signal(),result,async()=>v),/parse_failed/);
 await assert.rejects(read(true,signal(),result,async()=>{throw Error('configuration');}),/configuration/);assert((await read()).pageBlocks.cached);
});
await check('Oversized cache is bounded before allocating/decoding and can be explicitly repaired',async()=>{
 const dir=path.join(output,'cache/material-page-blocks/v1'),file=path.join(dir,(await fs.readdir(dir))[0]);await fs.writeFile(file,Buffer.alloc(128*1024+1));await assert.rejects(read(),/cache_invalid/);await read(true);
});
await check('Hardlinked cache alias is refused without affecting original/source facts',async()=>{
 const dir=path.join(output,'cache/material-page-blocks/v1'),file=path.join(dir,(await fs.readdir(dir))[0]),alias=path.join(output,'alias.json');await fs.link(file,alias);await assert.rejects(read(),/cache_invalid/);await fs.unlink(alias);assert((await read()).pageBlocks.cached);assert.equal(hash(await fs.readFile(source)),version);
});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({checks,cloudCalls:0,scope:'Controlled geometry/cache/source boundaries only; no natural question/archive acceptance'}));console.log(JSON.stringify({checks,output}));
