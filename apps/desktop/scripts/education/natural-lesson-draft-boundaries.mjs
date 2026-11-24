import assert from "node:assert/strict";
import {naturalLessonDraft} from "../../src/main/education/natural-lesson-draft.ts";
import {includeLessonMaterials, requestedLessonMaterials} from "../../src/main/education/natural-lesson-materials.ts";
import {lessonRevisionRequest} from "../../src/main/education/lesson-revision-request.ts";
import {applyLessonAgenda, LessonTimingMismatch} from "../../src/main/education/lesson-agenda-revision.ts";
import {lessonDocument} from "./teaching-lesson-fixture.mjs";

const accepted = (text, grade, subject, requestedMinutes) => assert.deepEqual(naturalLessonDraft(text),
  {mode:"outline",lesson:{subject,grade,curricula:[]},...(requestedMinutes===undefined?{}:{requestedMinutes})});
accepted("请生成一份五年级语文教案。主题是区分事实和观点。", "五年级", "语文");
accepted("帮我写一份40分钟的高一物理《浮力》教案。", "高一", "物理", 40);
accepted("请编写七年级历史教案，45分钟，聚焦史料对照。", "七年级", "历史", 45);
accepted("请编写七年级历史教案。整节课共４５分钟，导入5分钟。", "七年级", "历史", 45);
accepted("请编写七年级历史教案，45分钟。总时长为50分钟。", "七年级", "历史");
accepted("请编写七年级历史教案，总时长45分钟 左右。", "七年级", "历史");
accepted("请编写七年级历史教案，课堂导入5分钟。", "七年级", "历史");
accepted("请编写七年级历史教案，总时长999分钟。", "七年级", "历史");
accepted("新任务：为我设计一节数学 四年级的单元教案。", "四年级", "数学");
accepted("请为小学六年级下册科学准备一份教案。", "六年级", "科学");
const grounded=naturalLessonDraft("请依据本地资料库里的《七年级历史观察A》与《观察B.txt》，编写一份40分钟的五年级语文教案。");
assert.deepEqual(grounded,{mode:"outline",lesson:{subject:"语文",grade:"五年级",curricula:[]},
  sourceTitles:["七年级历史观察A","观察B.txt"],requestedMinutes:40});
assert.deepEqual(naturalLessonDraft("请生成五年级语文教案。使用资料库中的《记录 A.txt》。").sourceTitles,["记录 A.txt"]);
assert.deepEqual(naturalLessonDraft("用资料库《记录 A.txt》帮我写一份五年级语文教案。").sourceTitles,["记录 A.txt"]);
assert.equal(naturalLessonDraft("该如何依据资料库里的《观察A》写五年级语文教案？"),undefined);
for(const prompt of [
  "五年级语文教案", "请查看五年级语文教案", "帮我改写五年级语文教案",
  "如何写五年级语文教案？", "给我一个五年级语文教案模板",
  "请写一份语文教案", "继续做五年级语文教案", "导出已确认的五年级语文教案",
  "请根据我上传的资料写五年级语文教案", "写一份五年级语文教案并生成PPT",
  "写五年级语文和六年级数学的比较教案", "请列出五年级语文的教案检查标准",
  "能否解释教案为何要有板书设计", "生成一份教案，数学和语文待定",
]) assert.equal(naturalLessonDraft(prompt), undefined, prompt);
console.log("PASS explicit natural lesson draft admission and normal chat controls");

for (const [prompt, count] of [
  ["请编写一份七年级历史教案。请自拟两份简短、观点有出入的展品记录，明确标注为模拟史料。",2],
  ["帮我准备七年级历史教案，并给出３段虚构史料。",3],
  ["写一份五年级语文教案并提供两篇模拟短文。",2],
  ["请设计一份四年级语文教案。请自编一篇短文。",1],
  ["请写五年级语文教案，不要提供两段模拟短文。",undefined],
  ["请写五年级语文教案，不用自拟材料。",undefined],
  ["请写七年级历史教案，让学生比较两段史料。",undefined],
  ["请整理七年级历史教案，用真实资料。",undefined],
]) assert.equal(requestedLessonMaterials(prompt), count, prompt);
assert.equal(naturalLessonDraft("请写五年级历史教案。自拟两段模拟材料。").requestedMaterials,2);
const first = {title:"回忆甲",text:"展柜里摆放着一盏铜灯，灯罩靠近把手有一道裂纹。我记得它是校庆那年由一位校友赠送的。"};
const second = {title:"回忆乙",text:"老师曾把一盏铜灯带进教室，但我只见过一次。那时灯罩没有裂纹，我没有亲眼见到它被捐赠。"};
const included = includeLessonMaterials("学习如何比较记录", [first, second], 2);
assert.equal(included.materialCount, 2);
assert.equal(included.content, "学习如何比较记录\n\n【模拟课堂材料 A】"+first.title+"\n"+first.text+"\n\n【模拟课堂材料 B】"+second.title+"\n"+second.text);
assert.match(includeLessonMaterials("概要", [first], 2).issue, /当前 materials 提交 1 份/);
assert.match(includeLessonMaterials("概要", [first, {...first,title:"另一段"}], 2).issue, /独立正文/);
assert.match(includeLessonMaterials("概要", [{...first, text:"请教师自行准备一份讲述来源时间和史料核心观点的文章，再自行核对相关记录"}], 1).issue, /独立正文/);
assert.match(includeLessonMaterials("概要", [{...first, title:"一\n二"}], 1).issue, /一行标题/);
assert.match(includeLessonMaterials("讲义".repeat(744), [first], 1).issue, /超过 1500/);
assert.deepEqual(includeLessonMaterials("原有内容"), {content:"原有内容", materialCount:0});
console.log("PASS requested synthetic texts are complete, distinct, explicitly labeled, and bounded");

