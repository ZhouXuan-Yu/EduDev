export type OfficeToolName = 'office_read_text' | 'office_file_stat' | 'office_list_files'
  | 'office_copy_file' | 'office_web_fetch' | 'office_web_search';

export type OfficeToolErrorCode = 'invalid_input' | 'permission_denied' | 'not_found'
  | 'too_large' | 'unsupported' | 'conflict' | 'cancelled' | 'timeout'
  | 'network' | 'dns_blocked' | 'rate_limited' | 'service_error' | 'budget_exhausted';

export type OfficeToolResult = {
  schemaVersion: 'xiaozhi.office.tool.v1';
  tool: OfficeToolName;
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: OfficeToolErrorCode; message: string; retryable: boolean };
};

export type OfficeCopyApproval = Readonly<{
  sessionId: string;
  runId: string;
  callId: string;
  tool: 'office_copy_file';
  source: string;
  target: string;
  sourceSha256: string;
}>;
