# Chomp 2.3.0

## Video compression

Chomp adds a dedicated **Video** workspace powered by a locally installed HandBrakeCLI executable.

- **Compress videos:** Import MP4, MOV, M4V, MKV, WebM and AVI. Export H.264 videos to MP4 or MKV.
- **Three HandBrake presets:** Small (Very Fast 720p30), Balanced (Fast 1080p30), and Higher quality (HQ 1080p30 Surround).
- **Mixed-media compression:** Queue images and videos together in the existing **Compress** workspace. Image conversions and SVG tracing remain available.
- **Folder processing:** Keep nested directories with Duplicate Folder or Media Only. Original videos remain untouched.
- **Progress and cancellation:** Track video encode progress and stop active transcoding. Partial outputs are cleaned up and duplicate filenames are never overwritten.
- **Safe output:** Verify sources before and after encoding, create output in a private temporary directory and publish without clobbering other files.

**Setup required:** Install the open-source [HandBrakeCLI](https://handbrake.fr/downloads.php) independently and select **Locate HandBrakeCLI** if Chomp does not find it automatically. HandBrake's GPLv2 executable is **not bundled** with Chomp. The transcoding happens entirely on the user's device. Supported input extensions do not guarantee every video codec is decodable. Output is not guaranteed to be smaller and preset selection may change frame rate, dimensions, audio or subtitle tracks.

## Vector Studio

- **Move whole shapes:** Drag a selected vector region or nudge it with the arrow keys, with Shift for quarter-unit precision.
- **Smart snapping:** Align edges and centers to neighboring shapes or the artboard. Optional live guides appear during movement; hold Alt for temporary free movement.
- **Reversible edits:** SVG coordinates, compound contours, curves and holes remain editable; movements integrate with undo and redo.

## Quality and compatibility

- Expanded tests for safe video exports, job cancellation, existing output protection, folder handling, and vector snapping.
- Automated end-to-end HandBrakeCLI test of synthetic footage; image/vector desktop tests and Windows/macOS package validation.
- Maintains Windows x64 installer and portable releases, Windows Store MSIX output, and Intel/Apple Silicon macOS packages.
- Does not require network access for compression or tracing. Existing Chomp updater behavior is preserved.
- macOS packages remain ad-hoc signed until Apple Developer ID signing and notarization are configured.

## Downloads

After the v2.3.0 build and release workflow completes, the GitHub release provides installers at:

[Chomp 2.3.0 on GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.3.0)

- Apple Silicon: `Chomp-2.3.0-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.3.0-mac-x64.dmg` or ZIP
- Windows: `Chomp-2.3.0-win-x64-Setup.exe` or portable build
- Microsoft Store: Updated via Microsoft certification, not directly from the unsigned MSIX archive

*No new installer exists until the release workflow succeeds and publishes v2.3.0.*
