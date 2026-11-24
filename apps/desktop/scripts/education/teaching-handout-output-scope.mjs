import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertHandoutOutputScope,handoutOutputScope} from '../../src/main/education/teaching-handout-output-scope.ts';
import {assertTeachingHandoutExportProposal,createTeachingHandoutExportTools} from '../../src/main/education/teaching-handout-export-tools.ts';

const student={audience:'student',path:'练习-学生版.docx'};
const teacher={audience:'teacher',path:'练习-教师版.docx'};
const scenarios=[
  ['把已确认的《等式变形分层学案》导出为学生版和教师版 Word 文件。',[student,teacher],[teacher]],
  ['将《教师版课堂笔记》学案导出为学生版 Word。',[student],[teacher]],
  ['从教师版讲义导出学生版 Word。',[student],[teacher]],
  ['把讲义导出 Word，不需要教师版。',[student],[teacher]],
  ['讲义导出为学生版 Word，教师版不用。',[student],[teacher]],
  ['把讲义导出为“学生版”和“教师版”。',[teacher,student],[student]],
  ['把现有学案的学生版和老师版分别另存为 Word。',[student,teacher],[teacher]],
  ['把讲义导出 Word，只要教师版，不用学生版。',[teacher],[student]],
];
for(const [prompt,valid,wrong] of scenarios){
  const scope=handoutOutputScope(prompt);
  assert.doesNotThrow(()=>assertHandoutOutputScope(scope,valid),prompt);
  assert.throws(()=>assertHandoutOutputScope(scope,wrong),/audience_mismatch/,prompt);
}
const unspecified=handoutOutputScope('把这份讲义导出为 Word。');
assert.doesNotThrow(()=>assertHandoutOutputScope(unspecified,[student]));
assert.doesNotThrow(()=>assertHandoutOutputScope(unspecified,[{...teacher,path:'练习.docx'}]));
assert.doesNotThrow(()=>assertHandoutOutputScope(unspecified,[{...teacher,path:'学生版讲义的修订-教师版.docx'}]));
assert.throws(()=>assertHandoutOutputScope(unspecified,[{...teacher,path:'输出/练习-学生版.docx'}]),/audience_filename_conflict/);
assert.throws(()=>assertHandoutOutputScope(unspecified,[{...student,path:'教师版.docx'}]),/audience_filename_conflict/);
assert.equal(handoutOutputScope('从《教材课堂笔记》生成新的学案并导出学生版 Word。').title,undefined);

const title='教师版课堂笔记';
const ref={bookId:'teaching_book_'+randomUUID(),versionId:'teaching_version_'+randomUUID(),digest:'a'.repeat(64)};
const calls=[];
let publications=0;
const [read,exportTool]=createTeachingHandoutExportTools({
  sessionId:'session',taskId:'task',prompt:'把已确认的《'+title+'》讲义导出为学生版。',
  state:{async forExport(_session,_task,target){
    calls.push(target);
    return {kind:'found',version:{bookId:ref.bookId,id:ref.versionId,digest:ref.digest,title,revision:2},content:{chapters:[{}]}};
  }},
  sanitize:async value=>value,current:()=>true,publish:async()=>{publications++;},
});
const payload=async(tool,args)=>JSON.parse((await tool.execute('call',args)).content[0].text);
assert.equal((await payload(read,{title:'另外的讲义'})).error,'target_mismatch');
assert.deepEqual(calls,[]);
assert.equal((await payload(read,{bookId:'teaching_book_'+randomUUID()})).error,'target_mismatch');
assert.deepEqual(calls,[{title}]);
assert.equal((await payload(read,{})).bookId,ref.bookId);
assert.deepEqual(calls,[{title},{title}]);
assert.equal((await payload(exportTool,{...ref,outputs:[teacher]})).error,'audience_mismatch');
assert.equal((await payload(exportTool,{...ref,outputs:[{...student,path:'教师版.docx'}]})).error,'audience_filename_conflict');
assert.equal(publications,0);
assert.deepEqual(calls,[{title},{title}]);
assert.doesNotThrow(()=>assertTeachingHandoutExportProposal('把讲义导出为学生版 Word。',{...ref,outputs:[student]}));
assert.throws(()=>assertTeachingHandoutExportProposal('把讲义导出为学生版 Word。',{...ref,outputs:[teacher]}),/audience_mismatch/);
assert.throws(()=>assertTeachingHandoutExportProposal('把讲义导出为学生版 Word。',{...ref,outputs:[student,student]}),/invalid_input/);
console.log(JSON.stringify({passed:scenarios.length+12,status:'ok'}));
