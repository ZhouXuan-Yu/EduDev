import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {StudentContextRepository} from '../../src/main/students/context-repository.ts';
import {createStudentContextProvider} from '../../src/main/education/student-context-provider.ts';
import {getStudentContextSource,createStudentConversation} from '../../src/main/students/context-service.ts';
import {validStudentConversation,validStudentContextQuery,validStudentContextSource,STUDENT_CONTEXT_SCHEMA} from '../../src/shared/student-context.ts';
import {createPiXiaozhiSession} from '../../src/main/xiaozhi-agent/pi-session.ts';
import {createStudentContextSanitizer} from '../../src/main/students/context-sanitizer.ts';
/** Extend the unified boundary runner; never a separate agent/test runtime. */
export async function studentContextBoundaries(check,output,options,prime){
 const db=new DatabaseSync(':memory:');let agent,current=true,binding,archived=false,reads=0;
 const a='student_'+randomUUID(),b='student_'+randomUUID(),sessionId='aisession_'+randomUUID();binding=a;
 db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,display_name TEXT,real_name TEXT,school TEXT,grade TEXT,subjects TEXT,goals TEXT,current_issues TEXT,parent_concerns TEXT,teacher_notes TEXT,tags TEXT,status TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE learning_records(id TEXT PRIMARY KEY,student_id TEXT,record_type TEXT,subject TEXT,title TEXT,content TEXT,summary TEXT,tags TEXT,occurred_at TEXT,created_at TEXT,updated_at TEXT);`);
 for(const[id,name]of[[a,'合成隐私甲'],[b,'乙']])db.prepare('INSERT INTO students VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,name,name,'合成私密学校','初二','["数学"]','只记录教学目标','核对基础概念','不可上传的家长字段','不可上传的私密备注','[]','active','2026-10-05','2026-10-05');
 const put=(studentId,index)=>{const id='record_'+randomUUID();db.prepare('INSERT INTO learning_records VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,studentId,index%2?'mistake':'score','数学','实际记录'+index,`合成隐私甲 乙 合成私密学校 联系13800138000 secret@example.com 路径D:\\private\\secret 证据${index}`,'','[]',new Date(1791180000000+index*1000).toISOString(),'2026-10-05','2026-10-05');return id;};
 const ids=Array.from({length:23},(_,i)=>put(a,i));put(b,99);
 const mapStudent=r=>({id:r.id,displayName:r.display_name,realName:r.real_name,school:r.school,grade:r.grade,subjects:JSON.parse(r.subjects),goals:r.goals,currentIssues:r.current_issues,parentConcerns:r.parent_concerns,teacherNotes:r.teacher_notes,tags:[],status:r.status,createdAt:r.created_at,updatedAt:r.updated_at,recordCount:r.record_count,attachmentBytes:0});
 const mapRecord=r=>({id:r.id,studentId:r.student_id,recordType:r.record_type,subject:r.subject,title:r.title,content:r.content,summary:r.summary,tags:[],occurredAt:r.occurred_at,createdAt:r.created_at,updatedAt:r.updated_at,attachments:[]});
 const repo=new StudentContextRepository({all:async(sql,params)=>{reads++;return db.prepare(sql).all(...params);},mapStudent,mapRecord});
 const store={studentContext:repo,listStudents:async()=>db.prepare('SELECT * FROM students').all().map(mapStudent),sanitizeProblemText:async text=>({sanitizedText:text.replace(/13800138000/g,'[手机号]').replace(/secret@example.com/g,'[邮箱]')}),getAiConversationSession:async()=>({session:{studentId:binding,archivedAt:archived?'now':null}}),createAiConversationSession:async input=>({session:input})};
 const tools=createStudentContextProvider(store,sessionId,a,()=>current),read=async args=>tools[0].execute('call',args,new AbortController().signal),payload=r=>JSON.parse(r.content[0].text);
 try{
  await check('Student inputs reject scope override, accessors, symbols and invalid IDs before SQL reads',async()=>{
   let touched=false;for(const value of [{studentId:b},{name:'乙'},{sql:'SELECT *'},{path:'D:/private'},{offset:.5},{offset:-1},{keyword:'x'.repeat(129)},Object.defineProperty({},'keyword',{get(){touched=true;return'x';},enumerable:true}),{[Symbol('extra')]:1}]){assert(!validStudentContextQuery(value));assert.equal((await read(value)).details.error.code,'invalid_input');}assert.equal(reads,0);assert.equal(touched,false);assert(!validStudentConversation({schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:'../../private'}));
  });
  await check('One SQLite snapshot paginates all actual matching records with exact count, order and student isolation',async()=>{
   const first=payload(await read({})),second=payload(await read({offset:10})),last=payload(await read({offset:20}));assert.equal(first.total,23);assert.equal(first.records.length,10);assert.equal(first.nextOffset,10);assert.equal(second.nextOffset,20);assert.equal(last.records.length,3);assert.equal(last.nextOffset,null);assert(!JSON.stringify(first).includes('证据99'));assert.equal(first.records[0].title,'实际记录22');assert.equal(payload(await read({type:'mistake'})).total,11);assert.equal(payload(await read({keyword:'证据1'})).total,11);assert.equal((await read({offset:23})).details.error.code,'invalid_input');assert.equal(payload(await read({subject:'英语'})).records.length,0);
  });
  await check('Student tool content removes names including single character, schools, contacts, local paths and private fields',async()=>{
   const text=(await read({})).content[0].text;for(const secret of ['合成隐私甲','乙','合成私密学校','13800138000','secret@example.com','D:\\private','家长字段','私密备注',a,b,sessionId])assert(!text.includes(secret),secret);assert.equal(payload(await read({})).profile.student,'当前学生');
  });
  await check('Cloud prompt keeps HTTP/HTTPS public URLs while still masking drives, file paths and personal data',async()=>{
   const sanitize=await createStudentContextSanitizer(store),urls=['https://api-docs.deepseek.com/zh-cn/','http://www.moe.gov.cn/a/b','https://example.org/doc?q=teaching'];
   for(const url of urls)assert.equal(await sanitize(url),url);
   const text=await sanitize('路径D:\\private\\secret C:/private/file file:///E:/private/test 合成隐私甲 合成私密学校 13800138000 secret@example.com');
   for(const secret of ['D:\\private','C:/private','E:/private','合成隐私甲','合成私密学校','13800138000','secret@example.com'])assert(!text.includes(secret),secret);
   assert.equal((text.match(/\[本地路径\]/g)||[]).length,3);
  });
  await check('Only selected record sources open current versions; cross-student, stale and arbitrary source fields fail',async()=>{
   const result=await read({}),source=result.details.data.sources[1].student;assert(validStudentContextSource(source));assert(!validStudentContextSource({...source,studentId:b}));assert.equal((await getStudentContextSource(store,source)).record.id,ids[22]);const old=db.prepare('SELECT content FROM learning_records WHERE id=?').get(ids[22]).content;db.prepare('UPDATE learning_records SET content=? WHERE id=?').run('changed',ids[22]);await assert.rejects(getStudentContextSource(store,source),/source_changed/);db.prepare('UPDATE learning_records SET content=? WHERE id=?').run(old,ids[22]);binding=b;await assert.rejects(getStudentContextSource(store,source),/source_changed/);binding=a;
  });
  await check('Revoked task, cancelled request, archived student/session and no selection do not deliver facts',async()=>{
   current=false;assert.equal((await read({})).details.error.code,'permission_denied');current=true;binding=b;assert.equal((await read({})).details.error.code,'permission_denied');binding=a;archived=true;assert.equal((await read({})).details.error.code,'permission_denied');archived=false;db.prepare('UPDATE students SET status=? WHERE id=?').run('archived',a);assert.equal((await read({})).details.error.code,'student_unavailable');await assert.rejects(createStudentConversation(store,{schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:a}),/student_unavailable/);db.prepare('UPDATE students SET status=? WHERE id=?').run('active',a);const abort=new AbortController();abort.abort();assert.equal((await tools[0].execute('cancel',{},abort.signal)).details.error.code,'cancelled');assert.equal((await createStudentContextProvider(store,sessionId,'',()=>true)[0].execute('none',{},new AbortController().signal)).details.error.code,'no_student');
  });
  await check('Concurrent fact change and oversized records fail explicitly without partial success payload',async()=>{
   const original=repo.snapshot.bind(repo);let n=0;repo.snapshot=async(...args)=>{const value=await original(...args);if(++n===2)value.fingerprint='changed';return value;};assert.equal((await read({})).details.error.code,'source_changed');repo.snapshot=original;const old=db.prepare('SELECT content FROM learning_records WHERE id=?').get(ids[22]).content;db.prepare('UPDATE learning_records SET content=? WHERE id=?').run('x'.repeat(8001),ids[22]);const failure=await read({});assert.equal(failure.details.error.code,'too_large');assert(!failure.details.data);db.prepare('UPDATE learning_records SET content=? WHERE id=?').run(old,ids[22]);
  });
  await check('Independent student native identity preserves older history and rejects changed or removed student scope',async()=>{
   const root=path.join(output,'student-native');fs.mkdirSync(root);agent=await createPiXiaozhiSession({...options,stateRoot:root});await prime(agent);const file=agent.session.sessionManager.getSessionFile(),prefix=fs.readFileSync(file);await agent.dispose();agent=undefined;
   agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,studentContext:{studentId:a,tools}});assert(fs.readFileSync(file).subarray(0,prefix.length).equals(prefix));assert(agent.session.getActiveToolNames().includes('education_read_student_context'));await agent.dispose();agent=undefined;
   await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,studentContext:{studentId:b,tools}}),/configuration/);await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file}),/configuration/);
  });
 }finally{await agent?.dispose();db.close();}
}
