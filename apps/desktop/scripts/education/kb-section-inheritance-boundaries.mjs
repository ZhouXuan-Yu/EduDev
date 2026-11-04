import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fixture} from './kb-book-match-boundaries.mjs';
import {MaterialBookAnswerRepository} from '../../src/main/assets/material-book-answer-repository.ts';
import {BOOK_SECTION_LOOKBACK} from '../../src/main/assets/material-book-question-section.ts';
import {bookSectionAt} from '../../src/main/assets/material-book-answer-content.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
const sha=x=>createHash('sha256').update(x).digest('hex'),section='第十三、十四章 素养基础测试卷';
function syncCurrent(f,text,first=text){
 const proof=f.proofs.get(f.batch),q=f.db.prepare('SELECT archive_json FROM question_bank_items WHERE id=?').get(f.questionId),archive=JSON.parse(q.archive_json);
 proof.first={...proof.first,pageText:first};proof.final={...proof.final,pageText:text};
 proof.firstSha=sha(JSON.stringify(proof.first));proof.finalSha=sha(JSON.stringify(proof.final));
 archive.ai.firstSha=proof.firstSha;archive.ai.finalSha=proof.finalSha;
 archive.pageSource=structuredClone(proof.unit.pageSource);
 f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(archive),f.questionId);
 f.db.prepare('UPDATE material_ai_page_units SET final_sha=? WHERE batch_id=?').run(proof.finalSha,f.batch);
 f.db.prepare('UPDATE material_ai_units SET input_json=? WHERE batch_id=?').run(JSON.stringify({page:proof.unit.pageSource.page}),f.batch);
}
function addPage(f,page,text,options={}){
 const id='aibatch_'+randomUUID(),proof=structuredClone(f.proofs.get(f.batch));
 proof.unit.pageSource={...proof.unit.pageSource,page,...options.source};
 proof.first={...proof.first,questions:[],outcome:'no_questions',pageText:options.first??text,pageIssues:options.issues??[]};
 proof.final={...proof.first,pageText:text};proof.firstSha=sha(JSON.stringify(proof.first));proof.finalSha=sha(JSON.stringify(proof.final));proof.imageSha=sha(id);
 f.proofs.set(id,proof);f.db.prepare('INSERT INTO material_ai_batches VALUES(?,?,?)').run(id,proof.unit.pageSource.resourceId,proof.unit.pageSource.version);
 f.db.prepare('INSERT INTO material_ai_units VALUES(?,1,?,?)').run(id,JSON.stringify({page}),'no_questions');
 f.db.prepare('INSERT INTO material_ai_page_units VALUES(?,1,?)').run(id,proof.finalSha);return id;
}
async function index(f){let n=0;while(await f.repo.indexOne())assert(++n<200);}
async function use(options,fn){const f=fixture(options);try{const stem=(await f.read()).stem;syncCurrent(f,'1. '+stem);await fn(f,stem);}finally{f.db.close();}}
async function init(f){await f.repo.migrate();await f.repo.migrate();await index(f);}
async function held(f){const before=questionVersion(await f.read()),v=await f.match();assert.equal(v.rows[0].reason,'missing_section');assert.equal(questionVersion(await f.read()),before);}
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('Title scope distinguishes absent, exact and unsupported chapter boundaries',async()=>{
 assert.equal(bookSectionAt('1. 一道题。'),undefined);assert.equal(bookSectionAt(section+'\n1. 一道题。'),section);
 assert.equal(bookSectionAt(section+'\n第二章 电学\n1. 另一道题。'),'');
 assert.equal(bookSectionAt('第十三章\n基础测试卷\n1. 一道题。'),'第十三章 基础测试卷');
});
await check('A contiguous same-generation earlier page supplies a source-bound title, writes known roles and remains readable after cold repository construction',()=>use({},async f=>{
 const id=addPage(f,3,section);await init(f);const original=JSON.stringify([...f.proofs]);
 assert.equal((await f.match()).rows[0].state,'applied');const q=await f.read();assert.equal(q.archive.answerOrigin,'book_extracted');assert.equal(q.analysis,'这是答案册的完整解析。');
 const e=JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json);assert.equal(e.questionSection.schemaVersion,'xiaozhi.book-section-context.v1');assert.equal(e.questionSection.pages[0].batchId,id);assert.equal(e.questionSection.pages[0].source.page,3);
 await new MaterialBookAnswerRepository(f.host).validate(q);assert.equal(JSON.stringify([...f.proofs]),original);
 await f.match();assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,1);
}));
await check('Different chapter with the same number cannot borrow an answer and current exact titles win over prior pages',async()=>{
 await use({},async f=>{addPage(f,3,'第十五章 素养基础测试卷');await init(f);assert.equal((await f.match()).rows[0].reason,'answer_not_found');});
 await use({},async(f,stem)=>{syncCurrent(f,section+'\n1. '+stem);addPage(f,3,'第十五章 素养基础测试卷');await init(f);assert.equal((await f.match()).rows[0].state,'applied');assert(!JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json).questionSection);});
});
await check('The nearest exact chapter wins even when the answer book repeats a number in another chapter',()=>use({currentAnswer:'',answerText:section+'\n1. D 解析：前章答案。\n第十五章 素养基础测试卷\n1. B 解析：本章的完整解析。'},async f=>{
 addPage(f,2,section);addPage(f,3,section+'\n20. 旧章最后题。\n第十五章 素养基础测试卷');await init(f);
 const v=await f.match();assert.equal(v.rows[0].state,'applied');assert.equal(v.rows[0].section,'第十五章 素养基础测试卷');assert.equal((await f.read()).answer,'B');await f.repo.validate(await f.read());
}));
await check('Missing pages, another generation/version/resource, unsupported boundaries and either-pass doubts stop inheritance',async()=>{
 for(const mode of ['gap','generation','version','resource','boundary','disagreement','one-pass','uncertain','current-boundary'])await use({},async(f,stem)=>{
  const options=mode==='generation'?{source:{generation:randomUUID()}}:mode==='version'?{source:{version:sha('other')}}:mode==='resource'?{source:{resourceId:'resource_'+randomUUID()}}:mode==='disagreement'?{first:'第十五章 素养基础测试卷'}:mode==='one-pass'?{first:'19. 一道题。'}:mode==='uncertain'?{issues:['uncertain_ocr']}:{};
  addPage(f,mode==='gap'?2:3,mode==='boundary'?section+'\n第二章 电学\n19. 前页题。':section,options);
  if(mode==='current-boundary')syncCurrent(f,'第二章 电学\n1. '+stem);
  await init(f);await held(f);
 });
});
await check('Unrecognised exam headers and a reset/repeated parent number block inheritance instead of silently pairing another exam',async()=>{
 for(const header of ['试卷二','第二套试卷','八年级物理期末测试卷','第二套'+('新资料'.repeat(80))])await use({},async f=>{addPage(f,2,section);addPage(f,3,header+'\n前页内容。');await init(f);await held(f);});
 for(const previous of ['1. 上一页同号。','5. 前页更大题号。'])await use({},async f=>{addPage(f,3,section+'\n'+previous);await init(f);await held(f);});
 await use({answerText:section+'\n2. D 解析：这是答案册的完整解析。'},async(f,stem)=>{
  const p=f.proofs.get(f.batch);for(const r of [p.first,p.final])r.questions[0].number='2';syncCurrent(f,'2. '+stem);
  const row=f.db.prepare('SELECT archive_json FROM question_bank_items WHERE id=?').get(f.questionId),a=JSON.parse(row.archive_json);a.number='2';f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(a),f.questionId);
  addPage(f,3,section+'\n1. 前页第一题。');await init(f);assert.equal((await f.match()).rows[0].state,'applied');await f.repo.validate(await f.read());
 });
});
await check('A late previous page wakes already-held work through the existing local queue with no model replay',()=>use({},async f=>{
 await init(f);await held(f);await f.repo.work.finish(f.batch,1,1);assert(!await f.repo.work.next());
 addPage(f,3,section);await index(f);assert(await f.repo.work.next());assert(await f.drain());assert.equal((await f.read()).archive.answerOrigin,'book_extracted');
}));
await check('New empty/invalid and deleted newer receipts never revive an older title; dirty pages revoke stale reads',async()=>{
 for(const mode of ['empty','invalid','deleted','dirty'])await use({},async f=>{
  addPage(f,3,section);await init(f);await f.match();const q=await f.read();const id=addPage(f,3,'19. 没有标题。');
  if(mode==='dirty'){await assert.rejects(f.repo.validate(q),/source_incomplete/);return;}
  if(mode==='invalid')f.proofs.delete(id);await index(f);
  if(mode==='deleted'){f.db.prepare('DELETE FROM material_ai_page_units WHERE batch_id=?').run(id);f.proofs.delete(id);await index(f);}
  await assert.rejects(f.repo.validate(q),/source_changed/);const count=f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1 WHERE after_json<>\'\'').get().n;assert.equal(count,1);
 });
});
await check('Stored context SHA/source/schema corruption is rejected while teacher roles and conflicting answers remain protected',async()=>{
 for(const field of ['firstSha','imageSha','generation','schemaVersion'])await use({},async f=>{
  addPage(f,3,section);await init(f);await f.match();const saved=f.db.prepare('SELECT id,evidence_json FROM material_book_answer_journal_v1').get(),e=JSON.parse(saved.evidence_json);
  if(field==='generation')e.questionSection.pages[0].source.generation=randomUUID();else if(field==='schemaVersion')e.questionSection.schemaVersion='unknown';else e.questionSection.pages[0][field]='f'.repeat(64);
  f.db.prepare('UPDATE material_book_answer_journal_v1 SET evidence_json=? WHERE id=?').run(JSON.stringify(e),saved.id);await assert.rejects(f.repo.validate(await f.read()),/source_changed/);
 });
 await use({origin:'teacher'},async f=>{addPage(f,3,section);await init(f);const q=await f.read();await f.match();assert.equal((await f.read()).answer,q.answer);assert.equal((await f.read()).archive.answerOrigin,'teacher');});
 await use({currentAnswer:'B'},async f=>{addPage(f,3,section);await init(f);assert.equal((await f.match()).rows[0].reason,'existing_answer_conflict');});
});
await check('The 32-page budget is contiguous, explicit and cannot silently jump to a farther title',async()=>{
 for(const distance of [BOOK_SECTION_LOOKBACK,BOOK_SECTION_LOOKBACK+1])await use({},async(f,stem)=>{
  f.proofs.get(f.batch).unit.pageSource.page=40;syncCurrent(f,'1. '+stem);
  for(let n=1;n<=distance;n++)addPage(f,40-n,n===distance?section:'前页的连续资料。');
  await init(f);const view=await f.match();assert.equal(view.rows[0].state,distance===BOOK_SECTION_LOOKBACK?'applied':'held');
  if(distance===BOOK_SECTION_LOOKBACK){const e=JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json);assert.equal(e.questionSection.pages.length,32);}
 });
});
await check('New-write switch preserves old readers; cancellation and write-time context mutation leave no partial canonical facts',async()=>{
 await use({},async f=>{addPage(f,3,section);await init(f);const prior=process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE;try{process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE='0';await held(f);delete process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE;await f.match();process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE='0';await f.repo.validate(await f.read());}finally{prior===undefined?delete process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE:process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE=prior;}});
 await use({},async f=>{addPage(f,3,section);await init(f);const before=questionVersion(await f.read());f.repo.sections.validate=async()=>{throw Error('source_changed');};await assert.rejects(f.match(),/source_changed/);assert.equal(questionVersion(await f.read()),before);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,0);const c=new AbortController();c.abort();await assert.rejects(f.repo.match(f.input,c.signal));});
});
await check('A chapter changed after the initial transactional check is rejected before publication and rolls back the candidate journal',()=>use({},async f=>{
 const id=addPage(f,3,section);await init(f);const before=questionVersion(await f.read()),original=f.repo.sections.validate.bind(f.repo.sections);let reads=0;
 f.repo.sections.validate=async(...args)=>{await original(...args);if(++reads===1)f.proofs.get(id).finalSha='f'.repeat(64);};
 await assert.rejects(f.match(),/source_changed/);assert.equal(questionVersion(await f.read()),before);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,0);
}));
await check('Old derived control schema upgrades once and repeats without resetting a completed cursor',()=>use({},async f=>{
 f.db.exec('CREATE TABLE material_book_answer_control_v1(id INTEGER PRIMARY KEY CHECK(id=1),cursor INTEGER NOT NULL);INSERT INTO material_book_answer_control_v1 VALUES(1,999)');
 await f.repo.migrate();assert.equal(f.db.prepare('SELECT cursor FROM material_book_answer_control_v1').get().cursor,0);await index(f);const row=f.db.prepare('SELECT * FROM material_book_answer_control_v1').get();assert.equal(row.section_policy,3);await f.repo.migrate();assert.equal(f.db.prepare('SELECT cursor FROM material_book_answer_control_v1').get().cursor,row.cursor);
}));
console.log(JSON.stringify({success:true,checks,scope:'Real SQLite index/work/journal and source validation with controlled immutable page receipts; includes legacy 21 checks. No cloud, natural accuracy or 40GiB claim.'}));
