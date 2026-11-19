import {runNativeHostSmoke} from './native-host-smoke-runner.mjs';

const result = await runNativeHostSmoke({
  prefix: 'terminal-grant-',
  workerFile: 'scripts/xiaozhi-agent/terminal-grant-host-worker.ts',
  checkCount: 5,
});
if (!result.success) process.exitCode = 1;
