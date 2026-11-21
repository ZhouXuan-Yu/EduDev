!macro customInstall
  CreateShortCut "$SMPROGRAMS\小智 · 恢复工作区.lnk" "$appExe" "--xiaozhi-recover"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\小智 · 恢复工作区.lnk"
!macroend
