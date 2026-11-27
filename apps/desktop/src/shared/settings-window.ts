import type {OmniEduApi} from '../preload';

export const SETTINGS_API_PREFIX = 'settings-window:api:';
export type SettingsSessionScope = Readonly<{schemaVersion:'settings.scope.v1';epoch:number;sessionId:string|null;revision:string|null}>;
export type SettingsApiRequest = {schemaVersion:'settings.request.v1';scope:SettingsSessionScope;args:unknown[]};
type ScopeRule = 'global'|'id'|'optionalId'|'input'|'optionalInput'|'snapshot';
type Route = {channel:string;arity:readonly [number,number];scope:ScopeRule;write:boolean};
const route=(channel:string,arity:readonly[number,number],scope:ScopeRule='global',write=false):Route=>({channel,arity,scope,write});

// Reviewed settings dependencies only. No generic invoke, terminal, agent start,
// file reader, student mutation or material editor is exposed to this window.
export const SETTINGS_ROUTES = {
  getDataRoot:route('app:getDataRoot',[0,0]),
  listAiConversations:route('aiConversations:list',[0,0]),
  getXiaozhiSettings:route('xiaozhi:settings-get',[0,1],'optionalInput'),
  openXiaozhiConfigWindow:route('xiaozhi:config-window-open',[0,1],'optionalId'),
  commitXiaozhiConfig:route('xiaozhi:config-commit',[1,1],'optionalInput',true),
  getXiaozhiConfigHistory:route('xiaozhi:config-history',[1,1],'optionalInput'),
  undoXiaozhiConfig:route('xiaozhi:config-undo',[1,1],'optionalInput',true),
  stageXiaozhiCredential:route('xiaozhi:config-credential-stage',[1,1],'global',true),
  verifyXiaozhiCredential:route('xiaozhi:settings-verify',[1,1]),
  queryXiaozhiBalance:route('xiaozhi:provider-balance',[0,0]),
  saveXiaozhiWebSettings:route('xiaozhi:web-settings',[1,1],'global',true),
  getXiaozhiSkills:route('xiaozhi:skill-catalog',[0,0]),
  getXiaozhiSkillGovernance:route('xiaozhi:skill-governance',[0,0]),
  mutateXiaozhiSkillGovernance:route('xiaozhi:skill-governance-mutate',[1,1],'optionalInput',true),
  previewXiaozhiSkill:route('xiaozhi:skill-preview',[1,1]),
  manageXiaozhiSkill:route('xiaozhi:skill-mutate',[1,1],'global',true),
  getXiaozhiAcquisition:route('xiaozhi:acquisition',[1,1],'id'),
  searchXiaozhiAcquisition:route('xiaozhi:acquisition-search',[1,1],'input'),
  mutateXiaozhiAcquisition:route('xiaozhi:acquisition-mutate',[1,1],'input',true),
  listManagedTools:route('managed-tools:list',[0,0]),
  prepareManagedTool:route('managed-tools:prepare',[1,1],'global',true),
  activateManagedTool:route('managed-tools:activate',[1,1],'global',true),
  rollbackManagedTool:route('managed-tools:rollback',[1,1],'global',true),
  cancelManagedTool:route('managed-tools:cancel',[1,1],'global',true),
  removeManagedTool:route('managed-tools:remove',[1,1],'global',true),
  removeManagedToolVersion:route('managed-tools:remove-version',[1,1],'global',true),
  getXiaozhiMcpCatalog:route('xiaozhi:mcp-catalog',[0,0]),
  addXiaozhiMcp:route('xiaozhi:mcp-add',[1,1],'global',true),
  inspectXiaozhiMcp:route('xiaozhi:mcp-inspect',[1,1],'global',true),
  trustXiaozhiMcp:route('xiaozhi:mcp-trust',[1,1],'global',true),
  revokeXiaozhiMcp:route('xiaozhi:mcp-revoke',[1,1],'global',true),
  removeXiaozhiMcp:route('xiaozhi:mcp-remove',[1,1],'global',true),
  setXiaozhiMcpCredential:route('xiaozhi:mcp-credential',[1,1],'global',true),
  getXiaozhiSnapshot:route('xiaozhi:snapshot',[1,1],'snapshot'),
  getXiaozhiPermissions:route('xiaozhi:permission-view',[1,1],'id'),
  setXiaozhiPermissionMode:route('xiaozhi:permission-mode',[1,1],'input',true),
  decideXiaozhiPermission:route('xiaozhi:permission-decide',[1,1],'input',true),
  revokeXiaozhiGrant:route('xiaozhi:permission-revoke',[1,1],'input',true),
  resumeXiaozhiLegacyApproval:route('xiaozhi:permission-resume-legacy',[1,1],'input',true),
  decideXiaozhi:route('xiaozhi:decide',[1,1],'input',true),
  getXiaozhiEnvironment:route('xiaozhi:environment-view',[1,1],'id'),
  repairXiaozhiEnvironment:route('xiaozhi:environment-repair',[1,2],'id',true),
  selectXiaozhiWorkspace:route('xiaozhi:workspace',[1,1],'id',true),
  getXiaozhiMemoryCatalog:route('xiaozhi:memory-catalog',[1,1],'input'),
  setXiaozhiMemoryScope:route('xiaozhi:memory-scope',[1,1],'input',true),
  getXiaozhiMemoryTrace:route('xiaozhi:memory-trace',[1,1],'id'),
  getTeacherMemorySettings:route('xiaozhi:teacher-memory-settings',[0,0]),
  saveTeacherMemorySettings:route('xiaozhi:teacher-memory-save',[1,1],'global',true),
  getAiMemoryDocument:route('aiMemory:getDocument',[1,1]),
  updateAiMemoryEntry:route('aiMemory:updateEntry',[2,3],'global',true),
  cancelAiMemoryEntryUpdate:route('aiMemory:cancelUpdate',[1,1],'global',true),
  listHistoryMemorySessions:route('xiaozhi:history-sessions',[0,0]),
  getHistoryMemoryIndex:route('xiaozhi:history-index-status',[0,0]),
  rebuildHistoryMemoryIndex:route('xiaozhi:history-index-rebuild',[0,0],'global',true),
  listHistoryMemory:route('xiaozhi:history-list',[2,2]),
  previewHistoryMemory:route('xiaozhi:history-preview',[3,3]),
  changeHistoryMemory:route('xiaozhi:history-access',[3,3],'global',true),
  getXiaozhiResolvedAgentConfig:route('xiaozhi:resolved-agent-config',[0,1],'optionalInput'),
  getXiaozhiDecisions:route('xiaozhi:decision-history',[1,1],'id'),
  replayXiaozhiDecision:route('xiaozhi:decision-replay',[1,1],'input'),
  reviewXiaozhiDecision:route('xiaozhi:decision-shadow',[1,1],'input',true),
  reviewXiaozhiRoute:route('xiaozhi:decision-route-shadow',[1,1],'input',true),
  getTeacherCandidates:route('xiaozhi:candidate-history',[1,1],'id'),
  evaluateTeacherCandidate:route('xiaozhi:candidate-evaluate',[1,1],'input',true),
  rejectTeacherCandidate:route('xiaozhi:candidate-reject',[1,1],'input',true),
  previewXiaozhiDiagnostic:route('xiaozhi:diagnostic-preview',[1,1],'input'),
  saveXiaozhiDiagnostic:route('xiaozhi:diagnostic-save',[1,1],'input',true),
  getRetrievalStatus:route('retrieval:status',[0,0]),
  exportDataRoot:route('app:exportDataRoot',[0,1],'global',true),
  cancelDataBackup:route('app:cancelDataBackup',[0,0],'global',true),
  verifyDataBackup:route('app:verifyDataBackup',[0,0]),
  previewBackupRestore:route('app:previewBackupRestore',[0,1]),
  prepareBackupRestore:route('app:prepareBackupRestore',[0,1],'global',true),
  backupRestoreStatus:route('app:backupRestoreStatus',[0,0]),
  activateBackupRestore:route('app:activateBackupRestore',[1,1],'global',true),
  inspectWindowsUpdate:route('app:inspectWindowsUpdate',[0,0]),
  prepareWindowsUpdate:route('app:prepareWindowsUpdate',[1,1],'global',true),
} as const satisfies Partial<Record<keyof OmniEduApi,Route>>;
export type SettingsMethod=keyof typeof SETTINGS_ROUTES;
export type SettingsDomainApi=Pick<OmniEduApi,SettingsMethod|'onXiaozhiEvent'>;
export type SettingsWindowClient={
  bootstrap:()=>Promise<SettingsSessionScope>;
  getScope:()=>SettingsSessionScope|null;
  close:()=>Promise<void>;
  setBlocked:(blocked:boolean)=>Promise<void>;
  onScope:(listener:(scope:SettingsSessionScope)=>void)=>()=>void;
  onChanged:(listener:()=>void)=>()=>void;
  onCloseBlocked:(listener:()=>void)=>()=>void;
};
export type SettingsHostClient={
  open:()=>Promise<void>;
  select:(sessionId:string|null)=>Promise<SettingsSessionScope>;
  onChanged:(listener:()=>void)=>()=>void;
  onDim:(listener:(dimmed:boolean)=>void)=>()=>void;
};
