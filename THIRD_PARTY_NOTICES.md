# Third-party notices

Chomp is an independent application, not affiliated with Google or the Squoosh team.

Image codecs are distributed through jSquash (Apache-2.0), derived from GoogleChromeLabs/Squoosh (Apache-2.0), Copyright Google Inc. and respective contributors.

- https://github.com/GoogleChromeLabs/squoosh
- https://github.com/jamsinclair/jSquash

Bundled image codecs include MozJPEG, libwebp, OxiPNG, and libavif/libaom (AVIF). The corresponding licenses and libaom patent terms are included in `licenses/`. libavif also uses libsharpyuv from libwebp, covered by `licenses/webp.md`.

Electron and its Chromium/Node.js dependencies carry their own notices. Electron's LICENSE and LICENSES.chromium.html ship beside the packaged executable. Development dependencies and runtime dependencies retain their licenses in their respective packages.

## HandBrakeCLI (external, optional)

Chomp can launch a separately installed HandBrakeCLI executable for local video transcoding. HandBrake is not bundled, downloaded, hosted, or redistributed as part of Chomp's installers and retains its own GNU GPL version 2 license and third-party notices. Official project: https://handbrake.fr/.
