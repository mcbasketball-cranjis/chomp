# Video compression in Chomp

## Overview

Chomp has a **Video** workspace for batch video compression. The **Compress** workspace
also accepts a mixed queue of images and videos, including entire nested folders.
The **Convert** and **Vectorize** tools continue to operate on images only.

Supported input extensions: `.mp4`, `.m4v`, `.mov`, `.mkv`, `.webm`, `.avi`.
These are container filters, not a guarantee that every codec in a file can be decoded.
Video inputs can be up to 16 GiB per file.

Output containers: MP4 or MKV, H.264 video via HandBrakeCLI. Presets:
- Small file: HandBrake `Very Fast 720p30`
- Balanced: HandBrake `Fast 1080p30`
- Better quality: HandBrake `HQ 1080p30`

Presets can reduce resolution/frame rate and may discard tracks or alter audio/subtitle
behavior according to HandBrake's preset definition. Output size is **not guaranteed**
to be smaller. Video size limits in the image compressor do not apply to videos.

## Engine setup

**HandBrakeCLI must be installed separately.** Chomp does not bundle the HandBrake
executable, download it on demand, or send videos to a remote API. The desktop app
searches common CLI installation paths, then PATH. If it isn't found, choose
**Locate HandBrakeCLI** in Video settings and select a trusted executable from the
official project or your package manager:

- https://handbrake.fr/downloads.php
- https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
- macOS Homebrew: `brew install handbrake`

Windows **HandBrake GUI** alone does not always provide a CLI executable: install the
CLI distribution separately if needed. Restarting Chomp may require locating a
nonstandard installation again. The application validates the selected executable
by running `--version` and checking that it reports HandBrake.

HandBrake is independent GPLv2-licensed software. Keeping it as an external
executable does not include or redistribute its binaries in Chomp's existing
Apache-2.0 downloads. Before any future embedded-distribution plan, review
HandBrake's GPL obligations, complete corresponding-source availability,
third-party codec licenses and Microsoft Store/macOS packaging policy.

## Queue behavior

- Use **Video** to compress videos only. Any images already in the queue stay
  untouched until you switch back to Compress, Convert or Vectorize.
- **Compress** processes mixed image/video batches sequentially; images use Chomp's
  existing codec worker and videos use the local HandBrakeCLI process.
- Individual file exports create `name-compressed.mp4` or `name-compressed.mkv`,
  avoiding overwrite by adding numbered suffixes.
- **Duplicate folder** duplicates nested content and replaces the copied video
  with its successfully encoded output. Originals remain untouched. Non-media
  files are copied unchanged.
- **Media only** creates an output folder containing only processed media while
  preserving relative paths.
- **Replace originals** remains **image-only**. If the queued folder contains
  videos, the UI disables this destructive mode.
- **Stop** cancels the active HandBrake encode and deletes its private partial file.
  Previously completed outputs are kept. Failed sources remain unchanged.
- Source files are verified both before and after transcoding to reject changes.
  Existing output names are not overwritten.

### Development verification

Use `pnpm test` for the deterministic video engine tests and `pnpm build`
for renderer syntax/build validation. Tests use synthetic dummy bytes and a fake
process runner; they do not upload or commit customer videos. Manual validation
with a separately installed real HandBrakeCLI is still required for OS-specific
codec, progress and packaging compatibility, especially on Microsoft Store MSIX.

The CLI argument interface uses HandBrake's officially documented `--input`,
`--output`, `--preset` and `--format` switches. It runs with `shell:false`.
Only hardcoded compression presets/containers can be passed from the UI.
