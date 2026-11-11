$ErrorActionPreference = 'Stop'
$taskRelease = (Resolve-Path -LiteralPath release).Path
$taskKit = (Resolve-Path -LiteralPath windows-signing).Path
$taskHelpers = @(Get-ChildItem -LiteralPath $taskKit -File)
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Add-SigningKit([string]$taskArchive) {
  $taskZip = [IO.Compression.ZipFile]::Open($taskArchive, [IO.Compression.ZipArchiveMode]::Update)
  try {
    foreach ($taskHelper in $taskHelpers) {
      $taskExisting = $taskZip.GetEntry($taskHelper.Name)
      if ($taskExisting) { $taskExisting.Delete() }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip, $taskHelper.FullName, $taskHelper.Name) | Out-Null
    }
  } finally { $taskZip.Dispose() }
}
foreach ($taskExe in @(Get-ChildItem -LiteralPath $taskRelease -File -Filter 'Chomp-*-win-x64-*.exe')) {
  $taskArchive = [IO.Path]::ChangeExtension($taskExe.FullName, '.zip')
  Compress-Archive -LiteralPath $taskExe.FullName -DestinationPath $taskArchive -Force
  Add-SigningKit $taskArchive
}
foreach ($taskArchive in @(Get-ChildItem -LiteralPath $taskRelease -File -Filter 'Chomp-*-win-x64.zip')) { Add-SigningKit $taskArchive.FullName }
Compress-Archive -LiteralPath $taskHelpers.FullName -DestinationPath (Join-Path $taskRelease 'Chomp-Windows-Signing-Kit.zip') -Force
Write-Host 'Windows installer, portable EXE, and portable folder ZIPs include the local signing kit.'
