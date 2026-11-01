param(
  [Parameter(Mandatory=$true)][UInt64]$WindowHandle,
  [ValidateSet('drag','click')][string]$Action='drag',
  [double]$FractionX=0.65,
  [int]$OffsetRightDip=0,
  [int]$DeltaX=120,
  [int]$DeltaY=70
)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class CaptionPointer {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
  [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr desktop);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern bool GetUserObjectInformation(IntPtr h,int index,System.Text.StringBuilder value,int size,out int needed);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,IntPtr process);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint source,uint target,bool attach);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window,out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window,ref POINT point);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
[void][CaptionPointer]::SetThreadDpiAwarenessContext([IntPtr](-4))
$inputDesktop=[CaptionPointer]::OpenInputDesktop(0,$false,1)
if($inputDesktop -eq [IntPtr]::Zero){throw 'Interactive input desktop unavailable'}
try {
  $name=New-Object System.Text.StringBuilder 128
  $needed=0
  if(-not [CaptionPointer]::GetUserObjectInformation($inputDesktop,2,$name,256,[ref]$needed) -or $name.ToString() -ne 'Default'){throw 'Input desktop is not Default; no pointer action performed'}
} finally { [void][CaptionPointer]::CloseDesktop($inputDesktop) }
$window=[IntPtr]::new([Int64]$WindowHandle)
[void][CaptionPointer]::SetForegroundWindow($window)
Start-Sleep -Milliseconds 200
if([CaptionPointer]::GetAncestor([CaptionPointer]::GetForegroundWindow(),2) -ne $window){
  $foregroundThread=[CaptionPointer]::GetWindowThreadProcessId([CaptionPointer]::GetForegroundWindow(),[IntPtr]::Zero)
  $currentThread=[CaptionPointer]::GetCurrentThreadId()
  $attached=[CaptionPointer]::AttachThreadInput($currentThread,$foregroundThread,$true)
  try { [void][CaptionPointer]::SetForegroundWindow($window); Start-Sleep -Milliseconds 200 }
  finally { if($attached){[void][CaptionPointer]::AttachThreadInput($currentThread,$foregroundThread,$false)} }
}
if([CaptionPointer]::GetAncestor([CaptionPointer]::GetForegroundWindow(),2) -ne $window){throw "Owned test window is not foreground (actual=$([CaptionPointer]::GetForegroundWindow()), expected=$window); no pointer action performed"}
$before=New-Object CaptionPointer+RECT
$client=New-Object CaptionPointer+RECT
$origin=New-Object CaptionPointer+POINT
$cursor=New-Object CaptionPointer+POINT
[void][CaptionPointer]::GetWindowRect($window,[ref]$before)
[void][CaptionPointer]::GetClientRect($window,[ref]$client)
[void][CaptionPointer]::ClientToScreen($window,[ref]$origin)
[void][CaptionPointer]::GetCursorPos([ref]$cursor)
$scale=[CaptionPointer]::GetDpiForWindow($window)/96.0
$startX=$origin.X+[int](($client.Right-$client.Left)*$FractionX)
if($OffsetRightDip -gt 0){$startX=$origin.X+$client.Right-[int]($OffsetRightDip*$scale)}
$startY=$origin.Y+[int](18*$scale)
try {
  [void][CaptionPointer]::SetCursorPos($startX,$startY)
  [CaptionPointer]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  if($Action -eq 'drag'){
    for($step=1;$step -le 16;$step++){
      [void][CaptionPointer]::SetCursorPos(($startX+[int]($DeltaX*$scale*$step/16)),($startY+[int]($DeltaY*$scale*$step/16)))
      Start-Sleep -Milliseconds 15
    }
  }
} finally {
  [CaptionPointer]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  [void][CaptionPointer]::SetCursorPos($cursor.X,$cursor.Y)
}
Start-Sleep -Milliseconds 250
$after=New-Object CaptionPointer+RECT
[void][CaptionPointer]::GetWindowRect($window,[ref]$after)
@{desktop='Default';action=$Action;scale=$scale;start=@{x=$startX;y=$startY};before=$before;after=$after} | ConvertTo-Json -Depth 4 -Compress
