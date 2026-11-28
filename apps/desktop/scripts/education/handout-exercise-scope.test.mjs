import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
const {createHandoutEditCoordinator,handoutEditRequest}=await import('../../src/main/education/teaching-handout-edit.ts');

const id=kind=>'teaching_'+kind+'_'+randomUUID();
async function exerciseTools(prompt,numbers=[3,12],teacherSelection,bookInTask=true) {
  const book={id:id('book'),title:'教学讲义'};
  const chapters=numbers.map((number,i)=>({id:id('chapter'),title:'章节 '+i,summary:'',learningObjectives:[]}));
  const pages=chapters.map(chapter=>({id:id('page'),chapterId:chapter.id}));
  const blocks=numbers.flatMap((number,i)=>['exercise','exercise_solution'].map(role=>({
    id:id('block'),pageId:pages[i].id,type:'text',status:'ready',metadata:{handoutRole:role},
    title:'练习 '+number+' · '+(role==='exercise'?'基础':'答案与解析'),payload:{text:role==='exercise'?'新题干':'答案\n\n解析'},
  })));
  const content={book,chapters,pages,blocks},digest='b'.repeat(64),proposed=[],queries=[],reads=[];
  const coordinator=createHandoutEditCoordinator({
    versions:{forEdit:async(_session,_task,target)=>{queries.push(target);if(target.taskOnly&&!bookInTask)throw Error('book_unavailable');return {kind:'found',content,digest};}},
    sanitizer:async()=>text=>text,publish:()=>{},
    state:{propose:async(_versions,_owner,_call,input)=>{proposed.push(input);return {state:'rejected',id:'r'};},
      view:async()=>({state:'rejected',input:{bookId:book.id}})},
  });
  const [read,propose]=coordinator.tools({sessionId:'session',runId:'run',owner:()=>({taskId:'task'}),
    current:()=>true,prompt,teacherSelection},async()=>false);
  for(const chapter of chapters){
    const result=await read.execute('read',{bookId:book.id,chapterId:chapter.id});
    reads.push(JSON.parse(result.content[0].text));
  }
  const edit=async(...indices)=>{
    const changes=indices.map(i=>({kind:'exercise',blockId:blocks[2*i].id,difficulty:'拓展'}));
    const result=await propose.execute('proposal',{bookId:book.id,digest,changes});
    return JSON.parse(result.content[0].text);
  };
  return {edit,proposed,reads,queries};
}

for(const [prompt,allowed] of [['修改这份讲义，只改第十二题。',1],['这份学案仅修改练习３。',0],
  ['请只调整讲义的第 12 道练习。',1]]) {
  test(prompt,async()=>{
    const {edit,proposed,reads}=await exerciseTools(prompt);
    assert.equal(reads[1-allowed].chapter.blocks.length,0);
    assert.equal(reads[allowed].chapter.blocks.length,1);
    assert.equal((await edit(1-allowed,allowed)).error,'exercise_scope');
    assert.equal(proposed.length,0);
    await edit(allowed);
    assert.equal(proposed.length,1);
    assert.equal(handoutEditRequest(prompt),true);
  });
}
test('repeated ordinal in two chapters needs clarification even after opening one chapter',async()=>{
  const {edit,proposed}=await exerciseTools('这份讲义只改第三题',[3,3]);
  await edit(0);
  assert.equal(proposed.length,0);
});
test('ordinary multi-location edit can still reach teacher review',async()=>{
  const {edit,proposed}=await exerciseTools('修改讲义中的两处练习。');
  await edit(0,1);
  assert.equal(proposed.length,1);
});


test('short follow-up requires the current task and excludes a named exam',async()=>{
  const prompt='只改第三题';
  assert(handoutEditRequest(prompt));
  assert(!handoutEditRequest('这份试卷只改第三题'));
  const {queries}=await exerciseTools(prompt);
  assert(queries.every(q=>q.taskOnly===true&&!q.bookId&&!q.title));
});
test('range without exact supported endpoints requires clarification',async()=>{
  const {edit,proposed}=await exerciseTools('讲义只改第三题到第十二题');
  await edit(0);
  assert.equal(proposed.length,0);
});
test('two explicitly named exercises are eligible together',async()=>{
  const {edit,proposed}=await exerciseTools('讲义只改第三题和第十二题');
  await edit(0,1);
  assert.equal(proposed.length,1);
});

