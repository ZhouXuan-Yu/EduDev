import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(appRoot);
const candidates = process.env.OMNI_EDU_PYTHON
  ? [process.env.OMNI_EDU_PYTHON]
  : ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'];
const pythonBin = candidates.find((candidate) => existsSync(candidate));
if (!pythonBin) {
  console.error('no python interpreter found; set OMNI_EDU_PYTHON');
  process.exitCode = 1;
} else {
  const outputRoot = mkdtempSync(join(tmpdir(), 'omni-edu-parse-smoke-'));
  const child = spawn(pythonBin, ['-m', 'parse-smoke', outputRoot], {
    cwd: join(repoRoot, 'python'),
    env: { ...process.env, PYTHONPATH: join(repoRoot, 'python') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => {
    console.error(`failed to spawn ${pythonBin}: ${error.message}`);
    process.exitCode = 1;
  });

  child.on('close', (code) => {
    try { rmSync(outputRoot, { recursive: true, force: true }); } catch { /* cleanup is best-effort */ }
    if (code !== 0) {
      console.error(stderr || stdout || `parse smoke exited with code ${code}`);
      process.exitCode = 1;
      return;
    }
    console.log(stdout.trim());
  });
}
