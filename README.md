# Chomp

Batch image compression for Windows and macOS. Uses Squoosh-derived codecs through [jSquash](https://github.com/jamsinclair/jSquash). Images are processed locally.

## Usage

1. Windows: run `Chomp-<version>-win-x64-Setup.exe`. It installs the supporting files and a Start menu shortcut. macOS: open the DMG, drag Chomp into Applications.
2. Drop images or folders into the window, or click **Add images** / **Add folder**.
3. Choose an output format, set the quality, and optionally resize.
4. Choose an output folder and click **Compress batch**.

## Appearance and size limits

Appearance follows the system theme. Mac users can optionally select System, Light, or Dark from the Appearance menu. 

Enable **Maximum file size**, enter a value, and select KB or MB. The app first lowers quality within your selected quality setting, then reduces image dimensions if necessary. PNG fitting uses resizing because PNG compression is lossless. Limits range from 1 KB to 512 MB (1 KB = 1,024 bytes). Successful exports never exceed the limit. Failed images are not replaced; in full-folder copies, their original copies remain and may exceed the limit.

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

- Inputs: still JPEG, PNG, WebP, and AVIF; up to 512 MB and 160 megapixels per image.
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
pnpm test:appearance
```

The desktop tests cover exports, resizing, failed images, duplicate filenames, source preservation, and stopping a batch. Folder tests use actual directory drag-and-drop and check all three output modes with nested mixed files and all four codecs. Appearance tests check themes, persistence, Windows title-bar overlay, native maximize/restore, and strict size limits for all formats.

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

The GitHub Actions workflow builds on Windows x64, macOS Intel, and macOS Apple Silicon when main is updated, a `v*` tag is pushed, or the workflow runs manually. Each packaged executable runs the desktop, folder, and appearance tests on its matching OS and architecture. Windows also tests installation, the installed app, shortcuts, and uninstallation on the disposable runner. macOS mounts the DMG and checks the app and Applications shortcut. Once all checks pass, the workflow publishes a GitHub release with the Windows installer, ZIPs, and macOS DMGs. Existing releases are left unchanged.

Portable Windows ZIPs are also provided. Extract the entire folder and keep its files together; the EXE depends on the bundled resources. The installer handles these files automatically and does not require admin rights.

## Windows security and signing

An unknown-publisher SmartScreen warning is a reputation warning, not a named malware detection. Changing the package to an installer does not establish publisher reputation. The release workflow scans Windows outputs with Defender when the hosted scanner is available and publishes `Defender-scan.json` with the exact scan status and SHA-256 hashes. A scan detection or scanner failure blocks publication; an unavailable scanner is explicitly reported. Antivirus scan results do not establish SmartScreen reputation.

To sign Windows installers and app executables, configure repository secrets `WINDOWS_CSC_LINK` (certificate URL or base64 PFX) and `WINDOWS_CSC_KEY_PASSWORD`. Use a trusted code-signing certificate; self-signed certificates do not fix unknown-publisher warnings. No signing certificate is included. Signing identifies the publisher but does not guarantee immediate SmartScreen acceptance, and managed work PCs may enforce stricter policies.

Builds are unsigned and macOS builds are not notarized. Signed distribution requires Windows Authenticode or Apple signing and notarization credentials. For Mac signing, remove `mac.identity: null` from `package.json`.

`pnpm build` generates Windows ICO, macOS ICNS, and PNG icons from `assets/icon-source.png` using `scripts/icons.mjs`. To test an unpacked package, run `pnpm test:package` after packaging.

## License

Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `licenses/` for codec licenses. Chomp is not affiliated with Google or the Squoosh team.

## Internal self-signing

On the Windows account/computer that owns the non-exportable signing key, run `./scripts/build-internal.ps1`. For a new identity, explicitly use `-CreateCertificate`. This creates a code-signing key in CurrentUser\My and exports only its public CER into the ignored `internal-release/` folder. It does not add certificate trust or bypass application-control policies. See [recipient instructions](docs/INTERNAL-DISTRIBUTION.md). These local builds are separate from public GitHub release builds and do not upload the private key.

