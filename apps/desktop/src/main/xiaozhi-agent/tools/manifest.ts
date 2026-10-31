import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
export type ToolEffect='safe_read'|'local_cache'|'local_write'|'external_effect';
export type ToolManifest={version:1;name:string;effect:ToolEffect;timeoutMs:number;maxAttempts:1|2;resource:'none'|'workspace'|'output'|'session';lock:'read'|'write';cancel:'signal_and_wait_bound';input:'sdk_and_domain';output:'bounded_pi_result_and_domain';teacherWait:'pause_active_deadline'};
const safe=['education_compute','education_read_classroom','office_read_text','office_file_stat','office_list_files','office_list_materials','office_list_attachments','office_web_fetch','office_web_search','read','read_education_memory','read_session_process','read_teacher_request','search_teacher_knowledge','education_search_materials','education_verify_material_quote','education_search_questions','education_read_question','education_read_student_context','education_analyse_learning','education_read_paper','education_read_practice','education_find_similar_questions'];
// These reads can create bounded local parse/OCR/reference state; they must not be retried as pure reads.
const cache=['education_check_delivery','prepare_education_tool','office_read_material','office_read_document','office_read_attachment','education_read_material_page','education_prepare_classroom_scene','office_view_public_image'];
const writes=['education_create_report','office_copy_file','office_create_text','office_create_science_figure','office_edit_text','office_create_document','office_deliver_files','education_export_paper','education_export_classroom','education_stage_classroom','education_propose_questions','education_propose_original_question','education_propose_original_questions','education_propose_paper','education_propose_practice','education_propose_learning_change','education_begin_paper_questions','education_append_paper_questions','education_review_paper_questions','update_plan','ask_teacher','report_goal_progress'];
// Image preparation is local; its actual upload belongs to streamFn/payload and
// PublicImageDelivery receipts, after this tool returns and new teacher consent.
const external=['office_browser'];
safe.push('find_education_tools');
writes.push('education_web_answer');
const categories=new Map<string,ToolEffect>([...safe.map(n=>[n,'safe_read'] as const),...cache.map(n=>[n,'local_cache'] as const),...writes.map(n=>[n,'local_write'] as const),...external.map(n=>[n,'external_effect'] as const)]);
export function toolManifest(name:string,trustedMcpNames:ReadonlySet<string>=new Set()):ToolManifest{
 const effect=(name==='update_task_plan'?'local_write':categories.get(name)) || (name.startsWith('mcp_') && trustedMcpNames.has(name) ? 'safe_read' : undefined);if(!effect)throw Error('tool_manifest_missing');
 const web=name==='office_web_fetch'||name==='office_web_search';
 const files=['education_check_delivery','education_create_report','office_read_text','office_file_stat','office_list_files','office_copy_file','office_create_text','office_create_science_figure','office_edit_text','office_create_document','office_deliver_files','office_read_document'].includes(name);
 const output=name==='education_export_paper'||name==='education_export_classroom';
 const localRead=['office_read_text','office_file_stat','office_list_files'].includes(name);
 return Object.freeze({version:1,name,effect,timeoutMs:web?45000:effect==='safe_read'?60000:300000,maxAttempts:web||localRead?2:1,resource:output?'output':files?'workspace':web||effect==='safe_read'?'none':'session',lock:effect==='safe_read'?'read':'write',cancel:'signal_and_wait_bound',input:'sdk_and_domain',output:'bounded_pi_result_and_domain',teacherWait:'pause_active_deadline'});
}
export function manifestForTools(definitions:readonly ToolDefinition[],trustedMcpNames:ReadonlySet<string>=new Set()):readonly ToolManifest[]{
 if(new Set(definitions.map(d=>d.name)).size!==definitions.length)throw Error('tool_manifest_conflict');
 return definitions.map(d=>{if(!d.parameters||typeof d.execute!=='function')throw Error('tool_manifest_invalid');return toolManifest(d.name,trustedMcpNames);});
}
