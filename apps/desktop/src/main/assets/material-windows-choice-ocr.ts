import { execFile } from 'node:child_process';
import path from 'node:path';
import { reserveLocalWorker } from '../xiaozhi-agent/local-utility-host';

export const WINDOWS_CHOICE_OCR_BATCH = 6;

// The executable and script are fixed. Pixels reach the worker only through stdin.
const script = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
$waiter = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation')
} | Select-Object -First 1
function Wait-Result($operation, $type) {
    $task = $waiter.MakeGenericMethod($type).Invoke($null, @($operation))
    if (!$task.Wait(4000)) { throw 'timeout' }
    $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('zh-Hans-CN'))
if (!$engine) { [Console]::Write('{"available":false}'); exit 0 }
$images = @((ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())))
$readings = foreach ($image in $images) {
    $memory = [System.IO.MemoryStream]::new([Convert]::FromBase64String($image))
    $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($memory)
    try {
        $decoder = Wait-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Wait-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $reading = Wait-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
            @{ lines = @($reading.Lines | ForEach-Object Text) }
        } finally { $bitmap.Dispose() }
    } finally { $stream.Dispose(); $memory.Dispose() }
}
[Console]::Write((ConvertTo-Json -InputObject @{ available=$true; readings=@($readings) } -Depth 5 -Compress))
`;

export async function recognizeWindowsChoiceCrops(images: Buffer[], signal: AbortSignal): Promise<string[][]> {
  if (process.platform !== 'win32' || !process.env.SystemRoot) throw Error('local_recheck_unavailable');
  if (images.length < 1 || images.length > WINDOWS_CHOICE_OCR_BATCH || images.some(image => image.length > 256 * 1024))
    throw Error('unit_too_large');
  signal.throwIfAborted();
  const release = reserveLocalWorker();
  if (!release) throw Error('busy');
  let exited: Promise<void> | undefined;
  try {
    const executable = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const command = Buffer.from(script, 'utf16le').toString('base64');
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', command], {
        windowsHide: true, timeout: 30000, maxBuffer: 16384, signal,
        env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.SystemRoot },
      }, (error, output) => error ? reject(Error(signal.aborted ? 'cancelled' : error.killed ? 'timeout' : 'local_recheck_unavailable')) : resolve(output));
      exited = new Promise(done => child.once('close', () => done()));
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(JSON.stringify(images.map(image => image.toString('base64'))));
    });
    signal.throwIfAborted();
    let value: unknown;
    try { value = JSON.parse(stdout); } catch { throw Error('local_recheck_unavailable'); }
    const receipt = value as { available?: boolean; readings?: { lines: string[] }[] } | null;
    if (receipt?.available !== true || !Array.isArray(receipt.readings) || receipt.readings.length !== images.length ||
        receipt.readings.some(row => !Array.isArray(row?.lines) || row.lines.length > 16 ||
          row.lines.some(line => typeof line !== 'string' || line.length > 384))) throw Error('local_recheck_unavailable');
    return receipt.readings.map(row => row.lines);
  } finally { await exited; release(); }
}
