$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) { throw 'Installer lifecycle test only runs on a disposable GitHub Actions runner.' }
$taskTempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
$taskInstall = [IO.Path]::GetFullPath((Join-Path $taskTempRoot 'GatorSqoosh-install-test'))
if (-not $taskInstall.StartsWith($taskTempRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Installation path must stay within runner temp.' }
$taskInstaller = Get-ChildItem -LiteralPath release -Filter '*-Setup.exe' | Select-Object -First 1
if (-not $taskInstaller) { throw 'Installer not found.' }
$taskProcess = Start-Process -FilePath $taskInstaller.FullName -ArgumentList @('/S', "/D=$taskInstall") -Wait -PassThru -WindowStyle Hidden
if ($taskProcess.ExitCode -ne 0) { throw "Installer failed: $($taskProcess.ExitCode)" }
$taskExe = Join-Path $taskInstall 'GatorSqoosh.exe'
if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Installed executable is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskInstall 'resources\app.asar'))) { throw 'Installed application resources are missing.' }
try {
  $env:GATORSQOOSH_TEST_EXECUTABLE = $taskExe
  node scripts/verify-package.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Installed application tests failed.' }
  $taskShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\GatorSqoosh.lnk'
  if (-not (Test-Path -LiteralPath $taskShortcut)) { throw 'Start menu shortcut was not created.' }
} finally {
  Remove-Item Env:GATORSQOOSH_TEST_EXECUTABLE -ErrorAction SilentlyContinue
  $taskUninstaller = Join-Path $taskInstall 'Uninstall GatorSqoosh.exe'
  if (Test-Path -LiteralPath $taskUninstaller) { Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -Wait -WindowStyle Hidden }
}
for ($taskRetry = 0; $taskRetry -lt 30 -and (Test-Path -LiteralPath $taskExe); $taskRetry++) { Start-Sleep -Seconds 1 }
if (Test-Path -LiteralPath $taskExe) { throw 'Uninstaller did not remove the installed executable.' }
Write-Host 'PASS: Silent install, installed app exports/themes/folders/size limits, Start menu shortcut, and uninstall.'
