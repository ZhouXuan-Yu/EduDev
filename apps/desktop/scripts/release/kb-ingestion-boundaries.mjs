import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const [{splitMaterialText},{materialIsOcr},{LOCAL_OCR_ENGINE},{createMaterialTools}]=await Promise.all([
 import('../../src/main/assets/material-chunks.ts'),import('../../src/shared/materials.ts'),
 import('../../src/shared/xiaozhi-ocr.ts'),import('../../src/main/assets/material-tools.ts')]);
const checks=[];
async function check(name,fn){await fn();checks.push({name,passed:true});}
await check('Long text retains its complete tail beyond 80 chunks',async()=>{
 const source='教辅'.repeat(65000)+'教材尾部';const chunks=splitMaterialText(source);
 assert(chunks.length>80);assert.equal(chunks.map(c=>c.content).join(''),source);assert(chunks.at(-1).content.endsWith('教材尾部'));
});
await check('Chunk limits reject invalid values and preserve empty input behavior',async()=>{
 for(const limit of [0,-1,NaN,1.5])assert.throws(()=>splitMaterialText('材料',limit));
 assert.deepEqual(splitMaterialText(' \n '),[]);
});
await check('Only pinned image and PDF engines have OCR semantics',async()=>{
 assert(materialIsOcr('image-'+LOCAL_OCR_ENGINE));assert(materialIsOcr('pdfium-5.14.0-rapidocr-3.9.2.v1'));
 for(const engine of ['local-text-v1','image-forged',LOCAL_OCR_ENGINE])assert(!materialIsOcr(engine));
});
const id='resource_00000000-0000-0000-0000-000000000001',chunk={id:'chunk_00000000-0000-0000-0000-000000000002',chunkIndex:0,contentMd:'1 + 1 = 2',pageNumber:1,containsPersonalData:false};
for(const engine of ['image-'+LOCAL_OCR_ENGINE,'pdfium-5.14.0-rapidocr-3.9.2.v1','local-text-v1'])await check('Saved material tool recognition: '+engine,async()=>{
 const store={listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),materials:{body:async()=>({resource:{originalFileName:'题目.png',contentHash:'a'.repeat(64),parseEngine:engine},total:1,chunks:[chunk]})}};
 const tool=createMaterialTools(store,()=>true)[1],response=await tool.execute('test',{resourceId:id,offset:0},new AbortController().signal),body=JSON.parse(response.content[0].text);
 assert.equal(body.teacherConfirmed,false);assert.equal(body.text,chunk.contentMd);
 assert.equal(response.details.data.sources[0].material.resourceId,id);
 if(materialIsOcr(engine)){assert.equal(body.recognition,'local_ocr_unreviewed');assert.match(body.warning,/OCR/);}else assert.equal(body.recognition,undefined);
});
const output=path.resolve('test-results/goal/kb-s0/ingestion-boundaries.json');fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({success:true,checks},null,2)+'\n');console.log(JSON.stringify({success:true,checks:checks.length,output}));
