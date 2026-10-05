import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
// A daily launcher must not inherit test profiles, historical runtimes or a stale dev URL.
for (const name of Object.keys(env)) if (name.startsWith('OMNI_EDU_E2E_')) delete env[name];
for (const name of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'OMNI_EDU_TEST_BUILD_ROOT', 'OMNI_EDU_XIAOZHI_PI', 'NODE_OPTIONS']) delete env[name];
env.OMNI_EDU_REPO_ROOT = path.resolve(desktop, '../..');
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error('请通过 npm start 或根目录“启动小智.cmd”启动。');
console.log('正在更新小智，请稍候…');
const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: desktop, env, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) {
  console.error('小智更新失败，未启动旧版本。请查看上方错误后重试。');
  process.exit(build.status || 1);
}
const executable = path.join(desktop, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const child = spawn(executable, [path.join(desktop, 'out/main/index.js')], { cwd: desktop, env, stdio: 'ignore', detached: true, windowsHide: true });
child.once('error', error => { console.error('小智启动失败：' + error.message); process.exitCode = 1; });
child.once('spawn', () => { child.unref(); console.log('已打开当前版本的小智。'); });
