export interface ChatSourceAvailability { knowledge: boolean; materials: boolean; questions: boolean; attachments: boolean; workspace: boolean }
export function sourceAvailabilityText(value: ChatSourceAvailability): string {
  const names: [keyof ChatSourceAvailability,string][] = [['knowledge','可检索知识片段'],['materials','本地资料'],['questions','本地题库'],['attachments','本会话已发送附件'],['workspace','教师授权工作目录']];
  return '宿主已核对本机可用范围（仅说明是否存在，不证明内容相关或已读取）：'+names.map(([key,label])=>`${label}${value[key]?'可用':'暂无'}`).join('；')+'。普通备课/解释且用户未指定资料时，直接给简短的通用建议并标明假设，不为走流程反复检索目录。一节课的简短安排、几道练习和答案可以直接作为一份回复交付，不因包含多个小节就调用update_plan或读取历史记忆。只有需要实际跨工具执行、持久目标推进或教师明确要求跟踪进度时才公布工具计划。用户要求依据教材或已有资料而范围为空时，说明缺失并请教师添加，禁止虚构来源。必须澄清的关键决定用ask_teacher；可合理假设的事项明确标注并先交付可用稿。';
}
/** Hide known-empty read entrances from this request only; main permissions remain unchanged. */
export function availableChatTool(name: string, value: ChatSourceAvailability): boolean {
  if(name==='search_teacher_knowledge')return value.knowledge;
  if(['office_list_materials','office_read_material','education_search_materials','education_verify_material_quote'].includes(name))return value.materials;
  if(['education_search_questions','education_read_question'].includes(name))return value.questions;
  if(['office_list_attachments','office_read_attachment'].includes(name))return value.attachments;
  if(['office_list_files','office_read_text','office_file_stat'].includes(name))return value.workspace;
  return true;
}
