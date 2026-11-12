import {hanaOfficeToolDefinitions} from '../../office-agent/hana-tool-adapter';
import {currentNativeStatArtifact} from '../capabilities/native-stat-executable';
import {builtinSandboxManifest} from './windows/launcher';
import {TERMINAL_PARAMETERS} from '../tools/terminal';
import {permissionHash} from './validation';
import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';

export function nativePermissionProvider(tool: string): PermissionRequest['provider'] {
  const hana = hanaOfficeToolDefinitions.find(definition => definition.name === tool);
  if (hana) return {id: 'edu.native.office-tools', version: currentNativeStatArtifact.version,
    sourceHash: currentNativeStatArtifact.sha256, schemaHash: permissionHash(hana.inputSchema)};
  if (tool === 'exec_command') {
    const sourceHash = permissionHash({helperSource: builtinSandboxManifest.sourceSha256, adapterSource: builtinSandboxManifest.adapterSourceSha256});
    return {id: 'edu.native.appcontainer-shell', version: '1.0.0+' + sourceHash.slice(0, 12),
      sourceHash, schemaHash: permissionHash(TERMINAL_PARAMETERS)};
  }
  return null;
}

export function validNativePermissionProvider(provider: NonNullable<PermissionRequest['provider']>) {
  if (provider.id === 'edu.native.office-tools') return hanaOfficeToolDefinitions.some(definition => {
    const actual = nativePermissionProvider(definition.name);
    return actual && permissionHash(actual) === permissionHash(provider);
  });
  return provider.id === 'edu.native.appcontainer-shell' && permissionHash(nativePermissionProvider('exec_command')) === permissionHash(provider);
}
