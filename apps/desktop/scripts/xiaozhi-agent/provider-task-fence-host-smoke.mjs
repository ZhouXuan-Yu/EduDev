import {runNativeHostSmoke} from './native-host-smoke-runner.mjs';

const result = await runNativeHostSmoke({
  prefix: 'provider-task-fence-',
  workerFile: 'scripts/xiaozhi-agent/provider-task-fence-host-worker.ts',
  checkCount: 2,
});
if (!result.success) process.exitCode = 1;
