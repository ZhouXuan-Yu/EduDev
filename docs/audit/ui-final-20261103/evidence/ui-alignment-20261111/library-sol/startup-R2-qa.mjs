import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const output = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(output, '../../../../..');
const desktop = path.join(repository, 'apps/desktop');
const ts = createRequire(path.join(desktop, 'package.json'))('typescript');
const shared = 'apps/desktop/src/shared/';
const artifacts = shared + 'xiaozhi-office-artifacts.ts';
const delivery = shared + 'xiaozhi-delivery-checks.ts';
const leaf = shared + 'office-relative-path.ts';
const baselineFile = path.join(output, 'startup-R2-baseline.json');
const printer = ts.createPrinter({ removeComments: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(repository, file), 'utf8');
const parse = (file, text = read(file)) => {
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    assert.equal(ast.parseDiagnostics.length, 0, file);
    return ast;
};
const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast);
const declaresPath = node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(declaration => declaration.name.getText() === 'officeRelativePath');
const importsPath = node => ts.isImportDeclaration(node)
    && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
    && node.importClause.namedBindings.elements.some(element => element.name.text === 'officeRelativePath');
const isLeafExport = node => ts.isExportDeclaration(node) && node.moduleSpecifier?.text === './office-relative-path';
function surface(ast) {
    const names = new Map();
    for (const node of ast.statements) {
        if (ts.isExportDeclaration(node)) {
            assert(node.exportClause && ts.isNamedExports(node.exportClause), 'Named exports required for compatibility audit');
            for (const element of node.exportClause.elements) names.set(element.name.text, node.isTypeOnly || element.isTypeOnly ? 'type' : 'value');
        } else if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
            if (ts.isVariableStatement(node)) {
                for (const declaration of node.declarationList.declarations) names.set(declaration.name.getText(ast), 'value');
            } else if (node.name) names.set(node.name.text, ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ? 'type' : 'value');
        }
    }
    return [...names].sort(([left], [right]) => left.localeCompare(right));
}
function originalBody(ast, file) {
    return ast.statements.filter(node => {
        if (file === artifacts) return !declaresPath(node) && !importsPath(node) && !isLeafExport(node);
        return !importsPath(node);
    }).map(node => print(node, ast)).join('\n');
}
function predicate(statement, ast) {
    const source = ts.transpileModule(print(statement, ast), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const sandbox = { exports: {} };
    new vm.Script(source, { filename: 'r2-path-predicate-only.js' }).runInNewContext(sandbox);
    assert.equal(typeof sandbox.exports.officeRelativePath, 'function');
    return sandbox.exports.officeRelativePath;
}
function vectors() {
    const strings = ['', 'a', 'report.docx', '目录/原件.txt', 'a b/report.txt', '/a', 'C:/a', 'C:\\a',
        'a\\b', 'a/', 'a//b', 'a/./b', 'a/../b', '.env', '.git/config', '.config', '.pi', '.Pi/a',
        '.ssh/key', 'a/.aws/key', '.azure/key', '.ssh2/key', '.azure.notes', '..hidden.txt',
        'a.'.repeat(1), 'a ', 'a./b', 'a /b', 'a\u007f.txt', '😀/资料.md', 'a'.repeat(500), 'a'.repeat(501),
        Array(8).fill('a').join('/'), Array(9).fill('a').join('/')];
    for (const name of ['con', 'prn', 'aux', 'nul', 'com0', 'com1', 'com9', 'com10', 'lpt0', 'lpt1', 'lpt9', 'lpt10']) {
        for (const value of [name, name.toUpperCase(), name + '.txt', 'a/' + name + '.txt']) strings.push(value);
    }
    for (const forbidden of ['\\', ':', '<', '>', '"', '|', '?', '*', ...Array.from({ length: 32 }, (_, index) => String.fromCharCode(index))]) {
        strings.push('a' + forbidden + 'b.txt', 'a/' + forbidden + 'b.txt');
    }
    for (const directory of ['.pi', '.ssh', '.aws', '.azure', '资料', '.env']) {
        for (const depth of [0, 1, 7, 8]) strings.push([...Array(depth).fill('a'), directory, 'result.txt'].join('/'));
    }
    return [...new Set(strings)].map(value => ({ kind: 'string', value })).concat(
        ['undefined', 'null', 'boolean', 'number', 'nan', 'array', 'object', 'boxed-string', 'symbol'].map(kind => ({ kind })));
}
function input(vector) {
    if (vector.kind === 'string') return vector.value;
    return { undefined, null: null, boolean: false, number: 1, nan: NaN, array: [], object: {},
        'boxed-string': new String('valid.txt'), symbol: Symbol('opaque') }[vector.kind];
}
const mode = process.argv[2];
const result = { mode, checks: [], success: false };
const check = (name, run) => { run(); result.checks.push(name); };
try {
    if (mode === '--capture') {
        assert(!fs.existsSync(baselineFile), 'Preserve the existing immutable pre-R2 baseline');
        assert(!fs.existsSync(path.join(repository, leaf)), 'Capture requires the pre-split source');
        const artifactAst = parse(artifacts);
        const statement = artifactAst.statements.find(declaresPath);
        assert(statement);
        const original = predicate(statement, artifactAst);
        const cases = vectors().map(vector => ({ ...vector, expected: original(input(vector)) }));
        const files = [artifacts, delivery].map(file => ({ path: file, sha256: hash(read(file)), source: read(file),
            otherAstSha256: hash(originalBody(parse(file), file)), exports: surface(parse(file)) }));
        fs.writeFileSync(baselineFile, JSON.stringify({ stage: 'S4-final-R2-before-release', files,
            pathDeclarationAstSha256: hash(print(statement, artifactAst)), cases }, null, 2), { flag: 'wx' });
        result.caseCount = cases.length;
        result.files = files.map(({ path, sha256 }) => ({ path, sha256 }));
        result.checks.push('Original function AST, full barrel/source AST and truth table captured without loading consumers');
    } else {
        const baseline = JSON.parse(fs.readFileSync(baselineFile));
        if (mode === '--verify-source') {
            const ast = parse(leaf);
            check('leaf contains only the unchanged exported original path declaration', () => {
                assert.equal(ast.statements.length, 1);
                assert(declaresPath(ast.statements[0]));
                assert.equal(hash(print(ast.statements[0], ast)), baseline.pathDeclarationAstSha256);
            });
            const candidate = predicate(ast.statements[0], ast);
            check('all original truth-table values remain exact', () => {
                for (const vector of baseline.cases) assert.equal(candidate(input(vector)), vector.expected, JSON.stringify(vector));
            });
            for (const file of baseline.files) {
                const current = parse(file.path);
                check('all other business/type AST stays unchanged ' + file.path, () => assert.equal(hash(originalBody(current, file.path)), file.otherAstSha256));
                const imports = current.statements.filter(importsPath);
                check('the only path binding imports the pure leaf ' + file.path, () => {
                    assert.equal(imports.length, 1);
                    assert.equal(imports[0].moduleSpecifier.text, './office-relative-path');
                    assert(!imports[0].importClause.isTypeOnly);
                });
                if (file.path === artifacts) check('original barrel export surface stays exact', () => assert.deepEqual(surface(current), file.exports));
            }
        } else if (mode === '--verify-api') {
            await import(pathToFileURL(path.join(desktop, 'scripts/office-agent/register-source.mjs')).href);
            const barrel = await import(pathToFileURL(path.join(repository, artifacts)).href);
            const pure = await import(pathToFileURL(path.join(repository, leaf)).href);
            const checks = await import(pathToFileURL(path.join(repository, delivery)).href);
            check('actual old barrel runtime exports and binding identity remain compatible', () => {
                const expected = baseline.files.find(file => file.path === artifacts).exports.filter(([, kind]) => kind === 'value').map(([name]) => name).sort();
                assert.deepEqual(Object.keys(barrel).sort(), expected);
                assert.strictEqual(barrel.officeRelativePath, pure.officeRelativePath);
                for (const vector of baseline.cases) assert.equal(barrel.officeRelativePath(input(vector)), vector.expected);
            });
            check('actual Office proposal and delivery input consumers retain path decisions', () => {
                const proposal = { path: '目录/result.docx', format: 'docx', sources: [], draft: {
                    schemaVersion: 'xiaozhi.office-draft.v1', title: 'R2路径兼容', sections: [{ heading: '正文', paragraphs: ['本机资料'] }] } };
                const request = { schemaVersion: 'xiaozhi.delivery-checks.v1', sessionId: 'aisession_11111111-1111-4111-8111-111111111111',
                    requestId: 'xicheckreq_11111111-1111-4111-8111-111111111111', files: [{ path: '目录/result.docx' }] };
                assert(barrel.validOfficeProposal(proposal));
                assert(checks.validDeliveryCheckInput(request));
                assert(!barrel.validOfficeProposal({ ...proposal, path: '.ssh/result.docx' }));
                assert(!checks.validDeliveryCheckInput({ ...request, files: [{ path: '../result.docx' }] }));
            });
        } else if (mode === '--verify-build') {
            assert(process.argv[3] && path.isAbsolute(process.argv[3]), 'Use the frozen absolute buildRoot');
            const main = fs.realpathSync(path.join(process.argv[3], 'main'));
            const visited = new Set(), external = new Set(), forbidden = [];
            function visit(file) {
                if (visited.has(file)) return;
                assert.equal(path.dirname(file), main, 'Static chunks must remain inside this frozen main output');
                visited.add(file);
                const source = fs.readFileSync(file, 'utf8');
                if (/^(?:paper-export-|materials-|xiaozhi-ocr-|xiaozhi-attachments-)/.test(path.basename(file))
                    || /\b(?:PAPER_[A-Z0-9_]+|CLASSROOM_(?:OFFICE|DOCUMENT_OFFICE)_SCHEMA)\b/.test(source)) forbidden.push(path.basename(file));
                for (const node of parse(file, source).statements) {
                    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
                    const specifier = node.moduleSpecifier.text;
                    if (specifier.startsWith('.')) visit(path.resolve(path.dirname(file), specifier));
                    else external.add(specifier);
                }
            }
            visit(path.join(main, 'inspection-worker.js'));
            result.closure = [...visited].map(file => ({ path: path.basename(file), sha256: hash(fs.readFileSync(file)) }));
            result.external = [...external];
            check('formal worker static closure removes DSL and paper/domain imports', () => {
                assert(![...external].some(specifier => specifier.startsWith('@openmaic/dsl')));
                assert.deepEqual(forbidden, []);
            });
        } else throw Error('Expected --capture, --verify-source, --verify-api or --verify-build');
    }
    result.success = true;
} catch (error) { result.failure = String(error.stack).slice(0, 3000); process.exitCode = 1; }
fs.writeFileSync(path.join(output, 'startup-R2-qa-' + String(mode).replace(/^--/, '') + '.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
