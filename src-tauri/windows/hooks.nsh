!macro NSIS_HOOK_POSTINSTALL
  ; Copy data folder using system command (recursive)
  InitPluginsDir
  nsExec::ExecToLog 'xcopy "$INSTDIR\_up_\data" "$INSTDIR\data\" /E /I /Y /Q'
  Pop $0 ; return value
  ; Optionally check if copy was successful
  ${If} $0 != "0"
    DetailPrint "Warning: Failed to copy data folder from _up_ directory"
  ${EndIf}
!macroend
