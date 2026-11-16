# Chomp 2.4.0

## Video compression without a separate installation

Chomp now includes a **local, LGPL-configured FFmpeg video engine** in its Windows and macOS desktop downloads. There is **no HandBrakeCLI or FFmpeg installation step** for the user.

- **Video encoding:** H.264, H.265/HEVC, AV1, VP9 and animated GIF, as available in the bundled build and on the user's hardware.
- **Output formats:** MP4, MKV, MOV, WebM and animated GIF, with incompatible codec/container pairs disabled.
- **More video inputs:** MP4, M4V, MOV, MKV, WebM, AVI, MPG, MPEG, M2V, TS, MTS, M2TS, 3GP, 3G2, OGV, FLV, WMV, ASF, VOB, MXF and GIF. Support depends on the actual codec and file integrity, not just the extension.
- **One local queue:** The dedicated Video tab and existing mixed image/video compression workflow support the broader formats.
- **Encoding presets:** Small, Balanced and Higher quality, with sensible resolution limits. Output files are not guaranteed to be smaller than inputs.
- **Source protection:** Input videos remain unchanged; the existing folder-copy and Media Only modes retain their safe, collision-free output behavior, progress and cancellation.

Encoding speed and availability depend on the device. In particular, H.264 and HEVC can require supported hardware; software AV1/VP9 can be slower. Animated GIF output contains no audio. Video compression happens entirely on the user's device, without uploads.

## Previous Chomp improvements

Also includes Chomp 2.3.0's whole-shape movement and precision snapping in Vector Studio, editable SVG path tools, local image compression and conversion, safe folder processing, and existing application update support.

## Quality and compatibility

- Automated real FFmpeg transcodes of synthetic VP9 WebM and animated GIF media, plus continued image/video and SVG unit/desktop tests.
- Windows x64 installers, portable package, and Microsoft Store unsigned MSIX package validation.
- macOS Intel and Apple Silicon builds with the native layered app icon.
- SHA-256-pinned FFmpeg archives and license/source/build provenance. No GPL-only x264/x265 binaries are intentionally bundled.
- Existing macOS downloads remain ad-hoc signed until Developer ID signing and notarization are configured.
- Microsoft Store installs are updated through the Store after certification and are separate from GitHub installer auto-updates.

## Third-party software and redistribution

This software uses [FFmpeg](https://ffmpeg.org), distributed under the LGPL and its applicable bundled codec-library licenses. Chomp's Apache-2.0 license does not replace those terms. Third-party provenance, FFmpeg source/build references, and obligations are in [docs/BUNDLED_FFMPEG.md](docs/BUNDLED_FFMPEG.md) and THIRD_PARTY_NOTICES.md. Codec-related patents may have additional requirements.

## Downloads

[Chomp v2.4.0 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.4.0)

- Apple Silicon: `Chomp-2.4.0-mac-arm64.dmg` (or ZIP)
- Intel Mac: `Chomp-2.4.0-mac-x64.dmg` (or ZIP)
- Windows: `Chomp-2.4.0-win-x64-Setup.exe` (or Portable EXE)
- Microsoft Store: Store-compatible MSIX is separately submitted/certified, not automatically installed from GitHub

The actual downloads are available only after the release workflow succeeds and publishes v2.4.0.
