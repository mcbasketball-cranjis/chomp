# Chomp 2.0.0 — redesigned image workspace

Chomp 2 brings a fresh, native-feeling desktop interface for compression, format conversion and editable SVG tracing, while keeping everything processed locally.

## What's new

- Three focused workspaces: **Compress**, **Convert**, and **Vectorize**.
- Image queue with quick switching, a draggable before/after preview, and actual locally computed output sizes and savings.
- Contextual settings for quality, tracing detail, resizing, file-size limits, and solid-color background removal.
- Persistent **Save files to** control, batch export, duplicate-folder, images-only, and replace-originals modes.
- Preserves transparent PNG/SVG conversion, true editable SVG paths, and edge-only versus everywhere removal (including enclosed letter holes).
- A new layered **Apple Icon Composer** macOS app icon using the native asset catalog for modern macOS. Windows keeps its existing icon.
- Light and dark appearance, safe overwrite behavior, and offline processing.

## macOS distribution

The macOS builds use ad-hoc code signatures and pass signature integrity checks, but **they are not Developer ID signed or Apple-notarized**. As before, Gatekeeper may require explicit approval through **System Settings → Privacy & Security → Open Anyway**, and a “damaged” warning may also indicate actual corruption. Only authorize copies from a source you trust and can verify.

For a Chomp copy you built yourself or independently verified from the official GitHub release, you can remove quarantine from that app alone if standard approval still fails:

```sh
xattr -dr com.apple.quarantine "/Applications/Chomp.app"
```

This changes macOS security handling; it does not verify software authenticity or repair corrupted binaries. Do not disable Gatekeeper globally.

## Downloads

See [Chomp 2.0.0 GitHub Releases](https://github.com/mcbasketball-cranjis/chomp/releases/tag/v2.0.0) once published.

- Apple Silicon: `Chomp-2.0.0-mac-arm64.dmg` or ZIP
- Intel Mac: `Chomp-2.0.0-mac-x64.dmg` or ZIP
- Windows: the x64 Setup and Portable ZIPs, plus standalone EXEs and optional local-signing helpers.

## Testing

Automated tests cover file and folder operations, true SVG tracing, preservation of transparency, output size limits, dark/light themes, and the desktop workflow. Native macOS packaging verifies the compiled Icon Composer `Assets.car`, code signature, and app architecture on both Intel and Apple Silicon artifacts. Apple Silicon is cross-packaged on the Intel runner and statically verified; native Apple Silicon execution still requires testing on ARM hardware.
