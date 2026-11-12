# Chomp 2.1.1

## Changes

- **Compress:** WebP, JPEG, PNG, AVIF, or keep the original format. SVG is no longer offered as a new output format.
- **Convert:** WebP, JPEG, PNG, and AVIF. SVG files remain supported as inputs for conversion into any raster format.
- **Vectorize:** actual editable SVG path output. Tracing controls appear only here.
- Each workspace remembers its chosen output format. In-place folder replacement stays in Compress and preserves original formats; switching to Convert or Vectorize switches to images-only export.
- No changes to existing SVG transparency preservation, encoding, background removal, or macOS Icon Composer artwork.
- For updates **after 2.1.1**, the Windows Restart & install action applies approved per-user NSIS upgrades silently instead of showing another installer wizard.

## Update test

Chomp 2.1.1 is the first patch release after the 2.1.0 updater. The release pipeline verifies that the Windows installer ships matching SHA-512 update metadata. The post-release updater test checks that an installed Chomp 2.1.0 detects and downloads Chomp 2.1.1 via the public GitHub feed.

On **Windows NSIS installations**, open Updates and select **Check now**, **Download update**, then **Restart & install** when ready. The current 2.1.0 updater performs a non-silent installer launch; follow any installer prompts. Windows portable installations and ad-hoc-signed macOS apps continue to use update notifications and a direct download.

## Downloads

[Chomp 2.1.1 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.1.1) once published.

- Intel Mac: `Chomp-2.1.1-mac-x64.dmg` or ZIP
- Apple Silicon: `Chomp-2.1.1-mac-arm64.dmg` or ZIP
- Windows: `Chomp-2.1.1-win-x64-Setup.exe` or portable packages

macOS installers remain ad-hoc signed, not Apple Developer ID signed or notarized. Gatekeeper may still require manual approval.
