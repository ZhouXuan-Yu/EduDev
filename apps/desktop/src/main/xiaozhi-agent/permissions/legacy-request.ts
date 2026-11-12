import fs from 'node:fs';
import path from 'node:path';
import {workspaceHash} from '../workspace-authority';
import type {PrivateApproval} from '../persistent-state';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {PermissionService} from './service';
import {filesystemScope, checkedFile, digest} from './resources';
import {createToolPermissionRuntime} from './tool-runtime';

export function createLegacyApprovalRequests(options: {
  workspace: (sessionId: string) => Promise<{path: string}>;
  binding: (sessionId: string, runId: string) => Promise<(PermissionOwner & {requirementsVersion: number}) | null>;
  resumedOwner: (row: PrivateApproval) => (PermissionOwner & {requirementsVersion: number}) | null;
  permissions: PermissionService;
}) {
  async function validate(row: PrivateApproval) {
    const lease = await options.workspace(row.sessionId);
    if (workspaceHash(lease.path) !== row.workspaceHash) throw Error('source_changed');
    const scope = filesystemScope(lease.path, ['read', 'write']);
    const source = checkedFile(scope, path.resolve(lease.path, row.source), 'read');
    const target = checkedFile(scope, path.resolve(lease.path, row.target), 'write');
    if (fs.statSync(source).size > 1048576 || digest(fs.readFileSync(source)) !== row.sourceSha256
        || fs.existsSync(target)) throw Error('source_changed');
    return lease;
  }
  return {
    validate,
    async request(row: PrivateApproval) {
      const lease = await validate(row);
      const binding = await options.binding(row.sessionId, row.runId) || options.resumedOwner(row);
      if (!binding) throw Error('task_source_required');
      const {requirementsVersion, ...owner} = binding;
      const runtime = createToolPermissionRuntime({engine: options.permissions.engine, owner: () => owner,
        workspace: async () => lease, requirementsVersion: () => requirementsVersion});
      const request = await runtime.request(row.callId, 'office_copy_file', {source: row.source, target: row.target});
      if (!request) throw Error('permission_denied');
      return request;
    }
  };
}
