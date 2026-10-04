/** Local-only preview protocol. Content never becomes an agent message. */
export const XIAOZHI_FILES_SCHEMA = 'xiaozhi.files.v1' as const;
export type XiaozhiFileError = 'invalid_input' | 'permission_denied' | 'no_workspace' | 'not_found' | 'changed'
  | 'too_large' | 'unsupported' | 'busy' | 'cancelled' | 'timeout' | 'read_failed' | 'needs_ocr' | 'parse_failed' | 'empty' | 'unavailable' | 'text_unreadable';
export type XiaozhiFileFormat = 'text' | 'markdown' | 'image' | 'office' | 'unsupported';
export type XiaozhiFileEntry = { path: string; name: string; kind: 'directory' | 'file'; version: string; size: number; format: XiaozhiFileFormat };
export type XiaozhiFileInput = { schemaVersion: typeof XIAOZHI_FILES_SCHEMA; sessionId: string; requestId: string; path: string; workspaceVersion?: string };
export type XiaozhiPreviewInput = XiaozhiFileInput & { workspaceVersion: string; version: string };
export type XiaozhiFileResult<T> = { ok: true; schemaVersion: typeof XIAOZHI_FILES_SCHEMA; requestId: string; workspaceVersion: string; data: T }
  | { ok: false; schemaVersion: typeof XIAOZHI_FILES_SCHEMA; requestId: string; error: XiaozhiFileError };
export type XiaozhiFileList = { label: string; path: string; entries: XiaozhiFileEntry[]; partial: boolean };
export type XiaozhiFilePreview = { path: string; name: string; version: string; size: number; format: XiaozhiFileFormat; text?: string; image?: string; document?: { format: 'docx'|'pdf'|'xlsx'|'pptx'; parser: 'hana-anydoc-0.1.2'; warnings: string[] } };
export const XIAOZHI_FILE_ERRORS: Record<XiaozhiFileError,string> = {
  invalid_input:'文件请求无效，请刷新后重试。', permission_denied:'此文件不在当前授权范围内。', no_workspace:'请先为本会话选择教学工作目录。',
  not_found:'文件或目录已不存在，请刷新。', changed:'文件或目录已变化，请刷新后重新打开。', too_large:'文件超过本地预览大小限制。',
  unsupported:'暂不支持预览此文件格式。', busy:'文件操作正在处理中，请稍后重试。', cancelled:'已取消读取。', timeout:'读取超时，请重试。', read_failed:'无法读取本地文件，请检查后重试。',
  needs_ocr:'这份 PDF 没有可读取的文字层，请先进行本地 OCR 并校正。', parse_failed:'文档无法解析，请检查文件是否损坏或受密码保护。',
  empty:'此文档未提取到可显示的正文。', unavailable:'本地文档解析组件未能运行，请重试或检查应用安装。',
  text_unreadable:'部分文字无法正确解码，请使用具有正确文字映射的文件，或先进行本地 OCR 并校正。',
};
