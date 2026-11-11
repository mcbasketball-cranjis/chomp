; This is a separate, hidden install section so migration happens only after
; the user starts installation, and before any new Chomp files are copied.
!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Section "-Remove installed GatorSqoosh"
      InitPluginsDir
      ReadRegStr $R6 HKCU "Software\0b73e930-3d4a-5785-aafb-d43b1bb2f976" "InstallLocation"
      ${If} $R6 != ""
        ${If} ${FileExists} "$R6\Uninstall GatorSqoosh.exe"
          DetailPrint "Removing the previous GatorSqoosh installation..."
          StrCpy $R7 1
          ClearErrors
          CopyFiles /SILENT "$R6\Uninstall GatorSqoosh.exe" "$PLUGINSDIR\gatorsqoosh-uninstall.exe"
          ${IfNot} ${Errors}
            ExecWait '"$PLUGINSDIR\gatorsqoosh-uninstall.exe" /S /KEEP_APP_DATA /currentuser --updated _?=$R6' $R7
          ${EndIf}
          ${If} ${Errors}
          ${OrIf} $R7 != 0
            MessageBox MB_OK|MB_ICONSTOP "Could not remove the previous GatorSqoosh installation. Close GatorSqoosh and try again, or uninstall it from Windows Settings."
            SetErrorLevel 2
            Quit
          ${EndIf}
          Delete "$R6\Uninstall GatorSqoosh.exe"
          ; Remove only the now-empty directory; never delete user files here.
          RMDir "$R6"
        ${Else}
          MessageBox MB_OK|MB_ICONSTOP "The previous GatorSqoosh installation is missing its uninstaller. Repair or uninstall it from Windows Settings, then run Chomp setup again."
          SetErrorLevel 2
          Quit
        ${EndIf}
      ${EndIf}
    SectionEnd
  !endif
!macroend