test('quoted older instructions cannot extend the current selection',async()=>{
  const {edit,proposed}=await exerciseTools('旧说明是“只改第三题”。这次讲义仅修改第十二题。');
  await edit(0); assert.equal(proposed.length,0);
  await edit(1); assert.equal(proposed.length,1);
});
test('a named manual revision is protected in a general handout edit',async()=>{
  const {edit,proposed}=await exerciseTools('修改讲义，保留我刚改好的第三题。');
  await edit(0,1); assert.equal(proposed.length,0);
  await edit(1); assert.equal(proposed.length,1);
});
test('another only clause cannot silently enlarge a conflicting selection',async()=>{
  const {edit,proposed}=await exerciseTools('上次只改第三题，本次讲义仅修改第十二题。');
  await edit(0); assert.equal(proposed.length,0);
});

test('a teacher designation in the current clarification binds the book without expanding exercise scope',async()=>{
  const answer='请修改《教学讲义》，只调整第三题。';
  const {queries,reads,edit,proposed}=await exerciseTools('只改第三题。',[3,12],async()=>answer);
  assert.equal(queries[0].title,'教学讲义');
  assert.equal(reads[1].chapter.blocks.length,0);
  await edit(1); assert.equal(proposed.length,0);
  await edit(0); assert.equal(proposed.length,1);
});

test('a changed clarification invalidates the previously read exercise before submitting',async()=>{
  let answer='请修改《教学讲义》。';
  const {edit,proposed}=await exerciseTools('只改第三题。',[3,12],async()=>answer);
  answer='这次先取消修改。';
  assert.equal((await edit(0)).error,'source_required');
  assert.equal(proposed.length,0);
});

test('a title supplied by the model, a quotation or an ambiguous teacher answer cannot widen the book lookup',async()=>{
  for(const answer of [undefined,'学生说：“修改《教学讲义》。”','不要修改《教学讲义》。',
    '请修改《教学讲义》或《另一份》。','请修改《教学讲义》吗？','请修改《教学讲义》，先不要改了。']){
    const {queries}=await exerciseTools('只改第三题。',[3],async()=>answer);
    assert(queries.every(q=>q.taskOnly&&!q.title&&!q.bookId),String(answer));
  }
  const {queries}=await exerciseTools('请修改《教学讲义》，只改第三题。',[3],async()=>'请修改《另一份》。');
  assert(queries.every(q=>q.title==='教学讲义'));
});

test('an unbound follow-up asks the teacher for the title without claiming the book is absent from the conversation',async()=>{
  const {reads}=await exerciseTools('只改第三题。',[3],async()=>undefined,false);
  assert.equal(reads[0].error,'book_selection_required');
  assert.equal(reads[0].choices,undefined);
  assert(!JSON.stringify(reads[0]).includes('教学讲义'));
});

for(const prompt of ['这份讲义只改第三题。','请仅修改这份学案的第三题。','修改这份讲义的知识讲解。']){
  test('unbound task requests a teacher designation for '+prompt,async()=>{
    const {reads,queries,proposed,edit}=await exerciseTools(prompt,[3],async()=>undefined,false);
    assert.equal(reads[0].error,'book_selection_required');
    assert.equal(reads[0].chapter,undefined);
    assert(queries.every(query=>query.taskOnly&&!query.title&&!query.bookId));
    await edit(0);
    assert.equal(proposed.length,0);
  });
}

test('a quoted old request cannot designate an unbound handout for a new task',async()=>{
  const {reads,queries}=await exerciseTools('上次的说明是“请修改《教学讲义》”。这次请修改这份讲义的知识讲解。',[3],undefined,false);
  assert.equal(reads[0].error,'book_selection_required');
  assert.equal(reads[0].chapter,undefined);
  assert(queries.every(query=>query.taskOnly));
});
