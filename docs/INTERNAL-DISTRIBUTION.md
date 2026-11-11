# Chomp internal Windows installation

This is an internally self-signed build, not a publicly verified publisher. The signature identifies the same signing key across builds and detects changes to signed executable files. It is not an antivirus clearance and does not establish SmartScreen reputation.

## Files to send

Send the complete internal-distribution ZIP containing:
- Chomp-1.2.1-Internal-Setup.exe
- Chomp-Internal.cer (PUBLIC certificate only)
- CERTIFICATE-THUMBPRINT.txt
- SHA256SUMS.txt
- These instructions

Never send a private signing key, PFX/P12 file, certificate-store backup, or signing credentials. This build uses a non-exportable private key that stays in the developer's Current User personal Windows certificate store. Future internal builds must be signed on that same Windows account/computer unless a new certificate is deliberately issued.

## Verify before trusting

Confirm the certificate fingerprint with the sender through a separate trusted channel, such as a known phone number or company chat. A fingerprint delivered only inside the same ZIP does not independently establish authenticity.

Expected certificate SHA-1 thumbprint (identifier, not the signing algorithm):
B7A00841A601BA11D88F36B588C9922E172D313B

Subject: CN=Chomp Internal Signing
Certificate expires: November 11, 2028. Check the certificate's actual validity dates in Windows. Signatures use SHA-256. Timestamp availability is shown in the accompanying signing report; without a trusted timestamp, builds need re-signing before certificate expiration.

Double-click Chomp-Internal.cer, select Details, and compare Thumbprint. Or run this read-only PowerShell command from the extracted ZIP folder:

    $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $PWD 'Chomp-Internal.cer'))
    $cert | Format-List Subject, Thumbprint, NotAfter, HasPrivateKey

HasPrivateKey must be False. Check the installer hash against SHA256SUMS.txt, ideally with the expected hash confirmed separately:

    Get-FileHash .\Chomp-1.2.1-Internal-Setup.exe -Algorithm SHA256

## Company-managed computers

Give the installer, public certificate, fingerprint, and hashes to IT. Ask them to deploy the certificate and authorize the application under the organization's policy. Do not change certificate trust or security settings yourself without IT authorization. IT may need publisher or file-hash rules and may need to approve updates separately. Even a locally trusted self-signed certificate may still be blocked by SmartScreen or Smart App Control.

## Personally controlled test computers

Only the device owner/administrator should decide to trust this certificate. Trusting it can authorize OTHER code signed with this same private key, not just this installer.

If you approve that trust, open the verified CER, click Install Certificate, choose Current User, then Place all certificates in the following store and select Trusted Root Certification Authorities. Confirm that the displayed fingerprint matches before accepting Windows' trust warning. Organization policies may require a different scope or additional Trusted Publishers configuration; let IT handle that.

This trust installation is a separate manual decision. Neither the app nor installer silently installs trust. Do not import the private key. Do not disable SmartScreen or Smart App Control. If Windows still blocks execution without a Run anyway option, stop and ask IT or use a publicly trusted signing/distribution route.

## Install and update

After the device owner or IT has approved the app, run the setup EXE. The setup wizard installs all supporting files and creates a Start menu shortcut. Recipients do not need to keep loose DLLs beside the downloaded installer. Uninstall through Windows Settings > Apps.

For updates, send a new installer signed by the SAME key and new hashes. Certificate trust normally only needs to be installed once, but security policy and hash-based allow rules may need updating each release. Check the new signature and hash each time.

If the signing key is suspected compromised, stop distribution, tell recipients/IT, and remove trust for this exact certificate. On personally controlled computers, certmgr.msc > Trusted Root Certification Authorities > Certificates lets the owner remove the certificate matching the exact thumbprint above. Do not remove unrelated certificates.

## macOS

This Windows certificate does not sign or notarize Mac apps. Use the separately published Mac DMG and drag the app into Applications. Apple signing and notarization are separate.
