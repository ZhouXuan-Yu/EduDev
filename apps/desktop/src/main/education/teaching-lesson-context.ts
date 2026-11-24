import type {ClassroomPlanDocument} from '../../shared/classroom-plan';
import type {ClassroomContext} from '../../shared/classroom-context';
import type {Sql} from '../xiaozhi-agent/session-state';
import {sameMaterialSource} from '../assets/material-source';

/** Only the host selects versions; model mappings reference those by bounded index. */
export async function assertTeachingLessonContext(sql:Sql,document:ClassroomPlanDocument,context:ClassroomContext){
 const lesson=document.lesson;if(!lesson)return;
 const adopted=context.adopted||[];
 for(const entry of adopted){
  const source=entry.source;
  if(!context.materials.some(m=>!m.truncated&&sameMaterialSource(m.source,source)))throw Error('source_required');
 }
 for(const mapping of lesson.mappings){
  const entry=adopted[mapping.curriculumIndex];if(!entry)throw Error('invalid_input');
  const row=(await sql.all('SELECT content_md FROM resource_chunks WHERE id=? AND resource_id=?',[entry.source.chunkId,entry.source.resourceId]))[0];
  if(!row||!String(row.content_md).includes(mapping.quote))throw Error('source_changed');
 }
 if((!adopted.length||document.objectives.some((_,i)=>!lesson.mappings.some(m=>m.objectiveIndex===i)))&&!lesson.missingSources.length)throw Error('source_required');
}
