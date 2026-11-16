# Built-in video engine (FFmpeg, planned for Chomp 2.4)

Chomp can ship a **native, local FFmpeg engine** inside its Windows and macOS
installation packages. End users do not need to install FFmpeg or HandBrakeCLI
or know what a command-line tool is. This is a packaging change, not a cloud API:
input files never leave the user's device.

## Formats and codecs

Input files recognized in Video and mixed Compress queues include:
MP4, M4V, MOV, MKV, WebM, AVI, MPG, MPEG, M2V, TS, MTS, M2TS,
3GP, 3G2, OGV, FLV, WMV, ASF, VOB, MXF and GIF.
These are **extension-based import filters**; FFmpeg may not decode every
codec or malformed file inside any of these containers.

Output containers and permitted video codecs:

| Container | Codecs |
| --- | --- |
| MP4 | H.264, H.265/HEVC, AV1 |
| MKV | H.264, H.265/HEVC, AV1, VP9 |
| MOV | H.264, H.265/HEVC |
| WebM | VP9, AV1 |
| Animated GIF | GIF |

Codec options are shown as available only when the bundled FFmpeg build
reports a compatible encoder. Hardware encoders can still fail at runtime when
the GPU, macOS version or driver is incompatible; the error remains visible in
the queue and the original video is never changed. H.264/HEVC commonly use
system VideoToolbox (macOS) or supported GPU hardware encoders (Windows);
Windows may have a software fallback where the build provides OpenH264.
Software AV1/VP9 can be much slower than H.264. GIF has no audio.

The **Small / Balanced / Quality** presets control resolution, quality/bitrate,
and frame rate. They do not promise an exact output size. The default does
not change the existing image compression settings.

## Bundling and build provenance

**Do not commit binary assets.** `pnpm prepare:ffmpeg` fetches
checksum-pinned *LGPL-only* releases before the Windows/macOS packager runs.
`vendor/ffmpeg/` is gitignored. The native runtime is packaged as
`resources/ffmpeg/<platform>-<arch>/bin/{ffmpeg,ffprobe}`, with neighboring
libraries and original license/build provenance files.

The current pinned upstream source distributions are:

- **macOS Intel and Apple Silicon:** dfloresc/ffmpeg-macos-builds
  [v9.0.1-1](https://github.com/dfloresc/ffmpeg-macos-builds/releases/tag/v9.0.1-1).
  LGPL FFmpeg 9.0.1 with locally supplied libvpx, libaom, Opus, LAME and
  system VideoToolbox support. The original FFmpeg source tarball and external
  library source archives, build scripts and bundled licenses are in the
  upstream release and repository.
- **Windows x64:** FFmpeg-Builds/FFmpeg-Builds
  [autobuild-2026-11-15-12-40](https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/tag/autobuild-2026-11-15-12-40),
  LGPL FFmpeg 9.0.2 branch compiled without GPL-only x264/x265 components.
  Build scripts, source revision and reproducibility information are available
  from that pinned release/tag and the project's public build repository.

The exact SHA-256 checksums and download URLs are in
`scripts/prepare-ffmpeg.mjs`. Build fails closed if a digest differs or an
archive has an unsafe path. Never swap LGPL for GPL binaries as a fallback.

FFmpeg is a separate LGPL library/tool and is not authored by Chomp. Follow
[FFmpeg's legal and distribution guidance](https://ffmpeg.org/legal.html):
keep the applicable complete, corresponding source and build scripts
available, retain copyright/license notices and allow replacement/relinking
as required. The package's license documents and user-facing credits must
match what is actually shipped. Additional AV1/H.264/HEVC patents may apply
independently of the copyright licenses. Review Microsoft Store certification,
Apple signing/notarization and legal obligations before publishing this build.

## Development & verification

`pnpm test` checks codec and container selection, process argument safety,
and progress parsing without any real codec dependencies.

`pnpm test:ffmpeg:real` (planned in CI) exercises synthetic media and a native
FFmpeg build on Linux, including the safe output writer. This is not a substitute
for the Windows and macOS packaged-app smoke checks. Native packages must be
built and inspected on their respective runners, and macOS arm64 execution
must be verified on Apple Silicon before declaring full support.

The pre-existing HandBrake unit tests remain as regression coverage for the
legacy path, but the new user-facing workflow no longer requires HandBrakeCLI
installation. No HandBrake binaries are distributed.
