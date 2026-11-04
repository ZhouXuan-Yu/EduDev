import {build} from 'esbuild';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import electron from 'electron';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'omni-image-page-boundaries-')),entry=path.join(root,'checks.cjs');
await build({stdin:{contents:`
import {app,nativeImage} from 'electron';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {previewMaterialImage,imagePageBlocks} from './src/main/assets/material-image-page';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from './src/shared/material-page-blocks';
import {MATERIAL_PREVIEW_SCHEMA,IMAGE_PAGE_ENGINE} from './src/shared/material-page-preview';
const hash=b=>createHash('sha256').update(b).digest('hex');
app.whenReady().then(async()=>{let checks=0;try{
 let bytes=nativeImage.createFromBitmap(Buffer.alloc(300*200*4,255),{width:300,height:200}).toPNG(),stamp='same',swap=false;
 const original=Buffer.from(bytes),version=hash(bytes),resourceId='resource_'+randomUUID(),source={schemaVersion:'xiaozhi.material-image-source.v1',resourceId,version,page:1},query={schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),resourceId,version,page:1,box:[.1,.2,.9,.8]};
 const repository={resource:async()=>({contentHash:version,originalFileName:'source.png'}),originalStamp:async()=>stamp,original:async()=>{if(swap)stamp='swapped';return bytes;},verify:async()=>{assert.equal(hash(bytes),version);}};
 const result=await previewMaterialImage(repository,query,new AbortController().signal);assert.equal(result.engine,IMAGE_PAGE_ENGINE);assert.equal(result.width,240);assert.equal(result.height,120);assert.equal(result.sha256,hash(Buffer.from(result.dataUrl.split(',')[1],'base64')));checks++;
 assert.equal((await previewMaterialImage(repository,query,new AbortController().signal)).assetId,result.assetId);checks++;
 await assert.rejects(previewMaterialImage(repository,{...query,page:2},new AbortController().signal),/invalid_input/);await assert.rejects(previewMaterialImage(repository,{...query,version:'c'.repeat(64)},new AbortController().signal),/source_changed/);checks++;
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(previewMaterialImage(repository,query,cancelled.signal));checks++;
 swap=true;await assert.rejects(previewMaterialImage(repository,query,new AbortController().signal),/source_changed/);swap=false;stamp='same';checks++;
 bytes=Buffer.from(original);bytes.writeUInt32BE(100000,16);await assert.rejects(previewMaterialImage(repository,query,new AbortController().signal),/too_large/);bytes=original;checks++;
 let textCalls=0;const recognize=async b=>({schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:hash(b),width:300,height:200,blocks:[{id:'block-1',kind:'text',needsReview:true,score:.9,box:[.1,.1,.9,.9]}]}),ocr=async()=>{textCalls++;return{text:'  本地识别提示  '};};
 const hints=await imagePageBlocks(repository,${JSON.stringify(root)},source,new AbortController().signal,recognize,ocr);assert.deepEqual(hints.blockTexts,[{blockId:'block-1',text:'本地识别提示'}]);assert.equal(textCalls,1);assert.equal(hash(original),version);const full=await previewMaterialImage(repository,{...query,box:[0,0,1,1]},new AbortController().signal);assert.equal(full.sha256,hints.blocks.rasterSha256);checks++;
 const badRoot=${JSON.stringify(path.join(root,'bad'))};fs.mkdirSync(badRoot);await assert.rejects(imagePageBlocks(repository,badRoot,source,new AbortController().signal,async b=>({...await recognize(b),rasterSha256:'0'.repeat(64)}),ocr),/parse_failed/);assert.equal(textCalls,1);checks++;
 console.log(JSON.stringify({success:true,checks,root:${JSON.stringify(root)},scope:'Real Electron native image, source mutation, cancellation, dimension bounds and strict layout receipts; controlled block/OCR only, not natural extraction quality'}));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}});`,resolveDir:process.cwd(),sourcefile:'image-page-checks.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:entry,external:['electron'],logLevel:'silent'});
const env={...process.env};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS'])delete env[k];const run=spawnSync(electron,[entry],{env,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:1024*1024});process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');if(run.error)console.error(run.error);process.exitCode=run.status??1;