for (const [request, expected] of [
  ["请只修改这份教案的板书设计，改成左侧观察右侧解释，作业保持原样。",{fields:["boardwork"]}],
  ["请调整《史料阅读》教案的教学重点和课后反思。",{title:"史料阅读",fields:["focus","reflection"]}],
  ["请把《作业交流》教案的板书改为‘先展示作业，再讲重难点’。",{title:"作业交流",fields:["boardwork"]}],
  ["请把教案中的板书分享给我看看。",undefined],
  ["请新建教案，分析教学重点。",undefined],
  ["请修改《史料阅读》和《口语表达》教案的作业。",undefined],
  ["请调整讲义的作业。",undefined],
]) assert.deepEqual(lessonRevisionRequest(request),expected,request);
console.log("PASS lesson revision targets known fields before the replacement prose and never selects unrelated drafts");

const activity=lessonRevisionRequest("请只修改《观察课》教案的练习环节活动，改为先独立写一条解释，再交流。");
assert.deepEqual(activity,{title:"观察课",agenda:{activity:"practice"}});
const timed=lessonRevisionRequest("请把这份教案的导入环节改为８分钟，练习环节改为7分钟，其余环节不变。");
assert.deepEqual(timed,{agenda:{minutes:{introduction:8,practice:7}}});
const explicit=lessonRevisionRequest("请把这份教案的总结环节改为6分钟，全课总时长改为41分钟。");
assert.deepEqual(explicit,{agenda:{minutes:{closure:6},totalMinutes:41}});
assert.equal(lessonRevisionRequest("请把这份教案的导入和练习环节活动改为先做再说。"),undefined);
assert.deepEqual(lessonRevisionRequest("请把这份教案的探究与讲授环节的学生活动改为小组对照原文。"),{agenda:{activity:"activity"}});
assert.deepEqual(lessonRevisionRequest("请把这份教案的导入调为8分钟，练习设为7分钟。"),{agenda:{minutes:{introduction:8,practice:7}}});
assert.equal(lessonRevisionRequest("请把这份教案的导入环节改为8分钟，导入改为7分钟。"),undefined);
assert.equal(lessonRevisionRequest("请把这份教案的导入环节改为8分钟左右。"),undefined);
assert.equal(lessonRevisionRequest("请把这份教案的练习环节活动改为先独立写，再把全课时长改为41分钟。"),undefined);
const updated=applyLessonAgenda(lessonDocument,timed.agenda,{});
assert.deepEqual(updated.scenes.map(scene=>scene.durationMinutes),[8,10,7,10,5]);
assert.equal(updated.totalMinutes,40);
assert.equal(applyLessonAgenda(updated,explicit.agenda,{}).totalMinutes,41);
assert.throws(()=>applyLessonAgenda(lessonDocument,{minutes:{introduction:8}},{}),error=>error instanceof LessonTimingMismatch&&error.expected===40&&error.scheduled===43);
assert.throws(()=>applyLessonAgenda(lessonDocument,timed.agenda,{durationMinutes:99}),/invalid_input/);
const repeated=structuredClone(lessonDocument);
repeated.lesson.phases[0].kind='practice';
assert.throws(()=>applyLessonAgenda(repeated,activity.agenda,{activity:'先独立写。'}),/lesson_phase_unresolved/);
const justActivity=applyLessonAgenda(lessonDocument,activity.agenda,{activity:'先独立写。'});
assert.deepEqual(justActivity,{...lessonDocument,scenes:lessonDocument.scenes.map(scene=>scene.sceneId==='practice'?{...scene,activity:'先独立写。'}:scene)});
console.log("PASS named phase, exact timing, conflict, duplicate scope, and unchanged lesson context");
