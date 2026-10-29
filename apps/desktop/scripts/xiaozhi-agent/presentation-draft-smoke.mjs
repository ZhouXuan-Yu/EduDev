import '../office-agent/register-source.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {presentationFixture} from './presentation-fixture.mjs';
const {validOfficeDraft}=await import('../../src/shared/xiaozhi-office-draft.ts');
const {validOfficeProposal}=await import('../../src/shared/xiaozhi-office-artifacts.ts');
const {generateOfficeDocument}=await import('../../src/main/xiaozhi-agent/office-generator.ts');
const {readPresentationNotes}=await import('./presentation-readback.ts');
const {officeDraftText}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-presentation-'));
const report={ok:false,checks:[],boundary:'Actual schema, PptxGenJS bytes and independent local OOXML notes parsing; synthetic content, no real model/teacher acceptance.'};
const check=async(name,action)=>{await action();report.checks.push(name);console.log('PASS '+name);};
try{
 await check('New page/notes schema is strict, old Office remains unchanged',()=>{
  assert(validOfficeDraft(presentationFixture));
  const old={schemaVersion:'xiaozhi.office-draft.v1',title:'旧版',sections:[{heading:'旧章节',paragraphs:['旧正文']}]};assert(validOfficeDraft(old));
  assert(!validOfficeDraft({...old,sections:[{...old.sections[0],speakerNotes:[{kind:'script',text:'不允许偷偷扩旧格式'}]}]}));
  for(const change of [v=>v.sections[1].pageId=v.sections[0].pageId,v=>v.sections[0].speakerNotes=[],v=>delete v.sections[0].pageId,v=>v.sections[0].speakerNotes[0].kind='public',v=>v.sections[0].speakerNotes[0].text='\ud800']){const value=structuredClone(presentationFixture);change(value);assert(!validOfficeDraft(value));}
  assert(!validOfficeProposal({path:'不匹配.docx',format:'docx',draft:presentationFixture,sources:[]}));
  assert(!officeDraftText(old).includes('教师'));assert(officeDraftText(presentationFixture).includes('教师参考答案：'));
 });
 let bytes;
 await check('Eight sections generate real PPT bytes with eight meaningful notes and stable IDs',async()=>{
  bytes=await generateOfficeDocument('pptx',presentationFixture,{dataRoot:output});fs.writeFileSync(path.join(output,'floating.pptx'),bytes);fs.writeFileSync(path.join(output,'draft.json'),JSON.stringify(presentationFixture,null,2));
  const notes=await readPresentationNotes(bytes);assert.equal(notes.length,8);assert.deepEqual(notes.map(n=>n.pageId),presentationFixture.sections.map(s=>s.pageId));assert(notes.every(n=>n.text.includes('讲解备注：')));assert(notes[6].text.includes('参考答案：检查①参考答案6N'));
 });
 await check('Dense pages fail explicitly and wrong output formats cannot drop notes',async()=>{
  const dense=structuredClone(presentationFixture);dense.sections[0].paragraphs=Array.from({length:20},()=>('内容'.repeat(400)));assert(validOfficeDraft(dense));
  await assert.rejects(generateOfficeDocument('pptx',dense,{dataRoot:output}),/too_large/);await assert.rejects(generateOfficeDocument('docx',presentationFixture,{dataRoot:output}),/invalid_input/);
 });
 await check('Changing page four preserves all other semantic page inputs and notes',async()=>{
  const changed=structuredClone(presentationFixture);changed.sections[3].heading='排液体积';const updated=await generateOfficeDocument('pptx',changed,{dataRoot:output});fs.writeFileSync(path.join(output,'changed.pptx'),updated);
  assert.deepEqual(await readPresentationNotes(updated),await readPresentationNotes(bytes));
 });
 report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
