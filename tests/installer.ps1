$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) { throw 'Installer lifecycle test only runs on a disposable GitHub Actions runner.' }
$taskTempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
$taskInstall = [IO.Path]::GetFullPath((Join-Path $taskTempRoot 'Chomp-install-test'))
if (-not $taskInstall.StartsWith($taskTempRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Installation path must stay within runner temp.' }
$taskInstaller = Get-ChildItem -LiteralPath release -Filter '*-Setup.exe' | Select-Object -First 1
if (-not $taskInstaller) { throw 'Installer not found.' }
# Install both previous identities to test migration when they coexist.
$taskLegacyInstall = Join-Path $taskTempRoot 'GatorSqoosh-upgrade-test'
$taskPriorInstaller = (Get-ChildItem previous-release -Filter '*-Setup.exe' | Select-Object -First 1).FullName
$taskLegacyInstaller = (Get-ChildItem legacy-release -Filter '*-Setup.exe' | Select-Object -First 1).FullName
foreach ($taskFixture in @(@($taskPriorInstaller, $taskInstall), @($taskLegacyInstaller, $taskLegacyInstall))) {
  $taskResult = Start-Process -FilePath $taskFixture[0] -ArgumentList @('/S', "/D=$($taskFixture[1])") -Wait -PassThru -WindowStyle Hidden
  if ($taskResult.ExitCode -ne 0) { throw "Fixture install failed: $($taskFixture[0])" }
}
$taskLegacyExe = Join-Path $taskLegacyInstall 'GatorSqoosh.exe'
if (-not (Test-Path -LiteralPath $taskLegacyExe)) { throw 'Legacy fixture did not install GatorSqoosh.' }
$taskLegacyData = Join-Path $env:APPDATA 'gatorsqoosh'
New-Item -ItemType Directory -Path $taskLegacyData -Force | Out-Null
$taskLegacyMarker = Join-Path $taskLegacyData 'upgrade-preservation-test.txt'
Set-Content -LiteralPath $taskLegacyMarker -Value 'Keep legacy user data'
$taskStaleFile = Join-Path $taskInstall 'stale-old-version.txt'
Set-Content -LiteralPath $taskStaleFile -Value 'Old app file'
$taskProcess = Start-Process -FilePath $taskInstaller.FullName -ArgumentList @('/S', "/D=$taskInstall") -Wait -PassThru -WindowStyle Hidden
if ($taskProcess.ExitCode -ne 0) { throw "Installer failed: $($taskProcess.ExitCode)" }
$taskExe = Join-Path $taskInstall 'Chomp.exe'
if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Installed executable is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskInstall 'resources\app.asar'))) { throw 'Installed application resources are missing.' }
if (Test-Path -LiteralPath $taskLegacyExe) { throw 'Upgrade left the old GatorSqoosh executable installed.' }
if (Test-Path -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\0b73e930-3d4a-5785-aafb-d43b1bb2f976') { throw 'Upgrade left the old uninstall registration.' }
if (Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\GatorSqoosh.lnk')) { throw 'Upgrade left the old shortcut.' }
if (-not (Test-Path -LiteralPath $taskLegacyMarker)) { throw 'Upgrade removed legacy user data.' }
if (Test-Path -LiteralPath $taskStaleFile) { throw 'Upgrade left stale files from the old Chomp version.' }
$taskRepeat = Start-Process -FilePath $taskInstaller.FullName -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
if ($taskRepeat.ExitCode -ne 0) { throw 'Repeated upgrade failed.' }
try {
  $env:CHOMP_TEST_EXECUTABLE = $taskExe
  node scripts/verify-package.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Installed application tests failed.' }
  $taskShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Chomp.lnk'
  if (-not (Test-Path -LiteralPath $taskShortcut)) { throw 'Start menu shortcut was not created.' }
} finally {
  Remove-Item Env:CHOMP_TEST_EXECUTABLE -ErrorAction SilentlyContinue
  $taskUninstaller = Join-Path $taskInstall 'Uninstall Chomp.exe'
  if (Test-Path -LiteralPath $taskUninstaller) { Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -Wait -WindowStyle Hidden }
}
for ($taskRetry = 0; $taskRetry -lt 30 -and (Test-Path -LiteralPath $taskExe); $taskRetry++) { Start-Sleep -Seconds 1 }
if (Test-Path -LiteralPath $taskExe) { throw 'Uninstaller did not remove the installed executable.' }
Write-Host 'PASS: GatorSqoosh migration, Chomp upgrade, repeat install, data preservation, app checks, shortcuts, and uninstall.'
