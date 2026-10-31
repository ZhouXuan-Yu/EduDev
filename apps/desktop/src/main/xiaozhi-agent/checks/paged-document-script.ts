import {OFFICE_JOB_SOURCE} from './native-office-job';
/** Fixed local adapter: Windows rasterizes actual PDF bytes, Word only exports an owned read-only DOCX copy. */
export const PAGED_DOCUMENT_SCRIPT=String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
# Word's optional SaveChanges arguments are COM by-reference variants.
$discard=[object]0
$application=$null;$document=$null;$blank=$null;$job=$null;$owned=$false;$pdf=$null
$result=@{schemaVersion='xiaozhi.paged-render.v1';ok=$false;error='unavailable'}
try {
 $request=Get-Content -Raw -LiteralPath (Join-Path $env:XIAOZHI_RENDER_ROOT 'request.json') | ConvertFrom-Json
 $pdfPath=Join-Path $env:XIAOZHI_RENDER_ROOT 'input.pdf'
 $engine='Windows.Data.Pdf';$findings=New-Object 'Collections.Generic.List[object]'
 if($request.format -eq 'docx'){
  if(Get-Process WINWORD -ErrorAction SilentlyContinue){throw 'busy'}
  Add-Type -TypeDefinition @'
${OFFICE_JOB_SOURCE}
'@
  $start=[DateTime]::UtcNow;$application=New-Object -ComObject Word.Application
  if($application.Documents.Count -ne 0){throw 'busy'}
  $application.Visible=$false;$application.AutomationSecurity=3;$application.DisplayAlerts=0
  $blank=$application.Documents.Add()
  [uint32]$officeId=0;[void][XiaozhiRenderJob]::GetWindowThreadProcessId([IntPtr]([int64]$application.ActiveWindow.Hwnd),[ref]$officeId)
  $server=Get-Process -Id $officeId
  if($server.ProcessName -ne 'WINWORD' -or $server.StartTime.ToUniversalTime() -lt $start.AddSeconds(-1) -or $application.Documents.Count -ne 1){throw 'busy'}
  $owned=$true;$job=New-Object XiaozhiRenderJob($server.Handle)
  [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_RENDER_ROOT 'owned.json'),(@{pid=[int]$officeId;start=$server.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress))
  $blank.Close([ref]$discard);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($blank);$blank=$null
  $document=$application.Documents.Open((Join-Path $env:XIAOZHI_RENDER_ROOT 'input.docx'),$false,$true,$false)
  $document.Repaginate();$pageCount=[int]$document.ComputeStatistics(2)
  if($pageCount -lt 1 -or $pageCount -gt 64){throw 'too_large'}
  Add-Type -AssemblyName System.Drawing
  $fontSet=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $collection=New-Object Drawing.Text.InstalledFontCollection
  foreach($family in $collection.Families){[void]$fontSet.Add($family.Name);foreach($language in @(1033,2052)){try{[void]$fontSet.Add($family.GetName($language))}catch{}}}
  foreach($font in @($request.fonts)){if($font -and -not $fontSet.Contains($font) -and $findings.Count -lt 128){$findings.Add(@{code='font_missing';font=$font})}}
  $collection.Dispose()
  # Join-Path produces an ETS-wrapped string: marshal a BSTR explicitly or Word may hang.
  $document.ExportAsFixedFormat([string]$pdfPath,17,$false,0,0,1,1,0,$false,$false,0,$false,$true,$false)
  if((Get-Item -LiteralPath $pdfPath).Length -gt 16777216){throw 'too_large'}
  $engine='Word '+[string]$application.Version+' / Windows.Data.Pdf'
  $document.Close([ref]$discard);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document);$document=$null
  $application.Quit([ref]$discard);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application);$application=$null
  $job.Dispose();$job=$null
 }elseif($request.format -ne 'pdf'){throw 'unsupported'}
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 [void][Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
 [void][Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
 [void][Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime]
 [void][Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
 [void][Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
 $generic=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1})[0]
 $action=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1})[0]
 function Await($operation,[Type]$type){$task=$generic.MakeGenericMethod($type).Invoke($null,@($operation));$task.GetAwaiter().GetResult()}
 $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath)) ([Windows.Storage.StorageFile])
 $pdf=Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
 $actualPages=[int]$pdf.PageCount
 if($actualPages -lt 1 -or $actualPages -gt 64){throw 'too_large'}
 if(($request.format -eq 'pdf' -and $actualPages -ne [int]$request.pages) -or ($request.format -eq 'docx' -and $actualPages -ne $pageCount)){throw 'page_count_changed'}
 $pages=New-Object 'Collections.Generic.List[object]';$total=0
 for($index=0;$index -lt $actualPages;$index++){
  $page=$pdf.GetPage([uint32]$index);$stream=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream;$reader=$null
  try {
   $ratio=[Math]::Min(1600/[double]$page.Size.Width,1600/[double]$page.Size.Height)
   $width=[int][Math]::Round([double]$page.Size.Width*$ratio);$height=[int][Math]::Round([double]$page.Size.Height*$ratio)
   if($width -lt 16 -or $height -lt 16){throw 'unsupported'}
   $options=New-Object Windows.Data.Pdf.PdfPageRenderOptions;$options.DestinationWidth=[uint32]$width;$options.DestinationHeight=[uint32]$height
   $task=$action.Invoke($null,@($page.RenderToStreamAsync($stream,$options)));[void]$task.GetAwaiter().GetResult()
   $size=[int64]$stream.Size;$total+=$size
   if($size -lt 24 -or $size -gt 3145728 -or $total -gt 100663296){throw 'too_large'}
   $stream.Seek(0);$reader=New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
   $loaded=Await ($reader.LoadAsync([uint32]$size)) ([uint32]);if($loaded -ne $size){throw 'unavailable'}
   $bytes=New-Object byte[] $size;$reader.ReadBytes($bytes)
   [IO.File]::WriteAllBytes((Join-Path $env:XIAOZHI_RENDER_ROOT ('page-'+($index+1)+'.png')),$bytes)
   # The system renderer applies display DPI. Report actual PNG pixels, never requested logical dimensions.
   $pixelWidth=[Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,16));$pixelHeight=[Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,20))
   if($pixelWidth -lt 16 -or $pixelHeight -lt 16 -or $pixelWidth -gt 4096 -or $pixelHeight -gt 4096){throw 'too_large'}
   $pages.Add(@{page=$index+1;width=$pixelWidth;height=$pixelHeight})
  }finally{if($reader){$reader.Dispose()};$stream.Dispose();$page.Dispose()}
 }
 $result=@{schemaVersion='xiaozhi.paged-render.v1';ok=$true;pages=@($pages.ToArray());engine=$engine;findings=@($findings.ToArray())}
}catch {
 $code=$_.Exception.Message;if($code -notin @('busy','too_large','unsupported','page_count_changed')){$code='unavailable'}
 $result.error=$code
}finally {
 if($blank){try{$blank.Close([ref]$discard)}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($blank)}
 if($document){try{$document.Close([ref]$discard)}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)}
 if($application){if($owned){try{if($application.Documents.Count -eq 0){$application.Quit([ref]$discard)}}catch{}};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application)}
 if($job){$job.Dispose()}
}
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 5 -Compress))
if(-not $result.ok){exit 1}
`;
