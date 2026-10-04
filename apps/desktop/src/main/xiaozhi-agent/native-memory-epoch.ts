import { createPiAuthorityEpoch, type NativeAuthorityManager } from './native-authority-epoch';

/** Existing memory namespace/markers/API retained; shared native branch mechanics. */
export function createPiMemoryEpoch(manager: NativeAuthorityManager, authority: string) {
  const epoch = createPiAuthorityEpoch(manager, authority, 'memory');
  return { ...epoch, isolationReason: epoch.isolationReason as 'memory_authority' | 'interrupted_tool' | undefined };
}
