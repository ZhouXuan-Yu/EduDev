import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

export type RuntimeAuthority = Readonly<{ mode: 'pi' | 'legacy-test' }>;

/** Honor an explicit launcher profile for both app preferences and Chromium data. */
export function applyLaunchProfile(host: {
  profile: string; setPath: (name: 'userData' | 'sessionData', directory: string) => void;
}): void {
  if (!host.profile) return;
  if (!path.isAbsolute(host.profile)) throw new Error('invalid_profile_directory');
  if (!fs.existsSync(host.profile)) fs.mkdirSync(host.profile, { recursive: true });
  if (!fs.statSync(host.profile).isDirectory()) throw new Error('invalid_profile_directory');
  const directory = path.resolve(host.profile);
  host.setPath('userData', directory);
  host.setPath('sessionData', directory);
}

/** Main-owned launch policy. Old feature flags never select a product runtime. */
export function resolveRuntimeAuthority(input: {
  packaged: boolean; env: NodeJS.ProcessEnv; dataRoot: string; profileRoot: string;
}): RuntimeAuthority {
  if (input.packaged || input.env.OMNI_EDU_E2E_DIALOG_MODE !== '1'
    || input.env.OMNI_EDU_E2E_LEGACY_RUNTIME !== '1'
    || input.env.OMNI_EDU_XIAOZHI_PI !== '0') return Object.freeze({ mode: 'pi' });
  try {
    const temporary = fs.realpathSync(tmpdir());
    const roots = [input.dataRoot, input.profileRoot].map(root => {
      if (!path.isAbsolute(root)) throw new Error('invalid_test_root');
      const resolved = path.resolve(root), real = fs.realpathSync(resolved);
      const same = process.platform === 'win32' ? real.toLowerCase() === resolved.toLowerCase() : real === resolved;
      const relative = path.relative(temporary, real);
      if (!same || !fs.statSync(real).isDirectory() || !/^omni-edu-[\w-]+$/.test(relative)
        || path.dirname(relative) !== '.') throw new Error('invalid_test_root');
      return real;
    });
    if (path.relative(roots[0], roots[1]) === '') return Object.freeze({ mode: 'pi' });
    return Object.freeze({ mode: 'legacy-test' });
  } catch { return Object.freeze({ mode: 'pi' }); }
}

export function requireLegacyRuntime(authority: RuntimeAuthority): void {
  if (authority.mode !== 'legacy-test') throw new Error('legacy_runtime_retired: 旧版任务不能继续，请在小智中重新发起。');
}
