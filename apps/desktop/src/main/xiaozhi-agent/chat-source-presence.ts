import type {ChatSourceAvailability} from '../../shared/chat-source-availability';

/** Record existence is a scope hint. Eligibility and source authority stay in each read tool. */
export async function readChatSourcePresence(all:(sql:string)=>Promise<Record<string,unknown>[]>):Promise<Pick<ChatSourceAvailability,'knowledge'|'materials'|'questions'>>{
 const [row]=await all(`SELECT
  EXISTS(SELECT 1 FROM resource_chunks LIMIT 1) AS knowledge,
  EXISTS(SELECT 1 FROM teacher_resources LIMIT 1) AS materials,
  EXISTS(SELECT 1 FROM question_bank_items LIMIT 1) AS questions`);
 if(!row||['knowledge','materials','questions'].some(k=>row[k]!==0&&row[k]!==1))throw Error('unavailable');
 return {knowledge:row.knowledge===1,materials:row.materials===1,questions:row.questions===1};
}
