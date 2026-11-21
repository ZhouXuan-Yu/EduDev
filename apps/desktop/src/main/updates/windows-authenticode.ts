import {execFile} from 'node:child_process';
import path from 'node:path';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const command = Buffer.from(`
$ErrorActionPreference = 'Stop'
$signature = Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $env:OMNI_EDU_UPDATE_CANDIDATE
[Console]::Write([string]$signature.Status)
`, 'utf16le').toString('base64');

export async function hasValidWindowsSignature(file: string) {
  if (process.platform !== 'win32') return false;
  const directory = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0');
  try {
    const {stdout} = await exec(path.join(directory, 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', command], {
        timeout: 30000, windowsHide: true, maxBuffer: 16384,
        env: {...process.env, PSModulePath: path.join(directory, 'Modules'), OMNI_EDU_UPDATE_CANDIDATE: file},
      });
    return stdout.trim() === 'Valid';
  } catch {
    return false;
  }
}
