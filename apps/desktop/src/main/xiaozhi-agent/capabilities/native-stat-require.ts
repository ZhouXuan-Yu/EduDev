import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const allowedBuiltins = new Set([
    'fs', 'path', 'node:crypto', 'node:dns/promises', 'node:fs',
    'node:net', 'node:path', 'node:url'
]);
const allowedPackages = new Set(['ipaddr.js', 'undici', 'jsdom']);

function applicationRoot() {
    let directory = path.dirname(fileURLToPath(import.meta.url));
    while (true) {
        const filename = path.join(directory, 'package.json');
        if (fs.existsSync(filename)) {
            const packageJson = JSON.parse(fs.readFileSync(filename, 'utf8'));
            if (packageJson.name === 'omni-edu-desktop-prototype') {
                return directory;
            }
        }
        const parent = path.dirname(directory);
        if (parent === directory) {
            throw Error('capability_untrusted_dependency_root');
        }
        directory = parent;
    }
}

function within(root: string, filename: string) {
    const relative = path.relative(root, filename);
    return relative !== '' && !relative.startsWith('..' + path.sep)
        && relative !== '..' && !path.isAbsolute(relative);
}

/** External modules belong to the installed application, never the retained artifact. */
export function createNativeStatRequire() {
    const root = applicationRoot();
    const applicationRequire = createRequire(path.join(root, 'package.json'));
    const dependencies = fs.realpathSync(path.join(root, 'node_modules'));
    return (specifier: string): unknown => {
        if (allowedBuiltins.has(specifier)) {
            return applicationRequire(specifier);
        }
        if (specifier === 'electron' && process.versions.electron) {
            return applicationRequire('electron');
        }
        if (!allowedPackages.has(specifier)) {
            throw Error('capability_untrusted_dependency');
        }
        // Resolve an absolute application package directory. Bare resolution could
        // fall back to user ancestors or NODE_PATH when an install is incomplete.
        const packageDirectory = fs.realpathSync(path.join(dependencies, specifier));
        if (!within(dependencies, packageDirectory)) {
            throw Error('capability_untrusted_dependency');
        }
        const resolved = fs.realpathSync(applicationRequire.resolve(packageDirectory));
        if (!within(packageDirectory, resolved)) {
            throw Error('capability_untrusted_dependency');
        }
        return applicationRequire(resolved);
    };
}
