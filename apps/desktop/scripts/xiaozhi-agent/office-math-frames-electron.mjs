import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-office-math-frames-')),adapter=path.join(root,'math-renderer.cjs'),report={ok:false,root,checks:[],boundary:'Original production rasterizer in Electron; every batched image compared with an independently rendered single paragraph. Same dimensions, at most 1% of ink pixels and 32 pixels may differ for Chromium glyph-edge rasterization. No provider or teacher acceptance.'};let app;
await build({entryPoints:[path.join(desktop,'src/main/xiaozhi-agent/office-pdf-renderer.ts')],outfile:adapter,bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron'],define:{'import.meta.url':JSON.stringify(pathToFileURL(adapter).href)},logLevel:'silent'});
try{
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_E2E_DIALOG_MODE:'1'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.firstWindow();await app.evaluate(({app})=>app.whenReady());
 report.results=await app.evaluate(async(_,input)=>{
  const require=process.getBuiltinModule('module').createRequire(input.adapter),{renderOfficeMathImages}=require(input.adapter),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
  const texts=['$F_b=\\rho gV$','$V=\\frac{m}{\\rho_f}$','$a=\\sqrt[3]{V}$','$$\\frac{x^2+1}{\\sqrt{x}}$$','由 $F_b=\\rho gV$ 得到 $V=\\frac{F_b}{\\rho g}$。'],results=[];
  for(const cropMath of [false,true]){
   const selected=cropMath?texts.slice(0,4):texts,draft={schemaVersion:'xiaozhi.office-draft.v1',title:'连续公式',sections:selected.map(text=>({heading:'公式',paragraphs:[text]}))},batch=await renderOfficeMathImages(draft,{dataRoot:input.root,cropMath}),items=[];
   for(let i=0;i<selected.length;i++){
    const expected=(await renderOfficeMathImages({...draft,sections:[draft.sections[i]]},{dataRoot:input.root,cropMath})).get('0:0'),actual=batch.get(i+':0'),file=path.join(input.root,`${cropMath?'crop':'paragraph'}-${i}.png`);fs.writeFileSync(file,actual.bytes);
    const imageA=require('electron').nativeImage.createFromBuffer(actual.bytes),imageB=require('electron').nativeImage.createFromBuffer(expected.bytes),a=imageA.toBitmap(),b=imageB.toBitmap();let differentPixels=0,ink=0;
    for(let k=0;k<a.length;k+=4){if(a[k]!==b[k]||a[k+1]!==b[k+1]||a[k+2]!==b[k+2])differentPixels++;if(b[k]<250||b[k+1]<250||b[k+2]<250)ink++;}
    // A display radical differs by nine glyph-edge pixels after Chromium's glyph cache warms.
    // Compare ink rather than white canvas area, with an absolute cap, so a swapped formula fails.
    if(differentPixels>Math.min(32,Math.ceil(ink*.01))||a.length!==b.length||actual.width!==expected.width||actual.height!==expected.height){fs.writeFileSync(file.replace('.png','-expected.png'),expected.bytes);throw Error('Stale or mismatched frame '+cropMath+':'+i+' '+JSON.stringify({differentPixels,ink,actual:[actual.width,actual.height],expected:[expected.width,expected.height]}));}
    items.push({source:selected[i],sha256:createHash('sha256').update(actual.bytes).digest('hex'),differentPixels,ink,width:actual.width,height:actual.height,file});
   }
   results.push({cropMath,items});
  }
  return results;
 },{adapter,root});
 for(const result of report.results){assert.equal(new Set(result.items.map(i=>i.sha256)).size,result.items.length);report.checks.push(`${result.cropMath?'Isolated PPT formulas':'DOCX paragraphs'}: all ${result.items.length} batched frames match independent single-item pixels within stated glyph-edge tolerance, including fraction, radical and display math`);}
 assert(!fs.readdirSync(root).some(n=>n.startsWith('office-render-')));report.checks.push('All original static raster staging files and windows released');report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
