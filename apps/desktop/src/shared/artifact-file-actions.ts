const artifactFileExtensions = /\.(?:md|txt|csv|json|yaml|yml|log|html|docx|pptx|xlsx|pdf|zip|png|jpe?g|webp|gif|svg)$/i;
export const isArtifactFileName = (name: string) => artifactFileExtensions.test(name);

export type ArtifactFileTarget =
  | {kind: 'workspace'; sessionId: string; path: string; workspaceVersion: string; version: string}
  | {kind: 'saved'; sessionId: string; artifactId: string};

export type ArtifactFileAction = 'open' | 'open-with' | 'reveal' | 'save-as' | 'location';
export type ArtifactFileActionInput = {target: ArtifactFileTarget; action: ArtifactFileAction};
export const ARTIFACT_FILE_ERRORS = {
  invalid_input: '文件操作请求无效，请重新选择文件。',
  permission_denied: '当前无法访问此文件，请检查保存记录或目录授权。',
  not_found: '文件已移走或删除，请刷新后重试。',
  changed: '文件、保存版本或授权已变化，请重新选择文件。',
  unsupported: '此文件类型或系统暂不支持该操作。',
  too_large: '文件超过 64 MB，暂不能在这里另存为。',
  conflict: '目标文件已存在，请换一个名称。',
  busy: '请先完成正在进行的文件操作。',
  failed: '文件操作未完成，请检查文件或目标目录后重试。',
};
export type ArtifactFileActionResult =
  | {ok: true; cancelled?: true; name?: string; location?: string[]}
  | {ok: false; error: keyof typeof ARTIFACT_FILE_ERRORS};
