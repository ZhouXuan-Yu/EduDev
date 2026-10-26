import {officeMathChunks} from '../../shared/office-math';
import {CLASSROOM_OFFICE_SCHEMA,CLASSROOM_DOCUMENT_OFFICE_SCHEMA,type ClassroomOfficeSource,type ClassroomDocumentPurpose} from '../../shared/classroom-export';
import {validOfficeDraft,type OfficeDraft} from '../../shared/xiaozhi-office-draft';
import type {ClassroomItem} from '../../shared/classroom';
export function compileClassroomOffice(item:ClassroomItem,includeAnswers:boolean,purpose?:ClassroomDocumentPurpose):OfficeDraft{
 if(item.status!=='confirmed'||!item.revision||typeof includeAnswers!=='boolean')throw Error('conflict');
 if(purpose!==undefined&&(purpose!=='handout'&&purpose!=='teacher_notes'||includeAnswers!==(purpose==='teacher_notes')))throw Error('invalid_input');
 const source:ClassroomOfficeSource={classroomId:item.id,version:item.version,revision:item.revision,includeAnswers,document:structuredClone(item.document),...(item.context?{context:structuredClone(item.context)}:{}),...(purpose?{purpose}:{})};
 const sections=item.document.scenes.map((scene,index)=>({heading:`${index+1}. ${scene.title}`.slice(0,120),paragraphs:scene.type==='slide'?['完整课页按已确认的图形、文字和公式导出。']:scene.type==='quiz'?scene.content.questions.flatMap((q,i)=>[`${i+1}. ${q.question}`,...(q.options||[]).map(o=>`${o.value}. ${o.label}`),...(includeAnswers?[`参考答案：${q.answer?.join('、')}`,`解析：${q.analysis}`]:[]) ]).flatMap(text=>purpose?officeMathChunks(text):text.match(/[\s\S]{1,1000}/gu)||[]):[]}));
 if(purpose){
  for(const [index,scene]of item.document.scenes.entries())if(scene.type==='slide')sections[index].paragraphs=[purpose==='handout'?'课堂课页（含完整图形与公式，图片不可编辑）。':'备课参考：本页为已确认课页，未包含逐字讲述稿；请结合图示自行讲解。'];
  sections.unshift({heading:purpose==='handout'?'学生讲义':'教师备课稿',paragraphs:[`来自已确认课堂第 ${item.revision} 版。课页以完整本地图片保留，图形和公式不可编辑。`,purpose==='handout'?'随堂题不附参考答案与解析；课页原有文字仍完整保留，请教师检查是否适合发给学生。':'本稿附课堂已有参考答案和解析，未独立验证正确性；不是逐字讲稿。']});
 }
 const draft:OfficeDraft={schemaVersion:purpose?CLASSROOM_DOCUMENT_OFFICE_SCHEMA:CLASSROOM_OFFICE_SCHEMA,title:item.document.title.slice(0,120),sections,classroomSource:source};
 if(!validOfficeDraft(draft))throw Error('too_large');return draft;
}
export function assertClassroomOffice(item:ClassroomItem,draft:OfficeDraft){
 if(!('classroomSource'in draft))throw Error('invalid_input');
 const expected=compileClassroomOffice(item,draft.classroomSource.includeAnswers,draft.classroomSource.purpose);
 if(JSON.stringify(expected)!==JSON.stringify(draft))throw Error('conflict');
}
