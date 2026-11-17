import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {PreparedStdioBinding} from '../mcp-controlled-service';

export const EXTENSION_HOOKS = ['context.transform', 'event.observe'] as const;
export type ExtensionHook = typeof EXTENSION_HOOKS[number];
export type ExtensionManifest = {
  schemaVersion: 1;
  extensionId: string;
  version: string;
  source: string;
  sourceHash: string;
  license: string;
  licenseHash: string;
  artifactId: string;
  hooks: ExtensionHook[];
};
export type ExtensionVersion = {manifest: ExtensionManifest; healthAt: string; revokedAt: string | null};
export type ExtensionView = {
  schemaVersion: 1;
  extensionId: string;
  revision: number;
  enabled: boolean;
  activeVersion: string | null;
  versions: ExtensionVersion[];
};
export type ExtensionContext = {
  owner: () => PermissionOwner;
  signal: AbortSignal;
  workspace: string;
  requirementsVersion: () => number;
  recordAuthority?: (reference: string, refs: {grantId: string; revision: number}[]) => Promise<void>;
  persist?: <T>(action: () => Promise<T>) => Promise<T>;
};
export type ExtensionBinding = PreparedStdioBinding;
export type ExtensionLog = {schemaVersion: 1; level: 'info' | 'warn' | 'error'; code: string; at: string};
export type ExtensionSession = {
  manifest: ExtensionManifest;
  invoke: (hook: ExtensionHook, payload: unknown, signal?: AbortSignal) => Promise<unknown>;
  logs: () => ExtensionLog[];
  close: () => Promise<void>;
};
