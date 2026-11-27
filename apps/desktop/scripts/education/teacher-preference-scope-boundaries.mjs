import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';

const {selectTeacherPreferenceValues}=await import('../../src/main/education/teacher-preference-scope.ts');
const {teacherPreferenceForRequest}=await import('../../src/main/education/teacher-preference-request.ts');
const {parseTeacherMemorySettings,teacherMemoryValues}=await import('../../src/main/education/teacher-memory-policy.ts');
const {teacherPreferenceContext,teacherPreferenceTrialContext}=await import('../../src/main/education/teacher-preference-policy.ts');
const {projectTeacherPreferenceRequest}=await import('../../src/main/xiaozhi-agent/preference-request-context.ts');
const values={length:'concise',structure:'step_by_step',answerOrder:'hint_first',presentation:'table',exportFormat:'docx'};
const snapshot={schemaVersion:'xiaozhi.teacher-preference.v1',revision:2,values};
const scope=(text,exportChosen=false)=>selectTeacherPreferenceValues(values,text,exportChosen);
let passed=0;
const check=(description,validate)=>{validate();passed++;console.log('PASS '+description);};

check('Greetings, small talk, app setup and support questions carry no teaching or export defaults',()=>{
 for(const prompt of ['你好，打个招呼。','谢谢！','如何导出文档？','为什么安装失败？','怎么配置软件？','今天天气怎么样？'])
  assert.deepEqual(scope(prompt),{});
});
check('Teaching explanations apply relevant defaults without leaking file format or table layout everywhere',()=>{
 assert.deepEqual(scope('为什么会下雨？'),{length:'concise',structure:'step_by_step',answerOrder:'hint_first'});
 assert.deepEqual(scope('请比较并解释雾和云的区别。'),{
  length:'concise',structure:'step_by_step',answerOrder:'hint_first',presentation:'table'});
});
check('Explicit instructions shadow their own fields and one-sentence or answer-only requests take priority',()=>{
 assert.deepEqual(scope('请详细解释雾与云的区别，用段落，先给结论。'),{structure:'step_by_step'});
 assert.deepEqual(scope('只用一句话解释为什么会下雨。'),{});
 assert.deepEqual(scope('解释这道题，只给答案。'),{});
 assert.equal(scope('用 80 字解释这个现象').length,undefined);
});
check('Existing explicit export formats and output selection beat default format; no delivery request keeps it private',()=>{
 assert.deepEqual(scope('请导出这份教案。'),{exportFormat:'docx'});
 assert.deepEqual(scope('请导出这份教案为 PDF。'),{});
 assert.deepEqual(scope('请导出这份教案。',true),{});
 assert.equal(scope('解释两种说法的区别，不生成文件。').exportFormat,undefined);
});
check('Acknowledgement, rollback and trials stay distinct from the saved preference payload',()=>{
 for(const action of ['learned','rolled_back','no_previous','rejected']){
  const output=teacherPreferenceForRequest({snapshot,action},'解释为什么会下雨');
  assert(output.text.includes('[教师偏好操作结果]'));assert.equal(output.applied,false);
  assert(!output.text.includes('分步骤讲解'));
 }
 assert.equal(teacherPreferenceForRequest({snapshot,action:'none'},'谢谢').text,'');
 const follow=teacherPreferenceForRequest({snapshot,action:'trial',trial:values},'请解释降雨的原因。');
 assert(follow.text.includes('本轮表达方式试用')&&!follow.text.includes('导出Word'));
});
check('Confirmed preference lookup reports the durable authorized record without applying or saving it again',()=>{
 const lookup={...snapshot,revision:3,values:{...values,handoutAnswerPlacement:'at_end'}};
 const request='请核对我已保存的学案习惯。';
 const result=teacherPreferenceForRequest({snapshot:lookup,action:'none'},request);
 assert.equal(result.applied,false);
 assert(result.text.includes('已确认偏好的宿主状态'));
 assert(result.text.includes('讲义末尾'));
 assert(result.text.includes('跨会话')&&result.text.includes('"version":3'));
 assert(!result.text.includes('导出Word'));
 assert(!result.text.includes('分步骤讲解'));
 const policy={revision:1,profile:{subject:'数学',grade:'八年级',textbook:''},use:{handoutAnswerPlacement:'off'},updatedAt:null};
 const withheld=teacherPreferenceForRequest({snapshot:lookup,action:'none',policy},request);
 assert(withheld.text.includes('没有可核对'));
 assert(!withheld.text.includes('讲义末尾'));
 assert(!teacherPreferenceForRequest({snapshot:lookup,action:'none'},'请翻译“请核对我已保存的学案习惯”。').text.includes('已确认偏好的宿主状态'));
});
check('Legacy blended blocks and compacted summaries disappear from requests without mutating recorded messages',()=>{
 const old=teacherPreferenceContext(snapshot,'none')+teacherPreferenceTrialContext(values);
 const user={role:'user',content:`[其他任务索引]\n保留引用${old}\n\n[教师本次请求]\n旧问题`,timestamp:1};
 const summary={role:'user',content:`The conversation history before this point was compacted into the following summary:\n\n<summary>\n原摘要${old}\n</summary>`,timestamp:2};
 const original={messages:[user,summary,{role:'user',content:'你好',timestamp:3}]};
 const next=projectTeacherPreferenceRequest(original);
 assert.equal(next.messages[0].content,'[其他任务索引]\n保留引用\n\n[教师本次请求]\n旧问题');
 assert(next.messages[1].content.includes('原摘要')&&!next.messages[1].content.includes('分步骤讲解'));
 assert(user.content.includes('分步骤讲解')&&summary.content.includes('分步骤讲解'));
});
check('Current advice binds to the exact current user text and preserves image blocks and source context order',()=>{
 const raw='请解释这个图。';
 const image={type:'image',data:'YWJj',mimeType:'image/png'};
 const original={messages:[
  {role:'user',content:raw,timestamp:1},
  {role:'user',content:[{type:'text',text:raw},image],timestamp:2},
  {role:'user',content:'[资料子任务]\n核对本地来源',timestamp:3},
 ]};
 const next=projectTeacherPreferenceRequest(original,raw,'仅本轮表达指导');
 assert.equal(next.messages[0].content,raw);
 assert.deepEqual(next.messages[1].content,[...original.messages[1].content,{type:'text',text:'仅本轮表达指导'}]);
 assert.deepEqual(next.messages[2],original.messages[2]);
 assert.equal(original.messages[1].content.length,2);
 assert.deepEqual(projectTeacherPreferenceRequest(original,'无匹配','仅本轮表达指导'),original);
});
check('Teacher scopes require a single matching subject and grade and explicit current instructions still prevail',()=>{
 const profile={subject:'物理',grade:'八年级',textbook:'验收教材'};
 const scoped={revision:1,profile,use:{length:'profile',structure:'off'},updatedAt:null};
 const applied=prompt=>teacherPreferenceForRequest({snapshot,action:'none',policy:scoped},prompt).text;
 assert(applied('请解释８年级物理的浮力。').includes('讲解简洁'));
 assert(applied('请解释初二物理的浮力。').includes('讲解简洁'));
 for (const prompt of ['请解释八年级的浮力。','请解释物理里的浮力。','请解释面向九年级物理的浮力。','请解释八年级化学与物理的区别。','不用八年级物理知识，解释浮力。','请详细解释初二物理的浮力。']){
  assert(!applied(prompt).includes('讲解简洁'),prompt);
 }
 assert.deepEqual(teacherMemoryValues({length:'concise',structure:'step_by_step'},scoped,'解释浮力','八年级 物理'),{length:'concise'});
 assert.deepEqual(teacherMemoryValues({length:'concise'},scoped,'用九年级物理解释浮力','八年级 物理'),{});
 assert.deepEqual(teacherMemoryValues(values,null,'解释初二物理的浮力'),{});
});
check('Host scope validation rejects unrelated metadata, unknown controls and incomplete scopes',()=>{
 const profile={subject:'物理',grade:'八年级',textbook:'  验收教材  '};
 const draft={revision:1,preferenceRevision:2,profile,use:{length:'profile',structure:'off',presentation:'relevant'}};
 assert.deepEqual(parseTeacherMemorySettings(draft),{...draft,profile:{...profile,textbook:'验收教材'},use:{length:'profile',structure:'off'}});
 for(const changed of [
  {...draft,use:{statement:'off'}},
  {...draft,use:{length:'global'}},
  {...draft,profile:{...profile,grade:''}},
  {...draft,profile:{...profile,textbook:'验收教材\n一'}},
  {...draft,use:JSON.parse('{"__proto__":"off"}')},
  {...draft,allowPermission:true},
 ])assert.throws(()=>parseTeacherMemorySettings(changed),/invalid_input/);
});
console.log(JSON.stringify({passed}));
