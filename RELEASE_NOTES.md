# Chomp 1.4.1 — macOS signing integrity update

This release addresses the initial Chomp 1.4.0 macOS packaging issue reported as **“Chomp is damaged and can’t be opened”**.

## Changes

- Mac Intel (x64) and Apple Silicon (arm64) packages are now **ad-hoc code-signed** with explicit Electron entitlements for JIT and library validation compatibility. Unlike 1.4.0, they no longer ship as completely unsigned app bundles.
- The release pipeline mounts both DMGs and requires **`codesign --verify --deep --strict`** to succeed, in addition to architecture, icon and DMG layout checks.
- Documentation explains Gatekeeper, trusted-download precautions, and how to manually authorize an unnotarized Chomp release.
- All 1.4.0 features remain: local raster-to-SVG tracing, transparency preservation, white/black JPG background removal (edge-only or everywhere including letter holes), SVG import and raster export, and existing compression workflows.

## Important limitation: macOS trust and notarization

**This build is ad-hoc signed, not signed with an Apple Developer ID and not notarized by Apple.** A signature integrity check can detect malformed bundles but cannot make macOS automatically trust an app downloaded from the internet. Some users will still need to approve Chomp via **System Settings → Privacy & Security → Open Anyway** after attempting to open it, and a “damaged” warning can also mean the file was corrupted or modified.

For a Chomp copy you built yourself or have independently verified from this project’s official GitHub release, and only if normal approval fails, you may remove the quarantine attribute for Chomp alone:

```sh
xattr -dr com.apple.quarantine "/Applications/Chomp.app"
```

**This bypasses part of macOS's downloaded-app protection. It does not verify authenticity, make a damaged file safe or disable Gatekeeper system-wide.** Truly warning-free distribution requires Apple Developer ID signing and notarization, which need Apple Developer credentials.

## Downloads

See [Chomp 1.4.1 GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v1.4.1) after publication.

- **Apple Silicon:** `Chomp-1.4.1-mac-arm64.dmg` (or ZIP)
- **Intel Mac:** `Chomp-1.4.1-mac-x64.dmg` (or ZIP)
- **Windows:** `Chomp-1.4.1-win-x64-Setup.zip`, `Chomp-1.4.1-win-x64-Portable.zip`, `Chomp-1.4.1-win-x64.zip`, standalone EXEs and signing kit.

The Windows installer continues to update previous Chomp versions and migrate old installed GatorSqoosh copies for the same user while retaining user data. Windows optional local signing helpers do not add certificate trust.

## Test coverage

Windows and Intel macOS run the packaged desktop and vector tests. Apple Silicon is cross-packaged on Intel macOS and **statically** verified; native ARM hardware execution is not tested in CI. Package/code-signature integrity verification alone does not reproduce every possible Gatekeeper approval path on a user's Mac.
