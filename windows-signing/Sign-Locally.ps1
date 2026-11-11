param([string]$Path, [switch]$Installed, [switch]$Approve)
$ErrorActionPreference = 'Stop'
try {
  if ($Path -and $Installed) { throw 'Choose either -Path or -Installed.' }
  $taskTargets = @()
  if ($Installed) {
    $taskLocation = (Get-ItemProperty -LiteralPath 'HKCU:\Software\a6597703-fd25-5837-89c4-b22ee0e825fa' -ErrorAction Stop).InstallLocation
    if (-not $taskLocation) { throw 'Chomp is not installed for this Windows user.' }
    $taskTargets = @(Join-Path $taskLocation 'Chomp.exe')
  } elseif ($Path) {
    $taskTargets = @((Resolve-Path -LiteralPath $Path).Path)
  } else {
    $taskTargets = @(Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter 'Chomp*.exe' | Where-Object { $_.Name -eq 'Chomp.exe' -or $_.Name -match '^Chomp-\d+\.\d+\.\d+-win-x64-(Setup|Portable)\.exe$' } | ForEach-Object FullName)
  }
  if (-not $taskTargets.Count) { throw 'Extract the entire ZIP first, or use -Path with the Chomp EXE you want to sign.' }
  foreach ($taskFile in $taskTargets) {
    if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf) -or [IO.Path]::GetExtension($taskFile) -ne '.exe') { throw "Not an executable: $taskFile" }
    Write-Host "File: $taskFile"
    Write-Host "Original SHA256: $((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash)"
  }
  Write-Host 'This signs your copy using a non-exportable key in your Windows user certificate store.'
  Write-Host 'It does not install trust, verify the original publisher, or change security policy.'
  if (-not $Approve) {
    $taskAnswer = Read-Host 'Type SIGN to continue'
    if ($taskAnswer -cne 'SIGN') { Write-Host 'Canceled. Nothing changed.'; exit 0 }
  }
  $taskSubjects = @('CN=Chomp Local Test Signing', 'CN=GatorSqoosh Local Test Signing', 'CN=GatorSqoosh Internal Signing', 'CN=Chomp Internal Signing')
  $taskCert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -in $taskSubjects -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) } | Sort-Object NotAfter -Descending | Select-Object -First 1
  if (-not $taskCert) {
    $taskCert = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=Chomp Local Test Signing' -FriendlyName 'Chomp local test signing' -CertStoreLocation Cert:\CurrentUser\My -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(2)
  }
  $taskReport = @("Signer: $($taskCert.Subject)", "Thumbprint: $($taskCert.Thumbprint)", "Expires: $($taskCert.NotAfter.ToString('o'))")
  foreach ($taskFile in $taskTargets) {
    $taskSignature = Set-AuthenticodeSignature -LiteralPath $taskFile -Certificate $taskCert -HashAlgorithm SHA256
    if ($taskSignature.SignerCertificate.Thumbprint -ne $taskCert.Thumbprint -or $taskSignature.Status -in @('HashMismatch', 'NotSigned', 'NotSupportedFileFormat', 'Incompatible')) { throw "Signing failed: $taskFile ($($taskSignature.Status))" }
    $taskReport += @("File: $taskFile", "Signed SHA256: $((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash)", "Signature: $($taskSignature.Status)")
    Write-Host "Signed: $taskFile ($($taskSignature.Status))"
  }
  Export-Certificate -Cert $taskCert -FilePath (Join-Path $PSScriptRoot 'THIS-PC-PUBLIC-CERTIFICATE.cer') | Out-Null
  $taskReport += 'No trust was installed. No private key was exported. No timestamp was added.'
  $taskReport | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'LOCAL-SIGNING-RESULT.txt')
  Write-Host 'Done. A new download/update needs signing again. SmartScreen or company policy can still block a self-signed file.'
  exit 0
} catch { Write-Host "Could not sign: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
