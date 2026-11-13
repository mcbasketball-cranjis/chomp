# Chomp 2.2.0

## Vector Studio

Chomp 2.2 introduces a precision-editing workspace for logos, flat artwork, and difficult lettering while retaining the existing local compressor and converter.

- **Advanced SVG tracing:** Choose logo, artwork, or automatic modes; adjust colors, smoothing, corner retention, cleanup, and trace resolution.
- **Editable vector shapes:** Inspect and select individual traced regions, recolor a single shape or all matching fills, remove unwanted shapes, and undo/redo changes.
- **Shape inspector:** Find very small elements, browse shapes in pages, and zoom to selected contours.
- **Point editing:** Drag anchors and Bézier control handles, insert or remove points, convert line segments to curves or back, and nudge points precisely with the keyboard.
- **Source comparison:** Overlay the original image while editing and adjust its opacity to refine letter and logo outlines.
- **Local eyedropper:** Pick a fill color or background-removal matte directly from the original image.
- **SVG cleanup:** Remove redundant coordinates and straight-line segments without intentionally changing the rendered outline, with one-step undo.
- **True vector export:** Save actual editable SVG paths; do not embed the input raster or require internet access for tracing or editing.
- **Safer editing:** Validate generated SVGs before editing, preserve exported changes on reopening, keep each source image unchanged, and avoid carrying manually sampled background colors into subsequent batches.

## Quality and compatibility

- Extend automated tests for the tracing engine, vector shapes, geometry edits, source overlay, eyedropper, desktop controls, and saved SVGs.
- Keep Windows installer and portable builds, Windows Store-specific MSIX packaging, and macOS Intel/Apple Silicon packages.
- Windows GitHub installers update through Chomp's existing updater; Microsoft Store installs are updated by the Store, subject to approval and device update settings.
- Complex or third-party SVG files that do not match Chomp's own editable format continue through the ordinary conversion path.
- Mac downloads remain ad-hoc signed until Developer ID signing and notarization are configured.

## Downloads

[Chomp 2.2.0 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.2.0)

- Apple Silicon: `Chomp-2.2.0-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.2.0-mac-x64.dmg` or ZIP
- Windows: `Chomp-2.2.0-win-x64-Setup.exe` or portable build

*Release artifacts become available only after the release workflow succeeds and v2.2.0 is published.*
