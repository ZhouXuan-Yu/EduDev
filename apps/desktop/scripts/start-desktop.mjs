import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {homedir} from 'node:os';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function checkInstalledDependencies() {
  const { packages } = JSON.parse(fs.readFileSync(path.join(desktop, 'package-lock.json'), 'utf8'));
  const required = { ...packages[''].dependencies, ...packages[''].devDependencies };
  const mismatches = [];
  for (const name of Object.keys(required)) {
    const expected = packages[`node_modules/${name}`]?.version;
    let installed;
    try {
      installed = JSON.parse(fs.readFileSync(path.join(desktop, 'node_modules', name, 'package.json'), 'utf8')).version;
    } catch {
      // A missing or unreadable manifest is handled like a version mismatch.
    }
    if (!expected || expected !== installed) {
      mismatches.push(`${name}: ${installed ?? '未安装'}，锁定版本 ${expected ?? '不可用'}`);
    }
  }
  return mismatches;
}

const dependencyMismatches = checkInstalledDependencies();
if (dependencyMismatches.length) {
  console.error('桌面依赖与 package-lock.json 不一致：\n' + dependencyMismatches.join('\n'));
  console.error('请在以下目录运行 npm.cmd ci，然后重试：' + desktop);
  process.exit(1);
}
const electronRoot = path.join(desktop, 'node_modules', 'electron');
const executable = path.join(electronRoot, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const electronVersion = JSON.parse(fs.readFileSync(path.join(electronRoot, 'package.json'), 'utf8')).version;

function electronRuntimeReady() {
  const versionFile = path.join(electronRoot, 'dist', 'version');
  return fs.existsSync(executable) && fs.existsSync(versionFile)
    && fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, '') === electronVersion;
}

if (process.argv.includes('--check')) {
  if (!electronRuntimeReady()) {
    console.error('Electron 运行文件尚未准备好。请正常启动小智以准备锁定版本。');
    process.exit(1);
  }
  console.log('桌面直接依赖版本与 package-lock.json 一致，Electron 运行文件已就绪。');
  process.exit(0);
}
const env = { ...process.env };
// A daily launcher must not inherit test profiles, historical runtimes or a stale dev URL.
for (const name of Object.keys(env)) if (name.startsWith('OMNI_EDU_E2E_')) delete env[name];
for (const name of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'ELECTRON_OVERRIDE_DIST_PATH', 'OMNI_EDU_TEST_BUILD_ROOT', 'OMNI_EDU_XIAOZHI_PI', 'NODE_OPTIONS']) delete env[name];
env.OMNI_EDU_REPO_ROOT = path.resolve(desktop, '../..');
// Compiled local debugging build; never reuse a Vite page or an acceptance build.
env.NODE_ENV = 'development';
const preview=process.argv.includes('--knowledge-preview');
const previewRoot=path.join(env.LOCALAPPDATA||path.join(homedir(),'.local','share'),'Xiaozhi-KnowledgePreview');
if(preview)env.OMNI_EDU_DATA_ROOT=path.join(previewRoot,'data');
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error('请通过 npm start 或根目录“启动小智.cmd”启动。');
if (!electronRuntimeReady()) {
  console.log('正在准备锁定的 Electron 运行版本：' + electronVersion);
  const install = spawnSync(process.execPath, [path.join(electronRoot, 'install.js')], {
    cwd: desktop, env, stdio: 'inherit', windowsHide: true,
  });
  if (install.error || install.status !== 0 || !electronRuntimeReady()) {
    console.error('Electron 运行文件准备失败。请查看上方错误后重试。');
    process.exit(install.status || 1);
  }
}
console.log('正在构建当前源码：' + desktop);
const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: desktop, env, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) {
  console.error('小智更新失败，未启动旧版本。请查看上方错误后重试。');
  process.exit(build.status || 1);
}
for (const file of [executable, 'out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html'].map(file => path.isAbsolute(file) ? file : path.join(desktop, file))) {
  if (!fs.existsSync(file)) { console.error('小智启动文件缺失：' + file); process.exit(1); }
}
// This is the teacher's interactive app. STARTUPINFO SW_HIDE suppresses its first
// native window on Windows even when BrowserWindow requests show: true.
const child = spawn(executable, [path.join(desktop, 'out/main/index.js'),...(preview?['--user-data-dir='+path.join(previewRoot,'profile')]:[])], { cwd: desktop, env, stdio: 'ignore', detached: true, windowsHide: false });
child.once('error', error => { console.error('小智启动失败：' + error.message); process.exitCode = 1; });
child.once('spawn', () => { child.unref(); console.log('已启动当前源码调试版；如已有旧构建窗口，将重新加载新版。'); });
