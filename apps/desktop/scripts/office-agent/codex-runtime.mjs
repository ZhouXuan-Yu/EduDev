// Adapted from @openai/codex 0.154.0 bin/codex.js (Apache-2.0).
// Original: https://github.com/openai/codex/blob/main/codex-cli/bin/codex.js
// License and notices: ../../../../../third_party/codex/
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
export const CODEX_VERSION = '0.154.0';

// Launch the native executable directly; process.execPath in Electron is Electron,
// so launching the CLI's Node wrapper with it would start another desktop app.
export function resolveCodexRuntime() {
  if (process.platform !== 'win32' || !['x64', 'arm64'].includes(process.arch)) {
    throw new Error('This proof validates Windows x64/arm64 layout only');
  }
  const targetTriple = process.arch === 'x64' ? 'x86_64-pc-windows-msvc' : 'aarch64-pc-windows-msvc';
  const packageRoot = dirname(require.resolve(`@openai/codex-win32-${process.arch}/package.json`));
  const metadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.version !== `${CODEX_VERSION}-win32-${process.arch}` || metadata.license !== 'Apache-2.0') {
    throw new Error('Runtime package changed; regenerate protocol and revalidate');
  }
  const vendorRoot = join(packageRoot, 'vendor');
  const binaryPath = join(vendorRoot, targetTriple, 'bin', 'codex.exe');
  if (!existsSync(binaryPath)) throw new Error('Locked optional Windows runtime package missing');
  return { binaryPath, vendorRoot, targetTriple, version: CODEX_VERSION };
}
