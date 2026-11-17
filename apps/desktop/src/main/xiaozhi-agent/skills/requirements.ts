import type {PermissionOwner, PermissionScope} from '../../../shared/xiaozhi-permissions';
import type {PermissionService} from '../permissions/service';
import {filesystemScope} from '../permissions/resources';
import {permissionHash} from '../permissions/validation';

/** Declaration checks consult existing authority without creating an approval or Grant. */
export function createSkillPermissionCheck(options: {
  permissions: PermissionService;
  workspace: (sessionId: string) => Promise<{path: string}>;
  process: () => Promise<{executable: string; executableHash: string}>;
  requirementsVersion: (sessionId: string) => number;
}) {
  return async (requirement: string, owner?: PermissionOwner) => {
    if (!owner) return false;
    const workspace = await options.workspace(owner.sessionId);
    let scope: PermissionScope;
    if (requirement === 'filesystem.read' || requirement === 'workspace.file.metadata') scope = filesystemScope(workspace.path, ['read']);
    else if (requirement === 'filesystem.write') scope = filesystemScope(workspace.path, ['write']);
    else if (requirement === 'filesystem.delete') scope = filesystemScope(workspace.path, ['delete']);
    else if (requirement === 'process.exec') scope = {kind: 'process', backend: 'appcontainer', ...await options.process(), workspace: workspace.path};
    else return false;
    const digest = permissionHash({requirement, scope});
    const decision = await options.permissions.engine.evaluate({schemaVersion: 2, owner,
      requirementsVersion: options.requirementsVersion(owner.sessionId), callId: `skill_requirement_${digest.slice(0, 32)}`,
      action: 'skill_requirement', inputDigest: digest, purpose: '检查技能声明需要的现有授权', scopes: [scope], files: [], provider: null,
      classification: 'redacted', expiresAt: new Date(Date.now() + 60000).toISOString()});
    return decision.state === 'allow';
  };
}
