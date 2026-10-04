param([ValidateSet('probe','render')][string]$Mode='probe',[Parameter(Mandatory=$true)][string]$OutputRoot,[string]$SourceRoot,[string]$BaseName='generated',[ValidateSet('docx','xlsx','pptx')][string[]]$Formats=@('docx','xlsx','pptx'),[switch]$EditDocxCopy)
$ErrorActionPreference='Stop'
$taskOut=[IO.Path]::GetFullPath($OutputRoot)
$taskTests=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../test-results'))
if(-not $taskOut.StartsWith($taskTests+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Output must be an owned test-results directory'}
if(-not(Test-Path -LiteralPath $taskOut)){New-Item -ItemType Directory -Path $taskOut | Out-Null}
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class WpsAcceptanceOwner { [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint processId); }
'@
$taskBefore=@(Get-Process wps,et,wpp -ErrorAction SilentlyContinue | ForEach-Object {[pscustomobject]@{id=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');hwnd=$_.MainWindowHandle.ToInt64()}})
$taskReport=[ordered]@{success=$false;mode=$Mode;before=$taskBefore;applications=@();boundary='Actual WPS COM only; no existing user instance may be altered.'}
try {
 foreach($taskKind in @(@{name='docx';prog='KWPS.Application';collection='Documents'},@{name='xlsx';prog='KET.Application';collection='Workbooks'},@{name='pptx';prog='KWPP.Application';collection='Presentations'}) | Where-Object {$Formats -contains $_.name}){
  $taskApp=$null;$taskDocument=$null;$taskOwned=$false;$taskOfficePid=0;$taskCollection=$null
  try {
   $taskActivation=[DateTime]::UtcNow
   $taskApp=New-Object -ComObject $taskKind.prog
   $taskHwnd=[IntPtr]([int64]$taskApp.Hwnd)
   [uint32]$taskHwndPid=0;[void][WpsAcceptanceOwner]::GetWindowThreadProcessId($taskHwnd,[ref]$taskHwndPid)
   $taskOfficePid=[int]$taskHwndPid
   $taskIdentity='hwnd'
   if($taskOfficePid -le 0){
    $taskSwitch=@{docx='wps';xlsx='et';pptx='wpp'}[$taskKind.name]
    $taskNewServers=@(Get-CimInstance Win32_Process -Filter "Name='wps.exe'" | Where-Object {$_.CommandLine -match ('/prometheus /'+$taskSwitch+' /Automation -Embedding') -and $_.CreationDate.ToUniversalTime() -ge $taskActivation -and -not($taskBefore.id -contains $_.ProcessId)})
    if($taskNewServers.Count -ne 1){throw 'No unique new registered Automation server'}
    $taskOfficePid=[int]$taskNewServers[0].ProcessId;$taskIdentity='registered-automation-start-time'
   }
   if($taskBefore.id -contains $taskOfficePid){throw 'COM returned an existing user process'}
   $taskOfficeProcess=Get-Process -Id $taskOfficePid
   $taskImages=@('wps.exe',@{docx='wps.exe';xlsx='et.exe';pptx='wpp.exe'}[$taskKind.name])
   if($taskOfficeProcess.Path -notlike '*\WPS Office\*\office6\*' -or $taskImages -notcontains [IO.Path]::GetFileName($taskOfficeProcess.Path)){throw ('Unexpected COM process image: '+$taskOfficeProcess.Path)}
   $taskCollection=$taskApp.($taskKind.collection)
   if([int]$taskCollection.Count -ne 0){throw 'New COM application is not empty; refusing ownership'}
   $taskOwned=$true
   $taskEntry=[ordered]@{kind=$taskKind.name;pid=$taskOfficePid;hwnd=$taskHwnd.ToInt64();identity=$taskIdentity;version=[string]$taskApp.Version;initialCount=0;owned=$true}
   $taskReport.applications+=,$taskEntry
   $taskReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskOut 'phase.json') -Encoding UTF8
   if($Mode -eq 'render'){
    if($BaseName -match '[\\/:<>"|?*]' -or $BaseName -eq '..'){throw 'Invalid input base name'}
    $taskSource=[IO.Path]::GetFullPath((Join-Path $SourceRoot ($BaseName+'.'+$taskKind.name)))
    $taskSourcePrefix=[IO.Path]::GetFullPath($SourceRoot)+[IO.Path]::DirectorySeparatorChar
    $taskAllowedSources=@([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../test-results')),[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../../docs/design/codex-2026-10-03/p07-office-artifact-user-flow/generated')))
    if(-not @($taskAllowedSources | Where-Object {$taskSourcePrefix.StartsWith($_+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)}).Count){throw 'Only owned test fixtures/public synthetic archive may be opened'}
    if(-not $taskSource.StartsWith($taskSourcePrefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Source escape'}
    $taskHash=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
    if($taskKind.name -ne 'pptx'){$taskApp.Visible=$false}
    $taskPdf=Join-Path $taskOut ($taskKind.name+'-wps.pdf')
    if(Test-Path -LiteralPath $taskPdf){throw 'QA output already exists'}
    if($taskKind.name -eq 'docx'){
     $taskDocument=$taskCollection.Open($taskSource,$false,$true,$false)
     $taskEntry.text=[string]$taskDocument.Content.Text
     $taskEntry.tables=[int]$taskDocument.Tables.Count
     $taskEntry.pages=[int]$taskDocument.ComputeStatistics(2)
     $taskDocument.ExportAsFixedFormat($taskPdf,17)
     if($EditDocxCopy){
      if($taskDocument.Tables.Count -lt 1){throw 'Editable Word acceptance requires a real table'}
      $taskDocument.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument);$taskDocument=$null
      $taskEditCopy=Join-Path $taskOut 'editable-copy.docx'
      if(Test-Path -LiteralPath $taskEditCopy){throw 'QA edit copy already exists'}
      Copy-Item -LiteralPath $taskSource -Destination $taskEditCopy
      $taskDocument=$taskCollection.Open($taskEditCopy,$false,$false,$false)
      if($taskDocument.ReadOnly){throw 'Owned Word copy is not editable'}
      $taskEditMarker='WPS-EDIT-'+[Guid]::NewGuid().ToString('N')
      $taskEditTable=$taskDocument.Tables.Item(1)
      $taskEditTable.Cell(2,[int]$taskEditTable.Columns.Count).Range.Text=$taskEditMarker
      $taskDocument.Save()
      $taskDocument.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument);$taskDocument=$null
      $taskDocument=$taskCollection.Open($taskEditCopy,$false,$true,$false)
      $taskEntry.editCopy=[ordered]@{path=$taskEditCopy;marker=$taskEditMarker;reopenedText=[string]$taskDocument.Content.Text;sha256=(Get-FileHash -LiteralPath $taskEditCopy -Algorithm SHA256).Hash}
      if(-not $taskEntry.editCopy.reopenedText.Contains($taskEditMarker)){throw 'Actual WPS edit was not saved across reopen'}
     }
    }elseif($taskKind.name -eq 'xlsx'){
     $taskDocument=$taskCollection.Open($taskSource,0,$true)
     $taskEntry.sheets=[int]$taskDocument.Worksheets.Count
     $taskEntry.values=@()
     for($taskSheetIndex=1;$taskSheetIndex -le $taskDocument.Worksheets.Count;$taskSheetIndex++){
      $taskSheet=$taskDocument.Worksheets.Item($taskSheetIndex);$taskEntry.values+=,@($taskSheet.UsedRange.Value2)
     }
     $taskDocument.ExportAsFixedFormat(0,$taskPdf)
    }else{
     $taskDocument=$taskCollection.Open($taskSource,-1,0,0)
     $taskEntry.slides=[int]$taskDocument.Slides.Count
     $taskEntry.text=@();$taskEntry.tables=@()
     for($taskSlideIndex=1;$taskSlideIndex -le $taskDocument.Slides.Count;$taskSlideIndex++){
      $taskSlide=$taskDocument.Slides.Item($taskSlideIndex)
      foreach($taskShape in $taskSlide.Shapes){
       if($taskShape.HasTextFrame){$taskEntry.text+=[string]$taskShape.TextFrame.TextRange.Text}
       if($taskShape.HasTable){
        $taskNativeTable=$taskShape.Table;$taskNativeRows=@()
        for($taskR=1;$taskR -le $taskNativeTable.Rows.Count;$taskR++){
         $taskNativeCells=@();for($taskC=1;$taskC -le $taskNativeTable.Columns.Count;$taskC++){$taskNativeCells+=[string]$taskNativeTable.Cell($taskR,$taskC).Shape.TextFrame.TextRange.Text}
         $taskNativeRows+=,$taskNativeCells
        }
        $taskEntry.tables+=,[pscustomobject]@{slide=$taskSlideIndex;columns=[int]$taskNativeTable.Columns.Count;rows=$taskNativeRows}
       }
      }
     }
     $taskDocument.SaveAs($taskPdf,32)
    }
    $taskEntry.inputUnchanged=((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash -eq $taskHash)
    if(-not $taskEntry.inputUnchanged -or -not(Test-Path -LiteralPath $taskPdf)){throw 'Original changed or native render missing'}
    $taskEntry.renderBytes=(Get-Item -LiteralPath $taskPdf).Length
   }
  } finally {
   if($taskDocument){if($taskKind.name -eq 'docx'){$taskDocument.Close(0)}elseif($taskKind.name -eq 'xlsx'){$taskDocument.Close($false)}else{$taskDocument.Close()};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument)}
   if($taskApp){
    if($taskOwned -and [int]$taskCollection.Count -eq 0 -and -not($taskBefore.id -contains $taskOfficePid)){$taskApp.Quit()}
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskApp)
   }
  }
 }
 foreach($taskOriginal in $taskBefore){$taskNow=Get-Process -Id $taskOriginal.id;if($taskNow.StartTime.ToUniversalTime().ToString('o') -ne $taskOriginal.start -or $taskNow.MainWindowHandle.ToInt64() -ne $taskOriginal.hwnd){throw 'Original user instance identity/window changed'}}
 $taskReport.success=$true
}catch{$taskReport.error=$_.Exception.Message;[Console]::Error.WriteLine($_.Exception.Message);$taskExit=1}
finally{$taskReport | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $taskOut 'report.json') -Encoding UTF8}
if($taskExit){exit $taskExit}
