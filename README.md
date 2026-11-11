# GatorSqoosh

Batch image compression for Windows and macOS. Uses Squoosh-derived codecs through [jSquash](https://github.com/jamsinclair/jSquash). Images are processed locally.

## Usage

1. Open GatorSqoosh. On Windows, extract the ZIP and run `GatorSqoosh.exe`.
2. Drop images or folders into the window, or click **Add images** / **Add folder**.
3. Choose an output format, set the quality, and optionally resize.
4. Choose an output folder and click **Compress batch**.

Individual image exports use `name-compressed.ext`. Duplicate names receive a number. Existing exports are not overwritten.

## Folder quick compress

Dropping a folder scans all subfolders for JPEG, PNG, WebP, and AVIF images. Non-image files are excluded from compression. Choose one mode:

- **Duplicate folder**: create `folder-compressed` in the chosen output location, copy the full folder structure and all regular files, and replace successfully compressed images in that copy. Non-image contents stay byte-for-byte unchanged. Failed images keep their original copies. Source files are unchanged.
- **Images only**: create a new output folder containing only successfully compressed images, with the same relative subfolder paths.
- **Replace originals**: replace successfully compressed images in their source folders. Non-image files and failed images are unchanged. This mode keeps original formats, filenames, and paths; it does not need an output folder. Changes cannot be undone by the app.

Folder mode defaults to **Keep original format**. Copy and image-only modes also allow format conversion. Conversion changes file extensions and may require updating references in HTML or other files. Existing names are resolved with numbered suffixes.

Select an output location outside the source folders. Multiple source folders receive separate output directories. Symbolic links and special files are skipped. Folders are limited to 100,000 entries. Oversized images are excluded from compression but retained in full-folder copies. Source changes detected after scanning are rejected; clear the queue and add the folder again.

Replacement writes to a temporary file, flushes it, checks the source again, then renames it over the original. Stopping keeps completed replacements; remaining images are untouched. Folder exports start a new output directory on each run. A stopped or failed preparation may leave a partial output folder.

Failed files can be retried. **Stop after this image** saves the current file and leaves the rest queued. After a successful batch, **Compress again** exports another set using the current settings.

## Formats and limits

- Inputs: still JPEG, PNG, WebP, and AVIF; up to 150 MB and 48 megapixels per image.
- Outputs: JPEG (MozJPEG), WebP, PNG (OxiPNG), and AVIF (libavif).
- JPEG replaces transparency with white. PNG preserves decoded pixels; its quality control is disabled.
- Images are converted to 8-bit sRGB. Orientation is applied and metadata is removed.
- Animated images are rejected. Output files can be larger than their sources; size changes are shown in the queue.

## Development

Requires Node.js 24 and pnpm 11.

```sh
pnpm install
node node_modules/electron/install.js
pnpm build
pnpm start
```

`pnpm dev` runs the interface in a browser. File and folder operations require Electron. Rebuild before starting Electron after changes.

## Tests

```sh
pnpm test
pnpm build
pnpm test:desktop
pnpm test:folders
```

The desktop tests cover exports, resizing, failed images, duplicate filenames, source preservation, and stopping a batch. Folder tests use actual directory drag-and-drop and check all three output modes with nested mixed files and all four codecs.

## Packaging

```sh
pnpm dist:win
pnpm dist:mac
```

Run the Windows command on Windows and the macOS command on a Mac. Packages are written to `release/` for the host architecture. To build both Mac architectures:

```sh
pnpm build
pnpm exec electron-builder --mac dmg zip --arm64 --x64
```

The GitHub Actions workflow builds and tests on Windows and macOS when run manually or when a `v*` tag is pushed. Download packages from the workflow artifacts.

Builds are unsigned. Signed distribution requires Windows Authenticode or Apple signing and notarization credentials. For Mac signing, remove `mac.identity: null` from `package.json`.

## License

Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `licenses/` for codec licenses. GatorSqoosh is not affiliated with Google or the Squoosh team.
