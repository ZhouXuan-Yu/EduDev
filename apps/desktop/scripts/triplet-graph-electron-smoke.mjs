import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/electron-smoke.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, OMNI_EDU_E2E_TRIPLET_ONLY: '1', OMNI_EDU_E2E_TRIPLET_SUCCESS: '1' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
