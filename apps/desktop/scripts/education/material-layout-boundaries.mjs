import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {MATERIAL_LAYOUT_SCHEMA as schema,PDF_LAYOUT_SCHEMA,PDF_LAYOUT_ENGINE,validLayoutQuery,validLayoutCancel,validPdfLayout} from '../../src/shared/material-layout.ts';
import {MaterialLayoutCache,readMaterialLayout} from '../../src/main/assets/material-layout.ts';
import {readMaterialOriginal} from '../../src/main/assets/material-original.ts';
export async function materialLayoutBoundaries(check,output){
 const root=fs.mkdtempSync(path.join(output,'layout-')),source=path.join(root,'source.pdf'),bytes=Buffer.from('%PDF-owned bounded fixture'),sha=b=>createHash('sha256').update(b).digest('hex'),version=sha(bytes),signal=()=>new AbortController().signal;
 fs.writeFileSync(source,bytes);
 const query={schemaVersion:schema,requestId:randomUUID(),resourceId:'resource_'+randomUUID(),version,page:1,refresh:false};
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZkAAAAASUVORK5CYII=',quad=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
 const receipt={schemaVersion:PDF_LAYOUT_SCHEMA,ok:true,engine:PDF_LAYOUT_ENGINE,inputSha256:version,page:1,total:1,width:1,height:1,png,rasterSha256:sha(Buffer.from(png,'base64')),lines:[{id:'line-1',kind:'text',needsReview:true,text:'未校对文字<script>',score:.99,quad,normalizedQuad:quad}]};
 const cache=()=>new MaterialLayoutCache(()=>root),repository={resource:async()=>({originalFileName:'source.pdf'}),original:async(_id,v,s)=>readMaterialOriginal(root,source,v,s,1024)};
 await check('Layout query/cancel schema denies paths, provider fields, malformed IDs, accessors and unknown versions',async()=>{
  assert(validLayoutQuery(query));assert(validLayoutCancel({schemaVersion:schema,requestId:query.requestId}));
  for(const q of [{...query,path:source},{...query,provider:'cloud'},{...query,page:51},{...query,version:'old'},{...query,refresh:'yes'},{...query,schemaVersion:'v2'}])assert(!validLayoutQuery(q));
  let reads=0;const q={...query};Object.defineProperty(q,'page',{enumerable:true,get(){reads++;return 1;}});assert(!validLayoutQuery(q));assert.equal(reads,0);
 });
 await check('Real geometry contract checks convex quads, normalization, dimensions, text caps and unreviewed-only kind',async()=>{
  assert(validPdfLayout(receipt));assert(validPdfLayout({...receipt,lines:[]}));
  for(const bad of [{...receipt,lines:[{...receipt.lines[0],needsReview:false}]},{...receipt,lines:[{...receipt.lines[0],kind:'formula'}]},{...receipt,lines:[{...receipt.lines[0],score:NaN}]},{...receipt,lines:[{...receipt.lines[0],quad:[[.1,.1],[.9,.9],[.9,.1],[.1,.9]]}]},{...receipt,lines:[{...receipt.lines[0],normalizedQuad:[[.1,.1],[.8,.1],[.9,.9],[.1,.9]]}]},{...receipt,lines:new Array(1)},{...receipt,width:2402},{...receipt,lines:[{...receipt.lines[0],text:'a'.repeat(128001)}]}])assert(!validPdfLayout(bad));
 });
 let calls=0;const recognize=async()=>{calls++;return structuredClone(receipt);};
 await check('Source-backed derivative survives cache reconstruction with zero repeat OCR calls and honest empty result',async()=>{
  const first=await readMaterialLayout(repository,cache(),query,signal(),recognize);assert(!first.cached);assert.equal(first.layout.lines[0].needsReview,true);
  const cold=await readMaterialLayout(repository,cache(),{...query,requestId:randomUUID()},signal(),recognize);assert(cold.cached);assert.deepEqual(cold.layout,first.layout);assert.equal(calls,1);
  const empty=await readMaterialLayout(repository,cache(),{...query,refresh:true},signal(),async()=>({...receipt,lines:[]}));assert.equal(empty.layout.lines.length,0);
 });
 const directory=path.join(root,'cache/material-layout/v1'),file=()=>path.join(directory,fs.readdirSync(directory).find(x=>x.endsWith('.json')));
 await check('Corrupt cache fails closed, explicit refresh rebuilds; hardlinked derivative cannot be consumed',async()=>{
  fs.writeFileSync(file(),'truncated');await assert.rejects(()=>readMaterialLayout(repository,cache(),query,signal(),recognize),/cache_invalid/);
  await readMaterialLayout(repository,cache(),{...query,refresh:true},signal(),recognize);
  const hard=path.join(root,'foreign-hardlink');fs.linkSync(file(),hard);try{await assert.rejects(()=>readMaterialLayout(repository,cache(),query,signal(),recognize),/cache_invalid/);}finally{fs.unlinkSync(hard);}
  const badRaster={...receipt,rasterSha256:'0'.repeat(64)};await cache().put(query,badRaster,signal());await assert.rejects(()=>readMaterialLayout(repository,cache(),query,signal(),recognize),/cache_invalid/);await readMaterialLayout(repository,cache(),{...query,refresh:true},signal(),recognize);
 });
 await check('Owned disk-write failure leaves the previous cache intact and removes its pending file',async()=>{
  const before=fs.readFileSync(file()),open=fs.promises.open;fs.promises.open=async(...args)=>{const handle=await open(...args);if(String(args[0]).startsWith(directory+path.sep+'.pending-'))handle.writeFile=async()=>{throw new Error('ENOSPC owned fault');};return handle;};
  try{await assert.rejects(()=>cache().put(query,receipt,signal()),/ENOSPC/);}finally{fs.promises.open=open;}
  assert.deepEqual(fs.readFileSync(file()),before);assert(!fs.readdirSync(directory).some(f=>f.startsWith('.pending-')));
 });
 await check('Cached/fresh source CAS and cancellation reject stale/late outputs without original or question writes',async()=>{
  fs.appendFileSync(source,' changed');await assert.rejects(()=>readMaterialLayout(repository,cache(),query,signal(),recognize),/source_changed/);fs.writeFileSync(source,bytes);
  await assert.rejects(()=>readMaterialLayout(repository,cache(),{...query,refresh:true},signal(),async()=>{fs.appendFileSync(source,' changed');return receipt;}),/source_changed/);fs.writeFileSync(source,bytes);
  const ctl=new AbortController();await assert.rejects(()=>readMaterialLayout(repository,cache(),{...query,refresh:true},ctl.signal,async()=>{ctl.abort();return receipt;}));
  assert.equal(sha(fs.readFileSync(source)),version);
 });
 await check('Worker source/page/raster/engine mismatch never becomes a cached candidate, even at high confidence',async()=>{
  for(const bad of [{...receipt,inputSha256:'0'.repeat(64)},{...receipt,page:2,total:2},{...receipt,rasterSha256:'0'.repeat(64)},{...receipt,width:2},{...receipt,engine:'another'}])await assert.rejects(()=>readMaterialLayout(repository,cache(),{...query,refresh:true},signal(),async()=>bad),/parse_failed/);
 });
}
