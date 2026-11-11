$ErrorActionPreference = 'Stop'
$taskReport = [ordered]@{ scanner = 'Microsoft Defender Antivirus'; status = 'unavailable'; scannedAt = [DateTime]::UtcNow.ToString('o'); reason = ''; files = @() }
Get-ChildItem -LiteralPath release -File | Where-Object Extension -In '.exe','.zip' | ForEach-Object {
  $taskReport.files += @{ name = $_.Name; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash; signature = (Get-AuthenticodeSignature -LiteralPath $_.FullName).Status.ToString() }
}
try {
  $taskStatus = Get-MpComputerStatus
  if (-not $taskStatus.AMServiceEnabled -or -not $taskStatus.AntivirusEnabled) { throw 'Defender Antivirus is not enabled on this hosted runner.' }
  $taskScanner = Get-ChildItem -LiteralPath "$env:ProgramData\Microsoft\Windows Defender\Platform" -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'MpCmdRun.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $taskScanner) { throw 'Defender command-line scanner is unavailable.' }
  $taskPath = (Resolve-Path release).Path
  & $taskScanner -Scan -ScanType 3 -File $taskPath -DisableRemediation | Tee-Object -FilePath release/Defender-output.txt
  if ($LASTEXITCODE -ne 0) { $taskReport.status = 'scan_failed_or_detected'; $taskReport.reason = "Scanner exit code: $LASTEXITCODE" } else { $taskReport.status = 'no_threats_detected'; $taskReport.reason = 'Custom scan completed with no detections. This does not establish SmartScreen reputation.' }
} catch { $taskReport.reason = $_.Exception.Message }
$taskReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath release/Defender-scan.json
if ($taskReport.status -eq 'scan_failed_or_detected') { throw 'Defender scan failed or detected a threat. Release is blocked; inspect Defender-output.txt.' }
Write-Host "Defender scan status: $($taskReport.status). $($taskReport.reason)"
