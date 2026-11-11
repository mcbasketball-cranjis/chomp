# GatorSqoosh

Batch image compression for Windows and macOS. Uses Squoosh-derived codecs through [jSquash](https://github.com/jamsinclair/jSquash). Images are processed locally.

## Usage

1. Open GatorSqoosh. On Windows, extract the ZIP and run `GatorSqoosh.exe`.
2. Drop images into the window or click **Add images**.
3. Choose WebP, JPEG, or PNG, set the quality, and optionally resize.
4. Choose an output folder and click **Compress batch**.

Outputs use `name-compressed.ext`. Duplicate names receive a number. Originals and existing files are not overwritten.

Failed files can be retried. **Stop after this image** saves the current file and leaves the rest queued. After a successful batch, **Compress again** exports another set using the current settings.

## Formats and limits

- Inputs: still JPEG, PNG, WebP, and AVIF; up to 150 MB and 48 megapixels per image.
- Outputs: JPEG (MozJPEG), WebP, and PNG (OxiPNG).
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
```

The desktop tests cover exports, resizing, failed images, duplicate filenames, source preservation, and stopping a batch.

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
