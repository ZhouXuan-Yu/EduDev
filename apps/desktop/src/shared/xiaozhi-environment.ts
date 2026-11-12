export type EnvironmentStatus = 'ready' | 'needs_configuration' | 'missing_credential' | 'unavailable' | 'offline';
export type EnvironmentView = {
  schemaVersion: 1;
  sessionId: string;
  platform: {os: string; arch: string; node: string; electron: string | null};
  checks: {id: string; label: string; status: EnvironmentStatus; detail: string}[];
  configuration: {recipe: 'workspace_text'; path: '.xiaozhi/environment.json'; sha256: string | null};
  permissionRuntime?: {status: 'ready' | 'needs_configuration' | 'unavailable'; sourceHash: string; helperHash: string | null};
};
export type EnvironmentRepairResult = {
  schemaVersion: 1;
  recipe: 'workspace_text' | 'permission_runtime';
  path: string;
  beforeHash: string | null;
  afterHash: string;
  changed: boolean;
  grantRefs: {grantId: string; revision: number}[];
};
