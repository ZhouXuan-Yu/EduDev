import {analyzeBuoyancy} from '../../shared/buoyancy';
import {prepareHtmlArtifact} from '../../shared/html-artifact';
import type {FileCheckRules,CheckFileInput} from '../../shared/xiaozhi-delivery-checks';
import {compileScienceLesson,type LessonSnapshot} from './science-lesson';

/** Preserve the actual lesson model/provenance while repairing only its executable HTML. */
export function lessonDemoRepair(lesson:LessonSnapshot,content:unknown):string{
 if(typeof content!=='string'||Buffer.byteLength(content)>65536)throw Error('invalid_input');
 const canonical=compileScienceLesson(lesson.spec,lesson.source,'repair').files.find(f=>f.fileId==='demo');
 if(!canonical||canonical.kind!=='text')throw Error('configuration');
 const provenance=canonical.content.match(/<section id="lesson-provenance">[\s\S]*?<\/section>/)?.[0];
 const data=canonical.content.match(/<script id="buoyancy-data"[^>]*>[\s\S]*?<\/script>/)?.[0];
 if(!provenance||!content.includes(provenance)||data&&!content.includes(data))throw Error('lesson_repair_mismatch');
 return prepareHtmlArtifact(content);
}
export function lessonDemoRules(lesson:LessonSnapshot):FileCheckRules{
 if(lesson.spec.demo.kind!=='buoyancy')return{};
 const model=lesson.spec.demo.model,result=analyzeBuoyancy(model);if(result.state!=='calculated'||!result.values)throw Error('configuration');
 const mapping={volume:'volume',mass:'mass',weight:'weight',buoyancy:'buoyancy',maximum:'maximumBuoyancy',downward:'totalDownwardForce',net:'netDownwardForce',support:'supportForce',immersed:'immersedHeight',emerged:'emergedHeight',displaced:'displacedVolume',critical:'criticalLoad'} as const;
 const numbers=Object.entries(mapping).flatMap(([selector,key])=>{const q=result.values![key];return q?[{id:'lesson_'+selector,source:{kind:'selector' as const,selector:'#'+selector},expected:Number(q.decimal),unit:q.unit==='m^3'?'m³':q.unit,tolerance:1e-6}]:[];});
 const initial=Number(result.values.load!.decimal),different=initial<6?Math.min(6,initial+1):Math.max(0,initial-1);
 return{numbers,interactions:[{id:'lesson_load_reset',actions:[{kind:'set',selector:'#load-number',value:String(different)},{kind:'click',selector:'#reset'}],observe:'#net',expectedNumber:Number(result.values.netDownwardForce!.decimal),tolerance:1e-6}]};
}
/** Host-owned obligations are merged after supplied rules; they cannot be dropped by a repair. */
export function lessonChecks(lesson:LessonSnapshot,files:{fileId:string;path:string}[],declared:CheckFileInput[]=[]):CheckFileInput[]{
 const demo=files.find(f=>f.fileId==='demo');if(!demo)throw Error('configuration');const mandatory=lessonDemoRules(lesson),existing=declared.find(c=>c.path===demo.path)?.rules||{};
 for(const key of ['numbers','interactions'] as const)if(existing[key]?.some(r=>r.id.startsWith('lesson_')&&!mandatory[key]?.some(m=>JSON.stringify(m)===JSON.stringify(r))))throw Error('invalid_input');
 return[...declared.filter(c=>c.path!==demo.path),{path:demo.path,rules:{...existing,numbers:[...(existing.numbers||[]).filter(r=>!r.id.startsWith('lesson_')),...(mandatory.numbers||[])],interactions:[...(existing.interactions||[]).filter(r=>!r.id.startsWith('lesson_')),...(mandatory.interactions||[])]}}];
}
