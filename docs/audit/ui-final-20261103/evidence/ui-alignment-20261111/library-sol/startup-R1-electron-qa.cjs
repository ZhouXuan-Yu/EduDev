'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');

// Owned utility fixture uses the original frozen web-reader chunk. No source TS loader.
if (process.parentPort) {
    globalThis.fetch = async () => { throw Error('Owned parser QA forbids external HTTP'); };
    let received = false;
    process.parentPort.on('message', async ({ data }) => {
        if (received) return;
        received = true;
        if (data.mode === 'stall') { setInterval(() => {}, 1000); return; }
        try {
            fs.writeFileSync(path.join(data.output, 'reader-entered.json'), JSON.stringify({ pid: process.pid, stage: 'before-reader-import' }));
            const began = performance.now();
            const reader = await import(data.readerUrl);
            const document = await reader.htmlToMarkdownDocument(data.html, 'https://parser-fixture.example/');
            process.parentPort.postMessage({ ok: true, firstUseMs: performance.now() - began,
                data: { text: document.content, title: document.title, format: document.format } });
        } catch (error) { process.parentPort.postMessage({ ok: false, error: String(error.code || error.name) }); }
    });
} else {
    if (!process.versions.electron) throw Error('Run only through the owned Electron runner');
    const { app, utilityProcess } = require('electron');
    const option = name => process.argv.find(value => value.startsWith('--' + name + '='))?.split('=').slice(1).join('=');
    const buildRoot = fs.realpathSync(option('build-root'));
    const output = fs.realpathSync(option('output'));
    const mode = option('qa-case');
    const assert = require('node:assert/strict');
    assert(['xml', 'html', 'hana-reader', 'reader-cancel', 'utility-timeout'].includes(mode));
    app.setPath('userData', path.join(output, 'profile'));
    app.setPath('sessionData', path.join(output, 'profile'));
    const report = { mode, buildRoot, output, ok: false, versions: process.versions, checks: [], childPids: [],
        boundary: 'Fresh Electron; original frozen inspection worker and utility parent. Hana reader case invokes the original built reader in an owned utility fixture; actual Hana main-thread execute acceptance remains a separate root chain.' };
    const children = [], exits = [];
    const originalFork = utilityProcess.fork;
    utilityProcess.fork = function (...args) {
        const child = Reflect.apply(originalFork, this, args);
        children.push(child);
        exits.push(new Promise(resolve => child.once('exit', resolve)));
        child.once('spawn', () => report.childPids.push(child.pid));
        return child;
    };
    app.whenReady().then(async () => {
        let cancelPoll;
        try {
            const mainDir = path.join(buildRoot, 'main');
            const host = await import(pathToFileURL(path.join(mainDir, 'ocr-runtime.js')).href);
            const runLocalUtility = Object.values(host).find(value => typeof value === 'function' && value.name === 'runLocalUtility');
            assert(runLocalUtility, 'Frozen build must expose the original shared utility parent');
            process.stdout.write('R1_READY\n');
            const html = '<!doctype html><html><body><article><h1>冷首用真实解析</h1><p>来源保留。</p><a href="/source">出处</a></article><script>globalThis.R1_EXECUTED=true</script></body></html>';
            const xml = '<svg xmlns="http://www.w3.org/2000/svg"><title>冷首用真实解析</title><text>来源保留</text></svg>';
            const controller = new AbortController();
            let request, entry = 'inspection-worker.js';
            const readerCase = mode === 'hana-reader' || mode === 'reader-cancel';
            const timeout = readerCase ? 30000 : 15000;
            if (readerCase) {
                const main = fs.readFileSync(path.join(mainDir, 'index.js'), 'utf8');
                const wrapper = /async function htmlToMarkdownDocument\([^]*?const reader = await import\("(\.\/[^"\n]+)"\)/.exec(main);
                assert(wrapper, 'Expected on-demand reader in this exact formal build');
                const reader = fs.realpathSync(path.join(mainDir, wrapper[1]));
                assert(path.dirname(reader) === fs.realpathSync(mainDir));
                entry = path.relative(mainDir, __filename);
                request = { mode: 'reader', readerUrl: pathToFileURL(reader).href, output, html };
                report.reader = path.basename(reader);
                if (mode === 'reader-cancel') cancelPoll = setInterval(() => {
                    if (fs.existsSync(path.join(output, 'reader-entered.json'))) controller.abort('cancelled');
                }, 20);
            } else if (mode === 'utility-timeout') {
                entry = path.relative(mainDir, __filename);
                request = { mode: 'stall' };
            } else request = { schemaVersion: 'xiaozhi.delivery-structure.v1', requestId: 'xicheckreq_' + randomUUID(),
                name: mode === 'xml' ? 'fixture.svg' : 'fixture.html', bytes: new Uint8Array(Buffer.from(mode === 'xml' ? xml : html)) };
            report.budgetMs = timeout;
            const began = performance.now();
            const result = await runLocalUtility({ entry, serviceName: 'R1 owned cold parser', request, timeout,
                signal: controller.signal, valid: value => value && typeof value.ok === 'boolean'
                    && (readerCase ? value.ok ? typeof value.data?.text === 'string' : typeof value.error === 'string'
                        : value.schemaVersion === request.schemaVersion && value.requestId === request.requestId),
                fail: error => ({ ok: false, error }) });
            clearInterval(cancelPoll);
            report.firstUseMs = performance.now() - began;
            report.result = { ok: result.ok, error: result.error, engine: result.data?.engine, readerFirstUseMs: result.firstUseMs };
            if (mode === 'reader-cancel') assert.equal(result.error, 'cancelled');
            else if (mode === 'utility-timeout') assert.equal(result.error, 'timeout');
            else {
                assert(result.ok, 'Cold first use failed inside original ' + timeout + 'ms budget: ' + result.error);
                assert(report.firstUseMs < timeout);
                const text = readerCase ? result.data.text : result.data.pages[0].text;
                assert.match(text, /冷首用真实解析/);
                assert.doesNotMatch(text, /R1_EXECUTED/);
                if (readerCase) assert.match(text, /https:\/\/parser-fixture.example\/source/);
                else assert.match(result.data.engine, /jsdom29\.0\.2/);
            }
            report.checks.push('Original first-use budget and expected parser/cancel/timeout result');
            let timer;
            await Promise.race([Promise.all(exits), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Owned child exit missing')), 5000); })]).finally(() => clearTimeout(timer));
            report.checks.push('Every owned utility child exited after the original parent termination');
            report.ok = true;
        } catch (error) { report.failure = String(error.stack).slice(0, 2500); }
        finally {
            clearInterval(cancelPoll);
            utilityProcess.fork = originalFork;
            for (const child of children) { try { child.kill(); } catch {} }
            report.httpAttempts = globalThis.__startupHttp?.length ?? null;
            if (report.httpAttempts !== 0) { report.ok = false; report.failure ||= 'Owned network boundary was missing or received HTTP'; }
            fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
            app.exit(report.ok ? 0 : 1);
        }
    }).catch(error => {
        report.failure = String(error.stack).slice(0, 2500);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        app.exit(1);
    });
}
