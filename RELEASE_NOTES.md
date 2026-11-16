# Chomp 2.4.1

## Video workspace polish

- Removed the unnecessary technical engine/install messages from the Video tab and video previews. Compression works normally without exposing the underlying encoding implementation.
- Corrected the **Stop** control across video and image compression. It no longer says "Stop after this image" when compressing videos.
- Updated the empty dropzone to clearly accept both images and videos.

## Verified mixed-media bulk compression

- Added a real desktop integration test for compressing a PNG image **and** an AVI video in the same **Compress** batch.
- Verified actual WebP image output and VP9/WebM video output from the same queue, including **Duplicate folder** processing.
- Confirmed originals remain unchanged and that the existing photo, video, and vector tests continue to pass.

All of the new features from **Chomp 2.4.0** remain: built-in, offline video compression with no separate CLI installation, codec-aware MP4/MOV/MKV/WebM/GIF output, additional video input formats, and Vector Studio editing tools.

Windows and macOS binaries are published only after the production release checks pass. The Microsoft Store update follows its separate certification process. macOS installers are still ad-hoc signed; Apple Developer ID signing/notarization is not yet configured.
