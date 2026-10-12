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
// Compiled local debugging build; never reuse a Vite page or an acceptance build.
env.NODE_ENV = 'development';
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error('请通过 npm start 或根目录“启动小智.cmd”启动。');
console.log('正在构建当前源码：' + desktop);
const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: desktop, env, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) {
  console.error('小智更新失败，未启动旧版本。请查看上方错误后重试。');
  process.exit(build.status || 1);
}
const executable = path.join(desktop, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
for (const file of [executable, 'out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html'].map(file => path.isAbsolute(file) ? file : path.join(desktop, file))) {
  if (!fs.existsSync(file)) { console.error('小智启动文件缺失：' + file); process.exit(1); }
}
const child = spawn(executable, [path.join(desktop, 'out/main/index.js')], { cwd: desktop, env, stdio: 'ignore', detached: true, windowsHide: true });
child.once('error', error => { console.error('小智启动失败：' + error.message); process.exitCode = 1; });
child.once('spawn', () => { child.unref(); console.log('已启动当前源码调试版；如已有旧构建窗口，将重新加载新版。'); });
