import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createMistakeSimilarProvider} from '../../src/main/education/mistake-similar-provider.ts';
import {createQuestionContextProvider,questionVersion} from '../../src/main/education/question-context-provider.ts';
import {prepareQuestionAliases} from '../../src/main/education/question-aliases.ts';
import {validMistakeSimilarToolInput,MISTAKE_SIMILAR_TOOL} from '../../src/shared/mistake-similar-tool.ts';
import {validateEducationSessionIdentity} from '../../src/main/xiaozhi-agent/education-session-identity.ts';

export async function mistakeSimilarProviderBoundaries(check){
 const studentId='student_'+randomUUID(),sessionId='aisession_'+randomUUID(),recordId='record_'+randomUUID();
 const q=stem=>({id:'question_'+randomUUID(),stem,subject:'数学',grade:'八年级',knowledgePoint:'勾股定理',questionType:'解答题',difficulty:'medium',sourceTitle:'本地题库',sourceKind:'local_bank',answer:'参考答案',analysis:'参考解析，未独立核验',tags:[],createdAt:'2026-10-09',updatedAt:'2026-10-09'});
 const root=q('直角三角形直角边为3和4，求斜边。'),candidate=q('直角三角形直角边为5和12，求斜边。'),source=question=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId:question.id,version:questionVersion(question)}),receipt={digest:'c'.repeat(64),question:source(root)};
 const facts={subject:'数学',fingerprint:'f'.repeat(64),records:[{record:{id:recordId},version:'a'.repeat(64)},{record:{id:'record_'+randomUUID()},version:'b'.repeat(64)}],reviewVersion:0};
 const proof={facts,delivered:new Map([['学习证据1',{recordId,version:'a'.repeat(64)}]])},input={reference:'学习证据1',version:'a'.repeat(64)};
 const result={schemaVersion:'xiaozhi.mistake-similar.v1',receiptVersion:receipt.digest,method:'local_knowledge_keyword_v1',requested:10,scanned:2,scanComplete:true,excluded:{unsupported:0,missingAnswer:0,sourceUnavailable:0,rootOrDuplicate:0},answerVerified:false,items:[{question:candidate,source:source(candidate),reasons:['同一知识点']}]};
 const fresh=()=>{let selected=studentId,archived=false,active=true,currentProof=proof,changed=false,photo=receipt;const aliases=new Map(),read=new Map();
  const store={getAiConversationSession:async()=>({session:{studentId:selected,archivedAt:archived?'2026-10-09':undefined}}),studentContext:{learningSnapshot:async()=>({...facts,fingerprint:changed?'e'.repeat(64):facts.fingerprint})},mistakeFacts:{forRecord:async()=>photo},findMistakeSimilar:async()=>result,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text.replace('私密线索','[已脱敏]')}),getQuestionNotebookEntry:async id=>[root,candidate].find(q=>q.id===id),searchQuestionBank:async()=>[candidate]};
  const options={store,studentId,sessionId,current:()=>active,observed:()=>currentProof,aliases},tool=createMistakeSimilarProvider(options)[0],run=(args=input,signal=new AbortController().signal)=>tool.execute('call',args,signal),readTool=createQuestionContextProvider(store,()=>active,(reference,source)=>read.set(reference,source),aliases)[1];
  return{store,options,aliases,read,run,readTool,setSelected:v=>selected=v,setArchived:v=>archived=v,setActive:v=>active=v,setProof:v=>currentProof=v,setChanged:v=>changed=v,setPhoto:v=>photo=v};
 };
 await check('Related native tool accepts only delivered learning alias/version, rejects accessors and raw private identities',async()=>{
  assert(validMistakeSimilarToolInput(input));for(const v of[{...input,recordId},{...input,studentId},{...input,reference:recordId},{...input,version:'latest'}])assert(!validMistakeSimilarToolInput(v));const access={...input};Object.defineProperty(access,'reference',{enumerable:true,get(){throw Error('must not execute');}});assert(!validMistakeSimilarToolInput(access));
  const h=fresh();for(const args of[{...input,reference:'学习证据2',version:'b'.repeat(64)},{...input,version:'b'.repeat(64)},{...input,path:'private'}])assert.equal((await h.run(args)).isError,true);assert.equal(h.aliases.size,0);
 });
 await check('Candidate handoff creates stable real aliases, no read authority; existing read grants exact saved versions',async()=>{
  const h=fresh(),r=await h.run(),v=JSON.parse(r.content[0].text);assert.equal(v.success,true);assert.equal(v.shortage,true);assert.equal(v.root.reference,'题目1');assert.equal(v.questions[0].reference,'题目2');assert.equal(h.read.size,0);assert(!r.content[0].text.includes(recordId));assert(!r.content[0].text.includes(studentId));assert(!r.content[0].text.includes('参考答案'));
  const read=await h.readTool.execute('read',{reference:v.questions[0].reference,version:v.questions[0].version},new AbortController().signal);assert.equal(read.isError,undefined);assert.deepEqual(h.read.get('题目2'),source(candidate));assert.deepEqual(JSON.parse((await h.run()).content[0].text),v);
 });
 await check('Candidate tool rejects foreign, archived, expired and undeclared learning scope without partial aliases',async()=>{
  for(const change of[h=>h.setSelected('student_'+randomUUID()),h=>h.setArchived(true),h=>h.setActive(false),h=>h.setProof(undefined),h=>h.setChanged(true),h=>h.setPhoto(undefined)]){const h=fresh();change(h);assert((await h.run()).isError);assert.equal(h.aliases.size,0);}
 });
 await check('Final source/learning CAS and cancellation refuse late discovery and preserve existing aliases',async()=>{
  for(const kind of['source','scope','cancel']){const h=fresh(),abort=new AbortController();h.aliases.set('题目1',{id:'saved',version:'d'.repeat(64)});h.store.findMistakeSimilar=async()=>{if(kind==='source')h.setChanged(true);else if(kind==='scope')h.setProof({...proof});else abort.abort();return result;};assert((await h.run(input,abort.signal)).isError);assert.deepEqual([...h.aliases],[['题目1',{id:'saved',version:'d'.repeat(64)}]]);}
 });
 await check('Related discovery does not authorize forged reads and invalidates altered saved candidate versions',async()=>{
  const h=fresh();assert((await h.readTool.execute('r',{reference:'题目1',version:questionVersion(root)},new AbortController().signal)).isError);await h.run();h.store.getQuestionNotebookEntry=async id=>id===candidate.id?{...candidate,answer:'changed'}:root;assert((await h.readTool.execute('r',{reference:'题目2',version:questionVersion(candidate)},new AbortController().signal)).isError);assert.equal(h.read.size,0);
 });
 await check('Alias capacity failure leaves no partial mapping and shared search reuses the same immutable candidate alias',async()=>{
  const h=fresh();for(let i=1;i<=63;i++)h.aliases.set('题目'+i,{id:'existing'+i,version:'d'.repeat(64)});assert((await h.run()).isError);assert.equal(h.aliases.size,63);
  const a=new Map(),first=prepareQuestionAliases(a,[source(root),source(candidate)]);assert.equal(a.size,0);first.commit();const next=prepareQuestionAliases(a,[source(candidate)]);assert.deepEqual(next.references,['题目2']);next.commit();assert.equal(a.size,2);
  const good=fresh();await good.run();const search=createQuestionContextProvider(good.store,()=>true,undefined,good.aliases)[0];assert.equal(JSON.parse((await search.execute('s',{query:'三角形'},new AbortController().signal)).content[0].text).questions[0].reference,'题目2');
 });
 await check('Separate native related scope binds student and tool set, refuses removal and cross-branch authority changes',()=>{
  const scope={studentContext:{studentId,tools:[{name:'education_read_student_context'}]},studentLearning:{studentId,tools:[{name:'education_analyse_learning'}]},questionContextTools:[{name:'education_search_questions'},{name:'education_read_question'}],practiceReview:{studentId,tools:[{name:'education_propose_practice'},{name:'education_read_practice'}]},studentSimilar:{studentId,tools:[{name:MISTAKE_SIMILAR_TOOL}]}};
  const identity=validateEducationSessionIdentity(scope,[]);assert.equal(identity.similar.present,false);const entries=[{type:'custom',customType:'xiaozhi.education.mistake-similar.v1',data:identity.similar.data}];assert(validateEducationSessionIdentity(scope,entries).similar.present);
  assert.throws(()=>validateEducationSessionIdentity({...scope,studentSimilar:undefined},entries),/configuration/);assert.throws(()=>validateEducationSessionIdentity({...scope,studentSimilar:{...scope.studentSimilar,studentId:'student_'+randomUUID()}},entries),/configuration/);assert.throws(()=>validateEducationSessionIdentity({...scope,studentSimilar:{studentId,tools:[{name:'arbitrary'}]}},[]),/configuration/);assert.throws(()=>validateEducationSessionIdentity({...scope,practiceReview:undefined},[]),/configuration/);
 });
}
