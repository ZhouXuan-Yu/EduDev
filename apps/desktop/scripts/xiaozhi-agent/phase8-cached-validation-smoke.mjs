import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
const BOUNDARY_SOURCE = `
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const desktop = process.cwd();
const require = createRequire(path.join(desktop, 'package.json'));
const { build } = require('esbuild');
const root = process.argv[2];
fs.symlinkSync(path.join(desktop, 'node_modules'), path.join(root, 'node_modules'), 'junction');
const target = path.join(desktop, 'src/main/xiaozhi-agent/mcp-controlled-service.ts');
const rawPatch = target;
await build({
    stdin: {
        contents: \`export {createControlledMcpService} from './src/main/xiaozhi-agent/mcp-controlled-service';
            export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store';
            export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service';
            export {filesystemScope} from './src/main/xiaozhi-agent/permissions/resources';\`,
        resolveDir: desktop,
        loader: 'ts'
    },
    outfile: path.join(root, 'api.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node24',
    logLevel: 'warning',
    plugins: [
        {
            name: 'frozen-prototype',
            setup(b) {
                b.onLoad({ filter: /mcp-controlled-service\\.ts$/ }, args => ({
                    contents: fs.readFileSync(rawPatch, 'utf8'),
                    loader: 'ts',
                    resolveDir: path.dirname(target)
                }));
                b.onLoad({ filter: /acquisition[\\\\/]file-hash\\.ts$/ }, args => {
                    let text = fs.readFileSync(args.path, 'utf8');
                    text = text.replace('export async function hashCapabilityFile(', 'async function originalBoundaryHash(');
                    text += '\\nexport async function hashCapabilityFile(filename:string,signal?:AbortSignal){'+
                        'globalThis.__boundaryHashes.push(filename);'+
                        'return originalBoundaryHash(filename,signal);}\\n';
                    return { contents: text, loader: 'ts', resolveDir: path.dirname(args.path) };
                });
            }
        }
    ]
});
globalThis.__boundaryHashes = [];
const api = await import(pathToFileURL(path.join(root, 'api.mjs')).href);
const hash = b => createHash('sha256').update(b).digest('hex');
const packageRoot = path.join(root, 'package'), workspace = path.join(root, 'workspace'), dataRoot = path.join(root, 'data');
for (const p of [packageRoot, workspace, dataRoot])
    fs.mkdirSync(p);
const executable = path.join(packageRoot, 'node.exe');
const originalBytes = Buffer.from('synthetic-boundary-original');
fs.writeFileSync(executable, originalBytes);
fs.writeFileSync(path.join(workspace, 'private.txt'), 'synthetic-private-boundary');
let owner = {
    sessionId: 'aisession_' + randomUUID(),
    taskId: 'xitask_' + 'a'.repeat(64),
    runId: 'run_fork_boundary',
    generation: 1
};
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,' +
    'run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,' +
    'payload_json TEXT,created_at TEXT,updated_at TEXT)');
const sql = {
    all: async (q, v = []) => db.prepare(q).all(...v),
    run: async (q, v = []) => {
        db.prepare(q).run(...v);
    },
    change: async (q, v = []) => Number(db.prepare(q).run(...v).changes)
};
sql.transaction = async (action) => {
    db.exec('BEGIN IMMEDIATE');
    try {
        const v = await action(sql);
        db.exec('COMMIT');
        return v;
    }
    catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
};
const store = api.createPermissionStore(sql);
await store.migrate();
const permissions = api.createPermissionService({
    store,
    dataRoot,
    owner: () => owner,
    archived: async () => false,
    workspace: async () => ({ path: workspace })
});
const recipe = {
    artifactId: 'xiartifact_' + 'a'.repeat(64),
    version: '1.0.0',
    directory: packageRoot,
    source: 'https://registry.npmjs.org',
    package: 'synthetic-boundary',
    packageHash: 'b'.repeat(64),
    files: [{ path: 'node.exe', bytes: originalBytes.length, sha256: hash(originalBytes) }],
    executable: { path: executable, sha256: hash(originalBytes), packagePath: 'node.exe' },
    arguments: [],
    workspaceActions: ['read'],
    inputAdapter: 'filesystem_read',
    limits: {
        memoryBytes: 536870912,
        cpuRate: 5000,
        userTimeMs: 0,
        leaseMs: 60000,
        maxInputBytes: 1048576,
        maxOutputBytes: 1048576,
        maxProcesses: 8
    }
};
const source = {
    serverId: 'mcp_' + randomUUID(),
    transport: 'stdio',
    sourceHash: 'c'.repeat(64),
    schemaHash: 'd'.repeat(64),
    tools: ['read_text_file'],
    url: null
};
const scopes = [
    api.filesystemScope(workspace, ['read']),
    {
        kind: 'process',
        backend: 'appcontainer',
        executable,
        executableHash: recipe.executable.sha256,
        workspace
    },
    {
        kind: 'dependency',
        source: recipe.source,
        package: recipe.package,
        version: recipe.version,
        sha256: recipe.packageHash,
        environment: packageRoot,
        installScripts: false
    }
];
// Leaf metadata scopes only: the fake executable/helper are never started. The paired Host runs separately prove actual native execution.
const grants = await store.issue(owner.sessionId, scopes, { kind: 'teacher', reference: 'owned-fork-boundary' });
let denyBinding = false, bindingCalls = 0;
const controlled = api.createControlledMcpService({
    permissions,
    store,
    runtime: {
        inspect: async () => ({ status: 'ready' }),
        resolve: async () => ({ directory: root, version: 'e'.repeat(64), manifest: { helperSha256: 'f'.repeat(64) } })
    },
    binding: async () => {
        bindingCalls++;
        if (denyBinding)
            throw Error('permission_denied');
        return recipe;
    }
});
const abort = new AbortController();
const context = { owner: () => owner, signal: abort.signal, workspace, requirementsVersion: () => 1 };
const view = controlled.forOwner(context);
const report = {
    success: false,
    root,
    boundary: 'Real source file validation, PermissionEngine leases and projection lifecycle; no helper.start/native dispatch in this leaf',
    checks: []
};
const transports = [];
async function check(name, action) {
    await action();
    report.checks.push({ name, pass: true });
}
const sourceHashes = () => globalThis.__boundaryHashes.filter(x => x === executable).length;
try {
    await check('Root and fork share the existing immutable file memo', async () => {
        await view.scopes(source, 'read_text_file', {});
        assert.equal(sourceHashes(), 1);
        await view.fork().scopes(source, 'read_text_file', {});
        assert.equal(sourceHashes(), 1);
    });
    const first = view.fork(), second = view.fork();
    const configuration = { source, command: 'managed:' + recipe.artifactId, args: [], environment: {} };
    let one, two;
    await check('Independent views prepare simultaneous same-server transports with separate projections', async () => {
        [one, two] = await Promise.all([first.transport(configuration), second.transport(configuration)]);
        transports.push(one, two);
        const a = await first.transformInput(source, 'read_text_file', { path: 'private.txt' }),
            b = await second.transformInput(source, 'read_text_file', { path: 'private.txt' });
        assert.notEqual(a.path, b.path);
        assert.equal(fs.readFileSync(a.path, 'utf8'), 'synthetic-private-boundary');
        assert.equal(fs.readFileSync(b.path, 'utf8'), 'synthetic-private-boundary');
        assert.equal(sourceHashes(), 1);
    });
    await check('Same view keeps original resource_busy and root view has no borrowed projection', async () => {
        await assert.rejects(first.transport(configuration), /resource_busy/);
        await assert.rejects(view.transformInput(source, 'read_text_file', { path: 'private.txt' }), /permission_denied/);
    });
    await check('Closing one transport removes only its own projection', async () => {
        await one.close();
        await assert.rejects(first.transformInput(source, 'read_text_file', { path: 'private.txt' }), /permission_denied/);
        const b = await second.transformInput(source, 'read_text_file', { path: 'private.txt' });
        assert.equal(fs.readFileSync(b.path, 'utf8'), 'synthetic-private-boundary');
    });
    await check('Reserved runtime and outside input paths remain denied', async () => {
        await assert.rejects(second.transformInput(source, 'read_text_file', { path: '.runtime/package/node.exe' }));
        await assert.rejects(second.transformInput(source, 'read_text_file', { path: '../outside.txt' }));
    });
    await check('Warm file memo does not cache original binding/TTL availability', async () => {
        const before = bindingCalls;
        denyBinding = true;
        await assert.rejects(view.scopes(source, 'read_text_file', {}), /permission_denied/);
        denyBinding = false;
        assert(bindingCalls > before);
    });
    await check('Revocation still denies a new transport despite warm file validation', async () => {
        const processGrant = grants.find(x => x.scope.kind === 'process');
        await permissions.engine.revoke(owner.sessionId, processGrant.grantId, processGrant.revision);
        await assert.rejects(view.fork().transport(configuration), /permission_pending|permission_denied/);
        await two.close();
        assert.equal(permissions.engine.activeCount(), 0);
    });
    await check('Changing expected SHA invalidates an otherwise identical cached version', async () => {
        const before = sourceHashes(), prior = recipe.files[0].sha256;
        recipe.files[0].sha256 = '0'.repeat(64);
        await assert.rejects(view.scopes(source, 'read_text_file', {}), /source_changed/);
        recipe.files[0].sha256 = prior;
        assert.equal(sourceHashes(), before + 1);
    });
    await check('Changing source version/bytes is rehashed and rejected', async () => {
        const before = sourceHashes();
        fs.writeFileSync(executable, Buffer.alloc(originalBytes.length, 120));
        const now = new Date(Date.now() + 2000);
        fs.utimesSync(executable, now, now);
        await assert.rejects(view.fork().scopes(source, 'read_text_file', {}), /source_changed/);
        assert.equal(sourceHashes(), before + 1);
        fs.writeFileSync(executable, originalBytes);
    });
    await check('Changed owner rejects old view and fork; a new owner gets a fresh memo', async () => {
        owner = { ...owner, runId: 'run_new_owner', generation: 2 };
        await assert.rejects(view.scopes(source, 'read_text_file', {}), /permission_denied/);
        assert.throws(() => view.fork(), /permission_denied/);
        const fresh = controlled.forOwner({ ...context, owner: () => owner, signal: new AbortController().signal });
        const before = sourceHashes();
        await fresh.scopes(source, 'read_text_file', {});
        assert.equal(sourceHashes(), before + 1);
    });
    await check('Aborted original context cannot mint another view', async () => {
        abort.abort('cancelled');
        assert.throws(() => view.fork());
    });
    report.success = true;
}
catch (e) {
    report.error = e.stack;
    process.exitCode = 1;
}
finally {
    await Promise.allSettled(transports.map(t => t.close()));
    report.activeLeases = permissions.engine.activeCount();
    db.close();
    fs.writeFileSync(path.join(root, 'REPORT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
        success: report.success,
        root,
        checks: report.checks.length,
        activeLeases: report.activeLeases,
        error: report.error
    }));
}
`;
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(desktop, 'package.json'));
const ts = require('typescript');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-phase8-cached-validation-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
    'src/main/xiaozhi-agent/mcp-controlled-service.ts',
    'src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp.ts'
];
const sources = sourceFiles.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(desktop, file))) }));
const report = {
    success: false,
    output,
    sources,
    paidCalls: 0,
    checks: [],
    boundary: 'Actual production Host with loopback models and public cached synthetic data; ' +
        'separate metadata-only projection/validation negatives never launch their fake helper.'
};
const save = () => fs.writeFileSync(path.join(output, 'SUMMARY.json'), JSON.stringify(report, null, 2));
const spawnNode = async (file, args = [], env = {}) => {
    const child = spawn(process.execPath, [file, ...args], {
        cwd: desktop,
        windowsHide: true,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let text = '';
    child.stdout.on('data', b => text += b);
    child.stderr.on('data', b => text += b);
    const timer = setTimeout(() => child.kill(), 300000);
    const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
    });
    clearTimeout(timer);
    return { code, text };
};
const scopedMethods = new Set(['scopes', 'transformInput', 'healthInput', 'transport']);
function observeOwner(text, file) {
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const edits = [];
    const visit = node => {
        if (ts.isMethodDeclaration(node) && node.body && scopedMethods.has(node.name.getText(ast))) {
            const start = node.body.getStart(ast) + 1, end = node.body.end - 1;
            edits.push({ start, end });
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(edits.length, 4);
    for (const e of edits.sort((a, b) => b.start - a.start))
        text = text.slice(0, e.start)
            + 'return globalThis.__cachedValidation.withOwner(frozenOwner,async()=>{'
            + text.slice(e.start, e.end) + '});' + text.slice(e.end);
    return text;
}
try {
    if (!process.argv.includes('--boundaries-only')) {
        // Only an explicitly selected reviewed cached fixture is read; all test writes use fresh owned TEMP.
        const fixture = process.env.PHASE8_CACHED_FIXTURE_DB;
        assert(fixture, 'Set PHASE8_CACHED_FIXTURE_DB to a reviewed ready fixture app.db; --boundaries-only needs no fixture');
        report.fixtureDb = path.resolve(fixture);
        const sourceDb = new DatabaseSync(report.fixtureDb, { readOnly: true });
        const artifact = JSON.parse(sourceDb.prepare('SELECT payload_json FROM xiaozhi_acquisition_artifacts_v1 LIMIT 1').get().payload_json);
        const operation = JSON.parse(sourceDb.prepare('SELECT payload_json FROM xiaozhi_acquisition_operations_v1 LIMIT 1').get().payload_json);
        sourceDb.close();
        assert.equal(operation.artifactId, artifact.id);
        assert.equal(artifact.status, 'ready');
        assert(Date.parse(artifact.expiresAt) > Date.now());
        fs.writeFileSync(path.join(output, 'fixture-contract.json'), JSON.stringify({ artifact, operation }, null, 2));
        fs.copyFileSync(path.join(desktop, 'package.json'), path.join(output, 'package.json'));
        fs.symlinkSync(path.join(desktop, 'node_modules'), path.join(output, 'node_modules'), 'junction');
        const hashes = {};
        await build({
            absWorkingDir: desktop,
            entryPoints: ['scripts/xiaozhi-agent/phase7-acquisition-recovery-worker.ts'],
            outfile: path.join(output, 'worker.mjs'),
            bundle: true,
            packages: 'external',
            platform: 'node',
            format: 'esm',
            target: 'node24',
            logLevel: 'warning',
            plugins: [
                {
                    name: 'scoped-validation-evidence',
                    setup(b) {
                        b.onLoad({ filter: /\.ts$/ }, args => {
                            let text = fs.readFileSync(args.path, 'utf8');
                            hashes[path.relative(desktop, args.path).replaceAll('\\', '/')] = hash(Buffer.from(text));
                            const file = args.path.replaceAll('\\', '/');
                            if (file.endsWith('/mcp-controlled-service.ts'))
                                text = observeOwner(text, file);
                            if (file.endsWith('/acquisition/file-hash.ts')) {
                                text = text.replace('export async function hashCapabilityFile(', 'async function originalObservedHash(');
                                text += '\nexport async function hashCapabilityFile(filename:string,signal?:AbortSignal){'+
                        'globalThis.__cachedValidation.hashes.push({filename,owner:globalThis.__cachedValidation.owner()});'+
                        'return originalObservedHash(filename,signal);}\n';
                            }
                            if (file.endsWith('/phase7-acquisition-recovery-worker.ts'))
                                text = text.replace(
                                    'report.modelCalls=calls;',
                                    'report.modelCalls=calls;globalThis.__cachedValidation.finish(report);');
                            return { contents: text, loader: 'ts', resolveDir: path.dirname(args.path) };
                        });
                    }
                }
            ]
        });
        fs.writeFileSync(path.join(output, 'source-hashes.json'), JSON.stringify(hashes, null, 2));
        const observer = path.join(output, 'observer.cjs');
        fs.writeFileSync(observer, `
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');
module.exports = out => {
    const owner = new AsyncLocalStorage();
    global.__cachedValidation = {
        hashes: [],
        owner: () => owner.getStore(),
        withOwner: (value, action) => owner.run(value, action),
        finish: report => {
            const counts = report.checks.slice(-2).map(check => ({
                runId: check.runId,
                name: check.name,
                count: global.__cachedValidation.hashes.filter(h =>
                     h.owner?.runId === check.runId
                    && path.basename(h.filename) === 'node.exe'
                    && !h.filename.includes('.runtime')).length
            }));
            fs.writeFileSync(path.join(out, 'SOURCE_SHA_COUNTS.json'), JSON.stringify({ counts, hashes: global.__cachedValidation.hashes }, null, 2));
            if (report.success)
                for (const c of counts)
                    assert.equal(c.count, 3, 'single Run source Node validation count');
        }
    };
};
`);
        const bootstrap = path.join(output, 'bootstrap.cjs');
        fs.writeFileSync(bootstrap, `
const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(output, 'profile'))});
app.whenReady().then(async () => {
    try {
        require(${JSON.stringify(observer)})(${JSON.stringify(output)});
        await import(${JSON.stringify(pathToFileURL(path.join(output, 'worker.mjs')).href)});
        app.exit(process.exitCode || 0);
    }
    catch (e) {
        console.error(e.stack);
        app.exit(1);
    }
});
`);
        const env = { ...process.env, PHASE7_APPROVAL_SCOPE: 'task' };
        delete env.PHASE7_EXPECT_OPERATION_BOUNDARY;
        delete env.NODE_OPTIONS;
        delete env.ELECTRON_RUN_AS_NODE;
        for (const key of Object.keys(env))
            if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key))
                delete env[key];
        const stream = fs.createWriteStream(path.join(output, 'worker.log'));
        const child = spawn(require('electron'), [bootstrap, output], { cwd: desktop, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.pipe(stream, { end: false });
        child.stderr.pipe(stream, { end: false });
        const timeout = setTimeout(() => child.kill(), 300000);
        const code = await new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('exit', resolve);
        });
        clearTimeout(timeout);
        await new Promise(resolve => stream.end(resolve));
        const host = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
        assert.equal(code, 0, host.error || 'Host worker failed');
        assert(host.success && host.checks.length === 3 && host.checks.every(c => c.pass));
        assert.equal(host.paidCalls, 0);
        assert.equal(host.sourceRequests.length, 0);
        const counts = JSON.parse(fs.readFileSync(path.join(output, 'SOURCE_SHA_COUNTS.json'), 'utf8'));
        assert(counts.counts.every(c => c.count === 3));
        report.checks.push({
            name: 'Real same Task and cold-main cached chain retains native/private readback with three owner source Node hashes',
            pass: true,
            hostChecks: host.checks,
            counts: counts.counts,
            runtimeRoot: host.root,
            approvalScope: host.approvalScope,
            approvals: host.approvals,
            sourceRequests: host.sourceRequests,
            paidCalls: host.paidCalls
        });
    }
    const boundaryRoot = path.join(output, 'boundaries');
    fs.mkdirSync(boundaryRoot);
    const leaf = path.join(output, 'boundary.mjs');
    fs.writeFileSync(leaf, BOUNDARY_SOURCE);
    const result = await spawnNode(leaf, [boundaryRoot]);
    fs.writeFileSync(path.join(output, 'boundary.log'), result.text);
    const boundary = JSON.parse(fs.readFileSync(path.join(boundaryRoot, 'REPORT.json'), 'utf8'));
    assert.equal(result.code, 0, boundary.error);
    assert(boundary.success && boundary.checks.length === 11 && boundary.activeLeases === 0);
    report.checks.push({
        name: 'Projection isolation, file versions/SHA, binding, owner and revocation boundaries',
        pass: true,
        checks: boundary.checks
    });
    for (const item of sources)
        assert.equal(hash(fs.readFileSync(path.join(desktop, item.file))), item.sha256, 'source changed during scoped validation');
    report.success = true;
}
catch (error) {
    report.error = error.stack;
    process.exitCode = 1;
}
finally {
    save();
    console.log(JSON.stringify({ success: report.success, output, checks: report.checks.length, error: report.error }));
}
