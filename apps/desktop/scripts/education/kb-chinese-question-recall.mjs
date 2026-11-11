import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {performance} from 'node:perf_hooks';
const {ensureQuestionRetrievalIndex,searchQuestionRows,questionSearchTokens,questionRetrievalWhere}=await import('../../src/main/education/question-retrieval.ts');
const db=new DatabaseSync(':memory:');
const sql={all:async(query,args=[])=>db.prepare(query).all(...args),run:async(query,args=[])=>db.prepare(query).run(...args)};
const checks=[];
const check=async(name,action)=>{await action();checks.push(name);console.log('PASS '+name);};
try{
 db.exec(`CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,subject TEXT,grade TEXT,question_type TEXT,difficulty TEXT,source_kind TEXT,stem TEXT,analysis TEXT,tags TEXT,knowledge_point TEXT,source_title TEXT,document_json TEXT,archive_json TEXT,updated_at TEXT)`);
 const put=(id,extra={})=>{const row={id,subject:'物理',grade:'高三',question_type:'选择题',difficulty:'easy',source_kind:'teacher_resource',stem:'两个单摆的周期相同，比较振幅。',analysis:'周期与摆长有关，振幅由初始条件确定。',tags:'[]',knowledge_point:'单摆的周期与振幅',source_title:'独立合成练习',document_json:'',archive_json:JSON.stringify({number:'7'}),updated_at:'2025-01-01',...extra};db.prepare('INSERT INTO question_bank_items VALUES('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row));};
 put('wanted');
 for(let i=0;i<90;i++)put('new-'+i,{stem:'不同天体的周期比较。',analysis:'绕转周期。',knowledge_point:'天体运动',updated_at:'2026-11-11'});
 put('other-grade',{grade:'初三'});put('other-subject',{subject:'数学'});put('other-number',{archive_json:JSON.stringify({number:'99'})});
 await ensureQuestionRetrievalIndex(sql);
 const scope={subject:'物理',grade:'高三',questionNumber:'7',limit:8};
 await check('Continuous Chinese words retrieve the intended question across non-contiguous source wording',async()=>{
  for(const query of ['单摆周期与振幅','单摆周期','单摆振幅']){
   const result=await searchQuestionRows(sql,{...scope,query},true);
   assert.equal(result.rows[0]?.id,'wanted',query);
  }
 });
 await check('Relevant old question remains first before LIMIT despite ninety newer partial matches',async()=>{
  for(const query of ['单摆 周期 振幅','单摆周期与振幅'])assert.equal((await searchQuestionRows(sql,{...scope,query,limit:1},true)).rows[0]?.id,'wanted');
 });
 await check('Metadata and exact source number remain hard conditions before ranking and LIMIT',async()=>{
  const result=await searchQuestionRows(sql,{...scope,query:'单摆周期与振幅',questionNumber:'99',limit:1},true);
  assert.deepEqual(result.rows.map(r=>r.id),['other-number']);
  assert.equal((await searchQuestionRows(sql,{...scope,query:'单摆周期',grade:'初一'},true)).rows.length,0);
 });
 await check('Indexed and explicit scan paths produce identical ordered Chinese candidates',async()=>{
  for(const query of ['单摆周期与振幅','周期','单摆 周期'])assert.deepEqual((await searchQuestionRows(sql,{...scope,query},true)).rows,(await searchQuestionRows(sql,{...scope,query},false)).rows);
 });
 put('literal',{stem:'保留20%、a_b、2.5的字面含义。',analysis:'',knowledge_point:'量纲'});
 await check('Literal percent, underscore, slashes, punctuation and single characters retain existing behavior',async()=>{
  for(const query of ['20%','a_b','2.5'])assert.deepEqual((await searchQuestionRows(sql,{...scope,query},true)).rows.map(r=>r.id),['literal']);
  assert.equal((await searchQuestionRows(sql,{...scope,query:'____'},true)).rows.length,0);
  assert.deepEqual(questionSearchTokens('a_b 20% 2.5 I=U/R'),['a_b','20%','2.5','I=U/R']);
 });
 await check('Unicode segmentation and SQL bindings remain bounded while the original query is preserved',async()=>{
  const tokens=questionSearchTokens('单摆周期与振幅');assert.equal(tokens[0],'单摆周期与振幅');assert(tokens.includes('单摆'));assert(tokens.includes('周期'));assert(tokens.includes('振幅'));
  const long='牛顿第二定律电功率速度时间图像'.repeat(10),expanded=questionSearchTokens(long);assert(expanded.length<=16);assert.equal(expanded[0],long);
  const predicate=questionRetrievalWhere({query:"单摆' OR 1=1 --"},true);assert(!predicate.clauses.join('').includes("' OR 1=1 --"));
  const astral=questionSearchTokens('𠀀𠀁周期');assert(astral.every(t=>!/[\uD800-\uDBFF]$/.test(t)&&!/^\uDC00/.test(t)));
 });
 await check('Existing FTS triggers and reinitialization keep current facts without a schema migration',async()=>{
  db.prepare('UPDATE question_bank_items SET stem=?,analysis=?,knowledge_point=? WHERE id=?').run('磁场中的带电粒子。','','洛伦兹力','wanted');
  assert(!(await searchQuestionRows(sql,{...scope,query:'单摆周期与振幅'},true)).rows.some(r=>r.id==='wanted'));
  assert.equal((await searchQuestionRows(sql,{...scope,query:'带电粒子'},true)).rows[0]?.id,'wanted');
  const before=JSON.stringify(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all());await ensureQuestionRetrievalIndex(sql);assert.equal(JSON.stringify(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all()),before);
  db.prepare('DELETE FROM question_bank_items WHERE id=?').run('wanted');assert.equal((await searchQuestionRows(sql,{...scope,query:'带电粒子'},true)).rows.length,0);
 });
 const started=performance.now();for(let i=0;i<20;i++)await searchQuestionRows(sql,{...scope,query:'周期与振幅'},true);
 console.log(JSON.stringify({passed:checks.length,checks,meanMs:(performance.now()-started)/20,scope:'Actual SQLite/FTS5 and production query/ranking, synthetic distractors. Separate actual Electron/DeepSeek evidence required.'}));
}finally{db.close();}
