# Chomp 2.1.4

## Clean logo vector tracing

- Detect flat-color JPG and PNG logos automatically. Keep a small number of real artwork colors instead of tracing JPEG noise and antialias fringes as separate SVG fills.
- Improve thin wordmarks and lettering with higher-resolution outlines, gentler path simplification, and cleaner background boundaries.
- Keep opaque solid-color backgrounds when requested and preserve transparency when removing them.
- Retain letter counters and enclosed background regions in **Edges only** mode; **Everywhere** mode can clear those matching background regions.
- Continue to export editable SVG paths, not embedded bitmaps. Complex photographs and illustrations keep their detailed tracing fallback.
- Add automated noisy JPEG, wordmark geometry, file-size, and transparent-export regression tests.

## Downloads

[Chomp 2.1.4 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.1.4)

- Apple Silicon: `Chomp-2.1.4-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.1.4-mac-x64.dmg` or ZIP
- Windows: `Chomp-2.1.4-win-x64-Setup.exe` or portable build

Mac releases remain ad-hoc signed pending Developer ID signing and notarization.
