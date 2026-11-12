/**
 * User-facing trace controls. Keep defaults equivalent to the v2.1 tracer.
 * Normalization happens in the processing worker as well as the UI so a
 * malformed IPC payload cannot request unbounded colors or tracing pixels.
 */
export const TRACE_DEFAULTS = Object.freeze({
  mode: 'auto',
  colors: 0,
  smoothing: 50,
  corners: 50,
  cleanup: 50,
  resolution: 'standard'
});

function slider(value, fallback) {
  const n = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(n)
    ? fallback : Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeTraceOptions(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const requestedColors = Number(raw.colors);
  return {
    mode: ['auto', 'logo', 'artwork'].includes(raw.mode) ? raw.mode : TRACE_DEFAULTS.mode,
    colors: raw.colors === '' || raw.colors === 'auto' || raw.colors == null ||
      !Number.isFinite(requestedColors) || requestedColors <= 0
      ? 0 : Math.max(2, Math.min(32, Math.round(requestedColors))),
    smoothing: slider(raw.smoothing, TRACE_DEFAULTS.smoothing),
    corners: slider(raw.corners, TRACE_DEFAULTS.corners),
    cleanup: slider(raw.cleanup, TRACE_DEFAULTS.cleanup),
    resolution: raw.resolution === 'high' ? 'high' : 'standard'
  };
}

export function contourSettings(detail, raw) {
  const opts = normalizeTraceOptions(raw);
  const baseTolerance = detail === 'detailed' ? 0.45 : detail === 'simple' ? 1.1 : 0.8;
  const baseMinArea = detail === 'detailed' ? 0.35 : detail === 'simple' ? 1.5 : 0.5;
  return {
    // The neutral midpoint precisely preserves existing smoothing and cleanup.
    toleranceFactor: Math.pow(2, (opts.smoothing - 50) / 50),
    coverageTolerance: baseTolerance * Math.pow(2, (opts.smoothing - 50) / 50),
    areaFactor: Math.pow(2, (opts.cleanup - 50) / 25),
    coverageMinArea: baseMinArea * Math.pow(2, (opts.cleanup - 50) / 25),
    corners: opts.corners
  };
}

export function tracePixelBudget(raw) {
  return normalizeTraceOptions(raw).resolution === 'high' ? 2_400_000 : 1_100_000;
}
