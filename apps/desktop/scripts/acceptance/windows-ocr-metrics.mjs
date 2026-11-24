import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);

/** Sample native OCR children owned by this Electron instance. */
export async function windowsOcrMetrics(processIds) {
  if (process.platform !== 'win32') return {workers: [], unsupported: true};
  const parents = [...new Set(processIds.filter(pid => Number.isSafeInteger(pid) && pid > 0))];
  if (!parents.length) return {workers: [], error: 'No Electron parent process IDs'};
  const command = `$owned=@(${parents.join(',')})
$children=Get-CimInstance Win32_Process -Filter "Name='omni-edu-ocr.exe'" -ErrorAction Stop
$rows=@(foreach($child in $children){
 if($owned -contains [int]$child.ParentProcessId){
  $process=Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
  if($process){[pscustomobject]@{pid=$process.Id;parentPid=$child.ParentProcessId;workingSetBytes=$process.WorkingSet64;privateBytes=$process.PrivateMemorySize64;cpuSeconds=$process.CPU}}
 }
})
ConvertTo-Json -InputObject $rows -Compress`;
  try {
    const {stdout} = await run('powershell.exe', ['-NoProfile', '-Command', command], {windowsHide: true, timeout: 7000});
    return {workers: JSON.parse(stdout)};
  } catch (error) {
    return {workers: [], error: String(error.code ?? error.name)};
  }
}
