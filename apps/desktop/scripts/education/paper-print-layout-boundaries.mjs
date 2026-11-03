import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
// Node-only DOCX test: no formula capture or Electron page is used in this fixture.
registerHooks({resolve(s,c,next){if(s==='electron')return{url:'data:text/javascript,export const BrowserWindow=undefined;export const session=undefined;',shortCircuit:true};return next(s,c);}});
const {compilePaperOffice,assertPaperOffice}=await import('../../src/main/education/paper-export.ts');
const {generateOfficeDocument}=await import('../../src/main/xiaozhi-agent/office-generator.ts');
const {validOfficeDraft}=await import('../../src/shared/xiaozhi-office-draft.ts');
const {PAPER_PRINT_LAYOUT}=await import('../../src/shared/paper-print-layout.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-paper-print-'));
const report={ok:false,root,checks:[],files:[],boundary:'Owned synthetic confirmed snapshot; actual DOCX containers and original compiler. PDF/current UI separately required; not Office/WPS visual acceptance.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const paper={id:'xipaper_'+randomUUID(),digest:'a'.repeat(64),title:'A4三角色资格试卷',state:'confirmed',complete:true,sourceCurrent:true,totalPoints:30,blueprint:{grade:'跨知识点资格样本',subject:'理科',durationMinutes:20,sections:[{id:'a',label:'解答题'}]},selection:{items:Array.from({length:6},(_,i)=>({sectionId:'a',number:i+1,points:5,question:{id:'question_'+randomUUID(),questionType:'解答题',stem:`题面${i+1}：已知条件，求解并写出必要步骤。`,answer:'TEACHER_ANSWER_ONLY_'+i,analysis:'TEACHER_ANALYSIS_ONLY_'+i,sourceTitle:'合成题库'}}))}};
const unzip=file=>JSON.parse(execFileSync('python',['-c',"import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({p:z.read(p).decode('utf-8') for p in z.namelist() if p.endswith(('.xml','.rels'))}))",file],{encoding:'utf8',windowsHide:true}));
async function save(draft,name){const file=path.join(root,name+'.docx'),bytes=await generateOfficeDocument('docx',draft,{dataRoot:root});fs.writeFileSync(file,bytes);report.files.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return unzip(file);}
try{
 await check('New paper/answer-sheet drafts pin one known print version; unknown versions fail and old frozen drafts still validate exactly',()=>{
  for(const [audience,template]of [['student','paper'],['teacher','paper'],['student','answer_sheet']]){const d=compilePaperOffice(paper,audience,template);assert(validOfficeDraft(d));assert.equal(d.paperSource.printLayout,PAPER_PRINT_LAYOUT);assertPaperOffice(paper,d);const old=structuredClone(d);delete old.paperSource.printLayout;if(template==='answer_sheet')old.sections=[...old.sections.slice(0,3),{heading:'解答题',paragraphs:old.sections.slice(3).flatMap(s=>[s.heading.split(' · ')[1],...s.paragraphs])}];assert(validOfficeDraft(old));assertPaperOffice(paper,old);const bad=structuredClone(d);bad.paperSource.printLayout='xiaozhi.paper-print.a4.v999';assert(!validOfficeDraft(bad));assert.throws(()=>assertPaperOffice(paper,bad),/conflict/);}
 });
 await check('Actual student/teacher/answer DOCX containers share A4/20mm, role headers and page fields; student and answer containers exclude every answer and analysis',async()=>{
  for(const[audience,template,role]of[['student','paper','学生卷'],['teacher','paper','教师解析卷'],['student','answer_sheet','答题卡']]){
   const z=await save(compilePaperOffice(paper,audience,template),audience+'-'+template),all=Object.values(z).join('\n'),body=z['word/document.xml'];
   assert(body.includes('w:w="11906"'));assert(body.includes('w:h="16838"'));assert(body.includes('w:top="1134"'));assert(body.includes('w:left="1134"'));assert(Object.entries(z).some(([p,v])=>/word\/header\d+\.xml/.test(p)&&v.includes(role)));assert(all.includes('PAGE'));assert(all.includes('NUMPAGES'));
   for(let i=0;i<6;i++){assert.equal(all.includes('TEACHER_ANSWER_ONLY_'+i),audience==='teacher');assert.equal(all.includes('TEACHER_ANALYSIS_ONLY_'+i),audience==='teacher');assert(body.includes(`${i+1}.（5 分）`));}
  }
 });
 await check('Answer numbers keep their blank areas and final six-question roomy template has all twenty-four writing lines',async()=>{
  const z=await save(compilePaperOffice(paper,'student','answer_sheet'),'answer-keep'),body=z['word/document.xml'];assert.equal((body.match(/____________________________________________/g)||[]).length,24);
  const paragraphs=body.match(/<w:p(?:\s[^>]*)?>[^]*?<\/w:p>/g)||[];
  for(const n of [1,2,3,4,5,6]){const p=paragraphs.find(p=>p.includes(`${n}.（5 分）</w:t>`));assert(p);assert(p.includes('<w:keepNext'));}
 });
 await check('Actual multi-page-sized table uses fixed content width, repeated header, non-splitting rows and explicit inner margins',async()=>{
  const p=structuredClone(paper);p.selection.items=p.selection.items.slice(0,1);p.selection.items[0].question.stem='表格题\n| 条件 | 数值 |\n| --- | --- |\n'+Array.from({length:60},(_,i)=>`| 第${i}行 | ${i} |`).join('\n');const d=compilePaperOffice(p,'student'),z=await save(d,'table'),body=z['word/document.xml'];assert(body.includes('w:type="fixed"'));assert(body.includes('w:tblHeader'));assert.equal((body.match(/<w:cantSplit\b/g)||[]).length,61);assert(body.includes('w:w="9638"'));assert(body.includes('第59行'));assert(!Object.values(z).join('').includes('TEACHER_ANSWER_ONLY'));
 });
 await check('Old layout omits new headers/footers and keeps original draft/hash content; original snapshot is unchanged',async()=>{
  const before=JSON.stringify(paper),d=compilePaperOffice(paper,'student');delete d.paperSource.printLayout;const z=await save(d,'legacy');assert(!Object.keys(z).some(p=>/^word\/(?:header|footer)\d+\.xml$/.test(p)));assert.equal(JSON.stringify(paper),before);assertPaperOffice(paper,d);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error?.split('\n').slice(0,2).join(' ')}));}
