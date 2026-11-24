$ErrorActionPreference = 'Stop'
$reportRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../acceptance/ui-ux-r1-20261124'))
$inputRecord = Get-Content -LiteralPath (Join-Path $reportRoot 'evidence/ppt-native-input.json') -Raw | ConvertFrom-Json
$source = [IO.Path]::GetFullPath($inputRecord.path)
$ownedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../test-results')) + [IO.Path]::DirectorySeparatorChar
if (-not $source.StartsWith($ownedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Only owned test output may be opened' }
$output = Join-Path $reportRoot 'evidence/ppt-native-open'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$before = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$existing = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$powerPoint = $null; $deck = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $deck = $powerPoint.Presentations.Open($source, -1, 0, 0)
  if ($deck.Slides.Count -ne $inputRecord.expectedPages) { throw 'Native slide count mismatch' }
  $pages = @()
  for ($i = 1; $i -le $deck.Slides.Count; $i++) {
    $slide = $deck.Slides.Item($i)
    $image = Join-Path $output ('page-{0}.png' -f $i)
    $slide.Export($image, 'PNG', 1600, 900)
    $pages += @{ number = $i; shapes = $slide.Shapes.Count; image = $image }
  }
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $before) { throw 'Read-only native opening changed original output' }
  @{ success = $true; source = $source; sha256 = $before; pages = $pages; boundary = 'Installed PowerPoint COM opens and renders the actual real-provider PPT read-only; original bytes preserved. No WPS or teacher aesthetic acceptance claim.' } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $output 'report.json') -Encoding utf8
} finally {
  if ($deck) { $deck.Close() }
  if ($powerPoint) { if ($existing.Count -eq 0) { $powerPoint.Quit() }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint) }
}
