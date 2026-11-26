import assert from 'node:assert/strict';
import test from 'node:test';
import '../office-agent/register-source.mjs';
const {naturalLessonDraft} = await import('../../src/main/education/natural-lesson-draft.ts');
const {resolveOrdinaryLessonBasis} = await import('../../src/main/education/natural-lesson-basis.ts');
const {naturalLessonDocument} = await import('../../src/main/education/natural-lesson-tool.ts');

test('binds an explicitly named ordinary source and leaves an unstated subject for source resolution', () => {
  assert.deepEqual(naturalLessonDraft('根据 SYN-LESSON-01 制作45分钟七年级一次方程教案，包含两个教学目标、导入5/讲解12/练习18/总结10分钟，例题和检验准确，先确认后导出。'), {
    mode: 'outline', materialTitle: 'SYN-LESSON-01', grade: '七年级', requestedMinutes: 45,
    requestedAgenda:[{kind:'introduction',minutes:5},{kind:'activity',minutes:12},
      {kind:'practice',minutes:18},{kind:'closure',minutes:10}],
  });
});

test('recognizes another subject and a quoted file name without treating it as a curriculum registration', () => {
  assert.deepEqual(naturalLessonDraft('请参考《昆虫观察笔记.txt》，帮我编写一份35分钟的五年级科学教案。'), {
    mode: 'outline', materialTitle: '昆虫观察笔记.txt', grade: '五年级', subject: '科学', requestedMinutes: 35,
  });
});

test('keeps uniquely registered sources on the existing curriculum path', () => {
  assert.deepEqual(naturalLessonDraft('请根据资料库中的《观察A》，编写35分钟五年级科学教案。'), {
    mode: 'outline', lesson: {grade: '五年级', subject: '科学', curricula: []}, sourceTitles: ['观察A'],
    requestedMinutes: 35,
  });
});

test('leaves template, revision, ambiguous grade, and implicit attachment requests outside auto-admission', () => {
  for (const prompt of [
    '如何参考《昆虫观察笔记.txt》编写五年级科学教案？',
    '不要依据《昆虫观察笔记.txt》编写五年级科学教案。',
    '参考《昆虫观察笔记.txt》编写五年级科学教案模板。',
    '根据《观察A》修改五年级科学教案。',
    '依据《观察A》制作四年级和五年级的联合教案。',
    '依据《观察A》制作五年级语文和科学教案。',
    '根据我上传的资料制作五年级科学教案。',
  ]) assert.equal(naturalLessonDraft(prompt), undefined, prompt);
});

const resourceId='resource_00000000-0000-4000-8000-000000000001',version='a'.repeat(64);
const request={mode:'outline',materialTitle:'自然观察-01',grade:'五年级'};
const chunk={id:'chunk-1',chunkIndex:0,contentMd:'五年级科学观察记录',subject:'科学',grade:'五年级',containsPersonalData:false};
const materials=(overrides={})=>({
  exactNames:async(title,options)=>{
    assert.equal(title,request.materialTitle);
    assert.deepEqual(options,{includeFileStem:true});
    return overrides.matches??[{resourceId,version}];
  },
  body:async()=>{
    const chunks=overrides.chunks??[chunk];
    return {resource:{contentHash:overrides.version??version,parseStatus:overrides.status??'ready'},chunks,total:chunks.length};
  },
});

test('binds the complete ordinary source while preserving distinct immutable offsets and curriculum status', async () => {
  const resolved=await resolveOrdinaryLessonBasis(request,materials({chunks:[chunk,
    {...chunk,id:'chunk-2',chunkIndex:1,contentMd:'实践方向：比较叶片。'}]}));
  assert.deepEqual(resolved.lesson,{subject:'科学',grade:'五年级',curricula:[]});
  assert.deepEqual(resolved.sources.map(({resourceId:resource,version:identity,offset})=>[resource,identity,offset]),
    [[resourceId,version,0],[resourceId,version,1]]);
  assert.notEqual(resolved.sources[0].bodyVersion,resolved.sources[1].bodyVersion);
});

