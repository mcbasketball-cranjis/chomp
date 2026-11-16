# Third-party notices

Chomp is an independent application, not affiliated with Google or the Squoosh team.

Image codecs are distributed through jSquash (Apache-2.0), derived from GoogleChromeLabs/Squoosh (Apache-2.0), Copyright Google Inc. and respective contributors.

- https://github.com/GoogleChromeLabs/squoosh
- https://github.com/jamsinclair/jSquash

Bundled image codecs include MozJPEG, libwebp, OxiPNG, and libavif/libaom (AVIF). The corresponding licenses and libaom patent terms are included in `licenses/`. libavif also uses libsharpyuv from libwebp, covered by `licenses/webp.md`.

Electron and its Chromium/Node.js dependencies carry their own notices. Electron's LICENSE and LICENSES.chromium.html ship beside the packaged executable. Development dependencies and runtime dependencies retain their licenses in their respective packages.

## HandBrakeCLI (external, optional)

Chomp can launch a separately installed HandBrakeCLI executable for local video transcoding. HandBrake is not bundled, downloaded, hosted, or redistributed as part of Chomp's installers and retains its own GNU GPL version 2 license and third-party notices. Official project: https://handbrake.fr/.

## FFmpeg, bundled LGPL video engine

Chomp includes independently built FFmpeg executables and libraries in
Windows/macOS packages for local transcoding. The third-party binaries are
licensed under LGPL 2.1-or-later, and their independent license, source,
build/provenance, replacement and redistribution obligations must be honored.
Chomp's Apache-2.0 license does not replace the terms of FFmpeg or external
codec libraries. See [bundled FFmpeg details](docs/BUNDLED_FFMPEG.md),
[FFmpeg legal guidance](https://ffmpeg.org/legal.html) and the licenses
and source references shipped with the packaged video engine.

H.264/HEVC/AV1 patent rights can apply separately from source licenses.
A separately installed HandBrakeCLI is no longer required for video
compression and no HandBrake executable is bundled.
