import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backup, DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {recoverStructurePage, StructureQuestionAssembler} from '../../src/main/assets/material-document-structure.ts';
import {relocateBackupDatabase} from '../../src/main/backup/restore-database.ts';
import {DOCUMENT_STRUCTURE_ENGINE} from '../../src/shared/material-document-structure.ts';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const root=fs.realpathSync(process.argv[2]);
assert(path.basename(root).startsWith('kb-structure-batch-'));
const sourceRoot=path.join(root,'data');
const paperGeneration='ae432b2e-4e7a-4d82-a8b1-b5ba81276f91';
const answerGeneration='090c7035-8e3b-4f00-bc67-e904ce8d468f';
const drafts=['1','3','6','7','10','12','14','15'];
const compareNumbers=(a,b)=>Number(a)-Number(b);
const sha=value=>createHash('sha256').update(value).digest('hex');
const reader=directory=>(sql,...args)=>{
  const db=new DatabaseSync(path.join(directory,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
};
const read=reader(sourceRoot);
const pageRows=(db,generation)=>db('SELECT * FROM material_structure_pages WHERE generation=? ORDER BY page',generation);
const questionRows=(db,generation)=>db('SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid',generation);
const bodies=rows=>rows.map(row=>JSON.parse(row.body_json));
const replay=page=>recoverStructurePage({...page,lines:page.lines.filter(line=>!line.origin).map(line=>({
  id:line.sourceId,text:line.text,score:line.score,normalizedQuad:line.quad,
}))});
const labels=groups=>groups.filter(q=>q.status==='candidate').map(q=>q.number).sort(compareNumbers);
const preserved=({status,issues,ocrSourceKey,...content})=>content;
const paperRows=pageRows(read,paperGeneration), oldQuestions=questionRows(read,paperGeneration);
const frozen=bodies(paperRows), old=bodies(oldQuestions);
const lastQuestionByPage=['10','17','19','21'];
const footerLines=frozen.map(page=>page.paragraphs.at(-1));
assert(footerLines.every(footer=>footer.role==='body'&&footer.rawText.startsWith('数学试题')));
// Pin the only intentional v16 merges to physical OCR lines. All other
// paragraph content remains exact, even when its derived ordinal ID changes.
const headingMerges=[['p1-line-14','p1-line-15'],['p2-line-22','p2-line-23']];
const paragraphIdMap=new Map();
const expectedParagraphs=frozen.map(page=>{
  const expected=[];
  for(let i=0;i<page.paragraphs.length;i++){
    const original=page.paragraphs[i], paragraph=structuredClone(original);
    const merge=headingMerges.find(lines=>lines[0]===original.lineIds[0]);
    const sources=[original];
    if(merge){
      const continuation=page.paragraphs[++i];
      assert.deepEqual([...original.lineIds,...continuation.lineIds],merge);
      assert.equal(original.role,'heading');
      assert.equal(continuation.role,'heading');
      assert.equal(original.column,continuation.column);
      sources.push(continuation);
      paragraph.lineIds=[...merge];
      paragraph.regionIds=[...new Set(sources.flatMap(p=>p.regionIds))];
      paragraph.rawText=sources.map(p=>p.rawText).join('\n');
      paragraph.text=sources.map(p=>p.text).join('');
      paragraph.anchor.box=original.anchor.box.map((value,index)=>(index<2?Math.min:Math.max)(value,continuation.anchor.box[index]));
      paragraph.confidence=Math.min(...sources.map(p=>p.confidence));
      paragraph.issues=[...new Set(sources.flatMap(p=>p.issues))];
    }
    paragraph.id=`p${page.page}-paragraph-${expected.length+1}`;
    for(const source of sources)paragraphIdMap.set(source.id,paragraph.id);
    if(original===page.paragraphs.at(-1))paragraph.role='footer';
    expected.push(paragraph);
  }
  return expected;
});
const remapIds=ids=>ids.map(id=>{
  assert(paragraphIdMap.has(id),`Unknown physical paragraph: ${id}`);
  return paragraphIdMap.get(id);
});
const remapOptions=options=>options.map(option=>({...option,paragraphIds:remapIds(option.paragraphIds)}));
const remapQuestion=q=>{
  const expected={...q,paragraphIds:remapIds(q.paragraphIds),
    options:remapOptions(q.options),
    subquestions:q.subquestions.map(sub=>({...sub,paragraphIds:remapIds(sub.paragraphIds),options:remapOptions(sub.options)}))};
  for(const lines of headingMerges){
    const page=frozen.find(p=>p.paragraphs.some(part=>part.lineIds.includes(lines[0])));
    const continuation=page.paragraphs.find(part=>part.lineIds.includes(lines[1]));
    if(q.section===continuation.text)expected.section=expectedParagraphs[frozen.indexOf(page)].find(part=>part.lineIds.includes(lines[0])).text;
  }
  expected.id='sq_'+sha(JSON.stringify([frozen[0].resourceId,frozen[0].version,expected.section,expected.number,expected.paragraphIds,expected.stem])).slice(0,40);
  return expected;
};
function checkFooters(pages,questions){
  assert.equal(pages.length,frozen.length);
  assert.deepEqual(questions.map(q=>q.number),old.map(q=>q.number));
  for(const [i,page] of pages.entries()){
    assert(!page.issues.includes('ambiguous_columns'));
    for(const field of ['rawText','lines','columns']) assert.deepEqual(page[field],frozen[i][field]);
    const expected=footerLines[i], actual=page.paragraphs.at(-1);
    assert.deepEqual(actual,{...expected,id:paragraphIdMap.get(expected.id),role:'footer'});
    assert.deepEqual(page.paragraphs,expectedParagraphs[i]);
    const tail=questions.find(q=>q.number===lastQuestionByPage[i]);
    const prior=old.find(q=>q.number===tail.number);
    assert(prior.stem.includes(expected.rawText));
    assert.equal(tail.stem,prior.stem.replace('\n'+expected.rawText,''));
    assert.deepEqual(tail.paragraphIds,remapQuestion(prior).paragraphIds.filter(id=>id!==paragraphIdMap.get(expected.id)));
    assert.deepEqual(tail.anchors,prior.anchors.filter(a=>JSON.stringify(a)!==JSON.stringify(expected.anchor)));
    assert(!JSON.stringify(tail.subquestions).includes(expected.rawText));
  }
  const unaffected=q=>!lastQuestionByPage.includes(q.number);
  assert.deepEqual(questions.filter(unaffected).map(preserved),old.filter(unaffected).map(remapQuestion).map(preserved));
}
assert.equal(frozen.length,4);
assert.equal(old.length,20);
assert(old.every(q=>q.status==='needs_review'&&q.issues.includes('ambiguous_columns')));
const reconstructed=frozen.map(replay), assembler=new StructureQuestionAssembler();
const groups=[...reconstructed.flatMap(page=>assembler.push(page)),...assembler.end()];
assert.deepEqual(labels(groups),drafts);
checkFooters(reconstructed,groups);
const other=bodies(pageRows(read,answerGeneration))[1];
assert.equal(other.columns.length,2);
assert(other.issues.includes('ambiguous_columns'));
assert.deepEqual(replay(other).columns,other.columns);
assert(replay(other).issues.includes('ambiguous_columns'));
const report={replayedPages:frozen.length,groups:groups.length,layoutHeld:groups.length-drafts.length,
  layoutEligible:drafts,uncertainNaturalDoubleColumn:true,footersRecovered:footerLines.length,cleanedQuestionNumbers:lastQuestionByPage,
  mergedHeadingSourceLines:headingMerges};
if(!process.argv.includes('--desktop')){console.log(JSON.stringify({ok:true,...report}));process.exit(0);}

const work=fs.mkdtempSync(path.join(os.tmpdir(),'kb-column-replay-'));
const data=path.join(work,'data');
fs.cpSync(sourceRoot,data,{recursive:true,filter:file=>!/^app\.db(?:-wal|-shm)?$/.test(path.basename(file))});
const snapshot=new DatabaseSync(path.join(sourceRoot,'app.db'),{readOnly:true});
try{await backup(snapshot,path.join(data,'app.db'));}finally{snapshot.close();}
await relocateBackupDatabase(path.join(data,'app.db'),sourceRoot,data,path.join(root,'XiaozhiOutputs'),path.join(work,'XiaozhiOutputs'));
const query=reader(data), paperId=frozen[0].resourceId;
const [resource]=query('SELECT id, title, local_path, original_file_name, content_hash FROM teacher_resources WHERE id=?',paperId);
assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
const frozenFacts=()=>query(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
 AND (json_extract(archive_json,'$.state')='teacher_edited' OR json_extract(archive_json,'$.sourceChecked')=1) ORDER BY id`);
const budgets=()=>query('SELECT id,calls FROM material_ai_batches ORDER BY id');
const pairs=()=>query('SELECT * FROM material_book_pairs ORDER BY question_id');
const before=[frozenFacts(),budgets(),pairs()];
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const env={...process.env};
for(const name of Object.keys(env)) if(/KEY|TOKEN|SECRET|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_VISIBLE:'0'});
const app=await electron.launch({args:[main,'--user-data-dir='+path.join(work,'profile'),'--host-resolver-rules=MAP * ~NOTFOUND'],cwd:work,env,timeout:90000});
const until=async predicate=>{
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,500));}
  throw Error('Timed out waiting for the rebuilt structure');
};
try{
  await app.evaluate(({net})=>{
    globalThis.externalRequests=0;
    globalThis.fetch=net.fetch=async()=>{globalThis.externalRequests++;throw Error('Offline structure replay');};
  });
  const desktop=await app.firstWindow(), errors=[];
  desktop.on('pageerror',error=>errors.push(error.message));
  await productEntry(desktop,'materials').click();
  await desktop.getByTestId('materials-search').fill(resource.title);
  await desktop.getByTestId('material-'+paperId).getByRole('button').click();
  await desktop.getByTestId('materials-section-questions').click();
  const panel=desktop.getByTestId('material-structure-panel');
  await openMaterialDisclosure(panel);
  const began=performance.now();
  await panel.getByTestId('structure-rebuild').click();
  const job=()=>query('SELECT * FROM material_structure_jobs WHERE resource_id=?',paperId)[0];
  await until(()=>{const started=job();return started&&started.generation!==paperGeneration;});
  await desktop.evaluate(input=>window.omniEdu.controlMaterialTask(input),{
    schemaVersion:'xiaozhi.material-parse-task.v1',resourceId:paperId,version:resource.content_hash,action:'prioritize',
  });
  const current=await until(()=>['partial','complete'].includes(job()?.status)?job():false);
  const publishMs=Math.round(performance.now()-began);
  assert.equal(current.engine,DOCUMENT_STRUCTURE_ENGINE);
  const published=bodies(questionRows(query,current.generation));
  assert.equal(published.length,20);
  assert(published.every(q=>q.status==='needs_review'&&!q.issues.includes('ambiguous_columns')));
  const sourceConflicts=published.filter(q=>q.issues.includes('pdf_text_conflict')).map(q=>q.number).sort(compareNumbers);
  assert.deepEqual(sourceConflicts,drafts);
  checkFooters(bodies(pageRows(query,current.generation)),published);
  const indexed=query('SELECT body_json FROM material_structure_chunks WHERE generation=?',current.generation);
  assert(indexed.length>0&&indexed.every(row=>footerLines.every(footer=>!JSON.parse(row.body_json).content.includes(footer.rawText))));
  const candidates=panel.getByTestId('structure-questions');
  await candidates.getByText('PDF 页源待核对，请对照原页检查').first().waitFor();
  assert.equal(await candidates.getByText('分栏待核对').count(),0);
  assert.equal(await candidates.getByText(footerLines[0].rawText).count(),0);
  assert.equal(await panel.getByTestId('structure-paragraphs').getByText(footerLines[0].rawText,{exact:true}).first().isVisible(),true);
  await panel.getByRole('button',{name:'对照原始页图'}).click();
  await panel.getByTestId('structure-source-image').evaluate(img=>img.decode());
  const archived=query(`SELECT id FROM question_bank_items WHERE json_valid(archive_json)
    AND json_extract(archive_json,'$.structure.generation')=?`,current.generation);
  assert.equal(archived.length,0);
  const formal=await desktop.evaluate(input=>window.omniEdu.searchQuestionBank(input),{query:'公差',limit:30});
  assert(!formal.some(item=>item.archive?.structure?.generation===current.generation));
  assert.deepEqual(pageRows(query,paperGeneration),paperRows);
  assert.deepEqual(questionRows(query,paperGeneration),oldQuestions);
  assert.deepEqual([frozenFacts(),budgets(),pairs()],before);
  assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
  assert.equal(await app.evaluate(()=>globalThis.externalRequests),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,...report,work,buildSha:sha(fs.readFileSync(main)),generation:current.generation,
    publishMs,desktopHeld:current.held,sourceConflicts,archiveDrafts:archived.length,formalMatches:0,externalRequests:0}));
}catch(error){console.error(JSON.stringify({work,error:String(error.stack)}));throw error;}
finally{await app.close();}
