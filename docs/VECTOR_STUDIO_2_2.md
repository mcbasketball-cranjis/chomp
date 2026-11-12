# Chomp 2.2 Vector Studio (development only)

This document describes unreleased work on the `dev/chomp-2.2-vector-studio` branch.
**Do not tag, publish a GitHub release, or submit another MSIX while the initial
Microsoft Store listing is still under certification.**

## New features

- **Advanced tracing** is collapsed by default. Existing Simple/Balanced/Detailed
  controls remain available without opening it.
- **Artwork type:** Auto detect uses the original flat-logo detection and falls
  back to the illustration tracer. Logo & text tries a lower background-coverage
  threshold but still validates stable ink colors. Illustration bypasses the
  logo classifier.
- **Colors:** Auto preserves legacy limits. For illustrations choose up to 32
  colors, or up to 12 useful ink colors for logo segmentation (with any retained
  matte potentially emitted as an additional layer).
- **Curve smoothing:** 0–100 changes path simplification tolerance.
- **Sharp corners:** 0–100 changes the turning-angle test and corner length,
  preserving the original threshold at 50.
- **Noise cleanup:** 0–100 scales contour minimum area. Use lower values for
  small text accents and dots; higher values can deliberately remove tiny
  details as well as compression artifacts.
- **Tracing resolution:** Standard retains the existing 1.1 MP pixel budget.
  High fidelity allows up to 2.4 MP for better small lettering at higher CPU
  and memory cost. Images are never upsampled.
- **Manual background selection:** For a known solid backdrop, choose a color
  with the local native color picker instead of using corner detection. Edge-only
  mode still protects enclosed same-color areas; Everywhere removes all matching
  pixels. A selected color never authorizes removal of unrelated colors.
- **Preview:** Zoom between 100% and 800%. The Pan button enables dragging
  both synchronized preview layers. Fit resets zoom and pan. When panning, the
  compare slider temporarily stops intercepting pointer events.

## Shape cleanup and palette

- **Edit shapes** appears on a traced raster preview. Selecting it produces
  independently editable, path-only SVG regions, preserving connected holes
  (such as letter counters) within their filled region. Existing ordinary SVG
  export is unchanged unless shape editing is requested.
- Click a shape to recolor it or remove it. Edit history supports Undo, Redo
  and Reset. The source raster file is never changed.
- The palette shows current SVG fill colors and the number of visible shapes
  using each color. Click a swatch to select a shape of that color.
- Enable **All matching colors** to apply the selected recolor or removal to
  every currently visible shape with that same fill. The whole operation is
  one undo/redo step; the default remains single-shape editing.
- SVG output uses the exact edited document shown in the preview. Chomp checks
  the SHA-256 hash of the source before exporting an edited document and
  refuses to use stale edits on changed source files.
- A previously exported **Chomp shape-editor SVG** can be reopened in Vectorize
  and edited again without retracing, including after shapes were removed. The
  editor deliberately does not claim to support arbitrary external SVG syntax.
  Other safe SVG inputs retain the existing passthrough behavior.
- The SVG editor and palette are local and optional. No images, paths or color
  swatches are uploaded or embedded in repo fixtures. Test artwork is generated.

## Safety and compatibility

- All work remains local; source images never leave the user's machine.
- No sample images from customers or outside projects belong in the repository.
  New tests generate fictional, geometric pixel art in memory.
- Trace values are normalized and bounded in the codec worker. No AI model or
  remote service is added.
- Defaults preserve the original tracing algorithms, palettes, resolution
  budget and corner thresholds, with no change to existing compression settings.
- Existing SVG input remains passthrough for SVG output, and can still be
  rasterized in Convert.
- The GitHub release workflow must not be triggered for this branch. Testing
  should occur via pull request checks; packaging is for validation only.

## Validation

Run `pnpm test`, `pnpm build`, and `pnpm test:vector`. On supported
runners, also verify the complete desktop integration test suite. Compare real
before/after results at 100% and higher zoom using only synthetic or privately
supplied test imagery (do not commit or publish private sources).
