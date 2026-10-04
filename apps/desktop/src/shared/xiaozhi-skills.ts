/** Public metadata only. Host file pointers and native snapshots remain in main. */
export type XiaozhiSkill = { name: string; title: string; description: string; instructions: string; supports: string[] };

export type XiaozhiManagedSkill = { name: string; title: string; description: string; origin: 'builtin' | 'teacher'; version: number; enabled: boolean; archived: boolean };
export type XiaozhiSkillCatalog = { revision: number; locked: boolean; skills: XiaozhiManagedSkill[] };
export type XiaozhiSkillPreview = { revision: number; name: string; version: number; document: string };
export type XiaozhiSkillMutation = { action: 'import'; revision: number }
  | { action: 'enable'; revision: number; name: string; enabled: boolean }
  | { action: 'edit'; revision: number; name: string; document: string }
  | { action: 'archive'; revision: number; name: string };
export type XiaozhiSkillError = 'invalid_input' | 'permission_denied' | 'busy' | 'stale_version' | 'skill_exists' | 'skill_source_changed' | 'configuration';
export type XiaozhiSkillResult<T> = { ok: true; value: T } | { ok: false; error: XiaozhiSkillError };
export type XiaozhiSkillMutationResult = XiaozhiSkillResult<{ catalog: XiaozhiSkillCatalog; cancelled: boolean }>;
export const XIAOZHI_SKILL_ERRORS: Record<XiaozhiSkillError, string> = {
  invalid_input: '技能格式或操作不正确，请检查名称和说明。', permission_denied: '这项操作不可用。内建技能可以启停，完整说明由应用维护。',
  busy: '小智正在处理任务或技能操作，请等待完成或先停止任务。', stale_version: '技能列表已更新。已重新读取，请核对后再次操作。',
  skill_exists: '已有同名技能，请编辑已有技能或使用其他名称。', skill_source_changed: '技能文件已变更或不可用，请检查文件；也可以先关闭该技能继续工作。',
  configuration: '暂时无法读取本地技能配置，请重试。',
};
