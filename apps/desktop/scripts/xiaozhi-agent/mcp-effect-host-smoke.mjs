import {runNativeHostSmoke} from './native-host-smoke-runner.mjs';

const result = await runNativeHostSmoke({
  prefix: 'mcp-effect-',
  workerFile: 'scripts/xiaozhi-agent/mcp-effect-host-worker.ts',
  checkCount: 6,
});
if (!result.success) process.exitCode = 1;
