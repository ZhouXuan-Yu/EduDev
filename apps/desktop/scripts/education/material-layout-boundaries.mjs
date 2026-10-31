import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {MATERIAL_LAYOUT_SCHEMA as schema,PDF_LAYOUT_SCHEMA,PDF_LAYOUT_ENGINE,validLayoutQuery,validLayoutCancel,validPdfLayout} from '../../src/shared/material-layout.ts';
import {MaterialLayoutCache,readMaterialLayout} from '../../src/main/assets/material-layout.ts';
import {readMaterialOriginal} from '../../src/main/assets/material-original.ts';
export async function materialPageToolBoundaries(check,output){
 const {createMaterialPageTools}=await import('../../src/main/assets/material-page-tools.ts');
 const {validMaterialPageTextInput}=await import('../../src/shared/material-page-text.ts');
 const root=fs.mkdtempSync(path.join(output,'page-tool-')),source=path.join(root,'source.pdf'),bytes=Buffer.from('%PDF-owned page tool'),sha=b=>createHash('sha256').update(b).digest('hex'),version=sha(bytes),id='resource_'+randomUUID(),observed=new Map([[id,version]]);
 fs.writeFileSync(source,bytes);let current=true,privatePage=false,fingerprint='v1',calls=0;
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZkAAAAASUVORK5CYII=',quad=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
 const original='合成学生甲 '+('复合公式条件；'.repeat(2000)),receipt={schemaVersion:PDF_LAYOUT_SCHEMA,ok:true,engine:PDF_LAYOUT_ENGINE,inputSha256:version,page:1,total:1,width:1,height:1,png,rasterSha256:sha(Buffer.from(png,'base64')),lines:[{id:'line-1',kind:'text',needsReview:true,text:original,score:.99,quad,normalizedQuad:quad}]};
 const store={getDataRoot:()=>root,listStudents:async()=>[{realName:'合成学生甲'}],sanitizeProblemText:async text=>({sanitizedText:text}),materials:{resource:async()=>({originalFileName:'source.pdf',contentHash:version}),original:async(_id,v,s)=>readMaterialOriginal(root,source,v,s,1024),readingSnapshot:async()=>{throw Error('Whole-book snapshot forbidden');},pageReadAccess:async()=>({version:fingerprint==='v1'?version:'b'.repeat(64),eligible:true,privatePage})}};
 const tool=(recognize=async()=>{calls++;return receipt;})=>createMaterialPageTools(store,()=>current,observed,recognize)[0];
 const run=async(t,args,signal=new AbortController().signal)=>JSON.parse((await t.execute('owned',args,signal)).content[0].text);
 const input={resourceId:id,page:1};
 await check('Page tool strict parameters and observed/private-page authority deny reads before OCR',async()=>{
  let reads=0;const accessor={...input};Object.defineProperty(accessor,'page',{get(){reads++;return 1;},enumerable:true});assert(!validMaterialPageTextInput(accessor));assert.equal(reads,0);
  for(const value of [{...input,path:source},{...input,version},{...input,page:10001},{...input,offset:-1}])assert(!validMaterialPageTextInput(value));
  observed.clear();assert.equal((await run(tool(),input)).code,'permission_denied');observed.set(id,version);privatePage=true;assert.equal((await run(tool(),input)).code,'permission_denied');privatePage=false;assert.equal(calls,0);
 });
 await check('Region reread uses local crop/image OCR, labels selected region rather than line geometry and preserves authority/CAS/cancel',async()=>{
  const {PDF_PAGE_SCHEMA,PDF_PAGE_ENGINE}=await import('../../src/shared/material-page-preview.ts');
  const {LOCAL_OCR_SCHEMA,LOCAL_OCR_ENGINE}=await import('../../src/shared/xiaozhi-ocr.ts');
  const box=[0,.5,1,1],args={...input,box};let renders=0,images=0,mutate=false,cancel;
  const host={render:async(_bytes,q)=>{renders++;return {schemaVersion:PDF_PAGE_SCHEMA,ok:true,engine:PDF_PAGE_ENGINE,inputSha256:version,page:1,total:1,box:q.box,pageWidth:1,pageHeight:2,width:1,height:1,png,sha256:sha(Buffer.from(png,'base64'))};},recognize:async data=>{images++;assert.equal(sha(data),sha(Buffer.from(png,'base64')));if(mutate)fingerprint='changed';cancel?.abort();return {schemaVersion:LOCAL_OCR_SCHEMA,ok:true,engine:LOCAL_OCR_ENGINE,text:'合成学生甲\nA小灯 B滑动变阻器 C电源',lines:2,width:1,height:1,scores:[.9,.9]};}};
  const t=createMaterialPageTools(store,()=>current,observed,async()=>{throw Error('Whole-page OCR must not run');},host)[0];
  for(const box of [[0,0,0,1],[0,0,1,2],[0,0,1],new Array(4)])assert(!validMaterialPageTextInput({...input,box}));
  privatePage=true;assert.equal((await run(t,args)).code,'permission_denied');privatePage=false;assert.equal(renders,0);
  const a=await run(t,args);assert(a.success);assert.equal(a.positionBasis,'selected_region');assert.deepEqual(a.regionBox,box);assert(a.lines.every(l=>JSON.stringify(l.box)===JSON.stringify(box)));assert(!JSON.stringify(a).includes('合成学生甲'));assert(a.lines.some(l=>l.text.includes('电源')));assert.equal(images,1);assert.equal(calls,0);
  mutate=true;assert.equal((await run(t,args)).code,'source_changed');mutate=false;fingerprint='v1';
  cancel=new AbortController();assert.equal((await run(t,args,cancel.signal)).code,'cancelled');cancel=undefined;
 });
 await check('Long OCR line paginates without skipped text; only sanitized text/geometry, no PNG/path/confidence',async()=>{
  const t=tool(),a=await run(t,input),b=await run(t,{...input,...a.next});assert(a.success&&b.success);assert.equal(a.lines[0].text+b.lines[0].text,original.replace('合成学生甲','[学生姓名]'));assert.equal(b.next,null);assert.equal(calls,1);assert.equal(a.teacherConfirmed,false);
  assert.deepEqual(a.lines[0].box,[.1,.1,.9,.9]);for(const key of ['png','path','score','source'])assert(!Object.hasOwn(a,key));assert(!JSON.stringify(a).includes('合成学生甲'));assert.equal(a.lines[0].needsReview,true);
 });
 await check('Page tools deny source/snapshot changes and late cancelled results; refresh reuses same local host',async()=>{
  fs.appendFileSync(source,'changed');assert.equal((await run(tool(),input)).code,'source_changed');fs.writeFileSync(source,bytes);
  assert.equal((await run(tool(async()=>{fingerprint='v2';return receipt;}),{...input,refresh:true})).code,'source_changed');fingerprint='v1';
  const ctl=new AbortController();assert.equal((await run(tool(async()=>{ctl.abort();return receipt;}),{...input,refresh:true},ctl.signal)).code,'cancelled');
  current=false;assert.equal((await run(tool(),input)).code,'permission_denied');current=true;
  assert.equal(sha(fs.readFileSync(source)),version);
 });
}
export async function materialLayoutBoundaries(check,output){
 const root=fs.mkdtempSync(path.join(output,'layout-')),source=path.join(root,'source.pdf'),bytes=Buffer.from('%PDF-owned bounded fixture'),sha=b=>createHash('sha256').update(b).digest('hex'),version=sha(bytes),signal=()=>new AbortController().signal;
 fs.writeFileSync(source,bytes);
 const query={schemaVersion:schema,requestId:randomUUID(),resourceId:'resource_'+randomUUID(),version,page:1,refresh:false};
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZkAAAAASUVORK5CYII=',quad=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
 const receipt={schemaVersion:PDF_LAYOUT_SCHEMA,ok:true,engine:PDF_LAYOUT_ENGINE,inputSha256:version,page:1,total:1,width:1,height:1,png,rasterSha256:sha(Buffer.from(png,'base64')),lines:[{id:'line-1',kind:'text',needsReview:true,text:'未校对文字<script>',score:.99,quad,normalizedQuad:quad}]};
 const cache=()=>new MaterialLayoutCache(()=>root),repository={resource:async()=>({originalFileName:'source.pdf',contentHash:version}),original:async(_id,v,s)=>readMaterialOriginal(root,source,v,s,1024)};
 await check('Layout query/cancel schema denies paths, provider fields, malformed IDs, accessors and unknown versions',async()=>{
  assert(validLayoutQuery(query));assert(validLayoutCancel({schemaVersion:schema,requestId:query.requestId}));
  for(const q of [{...query,path:source},{...query,provider:'cloud'},{...query,page:10001},{...query,version:'old'},{...query,refresh:'yes'},{...query,schemaVersion:'v2'}])assert(!validLayoutQuery(q));
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
