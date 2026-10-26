$ErrorActionPreference = 'Stop'
$desktop = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$releaseRoot = Join-Path $desktop '.release'
$destination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot '安装验收'))
$package = Get-Content -LiteralPath (Join-Path $desktop 'package.json') -Raw | ConvertFrom-Json
$installer = Join-Path $releaseRoot ('Xiaozhi-Setup-' + $package.version + '-x64.exe')
$output = Join-Path $desktop ('test-results/goal/kb-s0/install-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
if (-not $destination.StartsWith($releaseRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe install probe target' }
if (Test-Path -LiteralPath $destination) { throw 'Install probe target already exists; preserve it' }
if (-not (Test-Path -LiteralPath $installer)) { throw 'Build NSIS first' }
# Do not overwrite an installed product or an existing shortcut during acceptance.
$registryRoots = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
foreach ($key in $registryRoots) {
    $existing = Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '小智|omni.edu|edudev' }
    if ($existing) { throw 'Existing product found; install probe must not replace it' }
}
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('Programs'))) {
    if (Test-Path -LiteralPath (Join-Path $folder '小智.lnk')) { throw 'Existing shortcut found; preserve it' }
}
New-Item -ItemType Directory -Path $output | Out-Null
$report = @{ success = $false; installer = $installer; destination = $destination; boundary = 'Per-user install on this Windows host; no clean VM, OS upgrade or signed release acceptance.' }
$installed = $false
try {
    $process = Start-Process -FilePath $installer -ArgumentList @('/S', '/currentuser', ('/D=' + $destination)) -WindowStyle Hidden -PassThru
    Write-Output ('INSTALL_PID=' + $process.Id)
    $process.WaitForExit()
    $report.installExit = $process.ExitCode
    if ($process.ExitCode -ne 0) { throw 'NSIS installation failed' }
    $installed = $true
    $executable = Join-Path $destination '小智.exe'
    if (-not (Test-Path -LiteralPath $executable)) { throw 'Installed executable missing' }
    $env:OMNI_EDU_PACKAGED_EXE = $executable
    & (Get-Command node).Source (Join-Path $PSScriptRoot 'packaged-smoke.mjs') *> (Join-Path $output 'installed-smoke.log')
    $report.smokeExit = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) { throw 'Installed executable acceptance failed' }
    $report.success = $true
} catch {
    $report.error = $_.Exception.Message
} finally {
    Remove-Item Env:OMNI_EDU_PACKAGED_EXE -ErrorAction SilentlyContinue
    if ($installed) {
        $uninstallers = @(Get-ChildItem -LiteralPath $destination -Filter 'Uninstall*.exe' -File)
        if ($uninstallers.Count -eq 1) {
            $uninstall = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList @('/S', '/currentuser', ('_?=' + $destination)) -WindowStyle Hidden -PassThru
            Write-Output ('UNINSTALL_PID=' + $uninstall.Id)
            $uninstall.WaitForExit()
            $report.uninstallExit = $uninstall.ExitCode
            $report.executableRemoved = -not (Test-Path -LiteralPath (Join-Path $destination '小智.exe'))
            if ($uninstall.ExitCode -ne 0 -or -not $report.executableRemoved) { $report.success = $false }
            # _?= runs the uninstaller in place. Remove only that known leftover in our previously absent probe directory.
            $remaining = @(Get-ChildItem -LiteralPath $destination -Force)
            if ($report.executableRemoved -and $remaining.Count -eq 1 -and $remaining[0].FullName -eq $uninstallers[0].FullName) {
                Remove-Item -LiteralPath $uninstallers[0].FullName
                Remove-Item -LiteralPath $destination
                $report.probeDirectoryRemoved = $true
            }
        } else { $report.success = $false; $report.uninstallError = 'Uninstaller missing or ambiguous; preserve install directory' }
    }
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'report.json') -Encoding utf8
    $report | ConvertTo-Json -Depth 5
    Write-Output ('INSTALL_REPORT=' + $output)
}
if (-not $report.success) { exit 1 }
