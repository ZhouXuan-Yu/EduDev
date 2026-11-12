import { snapshotToolInvocationInput } from '../../ai-harness/vendor/openhanako-tool-input-snapshot';
import { protocolHash } from '../capabilities/validation';
import { PERMISSION_MODES, type PermissionRequest, type PermissionScope, type ScopeGrant, type PermissionProfile, type PermissionApproval } from '../../../shared/xiaozhi-permissions';

export { protocolHash as permissionHash };
type Value = Record<string, unknown>;
export const plain = (value: unknown): value is Value => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
export const exact = (value: Value, names: string[]) => Object.keys(value).length === names.length
  && names.every(name => Object.prototype.hasOwnProperty.call(value, name));
export const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value.length <= 4096 && !/[\x00-\x1f]/u.test(value);
export const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const date = (value: unknown): value is string => text(value) && /^\d{4}-\d\d-\d\dT/u.test(value) && Number.isFinite(Date.parse(value));
const list = (value: unknown, allowed?: readonly string[]): value is string[] => Array.isArray(value)
  && value.length > 0 && value.length <= 128 && value.every(item => text(item) && (!allowed || allowed.includes(item)))
  && new Set(value).size === value.length;
export const sessionId = (value: unknown): value is string => typeof value === 'string' && /^aisession_[a-f0-9-]{36}$/iu.test(value);
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

