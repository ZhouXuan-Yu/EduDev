import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
const {planAnswerPageMask,eraseAnswerHeaderPixels}=await import('../../src/main/assets/material-ai-answer-page-mask.ts');
const {ANSWER_PAGE_HEADER_MASK,validAnswerPageHeaderMask}=await import('../../src/shared/material-ai-answer-page-mask.ts');
const {MATERIAL_PAGE_PROMPT,MATERIAL_PAGE_SOURCE}=await import('../../src/shared/material-ai-page.ts');

// Synthetic only: no corpus reads, OCR, Electron, provider or filesystem writes.
const header='Support 13900000000';
const body='1. Calculate 2 + 2. Answer: 4.';
const clean=async text=>text.replace(/(?<!\d)1[3-9]\d{9}(?!\d)/gu,'[phone]');
const checks=[];
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
function line(id,text,box){return{id,sourceId:id,text,box,score:.999,quad:[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]],regionIds:[id]};}
function fixture(){
 const lines=[line('header',header,[.1,.02,.4,.04]),line('body',body,[.1,.3,.8,.34])];
 const page={lines,rawText:lines.map(l=>l.text).join('\n'),
  paragraphs:[{role:'header',lineIds:['header']}],
  regions:[{id:'header',kind:'header',box:[.1,.02,.4,.04]},{id:'body',kind:'text',box:[.1,.3,.8,.34]}]};
 const original={ocrText:page.rawText,textStreams:[page.rawText],text:page.rawText};
 return{page,original};
}
function sync(f){f.page.rawText=f.page.lines.filter(l=>!l.origin).map(l=>l.text).join('\n');f.original.ocrText=f.page.rawText;f.original.textStreams=[f.page.rawText];f.original.text=f.page.rawText;return f;}
const plan=f=>planAnswerPageMask(f.page,f.original,200,1000,clean);
const blocked=async f=>assert.rejects(()=>plan(f),/privacy_blocked/);

await check('Authenticated header yields one bounded mask and preserves exact body characters',async()=>{
 const f=fixture(),before=JSON.stringify(f),result=await plan(f);
 assert.equal(result.masks.length,1);assert.equal(result.text,'\n'+body);
 assert.equal(JSON.stringify(f),before);assert(result.masks[0][3]<300);
});
await check('Native transcript can move the same exact header to its end with whitespace-only differences',async()=>{
 const f=fixture(),native=body+'\nSupport\t13900000000';
 f.original.textStreams.push(native);f.original.text=f.original.textStreams.join('\n');
 const result=await plan(f);assert.equal(result.text,'\n'+body+'\n'+body+'\n');
});
await check('A registered stream without the header remains byte-for-byte intact',async()=>{
 const f=fixture(),native='Native formula: x² = 9; x = −3 or 3.';
 f.original.textStreams.push(native);f.original.text=f.original.textStreams.join('\n');
 assert.equal((await plan(f)).text,'\n'+body+'\n'+native);
});
await check('Duplicate header occurrence in a native stream is refused',async()=>{
 const f=fixture();f.original.textStreams.push(header+'\n'+body+'\n'+header);await blocked(f);
});
await check('A partial word or number substring cannot be used as a removable native span',async()=>{
 for(const native of ['X'+header,header+'7']){const f=fixture();f.original.textStreams.push(native);await blocked(f);}
});
await check('Duplicate sanitizing OCR lines are refused even when geometry is separate',async()=>{
 const f=fixture();f.page.lines.splice(1,0,line('header2',header,[.6,.02,.9,.04]));
 f.page.paragraphs.push({role:'header',lineIds:['header2']});
 f.page.regions.push({id:'header2',kind:'header',box:[.6,.02,.9,.04]});await blocked(sync(f));
});
await check('A phone in body text is never sanitized by this projection',async()=>{
 const f=fixture();f.page.lines[1].text='Question data includes 13800000000.';await blocked(sync(f));
});
await check('Non-header role, low-confidence line and a header outside the top band are refused',async()=>{
 for(const mutate of [f=>f.page.paragraphs[0].role='body',f=>f.page.lines[0].score=.94,
  f=>{f.page.lines[0].box=[.1,.2,.4,.22];f.page.regions[0].box=[.1,.2,.4,.22];}]){
  const f=fixture();mutate(f);await blocked(f);
 }
});
await check('Missing or ambiguous positive header region cannot authorize masking',async()=>{
 for(const mutate of [f=>f.page.regions.shift(),f=>f.page.regions[0].kind='text',
  f=>f.page.regions.push({...f.page.regions[0],id:'competing'})]){const f=fixture();mutate(f);await blocked(f);}
});
await check('Missing OCR ground truth or any transcript/line mismatch is refused',async()=>{
 for(const mutate of [f=>f.original.ocrText+=' extra',f=>f.page.rawText+=' extra',
  f=>f.original.textStreams=[body],f=>f.page.lines[0].origin='pdf_native_crop']){
  const f=fixture();mutate(f);await blocked(f);
 }
});
await check('Invalid normalized line or region geometry is refused',async()=>{
 for(const mutate of [f=>f.page.lines[0].box=[-.1,.02,.4,.04],
  f=>f.page.regions[0].box=[.4,.02,.1,.04],f=>f.page.regions[0].box=[.1,.02,Infinity,.04]]){
  const f=fixture();mutate(f);await blocked(f);
 }
});
await check('Padding cannot erase an adjacent column line or a separate adjacent content region',async()=>{
 const f=fixture();f.page.lines.push(line('adjacent','Preserve this adjacent column',[.405,.02,.7,.04]));await blocked(sync(f));
 const g=fixture();g.page.regions.push({id:'adjacent',kind:'image',box:[.405,.02,.7,.04]});await blocked(g);
});
await check('A multi-column header region enclosing separate body content is refused',async()=>{
 const f=fixture();f.page.regions[0].box=[.1,.02,.9,.04];
 f.page.lines.push(line('adjacent','Content in another column',[.6,.02,.8,.04]));await blocked(sync(f));
});
await check('Two isolated header masks preserve the text and raster gap between columns',async()=>{
 const f=fixture();f.page.lines.splice(1,0,line('header2','Help 13800000000',[.65,.02,.9,.04]));
 f.page.paragraphs.push({role:'header',lineIds:['header2']});
 f.page.regions.push({id:'header2',kind:'header',box:[.65,.02,.9,.04]});sync(f);
 const result=await plan(f);assert.equal(result.masks.length,2);assert.equal(result.text,'\n\n'+body);
 assert(result.masks[0][2]<result.masks[1][0]);
 const pixels=Buffer.alloc(200*1000*4);for(let i=0;i<pixels.length;i++)pixels[i]=i%251;
 const before=Buffer.from(pixels);eraseAnswerHeaderPixels(pixels,200,result.masks);
 for(let y=0;y<1000;y++)for(let x=0;x<200;x++){
  const erased=result.masks.some(([left,top,right,bottom])=>x>=left&&x<right&&y>=top&&y<bottom);
  const at=(y*200+x)*4;
  assert.deepEqual(pixels.subarray(at,at+4),erased?Buffer.from([255,255,255,255]):before.subarray(at,at+4));
 }
});
await check('No sanitizing header, no remaining body and sensitive joined stream boundaries fail closed',async()=>{
 const f=fixture();f.page.lines[0].text='Ordinary page title';await blocked(sync(f));
 const g=fixture();g.page.lines.pop();g.page.regions.pop();await blocked(sync(g));
 const h=fixture();h.original.textStreams.push('13900','000000');
 await assert.rejects(()=>planAnswerPageMask(h.page,h.original,200,1000,async text=>{
  const normal=await clean(text);return normal.replace(/13900\s+000000/gu,'[joined phone]');
 }),/privacy_blocked/);
});

