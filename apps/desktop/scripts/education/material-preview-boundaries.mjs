import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {MATERIAL_PREVIEW_SCHEMA as schema,PDF_PAGE_SCHEMA,PDF_PAGE_ENGINE,validMaterialPreviewQuery,validMaterialPreviewCancel,validPdfPageReceipt,validPageBox} from '../../src/shared/material-page-preview.ts';
import {readMaterialOriginal} from '../../src/main/assets/material-original.ts';
import {previewMaterialPage} from '../../src/main/assets/material-page-preview.ts';
export async function materialPreviewBoundaries(check,output){
 const root=fs.mkdtempSync(path.join(output,'original-')),file=path.join(root,'owned.pdf'),bytes=Buffer.from('%PDF-synthetic boundary'),sha=b=>createHash('sha256').update(b).digest('hex'),version=sha(bytes),query={schemaVersion:schema,requestId:randomUUID(),resourceId:'resource_'+randomUUID(),version,page:1,box:[0,0,1,1]};fs.writeFileSync(file,bytes);
 const signal=()=>new AbortController().signal;
 await check('Original preview rejects forged paths, engines, malformed IDs and nonfinite/sparse/accessor regions',async()=>{
  assert(validMaterialPreviewQuery(query));assert(validMaterialPreviewCancel({schemaVersion:schema,requestId:query.requestId}));
  for(const q of [{...query,path:file},{...query,resourceId:'resource_------------------------------------'},{...query,page:0},{...query,page:51},{...query,version:'old'},{...query,box:[0,0,Infinity,1]},{...query,box:[0,0,0,1]},{...query,box:[0,-1,1,1]}])assert(!validMaterialPreviewQuery(q));
  let reads=0;const q={...query},box=[0,0,1,1];Object.defineProperty(q,'version',{get(){reads++;return version;},enumerable:true});Object.defineProperty(box,'0',{get(){reads++;return 0;},enumerable:true});assert(!validMaterialPreviewQuery(q));assert(!validPageBox(box));assert(!validPageBox([0,,1,1]));assert.equal(reads,0);
 });
 await check('Original capture bounds actual descriptor reads and rejects foreign paths, hardlinks, changed bytes and cancellation',async()=>{
  assert.deepEqual(await readMaterialOriginal(root,file,version,signal(),1024),bytes);
  await assert.rejects(()=>readMaterialOriginal(root,file,version,signal(),bytes.length-1),/too_large/);
  await assert.rejects(()=>readMaterialOriginal(output,file,version,signal(),1024),/missing/);
  await assert.rejects(()=>readMaterialOriginal(root,file,'0'.repeat(64),signal(),1024),/source_changed/);
  const hard=path.join(root,'hard.pdf');fs.linkSync(file,hard);await assert.rejects(()=>readMaterialOriginal(root,file,version,signal(),1024),/missing/);fs.unlinkSync(hard);
  const ctl=new AbortController();ctl.abort();await assert.rejects(()=>readMaterialOriginal(root,file,version,ctl.signal,1024));
 });
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZkAAAAASUVORK5CYII=','base64'),receipt={schemaVersion:PDF_PAGE_SCHEMA,ok:true,engine:PDF_PAGE_ENGINE,inputSha256:version,page:1,total:1,box:[0,0,1,1],pageWidth:1,pageHeight:1,width:1,height:1,png:png.toString('base64'),sha256:sha(png)};
 const repository={resource:async()=>({originalFileName:'owned.pdf'}),original:async(_id,v,s)=>readMaterialOriginal(root,file,v,s,1024)};
 await check('Original preview matches source/page/region/PNG hash and dimensions before returning an opaque reproducible identity',async()=>{
  assert(validPdfPageReceipt(receipt));const a=await previewMaterialPage(repository,query,signal(),async()=>receipt),b=await previewMaterialPage(repository,{...query,requestId:randomUUID()},signal(),async()=>receipt);assert.equal(a.assetId,b.assetId);assert(a.assetId.startsWith('asset_'));assert.equal(a.dataUrl,'data:image/png;base64,'+receipt.png);assert.equal(a.version,version);
  for(const bad of [{...receipt,inputSha256:'0'.repeat(64)},{...receipt,page:2,total:2},{...receipt,engine:'other'},{...receipt,width:2},{...receipt,sha256:'0'.repeat(64)},{...receipt,png:Buffer.from('not an image').toString('base64')},{...receipt,box:[0,0,.5,1]},{...receipt,png:png.subarray(0,-12).toString('base64')}])await assert.rejects(()=>previewMaterialPage(repository,query,signal(),async()=>bad),/parse_failed/);
 });
 await check('Source changes or stop during render discard every late receipt without persisting questions or parse status',async()=>{
  await assert.rejects(()=>previewMaterialPage(repository,query,signal(),async()=>{fs.appendFileSync(file,' changed');return receipt;}),/source_changed/);fs.writeFileSync(file,bytes);
  const ctl=new AbortController();await assert.rejects(()=>previewMaterialPage(repository,query,ctl.signal,async()=>{ctl.abort();return receipt;}));
 });
}
