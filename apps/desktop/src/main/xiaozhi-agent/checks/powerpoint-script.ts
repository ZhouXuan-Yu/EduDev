import {OFFICE_JOB_SOURCE} from './native-office-job';
import {WPS_OWNER_SCRIPT} from './wps-owner-script';
import {GLYPH_CHECK_SCRIPT} from './glyph-script';
/** Fixed local adapter. Request values are JSON/env data, never PowerShell source. */
export const POWERPOINT_RENDER_SCRIPT=String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$application=$null;$presentation=$null;$job=$null;$owned=$false
$result=@{schemaVersion='xiaozhi.powerpoint-render.v1';ok=$false;error='unavailable'}
${GLYPH_CHECK_SCRIPT}
try {
 Add-Type -TypeDefinition @'
${OFFICE_JOB_SOURCE}
'@
 $request=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $env:XIAOZHI_RENDER_ROOT 'request.json') | ConvertFrom-Json
 $useWps=$request.officeEngine -eq 'wps' -or ($request.officeEngine -ne 'microsoft' -and -not [type]::GetTypeFromProgID('PowerPoint.Application'))
 $engineName='PowerPoint'
 if($useWps){
  $wpsProg='KWPP.Application';$wpsSwitch='wpp';$wpsCollection='Presentations'
${WPS_OWNER_SCRIPT}
  $engineName='WPS Presentation'
 }else{
 if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'busy'}
 $start=[DateTime]::UtcNow
 $application=New-Object -ComObject PowerPoint.Application
 [uint32]$officeId=0;[void][XiaozhiRenderJob]::GetWindowThreadProcessId([IntPtr]([int64]$application.HWND),[ref]$officeId)
 $server=Get-Process -Id $officeId
 if($server.ProcessName -ne 'POWERPNT' -or $server.StartTime.ToUniversalTime() -lt $start.AddSeconds(-1) -or $application.Presentations.Count -ne 0){throw 'busy'}
 $owned=$true;$job=New-Object XiaozhiRenderJob($server.Handle)
 [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_RENDER_ROOT 'owned.json'),(@{pid=[int]$officeId;start=$server.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress))
 }
 $application.AutomationSecurity=3;$application.DisplayAlerts=1
 $presentation=$application.Presentations.Open((Join-Path $env:XIAOZHI_RENDER_ROOT 'input.pptx'),-1,0,0)
 $pageCount=[int]$presentation.Slides.Count
 if($pageCount -ne [int]$request.pages -or $pageCount -lt 1 -or $pageCount -gt 64){throw 'page_count_changed'}
 $width=1600;$height=[int][Math]::Round($width*[double]$presentation.PageSetup.SlideHeight/[double]$presentation.PageSetup.SlideWidth)
 if($height -gt 1600){$height=1600;$width=[int][Math]::Round($height*[double]$presentation.PageSetup.SlideWidth/[double]$presentation.PageSetup.SlideHeight)}
 if($width -lt 16 -or $height -lt 16){throw 'unsupported'}
 $findings=New-Object 'Collections.Generic.List[object]'
 $fontSet=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
 Add-Type -AssemblyName System.Drawing
 $collection=New-Object Drawing.Text.InstalledFontCollection
 foreach($family in $collection.Families){[void]$fontSet.Add($family.Name);foreach($language in @(1033,2052)){try{[void]$fontSet.Add($family.GetName($language))}catch{}}}
 foreach($font in @($request.fonts)){if($font -and -not $font.StartsWith('+') -and -not $fontSet.Contains($font)){if($findings.Count -lt 128){$findings.Add(@{code='font_missing';font=$font;page=0})}}}
 $collection.Dispose()
 $shapeCount=0;$renderBytes=0
 for($index=1;$index -le $pageCount;$index++){
  $slide=$presentation.Slides.Item($index)
  try {
   $textRects=New-Object 'Collections.Generic.List[object]';$covers=New-Object 'Collections.Generic.List[object]'
   $layoutPartial=$false;$glyphPartial=[bool]$request.embeddedFonts
   $animated=$true
   try{$animated=$slide.TimeLine.MainSequence.Count -gt 0 -or $slide.TimeLine.InteractiveSequences.Count -gt 0}catch{}
   foreach($shape in $slide.Shapes){
    $shapeCount++;if($shapeCount -gt 8192){throw 'too_large'}
    try {
     if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1){
      $range=$shape.TextFrame.TextRange
      try {
       if(([double]$range.BoundTop -lt -1 -or [double]$range.BoundLeft -lt -1 -or [double]$range.BoundTop+[double]$range.BoundHeight -gt [double]$presentation.PageSetup.SlideHeight+1 -or [double]$range.BoundLeft+[double]$range.BoundWidth -gt [double]$presentation.PageSetup.SlideWidth+1) -and $findings.Count -lt 128){$findings.Add(@{code='rendered_text_outside';page=$index})}
       if([double]$shape.Rotation -eq 0 -and [double]$range.BoundHeight -gt [double]$shape.Height+2 -and $findings.Count -lt 128){$findings.Add(@{code='rendered_text_overflow';page=$index})}
       if($shape.Visible -eq -1 -and [double]$shape.Rotation -eq 0 -and [double]$range.BoundWidth -gt 0 -and [double]$range.BoundHeight -gt 0){
        if($textRects.Count -lt 256){$textRects.Add(@{id=[int]$shape.Id;z=[int]$shape.ZOrderPosition;x=[double]$range.BoundLeft;y=[double]$range.BoundTop;w=[double]$range.BoundWidth;h=[double]$range.BoundHeight})}else{$layoutPartial=$true}
       }else{$layoutPartial=$true}
       if($shape.Visible -eq -1){
        $font=[string]$range.Font.Name
        if($request.embeddedFonts -or -not $font -or $font.StartsWith('+')){$glyphPartial=$true}
        else{
         $coverage=Find-MissingGlyphs ([string]$range.Text) $font
         if($coverage.unchecked){$glyphPartial=$true}
         foreach($point in $coverage.points){if($findings.Count -lt 126){$findings.Add(@{code='system_glyph_missing';page=$index;object=[int]$shape.Id;point=$point})}else{$glyphPartial=$true}}
        }
       }
      }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)}
     }
     if($shape.Type -eq 6 -or $shape.HasTable -eq -1){$layoutPartial=$true;$glyphPartial=$true}
     if($shape.Visible -eq -1 -and $shape.Type -eq 1 -and [double]$shape.Rotation -eq 0 -and $shape.AutoShapeType -eq 1){
      if($shape.Fill.Visible -eq -1 -and $shape.Fill.Type -eq 1 -and [double]$shape.Fill.Transparency -le 0.001){
       if($covers.Count -lt 256){$covers.Add(@{id=[int]$shape.Id;z=[int]$shape.ZOrderPosition;x=[double]$shape.Left;y=[double]$shape.Top;w=[double]$shape.Width;h=[double]$shape.Height})}else{$layoutPartial=$true}
      }
     }
    }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shape)}
   }
   foreach($textRect in $textRects){foreach($cover in $covers){
    if($cover.z -gt $textRect.z -and $cover.x -le $textRect.x -and $cover.y -le $textRect.y -and $cover.x+$cover.w -ge $textRect.x+$textRect.w -and $cover.y+$cover.h -ge $textRect.y+$textRect.h){
     if($animated){$layoutPartial=$true}else{if($findings.Count -lt 126){$findings.Add(@{code='rendered_text_covered';page=$index;object=$textRect.id;cover=$cover.id})}else{$layoutPartial=$true}}
     break
    }
   }}
   if(($layoutPartial -or $animated) -and $findings.Count -lt 128){$findings.Add(@{code='layer_coverage_partial';page=$index})}
   if($glyphPartial -and $findings.Count -lt 128){$findings.Add(@{code='glyph_coverage_partial';page=$index})}
   $output=Join-Path $env:XIAOZHI_RENDER_ROOT ('page-'+$index+'.png')
   $slide.Export($output,'PNG',$width,$height)
   $pageBytes=(Get-Item -LiteralPath $output).Length;$renderBytes+=$pageBytes
   if($pageBytes -gt 3145728 -or $renderBytes -gt 100663296){Remove-Item -LiteralPath $output;throw 'too_large'}
  }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($slide)}
 }
 $result=@{schemaVersion='xiaozhi.powerpoint-render.v1';ok=$true;pages=$pageCount;width=$width;height=$height;engine=$engineName;version=[string]$application.Version;findings=@($findings.ToArray())}
}catch {
 $code=$_.Exception.Message
 if($code -notin @('busy','too_large','unsupported','page_count_changed')){$code='unavailable'}
 $result.error=$code
}finally {
 if($presentation){try{$presentation.Close()}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation)}
 if($application){if($owned){try{if($application.Presentations.Count -eq 0){$application.Quit()}}catch{}};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application)}
 if($job){$job.Dispose()}
}
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 5 -Compress))
if(-not $result.ok){exit 1}
`;
