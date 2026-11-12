# Chomp 2.1.3

## Smoother SVG vector tracing

- Generate smoother, editable SVG contours with subpixel edge tracing and cubic Bézier curves instead of visible pixel-grid stair steps.
- Keep intentional sharp corners on logos and artwork; simplify unnecessary edge nodes.
- Better handle antialiased colors and semi-transparent edges while preserving transparent backgrounds and letterform counters.
- Keep SVG-to-raster conversion and direct SVG passthrough intact.

## Context-aware editing

- Show folder-processing choices only when a genuine folder-only batch is selected, instead of showing them while editing individual images.
- Hide irrelevant tracing, compression quality, and size-cap controls based on the operation and output format.
- Add obvious **Clear all** and **New batch** controls, including directly on the finished-batch summary.
- Reset folder import handling to preserve non-image files when duplicating a folder, and release stale folder roots when their final image is removed.

## Compatibility and updates

- No new dependencies. Existing Windows and macOS installers and in-app updater remain unchanged.
- macOS builds remain ad-hoc signed until Developer ID signing and notarization are configured.

## Downloads

[Chomp 2.1.3 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.1.3)

- Apple Silicon: `Chomp-2.1.3-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.1.3-mac-x64.dmg` or ZIP
- Windows: `Chomp-2.1.3-win-x64-Setup.exe` or portable build
