import assert from 'node:assert/strict';
import {mockExamScopeLabel,mockExamMetadataMatchesScope,validMockExamScope} from '../../src/shared/mock-exam-compilation.ts';
import {resolveMockExamScope} from '../../src/main/education/mock-exam-request-scope.ts';
import {inferMockExam} from '../../src/main/education/mock-exam-metadata.ts';
import {planMockExamEdit} from '../../src/main/education/mock-exam-edit-plan.ts';

const prompt='请把本地资料库中2025年上海杨浦、徐汇的初三数学一模整理成汇编目录，别把二模混进去。';
const scope={year:2025,subject:'数学',grade:'九年级',districts:['徐汇区','杨浦区'],rounds:['一模']};
assert.deepEqual(resolveMockExamScope(prompt,{year:2025}),scope);
assert.deepEqual(resolveMockExamScope(prompt,{...scope,districts:[...scope.districts].reverse()}),scope);
for(const proposal of [
  {year:2024},{year:2025,subject:'英语'},{year:2025,grade:'八年级'},
  {year:2025,districts:['徐汇区']},{year:2025,rounds:['一模','二模']},
])assert.throws(()=>resolveMockExamScope(prompt,proposal),/scope_mismatch/);
assert.throws(()=>resolveMockExamScope('整理2024年和2025年上海数学模拟卷的汇编。',{year:2025}),/scope_ambiguous/);
assert.throws(()=>resolveMockExamScope('整理2025年上海各区一模目录。',{year:2025,districts:['杨浦区']}),/scope_mismatch/);
assert.deepEqual(resolveMockExamScope('整理2025年上海各区模考汇编。',{year:2025}),{year:2025});
for(const bad of [{year:2025,districts:[]},{year:2025,districts:['苏州市']},{year:2025,districts:['徐汇区','徐汇区']},{year:2025,rounds:['初赛']}])
  assert(!validMockExamScope(bad));
assert.equal(mockExamScopeLabel({year:2025,grade:'九年级',subject:'数学'}),'2025 年上海模考 · 九年级 · 数学');

const hit=inferMockExam('2025上海徐汇区初三数学一模试卷.pdf','2025年上海徐汇区初三数学一模',scope);
assert(hit&&mockExamMetadataMatchesScope(hit.metadata,scope));
assert.equal(inferMockExam('2025上海虹口区初三数学一模试卷.pdf','',scope),undefined);
assert.equal(inferMockExam('2025上海徐汇区初三数学二模试卷.pdf','',scope),undefined);
const conflict=inferMockExam('2025上海杨浦区初三数学一模试卷.pdf','2025上海闵行区初三数学二模',scope);
assert.deepEqual(conflict.conflicts,['district','round']);
assert.equal(conflict.metadata.district,null);
assert.equal(conflict.metadata.round,null);
assert(!mockExamMetadataMatchesScope(conflict.metadata,scope));
const unknown=inferMockExam('2025上海徐汇区初三数学模拟试卷.pdf','',scope);
assert(unknown&&unknown.metadata.round===null&&!mockExamMetadataMatchesScope(unknown.metadata,scope));
const senior=inferMockExam('2025上海徐汇区高中二年级物理一模卷.pdf','',{year:2025,grade:'高二'});
assert.equal(senior?.metadata.grade,'高二');

const candidate={...conflict,resourceId:'resource_00000000-0000-4000-8000-000000000001',include:false,permission:'unknown'};
const id='mock_catalog_00000000-0000-4000-8000-000000000001',digest='a'.repeat(64);
const model={summary:{id,revision:1,digest},entries:[candidate],scope};
const change={resourceId:candidate.resourceId,include:true,district:'杨浦区',round:'一模'};
assert.throws(()=>planMockExamEdit(model,{catalogId:id,revision:1,digest,changes:[{...change,district:'闵行区'}]}),/scope_changed/);
assert.throws(()=>planMockExamEdit(model,{catalogId:id,revision:1,digest,changes:[{...change,round:'二模'}]}),/scope_changed/);
assert(planMockExamEdit(model,{catalogId:id,revision:1,digest,changes:[change]}).snapshot.entries[0].include);
console.log(JSON.stringify({ok:true,scope}));
