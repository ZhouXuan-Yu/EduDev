import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
const handouts=await import('../../src/main/education/teaching-handout-export-tools.ts');

const ordinary='继续昨天确认过的讲义。';
const book={bookId:'teaching_book_'+randomUUID(),id:'teaching_version_'+randomUUID(),title:'数学周练',
  digest:'a'.repeat(64),revision:3,createdAt:'2026-11-27T08:00:00.000Z'};
function run({answer,taskBook,afterLookup}={}){
  const queries=[];
  const tool=handouts.createConfirmedHandoutContinuationTool({sessionId:'s',taskId:'t',prompt:ordinary,
    teacherSelection:async()=>answer?.(),current:()=>true,sanitize:async text=>text,
    state:{forExport:async(_session,_task,query)=>{
      queries.push(query);
      if(query.taskOnly&&!taskBook||query.title&&query.title!==book.title)throw Error('book_unavailable');
      afterLookup?.();
      return {kind:'found',version:book,content:{chapters:[]}};
    }}});
  return {tools:[tool],queries,read:async args=>JSON.parse((await tool.execute('read',args)).content[0].text)};
}
test('continuing an existing handout exposes only confirmed-version readback',async()=>{
  const {tools,read}=run({taskBook:true});
  assert.deepEqual(tools.map(t=>t.name),['education_read_teaching_handout']);
  const row=await read({});assert.equal(row.versionId,book.id);assert.equal(row.confirmedAt,book.createdAt);
});
test('model-provided titles cannot search outside the task; a direct teacher designation can',async()=>{
  let statement;
  const {read,queries}=run({answer:()=>statement});
  assert.equal((await read({title:book.title})).error,'book_selection_required');
  assert.equal(queries[0].taskOnly,true);
  statement='请继续《数学周练》，先核对已经确认的版本。';
  assert.equal((await read({})).versionId,book.id);
  assert.equal((await read({title:'其他材料'})).error,'target_mismatch');
});
test('a later teacher decision fences a pending version read',async()=>{
  let statement='请继续《数学周练》。';
  const {read}=run({answer:()=>statement,afterLookup:()=>{statement='取消。';}});
  const denied=await read({});assert.equal(denied.success,false);assert.equal(denied.versionId,undefined);
});
test('continuation applies to an existing handout and excludes quotes, denials and unrelated documents',()=>{
  for(const prompt of [ordinary,'接着上次的学案继续工作。','请继续《数学讲义》。'])assert(handouts.handoutContinuationRequest(prompt));
  for(const prompt of ['不要继续那份讲义。','学生说：“继续昨天的讲义”。','继续昨天的试卷。','制作新的讲义。'])assert(!handouts.handoutContinuationRequest(prompt));
});

test('ambiguous, quoted and withdrawn teacher answers do not expand the search',async()=>{
  for(const answer of ['请继续《数学周练》，或者《物理学案》。','请继续《数学周练》，算了。','同事说：“请继续《数学周练》”。']){
    const {read,queries}=run({answer:()=>answer});
    assert.equal((await read({})).error,'book_selection_required');
    assert.equal(queries.length,0);
  }
});

test('teacher can resume a handout and explicitly defer export',()=>{
  for(const prompt of ['继续昨天的讲义，暂不导出。','请核对当前学案，不用保存文件。']){
    assert(handouts.handoutContinuationRequest(prompt));
    assert.equal(handouts.handoutExportRequest(prompt),false);
  }
  assert(handouts.handoutExportRequest('请把现有讲义导出为 Word。'));
});
