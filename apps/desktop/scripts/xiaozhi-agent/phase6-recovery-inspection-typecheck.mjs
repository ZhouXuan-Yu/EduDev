import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-recovery-inspection-types-'));
const source = path.resolve('src/main/xiaozhi-agent/tasks/recovery-inspection.ts');
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram([source], {...parsed.options, noEmit: true, incremental: false});
const diagnostics = ts.getPreEmitDiagnostics(program);
const own = diagnostics.filter(item => !item.file || path.resolve(item.file.fileName) === source);
const describe = item => {
  const point = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : undefined;
  return {file: item.file?.fileName, line: point ? point.line + 1 : null, code: item.code,
    message: ts.flattenDiagnosticMessageText(item.messageText, '\n')};
};
const report = {success: own.length === 0, source, ownDiagnostics: own.map(describe),
  dependencyDiagnostics: diagnostics.filter(item => !own.includes(item)).map(describe),
  boundary: 'One owned source root, original tsconfig options, noEmit. Dependency diagnostics are retained separately. Core owns final whole-tree typecheck and build.'};
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({success: report.success, ownDiagnostics: own.length, dependencyDiagnostics: report.dependencyDiagnostics.length, root}));
if (!report.success) process.exitCode = 1;
