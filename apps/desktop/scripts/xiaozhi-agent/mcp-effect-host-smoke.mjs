import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const desktop = process.cwd();
const require = createRequire(path.join(desktop, 'package.json'));
const { build } = require('esbuild');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-effect-'));
const worker = path.join(output, 'worker.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = {};
await build({
    entryPoints: ['scripts/xiaozhi-agent/mcp-effect-host-worker.ts'],
    outfile: worker,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    packages: 'external',
    logLevel: 'warning',
    plugins: [{
        name: 'record-source-identity',
        setup(builder) {
            builder.onLoad({ filter: /\.(?:ts|mjs|json)$/ }, args => {
                const file = path.relative(desktop, args.path).replaceAll('\\', '/');
                sources[file] = hash(fs.readFileSync(args.path));
            });
        }
    }]
});
fs.writeFileSync(path.join(output, 'SOURCE_HASHES.json'), JSON.stringify(sources, null, 2));
fs.copyFileSync('package.json', path.join(output, 'package.json'));
fs.symlinkSync(path.join(desktop, 'node_modules'), path.join(output, 'node_modules'), 'junction');
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `
const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(output, 'profile'))});
app.whenReady().then(async () => {
    try {
        await import(${JSON.stringify(pathToFileURL(worker).href)});
        app.exit(process.exitCode || 0);
    } catch (error) {
        console.error(error.stack);
        app.exit(1);
    }
});
`);
const env = { ...process.env };
for (const key of Object.keys(env))
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'].includes(key))
        delete env[key];
const log = fs.createWriteStream(path.join(output, 'worker.log'));
const child = spawn(require('electron'), [bootstrap, output], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
const timer = setTimeout(() => child.kill(), 180000);
const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
});
clearTimeout(timer);
await new Promise(resolve => log.end(resolve));
let report;
try {
    report = JSON.parse(fs.readFileSync(path.join(output, 'REPORT.json'), 'utf8'));
}
catch { }
const drift = Object.entries(sources).filter(([file, sha]) => hash(fs.readFileSync(path.resolve(desktop, file))) !== sha).map(([file]) => file);
const summary = {
    success: code === 0 && report?.success === true && report.checks.length === 5 && drift.length === 0,
    code, output, passed: report?.checks.length, error: report?.error,
    sourceInputs: Object.keys(sources).length, sourceDrift: drift
};
fs.writeFileSync(path.join(output, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!summary.success)
    process.exitCode = 1;
