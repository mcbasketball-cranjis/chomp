# Video compression

Chomp's next-generation local video workflow uses a **bundled FFmpeg engine**
in its Windows and macOS desktop packages. No user-installed CLI is required.

See **[Bundled FFmpeg](BUNDLED_FFMPEG.md)** for supported input containers,
output codecs, device-dependent hardware acceleration, exact binary
provenance, security/verification, and FFmpeg LGPL legal obligations.

The legacy v2.3.0 HandBrake integration remains in its release history.
The new video engine reuses its protected folder-batch output and cancellation
handling, while choosing codec/container pairs supported by the installed
FFmpeg binary. Source recordings are never overwritten and output-size
reductions are not guaranteed.

Use Video for single-type video queues or Compress for mixed media folders.
