# Chomp 2.1.0

## Changes

- **Software Update** in the sidebar. Checks published GitHub Releases on launch and every six hours while Chomp is open.
- Windows NSIS installs: download an update inside Chomp and apply it when you select **Restart & install**. No restart during image processing.
- macOS and Windows portable builds: version checks and a direct installer download. In-app replacement on macOS remains disabled until Developer ID signing and notarization are configured.
- Streamlined interface: shorter labels, no taglines, no redundant helper copy. Destructive operations retain warnings.
- SHA-512 metadata (`latest.yml`) for the Windows update feed, published alongside the matching NSIS installer.

**One-time upgrade:** Chomp 2.0.0 does not contain an updater. Install 2.1.0 normally once. Future Windows NSIS releases can update through Chomp.

## Downloads

[Chomp 2.1.0 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.1.0) after publication.

- Apple Silicon: `Chomp-2.1.0-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.1.0-mac-x64.dmg` or ZIP
- Windows: `Chomp-2.1.0-win-x64-Setup.exe` and portable variants

## macOS signing

Mac packages remain ad-hoc signed and are **not** Apple Developer ID signed or notarized. Gatekeeper may still require approval. The updater only checks and opens the verified published download on macOS; it does not silently replace your app. Signed and notarized automatic Mac updates can be added when developer credentials become available.

## Update security and compatibility

Windows updater metadata includes the installer SHA-512 checksum. Version checks use published GitHub Releases only; draft/prerelease versions are excluded. Windows publisher signature enforcement requires a trusted code-signing certificate, which is not yet configured. Portable Windows builds are excluded from in-place NSIS updates.

All image processing and SVG conversion features are unchanged. Existing data and app preferences remain in place during an installer upgrade.
