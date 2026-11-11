$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Signing test only runs on a disposable CI runner.' }
$taskTemp = Join-Path $env:RUNNER_TEMP 'Chomp-signing-test'
New-Item -ItemType Directory -Path $taskTemp -Force | Out-Null
Copy-Item -LiteralPath 'release\win-unpacked\Chomp.exe' -Destination (Join-Path $taskTemp 'Chomp.exe')
$taskRootsBefore = @(Get-ChildItem Cert:\CurrentUser\Root | ForEach-Object Thumbprint)
for ($taskAttempt = 0; $taskAttempt -lt 2; $taskAttempt++) {
  & powershell.exe -NoProfile -File windows-signing/Sign-Locally.ps1 -Path (Join-Path $taskTemp 'Chomp.exe') -Approve
  if ($LASTEXITCODE -ne 0) { throw 'Local signing command failed.' }
  $taskSignature = Get-AuthenticodeSignature -LiteralPath (Join-Path $taskTemp 'Chomp.exe')
  if (-not $taskSignature.SignerCertificate -or $taskSignature.Status -in @('NotSigned','HashMismatch')) { throw 'Signature was not applied.' }
  if ($taskAttempt -eq 0) { $taskThumbprint = $taskSignature.SignerCertificate.Thumbprint }
  elseif ($taskSignature.SignerCertificate.Thumbprint -ne $taskThumbprint) { throw 'The signing key was not reused.' }
}
$taskRootsAfter = @(Get-ChildItem Cert:\CurrentUser\Root | ForEach-Object Thumbprint)
if (@(Compare-Object $taskRootsBefore $taskRootsAfter).Count) { throw 'Signing unexpectedly changed trusted roots.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($taskFile in Get-ChildItem release -Filter 'Chomp-*-win-x64*.zip') {
  $taskZip = [IO.Compression.ZipFile]::OpenRead($taskFile.FullName)
  try {
    foreach ($taskName in @('Sign on this PC.cmd','Sign installed Chomp.cmd','Sign-Locally.ps1','READ-ME-FIRST.txt')) {
      if (-not $taskZip.GetEntry($taskName)) { throw "Missing $taskName in $($taskFile.Name)" }
    }
  } finally { $taskZip.Dispose() }
}
Write-Host 'PASS: Local signing, key reuse, unchanged trust store, and signing helpers in every Windows ZIP.'
