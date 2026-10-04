// Test the locked official Windows sandbox, using synthetic files only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCodexRuntime } from './codex-runtime.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportRoot = join(appRoot, 'test-results/office-plan');
mkdirSync(reportRoot, { recursive: true });
const root = mkdtempSync(join(reportRoot, 'windows-permission-'));
const home = join(root, 'runtime'); const workspace = join(root, 'workspace'); const excluded = join(root, 'excluded');
for (const directory of [home, workspace, excluded]) mkdirSync(directory);
writeFileSync(join(workspace, 'allowed.txt'), 'ALLOWED-SYNTHETIC');
writeFileSync(join(excluded, 'private.txt'), 'EXCLUDED-SYNTHETIC');
const tomlPath = path => JSON.stringify(path.replaceAll('\\', '/'));
const quotePs = value => `'${value.replaceAll("'", "''")}'`;
writeFileSync(join(home, 'config.toml'), [
  'default_permissions = "office-read"', '[windows]', 'sandbox = "unelevated"',
  '[permissions.office-read.filesystem]', '":root" = "deny"', '":minimal" = "read"',
  `${tomlPath(workspace)} = "read"`, `${tomlPath(excluded)} = "deny"`,
  '[permissions.office-read.network]', 'enabled = false',
].join('\n'));
const probe = [
  '$ErrorActionPreference = "Stop"', '$result = [ordered]@{}',
  `try { $result.insideRead = ((Get-Content -LiteralPath ${quotePs(join(workspace, 'allowed.txt'))} -Raw) -eq 'ALLOWED-SYNTHETIC') } catch { $result.insideRead = $false }`,
  `try { Get-Content -LiteralPath ${quotePs(join(excluded, 'private.txt'))} -Raw | Out-Null; $result.outsideReadDenied = $false } catch { $result.outsideReadDenied = $true }`,
  `try { Set-Content -LiteralPath ${quotePs(join(workspace, 'write.txt'))} -Value 'UNAPPROVED'; $result.insideWriteDenied = $false } catch { $result.insideWriteDenied = $true }`,
  `try { Set-Content -LiteralPath ${quotePs(join(excluded, 'write.txt'))} -Value 'UNAPPROVED'; $result.outsideWriteDenied = $false } catch { $result.outsideWriteDenied = $true }`,
  '$result | ConvertTo-Json -Compress',
].join('\n');
writeFileSync(join(workspace, 'probe.ps1'), probe);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|COMSPEC|PROCESSOR_ARCHITECTURE)$/i.test(key)));
env.CODEX_HOME = home;
const runtime = resolveCodexRuntime();
const result = spawnSync(runtime.binaryPath, ['sandbox', '-P', 'office-read', '-C', workspace,
  'powershell.exe', '-NoProfile', '-NonInteractive', '-File', join(workspace, 'probe.ps1')],
{ cwd: workspace, env, windowsHide: true, encoding: 'utf8', timeout: 45000, maxBuffer: 65536 });
let success = false; let checks; let failure;
try {
  assert.equal(result.status, 0, result.stderr.slice(0, 1500));
  const line = result.stdout.trim().split(/\r?\n/).find(line => line.startsWith('{'));
  checks = JSON.parse(line || '{}');
  assert.deepEqual(checks, { insideRead: true, outsideReadDenied: true, insideWriteDenied: true, outsideWriteDenied: true });
  assert.equal(readFileSync(join(excluded, 'private.txt'), 'utf8'), 'EXCLUDED-SYNTHETIC');
  assert.ok(!existsSync(join(workspace, 'write.txt')) && !existsSync(join(excluded, 'write.txt')));
  success = true;
} catch (error) { failure = error.message.slice(0, 2000); process.exitCode = 1; }
const report = { suite: 'official-windows-unelevated-permissions', timestamp: new Date().toISOString(), success,
  runtime: runtime.version, runRoot: relative(appRoot, root), checks, failure,
  exitCode: result.status, signal: result.signal, startupError: result.error?.message,
  stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 3000),
  scope: 'Synthetic local files, private CODEX_HOME; no elevated setup or provider credential' };
writeFileSync(join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ suite: report.suite, success, checks, failure, report: relative(appRoot, join(root, 'report.json')) }));