test('refuses missing, duplicate, partial, private, oversized, changed and incompatible materials', async () => {
  const invalid=[
    [{matches:[]},'lesson_basis_unavailable'],
    [{matches:[{resourceId,version},{resourceId,version}]},'lesson_basis_ambiguous'],
    [{status:'partial'},'lesson_basis_unavailable'],
    [{chunks:[{...chunk,containsPersonalData:true}]},'lesson_basis_unavailable'],
    [{chunks:Array(5).fill(chunk)},'lesson_basis_unavailable'],
    [{version:'b'.repeat(64)},'lesson_basis_unavailable'],
    [{chunks:[{...chunk,grade:'四年级'}]},'lesson_basis_unavailable'],
    [{chunks:[{...chunk,subject:''}]},'lesson_basis_unavailable'],
  ];
  for(const [overrides,code] of invalid)await assert.rejects(resolveOrdinaryLessonBasis(request,materials(overrides)),new RegExp(code));
  await assert.rejects(resolveOrdinaryLessonBasis({...request,subject:'语文'},materials()),/lesson_basis_unavailable/u);
});

test('keeps a combined closing check in its original slot and preserves all teacher-facing content', () => {
  const assessment={objectiveIndices:[0],prompt:'解释观察结果。',expectedEvidence:'给出一个实际观察。',criterion:'结论与观察一致。'};
  const scenes=['introduction','activity','practice','closure'].map((kind,index)=>({
    title:['导入','活动','练习','总结与检查'][index],kind,activity:'实际课堂活动',durationMinutes:[4,16,10,5][index],
    objectiveIndices:[0],teacherPrompt:'说出你的发现。',checks:index===3?[assessment]:[],
  }));
  const raw={title:'科学教案',totalMinutes:35,objectives:[{goal:'解释观察现象',criterion:'用证据解释'}],preparation:[],details:{content:'观察记录'},scenes};
  const intent={subject:'科学',grade:'五年级',curricula:[]};
  const {document}=naturalLessonDocument(raw,intent);
  assert.equal(document.lesson.phases[3].kind,'assessment');
  assert.equal(document.scenes[3].type,'quiz');
  assert.equal(document.scenes[3].title,'总结与检查');
  assert.deepEqual(document.scenes.map(scene=>scene.durationMinutes),[4,16,10,5]);
  assert.deepEqual(document.lesson.phases[3].checks,[assessment]);
  const withoutCheck=structuredClone(raw);
  withoutCheck.scenes[3].checks=[];
  assert.equal(naturalLessonDocument(withoutCheck,intent).document.lesson.phases[3].kind,'closure');
  const alreadyAssessed=structuredClone(raw);
  alreadyAssessed.scenes[2].kind='assessment';
  assert.equal(naturalLessonDocument(alreadyAssessed,intent).document.lesson.phases[3].kind,'closure');
  const split=structuredClone(raw);
  split.scenes[3]={...split.scenes[3],kind:'assessment',title:'评价',durationMinutes:3};
  split.scenes.push({...scenes[3],title:'小结',durationMinutes:2,checks:[]});
  const requestedAgenda=scenes.map(({kind,durationMinutes:minutes})=>({kind,minutes}));
  const combined=naturalLessonDocument(split,intent,undefined,requestedAgenda).document;
  assert.deepEqual(combined.scenes.map(scene=>scene.durationMinutes),[4,16,10,5]);
  assert(combined.scenes[3].title.includes('评价')&&combined.scenes[3].title.includes('小结'));
  assert.deepEqual(combined.lesson.phases[3].checks,[assessment]);
  assert.equal(naturalLessonDocument(split,intent).document.scenes.length,5);
  const damaged=structuredClone(raw);
  damaged.details.content='原始要求\uFFFD这一段有缺字';
  assert.equal(naturalLessonDocument(damaged,intent).error,'lesson_text_encoding');
});
