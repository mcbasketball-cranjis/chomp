param([switch]$CreateCertificate)
$ErrorActionPreference = 'Stop'
$taskSubject = 'CN=Chomp Internal Signing'
$taskCert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $taskSubject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) } | Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $taskCert) {
  if (-not $CreateCertificate) { throw 'No internal signing certificate exists. Run with -CreateCertificate to create a non-exportable signing key in your personal certificate store.' }
  $taskCert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $taskSubject -FriendlyName 'Chomp internal code signing' -CertStoreLocation Cert:\CurrentUser\My -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(2)
}
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $taskRoot
$taskOutput = Join-Path $taskRoot 'internal-release'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
Export-Certificate -Cert $taskCert -FilePath (Join-Path $taskOutput 'Chomp-Internal.cer') | Out-Null
$taskCert.Thumbprint | Set-Content -LiteralPath (Join-Path $taskOutput 'CERTIFICATE-THUMBPRINT.txt')
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
pnpm exec electron-builder --win nsis --publish never --config.directories.output=internal-release --config.win.signtoolOptions.certificateSha1=$($taskCert.Thumbprint) --config.forceCodeSigning=true '--config.nsis.artifactName=Chomp-${version}-Internal-Setup.${ext}'
if ($LASTEXITCODE -ne 0) { throw 'Signed packaging failed.' }
foreach ($taskFile in @((Join-Path $taskOutput 'win-unpacked\Chomp.exe')) + @(Get-ChildItem -LiteralPath $taskOutput -Filter '*Setup.exe' | ForEach-Object FullName)) {
  $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskFile
  if ($taskSignature.SignerCertificate.Thumbprint -ne $taskCert.Thumbprint -or $taskSignature.Status -eq 'HashMismatch' -or $taskSignature.Status -eq 'NotSigned') { throw "Signature verification failed: $taskFile" }
  Write-Host "Signed $taskFile : $($taskSignature.Status) (local trust is not installed automatically)."
}
Write-Host "Public certificate thumbprint: $($taskCert.Thumbprint)"
Write-Host 'The private key is non-exportable and remains in CurrentUser\My. It was not added to any trust store.'

