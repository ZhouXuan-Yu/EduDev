import {isDeepStrictEqual} from 'node:util';
import type {ClassroomPlanItem} from '../../shared/classroom-plan';
import {TEACHING_LESSON_OFFICE_SCHEMA} from '../../shared/teaching-lesson-export';
import {curriculumLabel,curriculumBoundary} from '../../shared/material-curriculum';
import {teachingLessonIssues} from '../../shared/teaching-lesson';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';

/** Keep every character, including astral Unicode at paragraph boundaries. */
const chunks=(text:string)=>{const characters=Array.from(text),out:string[]=[];let part='';for(const character of characters){if(part.length+character.length>1000){out.push(part);part='';}part+=character;}if(part)out.push(part);return out;};
export function compileTeachingLessonOffice(item:ClassroomPlanItem):OfficeDraft{
 const document=item.document,lesson=document.lesson;
 if(item.status!=='confirmed'||!lesson)throw Error('not_confirmed');
 if(teachingLessonIssues(document).length)throw Error('invalid_input');
 const sections:OfficeSection[]=[];
 const section=(heading:string,paragraphs:string[])=>sections.push({heading,paragraphs:paragraphs.flatMap(chunks)});
 section('教案与版本',[
  document.title,`学科：${lesson.subject}；年级：${lesson.grade}；总时长：${document.totalMinutes} 分钟。`,
  `教案第 ${item.revision} 版；计划：${item.id}；版本：${item.version}`,
  '本文件来自教师已确认的结构化教案。正文可编辑；编辑导出文件不会回写教案账本。教学正确性仍需教师核对。'
 ]);
 section('教学目标与达成标准',document.objectives.flatMap((objective,index)=>[`目标 ${index+1}：${objective}`,`达成标准 ${index+1}：${lesson.goalCriteria[index]}`]));
 section('课前准备',lesson.preparation.length?lesson.preparation:['本教案未登记额外准备材料。']);
 const labels={introduction:'导入',activity:'活动',practice:'练习',assessment:'评价',closure:'总结'};
 for(const [index,scene]of document.scenes.entries()){
  const phase=lesson.phases.find(p=>p.sceneId===scene.sceneId);if(!phase)throw Error('invalid_input');
  section(`教学环节 ${index+1}（${scene.durationMinutes} 分钟）`,[
   scene.title,`类型：${labels[phase.kind]}；环节：${scene.sceneId}；关联目标：${phase.objectiveIndices.map(i=>i+1).join('、')}`,
   `学生活动：${scene.activity}`,`教师提示语：${phase.teacherPrompt}`,
   ...(phase.checks.length?phase.checks.flatMap((check,i)=>[
    `检查 ${i+1}（目标 ${check.objectiveIndices.map(n=>n+1).join('、')}）：${check.prompt}`,
    `预期证据：${check.expectedEvidence}`,`判断标准：${check.criterion}`
   ]):['本环节未单列检查题；请结合教案其他环节的实际检查核对目标。'])
  ]);
 }
 section('采用依据与映射',[
  curriculumBoundary,
  ...(item.context.adopted||[]).flatMap((entry,index)=>[
   `依据 ${index+1}：${curriculumLabel(entry.metadata)}`,
   `登记版本：${entry.id}；资源：${entry.source.resourceId}；内容版本：${entry.source.version}；段落：${entry.source.chunkId}`
  ]),
  ...lesson.mappings.flatMap(mapping=>[`目标 ${mapping.objectiveIndex+1} → 依据 ${mapping.curriculumIndex+1}`,`实读引用：${mapping.quote}`,`映射说明：${mapping.explanation}`]),
  ...lesson.missingSources.map(text=>`待补依据：${text}`)
 ]);
 const draft:OfficeDraft={schemaVersion:TEACHING_LESSON_OFFICE_SCHEMA,title:document.title.length<=120?document.title:'教学教案（完整标题见正文）',sections,lessonSource:{id:item.id,version:item.version,revision:item.revision}};
 if(!validOfficeDraft(draft))throw Error('too_large');return draft;
}
export function assertTeachingLessonOffice(item:ClassroomPlanItem,draft:OfficeDraft){
 if(draft.schemaVersion!==TEACHING_LESSON_OFFICE_SCHEMA)throw Error('invalid_input');
 if(!isDeepStrictEqual(compileTeachingLessonOffice(item),draft))throw Error('conflict');
}
