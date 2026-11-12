import { AsyncLocalStorage } from 'node:async_hooks';
import type { PermissionRequest, PermissionDecision } from '../../../shared/xiaozhi-permissions';

export type CurrentPermission = {
  request: PermissionRequest;
  decision: PermissionDecision;
  signal: AbortSignal;
  assert: () => Promise<void>;
  execution?: {id: string; logicalCwd: string; physicalCwd: string; helperHash: string; committed: string[]; excluded: string[]};
};
const current = new AsyncLocalStorage<CurrentPermission>();
export const runWithPermission = <T>(permission: CurrentPermission, operation: () => Promise<T>) => current.run(permission, operation);
export const currentPermission = () => current.getStore();
export async function assertCurrentPermission() {
  await current.getStore()?.assert();
}
export function assertCurrentPermissionSignal() {
  current.getStore()?.signal.throwIfAborted();
}
export async function assertCurrentNetwork(url: string, method: string) {
  const authority = current.getStore();
  if (!authority) return;
  await authority.assert();
  const origin = new URL(url).origin;
  if (!authority.request.scopes.some(scope => scope.kind === 'network' && scope.origin === origin && scope.methods.includes(method))) {
    throw Error('permission_denied');
  }
}