await check('Every local privacy flag must be explained by a masked header',async()=>{
 const f=fixture();f.original.privacyRows=[{heading:'Source',content_md:header+'\n'+body}];
 assert.equal((await plan(f)).text,'\n'+body);
 for(const entry of [{content_md:body},{content_md:header+'\n13800000000'},{heading:'13800000000',content_md:header}]){
  const g=fixture();g.original.privacyRows=[entry];await blocked(g);
 }
});
await check('A personal resource label cannot enter header-only dispatch',async()=>{
 const f=fixture();f.original.resourceLabels='Contact 13800000000';await blocked(f);
});

function validUnit(){return{sources:[],bookRole:{kind:'answers'},bookPagePolicy:'answer-policy',
 pageSource:{schemaVersion:MATERIAL_PAGE_SOURCE},pagePrompt:{policy:MATERIAL_PAGE_PROMPT},answerPageMask:{
  policy:ANSWER_PAGE_HEADER_MASK,structureGeneration:'12345678-1234-1234-1234-123456789abc',
  structureSha:'a'.repeat(64),originalImageSha:'b'.repeat(64),privacySha:'e'.repeat(64),textSha:'c'.repeat(64),imageSha:'d'.repeat(64),masks:[[1,2,30,40]],
 }};}
await check('Proof shape rejects hash, policy, mask, role and unsupported-source tampering',async()=>{
 assert.equal(validAnswerPageHeaderMask(validUnit()),true);
 for(const mutate of [u=>u.answerPageMask.structureSha='bad',u=>u.answerPageMask.privacySha='bad',u=>u.answerPageMask.policy='future',
  u=>u.answerPageMask.extra=true,u=>u.answerPageMask.structureGeneration='bad',
  u=>u.answerPageMask.imageSha=u.answerPageMask.originalImageSha,u=>u.answerPageMask.masks=[],
  u=>u.answerPageMask.masks=Array.from({length:17},()=>[1,2,3,4]),
  u=>u.answerPageMask.masks=[[1,2,30,40,50]],u=>u.answerPageMask.masks=[[1.5,2,30,40]],
  u=>u.answerPageMask.masks=[[-1,2,30,40]],u=>u.answerPageMask.masks=[[1,2,2402,40]],
  u=>u.answerPageMask.masks=[[30,2,30,40]],u=>u.answerPageMask.masks=[[1,40,30,2]],
  u=>u.bookRole.kind='questions',u=>u.bookPagePolicy=undefined,u=>u.native={},
  u=>u.sources=[{}],u=>u.pageSource.schemaVersion='future',u=>u.pagePrompt.policy='future']){
  const u=validUnit();mutate(u);assert.equal(validAnswerPageHeaderMask(u),false);
 }
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Synthetic Node planner, exact text projection, BGRA mask isolation and proof-shape boundaries; no Electron or provider acceptance.'}));
