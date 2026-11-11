# Chomp 1.4.0 — Vector conversion and transparent backgrounds

Chomp now traces ordinary images into **real, editable SVG vector paths** and converts SVG files back into regular image formats. The entire process runs on your computer without an AI service, account, or uploads.

## What's new

- **Raster → SVG tracing:** Convert PNG, JPEG, WebP, or AVIF artwork into actual vector shapes, not an SVG containing an embedded bitmap. Choose **Simple**, **Balanced**, or **Detailed** tracing.
- **Transparent logo conversion:** PNG transparency stays transparent in SVG exports; Chomp doesn't add a white background.
- **Remove backgrounds without AI:** Optional corner-color detection works with plain white, black, or similarly colored image backgrounds, including JPG files.
- **Choose the removal area:** **Edges only** (default) removes the connected outer background while preserving enclosed matching colors. **Everywhere** also removes matching background color in enclosed holes, such as letters **O, e, p, and a**. The latter may remove genuine same-colored details; adjust tolerance to suit your logo.
- **SVG → PNG, WebP, JPEG, or AVIF:** Rasterize vector artwork with transparency preserved in supported formats. JPEG always has an opaque background.
- **Batch and folder workflows:** SVG is available alongside the existing formats; original files remain untouched unless you explicitly select the existing replace-originals mode.
- **New tests:** Automated SVG round trips, JPEG background removal, enclosed lettering, source preservation, and local build checks.

**Best suited to:** logos, icons, flat illustrations, and other simple graphics. Photograph tracing is approximate; complex photo cutouts and AI masking are not included.

## Windows upgrades and distribution

- Windows Setup updates previously installed Chomp versions and migrates old installed GatorSqoosh copies, including old shortcuts and uninstall registration. Existing app data is retained. Portable copies must be replaced manually.
- Windows ZIP bundles include **Sign on this PC.cmd**, **Sign installed Chomp.cmd**, the local PowerShell signing script, and instructions; the standalone EXEs have a separate **Chomp-Windows-Signing-Kit.zip**.
- The optional local signing workflow keeps private keys on your computer and does not install certificate trust or bypass security policy. Self-signing does not guarantee Windows SmartScreen acceptance.

### Windows downloads

After publication, download assets from the [Chomp 1.4.0 release](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v1.4.0):

- **Installer + signing kit:** `Chomp-1.4.0-win-x64-Setup.zip`.
- **Single-file portable + signing kit:** `Chomp-1.4.0-win-x64-Portable.zip`.
- **Portable folder + signing kit:** `Chomp-1.4.0-win-x64.zip`.
- The installer and portable EXEs are also available separately.

### macOS downloads

Select the DMG for **Apple Silicon (arm64)** or **Intel (x64)**, then drag Chomp into Applications. macOS packages are currently unsigned and not notarized.

## Verification

The release workflow executes desktop conversion tests for Windows x64 and Intel macOS, and checks their installers and distribution packages. Due to recurring GitHub-hosted Apple Silicon runner allocation failures, the arm64 DMG and ZIP are cross-packaged on an Intel Mac and statically checked for an actual arm64 executable, application contents, and DMG layout. **The arm64 app is not executed on native Apple Silicon hardware in this CI run.** Windows upgrade, portable and signing-kit checks still run. Windows Defender scan status and hashes are included when available.
