/** Fixed local adapter. Request values are JSON/env data, never PowerShell source. */
export const POWERPOINT_RENDER_SCRIPT=String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$application=$null;$presentation=$null;$job=$null;$owned=$false
$result=@{schemaVersion='xiaozhi.powerpoint-render.v1';ok=$false;error='unavailable'}
try {
 if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'busy'}
 Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.ComponentModel;
public sealed class XiaozhiRenderJob:IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct Basic {public long PerProcess,PerJob;public uint Flags;public UIntPtr Min,Max;public uint Active;public UIntPtr Affinity;public uint Priority,Scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct Io {public ulong R,W,O,RB,WB,OB;}
 [StructLayout(LayoutKind.Sequential)]struct Extended {public Basic Basic;public Io Io;public UIntPtr Process,Job,PeakProcess,PeakJob;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
 IntPtr handle;
 public XiaozhiRenderJob(IntPtr process){handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception();var value=new Extended();value.Basic.Flags=0x2000;var size=Marshal.SizeOf(value);var ptr=Marshal.AllocHGlobal(size);try{Marshal.StructureToPtr(value,ptr,false);if(!SetInformationJobObject(handle,9,ptr,(uint)size)||!AssignProcessToJobObject(handle,process)){Dispose();throw new Win32Exception();}}finally{Marshal.FreeHGlobal(ptr);}}
 public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
}
'@
 $request=Get-Content -Raw -LiteralPath (Join-Path $env:XIAOZHI_RENDER_ROOT 'request.json') | ConvertFrom-Json
 $start=[DateTime]::UtcNow
 $application=New-Object -ComObject PowerPoint.Application
 [uint32]$officeId=0;[void][XiaozhiRenderJob]::GetWindowThreadProcessId([IntPtr]([int64]$application.HWND),[ref]$officeId)
 $server=Get-Process -Id $officeId
 if($server.ProcessName -ne 'POWERPNT' -or $server.StartTime.ToUniversalTime() -lt $start.AddSeconds(-1) -or $application.Presentations.Count -ne 0){throw 'busy'}
 $owned=$true;$job=New-Object XiaozhiRenderJob($server.Handle)
 [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_RENDER_ROOT 'owned.json'),(@{pid=[int]$officeId;start=$server.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress))
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
 $shapeCount=0
 for($index=1;$index -le $pageCount;$index++){
  $slide=$presentation.Slides.Item($index)
  try {
   foreach($shape in $slide.Shapes){
    $shapeCount++;if($shapeCount -gt 8192){throw 'too_large'}
    try {
     if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1){
      $range=$shape.TextFrame.TextRange
      try {
       if(([double]$range.BoundTop -lt -1 -or [double]$range.BoundLeft -lt -1 -or [double]$range.BoundTop+[double]$range.BoundHeight -gt [double]$presentation.PageSetup.SlideHeight+1 -or [double]$range.BoundLeft+[double]$range.BoundWidth -gt [double]$presentation.PageSetup.SlideWidth+1) -and $findings.Count -lt 128){$findings.Add(@{code='rendered_text_outside';page=$index})}
       if([double]$shape.Rotation -eq 0 -and [double]$range.BoundHeight -gt [double]$shape.Height+2 -and $findings.Count -lt 128){$findings.Add(@{code='rendered_text_overflow';page=$index})}
      }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)}
     }
    }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shape)}
   }
   $output=Join-Path $env:XIAOZHI_RENDER_ROOT ('page-'+$index+'.png')
   $slide.Export($output,'PNG',$width,$height)
   if((Get-Item -LiteralPath $output).Length -gt 3145728){throw 'too_large'}
  }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($slide)}
 }
 $result=@{schemaVersion='xiaozhi.powerpoint-render.v1';ok=$true;pages=$pageCount;width=$width;height=$height;version=[string]$application.Version;findings=@($findings.ToArray())}
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
