import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {EventEmitter} from 'node:events';
import {MISTAKE_SIMILAR_SCHEMA,validMistakeSimilarInput} from '../../src/shared/mistake-similar.ts';
import {findMistakeSimilar} from '../../src/main/education/mistake-similar.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {registerMistakeSimilarIpc} from '../../src/main/students/mistake-similar-api.ts';

export async function mistakeSimilarBoundaries(check){
 const base={subject:'数学',grade:'八年级',knowledgePoint:'勾股定理',questionType:'解答题',difficulty:'medium',answer:'5厘米',analysis:'根据直角三角形条件计算。',sourceTitle:'本地教师题库',sourceKind:'local_bank',tags:[],createdAt:'2026-10-09',updatedAt:'2026-10-09'};
 const q=(n,patch={})=>({...base,id:'question_'+String(n).padStart(8,'0')+'-0000-0000-0000-000000000000',stem:`直角三角形两直角边为${n+3}和4，求斜边。`,...patch});
 const root=q(0),input={schemaVersion:MISTAKE_SIMILAR_SCHEMA,studentId:'student_'+randomUUID(),recordId:'record_'+randomUUID(),receiptVersion:'a'.repeat(64),requestId:randomUUID()};
 const receipt={digest:input.receiptVersion,question:{questionId:root.id,version:questionVersion(root)}};
 let questions=[root,...Array.from({length:210},(_,i)=>q(i+1,{knowledgePoint:'无关知识点',stem:`英文unrelated${i} plain${i}`})),...Array.from({length:12},(_,i)=>q(300+i))],revoked=false,changed=false;
 const host={facts:async(student,record)=>student===input.studentId&&record===input.recordId&&!revoked?{...receipt,...(changed?{digest:'b'.repeat(64)}:{})}:undefined,
  read:async id=>questions.find(q=>q.id===id),validate:async q=>{if(q.tags.includes('bad_source'))throw Error('source_changed');},
  page:async(subject,grade,after)=>questions.filter(q=>q.subject===subject&&q.grade===grade&&['local_bank','teacher_resource'].includes(q.sourceKind)&&q.id>after).sort((a,b)=>a.id<b.id?-1:1).slice(0,200).map(q=>({id:q.id,question:q}))};
 const signal=()=>new AbortController().signal,run=(h=host,i=input,s=signal())=>findMistakeSimilar(h,i,s);
 await check('Mistake related query rejects forged keys, getters, other schema, malformed identities and versions',async()=>{
  assert(validMistakeSimilarInput(input));for(const bad of[{...input,path:'secret'},{...input,receiptVersion:'latest'},{...input,studentId:'../'},{...input,requestId:''},{...input,schemaVersion:'v2'}])assert(!validMistakeSimilarInput(bad));
  const getter={...input};Object.defineProperty(getter,'recordId',{get(){throw Error('must-not-run');},enumerable:true});assert(!validMistakeSimilarInput(getter));
  await assert.rejects(run(host,{...input,path:'secret'}),/invalid_input/);
 });
 await check('Actual deterministic related search reaches beyond 200 rows, returns ten literal candidates without fake confidence',async()=>{
  const value=await run();assert.equal(value.items.length,10);assert.equal(value.scanned,223);assert(value.scanComplete);assert.equal(value.method,'local_knowledge_keyword_v1');assert(value.items.every(v=>v.reasons.includes('同一知识点')));assert(!JSON.stringify(value).includes('"score"'));assert.equal(value.answerVerified,false);assert.deepEqual(await run(),value);
 });
 await check('Hard subject/grade/source filters, root/content duplicates and incomplete answers are excluded',async()=>{
  const originals=questions;questions=[root,q(1,{...root,id:q(1).id}),q(2),q(3,{...q(2),id:q(3).id}),q(4,{grade:'九年级'}),q(5,{subject:'物理'}),q(6,{sourceKind:'generated'}),q(7,{answer:''}),q(8,{analysis:''}),q(9,{tags:['bad_source']}),q(10,{document:{schemaVersion:'broken'}})];
  const value=await run();assert.deepEqual(value.items.map(i=>i.question.id),[q(2).id]);assert.equal(value.excluded.rootOrDuplicate,3);assert.equal(value.excluded.missingAnswer,2);assert.equal(value.excluded.sourceUnavailable,1);assert.equal(value.excluded.unsupported,1);questions=originals;
 });
 await check('Empty bank candidates remain honest empty; same subject alone is insufficient',async()=>{const value=await run({...host,page:async()=>[]});assert.equal(value.items.length,0);assert.equal(value.requested,10);const orig=questions;questions=[root,q(8,{stem:'Unrelated banana',knowledgePoint:'其它'})];assert.equal((await run()).items.length,0);questions=orig;});
 await check('Archived/foreign mistake scope, old receipt and changed root cannot supply candidates',async()=>{
  await assert.rejects(run(host,{...input,studentId:'student_'+randomUUID()}),/permission_denied/);changed=true;await assert.rejects(run(),/source_changed/);changed=false;revoked=true;await assert.rejects(run(),/permission_denied/);revoked=false;
  await assert.rejects(run({...host,read:async id=>id===root.id?{...root,answer:'changed'}:host.read(id)}),/source_changed/);
 });
 await check('Cancellation before, during batch and after final scope read yields no partial late result',async()=>{
  const a=new AbortController();a.abort();await assert.rejects(run(host,input,a.signal));
  const b=new AbortController();await assert.rejects(run({...host,page:async(...args)=>{const p=await host.page(...args);b.abort();return p;}},input,b.signal));
  let calls=0;const c=new AbortController();await assert.rejects(run({...host,facts:async(...args)=>{const r=await host.facts(...args);if(++calls===2)c.abort();return r;}},input,c.signal));
 });
 await check('Candidate version change and final root lease revocation refuse stale Top10',async()=>{
  let reads=0;await assert.rejects(run({...host,read:async id=>{const v=await host.read(id);return ++reads>1?{...v,answer:'changed'}:v;}}),/source_changed/);
  let calls=0;await assert.rejects(run({...host,facts:async(...args)=>{const r=await host.facts(...args);return ++calls===2?undefined:r;}}),/permission_denied/);
  await assert.rejects(findMistakeSimilar(host,input,signal(),()=>false),/cancelled/);
 });
 await check('Typed related IPC rejects foreign frame/input and cancels only matching student/request',async()=>{
  const handlers=new Map(),sender=new EventEmitter();let started;const ready=new Promise(resolve=>started=resolve);
  const ipc=registerMistakeSimilarIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},allowed:event=>event.allowed===true,find:async(i,s)=>{started();return new Promise((_,reject)=>s.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}});
  assert.deepEqual(await handlers.get('mistakeSimilar:find')({allowed:false},input),{ok:false,error:'permission_denied'});assert.deepEqual(await handlers.get('mistakeSimilar:find')({allowed:true},{...input,path:'secret'}),{ok:false,error:'invalid_input'});
  const work=handlers.get('mistakeSimilar:find')({allowed:true,sender},input);await ready;assert.deepEqual(await handlers.get('mistakeSimilar:find')({allowed:true,sender},input),{ok:false,error:'busy'});
  handlers.get('mistakeSimilar:cancel')({allowed:true},{...input,studentId:'student_'+randomUUID()});assert.equal(sender.listenerCount('destroyed'),1);handlers.get('mistakeSimilar:cancel')({allowed:true},input);assert.deepEqual(await work,{ok:false,error:'cancelled'});assert.equal(sender.listenerCount('destroyed'),0);await ipc.close();assert.deepEqual(await handlers.get('mistakeSimilar:find')({allowed:true,sender},input),{ok:false,error:'cancelled'});
 });
}
