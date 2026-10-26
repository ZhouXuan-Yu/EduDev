import type { OfficeProjectedItem } from '../../../shared/office-agent';

export type AgentToolKind =
  | 'file-read'
  | 'directory'
  | 'file-write'
  | 'web-search'
  | 'web-read'
  | 'browser'
  | 'knowledge'
  | 'question'
  | 'plan'
  | 'memory'
  | 'image'
  | 'tool';
const groups: Partial<Record<AgentToolKind, string[]>> = {
  'file-read': [
    'office_read_text',
    'office_read_attachment',
    'office_read_material',
    'office_read_document',
    'office_file_stat',
  ],
  directory: ['office_list_attachments', 'office_list_materials', 'office_list_files'],
  'file-write': [
    'office_create_text',
    'office_edit_text',
    'office_copy_file',
    'office_create_document',
  ],
  'web-search': ['office_web_search'],
  'web-read': ['office_web_fetch'],
  browser: ['office_browser'],
  knowledge: [
    'search_teacher_knowledge',
    'education_search_materials',
    'education_verify_material_quote',
    'education_search_questions',
    'education_read_question',
    'education_read_student_context',
    'education_analyse_learning',
    'read',
  ],
  question: ['ask_teacher', 'education_propose_learning_change'],
  plan: ['update_plan', 'report_goal_progress'],
  memory: ['read_education_memory', 'read_session_process'],
  image: ['office_view_public_image'],
};
const kinds = new Map(
  Object.entries(groups).flatMap(([kind, names]) =>
    names.map((name) => [name, kind as AgentToolKind] as const),
  ),
);

/** Identity survives translation. Missing historical identities stay explicitly generic. */
export function agentToolKind(item: OfficeProjectedItem): AgentToolKind {
  return kinds.get(item.toolName || '') ?? (item.imageDelivery ? 'image' : 'tool');
}
