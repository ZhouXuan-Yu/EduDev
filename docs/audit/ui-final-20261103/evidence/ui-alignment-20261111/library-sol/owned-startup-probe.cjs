'use strict';
const fs = require('node:fs');
const path = require('node:path');
const modules = require('node:module');
const { fileURLToPath } = require('node:url');

module.exports = function install({ electron, output, repository } = {}) {
    try {
    const app = electron.app;
    const root = path.resolve(repository);
    const reportFile = path.join(output, 'module-startup-probe.json');
    const write = fs.writeFileSync.bind(fs);
    const started = process.hrtime.bigint();
    const initialCpu = process.cpuUsage();
    const slow = [], totals = Object.create(null), restore = [];
    let hooks, stopped = false, observerErrors = 0, slowCount = 0;
    const availability = { moduleHooks: 'unavailable' };
    function label(value) {
        if (typeof value !== 'string') return 'non-string-path';
        try {
            if (value.startsWith('file:')) value = fileURLToPath(value);
            else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return 'non-file-url';
            value = value.split(/[?#]/, 1)[0];
            if (!path.isAbsolute(value)) return path.basename(value) || 'module';
            const relative = path.relative(root, value);
            return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)
                ? relative.split(path.sep).join('/') : path.basename(value);
        } catch { return 'unavailable-path'; }
    }
    function observe(kind, id, original, receiver, args) {
        if (stopped) return Reflect.apply(original, receiver, args);
        let sample;
        try { sample = { tick: process.hrtime.bigint(), cpu: process.cpuUsage() }; }
        catch { observerErrors++; }
        let threw = true;
        try {
            const result = Reflect.apply(original, receiver, args);
            threw = false;
            return result;
        } finally {
            if (sample && !stopped) {
                try {
                    const elapsedMs = Number(process.hrtime.bigint() - sample.tick) / 1e6;
                    const cpu = process.cpuUsage(sample.cpu);
                    const total = totals[kind] || (totals[kind] = { calls: 0, threw: 0, elapsedMs: 0, cpuUserMs: 0, cpuSystemMs: 0 });
                    total.calls++;
                    total.threw += Number(threw);
                    total.elapsedMs += elapsedMs;
                    total.cpuUserMs += cpu.user / 1000;
                    total.cpuSystemMs += cpu.system / 1000;
                    if (elapsedMs > 10) {
                        slowCount++;
                        slow.push({ kind, id: label(id), startMs: Number(sample.tick - started) / 1e6,
                            elapsedMs, cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000, threw });
                        slow.sort((left, right) => right.elapsedMs - left.elapsedMs);
                        if (slow.length > 100) slow.pop();
                    }
                } catch { observerErrors++; }
            }
        }
    }
    function wrap(target, name, fileRead = false) {
        const kind = fileRead ? 'fs.readFileSync' : 'app.' + name;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(target, name);
            if (descriptor && (!('value' in descriptor) || !descriptor.writable)) {
                availability[kind] = 'not-writable';
                return;
            }
            const original = target[name];
            if (typeof original !== 'function') { availability[kind] = 'unavailable'; return; }
            function wrapped(...args) {
                return observe(kind, fileRead ? args[0] : name, original, this, args);
            }
            Object.defineProperty(target, name, descriptor ? { ...descriptor, value: wrapped }
                : { value: wrapped, writable: true, configurable: true });
            restore.push(() => {
                if (Object.getOwnPropertyDescriptor(target, name)?.value !== wrapped) return;
                if (descriptor) Object.defineProperty(target, name, descriptor);
                else delete target[name];
            });
            availability[kind] = 'installed';
        } catch { availability[kind] = 'installation-failed'; observerErrors++; }
    }
    function stop(reason) {
        if (stopped) return;
        stopped = true;
        let elapsedMs, cpu;
        try { elapsedMs = Number(process.hrtime.bigint() - started) / 1e6; cpu = process.cpuUsage(initialCpu); }
        catch { observerErrors++; }
        for (const cleanup of [
            () => app.removeListener('browser-window-created', onWindow),
            () => app.removeListener('will-quit', onQuit),
            () => hooks?.deregister(), ...restore.reverse(),
            () => modules.syncBuiltinESMExports(),
        ]) {
            try { cleanup(); } catch { observerErrors++; }
        }
        try {
            write(reportFile, JSON.stringify({ schemaVersion: 'owned-startup-probe.v1', reason, elapsedMs,
                versions: { node: process.versions.node, electron: process.versions.electron },
                cpu, availability, observerErrors, slowThresholdMs: 10, maxSlowCalls: 100,
                slowCount, totals, slow,
                note: 'Nested durations overlap; resolve/load excludes some evaluation work. CPU values in cpu are microseconds.'
            }), { encoding: 'utf8', flag: 'wx' });
        } catch { /* Observer output must not interrupt the application. */ }
    }
    function onWindow() { stop('browser-window-created'); }
    function onQuit() { stop('will-quit'); }
    try {
        app.once('browser-window-created', onWindow);
        app.once('will-quit', onQuit);
    } catch { stop('listener-installation-failed'); return; }
    for (const name of ['setName', 'setPath', 'requestSingleInstanceLock', 'setAppUserModelId']) wrap(app, name);
    wrap(fs, 'readFileSync', true);
    try { modules.syncBuiltinESMExports(); } catch { observerErrors++; }
    if (typeof modules.registerHooks === 'function') {
        try {
            hooks = modules.registerHooks({
                resolve(specifier, context, nextResolve) {
                    return observe('resolve', specifier, nextResolve, this, [specifier, context]);
                },
                load(url, context, nextLoad) {
                    return observe('load', url, nextLoad, this, [url, context]);
                },
            });
            availability.moduleHooks = 'installed';
        } catch { availability.moduleHooks = 'installation-failed'; observerErrors++; }
    }
    } catch { /* Probe installation must not interrupt the original startup. */ }
};
