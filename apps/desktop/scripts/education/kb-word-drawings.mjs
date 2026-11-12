import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {wordFixture,wordFixtureImage,mutateWord} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {completeWordDrawings}=await import('../../src/main/assets/word-drawings.ts');
const {wordUpgradeCompatible}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
const {validWordDocument,validWordResult}=await import('../../src/shared/material-word.ts');
const {WORD_DRAWING_SCHEMA,WORD_DRAWING_ENGINE,validWordDrawingReceipt}=await import('../../src/shared/material-word-drawing.ts');
const sha=value=>createHash('sha256').update(value).digest('hex');
const walk=blocks=>blocks.flatMap(block=>block.kind==='table'?[block,...block.rows.flatMap(row=>row.cells.flatMap(cell=>walk(cell.blocks)))]:[block]);
const pictures=document=>walk(document.blocks).flatMap(block=>block.kind==='paragraph'?block.inlines.filter(inline=>inline.kind==='image'):[]);
const drawing=(name='geometry',extra='')=>`<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:v="urn:schemas-microsoft-com:vml"><mc:Choice Requires="wp"><w:drawing><wp:inline><wp:docPr id="1" name="${name}"/></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict><v:group><v:rect id="rect-one" style="width:20pt;height:10pt"/>${extra}</v:group></w:pict></mc:Fallback></mc:AlternateContent>`;
async function fixture(raw=drawing()){
 return mutateWord(await wordFixture(),async zip=>{
  const xml=await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml',xml.replace('</w:p>',`<w:r>${raw}</w:r></w:p>`));
 });
}
const bytes=await fixture(),payload=await parseWord(bytes),before=JSON.stringify(payload.document),signal=new AbortController().signal;
const receipt=(items,source=bytes)=>({schemaVersion:WORD_DRAWING_SCHEMA,sourceSha256:sha(source),items:items.map(item=>({inputSha256:item.sha256,ok:true,png:wordFixtureImage.toString('base64'),sha256:sha(wordFixtureImage),width:1,height:1}))});
const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
await check('The original independent vector group becomes a bounded SHA/path/name-bound pending image',()=>{
 assert.equal(payload.drawings.length,1);const request=payload.drawings[0];assert.equal(request.name,'geometry');assert.equal(request.sha256,sha(request.xml));
 assert.equal(pictures(payload.document).filter(item=>item.drawing).length,1);
 assert(payload.document.warnings.includes('drawing_render_required'));
 assert(validWordResult({schemaVersion:'xiaozhi.word-source.v1',requestId:'test',ok:true,payload},'test'));
});
let completed;
await check('Authenticated conversion publishes through existing Word assets without changing text, numbering or original payload',async()=>{
 completed=await completeWordDrawings(payload,bytes,signal,async(_bytes,items)=>receipt(items));
 const image=pictures(completed.document).find(item=>item.drawing);assert.equal(image.assetId,'wa_'+sha(wordFixtureImage));assert.equal(image.issue,'');assert.equal(image.drawing.engine,WORD_DRAWING_ENGINE);
 assert.equal(completed.drawings,undefined);assert(validWordDocument(completed.document));assert(!completed.document.warnings.includes('drawing_render_required'));assert.equal(JSON.stringify(payload.document),before);
 const previous=structuredClone(payload.document);delete previous.drawingPolicy;
 for(const image of pictures(previous))if(image.drawing){delete image.drawing;image.part='';image.issue='image_missing';}
 assert(validWordDocument(previous));assert(wordUpgradeCompatible(previous,completed.document));
 assert.equal(indexWordQuestions(previous).total,indexWordQuestions(completed.document).total);
 for(let n=1;n<=indexWordQuestions(previous).total;n++)assert.equal(indexWordQuestions(previous).bodyIdentity(n),indexWordQuestions(completed.document).bodyIdentity(n));
 assert.notEqual(indexWordQuestions(previous).documentSha,indexWordQuestions(completed.document).documentSha);
 const tampered=structuredClone(completed.document);pictures(tampered).find(item=>item.drawing).alt='changed';assert(!wordUpgradeCompatible(previous,tampered));
});
await check('A failed shape keeps its original place and visible missing-image/source warning',async()=>{
 const result=await completeWordDrawings(payload,bytes,signal,async(_bytes,items)=>({schemaVersion:WORD_DRAWING_SCHEMA,sourceSha256:sha(bytes),items:items.map(item=>({inputSha256:item.sha256,ok:false,error:'ambiguous'}))}));
 assert(pictures(result.document).find(item=>item.drawing).issue==='drawing_ambiguous');assert(result.document.warnings.includes('drawing_render_required'));assert(validWordDocument(result.document));
});
await check('Whole-document binding, image SHA, dimensions, order and unknown versions fail closed',async()=>{
 for(const mutate of [r=>r.sourceSha256='a'.repeat(64),r=>r.items[0].inputSha256='b'.repeat(64),r=>r.items[0].sha256='c'.repeat(64),r=>r.items[0].width=2,r=>r.schemaVersion='future']){
  const result=receipt(payload.drawings);mutate(result);await assert.rejects(completeWordDrawings(payload,bytes,signal,async()=>result));
 }
 const malformed=receipt(payload.drawings);malformed.items[0].png='x'.repeat(6*1048576);assert(!validWordDrawingReceipt(malformed));
 const doc=structuredClone(completed.document);pictures(doc).find(item=>item.drawing).drawing.engine='future';assert(!validWordDocument(doc));
});
await check('A floating group is restored visually while external-label layout remains explicitly unverified',async()=>{
 const original=await fixture(drawing().replaceAll('wp:inline','wp:anchor')),parsed=await parseWord(original);
 const result=await completeWordDrawings(parsed,original,signal,async(_bytes,items)=>receipt(items,original));
 assert(pictures(result.document).find(item=>item.drawing).assetId);
 assert(result.document.warnings.includes('drawing_float_layout'));
 assert(walk(result.document.blocks).some(block=>block.warnings?.includes('drawing_float_layout')));
 assert(!result.document.warnings.includes('drawing_render_required'));
});
await check('Text boxes, bitmap mixtures, text paths, nested alternatives and duplicate names retain conservative parsing',async()=>{
 for(const extra of ['<v:textbox><w:txbxContent><w:p><w:r><w:t>标注</w:t></w:r></w:p></w:txbxContent></v:textbox>','<v:imagedata/>','<v:textpath string="标签"/>','<mc:AlternateContent/>']){
  const result=await parseWord(await fixture(drawing('geometry',extra)));assert.equal(result.drawings,undefined);assert(result.document.warnings.includes('alternate_content'));
 }
 const duplicate=await parseWord(await fixture(drawing()+drawing()));assert.equal(duplicate.drawings,undefined);
});
await check('Cancellation before and after rendering prevents publication',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(completeWordDrawings(payload,bytes,controller.signal,async()=>{calls++;return receipt(payload.drawings);}));assert.equal(calls,0);
 const other=new AbortController();await assert.rejects(completeWordDrawings(payload,bytes,other.signal,async()=>{other.abort();return receipt(payload.drawings);}));
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'controlled conversion, actual LibreOffice and Electron are separate checks'}));
