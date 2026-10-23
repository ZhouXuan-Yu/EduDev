import type {OfficeProjectedItem} from '../../shared/office-agent';
const discovery = new Set(['search_teacher_knowledge','education_search_questions','education_search_materials','office_list_materials','office_list_attachments','office_list_files','office_web_search']);
const reading = new Set(['office_read_material','education_read_question','office_read_attachment','office_read_document','office_read_text','office_web_fetch','education_verify_material_quote']);
/** Only host-produced counts and a separately sanitized query can become public facts. */
export function publicToolResult(tool: string, success: boolean, data?: {count?: unknown; sources?: unknown[]}, query?: string): NonNullable<OfficeProjectedItem['resultSummary']> {
  const scope = discovery.has(tool) ? 'discovery' : reading.has(tool) ? 'read' : 'operation';
  const count = typeof data?.count === 'number' && Number.isSafeInteger(data.count) && data.count >= 0 ? data.count : undefined;
  const text = !success ? '操作未完成，已完成的结果保留。' : scope === 'discovery'
    ? count === 0 ? '没有找到匹配内容。' : count !== undefined ? `本次返回 ${count} 项，需读取正文后才能作为依据。` : '查询已结束，返回范围见实际来源；不代表已完成教学任务。'
    : scope === 'read' ? '已读取本次授权内容，请结合来源核对；未证明答案正确。' : '操作已返回，保存和审核状态以对应结果卡为准。';
  return {version:1,scope,text,...(count!==undefined?{count}:{}),...(query?{query:query.slice(0,140)}:{})};
}