function origin(value: unknown): value is string {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return url.origin === value && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function validScope(value: unknown): value is PermissionScope {
  if (!plain(value)) return false;
  switch (value.kind) {
    case 'filesystem':
      return exact(value, ['kind', 'root', 'identity', 'actions']) && text(value.root) && hash(value.identity)
        && list(value.actions, ['read', 'write', 'delete']);
    case 'process':
      return exact(value, ['kind', 'backend', 'executable', 'executableHash', 'workspace']) && value.backend === 'appcontainer'
        && text(value.executable) && hash(value.executableHash) && text(value.workspace);
    case 'network':
      return exact(value, ['kind', 'origin', 'methods', 'purpose']) && origin(value.origin)
        && list(value.methods, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']) && text(value.purpose);
    case 'egress':
      return exact(value, ['kind', 'origin', 'classifications']) && origin(value.origin)
        && list(value.classifications, ['public', 'redacted', 'teacher_private', 'student_private']);
    case 'dependency':
      return exact(value, ['kind', 'source', 'package', 'version', 'sha256', 'environment', 'installScripts'])
        && origin(value.source) && text(value.package) && text(value.version) && hash(value.sha256)
        && text(value.environment) && typeof value.installScripts === 'boolean';
    case 'mcp':
      return exact(value, ['kind', 'serverId', 'sourceHash', 'schemaHash', 'tools']) && text(value.serverId)
        && hash(value.sourceHash) && hash(value.schemaHash) && list(value.tools);
    case 'extension':
      return exact(value, ['kind', 'extensionId', 'sourceHash', 'actions']) && text(value.extensionId)
        && hash(value.sourceHash) && list(value.actions, ['install', 'run']);
    case 'secret':
      return exact(value, ['kind', 'reference', 'consumer']) && text(value.reference) && text(value.consumer);
    default: return false;
  }
}

export function validOwner(value: unknown): value is PermissionRequest['owner'] {
  return plain(value) && exact(value, ['sessionId', 'taskId', 'runId', 'generation'])
    && sessionId(value.sessionId) && text(value.taskId) && text(value.runId) && natural(value.generation);
}

export function validRequest(value: unknown): value is PermissionRequest {
  const keys = ['schemaVersion', 'owner', 'requirementsVersion', 'callId', 'action', 'inputDigest', 'purpose', 'scopes', 'files', 'provider', 'classification', 'expiresAt'];
  if (plain(value) && value.summary !== undefined) keys.push('summary');
  if (!plain(value) || !exact(value, keys)) return false;
  const provider = value.provider;
  const validProvider = provider === null || plain(provider) && exact(provider, ['id', 'version', 'sourceHash', 'schemaHash'])
    && text(provider.id) && text(provider.version) && hash(provider.sourceHash) && hash(provider.schemaHash);
  return value.schemaVersion === 2 && validOwner(value.owner) && natural(value.requirementsVersion) && text(value.callId) && text(value.action)
    && (value.summary === undefined || typeof value.summary === 'string' && value.summary.length <= 4096 && !value.summary.includes('\0'))
    && hash(value.inputDigest) && text(value.purpose) && Array.isArray(value.scopes) && value.scopes.length > 0
    && value.scopes.length <= 32 && value.scopes.every(validScope) && validProvider
    && Array.isArray(value.files) && value.files.length <= 16 && value.files.every(file => plain(file)
      && exact(file, ['root', 'path', 'version', 'sha256']) && text(file.root) && text(file.path)
      && (file.version === null || hash(file.version)) && (file.sha256 === null || hash(file.sha256)))
    && ['public', 'redacted', 'teacher_private', 'student_private'].includes(String(value.classification)) && date(value.expiresAt);
}

export function requestDigest(request: PermissionRequest) {
  return protocolHash({sessionId: request.owner.sessionId, taskId: request.owner.taskId, requirementsVersion: request.requirementsVersion, action: request.action,
    inputDigest: request.inputDigest, scopes: request.scopes, files: request.files, provider: request.provider, classification: request.classification});
}

export function snapshotRequest(raw: unknown): PermissionRequest {
  const snapshot = snapshotToolInvocationInput(raw);
  if (!snapshot.ok || !validRequest(snapshot.value)) throw Error('invalid_input');
  return snapshot.value;
}

export function validGrant(value: unknown): value is ScopeGrant {
  return plain(value) && exact(value, ['schemaVersion', 'grantId', 'revision', 'sessionId', 'taskId', 'scope', 'provenance', 'createdAt', 'expiresAt', 'revokedAt'])
    && value.schemaVersion === 1 && text(value.grantId) && natural(value.revision) && sessionId(value.sessionId)
    && (value.taskId === null || text(value.taskId)) && validScope(value.scope) && plain(value.provenance)
    && exact(value.provenance, ['kind', 'reference']) && ['teacher', 'legacy_workspace', 'approval'].includes(String(value.provenance.kind))
    && text(value.provenance.reference) && date(value.createdAt)
    && (value.expiresAt === null || date(value.expiresAt)) && (value.revokedAt === null || date(value.revokedAt));
}

export function validProfile(value: unknown): value is PermissionProfile {
  return plain(value) && exact(value, ['schemaVersion', 'sessionId', 'revision', 'mode', 'updatedAt'])
    && value.schemaVersion === 1 && sessionId(value.sessionId) && natural(value.revision)
    && PERMISSION_MODES.includes(value.mode as PermissionProfile['mode']) && date(value.updatedAt);
}

export function validApproval(value: unknown): value is PermissionApproval {
  if (!plain(value)) return false;
  const keys = ['schemaVersion', 'id', 'revision', 'request', 'requestDigest', 'permissionSnapshotHash', 'grantRefs', 'state', 'scope', 'createdAt', 'updatedAt'];
  if (value.invalidatedReason !== undefined) keys.push('invalidatedReason');
  if (value.admittedOwner !== undefined) keys.push('admittedOwner');
  return exact(value, keys) && value.schemaVersion === 2 && text(value.id) && natural(value.revision)
    && validRequest(value.request) && hash(value.requestDigest) && value.requestDigest === requestDigest(value.request)
    && hash(value.permissionSnapshotHash) && Array.isArray(value.grantRefs) && value.grantRefs.length <= 32
    && value.grantRefs.every(ref => plain(ref) && exact(ref, ['grantId', 'revision']) && text(ref.grantId) && natural(ref.revision))
    && ['pending', 'approved', 'executing', 'executed', 'rejected', 'invalidated', 'uncertain', 'failed'].includes(String(value.state))
    && ['operation', 'task', 'persistent'].includes(String(value.scope)) && date(value.createdAt) && date(value.updatedAt)
    && (value.invalidatedReason === undefined || text(value.invalidatedReason))
    && (value.admittedOwner === undefined || validOwner(value.admittedOwner));
}
