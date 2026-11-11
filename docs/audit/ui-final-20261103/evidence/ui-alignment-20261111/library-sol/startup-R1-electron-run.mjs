// Root invokes this after its formal build. node --check only parses the file.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '../../..');
const require = createRequire(path.join(desktop, 'package.json'));
const [build, mode] = process.argv.slice(2);
assert(build && path.isAbsolute(build));
assert(['xml', 'html', 'hana-reader', 'reader-cancel', 'utility-timeout'].includes(mode));
const output = fs.mkdtempSync(path.join(here, 'electron-R1-' + mode + '-'));
fs.mkdirSync(path.join(output, 'profile'));
const { zeroNetworkBootstrap } = await import(pathToFileURL(path.join(desktop, 'scripts/acceptance/zero-network-bootstrap.mjs')).href);
const launcher = zeroNetworkBootstrap({ output, main: path.join(here, 'startup-R1-electron-qa.cjs'),
    profile: path.join(output, 'profile'), counter: '__startupHttp' });
const env = { ...process.env };
for (const name of Object.keys(env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_')
        || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
}
const child = spawn(require('electron'), [launcher,
    '--build-root=' + fs.realpathSync(build), '--qa-case=' + mode, '--output=' + output,
    '--user-data-dir=' + path.join(output, 'profile')], { cwd: desktop, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const stdout = fs.createWriteStream(path.join(output, 'stdout.log'));
child.stdout.pipe(stdout);
child.stderr.pipe(fs.createWriteStream(path.join(output, 'stderr.log')));
let readiness = '', ready = false, watchdogReason;
let timer = setTimeout(() => { watchdogReason = 'qa-ready-20000ms'; child.kill(); }, 20000);
child.stdout.on('data', data => {
    if (ready) return;
    readiness += data.toString();
    if (readiness.includes('R1_READY')) {
        ready = true;
        clearTimeout(timer);
        // Operation still uses the original 15s/30s timer; allow only child-exit cleanup here.
        timer = setTimeout(() => { watchdogReason = 'owned-cleanup-watchdog'; child.kill(); }, (mode.includes('reader') ? 30000 : 15000) + 5500);
    }
});
child.once('error', error => { clearTimeout(timer); fs.writeFileSync(path.join(output, 'launch-error.json'), JSON.stringify({ code: error.code })); process.exitCode = 1; });
child.once('close', code => { clearTimeout(timer); console.log(JSON.stringify({ output, code, ready, watchdogReason })); process.exitCode = code === 0 && !watchdogReason ? 0 : 1; });
