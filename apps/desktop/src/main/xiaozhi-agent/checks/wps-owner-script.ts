/** Shared WPS Automation activation; only a new, empty, identifiable server joins the owned Job. */
export const WPS_OWNER_SCRIPT=String.raw`
 $beforeWps=@(Get-Process wps,wpp,et -ErrorAction SilentlyContinue | ForEach-Object {$_.Id})
 $start=[DateTime]::UtcNow
 $application=New-Object -ComObject $wpsProg
 [uint32]$officeId=0
 try{[void][XiaozhiRenderJob]::GetWindowThreadProcessId([IntPtr]([int64]$application.Hwnd),[ref]$officeId)}catch{}
 $identity='hwnd'
 if($officeId -eq 0){
  $servers=@(Get-CimInstance Win32_Process -Filter "Name='wps.exe'" | Where-Object {
   $_.CommandLine -match ('/prometheus /'+$wpsSwitch+' /Automation -Embedding') -and $_.CreationDate.ToUniversalTime() -ge $start.AddSeconds(-1) -and $beforeWps -notcontains $_.ProcessId
  })
  if($servers.Count -ne 1){throw 'busy'}
  $officeId=[uint32]$servers[0].ProcessId;$identity='registered-automation-start-time'
 }
 $server=Get-Process -Id $officeId
 if($beforeWps -contains [int]$officeId -or $server.StartTime.ToUniversalTime() -lt $start.AddSeconds(-1) -or $server.Path -notlike '*\WPS Office\*\office6\*' -or @('wps.exe',($wpsSwitch+'.exe')) -notcontains [IO.Path]::GetFileName($server.Path) -or [int]$application.($wpsCollection).Count -ne 0){throw 'busy'}
 $job=New-Object XiaozhiRenderJob($server.Handle);$owned=$true
 [IO.File]::WriteAllText((Join-Path $env:XIAOZHI_RENDER_ROOT 'owned.json'),(@{pid=[int]$officeId;start=$server.StartTime.ToUniversalTime().ToString('o');identity=$identity;engine=$wpsProg} | ConvertTo-Json -Compress))
`;
