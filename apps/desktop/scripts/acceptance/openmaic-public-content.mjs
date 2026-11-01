/** Only teacher-facing educational fields may cross this evidence boundary. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const fixtureSha256='309735f1bb95aef4b849af7a759848393a4b780d52269abaae0c390f36fccf90';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const visiblePdfText=`浮力课堂研究资料（本地调研合成样例）
对象：八年级；课时：40分钟；仅作为软件流程测试。
目标：通过弹簧测力计示数的变化认识浮力方向和大小。
实验：同一物体在空气中的重力为3N，浸没水中示数为2N。
问题：物体受到多大的浮力？为什么不能仅凭浮力判断上浮？
检查：浮力方向竖直向上；重力与浮力共同影响浮沉。
活动：先预测，再记录部分浸入和完全浸没时的示数，最后解释。
教师核对提示：这是合成资料，不代表正式教材或有效学生证据。`;
export const requirement='请实读附件 buoyancy-review.pdf，基于其中3 N与2 N的测力计实验，为八年级设计40分钟浮力课。先只提交可编辑大纲：两页讲解幻灯片和一页单选题，合计40分钟，目标包含“受浮力不一定上浮”。不要联网、仿真、外部图片、配音、视频或脚本；等我在页面确认大纲后才逐页生成。';
const text=value=>typeof value==='string'?value.slice(0,24000):'';
const texts=value=>Array.isArray(value)?value.map(text):[];
export function publicOutline(run){
 return {title:text(run.outline?.courseTitle),revision:run.outline?.revision,
  scenes:(run.outline?.outlines||[]).map(o=>({id:text(o.id),type:o.type,title:text(o.title),description:text(o.description),
   keyPoints:texts(o.keyPoints),teachingObjective:text(o.teachingObjective),estimatedDuration:o.estimatedDuration,order:o.order,
   quizConfig:o.quizConfig?{questionCount:o.quizConfig.questionCount,questionTypes:texts(o.quizConfig.questionTypes)}:undefined}))};
}
export function assertOutline(run){
 const outline=publicOutline(run),scenes=outline.scenes;
 assert.equal(scenes.length,3,'Outline must have exactly three scenes');
 assert.deepEqual(scenes.map(s=>s.type),['slide','slide','quiz'],'Expected two slides followed by one quiz');
 assert(scenes.every(s=>Number.isFinite(s.estimatedDuration)&&s.estimatedDuration>0),'Outline must expose real durations in seconds');
 assert.equal(scenes.reduce((sum,s)=>sum+s.estimatedDuration,0),2400,'Outline durations must total 40 minutes');
 const quiz=scenes[2].quizConfig;
 assert(quiz&&quiz.questionCount===1&&quiz.questionTypes.length===1&&quiz.questionTypes[0]==='single','Exactly one single-choice question required');
 assert(run.outline.outlines.every(o=>!(o.mediaGenerations?.length)&&!(o.suggestedImageIds?.length)),'Outline requested media despite no-media task');
 const joined=JSON.stringify(outline).replace(/\s/g,'');
 assert(/3(?:N|牛顿|牛)/i.test(joined)&&/2(?:N|牛顿|牛)/i.test(joined),'Outline must use both source measurements');
 assert(/浮力/.test(joined)&&/(不一定|不等于|并不|未必|不意味着).{0,30}上浮/.test(joined),'Outline must address buoyancy versus rising');
 return outline;
}
export function publicDocument(document){
 assert(Array.isArray(document.scenes),'Missing persisted stage scenes');
 return {title:text(document.stage?.name||document.stage?.title),scenes:document.scenes.map(s=>({id:text(s.id),type:s.type,title:text(s.title),
  textHtml:s.type==='slide'?(s.content?.canvas?.elements||[]).filter(e=>e.type==='text').map(e=>text(e.content)):undefined,
  questions:s.type==='quiz'?(s.content?.questions||[]).map(q=>({id:text(q.id),type:q.type,question:text(q.question),
   options:(q.options||[]).map(o=>({label:text(o.label),value:text(o.value)})),answer:texts(q.answer),analysis:text(q.analysis),points:q.points})):undefined}))};
}
export function assertScenes(document){
 assert.equal(document.scenes?.length,3,'Persisted stage must contain exactly three scenes');
 assert.deepEqual(document.scenes.map(s=>s.type),['slide','slide','quiz']);
 for(const scene of document.scenes){
  assert.equal(scene.content?.type,scene.type,'Incomplete scene content');
  if(scene.type==='slide'){
   const canvas=scene.content.canvas;
   assert(Array.isArray(canvas?.elements)&&canvas.elements.some(e=>e.type==='text'&&e.content?.trim()),'Slide contains no educational text');
   assert(!canvas.elements.some(e=>['image','video','audio','iframe','web','interactive'].includes(e.type)),'Unexpected generated media');
   assert(!canvas.background||!['image','video'].includes(canvas.background.type),'Unexpected media background');
  }
 }
 const questions=document.scenes[2].content.questions;
 assert.equal(questions?.length,1,'Exactly one question required');
 assert.equal(questions[0].type,'single','No model-graded short answers allowed');
 assert(questions[0].options?.length>=2&&questions[0].answer?.length===1,'Invalid single-choice question');
 return publicDocument(document);
}
export function publicSettings(view){
 assert(Array.isArray(view.slots),'Model slot API unavailable; cannot establish actual provider configuration');
 return {revision:view.revision,slots:view.slots.map(s=>({slot:s.slot,capability:s.capability,locked:s.locked,status:s.effective?.status,
  providerId:s.effective?.providerId,registryId:s.effective?.registryId,modelId:s.effective?.modelId,resolvedAt:s.effective?.resolvedAt}))};
}
export function assertLocalOnlySettings(settings){
 const optional=settings.slots.filter(s=>['image','video','webSearch','tts'].includes(s.capability)||/^(image|video|webSearch|tts)(\.|$)/.test(s.slot));
 assert(!optional.some(s=>s.status==='assigned'),'Disable deployment image/video/webSearch/tts slots before paired test; script never rewrites global configuration');
 const document=settings.slots.find(s=>s.slot==='document');
 assert(document?.status==='assigned'&&[document.providerId,document.registryId].some(v=>v==='unpdf'),'Real PDF upload requires local unpdf document slot; external extraction is not authorized by this test');
 // course.agents may deliberately be off: the reference then uses preset agents.
 for(const slot of ['course.outline','course.content.slide','course.content.quiz','course.actions']){
  assert(settings.slots.some(s=>s.slot===slot&&s.status==='assigned'),`Required generation slot unavailable: ${slot}`);
 }
}
