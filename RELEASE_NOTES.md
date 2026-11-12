# Chomp 2.1.2

## Mac updates without the browser

- **Chomp now downloads macOS updates inside the app** instead of opening Safari and requiring a DMG drag-and-drop each time.
- Published GitHub Release assets are selected for Intel or Apple Silicon, verified against their GitHub SHA-256 digest, extracted, and checked for a valid macOS code signature, expected bundle identifier, version, and CPU architecture.
- Once the update is prepared, choose **Restart & install**. Chomp replaces the installed .app and relaunches automatically; the previous version is kept as a hidden rollback backup.
- If the application is protected by macOS permissions, an administrator authentication prompt may appear. Chomp never receives your macOS password.
- If launched directly from a DMG or App Translocation, Chomp offers to move into Applications and relaunch before trying to update.

**One-time installation:** Chomp 2.1.1 and earlier do not contain this Mac installer. Install **2.1.2 once** using a DMG or ZIP. Future updates from installed 2.1.2 Mac builds can use the new workflow.

**Trust limitation:** These Mac builds are still ad-hoc signed and not notarized. This custom updater verifies the GitHub download digest and bundle integrity, but it does not provide the publisher identity assurance of Apple Developer ID signing. When Developer ID signing and notarization become available, switch macOS to the standard Electron updater with matching Team ID.

## Windows

- Windows NSIS automatic updates, checksum validation, and silent restart-and-install remain available.
- Windows portable builds still require manual replacement.

## Downloads

[Chomp 2.1.2 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.1.2) after publication.

- Apple Silicon: `Chomp-2.1.2-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.1.2-mac-x64.dmg` or ZIP
- Windows installer: `Chomp-2.1.2-win-x64-Setup.exe`

Image compression, raster conversion, SVG tracing, transparency and background-removal behavior are unchanged.
