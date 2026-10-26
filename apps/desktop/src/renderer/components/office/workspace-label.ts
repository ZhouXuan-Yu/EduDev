const internalWorkspaceNames = /^(?:workspace|workspaces|workdir|work-dir|工作区)(?:[-_ ]?\d+)?$/i;

/** Hide test/internal folder names without erasing a teacher-chosen directory name. */
export function teacherWorkspaceLabel(label: string | null | undefined): string {
  const value = label?.trim();
  if (!value || internalWorkspaceNames.test(value)) return '教学工作目录';
  return value.slice(0, 200);
}
