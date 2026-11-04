import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fixture} from './kb-book-match-boundaries.mjs';
import {MaterialBookAnswerRepository} from '../../src/main/assets/material-book-answer-repository.ts';
import {bookAnswerPage} from '../../src/main/assets/material-book-answer-content.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
const sha=x=>createHash('sha256').update(x).digest('hex'),section='第十三、十四章 素养基础测试卷';
export function fixture2(options={}){
 const f=fixture({...options,answerText:options.answerText??'2. D 解析：这是答案册的完整解析。'});
 const q=f.proofs.get(f.batch),a=f.proofs.get(f.answerBatch);
 for(const pass of ['first','final']){q[pass]=structuredClone(q[pass]);q[pass].pageText=section+'\n2. '+q[pass].questions[0].stem;q[pass].questions[0].number='2';}
 for(const pass of ['first','final'])q[pass+'Sha']=sha(JSON.stringify(q[pass]));
 a.unit.pageSource.page=2;
 for(const [id,p]of [[f.batch,q],[f.answerBatch,a]]){
  f.db.prepare('UPDATE material_ai_units SET input_json=? WHERE batch_id=?').run(JSON.stringify({page:p.unit.pageSource.page,bookRole:p.unit.bookRole}),id);
  f.db.prepare('UPDATE material_ai_page_units SET final_sha=? WHERE batch_id=?').run(p.finalSha,id);
 }
 const saved=f.db.prepare('SELECT archive_json FROM question_bank_items').get(),archive=JSON.parse(saved.archive_json);archive.number='2';archive.ai.firstSha=q.firstSha;archive.ai.finalSha=q.finalSha;
 f.db.prepare('UPDATE question_bank_items SET archive_json=?').run(JSON.stringify(archive));f.db.prepare("UPDATE material_ai_members SET number='2'").run();
 return f;
}
export function add(f,page,text=section+'\n1. A 解析：前题的完整解析。',options={}){
 const id='aibatch_'+randomUUID(),p=structuredClone(f.proofs.get(f.answerBatch));
 p.unit.pageSource={...p.unit.pageSource,page,...options.source};if(options.kind)p.unit.bookRole.kind=options.kind;
 p.first={...p.first,pageText:options.first??text,pageIssues:options.issues??[]};p.final={...p.first,pageText:text};
 for(const pass of ['first','final'])p[pass+'Sha']=sha(JSON.stringify(p[pass]));p.imageSha=sha(id);
 if(!options.invalid)f.proofs.set(id,p);
 f.db.prepare('INSERT INTO material_ai_batches(id,resource_id,version) VALUES(?,?,?)').run(id,p.unit.pageSource.resourceId,p.unit.pageSource.version);
 f.db.prepare('INSERT INTO material_ai_units(batch_id,ordinal,input_json,status) VALUES(?,1,?,?)').run(id,JSON.stringify({page,bookRole:p.unit.bookRole}),'no_questions');
 f.db.prepare('INSERT INTO material_ai_page_units VALUES(?,1,?)').run(id,p.finalSha);return id;
}
export async function index(f){let steps=0;while(await f.repo.indexOne())assert(++steps<1500,'index propagation must terminate');return steps;}
async function init(f){await f.repo.migrate();await f.repo.migrate();await index(f);}
async function use(options,fn){const f=fixture2(options);try{await fn(f);}finally{f.db.close();}}
async function missing(f){const before=questionVersion(await f.read()),v=await f.match();assert.equal(v.rows[0].reason,'answer_not_found');assert.equal(questionVersion(await f.read()),before);}
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('Titleless answer pages inherit exact preceding scope across batches, retain literal offsets and remain valid after cold construction',()=>use({},async f=>{
 const prior=add(f,1),original=JSON.stringify([...f.proofs]);await init(f);const view=await f.match();assert.equal(view.rows[0].state,'applied');assert.equal(view.rows[0].source.page,2);assert.equal(view.rows[0].source.sectionPage,1);
 const journal=f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get(),e=JSON.parse(journal.evidence_json);assert.equal(e.answerSection.schemaVersion,'xiaozhi.book-answer-section-context.v1');assert.equal(e.answerSection.pages[0].batchId,prior);assert.equal(e.answer.start,0);
 const derived=await f.repo.sections.answerPage(f.proofs.get(f.answerBatch));assert.equal(derived.page.policy,'section-number-inherited.v1');assert.equal(derived.page.entries[0].quote,f.proofs.get(f.answerBatch).final.pageText);
 assert.equal((await f.read()).archive.analysisOrigin,'book_extracted');await new MaterialBookAnswerRepository(f.host).validate(await f.read());assert.equal(JSON.stringify([...f.proofs]),original);await f.match();assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,1);
}));
await check('The inherited parser stops at unsupported boundaries and explicit local titles override the preceding chapter without changing raw policy',()=>use({},async f=>{
 const p=f.proofs.get(f.answerBatch),text=p.final.pageText+'\n试卷二\n3. B 解析：另一份试卷。\n第十五章 素养基础测试卷\n1. C 解析：新章。';
 const raw=bookAnswerPage({...p.first,pageText:text},{...p.final,pageText:text}),derived=bookAnswerPage({...p.first,pageText:text},{...p.final,pageText:text},section);
 assert.equal(raw.entries[0].section,'');assert.equal(derived.entries[0].section,section);assert.equal(derived.entries[1].section,'');assert.equal(derived.entries[2].section,'第十五章 素养基础测试卷');assert.equal(derived.entries[0].quote,text.slice(derived.entries[0].start,derived.entries[0].end).trim());assert.equal(derived.entries[0].start,raw.entries[0].start);assert(raw.entries[0].quote.endsWith('试卷二'),'Legacy raw spans keep their existing boundary semantics');
}));
await check('Local exact title uses no inherited journal proof, while a different chapter with the same number never pairs',async()=>{
 await use({answerText:section+'\n2. D 解析：这是答案册的完整解析。'},async f=>{add(f,1,'第十五章 素养基础测试卷');await init(f);assert.equal((await f.match()).rows[0].state,'applied');assert(!JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json).answerSection);});
 await use({},async f=>{add(f,1,'第十五章 素养基础测试卷\n1. A 解析：另一章。');await init(f);await missing(f);});
});
await check('Gaps, generation/version/resource/role mismatch, uncertain pages and either-pass title/number disagreement stop inheritance',async()=>{
 for(const mode of ['gap','generation','version','resource','role','uncertain','title','number','current-boundary'])await use({},async f=>{
  const options=mode==='generation'?{source:{generation:randomUUID()}}:mode==='version'?{source:{version:sha('other')}}:mode==='resource'?{source:{resourceId:'resource_'+randomUUID()}}:mode==='role'?{kind:'questions'}:mode==='uncertain'?{issues:['uncertain_ocr']}:mode==='title'?{first:'第十五章 素养基础测试卷\n1. A 解析：前题。'}:mode==='number'?{first:section+'\n3. A 解析：前题。'}:{};
  if(mode==='gap'){f.proofs.get(f.answerBatch).unit.pageSource.page=3;f.db.prepare('UPDATE material_ai_units SET input_json=? WHERE batch_id=?').run(JSON.stringify({page:3,bookRole:f.proofs.get(f.answerBatch).unit.bookRole}),f.answerBatch);}
  if(mode==='current-boundary')for(const pass of ['first','final'])f.proofs.get(f.answerBatch)[pass]={...f.proofs.get(f.answerBatch)[pass],pageText:'第二套试卷\n2. D 解析：这是答案册的完整解析。'};
  add(f,1,undefined,options);await init(f);await missing(f);
 });
});
await check('Repeating or decreasing question numbers and unknown exam headings cannot silently inherit the previous answer chapter',async()=>{
 for(const text of [section+'\n2. A 解析：同号。',section+'\n9. A 解析：回退。',section+'\n第二章 电学\n1. A 解析：未知章。','八年级物理期末测试卷\n1. A 解析：未知卷。'])await use({},async f=>{add(f,1,text);await init(f);assert(!await f.repo.sections.resolveAnswer(f.proofs.get(f.answerBatch)));const before=questionVersion(await f.read());assert.equal((await f.match()).rows[0].state,'held');assert.equal(questionVersion(await f.read()),before);});
});
await check('A late answer header reindexes a held downstream answer and wakes the existing matcher without model replay',()=>use({},async f=>{
 await init(f);await missing(f);await f.repo.work.finish(f.batch,1,1);assert(!await f.repo.work.next());add(f,1);const steps=await index(f);assert(steps<=4);assert(await f.repo.work.next());await f.drain();assert.equal((await f.read()).archive.answerOrigin,'book_extracted');await f.repo.validate(await f.read());
}));
await check('Changed, empty, invalid, deleted and pending newer headers revoke old inherited evidence without reviving history',async()=>{
 for(const mode of ['changed','empty','invalid','deleted','pending'])await use({},async f=>{
  add(f,1);await init(f);await f.match();const q=await f.read(),id=add(f,1,mode==='changed'?'第十五章 素养基础测试卷':'1. A 解析：没有标题。',{invalid:mode==='invalid'});
  if(mode==='pending'){await assert.rejects(f.repo.validate(q),/source_incomplete/);return;}
  await index(f);if(mode==='deleted'){f.db.prepare('DELETE FROM material_ai_page_units WHERE batch_id=?').run(id);f.proofs.delete(id);await index(f);}
  assert.equal((await f.repo.index.find(f.pair.answerId,f.pair.answerVersion,section.replace(/\s/g,''),'2')).length,0);await assert.rejects(f.repo.validate(q),/source_changed/);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM material_book_answer_journal_v1 WHERE after_json<>''").get().n,1);
 });
});
await check('An invalid successor of an explicit local answer still suppresses older cached answers',()=>use({answerText:section+'\n2. D 解析：这是答案册的完整解析。'},async f=>{
 await init(f);add(f,2,'',{invalid:true});await index(f);await missing(f);
}));
await check('Superseding or deleting the selected answer page also revokes its inherited journal, not only changes to its header',async()=>{
 for(const mode of ['successor','deleted'])await use({},async f=>{add(f,1);await init(f);await f.match();const q=await f.read();if(mode==='successor')add(f,2,'',{invalid:true});else f.db.prepare('DELETE FROM material_ai_page_units WHERE batch_id=?').run(f.answerBatch);await index(f);await assert.rejects(f.repo.validate(q),/source_changed/);});
});
await check('Layout-only title whitespace is normalized consistently by exact lookup and saved-role reads',()=>use({},async f=>{add(f,1,section.replace(' ','  \t')+'\n1. A 解析：前题。');await init(f);assert.equal((await f.match()).rows[0].state,'applied');await f.repo.validate(await f.read());}));
await check('Stored answer context corruption fails cold reads while teacher and source roles remain protected',async()=>{
 for(const field of ['schemaVersion','firstSha','imageSha','generation','section'])await use({},async f=>{add(f,1);await init(f);await f.match();const saved=f.db.prepare('SELECT id,evidence_json FROM material_book_answer_journal_v1').get(),e=JSON.parse(saved.evidence_json);if(field==='generation')e.answerSection.pages[0].source.generation=randomUUID();else if(['firstSha','imageSha'].includes(field))e.answerSection.pages[0][field]='f'.repeat(64);else e.answerSection[field]='forged';f.db.prepare('UPDATE material_book_answer_journal_v1 SET evidence_json=? WHERE id=?').run(JSON.stringify(e),saved.id);await assert.rejects(f.repo.validate(await f.read()),/source_changed/);});
 for(const origin of ['teacher','source'])await use({origin},async f=>{add(f,1);await init(f);await f.match();assert.equal((await f.read()).archive.answerOrigin,origin);});
 await use({currentAnswer:'B'},async f=>{add(f,1);await init(f);assert.equal((await f.match()).rows[0].reason,'existing_answer_conflict');});
});
await check('Local answer doubts and first/final disagreement still hold the candidate',async()=>{
 for(const mode of ['uncertain','disagreement'])await use({issues:mode==='uncertain'?['uncertain_ocr']:[]},async f=>{add(f,1);if(mode==='disagreement'){const p=f.proofs.get(f.answerBatch);p.first={...p.first,pageText:'2. B 解析：不同答案。'};}await init(f);assert.equal((await f.match()).rows[0].reason,'answer_unchecked');assert.equal((await f.read()).archive.answerOrigin,'ai_generated');});
});
await check('Raw dirty invalidation wins collisions and context-only work never recursively fans out',()=>use({},async f=>{
 for(let page=3;page<=35;page++)add(f,page,'连续答案资料。');await init(f);const far=f.db.prepare('SELECT batch_id FROM material_book_answer_index_v1 WHERE page=35 AND start=-1').get();
 add(f,1);f.db.prepare('UPDATE material_ai_page_units SET final_sha=final_sha WHERE batch_id=?').run(f.answerBatch);assert(await f.repo.indexOne());
 const raw=f.db.prepare('SELECT * FROM material_book_answer_dirty_v1 WHERE batch_id=?').get(f.answerBatch);assert.equal(raw.context_only,0);
 assert(!f.db.prepare('SELECT * FROM material_book_answer_dirty_v1 WHERE batch_id=?').get(far.batch_id));const steps=await index(f);assert(steps<=34);assert(!await f.repo.index.pending());
 const triggers=f.db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'material_book_answer_%'").all();assert.equal(triggers.length,6);assert(triggers.every(t=>t.name.endsWith('_v2')));
}));
await check('The answer context budget is exactly 32 contiguous pages and cannot jump farther',async()=>{
 for(const distance of [32,33])await use({},async f=>{const p=f.proofs.get(f.answerBatch);p.unit.pageSource.page=40;f.db.prepare('UPDATE material_ai_units SET input_json=? WHERE batch_id=?').run(JSON.stringify({page:40,bookRole:p.unit.bookRole}),f.answerBatch);for(let n=1;n<=distance;n++)add(f,40-n,n===distance?section:'连续的答案资料。');await init(f);const v=await f.match();assert.equal(v.rows[0].state,distance===32?'applied':'held');if(distance===32)assert.equal(JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json).answerSection.pages.length,32);});
});
await check('Stopping new inheritance preserves saved role readers; cancellation and a prepublication context race roll back all facts',async()=>{
 await use({},async f=>{add(f,1);const old=process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE;try{process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE='0';await init(f);await missing(f);delete process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE;await f.repo.rebuild();await index(f);await f.match();process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE='0';await f.repo.validate(await f.read());await f.repo.rebuild();await index(f);await f.repo.validate(await f.read());}finally{old===undefined?delete process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE:process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE=old;}});
 await use({},async f=>{const id=add(f,1);await init(f);const before=questionVersion(await f.read()),validate=f.repo.sections.validateAnswer.bind(f.repo.sections);let n=0;f.repo.sections.validateAnswer=async(...args)=>{await validate(...args);if(++n===1)f.proofs.get(id).finalSha='f'.repeat(64);};await assert.rejects(f.match(),/source_changed/);assert.equal(questionVersion(await f.read()),before);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,0);const c=new AbortController();c.abort();await assert.rejects(f.repo.match(f.input,c.signal));});
});
await check('Legacy derived schemas upgrade once, retain raw pending work and rebuild without altering saved AI receipts',()=>use({},async f=>{
 f.db.exec('CREATE TABLE material_book_answer_control_v1(id INTEGER PRIMARY KEY CHECK(id=1),cursor INTEGER NOT NULL,section_policy INTEGER NOT NULL DEFAULT 1);INSERT INTO material_book_answer_control_v1 VALUES(1,999,1);CREATE TABLE material_book_answer_dirty_v1(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(batch_id,ordinal))');
 f.db.prepare('INSERT INTO material_book_answer_dirty_v1 VALUES(?,1,7)').run(f.answerBatch);add(f,1);const original=JSON.stringify([...f.proofs]);await f.repo.migrate();assert.equal(f.db.prepare('SELECT context_only FROM material_book_answer_dirty_v1 WHERE batch_id=?').get(f.answerBatch).context_only,0);assert.equal(f.db.prepare('SELECT section_policy FROM material_book_answer_control_v1').get().section_policy,3);await index(f);const cursor=f.db.prepare('SELECT cursor FROM material_book_answer_control_v1').get().cursor;await f.repo.migrate();assert.equal(f.db.prepare('SELECT cursor FROM material_book_answer_control_v1').get().cursor,cursor);await f.match();await f.repo.rebuild();await index(f);await f.repo.validate(await f.read());assert.equal(JSON.stringify([...f.proofs]),original);
}));
console.log(JSON.stringify({success:true,checks,scope:'Real SQLite writer/index/invalidation/migrations with controlled receipts; imports 21 legacy match checks. No cloud, natural accuracy or 40GiB claim.'}));
