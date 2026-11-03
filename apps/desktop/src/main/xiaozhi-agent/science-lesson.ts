import {createHash} from 'node:crypto';
import {SCIENCE_LESSON_SCHEMA,LESSON_ROLES,validScienceLesson,type ScienceLesson,type LessonSource,type LessonRole,type ScienceLessonSummary} from '../../shared/science-lesson';
import {validQuestionContextSource} from '../../shared/question-context';
import {analyzeBuoyancy,buoyancySummary} from '../../shared/buoyancy';
import {BUOYANCY_DEMO_SCHEMA} from '../../shared/buoyancy-demo';
import {OFFICE_DRAFT_SCHEMA,PRESENTATION_DRAFT_SCHEMA,type OfficeDraft} from '../../shared/xiaozhi-office-draft';
import {officeRelativePath,type OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import {renderBuoyancyDemo} from './buoyancy-demo';
import {prepareHtmlArtifact} from '../../shared/html-artifact';

export const lessonHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export type LessonFile={fileId:LessonRole;kind:'text';path:string;content:string}|({fileId:LessonRole;kind:'office'}&OfficeArtifactProposal);
export type LessonSnapshot={schemaVersion:typeof SCIENCE_LESSON_SCHEMA;spec:ScienceLesson;source:LessonSource;display:{title:string;goals:string[]};hash:string;revision:number;previousBundleId?:string;changed:LessonRole[];files:{fileId:LessonRole;hash:string}[]};
export const lessonFileHash=(f:LessonFile)=>lessonHash(f.kind==='text'?{kind:f.kind,content:f.content}:{kind:f.kind,format:f.format,draft:f.draft,sources:f.sources});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const sourceText=(s:LessonSource)=>s.kind==='self_authored'?'本任务自拟题（非题库原题）':`已保存题目：${s.title}；版本 ${s.question!.version}`;
export function validLessonSnapshot(v:unknown):v is LessonSnapshot{
 try{const x=v as LessonSnapshot;return x.schemaVersion===SCIENCE_LESSON_SCHEMA&&validScienceLesson(x.spec)&&x.source.kind===x.spec.origin.kind
  &&['stem','answer','analysis','title'].every(k=>typeof x.source[k as keyof LessonSource]==='string'&&String(x.source[k as keyof LessonSource]).length<=24000)
  &&(x.source.kind==='self_authored'?!x.source.question:validQuestionContextSource(x.source.question)&&x.spec.origin.kind==='question'&&x.source.question.version===x.spec.origin.version)
  &&typeof x.display.title==='string'&&Array.isArray(x.display.goals)&&x.display.goals.length===x.spec.goals.length&&x.display.goals.every(g=>typeof g==='string'&&g.length<=24000)
  &&x.hash===lessonHash([x.spec,x.source,x.display])&&Number.isSafeInteger(x.revision)&&x.revision>=1
  &&(x.previousBundleId===undefined||/^xidelivery_[a-f0-9]{64}$/.test(x.previousBundleId))&&Array.isArray(x.changed)&&x.changed.every(r=>r in LESSON_ROLES)
  &&Array.isArray(x.files)&&x.files.length===5&&new Set(x.files.map(f=>f.fileId)).size===5&&x.files.every(f=>f.fileId in LESSON_ROLES&&/^[a-f0-9]{64}$/.test(f.hash));}catch{return false;}
}
/** One semantic specification; original text/Office services still own every file effect. */
export function compileScienceLesson(spec:ScienceLesson,source:LessonSource,prefix:string){
 if(!validScienceLesson(spec)||source.kind!==spec.origin.kind||!officeRelativePath(prefix+'-test.docx')||Buffer.byteLength(JSON.stringify([spec,source]))>256*1024)throw Error('invalid_input');
 const values=new Map<string,{value:string;private:boolean}>();
 for(const f of spec.facts)values.set(f.id,{value:f.value,private:f.audience==='teacher'});
 values.set('question.stem',{value:source.stem,private:false});values.set('question.answer',{value:source.answer,private:true});values.set('question.analysis',{value:source.analysis,private:true});
 let modelText='未独立数值核验；通用知识与讲解由教师核对。',modelFacts:string[]=[];
 if(spec.demo.kind==='buoyancy'){
  const result=analyzeBuoyancy(spec.demo.model);if(result.state!=='calculated'||!result.values)throw Error('invalid_input');
  modelText=buoyancySummary(result)+' '+result.notes.join(' ');
  for(const [key,q]of Object.entries(result.values))if(q){values.set('calc.'+key,{value:q.decimal+' '+q.unit,private:false});modelFacts.push(key+' = '+q.decimal+' '+q.unit);}
  values.set('calc.regime',{value:{floating:'可漂浮',neutral:'全浸没临界（深度不唯一）',overloaded:'超载：全浸没未触底'}[result.regime!],private:false});
 }
 const expand=(raw:string,publicOnly=false)=>{
  let out=raw;for(let pass=0;pass<5&&out.includes('{{');pass++){out=out.replace(/\{\{([a-zA-Z][\w.]*)\}\}/g,(_m,k:string)=>{const f=values.get(k);if(!f||publicOnly&&f.private)throw Error('lesson_reference_invalid');return f.value;});if(out.length>24000)throw Error('too_large');}
  if(out.includes('{{')||out.includes('}}'))throw Error('lesson_reference_invalid');return out;
 };
 const pub=(s:string)=>expand(s,true),teacher=(s:string)=>expand(s),goals=spec.goals.map(pub),title=pub(spec.title),audience=pub(spec.audience);
 const origin=sourceText(source),common=[audience+' · '+spec.subject+' · '+spec.knowledgePoint,`设计安排：${spec.minutes}分钟（非课堂实测）`,...goals.map((g,i)=>`目标${i+1}：${g}`),origin,'补充讲解/活动为本课设计，非原题或教材原文；未声明教材页码。'];
 const sections=(heading:string,paragraphs:string[])=>({heading,paragraphs});
 const studentActivities=spec.activities.map(a=>sections(pub(a.title)+`（设计${a.minutes}分钟；目标${a.goals.join('/')}）`,a.student.map(pub)));
 const publicFacts=spec.facts.filter(f=>f.audience==='public').map(f=>pub(f.label)+'：'+pub(f.value));
 const handout:OfficeDraft={schemaVersion:OFFICE_DRAFT_SCHEMA,title:title+' · 学生讲义',sections:[sections('目标与来源',common),sections('主线题', [pub(source.stem)]),...(publicFacts.length?[sections('已知资料',publicFacts)]:[]),...studentActivities,sections('课堂记录', ['预测：________________','观察：________________','解释：________________'])]};
 const quiz:OfficeDraft={schemaVersion:OFFICE_DRAFT_SCHEMA,title:title+' · 随堂题',sections:[sections('目标与来源',common),...spec.checks.map((c,i)=>sections(`第${i+1}题 · 目标${c.goals.join('/')}`,[pub(c.stem),'作答：________________','________________']))]};
 const teacherDraft:OfficeDraft={schemaVersion:OFFICE_DRAFT_SCHEMA,title:title+' · 教师解析',sections:[sections('目标与来源',common),sections('原题/自拟题与参考',[teacher(source.stem),'参考答案：'+teacher(source.answer),'参考解析：'+teacher(source.analysis)]),sections('核验范围与本课参数',[modelText,...modelFacts,...spec.facts.map(f=>teacher(f.label)+'：'+teacher(f.value))]),...spec.activities.map(a=>sections(teacher(a.title)+`（设计${a.minutes}分钟）`,[...a.student.map(s=>'学生：'+pub(s)),...a.teacher.map(teacher)])),...spec.checks.map((c,i)=>sections(`第${i+1}题参考`,[pub(c.stem),'答案：'+teacher(c.answer),'解析：'+teacher(c.analysis)]))]};
 const slideDraft:OfficeDraft={schemaVersion:PRESENTATION_DRAFT_SCHEMA,title:title,sections:spec.slides.map((s,i)=>({pageId:'lesson-page-'+(i+1),heading:pub(s.title),paragraphs:[...s.paragraphs.map(pub),...(i===0?common:[]),...(i===Math.min(1,spec.slides.length-1)?['主线题：'+pub(source.stem)]:[])],speakerNotes:[...s.notes.map(text=>({kind:'script' as const,text:teacher(text)})),...(i===0?[{kind:'script' as const,text:origin+'；'+modelText}]:[]),...(i===spec.slides.length-1?spec.checks.map((c,j)=>({kind:'answer' as const,text:`第${j+1}题：${teacher(c.answer)}；${teacher(c.analysis)}`})):[])]}))};
 let html:string;
 if(spec.demo.kind==='buoyancy')html=renderBuoyancyDemo({schemaVersion:BUOYANCY_DEMO_SCHEMA,title,audience,model:spec.demo.model});
 else{
  // An explicit guided experiment, without pretending to simulate unknown physical laws.
  html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font:18px/1.7 system-ui;max-width:900px;margin:24px auto;padding:16px}button{font:inherit;margin:6px;padding:8px}section{margin:20px 0}textarea{display:block;width:95%;min-height:90px}[hidden]{display:none}</style><h1>'+esc(title)+'</h1><p>引导式探究；不是数值/运动仿真。</p>'+common.map(s=>'<p>'+esc(s)+'</p>').join('')+'<p>'+esc(pub(source.stem))+'</p>'+spec.activities.map((a,i)=>'<section data-phase="'+i+'"'+(i?' hidden':'')+'><h2>'+esc(pub(a.title))+'</h2>'+a.student.map(s=>'<p>'+esc(pub(s))+'</p>').join('')+'<textarea aria-label="探究记录'+(i+1)+'"></textarea></section>').join('')+'<button id="previous">上一步</button><button id="next">下一步</button><button id="reset">重置</button><button id="teacher" aria-expanded="false">教师参考</button><div id="answers" hidden>'+spec.checks.map(c=>'<p>'+esc(teacher(c.answer))+'；'+esc(teacher(c.analysis))+'</p>').join('')+'</div><script>let i=0;const p=[...document.querySelectorAll("[data-phase]")];function show(){p.forEach((x,n)=>x.hidden=n!==i);document.querySelector("#previous").disabled=i===0;document.querySelector("#next").disabled=i===p.length-1}document.querySelector("#previous").onclick=()=>{i=Math.max(0,i-1);show()};document.querySelector("#next").onclick=()=>{i=Math.min(p.length-1,i+1);show()};document.querySelector("#teacher").onclick=e=>{let a=document.querySelector("#answers");a.hidden=!a.hidden;e.target.setAttribute("aria-expanded",String(!a.hidden))};document.querySelector("#reset").onclick=()=>{i=0;document.querySelectorAll("textarea").forEach(x=>x.value="");document.querySelector("#answers").hidden=true;document.querySelector("#teacher").setAttribute("aria-expanded","false");show()};show();</script></html>';
 }
 const appendix='<section id="lesson-provenance"><h2>本课目标与来源</h2>'+[...common,'主线题：'+pub(source.stem)].map(s=>'<p>'+esc(s)+'</p>').join('')+'</section>';
 html=html.includes('</main>')?html.replace('</main>',appendix+'</main>'):html.replace('<script>',appendix+'<script>');
 if(Buffer.byteLength(html)>65536)throw Error('too_large');
 const office=(fileId:LessonRole,name:string,draft:OfficeDraft):LessonFile=>({fileId,kind:'office',path:prefix+'-'+name,format:fileId==='slides'?'pptx':'docx',sources:[],draft});
 const files:LessonFile[]=[office('handout','学生讲义.docx',handout),office('teacher','教师解析.docx',teacherDraft),office('slides','课堂课件.pptx',slideDraft),{fileId:'demo',kind:'text',path:prefix+'-离线探究.html',content:prepareHtmlArtifact(html)},office('quiz','随堂题.docx',quiz)];
 const display={title,goals};
 const snapshot:LessonSnapshot={schemaVersion:SCIENCE_LESSON_SCHEMA,spec:structuredClone(spec),source:structuredClone(source),display,hash:lessonHash([spec,source,display]),revision:1,changed:files.map(f=>f.fileId),files:files.map(f=>({fileId:f.fileId,hash:lessonFileHash(f)}))};
 return{files,snapshot};
}
export function lessonSummary(s:LessonSnapshot,edited=false):ScienceLessonSummary{
 return{schemaVersion:s.schemaVersion,title:s.display.title,minutes:s.spec.minutes,goals:s.display.goals,sourceTitle:s.source.kind==='self_authored'?sourceText(s.source):'已保存题目：'+s.source.title+' · 同一题目版本',...(s.source.question?{sourceVersion:s.source.question.version}:{}),revision:s.revision,...(s.previousBundleId?{previousBundleId:s.previousBundleId}:{}),changed:s.changed,roles:s.files.map(f=>({fileId:f.fileId,role:f.fileId})),consistency:edited?'edited':'compiled',scope:'共用规格编译；非自然教学评审。浮力仅核对所声明模型，通用事实仍需教师核对。'};
}
